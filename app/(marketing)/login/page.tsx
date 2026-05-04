"use client";

/**
 * Login page — email magic link flow
 *
 * States:
 *   idle      → email form
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
      .then(() => router.replace("/feed"))
      .catch((err: unknown) => {
        setErrorMsg(
          err instanceof Error ? err.message : "Verification failed.",
        );
        setState("error");
      });
  }, [code, signIn, router]);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
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

  // ── Verifying ─────────────────────────────────────────────────────────────
  if (state === "verifying") {
    return (
      <p className="text-sm text-[#1BAAC1]">Signing you in&hellip;</p>
    );
  }

  // ── Sent ──────────────────────────────────────────────────────────────────
  if (state === "sent") {
    return (
      <div className="space-y-4">
        <p className="text-sm text-[#1BAAC1] font-semibold">Check your email</p>
        <p className="text-sm text-gray-400">
          We sent a sign-in link to <span className="text-white">{email}</span>.
          Click it to continue.
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
          onClick={() => { setState("idle"); setErrorMsg(""); }}
          className="text-xs text-gray-500 underline underline-offset-2 hover:text-gray-300"
        >
          Try again
        </button>
      </div>
    );
  }

  // ── Idle — email form ──────────────────────────────────────────────────────
  return (
    <form onSubmit={handleSubmit} className="space-y-4">
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

        <h1 className="text-2xl font-semibold text-white mb-2">
          Sign in
        </h1>
        <p className="text-sm text-gray-400 mb-8">
          Enter your email to receive a sign-in link. No password needed.
        </p>

        <Suspense
          fallback={
            <p className="text-sm text-gray-500">Loading&hellip;</p>
          }
        >
          <LoginForm />
        </Suspense>
      </div>
    </main>
  );
}
