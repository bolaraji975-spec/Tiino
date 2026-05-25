"use client";

/**
 * Jobs feed — /jobs
 *
 * Split-screen layout:
 *   Left  (380px): scrollable job list + collapsible filters
 *   Right (flex 1): job detail panel — updates on card click, no page nav
 *
 * Mobile (< 768px):
 *   No ?id  → full-screen list
 *   ?id set → full-screen detail with back button
 *
 * Linear workflow enforced by CTAs:
 *   No role variations → full-screen prompt to set up roles
 *   No CV uploaded     → sticky banner: Upload now
 *   Job selected       → Generate tailored CV (primary) + Apply now (secondary)
 *   CV generated       → Download CV + Download cover letter + Apply now
 *   Apply clicked      → Modal + auto-log to history
 */

import {
  useState,
  useEffect,
  useRef,
  useCallback,
  Suspense,
} from "react";
import { useQuery, useMutation, useAction } from "convex/react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { CompanyLogo } from "@/components/CompanyLogo";
import { ScoreBand } from "@/components/ScoreBand";
import type { Band } from "@/components/ScoreBand";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatSalary(min?: number | null, max?: number | null): string | null {
  if (!min && !max) return null;
  const fmt = (n: number) =>
    n >= 1000 ? `£${Math.round(n / 1000)}k` : `£${n}`;
  if (min && max) return `${fmt(min)} – ${fmt(max)}`;
  if (min) return `${fmt(min)}+`;
  if (max) return `Up to ${fmt(max)}`;
  return null;
}

function relativeTime(ms: number): string {
  const diff = Date.now() - ms;
  const h = Math.floor(diff / 3_600_000);
  if (h < 1) return "just now";
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d === 1) return "1d ago";
  if (d < 7) return `${d}d ago`;
  const w = Math.floor(d / 7);
  return w === 1 ? "1w ago" : `${w}w ago`;
}


// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type BandParam = "high" | "medium" | "low" | "very_low";
type PostedParam = "24h" | "7d" | "30d";

interface JobDoc {
  _id: string;
  title: string;
  company: string;
  location: string;
  postedAt: number;
  sponsorshipBand: Band;
  sponsorshipScore: number;
  isAgency: boolean;
  salaryMin?: number;
  salaryMax?: number;
  explicit?: boolean;
  sponsorId?: string;
  sourceIds: { source: string; externalId: string; applyUrl: string }[];
}

// ---------------------------------------------------------------------------
// CV generation state machine (shared across idle/generating/success panels)
// ---------------------------------------------------------------------------

const PROGRESS_STEPS = [
  "Reading job description…",
  "Matching your experience…",
  "Writing tailored bullets…",
  "Checking for accuracy…",
] as const;

type CvGenState =
  | { status: "idle" }
  | { status: "no_cv" }
  | { status: "generating"; step: number }
  | { status: "success"; applicationId: string; fromCache: boolean }
  | { status: "error"; message: string }
  | { status: "rate_limited_free" }
  | { status: "rate_limited_pro" };

// ---------------------------------------------------------------------------
// Score signal ticks
// ---------------------------------------------------------------------------

interface SignalTickProps {
  label: string;
  active: boolean;
}

function SignalTick({ label, active }: SignalTickProps) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        padding: "7px 0",
      }}
    >
      <div
        style={{
          width: 18,
          height: 18,
          borderRadius: "50%",
          flexShrink: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: active
            ? "rgba(74,222,128,0.15)"
            : "rgba(255,255,255,0.05)",
          border: `1px solid ${active ? "rgba(74,222,128,0.28)" : "rgba(255,255,255,0.10)"}`,
        }}
      >
        {active ? (
          <svg
            width="9"
            height="9"
            viewBox="0 0 9 9"
            fill="none"
            aria-hidden="true"
          >
            <path
              d="M1.5 4.5l2 2 4-4"
              stroke="#4ade80"
              strokeWidth="1.4"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        ) : (
          <svg
            width="9"
            height="9"
            viewBox="0 0 9 9"
            fill="none"
            aria-hidden="true"
          >
            <line
              x1="2.5"
              y1="4.5"
              x2="6.5"
              y2="4.5"
              stroke="rgba(255,255,255,0.25)"
              strokeWidth="1.2"
              strokeLinecap="round"
            />
          </svg>
        )}
      </div>
      <span
        style={{
          fontSize: 12,
          color: active ? "rgba(255,255,255,0.78)" : "rgba(255,255,255,0.35)",
          fontWeight: active ? 500 : 400,
        }}
      >
        {label}
      </span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Apply modal
// ---------------------------------------------------------------------------

interface ApplyModalProps {
  company: string;
  applyUrl: string;
  onClose: () => void;
  onProceed: () => void;
}

function ApplyModal({ company, applyUrl, onClose, onProceed }: ApplyModalProps) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  function proceed() {
    window.open(applyUrl, "_blank", "noopener,noreferrer");
    onProceed();
    onClose();
  }

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.65)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 50,
        fontFamily: "'Plus Jakarta Sans', sans-serif",
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: "#061f1f",
          border: "1px solid rgba(255,255,255,0.12)",
          borderRadius: 10,
          padding: "28px 28px 22px",
          maxWidth: 380,
          width: "calc(100% - 32px)",
          boxShadow: "0 24px 48px rgba(0,0,0,0.50)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          style={{
            fontSize: 15,
            fontWeight: 700,
            color: "rgba(255,255,255,0.90)",
            marginBottom: 8,
            letterSpacing: "-0.2px",
          }}
        >
          You&rsquo;re about to apply to {company}
        </div>
        <div
          style={{
            fontSize: 13,
            color: "rgba(255,255,255,0.50)",
            lineHeight: 1.6,
            marginBottom: 22,
          }}
        >
          {"We'll log this to your history. You'll be taken to their site to complete the application."}
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button
            onClick={proceed}
            style={{
              flex: 1,
              fontSize: 12,
              fontWeight: 700,
              padding: "10px 16px",
              borderRadius: 0,
              background: "#1BAAC1",
              color: "#0a2828",
              border: "none",
              cursor: "pointer",
              fontFamily: "inherit",
            }}
          >
            Open application →
          </button>
          <button
            onClick={onClose}
            style={{
              fontSize: 12,
              fontWeight: 600,
              padding: "10px 16px",
              borderRadius: 0,
              border: "1px solid rgba(255,255,255,0.14)",
              background: "none",
              color: "rgba(255,255,255,0.55)",
              cursor: "pointer",
              fontFamily: "inherit",
              whiteSpace: "nowrap",
            }}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Apply button — extracted so it is not declared inside a render function
// ---------------------------------------------------------------------------

interface ApplyBtnProps {
  onApply: () => void;
  fullWidth?: boolean;
}

function ApplyBtn({ onApply, fullWidth }: ApplyBtnProps) {
  return (
    <button
      onClick={onApply}
      style={{
        width: fullWidth ? "100%" : undefined,
        fontSize: 13,
        fontWeight: 600,
        padding: "11px 16px",
        borderRadius: 0,
        border: "1px solid rgba(27,170,193,0.35)",
        background: "rgba(27,170,193,0.08)",
        color: "#1BAAC1",
        cursor: "pointer",
        fontFamily: "inherit",
        textAlign: "center",
      }}
    >
      Apply now →
    </button>
  );
}

