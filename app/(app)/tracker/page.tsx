"use client";

/**
 * Application Tracker — /tracker
 *
 * Kanban board: one column per stage, cards show company logo, title,
 * company, score band, and days since applied.
 *
 * Clicking a card opens a slide-over panel to advance the stage or
 * mark as rejected / withdrawn.
 *
 * Stages (schema value → display label):
 *   saved               → Saved
 *   cv_generated        → CV Generated
 *   applied             → Applied
 *   acknowledged        → Phone Screen
 *   interview_scheduled → Interview
 *   interview_done      → Assessment
 *   offer_received      → Offer
 *   closed+offer_accepted → Accepted
 *   closed+(other)      → Rejected / Withdrawn
 */

import { useQuery, useMutation } from "convex/react";
import { useRouter } from "next/navigation";
import { useState, FormEvent } from "react";
import Link from "next/link";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { CompanyLogo } from "@/components/CompanyLogo";
import { ScoreBand } from "@/components/ScoreBand";
import type { Band } from "@/components/ScoreBand";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type AppRecord = NonNullable<
  ReturnType<typeof useQuery<typeof api.applications.queries.listForUser>>
>[number];

type StageKey =
  | "saved"
  | "cv_generated"
  | "applied"
  | "acknowledged"
  | "interview_scheduled"
  | "interview_done"
  | "offer_received"
  | "accepted"
  | "rejected_withdrawn";

// ---------------------------------------------------------------------------
// Stage config
// ---------------------------------------------------------------------------

interface StageConfig {
  key: StageKey;
  label: string;
  /** Schema stage value to advance to (null for terminal display-only columns) */
  advanceTo: string | null;
  advanceLabel: string | null;
  emptyText: string;
}

const STAGES: StageConfig[] = [
  {
    key: "saved",
    label: "Saved",
    advanceTo: "applied",
    advanceLabel: "Mark as applied",
    emptyText: "Nothing saved yet. Add a job to start tracking it.",
  },
  {
    key: "cv_generated",
    label: "CV Generated",
    advanceTo: "applied",
    advanceLabel: "Mark as applied",
    emptyText: "No CVs generated yet. Generate one from any job listing.",
  },
  {
    key: "applied",
    label: "Applied",
    advanceTo: "acknowledged",
    advanceLabel: "Log phone screen",
    emptyText: "No applications sent yet.",
  },
  {
    key: "acknowledged",
    label: "Phone Screen",
    advanceTo: "interview_scheduled",
    advanceLabel: "Log interview",
    emptyText: "No phone screens logged.",
  },
  {
    key: "interview_scheduled",
    label: "Interview",
    advanceTo: "interview_done",
    advanceLabel: "Log assessment",
    emptyText: "No interviews scheduled.",
  },
  {
    key: "interview_done",
    label: "Assessment",
    advanceTo: "offer_received",
    advanceLabel: "Log offer",
    emptyText: "No assessments logged.",
  },
  {
    key: "offer_received",
    label: "Offer",
    advanceTo: "closed",
    advanceLabel: "Accept offer",
    emptyText: "No offers yet. Keep going.",
  },
  {
    key: "accepted",
    label: "Accepted",
    advanceTo: null,
    advanceLabel: null,
    emptyText: "Nothing accepted yet.",
  },
  {
    key: "rejected_withdrawn",
    label: "Rejected / Withdrawn",
    advanceTo: null,
    advanceLabel: null,
    emptyText: "Nothing archived here yet.",
  },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function resolveColumnKey(stage: string, outcome: string | null): StageKey {
  if (stage === "closed") {
    return outcome === "offer_accepted" ? "accepted" : "rejected_withdrawn";
  }
  return stage as StageKey;
}

function daysLabel(days: number | null): string {
  if (days === null) return "Not applied yet";
  if (days === 0) return "Today";
  if (days === 1) return "1d ago";
  return `${days}d ago`;
}

// ---------------------------------------------------------------------------
// Stats computation
// ---------------------------------------------------------------------------

interface Stats {
  total: number;
  responseRate: number | null;
  avgDaysToInterview: number | null;
  activeOffers: number;
}

function computeStats(apps: AppRecord[]): Stats {
  const total = apps.length;

  const applied = apps.filter((a) =>
    ["applied", "acknowledged", "interview_scheduled", "interview_done",
      "offer_received", "closed"].includes(a.stage),
  );
  const responded = apps.filter((a) =>
    ["acknowledged", "interview_scheduled", "interview_done",
      "offer_received"].includes(a.stage) ||
    (a.stage === "closed" && a.outcome === "offer_accepted"),
  );
  const responseRate =
    applied.length > 0
      ? Math.round((responded.length / applied.length) * 100)
      : null;

  const daysToInterviewList = apps
    .map((a) => a.daysToInterview)
    .filter((d): d is number => d !== null);
  const avgDaysToInterview =
    daysToInterviewList.length > 0
      ? Math.round(
          daysToInterviewList.reduce((s, d) => s + d, 0) /
            daysToInterviewList.length,
        )
      : null;

  const activeOffers = apps.filter((a) => a.stage === "offer_received").length;

  return { total, responseRate, avgDaysToInterview, activeOffers };
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
        background: "rgba(255,255,255,0.03)",
        border: "1px solid rgba(255,255,255,0.07)",
        padding: "14px 20px",
        minWidth: 140,
      }}
    >
      <div
        style={{
          fontFamily: "var(--mono, 'DM Mono', monospace)",
          fontSize: 24,
          fontWeight: 700,
          color: dim ? "rgba(255,255,255,0.35)" : "#f9fafb",
          lineHeight: 1.1,
        }}
      >
        {value}
      </div>
      <div
        style={{
          fontFamily: "var(--mono, 'DM Mono', monospace)",
          fontSize: 11,
          color: "rgba(255,255,255,0.4)",
          textTransform: "uppercase",
          letterSpacing: "1.2px",
          marginTop: 5,
        }}
      >
        {label}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Application card
