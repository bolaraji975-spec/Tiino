"use client";

/**
 * Jobs feed page — shows active jobs filtered + ranked by the user's role
 * variations and sponsorship score.
 *
 * Route: /jobs  (linked from AppNav "Jobs feed")
 *
 * Filter state lives in URL search params (deep-linkable):
 *   ?band=high&location=London&salary=50000&posted=7d&source=nhs
 *
 * Layout:
 *   Topbar  (title + total count + Pro badge)
 *   Filter bar  (location input, salary input, posted select, source select, clear)
 *   Band pills  (All / High / Medium / Low)
 *   Scrollable card list + Load more
 */

import { useQuery } from "convex/react";
import { useEffect, useRef, useState, Suspense } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
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

type BandParam = "high" | "medium" | "low" | "very_low";
type PostedParam = "24h" | "7d" | "30d";
type SourceParam = "nhs" | "civil_service" | "jobs_ac" | "private";

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
// Shared inline style constants
// ---------------------------------------------------------------------------

const INPUT_WRAP: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 7,
  background: "rgba(255,255,255,0.04)",
  border: "1px solid rgba(255,255,255,0.10)",
  borderRadius: 6,
  padding: "6px 10px",
  flexShrink: 0,
};

const INPUT_BASE: React.CSSProperties = {
  background: "none",
  border: "none",
  outline: "none",
  fontSize: 12,
  color: "rgba(255,255,255,0.75)",
  fontFamily: "'Plus Jakarta Sans', sans-serif",
};

const SELECT_BASE: React.CSSProperties = {
  appearance: "none",
  WebkitAppearance: "none",
  background: "rgba(255,255,255,0.04)",
  border: "1px solid rgba(255,255,255,0.10)",
  borderRadius: 6,
  padding: "6px 28px 6px 10px",
  fontSize: 12,
  color: "rgba(255,255,255,0.75)",
  fontFamily: "'Plus Jakarta Sans', sans-serif",
  cursor: "pointer",
  outline: "none",
  flexShrink: 0,
};

// ---------------------------------------------------------------------------
// Small icon helpers (inline SVG — no package)
// ---------------------------------------------------------------------------

function IconLocation() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true" style={{ flexShrink: 0 }}>
      <circle cx="6" cy="5" r="2" stroke="rgba(255,255,255,0.35)" strokeWidth="1.2" />
      <path d="M6 1C3.79 1 2 2.79 2 5c0 3 4 7 4 7s4-4 4-7c0-2.21-1.79-4-4-4z" stroke="rgba(255,255,255,0.35)" strokeWidth="1.2" fill="none" />
    </svg>
  );
}

function IconChevron() {
  return (
    <svg
      width="10" height="10" viewBox="0 0 10 10" fill="none"
      aria-hidden="true"
      style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }}
    >
      <path d="M2 3.5l3 3 3-3" stroke="rgba(255,255,255,0.40)" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
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
      }}
      onMouseEnter={(e) =>
        ((e.currentTarget as HTMLDivElement).style.borderColor = "rgba(27,170,193,0.25)")
      }
      onMouseLeave={(e) =>
        ((e.currentTarget as HTMLDivElement).style.borderColor = "rgba(255,255,255,0.08)")
      }
    >
      <CompanyLogo company={job.company} size={38} />

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4, flexWrap: "wrap" }}>
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
          <ScoreBand band={job.sponsorshipBand} score={job.sponsorshipScore} showScore={isPro} />
        </div>

        <div style={{ fontSize: 12, color: "rgba(255,255,255,0.55)", marginBottom: 4 }}>
          {job.company} · {job.location} · {age}
        </div>

        <div style={{ fontSize: 12, color: "rgba(255,255,255,0.40)" }}>
          {[job.isAgency ? "Agency" : "Direct hire", salary].filter(Boolean).join(" · ")}
        </div>
      </div>

      <div style={{ display: "flex", gap: 6, alignItems: "center", flexShrink: 0 }}>
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
// Band pill
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
        fontSize: 11,
        fontWeight: 500,
        padding: "5px 12px",
        borderRadius: 100,
        border: `1px solid ${active ? "rgba(27,170,193,0.30)" : "rgba(255,255,255,0.12)"}`,
        background: active ? "rgba(27,170,193,0.10)" : "none",
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
// Inner feed (uses useSearchParams — must be inside Suspense)
// ---------------------------------------------------------------------------