// ---------------------------------------------------------------------------
// Inline CV generation / CTA area (right panel)
// ---------------------------------------------------------------------------

interface CtaAreaProps {
  jobId: Id<"jobs">;
  companyName: string;
  applyUrl: string;
  hasCvUploaded: boolean;
  isPro: boolean;
}

function CtaArea({
  jobId,
  companyName,
  applyUrl,
  hasCvUploaded,
  isPro,
}: CtaAreaProps) {
  const [cvGenState, setCvGenState] = useState<CvGenState>({ status: "idle" });
  const [applicationId, setApplicationId] = useState<Id<"applications"> | null>(null);
  const [showApplyModal, setShowApplyModal] = useState(false);
  const stepTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const generateApplication = useAction(
    api.applications.generate.generateApplication,
  );
  const buildCvDocx = useAction(api.applications.buildCvDocx.buildCvDocx);
  const trackApplyMutation = useMutation(api.applications.mutations.trackApply);

  const downloadUrls = useQuery(
    api.applications.queries.getDownloadUrls,
    applicationId ? { applicationId } : "skip",
  );

  useEffect(() => {
    return () => {
      if (stepTimerRef.current) clearInterval(stepTimerRef.current);
    };
  }, []);

  const handleTrackApply = useCallback(() => {
    void trackApplyMutation({ jobId });
  }, [trackApplyMutation, jobId]);

  function startProgressAnimation() {
    let step = 0;
    setCvGenState({ status: "generating", step: 0 });
    stepTimerRef.current = setInterval(() => {
      step += 1;
      if (step < PROGRESS_STEPS.length - 1) {
        setCvGenState({ status: "generating", step });
      } else {
        if (stepTimerRef.current) clearInterval(stepTimerRef.current);
      }
    }, 1800);
  }

  async function handleGenerate() {
    if (!hasCvUploaded) {
      setCvGenState({ status: "no_cv" });
      return;
    }
    if (stepTimerRef.current) clearInterval(stepTimerRef.current);
    startProgressAnimation();
    try {
      const result = await generateApplication({ jobId });
      if (stepTimerRef.current) clearInterval(stepTimerRef.current);
      setCvGenState({ status: "generating", step: PROGRESS_STEPS.length - 1 });
      await buildCvDocx({
        applicationId: result.applicationId as Id<"applications">,
      });
      setApplicationId(result.applicationId as Id<"applications">);
      setCvGenState({
        status: "success",
        applicationId: result.applicationId,
        fromCache: result.fromCache,
      });
    } catch (err: unknown) {
      if (stepTimerRef.current) clearInterval(stepTimerRef.current);
      const data = (err as { data?: { code?: string; message?: string } }).data;
      if (data?.code === "UPGRADE_REQUIRED") {
        setCvGenState(
          isPro ? { status: "rate_limited_pro" } : { status: "rate_limited_free" },
        );
      } else {
        setCvGenState({
          status: "error",
          message: data?.message ?? "Something went wrong. Please try again.",
        });
      }
    }
  }


  // ── no CV uploaded ──────────────────────────────────────────────────────
  if (cvGenState.status === "no_cv") {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {showApplyModal && (
          <ApplyModal
            company={companyName}
            applyUrl={applyUrl}
            onClose={() => setShowApplyModal(false)}
            onProceed={handleTrackApply}
          />
        )}
        <a
          href="/onboarding"
          style={{
            display: "block",
            width: "100%",
            textAlign: "center",
            fontSize: 13,
            fontWeight: 700,
            padding: "13px 16px",
            borderRadius: 0,
            background: "rgba(255,255,255,0.06)",
            color: "rgba(255,255,255,0.55)",
            textDecoration: "none",
            border: "1px solid rgba(255,255,255,0.12)",
            boxSizing: "border-box",
          }}
        >
          Upload CV to generate tailored application →
        </a>
        <ApplyBtn fullWidth onApply={() => setShowApplyModal(true)} />
      </div>
    );
  }

  // ── idle ─────────────────────────────────────────────────────────────────
  if (cvGenState.status === "idle") {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {showApplyModal && (
          <ApplyModal
            company={companyName}
            applyUrl={applyUrl}
            onClose={() => setShowApplyModal(false)}
            onProceed={handleTrackApply}
          />
        )}
        <button
          onClick={handleGenerate}
          style={{
            width: "100%",
            fontSize: 13,
            fontWeight: 700,
            padding: "13px 16px",
            borderRadius: 0,
            border: "none",
            background: "#1BAAC1",
            color: "#0a2828",
            cursor: "pointer",
            fontFamily: "inherit",
            textAlign: "center",
            letterSpacing: "-0.1px",
          }}
        >
          Generate tailored CV →
        </button>
        <ApplyBtn fullWidth onApply={() => setShowApplyModal(true)} />
      </div>
    );
  }

  // ── generating ───────────────────────────────────────────────────────────
  if (cvGenState.status === "generating") {
    const { step } = cvGenState;
    return (
      <div>
        {showApplyModal && (
          <ApplyModal
            company={companyName}
            applyUrl={applyUrl}
            onClose={() => setShowApplyModal(false)}
            onProceed={handleTrackApply}
          />
        )}
        <div
          style={{
            border: "1px solid rgba(27,170,193,0.20)",
            background: "rgba(27,170,193,0.04)",
            padding: "14px 16px",
            marginBottom: 8,
          }}
        >
          <div
            style={{
              fontFamily: "'DM Mono', monospace",
              fontSize: 10,
              letterSpacing: "1px",
              color: "#1BAAC1",
              marginBottom: 12,
              textTransform: "uppercase",
            }}
          >
            Generating your CV…
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
            {PROGRESS_STEPS.map((label, i) => {
              const isDone = i < step;
              const isActive = i === step;
              return (
                <div
                  key={i}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    opacity: isDone ? 0.5 : isActive ? 1 : 0.22,
                    transition: "opacity 0.3s",
                  }}
                >
                  <div
                    style={{
                      width: 16,
                      height: 16,
                      borderRadius: "50%",
                      flexShrink: 0,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      background: isDone
                        ? "rgba(74,222,128,0.15)"
                        : isActive
                        ? "rgba(27,170,193,0.20)"
                        : "rgba(255,255,255,0.05)",
                    }}
                  >
                    {isDone ? (
                      <svg
                        width="8"
                        height="8"
                        viewBox="0 0 8 8"
                        fill="none"
                        aria-hidden="true"
                      >
                        <path
                          d="M1.5 4l2 2 3-3"
                          stroke="#4ade80"
                          strokeWidth="1.3"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    ) : isActive ? (
                      <div
                        style={{
                          width: 5,
                          height: 5,
                          borderRadius: "50%",
                          background: "#1BAAC1",
                        }}
                      />
                    ) : (
                      <div
                        style={{
                          width: 3,
                          height: 3,
                          borderRadius: "50%",
                          background: "rgba(255,255,255,0.20)",
                        }}
                      />
                    )}
                  </div>
                  <span
                    style={{
                      fontSize: 12,
                      color: isActive
                        ? "rgba(255,255,255,0.82)"
                        : "rgba(255,255,255,0.40)",
                      fontWeight: isActive ? 600 : 400,
                    }}
                  >
                    {label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
        <ApplyBtn fullWidth onApply={() => setShowApplyModal(true)} />
      </div>
    );
  }

  // ── success ──────────────────────────────────────────────────────────────
  if (cvGenState.status === "success") {
    const cvUrl = downloadUrls?.cvUrl ?? null;
    const coverLetterUrl = downloadUrls?.coverLetterUrl ?? null;
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {showApplyModal && (
          <ApplyModal
            company={companyName}
            applyUrl={applyUrl}
            onClose={() => setShowApplyModal(false)}
            onProceed={handleTrackApply}
          />
        )}
        {cvUrl ? (
          <a
            href={cvUrl}
            download
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 6,
              fontSize: 13,
              fontWeight: 700,
              padding: "12px 16px",
              borderRadius: 0,
              background: "#1BAAC1",
              color: "#0a2828",
              textDecoration: "none",
            }}
          >
            <DownloadIcon /> Download CV (.docx)
          </a>
        ) : (
          <div
            style={{
              padding: "12px 16px",
              textAlign: "center",
              fontSize: 12,
              color: "rgba(255,255,255,0.35)",
              border: "1px solid rgba(255,255,255,0.08)",
            }}
          >
            Preparing CV…
          </div>
        )}
        {coverLetterUrl ? (
          <a
            href={coverLetterUrl}
            download
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 6,
              fontSize: 13,
              fontWeight: 600,
              padding: "11px 16px",
              borderRadius: 0,
              border: "1px solid rgba(27,170,193,0.35)",
              background: "rgba(27,170,193,0.08)",
              color: "#1BAAC1",
              textDecoration: "none",
            }}
          >
            <DownloadIcon /> Download cover letter (.docx)
          </a>
        ) : (
          <div
            style={{
              padding: "11px 16px",
              textAlign: "center",
              fontSize: 12,
              color: "rgba(255,255,255,0.35)",
              border: "1px solid rgba(255,255,255,0.08)",
            }}
          >
            Preparing cover letter…
          </div>
        )}
        <button
          onClick={() => setShowApplyModal(true)}
          style={{
            width: "100%",
            fontSize: 13,
            fontWeight: 700,
            padding: "12px 16px",
            borderRadius: 0,
            background: "#1BAAC1",
            color: "#0a2828",
            border: "none",
            cursor: "pointer",
            fontFamily: "inherit",
            textAlign: "center",
          }}
        >
          Apply now →
        </button>
        <button
          onClick={() => void handleGenerate()}
          style={{
            fontSize: 11,
            color: "rgba(255,255,255,0.32)",
            background: "none",
            border: "none",
            cursor: "pointer",
            fontFamily: "inherit",
            padding: "4px 0",
            textAlign: "center",
          }}
        >
          {cvGenState.fromCache ? "Using cached CV — Regenerate" : "Regenerate"}
        </button>
      </div>
    );
  }

  // ── error ─────────────────────────────────────────────────────────────────
  if (cvGenState.status === "error") {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {showApplyModal && (
          <ApplyModal
            company={companyName}
            applyUrl={applyUrl}
            onClose={() => setShowApplyModal(false)}
            onProceed={handleTrackApply}
          />
        )}
        <div
          style={{
            padding: "12px 14px",
            border: "1px solid rgba(248,113,113,0.22)",
            background: "rgba(248,113,113,0.06)",
            fontSize: 12,
            color: "rgba(248,113,113,0.85)",
            marginBottom: 4,
          }}
        >
          {cvGenState.message}
        </div>
        <button
          onClick={() => void handleGenerate()}
          style={{
            width: "100%",
            fontSize: 13,
            fontWeight: 700,
            padding: "12px 16px",
            borderRadius: 0,
            background: "#1BAAC1",
            color: "#0a2828",
            border: "none",
            cursor: "pointer",
            fontFamily: "inherit",
          }}
        >
          Try again →
        </button>
        <ApplyBtn fullWidth onApply={() => setShowApplyModal(true)} />
      </div>
    );
  }

  // ── rate limited free ─────────────────────────────────────────────────────
  if (cvGenState.status === "rate_limited_free") {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {showApplyModal && (
          <ApplyModal
            company={companyName}
            applyUrl={applyUrl}
            onClose={() => setShowApplyModal(false)}
            onProceed={handleTrackApply}
          />
        )}
        <div
          style={{
            padding: "12px 14px",
            border: "1px solid rgba(27,170,193,0.20)",
            background: "rgba(27,170,193,0.05)",
            fontSize: 12,
            color: "rgba(255,255,255,0.55)",
            lineHeight: 1.55,
            marginBottom: 4,
          }}
        >
          {"You've used your free CV this month. Upgrade to Pro for 20/month, or buy a single credit."}
        </div>
        <a
          href="/settings/upgrade"
          style={{
            display: "block",
            textAlign: "center",
            fontSize: 13,
            fontWeight: 700,
            padding: "12px 16px",
            borderRadius: 0,
            background: "#1BAAC1",
            color: "#0a2828",
            textDecoration: "none",
          }}
        >
          Upgrade to Pro — £3.99/mo
        </a>
        <a
          href="/settings/upgrade?plan=pay_per_cv"
          style={{
            display: "block",
            textAlign: "center",
            fontSize: 12,
            fontWeight: 600,
            padding: "10px 16px",
            borderRadius: 0,
            border: "1px solid rgba(27,170,193,0.30)",
            background: "rgba(27,170,193,0.07)",
            color: "#1BAAC1",
            textDecoration: "none",
          }}
        >
          Buy single credit — £1.99
        </a>
        <ApplyBtn fullWidth onApply={() => setShowApplyModal(true)} />
      </div>
    );
  }

  // ── rate limited pro ──────────────────────────────────────────────────────
  if (cvGenState.status === "rate_limited_pro") {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {showApplyModal && (
          <ApplyModal
            company={companyName}
            applyUrl={applyUrl}
            onClose={() => setShowApplyModal(false)}
            onProceed={handleTrackApply}
          />
        )}
        <div
          style={{
            padding: "12px 14px",
            border: "1px solid rgba(27,170,193,0.20)",
            background: "rgba(27,170,193,0.05)",
            fontSize: 12,
            color: "rgba(255,255,255,0.55)",
            lineHeight: 1.55,
            marginBottom: 4,
          }}
        >
          {"You've reached your 20 CV limit for this month. Resets on the 1st."}
        </div>
        <a
          href="/settings/upgrade?plan=pay_per_cv"
          style={{
            display: "block",
            textAlign: "center",
            fontSize: 13,
            fontWeight: 700,
            padding: "12px 16px",
            borderRadius: 0,
            background: "#1BAAC1",
            color: "#0a2828",
            textDecoration: "none",
          }}
        >
          Buy single credit — £1.99
        </a>
        <ApplyBtn fullWidth onApply={() => setShowApplyModal(true)} />
      </div>
    );
  }

  return null;
}

