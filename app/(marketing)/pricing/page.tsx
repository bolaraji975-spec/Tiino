/**
 * Pricing page — /pricing
 *
 * Three tiers: Free, Pro (monthly/annual toggle), Pay-per-CV.
 * Uses the Tino design system: dark bg #021e1e, teal #1BAAC1, sharp buttons.
 */

"use client";

import { useState } from "react";
import Link from "next/link";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type BillingCycle = "monthly" | "annual";

// ---------------------------------------------------------------------------
// Feature row data
// ---------------------------------------------------------------------------

const FREE_FEATURES = [
  "3 saved jobs",
  "1 CV generation per month",
  "Sponsorship band label (High / Medium / Low)",
  "Role-matched job feed",
  "Application tracker",
];

const PRO_FEATURES = [
  "Unlimited saved jobs",
  "20 CV generations per month",
  "Full numeric sponsorship score",
  "Signal-level score breakdown",
  "Daily job digest email",
  "Priority support",
];

const PAY_PER_CV_FEATURES = [
  "1 tailored CV + cover letter",
  "Credits never expire",
  "No subscription required",
  "Same AI quality as Pro",
];

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function Tick() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden="true"
      style={{ flexShrink: 0, marginTop: 2 }}
    >
      <circle cx="8" cy="8" r="8" fill="rgba(27,170,193,0.15)" />
      <path
        d="M4.5 8l2.5 2.5 4.5-4.5"
        stroke="#1BAAC1"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function FeatureList({ features }: { features: string[] }) {
  return (
    <ul style={{ listStyle: "none", padding: 0, margin: "24px 0 0", display: "flex", flexDirection: "column", gap: 12 }}>
      {features.map((f) => (
        <li key={f} style={{ display: "flex", alignItems: "flex-start", gap: 10, fontSize: 14, color: "rgba(255,255,255,0.75)", lineHeight: 1.5 }}>
          <Tick />
          {f}
        </li>
      ))}
    </ul>
  );
}

interface PricingCardProps {
  badge?: string;
  title: string;
  price: string;
  period: string;
  subtext?: string;
  features: string[];
  cta: string;
  ctaHref: string;
  highlighted?: boolean;
}

