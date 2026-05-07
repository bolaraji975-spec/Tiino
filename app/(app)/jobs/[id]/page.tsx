"use client";

/**
 * Job detail page — /jobs/[id]
 *
 * Layout (two-column within scrollable main):
 *   Topbar  ← Back | job title @ company | Save  Generate CV  Apply →
 *   ─────────────────────────────────────────────────────────────────
 *   Left (2/3)          │  Right (1/3)
 *   ───────────────────  │  ────────────────────────
 *   Job header           │  Sponsorship score card
 *   About this role      │    band pill always visible
 *   (full description)   │    signal breakdown (Pro only)
 *                        │    Upgrade CTA (free users)
 *                        │
 *                        │  Employer card
 *                        │    UKVI status, rating, route
 */

import { use } from "react";
import { useQuery, useMutation } from "convex/react";
import { useRouter } from "next/navigation";
import { useState } from "react";
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
      {/* Tick / cross */}
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
// Page inner (receives resolved id)
// ---------------------------------------------------------------------------

interface JobDetailInnerProps {
  id: string;
}

function JobDetailInner({ id }: JobDetailInnerProps) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);

  const result = useQuery(api.jobs.queries.getJobById, {
    id: id as Id<"jobs">,
  });

  const saveJobMutation = useMutation(api.applications.mutations.saveJob);

  async function handleSave() {
    if (!result?.job || saving) return;
    setSaving(true);
    try {
      await saveJobMutation({ jobId: result.job._id });
    } finally {
      setSaving(false);
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

  const { job, sponsor, isPro, isSaved } = result;
  const applyUrl = job.sourceIds[0]?.applyUrl ?? "#";
  const salary = formatSalary(job.salaryMin, job.salaryMax);
  const sourceLabel = SOURCE_LABELS[job.sourceIds[0]?.source ?? ""] ?? "";
  const description = stripHtml(job.description);

  // Sponsor rating short form: extract "A-rated" or "B-rated"
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
            onClick={handleSave}
            disabled={isSaved || saving}
            style={{
              fontSize: 11,
              fontWeight: 600,
              padding: "6px 12px",
              borderRadius: 0,
              border: `1px solid ${isSaved ? "rgba(74,222,128,0.30)" : "rgba(255,255,255,0.15)"}`,
              background: isSaved ? "rgba(74,222,128,0.08)" : "rgba(255,255,255,0.04)",
              color: isSaved ? "#4ade80" : "rgba(255,255,255,0.60)",
              cursor: isSaved ? "default" : "pointer",
              fontFamily: "inherit",
              whiteSpace: "nowrap",
            }}
          >
            {isSaved ? "Saved" : saving ? "Saving…" : "Save"}
          </button>

          <a
            href={`/applications/new?jobId=${job._id}`}
            style={{
              display: "inline-flex",
              alignItems: "center",
              fontSize: 11,
              fontWeight: 600,
              padding: "6px 12px",
              borderRadius: 0,
              border: "1px solid rgba(27,170,193,0.30)",
              background: "rgba(27,170,193,0.08)",
              color: "#1BAAC1",
              textDecoration: "none",
              whiteSpace: "nowrap",
            }}
          >
            Generate tailored CV
          </a>

          <a
            href={applyUrl}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: "inline-flex",
              alignItems: "center",
              fontSize: 11,
              fontWeight: 600,
              padding: "6px 12px",
              borderRadius: 0,
              background: "#1BAAC1",
              color: "#0a2828",
              textDecoration: "none",
              whiteSpace: "nowrap",
            }}
          >
            Apply →
          </a>
        </div>
      </div>

      {/* ── Scrollable body ─────────────────────────────────────────────── */}
      <div style={{ flex: 1, overflowY: "auto", padding: 24 }}>

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

          {/* ── RIGHT: Score + Employer ───────────────────────────────── */}
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

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
                {/* Band pill + numeric score */}
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

                {/* Signal breakdown — Pro only */}
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
                {/* Company name row */}
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

                <div
                  style={{
                    height: 1,
                    background: "rgba(255,255,255,0.06)",
                  }}
                />

                {/* UKVI status */}
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

                {/* Explicit sponsorship signal */}
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
