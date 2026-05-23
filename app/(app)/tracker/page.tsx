"use client";

/**
 * Application History — /tracker
 *
 * Simple list view showing everything Tino knows about the user's activity.
 * Status is updated automatically:
 *   Job saved      → Saved   (grey)
 *   CV generated   → CV Ready (blue)
 *   Apply clicked  → Applied  (teal)
 *   Job expired    → Expired  (red)
 *
 * Layout:
 *   Topbar  (heading + stats + filter tabs)
 *   Scrollable table  (logo, title, company, location, status, date, salary)
 *   Empty state
 */

import { useQuery, useMutation } from "convex/react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import Link from "next/link";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { CompanyLogo } from "@/components/CompanyLogo";
import type { DisplayStatus } from "@/convex/applications/queries";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type AppRecord = NonNullable<
  ReturnType<typeof useQuery<typeof api.applications.queries.listForUser>>
>[number];

type FilterTab = "all" | DisplayStatus;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatSalary(min: number | null, max: number | null): string | null {
  if (!min && !max) return null;
  const fmt = (n: number) =>
    n >= 1000 ? `£${Math.round(n / 1000)}k` : `£${n}`;
  if (min && max) return `${fmt(min)} – ${fmt(max)}`;
  if (min) return `${fmt(min)}+`;
  if (max) return `Up to ${fmt(max)}`;
  return null;
}