function PricingCard({
  badge,
  title,
  price,
  period,
  subtext,
  features,
  cta,
  ctaHref,
  highlighted = false,
}: PricingCardProps) {
  return (
    <div
      style={{
        background: highlighted ? "rgba(27,170,193,0.07)" : "#011818",
        border: `1px solid ${highlighted ? "#1BAAC1" : "rgba(255,255,255,0.08)"}`,
        borderRadius: 0,
        padding: "32px 28px",
        display: "flex",
        flexDirection: "column",
        position: "relative",
        flex: 1,
        minWidth: 260,
        maxWidth: 360,
      }}
    >
      {badge && (
        <div
          style={{
            position: "absolute",
            top: -12,
            left: 24,
            background: "#1BAAC1",
            color: "#0a2828",
            fontFamily: "var(--mono)",
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: "1.5px",
            textTransform: "uppercase",
            padding: "3px 10px",
          }}
        >
          {badge}
        </div>
      )}

      <div style={{ fontFamily: "var(--mono)", fontSize: 11, letterSpacing: "1.5px", textTransform: "uppercase", color: "rgba(255,255,255,0.45)", marginBottom: 8 }}>
        {title}
      </div>

      <div style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
        <span style={{ fontFamily: "var(--mono)", fontSize: 40, fontWeight: 700, color: "#ffffff" }}>
          {price}
        </span>
        <span style={{ fontFamily: "var(--mono)", fontSize: 14, color: "rgba(255,255,255,0.45)" }}>
          {period}
        </span>
      </div>

      {subtext && (
        <div style={{ fontFamily: "var(--mono)", fontSize: 12, color: "rgba(255,255,255,0.38)", marginTop: 4 }}>
          {subtext}
        </div>
      )}

      <FeatureList features={features} />

      <div style={{ marginTop: "auto", paddingTop: 28 }}>
        <Link
          href={ctaHref}
          style={{
            display: "block",
            textAlign: "center",
            background: highlighted ? "#1BAAC1" : "transparent",
            color: highlighted ? "#0a2828" : "#1BAAC1",
            border: `1px solid #1BAAC1`,
            borderRadius: 0,
            padding: "12px 0",
            fontFamily: "var(--sans)",
            fontSize: 14,
            fontWeight: 600,
            textDecoration: "none",
            transition: "opacity 0.15s",
          }}
        >
          {cta}
        </Link>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function PricingPage() {
  const [billing, setBilling] = useState<BillingCycle>("monthly");

  const annualSaving = Math.round(100 - (35 / (3.99 * 12)) * 100);

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#021e1e",
        color: "#ffffff",
        fontFamily: "var(--sans)",
      }}
    >
      {/* Nav */}
      <nav style={{ borderBottom: "1px solid rgba(255,255,255,0.06)", padding: "0 24px", height: 56, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <Link href="/" style={{ fontFamily: "var(--mono)", fontWeight: 700, fontSize: 18, color: "#1BAAC1", textDecoration: "none", letterSpacing: "-0.5px" }}>
          Tino
        </Link>
        <Link href="/login" style={{ fontFamily: "var(--sans)", fontSize: 14, color: "rgba(255,255,255,0.65)", textDecoration: "none" }}>
          Sign in
        </Link>
      </nav>

      {/* Hero */}
      <div style={{ textAlign: "center", padding: "72px 24px 48px" }}>
        <div style={{ fontFamily: "var(--mono)", fontSize: 11, letterSpacing: "2px", textTransform: "uppercase", color: "#1BAAC1", marginBottom: 16 }}>
          Pricing
        </div>
        <h1 style={{ fontSize: "clamp(28px, 5vw, 48px)", fontWeight: 700, margin: "0 0 16px", lineHeight: 1.15 }}>
          Simple, honest pricing
        </h1>
        <p style={{ fontSize: 16, color: "rgba(255,255,255,0.55)", maxWidth: 440, margin: "0 auto 40px" }}>
          Every job shown is from a verified UKVI sponsor. No recruiter spam, no guessing.
        </p>

        {/* Billing toggle */}
        <div style={{ display: "inline-flex", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 0, overflow: "hidden" }}>
          {(["monthly", "annual"] as BillingCycle[]).map((cycle) => (
            <button
              key={cycle}
              onClick={() => setBilling(cycle)}
              style={{
                padding: "8px 20px",
                background: billing === cycle ? "#1BAAC1" : "transparent",
                color: billing === cycle ? "#0a2828" : "rgba(255,255,255,0.55)",
                border: "none",
                fontFamily: "var(--mono)",
                fontSize: 12,
                fontWeight: 600,
                letterSpacing: "1px",
                textTransform: "uppercase",
                cursor: "pointer",
                transition: "all 0.15s",
              }}
            >
              {cycle === "monthly" ? "Monthly" : `Annual — save ${annualSaving}%`}
            </button>
          ))}
        </div>
      </div>

      {/* Cards */}
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 24,
          justifyContent: "center",
          padding: "0 24px 80px",
          maxWidth: 1100,
          margin: "0 auto",
        }}
      >
        {/* Free */}
        <PricingCard
          title="Free"
          price="£0"
          period="/month"
          features={FREE_FEATURES}
          cta="Get started free"
          ctaHref="/login"
        />

        {/* Pro */}
        {billing === "monthly" ? (
          <PricingCard
            badge="Most popular"
            title="Pro Monthly"
            price="£3.99"
            period="/month"
            features={PRO_FEATURES}
            cta="Start Pro"
            ctaHref="/login?plan=pro_monthly"
            highlighted
          />
        ) : (
          <PricingCard
            badge="Best value"
            title="Pro Annual"
            price="£35"
            period="/year"
            subtext="equiv. £2.92/mo"
            features={PRO_FEATURES}
            cta="Start Pro Annual"
            ctaHref="/login?plan=pro_annual"
            highlighted
          />
        )}

        {/* Pay-per-CV */}
        <PricingCard
          title="Pay-per-CV"
          price="£1.99"
          period="/credit"
          subtext="Credits never expire"
          features={PAY_PER_CV_FEATURES}
          cta="Buy a credit"
          ctaHref="/login?plan=pay_per_cv"
        />
      </div>

      {/* FAQ / Footer note */}
      <div style={{ textAlign: "center", padding: "0 24px 80px", color: "rgba(255,255,255,0.38)", fontSize: 13 }}>
        <p>All prices in GBP. Cancel anytime. VAT may apply.</p>
      </div>
    </div>
  );
}