function DownloadIcon() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 12 12"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M6 1v7M3 5l3 3 3-3M2 10h8"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Job detail panel (right side)
// ---------------------------------------------------------------------------

interface JobDetailPanelProps {
  jobId: string;
  isMobile: boolean;
  onBack: () => void;
}

function JobDetailPanel({ jobId, isMobile, onBack }: JobDetailPanelProps) {
  const result = useQuery(api.jobs.queries.getJobById, {
    id: jobId as Id<"jobs">,
  });
  const saveJobMutation = useMutation(api.applications.mutations.saveJob);
  const unsaveJobMutation = useMutation(api.applications.mutations.unsaveJob);

  const [pendingSave, setPendingSave] = useState(false);
  const [optimisticSaved, setOptimisticSaved] = useState<boolean | null>(null);

  const querySaved = result?.isSaved ?? false;
  const isSaved = optimisticSaved !== null ? optimisticSaved : querySaved;

  async function handleSaveToggle() {
    if (!result?.job || pendingSave) return;
    const next = !isSaved;
    setOptimisticSaved(next);
    setPendingSave(true);
    try {
      if (next) {
        await saveJobMutation({ jobId: result.job._id });
      } else {
        await unsaveJobMutation({ jobId: result.job._id });
      }
      setOptimisticSaved(null);
    } catch {
      setOptimisticSaved(!next);
    } finally {
      setPendingSave(false);
    }
  }

  if (result === undefined) {
    return (
      <div
        style={{
          flex: 1,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "rgba(255,255,255,0.28)",
          fontSize: 13,
          fontFamily: "'Plus Jakarta Sans', sans-serif",
        }}
      >
        Loading…
      </div>
    );
  }

  if (result === null) {
    return (
      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 12,
          fontFamily: "'Plus Jakarta Sans', sans-serif",
          color: "rgba(255,255,255,0.45)",
          fontSize: 13,
        }}
      >
        Job not found
        {isMobile && (
          <button
            onClick={onBack}
            style={{
              fontSize: 12,
              color: "#1BAAC1",
              background: "none",
              border: "none",
              cursor: "pointer",
              fontFamily: "inherit",
            }}
          >
            ← Back
          </button>
        )}
      </div>
    );
  }

  const { job, sponsor, isPro, hasCvUploaded, matchesProfile } = result;
  const applyUrl = job.sourceIds[0]?.applyUrl ?? "#";
  const salary = formatSalary(job.salaryMin, job.salaryMax);

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        overflow: "hidden",
        fontFamily: "'Plus Jakarta Sans', sans-serif",
      }}
    >
      {/* ── Detail topbar ─────────────────────────────────────────────── */}
      <div
        style={{
          height: 52,
          flexShrink: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 24px",
          borderBottom: "1px solid rgba(255,255,255,0.07)",
          gap: 12,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            minWidth: 0,
          }}
        >
          {isMobile && (
            <button
              onClick={onBack}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 5,
                fontSize: 12,
                color: "rgba(255,255,255,0.50)",
                background: "none",
                border: "none",
                cursor: "pointer",
                fontFamily: "inherit",
                flexShrink: 0,
                padding: 0,
              }}
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 14 14"
                fill="none"
                aria-hidden="true"
              >
                <path
                  d="M9 3L5 7l4 4"
                  stroke="currentColor"
                  strokeWidth="1.4"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              Jobs
            </button>
          )}
          <div style={{ minWidth: 0 }}>
            <div
              style={{
                fontSize: 13,
                fontWeight: 700,
                color: "rgba(255,255,255,0.88)",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {job.title}
            </div>
            <div
              style={{
                fontSize: 10,
                color: "rgba(255,255,255,0.38)",
                marginTop: 1,
              }}
            >
              {job.company}
            </div>
          </div>
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            flexShrink: 0,
          }}
        >
          <ScoreBand
            band={job.sponsorshipBand as Band}
            score={job.sponsorshipScore}
            showScore={isPro}
          />
          <button
            onClick={() => void handleSaveToggle()}
            disabled={pendingSave}
            style={{
              fontSize: 11,
              fontWeight: 600,
              padding: "5px 10px",
              borderRadius: 0,
              border: `1px solid ${isSaved ? "rgba(74,222,128,0.30)" : "rgba(255,255,255,0.14)"}`,
              background: isSaved
                ? "rgba(74,222,128,0.08)"
                : "rgba(255,255,255,0.04)",
              color: isSaved ? "#4ade80" : "rgba(255,255,255,0.55)",
              cursor: pendingSave ? "default" : "pointer",
              fontFamily: "inherit",
              opacity: pendingSave ? 0.6 : 1,
            }}
          >
            {pendingSave ? "…" : isSaved ? "Saved" : "Save"}
          </button>
        </div>
      </div>

      {/* ── Scrollable body ───────────────────────────────────────────── */}
      <div style={{ flex: 1, overflowY: "auto", padding: "20px 24px 32px" }}>

        {/* Job header */}
        <div style={{ marginBottom: 20 }}>
          <div
            style={{
              display: "flex",
              alignItems: "flex-start",
              gap: 14,
              marginBottom: 10,
            }}
          >
            <CompanyLogo company={job.company} size={44} />
            <div>
              <h1
                style={{
                  fontSize: 18,
                  fontWeight: 700,
                  letterSpacing: "-0.3px",
                  color: "rgba(255,255,255,0.92)",
                  margin: "0 0 4px",
                }}
              >
                {job.title}
              </h1>
              <div
                style={{
                  fontSize: 13,
                  color: "rgba(255,255,255,0.50)",
                }}
              >
                {job.company} · {job.location}
                {salary ? ` · ${salary}` : ""}
              </div>
            </div>
          </div>
        </div>

        {/* Score signals — 3 ticks */}
        <div
          style={{
            background: "rgba(255,255,255,0.02)",
            border: "1px solid rgba(255,255,255,0.07)",
            borderRadius: 8,
            padding: "12px 16px",
            marginBottom: 16,
            display: "flex",
            flexDirection: "column",
            gap: 2,
          }}
        >
          <SignalTick label="Licensed sponsor" active={!!sponsor} />
          <SignalTick
            label="Sponsorship in description"
            active={job.explicit === true}
          />
          <SignalTick label="Matches your profile" active={!!matchesProfile} />
        </div>

        {/* Primary CTA area */}
        <div style={{ marginBottom: 20 }}>
          <CtaArea
            jobId={job._id}
            companyName={job.company}
            applyUrl={applyUrl}
            hasCvUploaded={hasCvUploaded ?? false}
            isPro={isPro}
          />
        </div>

        {/* Company card */}
        {sponsor && (
          <div
            style={{
              background: "rgba(255,255,255,0.02)",
              border: "1px solid rgba(255,255,255,0.07)",
              borderRadius: 8,
              padding: "14px 16px",
              marginBottom: 20,
            }}
          >
            <div
              style={{
                fontFamily: "'DM Mono', monospace",
                fontSize: 9,
                letterSpacing: "1.5px",
                textTransform: "uppercase",
                color: "rgba(255,255,255,0.30)",
                marginBottom: 10,
              }}
            >
              Employer
            </div>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                marginBottom: 10,
              }}
            >
              <CompanyLogo company={job.company} size={28} />
              <div>
                <div
                  style={{
                    fontSize: 13,
                    fontWeight: 700,
                    color: "rgba(255,255,255,0.82)",
                  }}
                >
                  {job.company}
                </div>
                <div
                  style={{
                    fontSize: 10,
                    color: "#4ade80",
                    marginTop: 2,
                  }}
                >
                  Active UKVI sponsor · {sponsor.route}
                </div>
              </div>
            </div>
            {(sponsor.town ?? sponsor.county) && (
              <div
                style={{
                  fontSize: 11,
                  color: "rgba(255,255,255,0.38)",
                }}
              >
                {[sponsor.town, sponsor.county].filter(Boolean).join(", ")}
              </div>
            )}
          </div>
        )}

        {/* Full description */}
        <div>
          <div
            style={{
              fontFamily: "'DM Mono', monospace",
              fontSize: 9,
              letterSpacing: "1.5px",
              textTransform: "uppercase",
              color: "rgba(255,255,255,0.30)",
              marginBottom: 12,
            }}
          >
            About this role
          </div>
          <div
            // HTML comes from trusted employer ATS boards (Greenhouse, Lever,
            // Workable, etc.) — safe to render directly.
            dangerouslySetInnerHTML={{ __html: job.description }}
            style={{
              margin: 0,
              fontFamily: "'Plus Jakarta Sans', sans-serif",
              fontSize: 13,
              lineHeight: 1.75,
              color: "rgba(255,255,255,0.60)",
              wordBreak: "break-word",
            }}
          />
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Empty detail placeholder (desktop, nothing selected)
// ---------------------------------------------------------------------------

