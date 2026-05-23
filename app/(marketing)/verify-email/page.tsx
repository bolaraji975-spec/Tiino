"use client";

/**
 * /verify-email
 *
 * This page handles two scenarios:
 *  1. User clicked a verification link from email (?code=...) — auto-verifies
 *     and redirects to /jobs.
 *  2. User navigated here directly or is already signed in — shows a
 *     "Go to jobs" link so they can get back into the app immediately.
 *
 * Email verification is NOT required for app access (MVP decision).
 * Verifying email is useful only for future password-reset flows.
 */

import { useAuthActions } from "@convex-dev/auth/react";
import { useQuery } from "convex/react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { api } from "@/convex/_generated/api";

// ---------------------------------------------------------------------------
// Inner component (reads search params — must be inside Suspense)
// ---------------------------------------------------------------------------

function VerifyEmailInner() {
  const { signIn } = useAuthActions();
  const router = useRouter();
  const searchParams = useSearchParams();
  const code = searchParams.get("code") ?? "";

  // If the user already has a live session, redirect immediately.
  const user = useQuery(api.users.getCurrentUser);
  useEffect(() => {
    // Only redirect if there is no code to process. If there is a code, let
    // the verification effect handle the redirect so the email gets confirmed.
    if (user && !code) {
      router.replace("/jobs");
    }
  }, [user, code, router]);

  type State = "verifying" | "success" | "error" | "idle";
  const [state, setState] = useState<State>(code ? "verifying" : "idle");
  const [errorMsg, setErrorMsg] = useState("");

  // Auto-verify when a code is present in the URL
  useEffect(() => {
    if (!code) return;
    signIn("password", { flow: "email-verification", code })
      .then(() => {
        setState("success");
        // Small delay so the user sees the success state, then redirect
        setTimeout(() => router.replace("/jobs"), 1500);
      })
      .catch((err: unknown) => {
        setErrorMsg(
          err instanceof Error
            ? err.message
            : "Verification failed. The link may have expired.",
        );
        setState("error");
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code]);

  // ── Verifying ─────────────────────────────────────────────────────────────
  if (state === "verifying") {
    return (
      <div className="space-y-2">
        <p className="text-sm text-[#1BAAC1]">Verifying your email&hellip;</p>
        <p className="text-xs text-gray-500">You will be redirected automatically.</p>
      </div>
    );
  }

  // ── Success ───────────────────────────────────────────────────────────────
  if (state === "success") {
    return (
      <div className="space-y-4">
        <p className="text-sm text-[#1BAAC1] font-semibold">Email verified</p>
        <p className="text-sm text-gray-400">Redirecting you to the app&hellip;</p>
      </div>
    );
  }

  // ── Error ─────────────────────────────────────────────────────────────────
  if (state === "error") {
    return (
      <div className="space-y-4">
        <p className="text-xs text-red-400 bg-red-400/10 border border-red-400/20 px-3 py-2">
          {errorMsg}
        </p>
        <p className="text-sm text-gray-400">
          The verification link may have expired, but you can still access the app.
        </p>
        <Link
          href="/jobs"
          className="inline-block bg-[#1BAAC1] text-[#0a2828] font-semibold py-3 px-6
                     text-sm uppercase tracking-wider hover:opacity-90 transition-opacity"
        >
          Go to jobs &rarr;
        </Link>
      </div>
    );
  }

  // ── Idle — no code, user navigated here directly ──────────────────────────
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <p className="text-sm text-gray-400">
          You do not need to verify your email to use Tino.
          If you received a verification link, click it directly from your email client.
        </p>
      </div>
      <Link
        href="/jobs"
        className="inline-block bg-[#1BAAC1] text-[#0a2828] font-semibold py-3 px-6
                   text-sm uppercase tracking-wider hover:opacity-90 transition-opacity"
      >
        Go to jobs &rarr;
      </Link>
      <div className="pt-2">
        <a
          href="/login"
          className="text-xs text-gray-500 underline underline-offset-2 hover:text-gray-300"
        >
          Back to sign in
        </a>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function VerifyEmailPage() {
  return (
    <main className="min-h-screen bg-[#021e1e] flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <p className="font-mono text-[#1BAAC1] uppercase tracking-[4px] text-sm mb-8">Tino</p>
        <h1 className="text-2xl font-semibold text-white mb-2">Email verification</h1>
        <p className="text-sm text-gray-400 mb-8">
          Verifying your email is optional &mdash; you can use the full app without it.
        </p>
        <Suspense fallback={<p className="text-sm text-gray-500">Loading&hellip;</p>}>
          <VerifyEmailInner />
        </Suspense>
      </div>
    </main>
  );
}
