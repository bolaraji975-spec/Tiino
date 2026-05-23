"use client";

import { useState } from "react";
import { getLogoUrl, getClearbitUrl, getInitials, getInitialsColor } from "@/convex/lib/companyLogo";

interface CompanyLogoProps {
  company: string;
  size?: number;
}

/**
 * CompanyLogo — tries up to two logo sources before falling back to initials.
 *
 * Source order:
 *   1. Clearbit (high-quality, but 404s on unknown companies)
 *   2. Google Favicon service (always returns something)
 *   3. Colored initials square (deterministic brand-safe colour)
 *
 * For companies in our DOMAIN_OVERRIDES (NHS, Google, etc.) getLogoUrl already
 * returns the Google favicon URL directly, so those go straight to source 1/fallback.
 */
export function CompanyLogo({ company, size = 38 }: CompanyLogoProps) {
  // Track how many sources we've exhausted (0 = try primary, 1 = try secondary, 2 = initials)
  const [srcIndex, setSrcIndex] = useState(0);

  const logoUrl = getLogoUrl(company); // Google favicon for all companies now
  const initials = getInitials(company);
  const bg = getInitialsColor(company);

  const style: React.CSSProperties = {
    width: size,
    height: size,
    borderRadius: 8,
    flexShrink: 0,
    overflow: "hidden",
  };

  if (srcIndex < 1) {
    return (
      <div style={style}>
        <img
          src={logoUrl}
          alt={company}
          width={size}
          height={size}
          style={{ width: "100%", height: "100%", objectFit: "contain", display: "block" }}
          onError={() => setSrcIndex(1)}
        />
      </div>
    );
  }

  return (
    <div
      style={{
        ...style,
        background: bg,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: 12,
        fontWeight: 800,
        color: "#fff",
        fontFamily: "var(--mono, monospace)",
        letterSpacing: "0.5px",
      }}
    >
      {initials}
    </div>
  );
}