// ---------------------------------------------------------------------------

function AppCard({
  app,
  onOpen,
}: {
  app: AppRecord;
  onOpen: (app: AppRecord) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onOpen(app)}
      style={{
        display: "block",
        width: "100%",
        textAlign: "left",
        background: "rgba(255,255,255,0.04)",
        border: "1px solid rgba(255,255,255,0.08)",
        padding: "12px",
        cursor: "pointer",
        transition: "border-color 0.15s, background 0.15s",
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLButtonElement).style.borderColor =
          "rgba(27,170,193,0.4)";
        (e.currentTarget as HTMLButtonElement).style.background =
          "rgba(27,170,193,0.05)";
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLButtonElement).style.borderColor =
          "rgba(255,255,255,0.08)";
        (e.currentTarget as HTMLButtonElement).style.background =
          "rgba(255,255,255,0.04)";
      }}
    >
      {/* Logo + title row */}
      <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
        <CompanyLogo company={app.company} size={32} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontSize: 13,
              fontWeight: 600,
              color: "#f9fafb",
              lineHeight: 1.3,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {app.jobTitle}
          </div>
          <div
            style={{
              fontSize: 12,
              color: "rgba(255,255,255,0.5)",
              marginTop: 2,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {app.company}
          </div>
        </div>
      </div>

      {/* Score band + days */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginTop: 10,
          gap: 8,
        }}
      >
        <ScoreBand band={app.sponsorshipBand as Band} />
        <span
          style={{
            fontFamily: "var(--mono, 'DM Mono', monospace)",
            fontSize: 11,
            color: "rgba(255,255,255,0.35)",
            whiteSpace: "nowrap",
          }}
        >
          {daysLabel(app.daysSinceApplied)}
        </span>
      </div>
    </button>
  );
}

