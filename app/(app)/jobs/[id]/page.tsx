"use client";

/**
 * Job detail page — /jobs/[id]
 *
 * Layout (two-column within scrollable main):
 *   Topbar  ← Back | job title @ company | Save  Apply →
 *   ─────────────────────────────────────────────────────────────────
 *   Left (2/3)          │  Right (1/3)
 *   ───────────────────  │  ────────────────────────
 *   Job header           │  CV generation panel
 *   About this role      │    idle / generating / success / error / rate-limited
 *   (full description)   │
 *                        │  Sponsorship score card
 *                        │    band pill always visible
 *                        │    signal breakdown (Pro only)
 *                        │    Upgrade CTA (free users)
 *                        │
 *                        │  Employer card
 *                        │    UKVI status, rating, route
 */

import { use, useState, useEffect, useRef, useCallback } from "react";
import { useQuery, useMutation, useAction } from "convex/react";
import { useRouter } from "next/navigation";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { CompanyLogo } from "@/components/CompanyLogo";
import { ScoreBand } from "@/components/ScoreBand";
import type { Band } from "@/components/ScoreBand";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatSalary(min?: number, max?: number): string | null {
  if (!min && !max) return null;
  const fmt = (n: number) =>
    n >= 1000 ? `£${Math.round(n / 1000).toLocaleString()}k` : `£${n}`;
  if (min && max) return `${fmt(min)} – ${fmt(max)}`;
  if (min) return `${fmt(min)}+`;
  if (max) return `Up to ${fmt(max)}`;
  return null;
}

function formatDate(ms: number): string {
  return new Date(ms).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

/** Strip HTML tags and normalise whitespace for plain-text display. */
function stripHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<\/li>/gi, "\n")
    .replace(/<li[^>]*>/gi, "• ")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

const SOURCE_LABELS: Record<string, string> = {
  reed:          "Reed",
  adzuna:        "Adzuna",
  nhs:           "NHS Jobs",
  civil_service: "Civil Service",
  jobs_ac:       "jobs.ac.uk",
};

const SIGNAL_LABELS: Record<string, string> = {
  explicit_jd_signal:         "Visa sponsorship mentioned in JD",
  sponsor_a_rating:           "Active UKVI sponsor register (A-rated)",
  sponsor_b_rating:           "Sponsor register (B-rated)",
  public_sector:              "Public sector employer",
  sponsor_on_register:        "On Sponsor Register (JD silent)",
  negative_jd_signal:         "JD states no visa sponsorship",
  not_on_register_no_signal:  "Not on UKVI Sponsor Register",
};

// ---------------------------------------------------------------------------
// CV generation state machine
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
// Section heading
// ---------------------------------------------------------------------------

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        fontFamily: "'DM Mono', monospace",
        fontSize: 9,
        fontWeight: 500,
        letterSpacing: "1.5px",
        textTransform: "uppercase",
        color: "rgba(255,255,255,0.40)",
        marginBottom: 12,
      }}
    >
      {children}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Signal row (score breakdown)
// ---------------------------------------------------------------------------

interface SignalRowProps {
  signal: string;
  weight: number;
  matched: boolean;
}

