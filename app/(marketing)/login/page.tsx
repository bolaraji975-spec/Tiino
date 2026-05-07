"use client";

/**
 * Login page — email magic link + Google OAuth
 *
 * States:
 *   idle      → email form + Google button
 *   sent      → "check your email" message
 *   verifying → auto-verifying code from URL ?code=<token>
 *   error     → error message with retry option
 */

import { useAuthActions } from "@convex-dev/auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, Suspense, useEffect, useState } from "react";

// ---------------------------------------------------------------------------
// Inner component (reads search params — must be inside Suspense)
// ---------------------------------------------------------------------------

function LoginForm() {
  const { signIn } = useAuthActions();
  const router = useRouter();
  const searchParams = useSearchParams();

  type State = "idle" | "sent" | "verifying" | "error";
  const code = searchParams.get("code");
  // If the URL already has a code (magic link click), start in verifying state.
  const [state, setState] = useState<State>(code ? "verifying" : "idle");
  const [email, setEmail] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  // Auto-verify when a ?code= is present in the URL (magic link click).
  // No synchronous setState here — state is initialised above.
  useEffect(() => {
    if (!code) return;
    signIn("email", { code })
      .then(() => router.replace("/jobs"))
      .catch((err: unknown) => {
        setErrorMsg(
          err instanceof Error ? err.message : "Verification failed.",
        );
        setState("error");
      });
  }, [code, signIn, router]);

  async function handleEmailSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setState("sent");
    try {
      await signIn("email", { email });
    } catch (err: unknown) {
      setErrorMsg(
        err instanceof Error ? err.message : "Could not send magic link.",
      );
      setState("error");
    }
  }

  async function handleGoogleSignIn() {
    try {
      await signIn("google");
    } catch (err: unknown) {
      setErrorMsg(
        err instanceof Error ? err.message : "Google sign-in failed.",
      );
      setState("error");
    }
  }

  // ── Verifying ─────────────────────────────────────────────────────────────
  if (state === "verifying") {
    return <p className="text-sm text-[#1BAAC1]">Signing you in&hellip;</p>;
  }

  // ── Sent ──────────────────────────────────────────────────────────────────
  if (state === "sent") {
    return (
      <div className="space-y-4">
        <p className="text-sm text-[#1BAAC1] font-semibold">Check your email</p>
        <p className="text-sm text-gray-400">
          We sent a sign-in link to{" "}
          <span className="text-white">{email}</span>. Click it to continue.
        </p>
        <button
          type="button"
          onClick={() => setState("idle")}
          className="text-xs text-gray-500 underline underline-offset-2 hover:text-gray-300"
        >
          Use a different email
        </button>
      </div>
    );
  }

  // ── Error ─────────────────────────────────────────────────────────────────
  if (state === "error") {
    return (
      <div className="space-y-4">
        <p className="text-sm text-red-400">{errorMsg}</p>
        <button
          type="button"
          onClick={() => {
            setState("idle");
            setErrorMsg("");
          }}
          className="text-xs text-gray-500 underline underline-offset-2 hover:text-gray-300"
        >
          Try again
        </button>
      </div>
    );
  }

  // ── Idle — email form + Google ─────────────────────────────────────────────
  return (
    <div className="space-y-6">
      {/* Google OAuth button */}
      <button
        type="button"
        onClick={handleGoogleSignIn}
        className="w-full flex items-center justify-center gap-3 border border-[#1BAAC1]/30
                   bg-transparent text-white py-3 px-4 text-sm font-medium
                   hover:border-[#1BAAC1]/60 transition-colors"
      >
        <GoogleIcon />
        Continue with Google
      </button>

      {/* Divider */}
      <div className="flex items-center gap-3">
        <div className="flex-1 h-px bg-white/10" />
        <span className="text-xs font-mono text-gray-500 uppercase tracking-widest">
          or
        </span>
        <div className="flex-1 h-px bg-white/10" />
      </div>

      {/* Email magic link form */}
      <form onSubmit={handleEmailSubmit} className="space-y-4">
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
        <button
          type="submit"
          className="w-full bg-[#1BAAC1] text-[#0a2828] font-semibold py-3 px-4
                     text-sm uppercase tracking-wider transition-opacity hover:opacity-90"
        >
          Send sign-in link
        </button>
      </form>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Google "G" icon (inline SVG — no external dependency)
// ---------------------------------------------------------------------------

function GoogleIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 18 18"
      aria-hidden="true"
      focusable="false"
    >
      <path
        d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615Z"
        fill="#4285F4"
      />
      <path
        d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18Z"
        fill="#34A853"
      />
      <path
        d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332Z"
        fill="#FBBC05"
      />
      <path
        d="M9 3.58c1.321 0 2.508.454 3.440 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 6.29C4.672 4.163 6.656 3.58 9 3.58Z"
        fill="#EA4335"
      />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function LoginPage() {
  return (
    <main className="min-h-screen bg-[#021e1e] flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        {/* Wordmark */}
        <p className="font-mono text-[#1BAAC1] uppercase tracking-[4px] text-sm mb-8">
          Tino
        </p>

        <h1 className="text-2xl font-semibold text-white mb-2">Sign in</h1>
        <p className="text-sm text-gray-400 mb-8">
          Sign in to find jobs with verified visa sponsorship.
        </p>

        <Suspense fallback={<p className="text-sm text-gray-500">Loading&hellip;</p>}>
          <LoginForm />
        </Suspense>
      </div>
    </main>
  );
}
