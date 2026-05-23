"use client";

import { useAuthActions } from "@convex-dev/auth/react";
import { useQuery } from "convex/react";
import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, Suspense, useEffect, useState } from "react";
import { api } from "@/convex/_generated/api";

// ---------------------------------------------------------------------------
// Inner component (reads search params — must be inside Suspense)
// ---------------------------------------------------------------------------

function VerifyEmailForm() {
  const { signIn } = useAuthActions();
  const router = useRouter();
  const searchParams = useSearchParams();
  const code = searchParams.get("code") ?? "";

  // If the user already has a valid session (e.g. they re-clicked the link,
  // or the middleware token check lagged behind hydration), skip to /jobs.
  const user = useQuery(api.users.getCurrentUser);
  useEffect(() => {
    if (user) {
      router.replace("/jobs");
    }
  }, [user, router]);

  type State = "verifying" | "check-email" | "resending" | "resent" | "error";
  const [state, setState] = useState<State>(code ? "verifying" : "check-email");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  // Auto-verify when a code is present in the URL
  useEffect(() => {
    if (!code) return;
    signIn("password", { flow: "email-verification", code })
      .then(() => router.replace("/onboarding"))
      .catch((err: unknown) => {
        setErrorMsg(
          err instanceof Error
            ? err.message
            : "Verification failed. The link may have expired.",
        );
        setState("error");
      });
  }, [code, signIn, router]);

  async function handleResend(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErrorMsg("");
    setState("resending");
    try {
      // Resend verification email — requires email + password for security
      await signIn("password", { email, password, flow: "email-verification" });
      setState("resent");
    } catch (err: unknown) {
      setErrorMsg(
        err instanceof Error ? err.message : "Could not resend verification email.",
      );
      setState("check-email");
    }
  }

  // ── Verifying ─────────────────────────────────────────────────────────────
  if (state === "verifying") {
    return (
      <div className="space-y-2">
        <p className="text-sm text-[#1BAAC1]">Verifying your email&hellip;</p>
        <p className="text-xs text-gray-500">You will be redirected automatically.</p>
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
          The verification link may have expired. Request a new one below.
        </p>
        <button
          type="button"
          onClick={() => { setState("check-email"); setErrorMsg(""); }}
          className="text-xs text-[#1BAAC1] underline underline-offset-2 hover:opacity-80"
        >
          Resend verification email
        </button>
      </div>
    );
  }

  // ── Resent ────────────────────────────────────────────────────────────────
  if (state === "resent") {
    return (
      <div className="space-y-4">
        <p className="text-sm text-[#1BAAC1] font-semibold">Verification email sent</p>
        <p className="text-sm text-gray-400">
          Check your inbox for a new verification link.
        </p>
        <a
          href="/login"
          className="block text-xs text-gray-500 underline underline-offset-2 hover:text-gray-300"
        >
          Back to sign in
        </a>
      </div>
    );
  }

  // ── Check email (no code in URL) / resending ───────────────────────────────
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <p className="text-sm text-[#1BAAC1] font-semibold">Check your email</p>
        <p className="text-sm text-gray-400">
          We sent a verification link when you created your account. Click it to activate
          your account and get started.
        </p>
      </div>

      <div className="border-t border-white/10 pt-6">
        <p className="text-xs text-gray-500 mb-4">Did not receive it? Resend below.</p>
        <form onSubmit={handleResend} className="space-y-4">
          {errorMsg && (
            <p className="text-xs text-red-400 bg-red-400/10 border border-red-400/20 px-3 py-2">
              {errorMsg}
            </p>
          )}
          <div>
            <label
              htmlFor="email"
              className="block text-xs font-mono uppercase tracking-widest text-gray-400 mb-2"
            >
              Email address
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="w-full bg-[#0a2828] border border-[#1BAAC1]/30 text-white
                         placeholder-gray-600 px-4 py-3 text-sm outline-none
                         focus:border-[#1BAAC1] transition-colors"
            />
          </div>
          <div>
            <label
              htmlFor="password"
              className="block text-xs font-mono uppercase tracking-widest text-gray-400 mb-2"
            >
              Password
            </label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full bg-[#0a2828] border border-[#1BAAC1]/30 text-white
                         placeholder-gray-600 px-4 py-3 text-sm outline-none
                         focus:border-[#1BAAC1] transition-colors"
            />
          </div>
          <button
            type="submit"
            disabled={state === "resending"}
            className="w-full bg-[#1BAAC1] text-[#0a2828] font-semibold py-3 px-4
                       text-sm uppercase tracking-wider transition-opacity
                       hover:opacity-90 disabled:opacity-50"
          >
            {state === "resending" ? "Sending…" : "Resend verification email"}
          </button>
        </form>
      </div>

      <div className="text-center">
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
        <h1 className="text-2xl font-semibold text-white mb-2">Verify your email</h1>
        <p className="text-sm text-gray-400 mb-8">
          One last step before you can start finding jobs.
        </p>
        <Suspense fallback={<p className="text-sm text-gray-500">Loading&hellip;</p>}>
          <VerifyEmailForm />
        </Suspense>
      </div>
    </main>
  );
}
