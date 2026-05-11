"use client";

import { useAuthActions } from "@convex-dev/auth/react";
import { useSearchParams } from "next/navigation";
import { FormEvent, Suspense, useState } from "react";

// ---------------------------------------------------------------------------
// Password strength (shared logic)
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

const STRENGTH_LABEL: Record<Strength, string> = { weak: "Weak", fair: "Fair", strong: "Strong" };
const STRENGTH_COLOR: Record<Strength, string> = {
  weak: "#ef4444",
  fair: "#f59e0b",
  strong: "#1BAAC1",
};
const STRENGTH_BARS: Record<Strength, number> = { weak: 1, fair: 2, strong: 3 };

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

function ResetPasswordForm() {
  const { signIn } = useAuthActions();
  const searchParams = useSearchParams();
  const code = searchParams.get("code") ?? "";

  // Step 1: no code — collect email to send reset link
  // Step 2: code present — collect new password
  const [step, setStep] = useState<"request" | "reset" | "done">(
    code ? "reset" : "request",
  );
  const [email, setEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleRequest(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErrorMsg("");
    setLoading(true);
    try {
      await signIn("password", { email, flow: "reset" });
      setStep("done");
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : "Could not send reset link.");
    } finally {
      setLoading(false);
    }
  }

  async function handleReset(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErrorMsg("");
    if (newPassword !== confirm) {
      setErrorMsg("Passwords do not match.");
      return;
    }
    if (passwordStrength(newPassword) === "weak") {
      setErrorMsg(
        "Password is too weak. Use at least 8 characters including a number or special character.",
      );
      return;
    }
    setLoading(true);
    try {
      await signIn("password", { code, newPassword, flow: "reset-verification" });
      setStep("done");
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : "Could not reset password. The link may have expired.");
    } finally {
      setLoading(false);
    }
  }

  // ── Done ──────────────────────────────────────────────────────────────────
  if (step === "done" && !code) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-[#1BAAC1] font-semibold">Check your email</p>
        <p className="text-sm text-gray-400">
          If an account exists for <span className="text-white">{email}</span>, we sent a
          password reset link. Click it to choose a new password.
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

  if (step === "done" && code) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-[#1BAAC1] font-semibold">Password updated</p>
        <p className="text-sm text-gray-400">Your password has been reset.</p>
        <a
          href="/login"
          className="inline-block bg-[#1BAAC1] text-[#0a2828] font-semibold py-3 px-6
                     text-sm uppercase tracking-wider hover:opacity-90 transition-opacity"
        >
          Sign in
        </a>
      </div>
    );
  }

  // ── Step 1: request reset link ────────────────────────────────────────────
  if (step === "request") {
    return (
      <form onSubmit={handleRequest} className="space-y-4">
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
        <button
          type="submit"
          disabled={loading}
          className="w-full bg-[#1BAAC1] text-[#0a2828] font-semibold py-3 px-4
                     text-sm uppercase tracking-wider transition-opacity
                     hover:opacity-90 disabled:opacity-50"
        >
          {loading ? "Sending…" : "Send reset link"}
        </button>
        <div className="text-center">
          <a
            href="/login"
            className="text-xs text-gray-500 underline underline-offset-2 hover:text-gray-300"
          >
            Back to sign in
          </a>
        </div>
      </form>
    );
  }

  // ── Step 2: enter new password (code present) ─────────────────────────────
  return (
    <form onSubmit={handleReset} className="space-y-4">
      {errorMsg && (
        <p className="text-xs text-red-400 bg-red-400/10 border border-red-400/20 px-3 py-2">
          {errorMsg}
        </p>
      )}
      <div>
        <label
          htmlFor="newPassword"
          className="block text-xs font-mono uppercase tracking-widest text-gray-400 mb-2"
        >
          New password
        </label>
        <input
          id="newPassword"
          type="password"
          autoComplete="new-password"
          required
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          placeholder="••••••••"
          className="w-full bg-[#0a2828] border border-[#1BAAC1]/30 text-white
                     placeholder-gray-600 px-4 py-3 text-sm outline-none
                     focus:border-[#1BAAC1] transition-colors"
        />
        <StrengthIndicator password={newPassword} />
      </div>
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
      <button
        type="submit"
        disabled={loading}
        className="w-full bg-[#1BAAC1] text-[#0a2828] font-semibold py-3 px-4
                   text-sm uppercase tracking-wider transition-opacity
                   hover:opacity-90 disabled:opacity-50"
      >
        {loading ? "Updating…" : "Set new password"}
      </button>
    </form>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function ResetPasswordPage() {
  return (
    <main className="min-h-screen bg-[#021e1e] flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <p className="font-mono text-[#1BAAC1] uppercase tracking-[4px] text-sm mb-8">Tino</p>
        <h1 className="text-2xl font-semibold text-white mb-2">Reset password</h1>
        <p className="text-sm text-gray-400 mb-8">
          Enter your email and we will send you a reset link.
        </p>
        <Suspense fallback={<p className="text-sm text-gray-500">Loading&hellip;</p>}>
          <ResetPasswordForm />
        </Suspense>
      </div>
    </main>
  );
}
