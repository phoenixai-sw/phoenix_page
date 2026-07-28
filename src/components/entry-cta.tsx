"use client";

import * as React from "react";
import Link from "next/link";
import { signInWithGoogle, subscribeCloudUser } from "@/lib/cloud-sync";

// 랜딩 입장 버튼: 로그인 상태면 스튜디오로, 아니면 Google 로그인부터 시작한다.
export function EntryCta() {
  const [authed, setAuthed] = React.useState<boolean | null>(null);
  const [signingIn, setSigningIn] = React.useState(false);
  const [message, setMessage] = React.useState("");

  React.useEffect(() => subscribeCloudUser((user) => setAuthed(Boolean(user))), []);

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

  const buttonClass =
    "inline-flex min-h-11 items-center justify-center rounded-md bg-[#ff6f61] px-5 text-xs font-black text-white shadow-[0_18px_45px_rgba(255,111,97,0.34)] transition hover:bg-[#ff806f] disabled:opacity-60";

  if (authed) {
    return (
      <Link href="/studio" className={buttonClass}>
        phoenix detail page 입장
      </Link>
    );
  }

  return (
    <div className="grid justify-items-center gap-2">
      <button type="button" onClick={startSignIn} disabled={signingIn || authed === null} className={buttonClass}>
        {authed === null ? "확인 중..." : signingIn ? "Google로 이동 중..." : "Google로 시작하기"}
      </button>
      <p className="text-[11px] text-white/60">구글 계정으로 로그인 후 이용할 수 있는 학습용 베타 서비스입니다</p>
      {message ? <p className="text-[11px] text-red-300">{message}</p> : null}
    </div>
  );
}
