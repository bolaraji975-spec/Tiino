/**
 * ScoreBand — sponsorship likelihood pill.
 *
 * Shows a coloured badge based on the job's sponsorshipBand.
 * Pro users also see the numeric score (pass showScore + score).
 */

export type Band = "high" | "medium" | "low" | "very_low";

interface ScoreBandProps {
  band: Band;
  score?: number;
  showScore?: boolean;
}

const CONFIG: Record<Band, { label: string; bg: string; color: string }> = {
  high:     { label: "Likely to sponsor", bg: "rgba(74,222,128,0.12)",  color: "#4ade80" },
  medium:   { label: "May sponsor",       bg: "rgba(251,191,36,0.12)",  color: "#fbbf24" },
  low:      { label: "Unlikely",          bg: "rgba(255,107,107,0.10)", color: "#ff6b6b" },
  very_low: { label: "Unknown",           bg: "rgba(150,150,150,0.10)", color: "rgba(255,255,255,0.38)" },
};

export function ScoreBand({ band, score, showScore = false }: ScoreBandProps) {
  const cfg = CONFIG[band] ?? CONFIG.very_low;

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        fontSize: 11,
        fontWeight: 700,
        padding: "3px 8px",
        borderRadius: 4,
        background: cfg.bg,
        color: cfg.color,
        whiteSpace: "nowrap",
        flexShrink: 0,
      }}
    >
      <span
        style={{
          width: 5,
          height: 5,
          borderRadius: "50%",
          background: "currentColor",
          flexShrink: 0,
        }}
      />
      {cfg.label}
      {showScore && score !== undefined && ` · ${score}`}
    </span>
  );
}