// ---------------------------------------------------------------------------
// Kanban column
// ---------------------------------------------------------------------------

function KanbanColumn({
  config,
  cards,
  onOpen,
}: {
  config: StageConfig;
  cards: AppRecord[];
  onOpen: (app: AppRecord) => void;
}) {
  return (
    <div
      style={{
        flexShrink: 0,
        width: 220,
        display: "flex",
        flexDirection: "column",
        gap: 0,
      }}
    >
      {/* Column header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "10px 12px",
          borderBottom: "1px solid rgba(255,255,255,0.07)",
          marginBottom: 10,
        }}
      >
        <span
          style={{
            fontFamily: "var(--mono, 'DM Mono', monospace)",
            fontSize: 11,
            fontWeight: 600,
            color: "rgba(255,255,255,0.55)",
            textTransform: "uppercase",
            letterSpacing: "1.2px",
          }}
        >
          {config.label}
        </span>
        {cards.length > 0 && (
          <span
            style={{
              fontFamily: "var(--mono, 'DM Mono', monospace)",
              fontSize: 11,
              color: "#1BAAC1",
              background: "rgba(27,170,193,0.12)",
              padding: "1px 7px",
              borderRadius: 20,
            }}
          >
            {cards.length}
          </span>
        )}
      </div>

      {/* Cards */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 8,
          flex: 1,
          overflowY: "auto",
          paddingBottom: 16,
        }}
      >
        {cards.length === 0 ? (
          <p
            style={{
              fontSize: 12,
              color: "rgba(255,255,255,0.22)",
              padding: "8px 4px",
              lineHeight: 1.5,
            }}
          >
            {config.emptyText}
          </p>
        ) : (
          cards.map((app) => (
            <AppCard key={app._id} app={app} onOpen={onOpen} />
          ))
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Stage slide-over panel
// ---------------------------------------------------------------------------

const OUTCOME_LABELS: Record<string, string> = {
  offer_accepted: "Offer accepted",
  offer_declined: "Offer declined",
  rejected: "Rejected",
  ghosted: "Ghosted",
  withdrawn: "Withdrawn",
};

const STAGE_DISPLAY: Record<string, string> = {
  saved: "Saved",
  cv_generated: "CV Generated",
  applied: "Applied",
  acknowledged: "Phone Screen",
  interview_scheduled: "Interview",
  interview_done: "Assessment",
  offer_received: "Offer",
  closed: "Closed",
};

function StagePanel({
  app,
  onClose,
  onAdvance,
}: {
  app: AppRecord;
  onClose: () => void;
  onAdvance: (
    toStage: string,
    outcome?: string,
    notes?: string,
  ) => Promise<void>;
}) {
  const [notes, setNotes] = useState(app.notes ?? "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [mode, setMode] = useState<"default" | "reject" | "withdraw">("default");
  const [rejectReason, setRejectReason] = useState("rejected");
  const [withdrawReason, setWithdrawReason] = useState("withdrawn");

  const colKey = resolveColumnKey(app.stage, app.outcome);
  const stageConfig = STAGES.find((s) => s.key === colKey);
  const isClosed = app.stage === "closed";

  async function handleAdvance(e: FormEvent) {
    e.preventDefault();
    if (!stageConfig?.advanceTo) return;
    setError("");
    setLoading(true);
    try {
      const outcome =
        stageConfig.advanceTo === "closed" ? "offer_accepted" : undefined;
      await onAdvance(stageConfig.advanceTo, outcome, notes);
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  async function handleClose(outcome: string) {
    setError("");
    setLoading(true);
    try {
      await onAdvance("closed", outcome, notes);
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  const currentStageLabel =
    isClosed && app.outcome
      ? OUTCOME_LABELS[app.outcome] ?? "Closed"
      : (STAGE_DISPLAY[app.stage] ?? app.stage);

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: "fixed",
          inset: 0,
          background: "rgba(0,0,0,0.55)",
          zIndex: 40,
        }}
      />

      {/* Panel */}
      <div
        style={{
          position: "fixed",
          top: 0,
          right: 0,
          bottom: 0,
          width: 380,
          background: "#0a1f1f",
          borderLeft: "1px solid rgba(255,255,255,0.08)",
          zIndex: 50,
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: "20px 24px 16px",
            borderBottom: "1px solid rgba(255,255,255,0.07)",
            display: "flex",
            alignItems: "flex-start",
            gap: 14,
          }}
        >
          <CompanyLogo company={app.company} size={42} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <h2
              style={{
                margin: 0,
                fontSize: 15,
                fontWeight: 700,
                color: "#f9fafb",
                lineHeight: 1.3,
              }}
            >
              {app.jobTitle}
            </h2>
            <p
              style={{
                margin: "3px 0 0",
                fontSize: 13,
                color: "rgba(255,255,255,0.5)",
              }}
            >
              {app.company}
            </p>
            <div style={{ marginTop: 8 }}>
              <ScoreBand band={app.sponsorshipBand as Band} />
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close panel"
            style={{
              background: "none",
              border: "none",
              color: "rgba(255,255,255,0.4)",
              cursor: "pointer",
              fontSize: 20,
              lineHeight: 1,
              padding: 2,
              flexShrink: 0,
            }}
          >
            ×
          </button>
        </div>

        {/* Stage breadcrumb */}
        <div
          style={{
            padding: "12px 24px",
            borderBottom: "1px solid rgba(255,255,255,0.05)",
          }}
        >
          <span
            style={{
              fontFamily: "var(--mono, 'DM Mono', monospace)",
              fontSize: 11,
              color: "rgba(255,255,255,0.35)",
              textTransform: "uppercase",
              letterSpacing: "1.2px",
            }}
          >
            Stage
          </span>
          <span
            style={{
              fontFamily: "var(--mono, 'DM Mono', monospace)",
              fontSize: 13,
              fontWeight: 600,
              color: "#1BAAC1",
              marginLeft: 10,
            }}
          >
            {currentStageLabel}
          </span>
          {app.daysSinceApplied !== null && (
            <span
              style={{
                fontFamily: "var(--mono, 'DM Mono', monospace)",
                fontSize: 11,
                color: "rgba(255,255,255,0.3)",
                marginLeft: 12,
              }}
            >
              {daysLabel(app.daysSinceApplied)}
            </span>
          )}
        </div>

        {/* Body */}
        <div
          style={{
            flex: 1,
            overflowY: "auto",
            padding: "20px 24px",
            display: "flex",
            flexDirection: "column",
            gap: 16,
          }}
        >
          {error && (
            <p
              style={{
                fontSize: 13,
                color: "#f87171",
                background: "rgba(248,113,113,0.08)",
                border: "1px solid rgba(248,113,113,0.2)",
                padding: "10px 14px",
                margin: 0,
              }}
            >
              {error}
            </p>
          )}

          {/* Reject form */}
          {mode === "reject" && (
            <div
              style={{
                border: "1px solid rgba(255,255,255,0.08)",
                padding: "16px",
              }}
            >
              <p
                style={{
                  margin: "0 0 12px",
                  fontSize: 13,
                  fontWeight: 600,
                  color: "#f9fafb",
                }}
              >
                Mark as rejected
              </p>
              <label
                style={{
                  display: "block",
                  fontFamily: "var(--mono,'DM Mono',monospace)",
                  fontSize: 11,
                  color: "rgba(255,255,255,0.4)",
                  textTransform: "uppercase",
                  letterSpacing: "1.2px",
                  marginBottom: 6,
                }}
              >
                Reason
              </label>
              <select
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                style={{
                  width: "100%",
                  background: "#0d2626",
                  border: "1px solid rgba(27,170,193,0.25)",
                  color: "#f9fafb",
                  padding: "8px 10px",
                  fontSize: 13,
                  marginBottom: 12,
                }}
              >
                <option value="rejected">No response</option>
                <option value="rejected">After screening</option>
                <option value="rejected">After interview</option>
                <option value="rejected">After offer</option>
                <option value="ghosted">Ghosted</option>
              </select>
              <div style={{ display: "flex", gap: 8 }}>
                <button
                  type="button"
                  onClick={() => handleClose(rejectReason)}
                  disabled={loading}
                  style={{
                    flex: 1,
                    background: "#ef4444",
                    color: "#fff",
                    border: "none",
                    padding: "9px 16px",
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: "pointer",
                    opacity: loading ? 0.6 : 1,
                  }}
                >
                  {loading ? "Saving…" : "Save"}
                </button>
                <button
                  type="button"
                  onClick={() => setMode("default")}
                  style={{
                    background: "transparent",
                    color: "rgba(255,255,255,0.4)",
                    border: "1px solid rgba(255,255,255,0.12)",
                    padding: "9px 16px",
                    fontSize: 13,
                    cursor: "pointer",
                  }}
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* Withdraw form */}
          {mode === "withdraw" && (
            <div
              style={{
                border: "1px solid rgba(255,255,255,0.08)",
                padding: "16px",
              }}
            >
              <p
                style={{
                  margin: "0 0 12px",
                  fontSize: 13,
                  fontWeight: 600,
                  color: "#f9fafb",
                }}
              >
                Withdraw application
              </p>
              <label
                style={{
                  display: "block",
                  fontFamily: "var(--mono,'DM Mono',monospace)",
                  fontSize: 11,
                  color: "rgba(255,255,255,0.4)",
                  textTransform: "uppercase",
                  letterSpacing: "1.2px",
                  marginBottom: 6,
                }}
              >
                Reason
              </label>
              <select
                value={withdrawReason}
                onChange={(e) => setWithdrawReason(e.target.value)}
                style={{
                  width: "100%",
                  background: "#0d2626",
                  border: "1px solid rgba(27,170,193,0.25)",
                  color: "#f9fafb",
                  padding: "8px 10px",
                  fontSize: 13,
                  marginBottom: 12,
                }}
              >
                <option value="withdrawn">Found another role</option>
                <option value="withdrawn">Changed my mind</option>
                <option value="withdrawn">Role changed</option>
                <option value="withdrawn">Other</option>
              </select>
              <div style={{ display: "flex", gap: 8 }}>
                <button
                  type="button"
                  onClick={() => handleClose(withdrawReason)}
                  disabled={loading}
                  style={{
                    flex: 1,
                    background: "rgba(255,255,255,0.08)",
                    color: "#f9fafb",
                    border: "none",
                    padding: "9px 16px",
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: "pointer",
                    opacity: loading ? 0.6 : 1,
                  }}
                >
                  {loading ? "Saving…" : "Save"}
                </button>
                <button
                  type="button"
                  onClick={() => setMode("default")}
                  style={{
                    background: "transparent",
                    color: "rgba(255,255,255,0.4)",
                    border: "1px solid rgba(255,255,255,0.12)",
                    padding: "9px 16px",
                    fontSize: 13,
                    cursor: "pointer",
                  }}
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* Default advance form */}
          {mode === "default" && (
            <>
              {/* Notes */}
              <div>
                <label
                  htmlFor="panel-notes"
                  style={{
                    display: "block",
                    fontFamily: "var(--mono,'DM Mono',monospace)",
                    fontSize: 11,
                    color: "rgba(255,255,255,0.4)",
                    textTransform: "uppercase",
                    letterSpacing: "1.2px",
                    marginBottom: 6,
                  }}
                >
                  Notes
                </label>
                <textarea
                  id="panel-notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={4}
                  placeholder="Add any notes about this application…"
                  style={{
                    width: "100%",
                    background: "#0d2626",
                    border: "1px solid rgba(27,170,193,0.2)",
                    color: "#f9fafb",
                    padding: "10px 12px",
                    fontSize: 13,
                    resize: "vertical",
                    outline: "none",
                    fontFamily: "inherit",
                    boxSizing: "border-box",
                  }}
                />
              </div>

              {/* Apply URL */}
              {app.applyUrl && (
                <a
                  href={app.applyUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    display: "inline-block",
                    fontSize: 13,
                    color: "#1BAAC1",
                    textDecoration: "underline",
                    textUnderlineOffset: 3,
                  }}
                >
                  View job listing ↗
                </a>
              )}
            </>
          )}
        </div>

        {/* Footer actions */}
        {mode === "default" && (
          <div
            style={{
              padding: "16px 24px",
              borderTop: "1px solid rgba(255,255,255,0.07)",
              display: "flex",
              flexDirection: "column",
              gap: 8,
            }}
          >
            {/* Primary advance button */}
            {!isClosed && stageConfig?.advanceTo && (
              <form onSubmit={handleAdvance}>
                <button
                  type="submit"
                  disabled={loading}
                  style={{
                    width: "100%",
                    background: "#1BAAC1",
                    color: "#0a2828",
                    border: "none",
                    padding: "11px 16px",
                    fontSize: 13,
                    fontWeight: 700,
                    cursor: "pointer",
                    textTransform: "uppercase",
                    letterSpacing: "0.8px",
                    opacity: loading ? 0.7 : 1,
                  }}
                >
                  {loading
                    ? "Saving…"
                    : stageConfig.advanceTo === "closed"
                      ? "Accept offer ✓"
                      : `${stageConfig.advanceLabel} →`}
                </button>
              </form>
            )}

            {/* Secondary: reject / withdraw */}
            {!isClosed && (
              <div style={{ display: "flex", gap: 8 }}>
                <button
                  type="button"
                  onClick={() => setMode("reject")}
                  style={{
                    flex: 1,
                    background: "transparent",
                    color: "#f87171",
                    border: "1px solid rgba(248,113,113,0.25)",
                    padding: "8px 12px",
                    fontSize: 12,
                    cursor: "pointer",
                  }}
                >
                  Reject
                </button>
                <button
                  type="button"
                  onClick={() => setMode("withdraw")}
                  style={{
                    flex: 1,
                    background: "transparent",
                    color: "rgba(255,255,255,0.4)",
                    border: "1px solid rgba(255,255,255,0.12)",
                    padding: "8px 12px",
                    fontSize: 12,
                    cursor: "pointer",
                  }}
                >
                  Withdraw
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function TrackerPage() {
  const applications = useQuery(api.applications.queries.listForUser);
  const advanceStage = useMutation(
    api.applications.mutations.advanceApplicationStage,
  );

  const [selectedApp, setSelectedApp] = useState<AppRecord | null>(null);
  const router = useRouter();

  // Group into columns
  const grouped = STAGES.reduce<Record<StageKey, AppRecord[]>>(
    (acc, s) => ({ ...acc, [s.key]: [] }),
    {} as Record<StageKey, AppRecord[]>,
  );

  if (applications) {
    for (const app of applications) {
      const col = resolveColumnKey(app.stage, app.outcome);
      grouped[col].push(app);
    }
  }

  const stats = computeStats(applications ?? []);

  async function handleAdvance(
    toStage: string,
    outcome?: string,
    notes?: string,
  ) {
    if (!selectedApp) return;
    await advanceStage({
      applicationId: selectedApp._id as Id<"applications">,
      toStage: toStage as Parameters<
        typeof advanceStage
      >[0]["toStage"],
      outcome: outcome as Parameters<typeof advanceStage>[0]["outcome"],
      notes,
    });
    // Optimistically close panel — query will update reactively
    setSelectedApp(null);
  }

  // ---------- loading ----------
  if (applications === undefined) {
    return (
      <div
        style={{
          flex: 1,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "rgba(255,255,255,0.3)",
          fontSize: 14,
        }}
      >
        Loading…
      </div>
    );
  }

  // ---------- empty state ----------
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
        }}
      >
        <p
          style={{
            fontFamily: "var(--mono,'DM Mono',monospace)",
            fontSize: 11,
            color: "#1BAAC1",
            textTransform: "uppercase",
            letterSpacing: "2px",
            marginBottom: 16,
          }}
        >
          Application tracker
        </p>
        <h1
          style={{
            fontSize: 24,
            fontWeight: 700,
            color: "#f9fafb",
            margin: "0 0 12px",
          }}
        >
          No applications yet.
        </h1>
        <p
          style={{
            fontSize: 15,
            color: "rgba(255,255,255,0.45)",
            maxWidth: 380,
            lineHeight: 1.6,
            margin: "0 0 32px",
          }}
        >
          Find a job you like and hit Save to start tracking it here.
        </p>
        <Link
          href="/jobs"
          style={{
            display: "inline-block",
            background: "#1BAAC1",
            color: "#0a2828",
            fontWeight: 700,
            padding: "12px 28px",
            fontSize: 14,
            textDecoration: "none",
            textTransform: "uppercase",
            letterSpacing: "0.8px",
          }}
        >
          Browse jobs →
        </Link>
      </div>
    );
  }

  return (
    <div
      style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
      }}
    >
      {/* Topbar */}
      <div
        style={{
          padding: "20px 28px 0",
          flexShrink: 0,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "flex-end",
            justifyContent: "space-between",
            marginBottom: 20,
          }}
        >
          <div>
            <p
              style={{
                fontFamily: "var(--mono,'DM Mono',monospace)",
                fontSize: 11,
                color: "#1BAAC1",
                textTransform: "uppercase",
                letterSpacing: "2px",
                margin: "0 0 6px",
              }}
            >
              Application tracker
            </p>
            <h1
              style={{
                fontSize: 22,
                fontWeight: 700,
                color: "#f9fafb",
                margin: 0,
              }}
            >
              {stats.total} application{stats.total !== 1 ? "s" : ""}
            </h1>
          </div>
          <Link
            href="/jobs"
            style={{
              fontSize: 13,
              color: "#1BAAC1",
              textDecoration: "none",
              border: "1px solid rgba(27,170,193,0.3)",
              padding: "7px 14px",
            }}
          >
            + Find jobs
          </Link>
        </div>

        {/* Stats bar */}
        <div
          style={{
            display: "flex",
            gap: 10,
            marginBottom: 24,
            flexWrap: "wrap",
          }}
        >
          <StatCard
            value={String(stats.total)}
            label="Total applications"
          />
          <StatCard
            value={
              stats.responseRate !== null ? `${stats.responseRate}%` : "—"
            }
            label="Response rate"
            dim={stats.responseRate === null}
          />
          <StatCard
            value={
              stats.avgDaysToInterview !== null
                ? `${stats.avgDaysToInterview}d`
                : "—"
            }
            label="Avg days to interview"
            dim={stats.avgDaysToInterview === null}
          />
          {stats.activeOffers > 0 && (
            <StatCard
              value={String(stats.activeOffers)}
              label="Active offer"
            />
          )}
        </div>
      </div>

      {/* Kanban board (horizontal scroll) */}
      <div
        style={{
          flex: 1,
          overflowX: "auto",
          overflowY: "hidden",
          padding: "0 28px 24px",
          display: "flex",
          gap: 16,
          alignItems: "flex-start",
        }}
      >
        {STAGES.map((stage) => (
          <KanbanColumn
            key={stage.key}
            config={stage}
            cards={grouped[stage.key]}
            onOpen={setSelectedApp}
          />
        ))}
      </div>

      {/* Slide-over panel */}
      {selectedApp && (
        <StagePanel
          app={selectedApp}
          onClose={() => setSelectedApp(null)}
          onAdvance={handleAdvance}
        />
      )}
    </div>
  );
}
