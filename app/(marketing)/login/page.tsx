"use client";

import { useAuthActions } from "@convex-dev/auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, Suspense, useEffect, useState } from "react";

// ---------------------------------------------------------------------------
// Password strength
// ---------------------------------------------------------------------------

type Strength = "weak" | "fair" | "strong";

function passwordStrength(pw: string): Strength {
  if (pw.length < 8) return "weak";
  let score = 0;
  if (/[0-9]/.test(pw)) score++;
  if (/[!@#$%^&*()\-_=+[\]{};':"\\|,.<>?/`~]/.test(pw)) score++;
  if (/[A-Z]/.test(pw)) score++;
  if (/[a-z]/.test(pw)) score++;
  if (pw.length >= 12) score++;
  if (score <= 2) return "weak";
  if (score <= 3) return "fair";
  return "strong";
}

const STRENGTH_LABEL: Record<Strength, string> = {
  weak: "Weak",
  fair: "Fair",
  strong: "Strong",
};

const STRENGTH_COLOR: Record<Strength, string> = {
  weak: "#ef4444",
  fair: "#f59e0b",
  strong: "#1BAAC1",
};

const STRENGTH_BARS: Record<Strength, number> = {
  weak: 1,
  fair: 2,
  strong: 3,
};

function StrengthIndicator({ password }: { password: string }) {
  if (!password) return null;
  const s = passwordStrength(password);
  const filled = STRENGTH_BARS[s];
  return (
    <div className="mt-2 space-y-1">
      <div className="flex gap-1">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="h-1 flex-1 transition-colors"
            style={{ background: i <= filled ? STRENGTH_COLOR[s] : "#1a3a3a" }}
          />
        ))}
      </div>
      <p className="text-xs font-mono" style={{ color: STRENGTH_COLOR[s] }}>
        {STRENGTH_LABEL[s]}
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Inner component (reads search params — must be inside Suspense)
// ---------------------------------------------------------------------------

type Mode = "signin" | "create";
type State = "idle" | "sent" | "verifying" | "error";

function LoginForm() {
  const { signIn } = useAuthActions();
  const router = useRouter();
  const searchParams = useSearchParams();

  const code = searchParams.get("code");
  const [state, setState] = useState<State>(code ? "verifying" : "idle");
  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [loading, setLoading] = useState(false);

  // Auto-verify magic link code from URL
  useEffect(() => {
    if (!code) return;
    signIn("email", { code })
      .then(() => router.replace("/jobs"))
      .catch((err: unknown) => {
        setErrorMsg(err instanceof Error ? err.message : "Verification failed.");
        setState("error");
      });
  }, [code, signIn, router]);

  function switchMode(next: Mode) {
    setMode(next);
    setPassword("");
    setConfirm("");
    setErrorMsg("");
    setState("idle");
  }

  async function handlePasswordSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErrorMsg("");

    if (mode === "create") {
      if (password !== confirm) {
        setErrorMsg("Passwords do not match.");
        return;
      }
      const s = passwordStrength(password);
      if (s === "weak") {
        setErrorMsg(
          "Password is too weak. Use at least 8 characters including a number or special character.",
        );
        return;
      }
    }

    setLoading(true);
    try {
      if (mode === "create") {
        await signIn("password", { email, password, flow: "signUp" });
        // After sign-up convex-auth sends a verification email; show the sent state
        setState("sent");
      } else {
        await signIn("password", { email, password, flow: "signIn" });
        router.replace("/jobs");
      }
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : "Authentication failed.");
      setState("idle");
    } finally {
      setLoading(false);
    }
  }

  async function handleMagicLink(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setState("sent");
    try {
      await signIn("email", { email });
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : "Could not send sign-in link.");
      setState("error");
    }
  }

  async function handleGoogleSignIn() {
    try {
      await signIn("google");
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : "Google sign-in failed.");
      setState("error");
    }
  }

  // ── Verifying (magic link auto-verify) ───────────────────────────────────
  if (state === "verifying") {
    return <p className="text-sm text-[#1BAAC1]">Signing you in&hellip;</p>;
  }

  // ── Sent (magic link sent or email verification sent) ─────────────────────
  if (state === "sent") {
    return (
      <div className="space-y-4">
        <p className="text-sm text-[#1BAAC1] font-semibold">Check your email</p>
        <p className="text-sm text-gray-400">
          We sent{" "}
          {mode === "create" ? "a verification link" : "a sign-in link"} to{" "}
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
          onClick={() => { setState("idle"); setErrorMsg(""); }}
          className="text-xs text-gray-500 underline underline-offset-2 hover:text-gray-300"
        >
          Try again
        </button>
      </div>
    );
  }

  // ── Idle — main form ──────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      {/* Mode toggle */}
      <div className="flex border border-[#1BAAC1]/20">
        <button
          type="button"
          onClick={() => switchMode("signin")}
          className={`flex-1 py-2 text-xs font-mono uppercase tracking-widest transition-colors ${
            mode === "signin"
              ? "bg-[#1BAAC1] text-[#0a2828] font-bold"
              : "text-gray-400 hover:text-white"
          }`}
        >
          Sign in
        </button>
        <button
          type="button"
          onClick={() => switchMode("create")}
          className={`flex-1 py-2 text-xs font-mono uppercase tracking-widest transition-colors ${
            mode === "create"
              ? "bg-[#1BAAC1] text-[#0a2828] font-bold"
              : "text-gray-400 hover:text-white"
          }`}
        >
          Create account
        </button>
      </div>

      {/* Google OAuth */}
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
        <span className="text-xs font-mono text-gray-500 uppercase tracking-widest">or</span>
        <div className="flex-1 h-px bg-white/10" />
      </div>

      {/* Password form */}
      <form onSubmit={handlePasswordSubmit} className="space-y-4">
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
            autoComplete={mode === "create" ? "new-password" : "current-password"}
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            className="w-full bg-[#0a2828] border border-[#1BAAC1]/30 text-white
                       placeholder-gray-600 px-4 py-3 text-sm outline-none
                       focus:border-[#1BAAC1] transition-colors"
          />
          {mode === "create" && <StrengthIndicator password={password} />}
        </div>

        {mode === "create" && (
          <div>
            <label
              htmlFor="confirm"
              className="block text-xs font-mono uppercase tracking-widest text-gray-400 mb-2"
            >
              Confirm password
            </label>
            <input
              id="confirm"
              type="password"
              autoComplete="new-password"
              required
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder="••••••••"
              className="w-full bg-[#0a2828] border border-[#1BAAC1]/30 text-white
                         placeholder-gray-600 px-4 py-3 text-sm outline-none
                         focus:border-[#1BAAC1] transition-colors"
            />
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-[#1BAAC1] text-[#0a2828] font-semibold py-3 px-4
                     text-sm uppercase tracking-wider transition-opacity
                     hover:opacity-90 disabled:opacity-50"
        >
          {loading
            ? mode === "create"
              ? "Creating account…"
              : "Signing in…"
            : mode === "create"
              ? "Create account"
              : "Sign in"}
        </button>

        {mode === "signin" && (
          <div className="text-center">
            <a
              href="/reset-password"
              className="text-xs text-gray-500 hover:text-gray-300 underline underline-offset-2"
            >
              Forgot your password?
            </a>
          </div>
        )}
      </form>

      {/* Magic link fallback */}
      <div className="border-t border-white/10 pt-4">
        <p className="text-xs text-gray-500 mb-3 text-center">
          Prefer a passwordless sign-in link?
        </p>
        <form onSubmit={handleMagicLink}>
          <button
            type="submit"
            className="w-full border border-[#1BAAC1]/30 text-[#1BAAC1] py-2 px-4
                       text-xs font-mono uppercase tracking-widest
                       hover:border-[#1BAAC1]/60 transition-colors"
          >
            Send magic link
          </button>
        </form>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Google "G" icon
// ---------------------------------------------------------------------------

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true" focusable="false">
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
        <p className="font-mono text-[#1BAAC1] uppercase tracking-[4px] text-sm mb-8">Tino</p>
        <h1 className="text-2xl font-semibold text-white mb-2">Welcome</h1>
        <p className="text-sm text-gray-400 mb-8">
          Find jobs with verified visa sponsorship.
        </p>
        <Suspense fallback={<p className="text-sm text-gray-500">Loading&hellip;</p>}>
          <LoginForm />
        </Suspense>
      </div>
    </main>
  );
}