function DetailPlaceholder() {
  return (
    <div
      style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 10,
        color: "rgba(255,255,255,0.22)",
        fontFamily: "'Plus Jakarta Sans', sans-serif",
        userSelect: "none",
      }}
    >
      <svg
        width="32"
        height="32"
        viewBox="0 0 32 32"
        fill="none"
        aria-hidden="true"
      >
        <rect
          x="4"
          y="4"
          width="24"
          height="24"
          rx="4"
          stroke="rgba(255,255,255,0.14)"
          strokeWidth="1.5"
        />
        <line
          x1="4"
          y1="13"
          x2="28"
          y2="13"
          stroke="rgba(255,255,255,0.14)"
          strokeWidth="1.5"
        />
        <line
          x1="10"
          y1="19"
          x2="22"
          y2="19"
          stroke="rgba(255,255,255,0.14)"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
        <line
          x1="10"
          y1="24"
          x2="18"
          y2="24"
          stroke="rgba(255,255,255,0.14)"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
      </svg>
      <span style={{ fontSize: 13 }}>Select a job to see details</span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Score badges on the job card (left panel)
// ---------------------------------------------------------------------------

interface BadgePillProps {
  label: string;
  variant: "teal" | "green" | "blue";
}

function BadgePill({ label, variant }: BadgePillProps) {
  const styles = {
    teal: {
      color: "#1BAAC1",
      bg: "rgba(27,170,193,0.10)",
      border: "rgba(27,170,193,0.28)",
    },
    green: {
      color: "#4ade80",
      bg: "rgba(74,222,128,0.09)",
      border: "rgba(74,222,128,0.25)",
    },
    blue: {
      color: "rgba(147,197,253,0.90)",
      bg: "rgba(147,197,253,0.08)",
      border: "rgba(147,197,253,0.22)",
    },
  }[variant];

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        fontFamily: "'DM Mono', monospace",
        fontSize: 9,
        fontWeight: 600,
        letterSpacing: "0.6px",
        color: styles.color,
        background: styles.bg,
        border: `1px solid ${styles.border}`,
        borderRadius: 3,
        padding: "2px 6px",
        whiteSpace: "nowrap",
      }}
    >
      {label}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Job card (left panel)