function formatDate(ms: number): string {
  const now = Date.now();
  const diff = now - ms;
  const days = Math.floor(diff / 86_400_000);

  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days}d ago`;

  return new Date(ms).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: days > 365 ? "numeric" : undefined,
  });
}

// ---------------------------------------------------------------------------
// Status badge
// ---------------------------------------------------------------------------

const STATUS_CONFIG: Record<
  DisplayStatus,
  { label: string; color: string; bg: string; border: string }
> = {
  saved: {
    label: "Saved",
    color: "rgba(255,255,255,0.60)",
    bg: "rgba(255,255,255,0.05)",
    border: "rgba(255,255,255,0.12)",
  },
  cv_ready: {
    label: "CV Ready",
    color: "rgba(96,165,250,0.90)",
    bg: "rgba(96,165,250,0.08)",
    border: "rgba(96,165,250,0.25)",
  },
  applied: {
    label: "Applied",
    color: "#1BAAC1",
    bg: "rgba(27,170,193,0.10)",
    border: "rgba(27,170,193,0.28)",
  },
  expired: {
    label: "Expired",
    color: "rgba(248,113,113,0.80)",
    bg: "rgba(248,113,113,0.08)",
    border: "rgba(248,113,113,0.22)",
  },
};

function StatusBadge({ status }: { status: DisplayStatus }) {
  const cfg = STATUS_CONFIG[status];
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        fontFamily: "'DM Mono', monospace",
        fontSize: 10,
        fontWeight: 600,
        letterSpacing: "0.8px",
        textTransform: "uppercase",
        color: cfg.color,
        background: cfg.bg,
        border: `1px solid ${cfg.border}`,
        borderRadius: 3,
        padding: "3px 8px",
        whiteSpace: "nowrap",
      }}
    >
      {cfg.label}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Stat card
// ---------------------------------------------------------------------------

function StatCard({
  value,
  label,
  dim,
}: {
  value: string;
  label: string;
  dim?: boolean;
}) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 3,
      }}
    >
      <span
        style={{
          fontFamily: "'DM Mono', monospace",
          fontSize: 20,
          fontWeight: 700,
          color: dim ? "rgba(255,255,255,0.30)" : "rgba(255,255,255,0.90)",
          lineHeight: 1,
        }}
      >
        {value}
      </span>
      <span
        style={{
          fontFamily: "'DM Mono', monospace",
          fontSize: 10,
          color: "rgba(255,255,255,0.35)",
          textTransform: "uppercase",
          letterSpacing: "1px",
        }}
      >
        {label}
      </span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Filter tab
// ---------------------------------------------------------------------------

function Tab({
  label,
  count,
  active,
  onClick,
}: {
  label: string;
  count: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 6,
        fontSize: 12,
        fontWeight: active ? 600 : 400,
        color: active ? "rgba(255,255,255,0.90)" : "rgba(255,255,255,0.45)",
        background: "none",
        border: "none",
        borderBottom: active
          ? "2px solid #1BAAC1"
          : "2px solid transparent",
        padding: "6px 4px",
        cursor: "pointer",
        fontFamily: "inherit",
        whiteSpace: "nowrap",
        transition: "color 0.12s, border-color 0.12s",
      }}
    >
      {label}
      {count > 0 && (
        <span
          style={{
            fontFamily: "'DM Mono', monospace",
            fontSize: 10,
            color: active ? "#1BAAC1" : "rgba(255,255,255,0.30)",
            background: active
              ? "rgba(27,170,193,0.12)"
              : "rgba(255,255,255,0.06)",
            borderRadius: 10,
            padding: "1px 6px",
          }}
        >
          {count}
        </span>
      )}
    </button>
  );
}

// ---------------------------------------------------------------------------
// History row
// ---------------------------------------------------------------------------

interface HistoryRowProps {
  app: AppRecord;
  onRemove: (id: Id<"applications">) => void;
}

function HistoryRow({ app, onRemove }: HistoryRowProps) {
  const router = useRouter();
  const salary = formatSalary(app.salaryMin, app.salaryMax);
  const date = formatDate(app.lastActivityAt);
  const [removing, setRemoving] = useState(false);

  async function handleRemove(e: React.MouseEvent) {
    e.stopPropagation();
    setRemoving(true);
    onRemove(app._id as Id<"applications">);
  }

  return (
    <div
      onClick={() => router.push(`/jobs/${app.jobId}`)}
      style={{
        display: "grid",
        gridTemplateColumns: "40px 1fr 140px 100px 80px auto",
        alignItems: "center",
        gap: 16,
        padding: "12px 20px",
        borderBottom: "1px solid rgba(255,255,255,0.05)",
        cursor: "pointer",
        transition: "background 0.12s",
      }}
      onMouseEnter={(e) =>
        ((e.currentTarget as HTMLDivElement).style.background =
          "rgba(27,170,193,0.04)")
      }
      onMouseLeave={(e) =>
        ((e.currentTarget as HTMLDivElement).style.background = "transparent")
      }
    >
      {/* Logo */}
      <div style={{ flexShrink: 0 }}>
        <CompanyLogo company={app.company} size={32} />
      </div>

      {/* Title + company + location */}
      <div style={{ minWidth: 0 }}>
        <div
          style={{
            fontSize: 13,
            fontWeight: 600,
            color: "rgba(255,255,255,0.88)",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            marginBottom: 2,
          }}
        >
          {app.jobTitle}
        </div>
        <div
          style={{
            fontSize: 11,
            color: "rgba(255,255,255,0.42)",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {app.company}
          {app.location ? ` · ${app.location}` : ""}
        </div>
      </div>

      {/* Status badge */}
      <div>
        <StatusBadge status={app.displayStatus} />
      </div>

      {/* Date of last action */}
      <div
        style={{
          fontFamily: "'DM Mono', monospace",
          fontSize: 11,
          color: "rgba(255,255,255,0.38)",
          whiteSpace: "nowrap",
        }}
      >
        {date}
      </div>

      {/* Salary */}
      <div
        style={{
          fontFamily: "'DM Mono', monospace",
          fontSize: 11,
          color: "rgba(255,255,255,0.42)",
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
        }}
      >
        {salary ?? "—"}
      </div>

      {/* Remove button */}
      <div onClick={(e) => e.stopPropagation()}>
        <button
          onClick={handleRemove}
          disabled={removing}
          aria-label="Remove from history"
          title="Remove from history"
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            width: 26,
            height: 26,
            background: "none",
            border: "1px solid rgba(255,255,255,0.09)",
            borderRadius: 0,
            cursor: removing ? "default" : "pointer",
            color: "rgba(255,255,255,0.28)",
            opacity: removing ? 0.4 : 1,
            transition: "color 0.12s, border-color 0.12s",
            padding: 0,
          }}
          onMouseEnter={(e) => {
            if (!removing) {
              (e.currentTarget as HTMLButtonElement).style.color =
                "rgba(248,113,113,0.75)";
              (e.currentTarget as HTMLButtonElement).style.borderColor =
                "rgba(248,113,113,0.30)";
            }
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLButtonElement).style.color =
              "rgba(255,255,255,0.28)";
            (e.currentTarget as HTMLButtonElement).style.borderColor =
              "rgba(255,255,255,0.09)";
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
              x1="1.5"
              y1="1.5"
              x2="8.5"
              y2="8.5"
              stroke="currentColor"
              strokeWidth="1.4"
              strokeLinecap="round"
            />
            <line
              x1="8.5"
              y1="1.5"
              x2="1.5"
              y2="8.5"
              stroke="currentColor"
              strokeWidth="1.4"
              strokeLinecap="round"
            />
          </svg>
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Table header
// ---------------------------------------------------------------------------

function TableHeader() {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "40px 1fr 140px 100px 80px auto",
        alignItems: "center",
        gap: 16,
        padding: "8px 20px",
        borderBottom: "1px solid rgba(255,255,255,0.08)",
      }}
    >
      {["", "Role", "Status", "Last activity", "Salary", ""].map(
        (col, i) => (
          <span
            key={i}
            style={{
              fontFamily: "'DM Mono', monospace",
              fontSize: 9,
              fontWeight: 500,
              letterSpacing: "1.4px",
              textTransform: "uppercase",
              color: "rgba(255,255,255,0.28)",
            }}
          >
            {col}
          </span>
        ),
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function TrackerPage() {
  const applications = useQuery(api.applications.queries.listForUser);
  const removeApplication = useMutation(
    api.applications.mutations.removeApplication,
  );

  const [activeTab, setActiveTab] = useState<FilterTab>("all");

  // ── Loading ──────────────────────────────────────────────────────────────
  if (applications === undefined) {
    return (
      <div
        style={{
          flex: 1,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "rgba(255,255,255,0.30)",
          fontSize: 13,
          fontFamily: "'Plus Jakarta Sans', sans-serif",
        }}
      >
        Loading…
      </div>
    );
  }

  // ── Empty state ──────────────────────────────────────────────────────────
  if (applications.length === 0) {
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
            marginBottom: 16,
          }}
        >
          Application history
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
          No applications yet.
        </h1>
        <p
          style={{
            fontSize: 14,
            color: "rgba(255,255,255,0.42)",
            maxWidth: 360,
            lineHeight: 1.65,
            margin: "0 0 28px",
          }}
        >
          Save a job to start tracking it here.
        </p>
        <Link
          href="/jobs"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            background: "#1BAAC1",
            color: "#0a2828",
            fontWeight: 700,
            padding: "10px 22px",
            fontSize: 13,
            textDecoration: "none",
            borderRadius: 0,
          }}
        >
          Browse jobs →
        </Link>
      </div>
    );
  }

  // ── Stats ────────────────────────────────────────────────────────────────
  const totalSaved = applications.filter(
    (a) => a.displayStatus === "saved",
  ).length;
  const totalCvReady = applications.filter(
    (a) => a.displayStatus === "cv_ready",
  ).length;
  const totalApplied = applications.filter(
    (a) => a.displayStatus === "applied",
  ).length;

  // ── Filter ───────────────────────────────────────────────────────────────
  const filtered =
    activeTab === "all"
      ? applications
      : applications.filter((a) => a.displayStatus === activeTab);

  const tabCounts: Record<FilterTab, number> = {
    all: applications.length,
    saved: totalSaved,
    cv_ready: totalCvReady,
    applied: totalApplied,
    expired: applications.filter((a) => a.displayStatus === "expired").length,
  };

  async function handleRemove(id: Id<"applications">) {
    await removeApplication({ applicationId: id });
  }

  // ── Render ───────────────────────────────────────────────────────────────
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
      {/* ── Topbar ──────────────────────────────────────────────────────── */}
      <div
        style={{
          padding: "20px 24px 0",
          borderBottom: "1px solid rgba(255,255,255,0.08)",
          flexShrink: 0,
        }}
      >
        {/* Heading row */}
        <div
          style={{
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
            marginBottom: 18,
            gap: 16,
          }}
        >
          <div>
            <p
              style={{
                fontFamily: "'DM Mono', monospace",
                fontSize: 10,
                color: "#1BAAC1",
                textTransform: "uppercase",
                letterSpacing: "2px",
                margin: "0 0 5px",
              }}
            >
              Application history
            </p>
            <h1
              style={{
                fontSize: 20,
                fontWeight: 700,
                color: "rgba(255,255,255,0.90)",
                margin: 0,
                letterSpacing: "-0.3px",
              }}
            >
              {applications.length} application{applications.length !== 1 ? "s" : ""}
            </h1>
          </div>

          {/* Stats bar */}
          <div
            style={{
              display: "flex",
              gap: 28,
              alignItems: "flex-start",
              flexShrink: 0,
            }}
          >
            <StatCard value={String(totalSaved)} label="Saved" dim={totalSaved === 0} />
            <StatCard value={String(totalCvReady)} label="CV Ready" dim={totalCvReady === 0} />
            <StatCard value={String(totalApplied)} label="Applied" dim={totalApplied === 0} />
          </div>
        </div>

        {/* Filter tabs */}
        <div style={{ display: "flex", gap: 20, alignItems: "flex-end" }}>
          <Tab
            label="All"
            count={tabCounts.all}
            active={activeTab === "all"}
            onClick={() => setActiveTab("all")}
          />
          <Tab
            label="Saved"
            count={tabCounts.saved}
            active={activeTab === "saved"}
            onClick={() => setActiveTab("saved")}
          />
          <Tab
            label="CV Ready"
            count={tabCounts.cv_ready}
            active={activeTab === "cv_ready"}
            onClick={() => setActiveTab("cv_ready")}
          />
          <Tab
            label="Applied"
            count={tabCounts.applied}
            active={activeTab === "applied"}
            onClick={() => setActiveTab("applied")}
          />
        </div>
      </div>

      {/* ── Table ───────────────────────────────────────────────────────── */}
      <div style={{ flex: 1, overflowY: "auto" }}>
        <TableHeader />

        {filtered.length === 0 ? (
          <div
            style={{
              padding: "48px 24px",
              textAlign: "center",
              color: "rgba(255,255,255,0.30)",
              fontSize: 13,
            }}
          >
            No applications in this category.
          </div>
        ) : (
          filtered.map((app) => (
            <HistoryRow
              key={app._id}
              app={app}
              onRemove={handleRemove}
            />
          ))
        )}
      </div>
    </div>
  );
}
