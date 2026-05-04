"use client";

/**
 * Role variations editor — onboarding step 3.
 *
 * Shows two editable lists populated from the user's profile.roleVariations:
 *   - Exact role titles   (same level, different wording)
 *   - Adjacent roles      (related, slight stretch)
 *
 * Every edit debounces a save to updateRoleVariations (600 ms).
 *
 * Guards:
 *   - Not signed in → /login
 *   - No profile    → /onboarding
 */

import { useQuery, useMutation } from "convex/react";
import { useRouter } from "next/navigation";
import { api } from "@/convex/_generated/api";
import { KeyboardEvent, useEffect, useRef, useState } from "react";

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function ChevronUp({ size = 12 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 12 12" fill="none" aria-hidden="true">
      <path d="M2 8l4-4 4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ChevronDown({ size = 12 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 12 12" fill="none" aria-hidden="true">
      <path d="M2 4l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function CloseIcon({ size = 10 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 10 10" fill="none" aria-hidden="true">
      <path d="M1 1l8 8M9 1L1 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// RoleList — one editable section (exact or adjacent)
// ---------------------------------------------------------------------------

interface RoleListProps {
  label: string;
  hint: string;
  items: string[];
  onChange: (items: string[]) => void;
}

function RoleList({ label, hint, items, onChange }: RoleListProps) {
  const [inputVal, setInputVal] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  function moveUp(i: number) {
    if (i === 0) return;
    const next = [...items];
    [next[i - 1], next[i]] = [next[i], next[i - 1]];
    onChange(next);
  }

  function moveDown(i: number) {
    if (i === items.length - 1) return;
    const next = [...items];
    [next[i], next[i + 1]] = [next[i + 1], next[i]];
    onChange(next);
  }

  function remove(i: number) {
    onChange(items.filter((_, idx) => idx !== i));
  }

  function addItem() {
    const trimmed = inputVal.trim();
    if (!trimmed || items.includes(trimmed)) {
      setInputVal("");
      return;
    }
    onChange([...items, trimmed]);
    setInputVal("");
    inputRef.current?.focus();
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault();
      addItem();
    }
  }

  return (
    <div
      style={{
        background: "rgba(255,255,255,0.04)",
        border: "1px solid rgba(255,255,255,0.11)",
        borderRadius: 10,
        padding: "16px 18px",
      }}
    >
      {/* Section header */}
      <div style={{ marginBottom: 4 }}>
        <p
          style={{
            fontFamily: "var(--mono, 'DM Mono', monospace)",
            fontSize: 10,
            fontWeight: 500,
            textTransform: "uppercase",
            letterSpacing: "1.8px",
            color: "#1BAAC1",
            margin: 0,
          }}
        >
          {label}
        </p>
        <p
          style={{
            fontSize: 12,
            color: "rgba(255,255,255,0.40)",
            margin: "4px 0 14px",
            lineHeight: 1.5,
          }}
        >
          {hint}
        </p>
      </div>

      {/* Items */}
      {items.length === 0 && (
        <p
          style={{
            fontSize: 12,
            color: "rgba(255,255,255,0.25)",
            marginBottom: 12,
            fontStyle: "italic",
          }}
        >
          No titles yet. Add one below.
        </p>
      )}

      <ul style={{ listStyle: "none", margin: 0, padding: 0, marginBottom: items.length ? 10 : 0 }}>
        {items.map((title, i) => (
          <li
            key={`${title}-${i}`}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "7px 0",
              borderBottom:
                i < items.length - 1 ? "1px solid rgba(255,255,255,0.06)" : "none",
            }}
          >
            {/* Reorder buttons */}
            <div style={{ display: "flex", flexDirection: "column", gap: 2, flexShrink: 0 }}>
              <button
                onClick={() => moveUp(i)}
                disabled={i === 0}
                aria-label={`Move "${title}" up`}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  width: 20,
                  height: 20,
                  background: "none",
                  border: "1px solid rgba(255,255,255,0.10)",
                  borderRadius: 3,
                  color: i === 0 ? "rgba(255,255,255,0.15)" : "rgba(255,255,255,0.45)",
                  cursor: i === 0 ? "default" : "pointer",
                  padding: 0,
                  transition: "color 0.15s, border-color 0.15s",
                }}
              >
                <ChevronUp />
              </button>
              <button
                onClick={() => moveDown(i)}
                disabled={i === items.length - 1}
                aria-label={`Move "${title}" down`}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  width: 20,
                  height: 20,
                  background: "none",
                  border: "1px solid rgba(255,255,255,0.10)",
                  borderRadius: 3,
                  color:
                    i === items.length - 1
                      ? "rgba(255,255,255,0.15)"
                      : "rgba(255,255,255,0.45)",
                  cursor: i === items.length - 1 ? "default" : "pointer",
                  padding: 0,
                  transition: "color 0.15s, border-color 0.15s",
                }}
              >
                <ChevronDown />
              </button>
            </div>

            {/* Title text */}
            <span
              style={{
                flex: 1,
                fontSize: 13,
                color: "rgba(255,255,255,0.85)",
                lineHeight: 1.4,
              }}
            >
              {title}
            </span>

            {/* Remove button */}
            <button
              onClick={() => remove(i)}
              aria-label={`Remove "${title}"`}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                width: 24,
                height: 24,
                background: "none",
                border: "1px solid rgba(255,255,255,0.10)",
                borderRadius: 3,
                color: "rgba(255,255,255,0.35)",
                cursor: "pointer",
                flexShrink: 0,
                padding: 0,
                transition: "color 0.15s, border-color 0.15s",
              }}
            >
              <CloseIcon />
            </button>
          </li>
        ))}
      </ul>

      {/* Add input */}
      <div style={{ display: "flex", gap: 6, marginTop: items.length ? 10 : 0 }}>
        <input
          ref={inputRef}
          type="text"
          value={inputVal}
          onChange={(e) => setInputVal(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Add a role title"
          style={{
            flex: 1,
            background: "rgba(255,255,255,0.04)",
            border: "1px solid rgba(255,255,255,0.12)",
            borderRadius: 5,
            color: "rgba(255,255,255,0.85)",
            fontSize: 13,
            padding: "7px 10px",
            outline: "none",
            fontFamily: "inherit",
          }}
        />
        <button
          onClick={addItem}
          disabled={inputVal.trim() === ""}
          style={{
            background: inputVal.trim() ? "rgba(27,170,193,0.15)" : "rgba(255,255,255,0.04)",
            border: `1px solid ${inputVal.trim() ? "rgba(27,170,193,0.35)" : "rgba(255,255,255,0.10)"}`,
            borderRadius: 5,
            color: inputVal.trim() ? "#1BAAC1" : "rgba(255,255,255,0.25)",
            fontSize: 12,
            fontWeight: 700,
            padding: "7px 14px",
            cursor: inputVal.trim() ? "pointer" : "default",
            transition: "all 0.15s",
            fontFamily: "inherit",
            whiteSpace: "nowrap",
          }}
        >
          Add
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// SaveStatus indicator
// ---------------------------------------------------------------------------

function SaveStatus({ status }: { status: "idle" | "saving" | "saved" }) {
  if (status === "idle") return null;
  return (
    <p
      style={{
        fontFamily: "var(--mono, 'DM Mono', monospace)",
        fontSize: 10,
        letterSpacing: "1px",
        textTransform: "uppercase",
        color: status === "saved" ? "#1BAAC1" : "rgba(255,255,255,0.35)",
        margin: 0,
      }}
    >
      {status === "saving" ? "Saving\u2026" : "Saved"}
    </p>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function RolesPage() {
  const router = useRouter();
  const user = useQuery(api.users.getCurrentUser);
  const profile = useQuery(api.users.getCurrentProfile);
  const updateRoleVariations = useMutation(api.users.updateRoleVariations);

  const [exact, setExact] = useState<string[]>([]);
  const [adjacent, setAdjacent] = useState<string[]>([]);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved">("idle");

  const initialised = useRef(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Latest values for the debounced callback to close over
  const exactRef = useRef(exact);
  const adjacentRef = useRef(adjacent);
  useEffect(() => { exactRef.current = exact; }, [exact]);
  useEffect(() => { adjacentRef.current = adjacent; }, [adjacent]);

  // ── Guards ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (user === undefined) return;
    if (user === null) { router.replace("/login"); return; }
  }, [user, router]);

  useEffect(() => {
    if (profile === undefined) return;
    if (profile === null) { router.replace("/onboarding"); return; }
  }, [profile, router]);

  // ── Seed from profile (once) ────────────────────────────────────────────────
  useEffect(() => {
    if (!profile || initialised.current) return;
    setExact(profile.roleVariations?.exact ?? []);
    setAdjacent(profile.roleVariations?.adjacent ?? []);
    initialised.current = true;
  }, [profile]);

  // ── Debounced save ───────────────────────────────────────────────────────────
  function scheduleSave(nextExact: string[], nextAdjacent: string[]) {
    setSaveStatus("saving");
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      updateRoleVariations({ exact: nextExact, adjacent: nextAdjacent })
        .then(() => setSaveStatus("saved"))
        .catch(() => setSaveStatus("idle"));
    }, 600);
  }

  function handleExactChange(next: string[]) {
    setExact(next);
    scheduleSave(next, adjacentRef.current);
  }

  function handleAdjacentChange(next: string[]) {
    setAdjacent(next);
    scheduleSave(exactRef.current, next);
  }

  // ── Loading / redirecting ────────────────────────────────────────────────────
  if (user === undefined || profile === undefined || user === null || profile === null) {
    return (
      <main
        style={{
          minHeight: "100vh",
          background: "#021e1e",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <p
          style={{
            fontFamily: "'DM Mono', monospace",
            fontSize: 12,
            color: "#1BAAC1",
            letterSpacing: "1px",
          }}
        >
          Loading&hellip;
        </p>
      </main>
    );
  }

  // ── Editor ────────────────────────────────────────────────────────────────────
  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#021e1e",
        fontFamily: "'Plus Jakarta Sans', sans-serif",
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "center",
        padding: "64px 16px 80px",
      }}
    >
      <div style={{ width: "100%", maxWidth: 560 }}>

        {/* Eyebrow */}
        <p
          style={{
            fontFamily: "'DM Mono', monospace",
            fontSize: 10,
            fontWeight: 500,
            textTransform: "uppercase",
            letterSpacing: "4px",
            color: "#1BAAC1",
            margin: "0 0 24px",
          }}
        >
          Tino — Step 3 of 3
        </p>

        {/* Heading */}
        <h1
          style={{
            fontSize: 22,
            fontWeight: 700,
            color: "rgba(255,255,255,0.90)",
            margin: "0 0 6px",
            letterSpacing: "-0.3px",
          }}
        >
          Your role titles
        </h1>
        <p
          style={{
            fontSize: 13,
            color: "rgba(255,255,255,0.45)",
            lineHeight: 1.7,
            margin: "0 0 32px",
          }}
        >
          We use these to match you with relevant jobs. Edit, add, or reorder.
          Changes save automatically.
        </p>

        {/* Lists */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <RoleList
            label="Exact role titles"
            hint="Same level, different wording — roles you could apply for right now."
            items={exact}
            onChange={handleExactChange}
          />
          <RoleList
            label="Adjacent roles"
            hint="Related positions you could credibly apply for — a slight stretch."
            items={adjacent}
            onChange={handleAdjacentChange}
          />
        </div>

        {/* Save status + Continue */}
        <div
          style={{
            marginTop: 28,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 16,
          }}
        >
          <SaveStatus status={saveStatus} />

          <button
            onClick={() => router.push("/feed")}
            style={{
              background: "#1BAAC1",
              color: "#0a2828",
              fontFamily: "inherit",
              fontSize: 13,
              fontWeight: 700,
              letterSpacing: "0.8px",
              textTransform: "uppercase",
              border: "none",
              borderRadius: 0,
              padding: "12px 28px",
              cursor: "pointer",
              transition: "background 0.15s",
              marginLeft: "auto",
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLButtonElement).style.background = "#21c8e2";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.background = "#1BAAC1";
            }}
          >
            Continue to feed
          </button>
        </div>

        {/* Progress dots */}
        <div
          style={{
            marginTop: 40,
            display: "flex",
            justifyContent: "center",
            gap: 6,
          }}
        >
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              style={{
                display: "block",
                width: i === 2 ? 20 : 6,
                height: 6,
                borderRadius: 3,
                background: i === 2 ? "#1BAAC1" : "rgba(255,255,255,0.15)",
                transition: "width 0.15s",
              }}
            />
          ))}
        </div>
      </div>
    </main>
  );
}