function SignalRow({ signal, weight, matched }: SignalRowProps) {
  const label = SIGNAL_LABELS[signal] ?? signal;
  const isPositive = weight > 0;

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "7px 0",
        borderBottom: "1px solid rgba(255,255,255,0.05)",
        opacity: matched ? 1 : 0.38,
      }}
    >
      <div
        style={{
          width: 16,
          height: 16,
          borderRadius: "50%",
          background: matched
            ? isPositive
              ? "rgba(74,222,128,0.15)"
              : "rgba(255,107,107,0.15)"
            : "rgba(255,255,255,0.06)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}
      >
        <svg width="8" height="8" viewBox="0 0 8 8" fill="none" aria-hidden="true">
          {matched ? (
            isPositive ? (
              <path d="M1.5 4l2 2 3-3" stroke="#4ade80" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
            ) : (
              <>
                <line x1="2" y1="2" x2="6" y2="6" stroke="#ff6b6b" strokeWidth="1.3" strokeLinecap="round" />
                <line x1="6" y1="2" x2="2" y2="6" stroke="#ff6b6b" strokeWidth="1.3" strokeLinecap="round" />
              </>
            )
          ) : (
            <line x1="2.5" y1="4" x2="5.5" y2="4" stroke="rgba(255,255,255,0.30)" strokeWidth="1.2" strokeLinecap="round" />
          )}
        </svg>
      </div>

      <span
        style={{
          flex: 1,
          fontSize: 12,
          color: matched ? "rgba(255,255,255,0.75)" : "rgba(255,255,255,0.38)",
        }}
      >
        {label}
      </span>

      <span
        style={{
          fontFamily: "'DM Mono', monospace",
          fontSize: 11,
          fontWeight: 700,
          color: matched
            ? isPositive
              ? "#4ade80"
              : "#ff6b6b"
            : "rgba(255,255,255,0.20)",
          flexShrink: 0,
        }}
      >
        {weight > 0 ? `+${weight}` : `${weight}`}
      </span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// CV generation panel
// ---------------------------------------------------------------------------

interface CvGenerationPanelProps {
  jobId: Id<"jobs">;
  companyName: string;
  isPro: boolean;
}

function CvGenerationPanel({ jobId, companyName, isPro }: CvGenerationPanelProps) {
  const [cvGenState, setCvGenState] = useState<CvGenState>({ status: "idle" });
  const [applicationId, setApplicationId] = useState<Id<"applications"> | null>(null);
  const stepTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const generateApplication = useAction(api.applications.generate.generateApplication);
  const buildCvDocx = useAction(api.applications.buildCvDocx.buildCvDocx);

  // Reactive download URLs — updates after buildCvDocx writes file IDs
  const downloadUrls = useQuery(
    api.applications.queries.getDownloadUrls,
    applicationId ? { applicationId } : "skip",
  );

  // Clean up interval on unmount
  useEffect(() => {
    return () => {
      if (stepTimerRef.current) clearInterval(stepTimerRef.current);
    };
  }, []);

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
    if (stepTimerRef.current) clearInterval(stepTimerRef.current);
    startProgressAnimation();

    try {
      const result = await generateApplication({ jobId });

      // Advance to final step while building docx
      if (stepTimerRef.current) clearInterval(stepTimerRef.current);
      setCvGenState({ status: "generating", step: PROGRESS_STEPS.length - 1 });

      await buildCvDocx({ applicationId: result.applicationId as Id<"applications"> });

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
        // Distinguish free vs pro based on isPro flag
        setCvGenState(isPro ? { status: "rate_limited_pro" } : { status: "rate_limited_free" });
      } else if (data?.code === "NO_CV_UPLOADED" || data?.message?.includes("no CV") || data?.message?.includes("cvFileId")) {
        setCvGenState({ status: "no_cv" });
      } else {
        setCvGenState({
          status: "error",
          message: data?.message ?? "Something went wrong. Please try again.",
        });
      }
    }
  }

  // ── Render states ────────────────────────────────────────────────────────

  const cardStyle: React.CSSProperties = {
    background: "rgba(255,255,255,0.02)",
    border: "1px solid rgba(255,255,255,0.07)",
    borderRadius: 8,
    padding: "16px 18px",
  };

  // Idle state
  if (cvGenState.status === "idle") {
    return (
      <div>
        <SectionHeading>Tailored CV</SectionHeading>
        <div style={cardStyle}>
          <div
            style={{
              fontSize: 12,
              color: "rgba(255,255,255,0.50)",
              lineHeight: 1.55,
              marginBottom: 14,
            }}
          >
            Generate a CV and cover letter tailored to this specific role at {companyName}.
          </div>
          <button
            onClick={handleGenerate}
            style={{
              width: "100%",
              fontSize: 12,
              fontWeight: 600,
              padding: "9px 14px",
              borderRadius: 0,
              border: "1px solid rgba(27,170,193,0.35)",
              background: "rgba(27,170,193,0.10)",
              color: "#1BAAC1",
              cursor: "pointer",
              fontFamily: "'Plus Jakarta Sans', sans-serif",
              textAlign: "center",
            }}
          >
            Generate tailored CV
          </button>
        </div>
      </div>
    );
  }

  // No CV uploaded state
  if (cvGenState.status === "no_cv") {
    return (
      <div>
        <SectionHeading>Tailored CV</SectionHeading>
        <div style={cardStyle}>
          <div
            style={{
              fontSize: 12,
              fontWeight: 600,
              color: "rgba(255,255,255,0.75)",
              marginBottom: 6,
            }}
          >
            Upload your CV first
          </div>
          <div
            style={{
              fontSize: 12,
              color: "rgba(255,255,255,0.45)",
              lineHeight: 1.55,
              marginBottom: 14,
            }}
          >
            To generate a tailored version, upload your current CV in settings first.
          </div>
          <a
            href="/onboarding"
            style={{
              display: "inline-flex",
              alignItems: "center",
              fontSize: 11,
              fontWeight: 600,
              padding: "7px 12px",
              borderRadius: 0,
              background: "#1BAAC1",
              color: "#0a2828",
              textDecoration: "none",
            }}
          >
            Upload CV →
          </a>
        </div>
      </div>
    );
  }

  // Generating state
  if (cvGenState.status === "generating") {
    const { step } = cvGenState;
    return (
      <div>
        <SectionHeading>Tailored CV</SectionHeading>
        <div style={cardStyle}>
          <div
            style={{
              fontFamily: "'DM Mono', monospace",
              fontSize: 10,
              letterSpacing: "1px",
              color: "#1BAAC1",
              marginBottom: 14,
              textTransform: "uppercase",
            }}
          >
            Generating…
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
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
                    opacity: isDone ? 0.55 : isActive ? 1 : 0.25,
                    transition: "opacity 0.3s",
                  }}
                >
                  {/* Step indicator */}
                  <div
                    style={{
                      width: 18,
                      height: 18,
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
                      border: `1px solid ${isDone ? "rgba(74,222,128,0.30)" : isActive ? "rgba(27,170,193,0.40)" : "rgba(255,255,255,0.10)"}`,
                    }}
                  >
                    {isDone ? (
                      <svg width="8" height="8" viewBox="0 0 8 8" fill="none" aria-hidden="true">
                        <path d="M1.5 4l2 2 3-3" stroke="#4ade80" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    ) : isActive ? (
                      <div
                        style={{
                          width: 6,
                          height: 6,
                          borderRadius: "50%",
                          background: "#1BAAC1",
                          animation: "pulse 1s ease-in-out infinite",
                        }}
                      />
                    ) : (
                      <div
                        style={{
                          width: 4,
                          height: 4,
                          borderRadius: "50%",
                          background: "rgba(255,255,255,0.20)",
                        }}
                      />
                    )}
                  </div>
                  <span
                    style={{
                      fontSize: 12,
                      color: isDone
                        ? "rgba(255,255,255,0.50)"
                        : isActive
                        ? "rgba(255,255,255,0.85)"
                        : "rgba(255,255,255,0.30)",
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
      </div>
    );
  }

  // Success / cached state
  if (cvGenState.status === "success") {
    const cvUrl = downloadUrls?.cvUrl ?? null;
    const coverLetterUrl = downloadUrls?.coverLetterUrl ?? null;

    return (
      <div>
        <SectionHeading>Tailored CV</SectionHeading>
        <div style={cardStyle}>
          {/* Header row */}
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
                  fontSize: 13,
                  fontWeight: 700,
                  color: "rgba(255,255,255,0.85)",
                  marginBottom: 2,
                }}
              >
                Your CV is ready.
              </div>
              <div style={{ fontSize: 11, color: "rgba(255,255,255,0.40)" }}>
                Review it before downloading.
              </div>
            </div>
            {cvGenState.fromCache && (
              <span
                style={{
                  fontFamily: "'DM Mono', monospace",
                  fontSize: 9,
                  letterSpacing: "1px",
                  textTransform: "uppercase",
                  color: "rgba(255,255,255,0.35)",
                  border: "1px solid rgba(255,255,255,0.12)",
                  borderRadius: 2,
                  padding: "2px 6px",
                  whiteSpace: "nowrap",
                }}
              >
                Cached
              </span>
            )}
          </div>

          {/* Download buttons */}
          <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 10 }}>
            {cvUrl ? (
              <a
                href={cvUrl}
                download
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 6,
                  fontSize: 12,
                  fontWeight: 600,
                  padding: "8px 14px",
                  borderRadius: 0,
                  background: "#1BAAC1",
                  color: "#0a2828",
                  textDecoration: "none",
                }}
              >
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
                  <path d="M6 1v7M3 5l3 3 3-3M2 10h8" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                Download CV (.docx)
              </a>
            ) : (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 12,
                  color: "rgba(255,255,255,0.35)",
                  padding: "8px 14px",
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
                  fontSize: 12,
                  fontWeight: 600,
                  padding: "8px 14px",
                  borderRadius: 0,
                  border: "1px solid rgba(27,170,193,0.30)",
                  background: "rgba(27,170,193,0.08)",
                  color: "#1BAAC1",
                  textDecoration: "none",
                }}
              >
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
                  <path d="M6 1v7M3 5l3 3 3-3M2 10h8" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                Download cover letter (.docx)
              </a>
            ) : (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 12,
                  color: "rgba(255,255,255,0.35)",
                  padding: "8px 14px",
                  border: "1px solid rgba(255,255,255,0.08)",
                }}
              >
                Preparing cover letter…
              </div>
            )}
          </div>

          {/* Regenerate */}
          <button
            onClick={handleGenerate}
            style={{
              width: "100%",
              fontSize: 11,
              fontWeight: 500,
              padding: "6px 14px",
              borderRadius: 0,
              border: "1px solid rgba(255,255,255,0.10)",
              background: "none",
              color: "rgba(255,255,255,0.40)",
              cursor: "pointer",
              fontFamily: "'Plus Jakarta Sans', sans-serif",
              textAlign: "center",
            }}
          >
            Regenerate
          </button>
        </div>
      </div>
    );
  }

  // Error state
  if (cvGenState.status === "error") {
    return (
      <div>
        <SectionHeading>Tailored CV</SectionHeading>
        <div style={cardStyle}>
          <div
            style={{
              fontSize: 12,
              fontWeight: 600,
              color: "rgba(255,107,107,0.85)",
              marginBottom: 6,
            }}
          >
            Generation failed
          </div>
          <div
            style={{
              fontSize: 12,
              color: "rgba(255,255,255,0.45)",
              lineHeight: 1.55,
              marginBottom: 14,
            }}
          >
            {cvGenState.message}
          </div>
          <button
            onClick={handleGenerate}
            style={{
              width: "100%",
              fontSize: 12,
              fontWeight: 600,
              padding: "9px 14px",
              borderRadius: 0,
              border: "1px solid rgba(27,170,193,0.35)",
              background: "rgba(27,170,193,0.10)",
              color: "#1BAAC1",
              cursor: "pointer",
              fontFamily: "'Plus Jakarta Sans', sans-serif",
              textAlign: "center",
            }}
          >
            Try again
          </button>
        </div>
      </div>
    );
  }

  // Rate limited — free plan
  if (cvGenState.status === "rate_limited_free") {
    return (
      <div>
        <SectionHeading>Tailored CV</SectionHeading>
        <div style={cardStyle}>
          <div
            style={{
              fontSize: 12,
              fontWeight: 600,
              color: "rgba(255,255,255,0.75)",
              marginBottom: 6,
            }}
          >
            Monthly limit reached
          </div>
          <div
            style={{
              fontSize: 12,
              color: "rgba(255,255,255,0.45)",
              lineHeight: 1.55,
              marginBottom: 14,
            }}
          >
            {"You've used your free CV this month. Upgrade to Pro for 20 per month, or buy a single credit."}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <a
              href="/settings/upgrade"
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 12,
                fontWeight: 600,
                padding: "8px 14px",
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
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 12,
                fontWeight: 600,
                padding: "8px 14px",
                borderRadius: 0,
                border: "1px solid rgba(27,170,193,0.30)",
                background: "rgba(27,170,193,0.08)",
                color: "#1BAAC1",
                textDecoration: "none",
              }}
            >
              Buy a single credit — £1.99
            </a>
          </div>
        </div>
      </div>
    );
  }

  // Rate limited — pro plan
  if (cvGenState.status === "rate_limited_pro") {
    return (
      <div>
        <SectionHeading>Tailored CV</SectionHeading>
        <div style={cardStyle}>
          <div
            style={{
              fontSize: 12,
              fontWeight: 600,
              color: "rgba(255,255,255,0.75)",
              marginBottom: 6,
            }}
          >
            Monthly limit reached
          </div>
          <div
            style={{
              fontSize: 12,
              color: "rgba(255,255,255,0.45)",
              lineHeight: 1.55,
              marginBottom: 14,
            }}
          >
            {"You've reached your 20 CV limit this month. It resets on the 1st. You can also buy a one-off credit."}
          </div>
          <a
            href="/settings/upgrade?plan=pay_per_cv"
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 12,
              fontWeight: 600,
              padding: "8px 14px",
              borderRadius: 0,
              border: "1px solid rgba(27,170,193,0.30)",
              background: "rgba(27,170,193,0.08)",
              color: "#1BAAC1",
              textDecoration: "none",
            }}
          >
            Buy a single credit — £1.99
          </a>
        </div>
      </div>
    );
  }

  return null;
}

