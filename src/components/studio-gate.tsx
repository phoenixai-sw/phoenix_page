"use client";

import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import { isCloudConfigured, signInWithGoogle, subscribeCloudUser } from "@/lib/cloud-sync";

type GateState = "checking" | "authed" | "anon";

// 학습용 플랫폼 입구 게이트: Google 로그인 전에는 스튜디오에 진입할 수 없다.
// OAuth 콜백(?code=)으로 돌아온 직후에는 세션 교환이 끝날 때까지 확인 화면을 유지한다.
export function StudioGate({ children }: { children: React.ReactNode }) {
  const [state, setState] = React.useState<GateState>("checking");
  const [signingIn, setSigningIn] = React.useState(false);
  const [message, setMessage] = React.useState("");

  React.useEffect(() => {
    const hasOAuthCode = window.location.search.includes("code=");
    // 콜백 교환이 끝내 이벤트를 못 주는 경우를 대비한 안전장치
    const fallback = hasOAuthCode
      ? window.setTimeout(() => setState((current) => (current === "checking" ? "anon" : current)), 8000)
      : 0;
    const unsubscribe = subscribeCloudUser((user) => {
      if (user) {
        setState("authed");
      } else if (!hasOAuthCode) {
        setState("anon");
      }
    });
    return () => {
      if (fallback) window.clearTimeout(fallback);
      unsubscribe();
    };
  }, []);

  async function startSignIn() {
    setSigningIn(true);
    setMessage("");
    try {
      await signInWithGoogle();
    } catch (error) {
      setSigningIn(false);
      setMessage(error instanceof Error ? error.message : "Google 로그인을 시작하지 못했습니다.");
    }
  }

  if (state === "authed") return <>{children}</>;

  return (
    <main className="grid min-h-screen place-items-center bg-[#f6f4ef] px-5 py-10">
      <div className="w-full max-w-md rounded-2xl border border-black/8 bg-white p-8 shadow-[0_24px_60px_rgba(15,23,42,0.08)]">
        <div className="grid justify-items-center gap-3 text-center">
          <span className="grid size-14 place-items-center overflow-hidden rounded-xl border border-black/8 bg-white">
            <Image src="/phoenix-ai-logo.png" alt="Phoenix AI" width={52} height={52} className="object-contain" />
          </span>
          <div>
            <div className="text-lg font-black tracking-tight">phoenix detail page</div>
            <div className="mt-1 inline-flex rounded-full bg-amber-100 px-2.5 py-0.5 text-[11px] font-bold text-amber-800">
              학습용 베타
            </div>
          </div>
          <p className="text-sm leading-relaxed text-neutral-600">
            기존 상세페이지 이미지를 분석해 구매전환 중심으로 리디자인하는 학습용 서비스입니다.
            Google 계정으로 로그인하면 바로 시작할 수 있습니다.
          </p>

          {state === "checking" ? (
            <div className="mt-2 flex min-h-11 items-center justify-center text-sm text-neutral-500">
              로그인 상태를 확인하는 중...
            </div>
          ) : (
            <button
              type="button"
              onClick={startSignIn}
              disabled={signingIn || !isCloudConfigured()}
              className="mt-2 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-md bg-[#1a1a1a] px-5 text-sm font-bold text-white transition hover:bg-black disabled:opacity-60"
            >
              {signingIn ? "Google로 이동 중..." : "Google로 시작하기"}
            </button>
          )}

          {message ? <p className="text-xs text-red-600">{message}</p> : null}
          {!isCloudConfigured() ? (
            <p className="text-xs text-neutral-400">로그인 설정이 완료되지 않은 환경입니다. 관리자에게 문의해 주세요.</p>
          ) : null}

          <ul className="mt-3 w-full space-y-1 rounded-lg bg-neutral-50 p-3 text-left text-xs leading-relaxed text-neutral-500">
            <li>· 학습용 무료 서비스로, 생성에는 본인의 OpenAI API 키가 필요합니다</li>
            <li>· 클라우드 저장은 1인당 최대 15개까지 가능합니다</li>
            <li>· 저장한 작업은 마지막 수정 후 7일이 지나면 자동 삭제됩니다</li>
          </ul>

          <p className="mt-2 text-[11px] leading-relaxed text-neutral-400">
            로그인하면 <Link href="/terms" className="underline underline-offset-2 hover:text-neutral-600">이용약관</Link>과{" "}
            <Link href="/privacy" className="underline underline-offset-2 hover:text-neutral-600">개인정보처리방침</Link>에
            동의하는 것으로 간주됩니다.
          </p>
        </div>
      </div>
    </main>
  );
}
