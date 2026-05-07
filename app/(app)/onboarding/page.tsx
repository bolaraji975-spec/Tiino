"use client";

/**
 * Onboarding page — collects visa status, location, salary range, right-to-work.
 *
 * Guards:
 *   - Not signed in          → redirect to /login
 *   - Profile already filled → redirect to /feed  (returning user bypass)
 *
 * On submit → calls updateProfile mutation → redirect to /feed.
 */

import { useQuery, useMutation } from "convex/react";
import { useRouter } from "next/navigation";
import { api } from "@/convex/_generated/api";
import { FormEvent, useEffect, useState } from "react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type VisaStatus = "graduate" | "skilled_worker" | "student" | "other";

const VISA_OPTIONS: { value: VisaStatus; label: string }[] = [
  { value: "skilled_worker", label: "Skilled Worker visa" },
  { value: "graduate",       label: "Graduate visa" },
  { value: "student",        label: "Student visa" },
  { value: "other",          label: "Other / Not sure" },
];

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function OnboardingPage() {
  const router = useRouter();
  const user = useQuery(api.users.getCurrentUser);
  const updateProfile = useMutation(api.users.updateProfile);

  // Form state
  const [visaStatus, setVisaStatus] = useState<VisaStatus>("skilled_worker");
  const [location, setLocation] = useState("");
  const [salaryMin, setSalaryMin] = useState("");
  const [salaryMax, setSalaryMax] = useState("");
  const [rightToWork, setRightToWork] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  // ── Guards ─────────────────────────────────────────────────────────────────
  // user === undefined  → still loading (Convex query in flight)
  // user === null       → not authenticated
  // user with visaStatus → onboarding already done
  useEffect(() => {
    if (user === undefined) return; // loading
    if (user === null) {
      router.replace("/login");
      return;
    }
    if (user.visaStatus !== undefined) {
      router.replace("/jobs");
    }
  }, [user, router]);

  // ── Submit ─────────────────────────────────────────────────────────────────
  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");

    // Client-side salary validation (server mirrors this)
    const min = salaryMin ? Number(salaryMin) : undefined;
    const max = salaryMax ? Number(salaryMax) : undefined;
    if (min !== undefined && max !== undefined && min > max) {
      setError("Minimum salary cannot exceed maximum salary.");
      return;
    }

    setSubmitting(true);
    try {
      await updateProfile({
        visaStatus,
        location,
        salaryMin: min,
        salaryMax: max,
        rightToWork,
      });
      router.replace("/jobs");
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : "Something went wrong. Please try again.",
      );
      setSubmitting(false);
    }
  }

  // ── Loading / redirecting ──────────────────────────────────────────────────
  if (user === undefined || user === null || user.visaStatus !== undefined) {
    return (
      <main className="min-h-screen bg-[#021e1e] flex items-center justify-center">
        <p className="text-sm text-[#1BAAC1] font-mono">Loading&hellip;</p>
      </main>
    );
  }

  // ── Form ──────────────────────────────────────────────────────────────────
  return (
    <main className="min-h-screen bg-[#021e1e] flex items-center justify-center px-4 py-16">
      <div className="w-full max-w-md">
        {/* Header */}
        <p className="font-mono text-[#1BAAC1] uppercase tracking-[4px] text-sm mb-8">
          Tino
        </p>
        <h1 className="text-2xl font-semibold text-white mb-1">
          Tell us about yourself
        </h1>
        <p className="text-sm text-gray-400 mb-8">
          We use this to personalise your job feed and sponsorship scores.
        </p>

        <form onSubmit={handleSubmit} className="space-y-6" noValidate>
          {/* Visa status */}
          <fieldset>
            <legend className="block text-xs font-mono uppercase tracking-widest text-gray-400 mb-3">
              Current visa status
            </legend>
            <div className="grid grid-cols-2 gap-2">
              {VISA_OPTIONS.map((opt) => (
                <label
                  key={opt.value}
                  className={`flex items-center gap-3 border px-4 py-3 cursor-pointer transition-colors text-sm
                    ${visaStatus === opt.value
                      ? "border-[#1BAAC1] bg-[#1BAAC1]/10 text-white"
                      : "border-white/10 text-gray-400 hover:border-white/30"
                    }`}
                >
                  <input
                    type="radio"
                    name="visaStatus"
                    value={opt.value}
                    checked={visaStatus === opt.value}
                    onChange={() => setVisaStatus(opt.value)}
                    className="sr-only"
                  />
                  <span
                    className={`w-3 h-3 rounded-full border-2 flex-shrink-0
                      ${visaStatus === opt.value
                        ? "border-[#1BAAC1] bg-[#1BAAC1]"
                        : "border-white/30"
                      }`}
                  />
                  {opt.label}
                </label>
              ))}
            </div>
          </fieldset>

          {/* Location */}
          <div>
            <label
              htmlFor="location"
              className="block text-xs font-mono uppercase tracking-widest text-gray-400 mb-2"
            >
              Location <span className="text-[#1BAAC1]">*</span>
            </label>
            <input
              id="location"
              type="text"
              required
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="e.g. London, Manchester, Remote"
              className="w-full bg-[#0a2828] border border-[#1BAAC1]/30 text-white
                         placeholder-gray-600 px-4 py-3 text-sm outline-none
                         focus:border-[#1BAAC1] transition-colors"
            />
          </div>

          {/* Salary range */}
          <div>
            <p className="block text-xs font-mono uppercase tracking-widest text-gray-400 mb-2">
              Salary range (optional)
            </p>
            <div className="flex gap-3 items-center">
              <div className="relative flex-1">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm font-mono">
                  £
                </span>
                <input
                  type="number"
                  min={0}
                  step={1000}
                  value={salaryMin}
                  onChange={(e) => setSalaryMin(e.target.value)}
                  placeholder="Min"
                  className="w-full bg-[#0a2828] border border-[#1BAAC1]/30 text-white
                             placeholder-gray-600 pl-7 pr-3 py-3 text-sm font-mono outline-none
                             focus:border-[#1BAAC1] transition-colors"
                />
              </div>
              <span className="text-gray-600 text-sm">to</span>
              <div className="relative flex-1">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm font-mono">
                  £
                </span>
                <input
                  type="number"
                  min={0}
                  step={1000}
                  value={salaryMax}
                  onChange={(e) => setSalaryMax(e.target.value)}
                  placeholder="Max"
                  className="w-full bg-[#0a2828] border border-[#1BAAC1]/30 text-white
                             placeholder-gray-600 pl-7 pr-3 py-3 text-sm font-mono outline-none
                             focus:border-[#1BAAC1] transition-colors"
                />
              </div>
            </div>
          </div>

          {/* Right to work */}
          <label className="flex items-center gap-3 cursor-pointer select-none">
            <div
              role="checkbox"
              aria-checked={rightToWork}
              tabIndex={0}
              onClick={() => setRightToWork((v) => !v)}
              onKeyDown={(e) => {
                if (e.key === " " || e.key === "Enter") setRightToWork((v) => !v);
              }}
              className={`w-5 h-5 border-2 flex items-center justify-center flex-shrink-0
                transition-colors
                ${rightToWork
                  ? "border-[#1BAAC1] bg-[#1BAAC1]"
                  : "border-white/30 bg-transparent"
                }`}
            >
              {rightToWork && (
                <svg width="10" height="8" viewBox="0 0 10 8" fill="none" aria-hidden="true">
                  <path d="M1 4l3 3 5-6" stroke="#0a2828" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              )}
            </div>
            <span className="text-sm text-gray-300">
              I already have the right to work in the UK
            </span>
          </label>

          {/* Error */}
          {error && (
            <p className="text-sm text-red-400">{error}</p>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={submitting || location.trim() === ""}
            className="w-full bg-[#1BAAC1] text-[#0a2828] font-semibold py-3 px-4
                       text-sm uppercase tracking-wider transition-opacity
                       hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {submitting ? "Saving\u2026" : "Continue"}
          </button>
        </form>
      </div>
    </main>
  );
}