function JobsFeed() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  // ── Read filter params from URL ──────────────────────────────────────────
  const band = (searchParams.get("band") as BandParam | null) ?? null;
  const location = searchParams.get("location") ?? "";
  const salaryMin = searchParams.get("salary")
    ? Number(searchParams.get("salary"))
    : undefined;
  const postedWithin = (searchParams.get("posted") as PostedParam | null) ?? null;
  const source = (searchParams.get("source") as SourceParam | null) ?? null;

  // Draft state for text inputs — committed to URL on blur/Enter
  const [locationDraft, setLocationDraft] = useState(location);
  const [salaryDraft, setSalaryDraft] = useState(
    salaryMin !== undefined ? String(salaryMin) : "",
  );

  // ── Limit — reset whenever any filter changes ────────────────────────────
  const [limit, setLimit] = useState(20);
  const filterKey = [band, location, salaryMin, postedWithin, source].join("|");
  const prevFilterKey = useRef(filterKey);

  useEffect(() => {
    if (filterKey === prevFilterKey.current) return;
    prevFilterKey.current = filterKey;
    setLimit(20);
  }, [filterKey]);

  // ── Convex query ─────────────────────────────────────────────────────────
  const result = useQuery(api.jobs.queries.listForUser, {
    limit,
    band: band ?? undefined,
    location: location || undefined,
    salaryMin,
    postedWithin: postedWithin ?? undefined,
    source: source ?? undefined,
  });

  const isPro: boolean = result?.isPro ?? false;
  const isLoading = result === undefined;
  const hasMore: boolean = result?.hasMore ?? false;
  const totalCount: number = result?.totalCount ?? 0;
  const jobs = (result?.jobs ?? []) as JobDoc[];

  // ── Filter helpers ───────────────────────────────────────────────────────
  function setFilter(key: string, value: string | null) {
    const params = new URLSearchParams(searchParams.toString());
    if (!value) {
      params.delete(key);
    } else {
      params.set(key, value);
    }
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
    !!band || !!location || salaryMin !== undefined || !!postedWithin || !!source;

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
      {/* ── Topbar ────────────────────────────────────────────────────── */}
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
          <div style={{ fontSize: 11, color: "rgba(255,255,255,0.40)", marginTop: 2 }}>
            {isLoading
              ? "Loading…"
              : `${totalCount.toLocaleString()} verified sponsor role${totalCount !== 1 ? "s" : ""}${hasAnyFilter ? " · filtered" : ""}`}
          </div>
        </div>

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

      {/* ── Filter bar ────────────────────────────────────────────────── */}
      <div
        style={{
          padding: "10px 24px",
          borderBottom: "1px solid rgba(255,255,255,0.08)",
          display: "flex",
          alignItems: "center",
          gap: 8,
          flexWrap: "wrap",
          flexShrink: 0,
        }}
      >
        {/* Location input */}
        <div style={{ ...INPUT_WRAP, flex: "1 1 150px", maxWidth: 220 }}>
          <IconLocation />
          <input
            type="text"
            placeholder="Location"
            value={locationDraft}
            onChange={(e) => setLocationDraft(e.target.value)}
            onBlur={commitLocation}
            onKeyDown={(e) => e.key === "Enter" && commitLocation()}
            style={{ ...INPUT_BASE, width: "100%", minWidth: 0 }}
          />
          {locationDraft && (
            <button
              onClick={() => { setLocationDraft(""); setFilter("location", null); }}
              aria-label="Clear location"
              style={{ background: "none", border: "none", cursor: "pointer", color: "rgba(255,255,255,0.30)", fontSize: 14, lineHeight: 1, padding: 0, flexShrink: 0 }}
            >
              ×
            </button>
          )}
        </div>

        {/* Salary input */}
        <div style={{ ...INPUT_WRAP, flex: "0 0 auto" }}>
          <span
            style={{
              fontSize: 11,
              fontFamily: "'DM Mono', monospace",
              color: salaryDraft ? "rgba(27,170,193,0.80)" : "rgba(255,255,255,0.30)",
              flexShrink: 0,
            }}
          >
            £
          </span>
          <input
            type="text"
            inputMode="numeric"
            placeholder="Min salary"
            value={salaryDraft}
            onChange={(e) => setSalaryDraft(e.target.value.replace(/[^0-9,]/g, ""))}
            onBlur={commitSalary}
            onKeyDown={(e) => e.key === "Enter" && commitSalary()}
            style={{ ...INPUT_BASE, width: 88 }}
          />
          {salaryDraft && (
            <button
              onClick={() => { setSalaryDraft(""); setFilter("salary", null); }}
              aria-label="Clear salary"
              style={{ background: "none", border: "none", cursor: "pointer", color: "rgba(255,255,255,0.30)", fontSize: 14, lineHeight: 1, padding: 0, flexShrink: 0 }}
            >
              ×
            </button>
          )}
        </div>

        {/* Posted within select */}
        <div style={{ position: "relative", flexShrink: 0 }}>
          <select
            value={postedWithin ?? "any"}
            onChange={(e) =>
              setFilter("posted", e.target.value === "any" ? null : e.target.value)
            }
            style={{
              ...SELECT_BASE,
              color: postedWithin ? "#1BAAC1" : "rgba(255,255,255,0.55)",
              borderColor: postedWithin
                ? "rgba(27,170,193,0.30)"
                : "rgba(255,255,255,0.10)",
              background: postedWithin
                ? "rgba(27,170,193,0.08)"
                : "rgba(255,255,255,0.04)",
            }}
          >
            <option value="any">Any time</option>
            <option value="24h">Last 24h</option>
            <option value="7d">Last 7 days</option>
            <option value="30d">Last 30 days</option>
          </select>
          <IconChevron />
        </div>

        {/* Source select */}
        <div style={{ position: "relative", flexShrink: 0 }}>
          <select
            value={source ?? "all"}
            onChange={(e) =>
              setFilter("source", e.target.value === "all" ? null : e.target.value)
            }
            style={{
              ...SELECT_BASE,
              color: source ? "#1BAAC1" : "rgba(255,255,255,0.55)",
              borderColor: source
                ? "rgba(27,170,193,0.30)"
                : "rgba(255,255,255,0.10)",
              background: source
                ? "rgba(27,170,193,0.08)"
                : "rgba(255,255,255,0.04)",
            }}
          >
            <option value="all">All sources</option>
            <option value="nhs">NHS</option>
            <option value="civil_service">Civil Service</option>
            <option value="jobs_ac">Universities</option>
            <option value="private">Private sector</option>
          </select>
          <IconChevron />
        </div>

        {/* Clear all filters */}
        {hasAnyFilter && (
          <button
            onClick={() => {
              setLocationDraft("");
              setSalaryDraft("");
              router.push(pathname);
            }}
            style={{
              fontSize: 11,
              fontWeight: 500,
              padding: "6px 12px",
              borderRadius: 6,
              border: "1px solid rgba(255,107,107,0.25)",
              background: "rgba(255,107,107,0.07)",
              color: "rgba(255,107,107,0.75)",
              cursor: "pointer",
              fontFamily: "inherit",
              whiteSpace: "nowrap",
              flexShrink: 0,
            }}
          >
            Clear filters
          </button>
        )}
      </div>

      {/* ── Band pills ────────────────────────────────────────────────── */}
      <div
        style={{
          padding: "8px 24px",
          borderBottom: "1px solid rgba(255,255,255,0.08)",
          display: "flex",
          gap: 6,
          flexWrap: "wrap",
          flexShrink: 0,
        }}
      >
        <FilterPill
          label="All roles"
          active={!band}
          onClick={() => setFilter("band", null)}
        />
        <FilterPill
          label="High score"
          active={band === "high"}
          onClick={() => setFilter("band", "high")}
        />
        <FilterPill
          label="Medium"
          active={band === "medium"}
          onClick={() => setFilter("band", "medium")}
        />
        <FilterPill
          label="Low chance"
          active={band === "low"}
          onClick={() => setFilter("band", "low")}
        />
      </div>

      {/* ── Job list ──────────────────────────────────────────────────── */}
      <div style={{ flex: 1, overflowY: "auto", padding: "16px 24px 24px" }}>
        {isLoading && (
          <div
            style={{
              padding: "48px 0",
              textAlign: "center",
              color: "rgba(255,255,255,0.30)",
              fontSize: 13,
            }}
          >
            Loading jobs…
          </div>
        )}

        {!isLoading && jobs.length === 0 && (
          <div
            style={{
              padding: "48px 0",
              textAlign: "center",
              color: "rgba(255,255,255,0.30)",
              fontSize: 13,
            }}
          >
            {hasAnyFilter
              ? "No jobs match these filters. Try adjusting or clearing them."
              : "No matching jobs yet. Complete your profile to see personalised results."}
          </div>
        )}

        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {jobs.map((job) => (
            <JobCard key={job._id} job={job} isPro={isPro} />
          ))}
        </div>

        {hasMore && !isLoading && (
          <div style={{ marginTop: 16, textAlign: "center" }}>
            <button
              onClick={() => setLimit((l) => l + 20)}
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

// ---------------------------------------------------------------------------
// Page export — wraps JobsFeed in Suspense (required for useSearchParams)
// ---------------------------------------------------------------------------

export default function JobsPage() {
  return (
    <Suspense>
      <JobsFeed />
    </Suspense>
  );
}