// ---------------------------------------------------------------------------
// Apply confirmation modal
// ---------------------------------------------------------------------------

interface ApplyModalProps {
  company: string;
  applyUrl: string;
  onClose: () => void;
  onProceed: () => void;
}

function ApplyModal({ company, applyUrl, onClose, onProceed }: ApplyModalProps) {
  // Close on Escape
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
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
          Leaving Tino
        </div>
        <div
          style={{
            fontSize: 13,
            color: "rgba(255,255,255,0.50)",
            lineHeight: 1.6,
            marginBottom: 22,
          }}
        >
          This link goes to {company}&rsquo;s site. We don&rsquo;t control their application process.
          Log it in your tracker when you&rsquo;re done.
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button
            onClick={proceed}
            style={{
              flex: 1,
              fontSize: 12,
              fontWeight: 700,
              padding: "9px 16px",
              borderRadius: 0,
              background: "#1BAAC1",
              color: "#0a2828",
              border: "none",
              cursor: "pointer",
              fontFamily: "inherit",
              whiteSpace: "nowrap",
            }}
          >
            Continue to employer site →
          </button>
          <button
            onClick={onClose}
            style={{
              fontSize: 12,
              fontWeight: 600,
              padding: "9px 14px",
              borderRadius: 0,
              border: "1px solid rgba(255,255,255,0.14)",
              background: "none",
              color: "rgba(255,255,255,0.55)",
              cursor: "pointer",
              fontFamily: "inherit",
              whiteSpace: "nowrap",
            }}
          >
            Stay on Tino
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page inner (receives resolved id)
// ---------------------------------------------------------------------------

interface JobDetailInnerProps {
  id: string;
}

function JobDetailInner({ id }: JobDetailInnerProps) {
  const router = useRouter();
  const [pendingSave, setPendingSave] = useState(false);
  const [showUpgradePrompt, setShowUpgradePrompt] = useState(false);
  const [showApplyModal, setShowApplyModal] = useState(false);

  const result = useQuery(api.jobs.queries.getJobById, {
    id: id as Id<"jobs">,
  });

  const saveJobMutation = useMutation(api.applications.mutations.saveJob);
  const unsaveJobMutation = useMutation(api.applications.mutations.unsaveJob);
  const trackApplyMutation = useMutation(api.applications.mutations.trackApply);

  // Must be declared here (before any early returns) to satisfy Rules of Hooks.
  // Safe to call only when result is loaded — the modal that triggers it is
  // only rendered in the main path, after the null/undefined guards.
  const handleTrackApply = useCallback(() => {
    if (!result?.job) return;
    void trackApplyMutation({ jobId: result.job._id });
  }, [trackApplyMutation, result]);

  // Optimistic isSaved: flip immediately, real value follows from query
  const querySaved = result?.isSaved ?? false;
  const [optimisticSaved, setOptimisticSaved] = useState<boolean | null>(null);
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
    } catch (err: unknown) {
      setOptimisticSaved(!next);
      const code =
        err instanceof Error
          ? (err as { data?: { code?: string } }).data?.code
          : null;
      if (code === "UPGRADE_REQUIRED") {
        setShowUpgradePrompt(true);
      }
    } finally {
      setPendingSave(false);
    }
  }

  // ── States ───────────────────────────────────────────────────────────────

  if (result === undefined) {
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          height: "100%",
          color: "rgba(255,255,255,0.30)",
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
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          height: "100%",
          gap: 12,
          fontFamily: "'Plus Jakarta Sans', sans-serif",
        }}
      >
        <div style={{ fontSize: 14, color: "rgba(255,255,255,0.60)" }}>
          Job not found
        </div>
        <button
          onClick={() => router.push("/jobs")}
          style={{
            fontSize: 12,
            color: "#1BAAC1",
            background: "none",
            border: "none",
            cursor: "pointer",
            fontFamily: "inherit",
          }}
        >
          ← Back to jobs
        </button>
      </div>
    );
  }

  const { job, sponsor, isPro } = result;
  const applyUrl = job.sourceIds[0]?.applyUrl ?? "#";
  const salary = formatSalary(job.salaryMin, job.salaryMax);
  const sourceLabel = SOURCE_LABELS[job.sourceIds[0]?.source ?? ""] ?? "";
  const description = stripHtml(job.description);

  const sponsorRating = sponsor?.rating
    ? sponsor.rating.match(/[AB]-rat/i)?.[0]?.toUpperCase() ?? null
    : null;

  // ── Render ───────────────────────────────────────────────────────────────

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
      {/* ── Apply modal ─────────────────────────────────────────────────── */}
      {showApplyModal && (
        <ApplyModal
          company={job.company}
          applyUrl={applyUrl}
          onClose={() => setShowApplyModal(false)}
          onProceed={handleTrackApply}
        />
      )}

      {/* ── Topbar ──────────────────────────────────────────────────────── */}
      <div
        style={{
          height: 52,
          flexShrink: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 24px",
          borderBottom: "1px solid rgba(255,255,255,0.08)",
          gap: 16,
        }}
      >
        {/* Back + title */}
        <div style={{ display: "flex", alignItems: "center", gap: 14, minWidth: 0 }}>
          <button
            onClick={() => router.push("/jobs")}
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
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
              <path d="M9 3L5 7l4 4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Jobs
          </button>

          <div
            style={{
              width: 1,
              height: 14,
              background: "rgba(255,255,255,0.12)",
              flexShrink: 0,
            }}
          />

          <div style={{ minWidth: 0 }}>
            <div
              style={{
                fontSize: 13,
                fontWeight: 700,
                color: "rgba(255,255,255,0.90)",
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
                color: "rgba(255,255,255,0.40)",
                marginTop: 1,
              }}
            >
              {job.company}
            </div>
          </div>
        </div>

        {/* Action buttons */}
        <div style={{ display: "flex", gap: 6, alignItems: "center", flexShrink: 0 }}>
          <button
            onClick={handleSaveToggle}
            disabled={pendingSave}
            style={{
              fontSize: 11,
              fontWeight: 600,
              padding: "6px 12px",
              borderRadius: 0,
              border: `1px solid ${isSaved ? "rgba(74,222,128,0.30)" : "rgba(255,255,255,0.15)"}`,
              background: isSaved ? "rgba(74,222,128,0.08)" : "rgba(255,255,255,0.04)",
              color: isSaved ? "#4ade80" : "rgba(255,255,255,0.60)",
              cursor: pendingSave ? "default" : "pointer",
              fontFamily: "inherit",
              whiteSpace: "nowrap",
              opacity: pendingSave ? 0.6 : 1,
            }}
          >
            {pendingSave ? "…" : isSaved ? "Saved" : "Save"}
          </button>

          <button
            onClick={() => setShowApplyModal(true)}
            style={{
              fontSize: 11,
              fontWeight: 600,
              padding: "6px 12px",
              borderRadius: 0,
              background: "#1BAAC1",
              color: "#0a2828",
              border: "none",
              cursor: "pointer",
              fontFamily: "inherit",
              whiteSpace: "nowrap",
            }}
          >
            Apply →
          </button>
        </div>
      </div>

      {/* ── Scrollable body ─────────────────────────────────────────────── */}
      <div style={{ flex: 1, overflowY: "auto", padding: 24 }}>

        {/* Upgrade prompt — shown when free save limit is hit */}
        {showUpgradePrompt && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 12,
              background: "rgba(27,170,193,0.08)",
              border: "1px solid rgba(27,170,193,0.25)",
              borderRadius: 8,
              padding: "10px 14px",
              marginBottom: 16,
            }}
          >
            <div>
              <span style={{ fontSize: 13, fontWeight: 600, color: "rgba(255,255,255,0.85)" }}>
                Save limit reached
              </span>
              <span style={{ fontSize: 12, color: "rgba(255,255,255,0.50)", marginLeft: 8 }}>
                Free plan allows 3 saved jobs.
              </span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
              <a
                href="/pricing"
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  padding: "5px 10px",
                  borderRadius: 0,
                  background: "#1BAAC1",
                  color: "#0a2828",
                  textDecoration: "none",
                  whiteSpace: "nowrap",
                }}
              >
                Upgrade to Pro
              </a>
              <button
                onClick={() => setShowUpgradePrompt(false)}
                aria-label="Dismiss"
                style={{
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  color: "rgba(255,255,255,0.35)",
                  fontSize: 16,
                  lineHeight: 1,
                  padding: 0,
                }}
              >
                ×
              </button>
            </div>
          </div>
        )}

        {/* ── Job header card ───────────────────────────────────────────── */}
        <div
          style={{
            background: "rgba(255,255,255,0.03)",
            border: "1px solid rgba(255,255,255,0.08)",
            borderRadius: 10,
            padding: "20px 22px",
            display: "flex",
            alignItems: "flex-start",
            gap: 16,
            marginBottom: 20,
          }}
        >
          <CompanyLogo company={job.company} size={48} />

          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                marginBottom: 6,
                flexWrap: "wrap",
              }}
            >
              <h1
                style={{
                  fontSize: 20,
                  fontWeight: 700,
                  letterSpacing: "-0.4px",
                  color: "rgba(255,255,255,0.92)",
                  margin: 0,
                }}
              >
                {job.title}
              </h1>
              <ScoreBand
                band={job.sponsorshipBand as Band}
                score={job.sponsorshipScore}
                showScore={isPro}
              />
            </div>

            <div
              style={{
                fontSize: 13,
                color: "rgba(255,255,255,0.60)",
                marginBottom: 8,
              }}
            >
              {job.company} · {job.location}
            </div>

            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                flexWrap: "wrap",
              }}
            >
              {salary && (
                <span
                  style={{
                    fontFamily: "'DM Mono', monospace",
                    fontSize: 12,
                    color: "rgba(255,255,255,0.75)",
                  }}
                >
                  {salary}
                </span>
              )}
              {salary && <Dot />}
              <span style={{ fontSize: 12, color: "rgba(255,255,255,0.45)" }}>
                {job.isAgency ? "Agency posting" : "Direct hire"}
              </span>
              <Dot />
              <span style={{ fontSize: 12, color: "rgba(255,255,255,0.45)" }}>
                Posted {formatDate(job.postedAt)}
              </span>
              {sourceLabel && (
                <>
                  <Dot />
                  <span
                    style={{
                      fontFamily: "'DM Mono', monospace",
                      fontSize: 10,
                      letterSpacing: "0.5px",
                      color: "rgba(27,170,193,0.70)",
                      background: "rgba(27,170,193,0.08)",
                      border: "1px solid rgba(27,170,193,0.18)",
                      borderRadius: 3,
                      padding: "2px 6px",
                    }}
                  >
                    {sourceLabel}
                  </span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* ── Two-column layout ─────────────────────────────────────────── */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 340px",
            gap: 20,
            alignItems: "start",
          }}
        >
          {/* ── LEFT: Description ─────────────────────────────────────── */}
          <div>
            <SectionHeading>About this role</SectionHeading>
            <div
              style={{
                background: "rgba(255,255,255,0.02)",
                border: "1px solid rgba(255,255,255,0.07)",
                borderRadius: 8,
                padding: "20px 22px",
              }}
            >
              <pre
                style={{
                  margin: 0,
                  fontFamily: "'Plus Jakarta Sans', sans-serif",
                  fontSize: 13,
                  lineHeight: 1.75,
                  color: "rgba(255,255,255,0.65)",
                  whiteSpace: "pre-wrap",
                  wordBreak: "break-word",
                }}
              >
                {description}
              </pre>
            </div>
          </div>

          {/* ── RIGHT: CV panel + Score + Employer ───────────────────── */}
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>

            {/* CV generation panel */}
            <CvGenerationPanel
              jobId={job._id}
              companyName={job.company}
              isPro={isPro}
            />

            {/* Score card */}
            <div>
              <SectionHeading>Sponsorship score</SectionHeading>
              <div
                style={{
                  background: "rgba(255,255,255,0.02)",
                  border: "1px solid rgba(255,255,255,0.07)",
                  borderRadius: 8,
                  padding: "16px 18px",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    marginBottom: 14,
                  }}
                >
                  <ScoreBand
                    band={job.sponsorshipBand as Band}
                    score={job.sponsorshipScore}
                    showScore={isPro}
                  />
                  {isPro && (
                    <span
                      style={{
                        fontFamily: "'DM Mono', monospace",
                        fontSize: 22,
                        fontWeight: 700,
                        letterSpacing: "-1px",
                        color: "rgba(255,255,255,0.85)",
                      }}
                    >
                      {job.sponsorshipScore}
                    </span>
                  )}
                </div>

                {isPro ? (
                  <div>
                    {job.scoreBreakdown.map((s, i) => (
                      <SignalRow
                        key={i}
                        signal={s.signal}
                        weight={s.weight}
                        matched={s.matched}
                      />
                    ))}
                  </div>
                ) : (
                  <div
                    style={{
                      background: "rgba(27,170,193,0.06)",
                      border: "1px solid rgba(27,170,193,0.18)",
                      borderRadius: 6,
                      padding: "12px 14px",
                    }}
                  >
                    <div
                      style={{
                        fontSize: 12,
                        fontWeight: 600,
                        color: "rgba(255,255,255,0.75)",
                        marginBottom: 4,
                      }}
                    >
                      Full score breakdown
                    </div>
                    <div
                      style={{
                        fontSize: 11,
                        color: "rgba(255,255,255,0.45)",
                        lineHeight: 1.5,
                        marginBottom: 10,
                      }}
                    >
                      See exactly which signals affect this score — visa mentions, register status, salary signals, and more.
                    </div>
                    <a
                      href="/settings/upgrade"
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        fontSize: 11,
                        fontWeight: 600,
                        padding: "5px 10px",
                        borderRadius: 0,
                        background: "#1BAAC1",
                        color: "#0a2828",
                        textDecoration: "none",
                      }}
                    >
                      Upgrade to Pro →
                    </a>
                  </div>
                )}
              </div>
            </div>

            {/* Employer card */}
            <div>
              <SectionHeading>Employer</SectionHeading>
              <div
                style={{
                  background: "rgba(255,255,255,0.02)",
                  border: "1px solid rgba(255,255,255,0.07)",
                  borderRadius: 8,
                  padding: "16px 18px",
                  display: "flex",
                  flexDirection: "column",
                  gap: 12,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <CompanyLogo company={job.company} size={32} />
                  <div>
                    <div
                      style={{
                        fontSize: 13,
                        fontWeight: 700,
                        color: "rgba(255,255,255,0.85)",
                      }}
                    >
                      {job.company}
                    </div>
                    {job.isPublicSector && (
                      <div
                        style={{
                          fontSize: 10,
                          color: "rgba(255,255,255,0.40)",
                          marginTop: 1,
                        }}
                      >
                        Public sector
                      </div>
                    )}
                  </div>
                </div>

                <div style={{ height: 1, background: "rgba(255,255,255,0.06)" }} />

                <div>
                  <EmployerRow
                    label="UKVI Sponsor Register"
                    value={
                      sponsor ? (
                        <span style={{ color: "#4ade80", fontWeight: 600 }}>
                          Active
                        </span>
                      ) : (
                        <span style={{ color: "rgba(255,107,107,0.75)" }}>
                          Not listed
                        </span>
                      )
                    }
                  />
                  {sponsor && (
                    <>
                      {sponsorRating && (
                        <EmployerRow label="Rating" value={sponsorRating} />
                      )}
                      <EmployerRow label="Route" value={sponsor.route} />
                      {(sponsor.town ?? sponsor.county) && (
                        <EmployerRow
                          label="Registered location"
                          value={[sponsor.town, sponsor.county]
                            .filter(Boolean)
                            .join(", ")}
                        />
                      )}
                    </>
                  )}
                </div>

                {job.explicit !== undefined && (
                  <div
                    style={{
                      background: job.explicit
                        ? "rgba(74,222,128,0.08)"
                        : "rgba(255,107,107,0.07)",
                      border: `1px solid ${job.explicit ? "rgba(74,222,128,0.20)" : "rgba(255,107,107,0.18)"}`,
                      borderRadius: 6,
                      padding: "8px 10px",
                      fontSize: 11,
                      color: job.explicit ? "#4ade80" : "rgba(255,107,107,0.80)",
                      lineHeight: 1.4,
                    }}
                  >
                    {job.explicit
                      ? "Job description mentions visa sponsorship available"
                      : "Job description does not mention visa sponsorship"}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Small shared atoms
// ---------------------------------------------------------------------------

function Dot() {
  return (
    <span
      style={{
        width: 3,
        height: 3,
        borderRadius: "50%",
        background: "rgba(255,255,255,0.20)",
        display: "inline-block",
        flexShrink: 0,
      }}
    />
  );
}

interface EmployerRowProps {
  label: string;
  value: React.ReactNode;
}

function EmployerRow({ label, value }: EmployerRowProps) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "baseline",
        gap: 8,
        padding: "4px 0",
      }}
    >
      <span style={{ fontSize: 11, color: "rgba(255,255,255,0.40)" }}>
        {label}
      </span>
      <span
        style={{
          fontSize: 11,
          fontWeight: 500,
          color: "rgba(255,255,255,0.70)",
          textAlign: "right",
        }}
      >
        {value}
      </span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page export — unwraps async params (Next.js 15+)
// ---------------------------------------------------------------------------

export default function JobDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  return <JobDetailInner id={id} />;
}
