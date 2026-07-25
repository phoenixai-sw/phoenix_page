"use client";

import { createClient, type SupabaseClient, type User } from "@supabase/supabase-js";

export type CloudUser = { id: string; email: string };

export type CloudProjectSummary = {
  local_id: string;
  title: string;
  channel: string | null;
  ratio: string | null;
  model: string | null;
  request: string | null;
  created_at: string;
  updated_at: string;
};

export type CloudProjectRow = CloudProjectSummary & { sections: unknown; source_paths: unknown };

export type CloudProjectPayload = {
  localId: string;
  title: string;
  channel: string;
  ratio: string;
  model: string;
  request: string;
  sections: unknown;
  sourcePaths: string[];
};

let cachedClient: SupabaseClient | null | undefined;

export function getSupabase(): SupabaseClient | null {
  if (cachedClient !== undefined) return cachedClient;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  cachedClient = url && anonKey
    ? createClient(url, anonKey, {
        auth: { flowType: "pkce", persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
      })
    : null;
  return cachedClient;
}

export function isCloudConfigured() {
  return Boolean(getSupabase());
}

function toCloudUser(user: User | null | undefined): CloudUser | null {
  return user ? { id: user.id, email: user.email || "" } : null;
}

export function subscribeCloudUser(onChange: (user: CloudUser | null) => void) {
  const supabase = getSupabase();
  if (!supabase) {
    onChange(null);
    return () => {};
  }
  supabase.auth.getSession().then(({ data }) => onChange(toCloudUser(data.session?.user)));
  const { data } = supabase.auth.onAuthStateChange((_event, session) => onChange(toCloudUser(session?.user)));
  return () => data.subscription.unsubscribe();
}

function requireSupabase() {
  const supabase = getSupabase();
  if (!supabase) throw new Error("클라우드 저장이 아직 설정되지 않았습니다.");
  return supabase;
}

export async function signInWithGoogle() {
  const supabase = requireSupabase();
  const { error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: `${window.location.origin}/studio` }
  });
  if (error) throw new Error(error.message);
}

export async function signOutCloud() {
  const supabase = requireSupabase();
  const { error } = await supabase.auth.signOut();
  if (error) throw new Error(error.message);
}

export async function upsertCloudProject(payload: CloudProjectPayload) {
  const supabase = requireSupabase();
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) throw new Error("클라우드 저장은 Google 로그인 후 사용할 수 있습니다.");

  const { error } = await supabase.from("projects").upsert(
    {
      user_id: userData.user.id,
      local_id: payload.localId,
      title: payload.title,
      channel: payload.channel,
      ratio: payload.ratio,
      model: payload.model,
      request: payload.request,
      sections: payload.sections,
      source_paths: payload.sourcePaths,
      updated_at: new Date().toISOString()
    },
    { onConflict: "user_id,local_id" }
  );
  if (error) throw new Error(error.message);
}

export async function listCloudProjects(): Promise<CloudProjectSummary[]> {
  const supabase = requireSupabase();
  const { data, error } = await supabase
    .from("projects")
    .select("local_id,title,channel,ratio,model,request,created_at,updated_at")
    .order("updated_at", { ascending: false })
    .limit(50);
  if (error) throw new Error(error.message);
  return data || [];
}

export async function fetchCloudProject(localId: string): Promise<CloudProjectRow | null> {
  const supabase = requireSupabase();
  const { data, error } = await supabase
    .from("projects")
    .select("local_id,title,channel,ratio,model,request,sections,source_paths,created_at,updated_at")
    .eq("local_id", localId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

export async function renameCloudProject(localId: string, title: string) {
  const supabase = requireSupabase();
  const { error } = await supabase
    .from("projects")
    .update({ title, updated_at: new Date().toISOString() })
    .eq("local_id", localId);
  if (error) throw new Error(error.message);
}

export async function deleteCloudProject(localId: string) {
  const supabase = requireSupabase();
  const { error } = await supabase.from("projects").delete().eq("local_id", localId);
  if (error) throw new Error(error.message);
}

// 보존 중인 업로드 원본을 서버 경유로 삭제한다 (프로젝트 삭제 시 정리용).
export async function deleteStoredReferences(paths: string[]) {
  if (paths.length === 0) return;
  await fetch("/api/upload-url", {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ paths })
  }).catch(() => {
    // 저장소 정리 실패가 프로젝트 삭제 흐름을 막으면 안 된다.
  });
}

// 업로드 원본을 Supabase Storage로 직접 올려 Vercel 요청 본문 한도(4.5MB)를 우회한다.
// 실패 시 null을 반환해 호출부가 기존 직접 전송 방식으로 폴백할 수 있게 한다.
export async function uploadReferenceFilesToStorage(files: File[]): Promise<string[] | null> {
  const supabase = getSupabase();
  if (!supabase || files.length === 0) return null;

  try {
    const response = await fetch("/api/upload-url", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ files: files.map((file) => ({ name: file.name, type: file.type, size: file.size })) })
    });
    if (!response.ok) return null;

    const data = await response.json();
    const uploads = data?.uploads;
    if (!Array.isArray(uploads) || uploads.length !== files.length) return null;

    for (let index = 0; index < files.length; index += 1) {
      const { path, token } = uploads[index] || {};
      if (!path || !token) return null;
      const { error } = await supabase.storage
        .from("uploads")
        .uploadToSignedUrl(path, token, files[index], { contentType: files[index].type || "image/jpeg" });
      if (error) return null;
    }
    return uploads.map((upload: { path: string }) => upload.path);
  } catch {
    return null;
  }
}
