"use client";

/**
 * AppNav — authenticated app sidebar
 *
 * Matches the sidebar design in tickets/fixtures/tino-app-screens-reference.html:
 *   - 220px wide, #011818 background
 *   - Tino SVG logo
 *   - Nav items: Jobs, Tracker, Dashboard
 *   - User section at bottom with initials avatar + profile dropdown (Sign out)
 *
 * Auth guard: redirects to /login when getCurrentUser returns null.
 */

import { useQuery } from "convex/react";
import { useAuthActions } from "@convex-dev/auth/react";
import { useRouter, usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { api } from "@/convex/_generated/api";

// ---------------------------------------------------------------------------
// Tino logo SVG (from design-tokens.md)
// ---------------------------------------------------------------------------

function TinoLogo() {
  return (
    <svg
      width="46"
      height="18"
      viewBox="0 0 56 26"
      fill="none"
      aria-label="Tino"
    >
      <line x1="2"  y1="3"  x2="13" y2="3"  stroke="rgba(255,255,255,0.85)" strokeWidth="2" strokeLinecap="round" />
      <line x1="7.5" y1="3" x2="7.5" y2="23" stroke="rgba(255,255,255,0.85)" strokeWidth="2" strokeLinecap="round" />
      <rect x="16" y="2" width="6" height="6" rx="1.8" fill="#1BAAC1" />
      <line x1="19" y1="10" x2="19" y2="23" stroke="rgba(255,255,255,0.85)" strokeWidth="2" strokeLinecap="round" />
      <line x1="24" y1="10" x2="24" y2="23" stroke="rgba(255,255,255,0.85)" strokeWidth="2" strokeLinecap="round" />
      <path d="M24 13 Q24 10 27.5 10 Q31 10 31 13 L31 23" stroke="rgba(255,255,255,0.85)" strokeWidth="2" strokeLinecap="round" fill="none" />
      <rect x="34" y="10" width="11" height="13" rx="4.5" stroke="rgba(255,255,255,0.85)" strokeWidth="2" fill="none" />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Nav item icons (inline SVG — no package)
// ---------------------------------------------------------------------------

function IconJobs() {
  return (
    <svg width="15" height="15" viewBox="0 0 15 15" fill="none" aria-hidden="true">
      <rect x="1.5" y="3.5" width="12" height="9" rx="1.5" stroke="currentColor" strokeWidth="1.3" />
      <path d="M5 3.5V3a2 2 0 0 1 4 0v.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
      <line x1="1.5" y1="7" x2="13.5" y2="7" stroke="currentColor" strokeWidth="1.3" />
    </svg>
  );
}

function IconTracker() {
  return (
    <svg width="15" height="15" viewBox="0 0 15 15" fill="none" aria-hidden="true">
      <rect x="1.5" y="1.5" width="12" height="12" rx="1.5" stroke="currentColor" strokeWidth="1.3" />
      <line x1="1.5" y1="5.5" x2="13.5" y2="5.5" stroke="currentColor" strokeWidth="1.3" />
      <line x1="5.5" y1="1.5" x2="5.5" y2="5.5" stroke="currentColor" strokeWidth="1.3" />
      <line x1="5" y1="9" x2="10" y2="9" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  );
}

function IconDashboard() {
  return (
    <svg width="15" height="15" viewBox="0 0 15 15" fill="none" aria-hidden="true">
      <rect x="1.5" y="1.5" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.3" />
      <rect x="8.5" y="1.5" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.3" />
      <rect x="1.5" y="8.5" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.3" />
      <rect x="8.5" y="8.5" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.3" />
    </svg>
  );
}

function IconSignOut() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
      <path d="M5.5 2H2.5A1 1 0 0 0 1.5 3v8a1 1 0 0 0 1 1h3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
      <path d="M9.5 10l2.5-3-2.5-3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
      <line x1="12" y1="7" x2="5.5" y2="7" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Nav link
// ---------------------------------------------------------------------------

interface NavItemProps {
  href: string;
  label: string;
  icon: React.ReactNode;
  active: boolean;
  onClick: () => void;
}

function NavItem({ href, label, icon, active, onClick }: NavItemProps) {
  void href; // href used by caller for pathname matching; onClick handles navigation
  return (
    <button
      onClick={onClick}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        width: "100%",
        padding: "8px 10px",
        borderRadius: 6,
        fontSize: 13,
        fontWeight: active ? 500 : 400,
        color: active ? "rgba(255,255,255,0.90)" : "rgba(255,255,255,0.55)",
        background: active ? "rgba(27,170,193,0.10)" : "transparent",
        border: "none",
        cursor: "pointer",
        textAlign: "left",
        fontFamily: "inherit",
        transition: "background 0.12s, color 0.12s",
        marginBottom: 1,
      }}
    >
      <span
        style={{
          width: 18,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
          color: active ? "#1BAAC1" : "currentColor",
        }}
      >
        {icon}
      </span>
      {label}
      {/* Active indicator dot */}
      {active && (
        <span
          style={{
            marginLeft: "auto",
            width: 6,
            height: 6,
            borderRadius: "50%",
            background: "#1BAAC1",
            flexShrink: 0,
          }}
        />
      )}
    </button>
  );
}

// ---------------------------------------------------------------------------
// User initials helper
// ---------------------------------------------------------------------------

function getInitials(name?: string | null, email?: string | null): string {
  if (name) {
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    return parts[0].slice(0, 2).toUpperCase();
  }
  if (email) return email.slice(0, 2).toUpperCase();
  return "?";
}

// ---------------------------------------------------------------------------
// AppNav
// ---------------------------------------------------------------------------

const NAV_LINKS = [
  { href: "/feed",      label: "Jobs feed",  icon: <IconJobs /> },
  { href: "/tracker",   label: "Tracker",    icon: <IconTracker /> },
  { href: "/dashboard", label: "Dashboard",  icon: <IconDashboard /> },
] as const;

export default function AppNav() {
  const router = useRouter();
  const pathname = usePathname();
  const { signOut } = useAuthActions();
  const user = useQuery(api.users.getCurrentUser);

  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // ── Auth guard ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (user === undefined) return; // still loading
    if (user === null) router.replace("/login");
  }, [user, router]);

  // ── Close dropdown on outside click ────────────────────────────────────────
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    }
    if (dropdownOpen) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [dropdownOpen]);

  async function handleSignOut() {
    setDropdownOpen(false);
    await signOut();
    router.replace("/login");
  }

  const displayName = user?.name ?? user?.email ?? "";
  const initials = getInitials(user?.name, user?.email);
  const subLabel = user?.visaStatus
    ? user.visaStatus.replace("_", " ").replace(/\b\w/g, (c) => c.toUpperCase()) + " visa"
    : user?.email ?? "";

  return (
    <nav
      aria-label="App navigation"
      style={{
        width: 220,
        flexShrink: 0,
        background: "#011818",
        borderRight: "1px solid rgba(255,255,255,0.09)",
        display: "flex",
        flexDirection: "column",
        height: "100vh",
        position: "sticky",
        top: 0,
        fontFamily: "'Plus Jakarta Sans', sans-serif",
      }}
    >
      {/* ── Logo ─────────────────────────────────────────────────────────── */}
      <div
        style={{
          padding: "18px 20px 16px",
          borderBottom: "1px solid rgba(255,255,255,0.09)",
          display: "flex",
          alignItems: "center",
          gap: 10,
        }}
      >
        <TinoLogo />
        <span
          style={{
            fontFamily: "'DM Mono', monospace",
            fontSize: 8,
            letterSpacing: "1.5px",
            textTransform: "uppercase",
            color: "#1BAAC1",
            border: "1px solid rgba(27,170,193,0.30)",
            padding: "2px 6px",
            borderRadius: 2,
          }}
        >
          Beta
        </span>
      </div>

      {/* ── Primary nav ──────────────────────────────────────────────────── */}
      <div style={{ padding: "12px 8px 0", flex: 1 }}>
        {NAV_LINKS.map((link) => {
          // Match the active link — /feed also matches /feed/* etc.
          const active = pathname === link.href || pathname.startsWith(link.href + "/");
          return (
            <NavItem
              key={link.href}
              href={link.href}
              label={link.label}
              icon={link.icon}
              active={active}
              onClick={() => router.push(link.href)}
            />
          );
        })}
      </div>

      {/* ── User section ─────────────────────────────────────────────────── */}
      <div
        style={{
          padding: "0 8px 12px",
          borderTop: "1px solid rgba(255,255,255,0.09)",
          paddingTop: 14,
          position: "relative",
        }}
        ref={dropdownRef}
      >
        <button
          onClick={() => setDropdownOpen((v) => !v)}
          aria-haspopup="true"
          aria-expanded={dropdownOpen}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            width: "100%",
            padding: "8px 10px",
            borderRadius: 6,
            background: dropdownOpen ? "rgba(27,170,193,0.08)" : "transparent",
            border: "none",
            cursor: "pointer",
            fontFamily: "inherit",
            transition: "background 0.12s",
          }}
        >
          {/* Avatar */}
          <div
            style={{
              width: 28,
              height: 28,
              borderRadius: "50%",
              background: "#1BAAC1",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 10,
              fontWeight: 800,
              color: "#0a2828",
              flexShrink: 0,
              fontFamily: "'DM Mono', monospace",
            }}
          >
            {initials}
          </div>

          {/* Name + sub-label */}
          <div style={{ flex: 1, textAlign: "left", minWidth: 0 }}>
            <div
              style={{
                fontSize: 12,
                fontWeight: 600,
                color: "rgba(255,255,255,0.85)",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {displayName || "Account"}
            </div>
            {subLabel && (
              <div
                style={{
                  fontSize: 10,
                  color: "rgba(255,255,255,0.40)",
                  marginTop: 1,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {subLabel}
              </div>
            )}
          </div>

          {/* Chevron */}
          <svg
            width="10"
            height="10"
            viewBox="0 0 10 10"
            fill="none"
            aria-hidden="true"
            style={{
              flexShrink: 0,
              color: "rgba(255,255,255,0.35)",
              transform: dropdownOpen ? "rotate(180deg)" : "rotate(0deg)",
              transition: "transform 0.15s",
            }}
          >
            <path
              d="M2 3.5l3 3 3-3"
              stroke="currentColor"
              strokeWidth="1.4"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>

        {/* ── Dropdown menu ──────────────────────────────────────────────── */}
        {dropdownOpen && (
          <div
            role="menu"
            style={{
              position: "absolute",
              bottom: "calc(100% - 8px)",
              left: 8,
              right: 8,
              background: "#032a2a",
              border: "1px solid rgba(255,255,255,0.12)",
              borderRadius: 8,
              padding: "6px 0",
              boxShadow: "0 8px 24px rgba(0,0,0,0.45)",
              zIndex: 50,
            }}
          >
            {/* User info header */}
            <div
              style={{
                padding: "8px 14px 10px",
                borderBottom: "1px solid rgba(255,255,255,0.08)",
                marginBottom: 4,
              }}
            >
              <div
                style={{
                  fontSize: 12,
                  fontWeight: 600,
                  color: "rgba(255,255,255,0.85)",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {displayName || "Account"}
              </div>
              {user?.email && (
                <div
                  style={{
                    fontSize: 11,
                    color: "rgba(255,255,255,0.40)",
                    marginTop: 2,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {user.email}
                </div>
              )}
            </div>

            {/* Sign out */}
            <button
              role="menuitem"
              onClick={() => void handleSignOut()}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                width: "100%",
                padding: "8px 14px",
                background: "none",
                border: "none",
                cursor: "pointer",
                fontSize: 12,
                color: "rgba(255,107,107,0.85)",
                fontFamily: "inherit",
                textAlign: "left",
                transition: "background 0.1s",
              }}
              onMouseEnter={(e) =>
                ((e.currentTarget as HTMLButtonElement).style.background =
                  "rgba(255,107,107,0.08)")
              }
              onMouseLeave={(e) =>
                ((e.currentTarget as HTMLButtonElement).style.background = "none")
              }
            >
              <IconSignOut />
              Sign out
            </button>
          </div>
        )}
      </div>
    </nav>
  );
}