// ---------------------------------------------------------------------------

interface JobCardProps {
  job: JobDoc;
  isPro: boolean;
  isSaved: boolean;
  isSelected: boolean;
  onSelect: () => void;
  onSave: () => void;
  onUnsave: () => void;
}

function JobCard({
  job,
  isPro,
  isSaved,
  isSelected,
  onSelect,
  onSave,
  onUnsave,
}: JobCardProps) {
  const salary = formatSalary(job.salaryMin, job.salaryMax);
  const age = relativeTime(job.postedAt);
  const trackApplyMutation = useMutation(api.applications.mutations.trackApply);
  const [applied, setApplied] = useState(false);
  const [applying, setApplying] = useState(false);

  async function handleMarkApplied(e: React.MouseEvent) {
    e.stopPropagation();
    if (applied || applying) return;
    setApplying(true);
    try {
      await trackApplyMutation({ jobId: job._id as Id<"jobs"> });
      setApplied(true);
    } finally {
      setApplying(false);
    }
  }

  return (
    <div
      onClick={onSelect}
      style={{
        padding: "12px 16px",
        borderBottom: "1px solid rgba(255,255,255,0.05)",
        cursor: "pointer",
        background: isSelected
          ? "rgba(27,170,193,0.07)"
          : "transparent",
        borderLeft: isSelected
          ? "2px solid #1BAAC1"
          : "2px solid transparent",
        transition: "background 0.12s",
        paddingLeft: isSelected ? 14 : 16,
      }}
      onMouseEnter={(e) => {
        if (!isSelected)
          (e.currentTarget as HTMLDivElement).style.background =
            "rgba(255,255,255,0.025)";
      }}
      onMouseLeave={(e) => {
        if (!isSelected)
          (e.currentTarget as HTMLDivElement).style.background = "transparent";
      }}
    >
      {/* Top row: logo + title + save */}
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          gap: 10,
          marginBottom: 5,
        }}
      >
        <div style={{ flexShrink: 0, marginTop: 1 }}>
          <CompanyLogo company={job.company} size={28} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontSize: 13,
              fontWeight: 700,
              color: isSelected
                ? "rgba(255,255,255,0.95)"
                : "rgba(255,255,255,0.85)",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
              lineHeight: 1.3,
            }}
          >
            {job.title}
          </div>
          <div
            style={{
              fontSize: 11,
              color: "rgba(255,255,255,0.42)",
              marginTop: 2,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {job.company} · {job.location}
          </div>
        </div>

        {/* Save icon */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            isSaved ? onUnsave() : onSave();
          }}
          title={isSaved ? "Unsave" : "Save"}
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            width: 24,
            height: 24,
            flexShrink: 0,
            background: "none",
            border: "none",
            cursor: "pointer",
            color: isSaved ? "#4ade80" : "rgba(255,255,255,0.28)",
            padding: 0,
          }}
          aria-label={isSaved ? "Unsave" : "Save"}
        >
          <svg
            width="13"
            height="13"
            viewBox="0 0 13 13"
            fill="none"
            aria-hidden="true"
          >
            <path
              d="M2 2h9v10l-4.5-2.5L2 12V2z"
              stroke="currentColor"
              strokeWidth="1.3"
              strokeLinejoin="round"
              fill={isSaved ? "rgba(74,222,128,0.20)" : "none"}
            />
          </svg>
        </button>
      </div>

      {/* Meta row: salary + age */}
      {(salary ?? age) && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            marginBottom: 7,
            marginLeft: 38,
          }}
        >
          {salary && (
            <span
              style={{
                fontFamily: "'DM Mono', monospace",
                fontSize: 11,
                color: "rgba(255,255,255,0.50)",
              }}
            >
              {salary}
            </span>
          )}
          {salary && (
            <span
              style={{
                width: 2,
                height: 2,
                borderRadius: "50%",
                background: "rgba(255,255,255,0.20)",
                flexShrink: 0,
                display: "inline-block",
              }}
            />
          )}
          <span
            style={{
              fontFamily: "'DM Mono', monospace",
              fontSize: 10,
              color: "rgba(255,255,255,0.30)",
            }}
          >
            {age}
          </span>
        </div>
      )}

      {/* Score badges + score band */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 5,
          flexWrap: "wrap",
          marginLeft: 38,
          marginBottom: 8,
        }}
      >
        {job.sponsorId && <BadgePill label="Licensed sponsor" variant="green" />}
        {job.sponsorshipBand === "high" && (
          <BadgePill label="Likely to sponsor" variant="teal" />
        )}
        {job.explicit === true && (
          <BadgePill label="Mentioned in JD" variant="blue" />
        )}
        {!job.sponsorId && !job.explicit && (
          <ScoreBand
            band={job.sponsorshipBand}
            score={job.sponsorshipScore}
            showScore={isPro}
          />
        )}
      </div>

      {/* Mark as applied */}
      <div style={{ marginLeft: 38 }}>
        <button
          onClick={handleMarkApplied}
          disabled={applied || applying}
          style={{
            fontSize: 11,
            fontWeight: 600,
            padding: "4px 10px",
            borderRadius: 0,
            border: applied
              ? "1px solid rgba(74,222,128,0.28)"
              : "1px solid rgba(255,255,255,0.10)",
            background: applied ? "rgba(74,222,128,0.07)" : "none",
            color: applied
              ? "#4ade80"
              : applying
              ? "rgba(255,255,255,0.28)"
              : "rgba(255,255,255,0.40)",
            cursor: applied || applying ? "default" : "pointer",
            fontFamily: "inherit",
            whiteSpace: "nowrap",
          }}
        >
          {applied ? "Applied ✓" : applying ? "Logging…" : "Mark as applied"}
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// No role variations prompt (full-screen)
// ---------------------------------------------------------------------------

