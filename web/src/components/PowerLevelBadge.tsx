import type { PowerReport } from "../lib/powerLevel";

type Props = {
  report: PowerReport;
  /** Optional label above the stats (e.g. "After cuts"). */
  title?: string;
  compact?: boolean;
};

/** Compact power level + bracket readout. */
export function PowerLevelBadge({ report, title, compact }: Props) {
  return (
    <div
      className={`power-badge${compact ? " power-badge--compact" : ""}`}
      style={{
        marginTop: compact ? "0.5rem" : "0.75rem",
        padding: compact ? "0.65rem 0.85rem" : "0.85rem 1rem",
        borderRadius: "var(--radius-sm)",
        border: "1px solid var(--border)",
        background: "rgba(255,255,255,0.45)",
      }}
    >
      {title && (
        <p style={{ margin: "0 0 0.35rem", fontWeight: 700, fontSize: "0.9rem" }}>{title}</p>
      )}
      <p style={{ margin: 0, display: "flex", flexWrap: "wrap", gap: "0.35rem 1rem" }}>
        <span>
          Power <strong>{report.powerLevel.toFixed(2)}</strong>
          <span className="muted"> / 10</span>
        </span>
        <span>
          Bracket <strong>{report.bracket}</strong>
          <span className="muted"> · {report.bracketLabel}</span>
        </span>
        {!compact && (
          <>
            <span className="muted">Score {report.score}/1000</span>
            <span className="muted">Impact {report.impact.toFixed(1)}</span>
            <span className="muted">Efficiency {report.efficiency.toFixed(2)}</span>
          </>
        )}
      </p>
      {!compact && report.notes[0] && (
        <p className="muted" style={{ margin: "0.35rem 0 0", fontSize: "0.85rem" }}>
          {report.notes[0]}
        </p>
      )}
    </div>
  );
}
