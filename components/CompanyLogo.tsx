"use client";

import { useState } from "react";
import { getLogoUrl, getInitials, getInitialsColor } from "@/convex/lib/companyLogo";

interface CompanyLogoProps {
  company: string;
  size?: number;
}

export function CompanyLogo({ company, size = 38 }: CompanyLogoProps) {
  const [imgError, setImgError] = useState(false);

  const logoUrl = getLogoUrl(company);
  const initials = getInitials(company);
  const bg = getInitialsColor(company);

  const style: React.CSSProperties = {
    width: size,
    height: size,
    borderRadius: 8,
    flexShrink: 0,
    overflow: "hidden",
  };

  if (!imgError) {
    return (
      <div style={style}>
        <img
          src={logoUrl}
          alt={company}
          width={size}
          height={size}
          style={{ width: "100%", height: "100%", objectFit: "contain", display: "block" }}
          onError={() => setImgError(true)}
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