function NoRoleVariationsPrompt() {
  return (
    <div
      style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: 40,
        textAlign: "center",
        fontFamily: "'Plus Jakarta Sans', sans-serif",
      }}
    >
      <p
        style={{
          fontFamily: "'DM Mono', monospace",
          fontSize: 10,
          color: "#1BAAC1",
          textTransform: "uppercase",
          letterSpacing: "2px",
          margin: "0 0 14px",
        }}
      >
        Jobs feed
      </p>
      <h1
        style={{
          fontSize: 22,
          fontWeight: 700,
          color: "rgba(255,255,255,0.90)",
          margin: "0 0 10px",
          letterSpacing: "-0.3px",
        }}
      >
        Tell us what you&rsquo;re looking for
      </h1>
      <p
        style={{
          fontSize: 14,
          color: "rgba(255,255,255,0.45)",
          maxWidth: 360,
          lineHeight: 1.65,
          margin: "0 0 28px",
        }}
      >
        Complete your profile so Tino can show you relevant sponsorship
        opportunities matched to your experience.
      </p>
      <Link
        href="/onboarding"
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          background: "#1BAAC1",
          color: "#0a2828",
          fontWeight: 700,
          padding: "11px 24px",
          fontSize: 13,
          textDecoration: "none",
          borderRadius: 0,
        }}
      >
        Set up roles →
      </Link>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Banners
// ---------------------------------------------------------------------------

function CvUploadBanner({ onDismiss }: { onDismiss: () => void }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 10,
        padding: "9px 14px",
        background: "rgba(27,170,193,0.07)",
        borderBottom: "1px solid rgba(27,170,193,0.18)",
        flexShrink: 0,
      }}
    >
      <span style={{ fontSize: 12, color: "rgba(255,255,255,0.60)", flex: 1 }}>
        Upload your CV to generate tailored applications
      </span>
      <a
        href="/onboarding/cv"
        style={{
          fontSize: 11,
          fontWeight: 600,
          color: "#1BAAC1",
          textDecoration: "none",
          whiteSpace: "nowrap",
          flexShrink: 0,
        }}
      >
        Upload now →
      </a>
      <button
        onClick={onDismiss}
        aria-label="Dismiss"
        style={{
          background: "none",
          border: "none",
          cursor: "pointer",
          color: "rgba(255,255,255,0.28)",
          fontSize: 14,
          lineHeight: 1,
          padding: 0,
          flexShrink: 0,
        }}
      >
        ×
      </button>
    </div>
  );
}

