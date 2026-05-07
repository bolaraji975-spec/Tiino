"use client";

/**
 * Jobs feed page — shows active jobs filtered + ranked by the user's role
 * variations and sponsorship score.
 *
 * Route: /jobs  (linked from AppNav "Jobs feed")
 *
 * Layout:
 *   Topbar (title + count + search hint)
 *   Filter pills (band filter)
 *   Scrollable card list
 *   Load more button
 */

import { useQuery } from "convex/react";
import { useEffect, useRef, useState } from "react";
import { api } from "@/convex/_generated/api";
import { CompanyLogo } from "@/components/CompanyLogo";
import { ScoreBand } from "@/components/ScoreBand";
import type { Band } from "@/components/ScoreBand";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatSalary(min?: number, max?: number): string | null {
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

type BandFilter = "all" | "high" | "medium" | "low";

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
  sourceIds: { source: string; externalId: string; applyUrl: string }[];
}

// ---------------------------------------------------------------------------
// Job card
// ---------------------------------------------------------------------------

interface JobCardProps {
  job: JobDoc;
  isPro: boolean;
}

function JobCard({ job, isPro }: JobCardProps) {
  const applyUrl = job.sourceIds[0]?.applyUrl ?? "#";
  const salary = formatSalary(job.salaryMin, job.salaryMax);
  const age = relativeTime(job.postedAt);

  return (
    <div
      style={{
        background: "rgba(255,255,255,0.03)",
        border: "1px solid rgba(255,255,255,0.08)",
        borderRadius: 10,
        padding: "16px 18px",
        display: "flex",
        alignItems: "flex-start",
        gap: 14,
        transition: "border-color 0.15s",
        cursor: "default",
      }}
      onMouseEnter={(e) =>
        ((e.currentTarget as HTMLDivElement).style.borderColor =
          "rgba(27,170,193,0.25)")
      }
      onMouseLeave={(e) =>
        ((e.currentTarget as HTMLDivElement).style.borderColor =
          "rgba(255,255,255,0.08)")
      }
    >
      {/* Logo */}
      <CompanyLogo company={job.company} size={38} />

      {/* Body */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            marginBottom: 4,
            flexWrap: "wrap",
          }}
        >
          <span
            style={{
              fontSize: 14,
              fontWeight: 700,
              color: "rgba(255,255,255,0.90)",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {job.title}
          </span>
          <ScoreBand
            band={job.sponsorshipBand}
            score={job.sponsorshipScore}
            showScore={isPro}
          />
        </div>

        <div
          style={{
            fontSize: 12,
            color: "rgba(255,255,255,0.55)",
            marginBottom: 4,
          }}
        >
          {job.company} · {job.location} · {age}
        </div>

        <div style={{ fontSize: 12, color: "rgba(255,255,255,0.45)" }}>
          {[
            job.isAgency ? "Agency" : "Direct hire",
            salary,
          ]
            .filter(Boolean)
            .join(" · ")}
        </div>
      </div>

      {/* Actions */}
      <div
        style={{
          display: "flex",
          gap: 6,
          alignItems: "center",
          flexShrink: 0,
        }}
      >
        <a
          href={applyUrl}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: "inline-flex",
            alignItems: "center",
            fontSize: 11,
            fontWeight: 600,
            padding: "6px 11px",
            borderRadius: 0,
            background: "#1BAAC1",
            color: "#0a2828",
            textDecoration: "none",
            whiteSpace: "nowrap",
            flexShrink: 0,
          }}
        >
          Apply →
        </a>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Filter pill
// ---------------------------------------------------------------------------

interface PillProps {
  label: string;
  active: boolean;
  onClick: () => void;
}

function FilterPill({ label, active, onClick }: PillProps) {
  return (
    <button
      onClick={onClick}
      style={{
        fontSize: 12,
        fontWeight: 500,
        padding: "5px 12px",
        borderRadius: 20,
        border: `1px solid ${active ? "rgba(27,170,193,0.30)" : "rgba(255,255,255,0.12)"}`,
        background: active ? "rgba(27,170,193,0.10)" : "transparent",
        color: active ? "#1BAAC1" : "rgba(255,255,255,0.55)",
        cursor: "pointer",
        fontFamily: "inherit",
        whiteSpace: "nowrap",
        transition: "background 0.12s, border-color 0.12s, color 0.12s",
      }}
    >
      {label}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function JobsPage() {
  const [bandFilter, setBandFilter] = useState<BandFilter>("all");
  const [pageToLoad, setPageToLoad] = useState(0);
  const [feed, setFeed] = useState<JobDoc[]>([]);
  const lastPageLoaded = useRef(-1);

  const result = useQuery(api.jobs.queries.listForUser, {
    page: pageToLoad,
  });

  // Accumulate pages into local feed state
  useEffect(() => {
    if (!result) return;
    if (pageToLoad <= lastPageLoaded.current) return;
    lastPageLoaded.current = pageToLoad;
    setFeed((prev) =>
      pageToLoad === 0
        ? (result.jobs as JobDoc[])
        : [...prev, ...(result.jobs as JobDoc[])],
    );
  }, [result, pageToLoad]);

  // Client-side band filter (very_low hidden by default in "all" mode)
  const visibleJobs = feed.filter((j) => {
    if (bandFilter === "all") return j.sponsorshipBand !== "very_low";
    return j.sponsorshipBand === bandFilter;
  });

  const isPro: boolean = result?.isPro ?? false;
  const isLoading = result === undefined;
  const hasMore: boolean = result?.hasMore ?? false;
  const totalCount: number = result?.totalCount ?? 0;

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
          padding: "14px 24px",
          borderBottom: "1px solid rgba(255,255,255,0.08)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexShrink: 0,
        }}
      >
        <div>
          <div
            style={{
              fontSize: 15,
              fontWeight: 700,
              letterSpacing: "-0.3px",
              color: "rgba(255,255,255,0.90)",
            }}
          >
            Jobs for you
          </div>
          <div
            style={{
              fontSize: 11,
              color: "rgba(255,255,255,0.45)",
              marginTop: 2,
            }}
          >
            {isLoading
              ? "Loading…"
              : `${totalCount.toLocaleString()} verified sponsor role${totalCount !== 1 ? "s" : ""}`}
          </div>
        </div>

        {/* Pro badge */}
        {isPro && (
          <span
            style={{
              fontFamily: "'DM Mono', monospace",
              fontSize: 9,
              letterSpacing: "1.5px",
              textTransform: "uppercase",
              color: "#1BAAC1",
              border: "1px solid rgba(27,170,193,0.30)",
              padding: "2px 7px",
              borderRadius: 2,
            }}
          >
            Pro
          </span>
        )}
      </div>

      {/* ── Filter pills ────────────────────────────────────────────────── */}
      <div
        style={{
          padding: "10px 24px",
          borderBottom: "1px solid rgba(255,255,255,0.08)",
          display: "flex",
          gap: 6,
          flexWrap: "wrap",
          flexShrink: 0,
        }}
      >
        <FilterPill
          label="All roles"
          active={bandFilter === "all"}
          onClick={() => setBandFilter("all")}
        />
        <FilterPill
          label="High score"
          active={bandFilter === "high"}
          onClick={() => setBandFilter("high")}
        />
        <FilterPill
          label="Medium"
          active={bandFilter === "medium"}
          onClick={() => setBandFilter("medium")}
        />
        <FilterPill
          label="Low chance"
          active={bandFilter === "low"}
          onClick={() => setBandFilter("low")}
        />
      </div>

      {/* ── Job list ────────────────────────────────────────────────────── */}
      <div
        style={{
          flex: 1,
          overflowY: "auto",
          padding: "16px 24px 24px",
        }}
      >
        {isLoading && (
          <div
            style={{
              padding: "48px 0",
              textAlign: "center",
              color: "rgba(255,255,255,0.35)",
              fontSize: 13,
            }}
          >
            Loading jobs…
          </div>
        )}

        {!isLoading && visibleJobs.length === 0 && (
          <div
            style={{
              padding: "48px 0",
              textAlign: "center",
              color: "rgba(255,255,255,0.35)",
              fontSize: 13,
            }}
          >
            {bandFilter === "all"
              ? "No matching jobs yet. Complete your profile to see personalised results."
              : "No jobs in this band. Try a different filter."}
          </div>
        )}

        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {visibleJobs.map((job) => (
            <JobCard key={job._id} job={job} isPro={isPro} />
          ))}
        </div>

        {/* Load more */}
        {hasMore && !isLoading && (
          <div style={{ marginTop: 16, textAlign: "center" }}>
            <button
              onClick={() => setPageToLoad((p) => p + 1)}
              style={{
                fontSize: 12,
                fontWeight: 600,
                padding: "8px 20px",
                borderRadius: 0,
                border: "1px solid rgba(27,170,193,0.30)",
                background: "rgba(27,170,193,0.08)",
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
    </div>
  );
}