function FreePlanBanner() {
  return (
    <div
      style={{
        position: "absolute",
        bottom: 0,
        left: 0,
        right: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 12,
        padding: "10px 16px",
        background: "rgba(2,16,16,0.96)",
        borderTop: "1px solid rgba(255,255,255,0.08)",
        fontFamily: "'Plus Jakarta Sans', sans-serif",
        zIndex: 10,
      }}
    >
      <span style={{ fontSize: 11, color: "rgba(255,255,255,0.45)", flex: 1 }}>
        Free plan — 1 CV/month
      </span>
      <Link
        href="/settings/upgrade"
        style={{
          fontSize: 11,
          fontWeight: 600,
          color: "#1BAAC1",
          textDecoration: "none",
          whiteSpace: "nowrap",
          flexShrink: 0,
        }}
      >
        Upgrade to Pro for 20/month →
      </Link>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Filter bar (collapsible, inside left panel)
// ---------------------------------------------------------------------------

type PostedParamOpt = PostedParam | null;
type BandParamOpt = BandParam | null;

interface FilterBarProps {
  band: BandParamOpt;
  location: string;
  salaryMin: number | undefined;
  postedWithin: PostedParamOpt;
  locationDraft: string;
  salaryDraft: string;
  setLocationDraft: (v: string) => void;
  setSalaryDraft: (v: string) => void;
  commitLocation: () => void;
  commitSalary: () => void;
  setFilter: (k: string, v: string | null) => void;
  hasAnyFilter: boolean;
  clearAll: () => void;
}

function FilterBar({
  band,
  postedWithin,
  locationDraft,
  salaryDraft,
  setLocationDraft,
  setSalaryDraft,
  commitLocation,
  commitSalary,
  setFilter,
  hasAnyFilter,
  clearAll,
}: FilterBarProps) {
  const inp: React.CSSProperties = {
    background: "rgba(255,255,255,0.04)",
    border: "1px solid rgba(255,255,255,0.09)",
    borderRadius: 4,
    padding: "6px 10px",
    fontSize: 12,
    color: "rgba(255,255,255,0.75)",
    fontFamily: "'Plus Jakarta Sans', sans-serif",
    outline: "none",
    width: "100%",
    boxSizing: "border-box" as const,
  };
  const sel: React.CSSProperties = {
    ...inp,
    appearance: "none" as const,
    WebkitAppearance: "none" as const,
    cursor: "pointer",
  };

  return (
    <div
      style={{
        padding: "10px 14px",
        borderBottom: "1px solid rgba(255,255,255,0.07)",
        display: "flex",
        flexDirection: "column",
        gap: 6,
      }}
    >
      <input
        type="text"
        placeholder="Location"
        value={locationDraft}
        onChange={(e) => setLocationDraft(e.target.value)}
        onBlur={commitLocation}
        onKeyDown={(e) => e.key === "Enter" && commitLocation()}
        style={inp}
      />
      <div style={{ display: "flex", gap: 6 }}>
        <input
          type="text"
          inputMode="numeric"
          placeholder="Min salary (£)"
          value={salaryDraft}
          onChange={(e) =>
            setSalaryDraft(e.target.value.replace(/[^0-9,]/g, ""))
          }
          onBlur={commitSalary}
          onKeyDown={(e) => e.key === "Enter" && commitSalary()}
          style={{ ...inp, flex: 1 }}
        />
        <select
          value={postedWithin ?? "any"}
          onChange={(e) =>
            setFilter("posted", e.target.value === "any" ? null : e.target.value)
          }
          style={{ ...sel, flex: 1 }}
        >
          <option value="any">Any time</option>
          <option value="24h">Last 24h</option>
          <option value="7d">Last 7d</option>
          <option value="30d">Last 30d</option>
        </select>
      </div>
      {/* Band pills */}
      <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
        {(
          [
            ["all", "All"],
            ["high", "High"],
            ["medium", "Medium"],
            ["low", "Low"],
          ] as [string, string][]
        ).map(([val, lbl]) => (
          <button
            key={val}
            onClick={() =>
              setFilter("band", val === "all" ? null : val)
            }
            style={{
              fontSize: 10,
              fontWeight: 500,
              padding: "4px 9px",
              borderRadius: 100,
              border: `1px solid ${(val === "all" ? !band : band === val) ? "rgba(27,170,193,0.35)" : "rgba(255,255,255,0.10)"}`,
              background: (val === "all" ? !band : band === val)
                ? "rgba(27,170,193,0.10)"
                : "none",
              color: (val === "all" ? !band : band === val)
                ? "#1BAAC1"
                : "rgba(255,255,255,0.45)",
              cursor: "pointer",
              fontFamily: "inherit",
              whiteSpace: "nowrap",
            }}
          >
            {lbl}
          </button>
        ))}
        {hasAnyFilter && (
          <button
            onClick={clearAll}
            style={{
              fontSize: 10,
              padding: "4px 9px",
              borderRadius: 100,
              border: "1px solid rgba(248,113,113,0.22)",
              background: "rgba(248,113,113,0.06)",
              color: "rgba(248,113,113,0.70)",
              cursor: "pointer",
              fontFamily: "inherit",
              whiteSpace: "nowrap",
            }}
          >
            Clear
          </button>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main feed (uses useSearchParams — must be inside Suspense)
// ---------------------------------------------------------------------------

function JobsFeed() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const selectedId = searchParams.get("id");

  // ── Responsive ──────────────────────────────────────────────────────────
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  // ── Filter state ─────────────────────────────────────────────────────────
  const band = (searchParams.get("band") as BandParam | null) ?? null;
  const location = searchParams.get("location") ?? "";
  const salaryMin = searchParams.get("salary")
    ? Number(searchParams.get("salary"))
    : undefined;
  const postedWithin =
    (searchParams.get("posted") as PostedParam | null) ?? null;

  const [locationDraft, setLocationDraft] = useState(location);
  const [salaryDraft, setSalaryDraft] = useState(
    salaryMin !== undefined ? String(salaryMin) : "",
  );
  const [limit, setLimit] = useState(40);
  const [showFilters, setShowFilters] = useState(false);
  const [cvBannerDismissed, setCvBannerDismissed] = useState(false);

  const filterKey = [band, location, salaryMin, postedWithin].join("|");
  const prevFilterKey = useRef(filterKey);
  useEffect(() => {
    if (filterKey === prevFilterKey.current) return;
    prevFilterKey.current = filterKey;
    setLimit(40);
  }, [filterKey]);

  // ── Queries ──────────────────────────────────────────────────────────────
  const result = useQuery(api.jobs.queries.listForUser, {
    limit,
    band: band ?? undefined,
    location: location || undefined,
    salaryMin,
    postedWithin: postedWithin ?? undefined,
  });

  const savedJobIds = useQuery(api.jobs.queries.getSavedJobIds, {});
  const savedSet = new Set<string>(savedJobIds ?? []);

  // ── Mutations ────────────────────────────────────────────────────────────
  const saveJobMutation = useMutation(
    api.applications.mutations.saveJob,
  ).withOptimisticUpdate((localStore, args) => {
    const cur = localStore.getQuery(api.jobs.queries.getSavedJobIds, {});
    if (cur !== undefined)
      localStore.setQuery(api.jobs.queries.getSavedJobIds, {}, [
        ...cur,
        args.jobId,
      ]);
  });

  const unsaveJobMutation = useMutation(
    api.applications.mutations.unsaveJob,
  ).withOptimisticUpdate((localStore, args) => {
    const cur = localStore.getQuery(api.jobs.queries.getSavedJobIds, {});
    if (cur !== undefined)
      localStore.setQuery(
        api.jobs.queries.getSavedJobIds,
        {},
        cur.filter((id) => id !== args.jobId),
      );
  });

  const isPro = result?.isPro ?? false;
  const hasCvUploaded = result?.hasCvUploaded ?? true; // default true to avoid flash
  const hasRoleVariations = result?.hasRoleVariations ?? true;
  const isLoading = result === undefined;
  const hasMore = result?.hasMore ?? false;
  const totalCount = result?.totalCount ?? 0;
  const jobs = (result?.jobs ?? []) as JobDoc[];

  // ── Routing helpers ───────────────────────────────────────────────────────
  function selectJob(id: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("id", id);
    router.replace(`${pathname}?${params.toString()}`);
  }

  function deselectJob() {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("id");
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname);
  }

  function setFilter(key: string, value: string | null) {
    const params = new URLSearchParams(searchParams.toString());
    if (!value) params.delete(key);
    else params.set(key, value);
    const qs = params.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname);
  }

  function commitLocation() {
    setFilter("location", locationDraft.trim() || null);
  }
  function commitSalary() {
    const val = parseInt(salaryDraft.replace(/[^0-9]/g, ""), 10);
    setFilter("salary", isNaN(val) || val <= 0 ? null : String(val));
  }

  const hasAnyFilter =
    !!band || !!location || salaryMin !== undefined || !!postedWithin;

  function clearAll() {
    setLocationDraft("");
    setSalaryDraft("");
    router.push(pathname);
  }

  // ── No role variations guard ──────────────────────────────────────────────
  if (!isLoading && !hasRoleVariations) {
    return <NoRoleVariationsPrompt />;
  }

  // ── Mobile: show detail full-screen if id set ─────────────────────────────
  if (isMobile && selectedId) {
    return (
      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          fontFamily: "'Plus Jakarta Sans', sans-serif",
        }}
      >
        <JobDetailPanel
          jobId={selectedId}
          isMobile
          onBack={deselectJob}
        />
      </div>
    );
  }

  // ── List panel (shared for mobile list + desktop left) ────────────────────
  const listPanel = (
    <div
      style={{
        width: isMobile ? "100%" : 380,
        flexShrink: 0,
        borderRight: isMobile ? "none" : "1px solid rgba(255,255,255,0.07)",
        display: "flex",
        flexDirection: "column",
        height: "100%",
        overflow: "hidden",
        position: "relative",
      }}
    >
      {/* List topbar */}
      <div
        style={{
          padding: "12px 16px 0",
          flexShrink: 0,
          borderBottom: "1px solid rgba(255,255,255,0.07)",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: 10,
          }}
        >
          <div>
            <div
              style={{
                fontSize: 14,
                fontWeight: 700,
                color: "rgba(255,255,255,0.88)",
                letterSpacing: "-0.2px",
              }}
            >
              Jobs for you
            </div>
            <div
              style={{
                fontSize: 11,
                color: "rgba(255,255,255,0.35)",
                marginTop: 2,
                fontFamily: "'DM Mono', monospace",
              }}
            >
              {isLoading
                ? "Loading…"
                : `${totalCount.toLocaleString()} role${totalCount !== 1 ? "s" : ""}${hasAnyFilter ? " · filtered" : ""}`}
            </div>
          </div>
          <button
            onClick={() => setShowFilters((v) => !v)}
            style={{
              fontSize: 11,
              fontWeight: 500,
              padding: "5px 10px",
              borderRadius: 4,
              border: `1px solid ${showFilters ? "rgba(27,170,193,0.30)" : "rgba(255,255,255,0.10)"}`,
              background: showFilters
                ? "rgba(27,170,193,0.08)"
                : "rgba(255,255,255,0.04)",
              color: showFilters ? "#1BAAC1" : "rgba(255,255,255,0.50)",
              cursor: "pointer",
              fontFamily: "inherit",
              display: "flex",
              alignItems: "center",
              gap: 5,
            }}
          >
            <svg
              width="10"
              height="10"
              viewBox="0 0 10 10"
              fill="none"
              aria-hidden="true"
            >
              <line
                x1="1"
                y1="3"
                x2="9"
                y2="3"
                stroke="currentColor"
                strokeWidth="1.3"
                strokeLinecap="round"
              />
              <line
                x1="2.5"
                y1="6"
                x2="7.5"
                y2="6"
                stroke="currentColor"
                strokeWidth="1.3"
                strokeLinecap="round"
              />
              <line
                x1="4"
                y1="9"
                x2="6"
                y2="9"
                stroke="currentColor"
                strokeWidth="1.3"
                strokeLinecap="round"
              />
            </svg>
            Filters{hasAnyFilter ? " ·" : ""}
          </button>
        </div>
      </div>

      {/* CV upload banner */}
      {!hasCvUploaded && !cvBannerDismissed && (
        <CvUploadBanner onDismiss={() => setCvBannerDismissed(true)} />
      )}

      {/* Collapsible filters */}
      {showFilters && (
        <FilterBar
          band={band}
          location={location}
          salaryMin={salaryMin}
          postedWithin={postedWithin}
          locationDraft={locationDraft}
          salaryDraft={salaryDraft}
          setLocationDraft={setLocationDraft}
          setSalaryDraft={setSalaryDraft}
          commitLocation={commitLocation}
          commitSalary={commitSalary}
          setFilter={setFilter}
          hasAnyFilter={hasAnyFilter}
          clearAll={clearAll}
        />
      )}

      {/* Scrollable job list */}
      <div
        style={{
          flex: 1,
          overflowY: "auto",
          paddingBottom: isPro ? 0 : 44,
        }}
      >
        {isLoading && (
          <div
            style={{
              padding: "40px 16px",
              textAlign: "center",
              color: "rgba(255,255,255,0.25)",
              fontSize: 13,
            }}
          >
            Loading…
          </div>
        )}

        {!isLoading && jobs.length === 0 && (
          <div
            style={{
              padding: "40px 16px",
              textAlign: "center",
              color: "rgba(255,255,255,0.28)",
              fontSize: 13,
            }}
          >
            {hasAnyFilter
              ? "No jobs match these filters."
              : "No matching jobs yet."}
          </div>
        )}

        {jobs.map((job) => (
          <JobCard
            key={job._id}
            job={job}
            isPro={isPro}
            isSaved={savedSet.has(job._id)}
            isSelected={selectedId === job._id}
            onSelect={() => selectJob(job._id)}
            onSave={() => void saveJobMutation({ jobId: job._id as Id<"jobs"> }).catch(() => {})}
            onUnsave={() => void unsaveJobMutation({ jobId: job._id as Id<"jobs"> }).catch(() => {})}
          />
        ))}

        {hasMore && !isLoading && (
          <div
            style={{
              padding: "12px 16px",
              textAlign: "center",
            }}
          >
            <button
              onClick={() => setLimit((l) => l + 40)}
              style={{
                fontSize: 11,
                fontWeight: 600,
                padding: "7px 18px",
                borderRadius: 0,
                border: "1px solid rgba(27,170,193,0.28)",
                background: "rgba(27,170,193,0.07)",
                color: "#1BAAC1",
                cursor: "pointer",
                fontFamily: "inherit",
              }}
            >
              Load more
            </button>
          </div>
        )}
      </div>

      {/* Free plan banner — pinned to bottom of list panel */}
      {!isPro && <FreePlanBanner />}
    </div>
  );

  // ── Desktop split-screen ──────────────────────────────────────────────────
  if (!isMobile) {
    return (
      <div
        style={{
          flex: 1,
          display: "flex",
          height: "100%",
          overflow: "hidden",
          fontFamily: "'Plus Jakarta Sans', sans-serif",
        }}
      >
        {listPanel}

        {/* Right panel */}
        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
          }}
        >
          {selectedId ? (
            <JobDetailPanel
              jobId={selectedId}
              isMobile={false}
              onBack={deselectJob}
            />
          ) : (
            <DetailPlaceholder />
          )}
        </div>
      </div>
    );
  }

  // ── Mobile: just the list ─────────────────────────────────────────────────
  return (
    <div
      style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        fontFamily: "'Plus Jakarta Sans', sans-serif",
      }}
    >
      {listPanel}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page export
// ---------------------------------------------------------------------------

export default function JobsPage() {
  return (
    <Suspense>
      <JobsFeed />
    </Suspense>
  );
}
