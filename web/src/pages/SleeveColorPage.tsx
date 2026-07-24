import { useRef, useState } from "react";
import { maybeShowKofiSupportToast, useToast } from "../components/Toast";
import {
  matchSleeveColor,
  type SleeveMatchResult,
  type SleeveMatchStage,
} from "../lib/amazon";

const STAGE_PCT: Record<SleeveMatchStage, number> = {
  naming: 15,
  catalog: 45,
  amazon: 75,
  done: 100,
};

export function SleeveColorPage() {
  const { toast } = useToast();
  const [color, setColor] = useState("#2a6b55");
  const [premium, setPremium] = useState(true);
  const [art, setArt] = useState<"any" | "art" | "basic">("any");
  const [result, setResult] = useState<SleeveMatchResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [stageLabel, setStageLabel] = useState("Matching…");
  const [stagePct, setStagePct] = useState(0);
  const runId = useRef(0);

  async function onFindSleeves() {
    const id = ++runId.current;
    setLoading(true);
    setStageLabel("Naming color…");
    setStagePct(STAGE_PCT.naming);
    try {
      const match = await matchSleeveColor(color, premium, art, (stage, label) => {
        if (runId.current !== id) return;
        setStageLabel(label);
        setStagePct(STAGE_PCT[stage]);
      });
      if (runId.current !== id) return;
      setResult(match);
      toast("Sleeve match ready", "success");
      maybeShowKofiSupportToast(toast);
    } catch {
      if (runId.current !== id) return;
      setResult(null);
      toast("Sleeve match failed", "error");
    } finally {
      if (runId.current === id) setLoading(false);
    }
  }

  return (
    <div className="tool-page container">
      <header className="tool-header">
        <h1>Sleeve color matcher</h1>
        <p>
          Pick a color. We derive sleeve color names from it, score curated brands (and live Amazon
          search when available), and open the best-matching product.
        </p>
      </header>

      <div className="split">
        <div className="panel">
          <div className="field">
            <label htmlFor="sleeve-color">Color</label>
            <input
              id="sleeve-color"
              type="color"
              value={color}
              onChange={(e) => setColor(e.target.value)}
              style={{ height: 48, padding: 4 }}
            />
          </div>
          <div
            className="color-swatch"
            style={{ background: color, marginTop: "0.75rem" }}
            aria-hidden
          />
          <label className="check" style={{ marginTop: "1rem" }}>
            <input type="checkbox" checked={premium} onChange={(e) => setPremium(e.target.checked)} />
            Prefer premium brands (soft preference; better color wins)
          </label>
          <div className="field" style={{ marginTop: "0.75rem" }}>
            <label htmlFor="art-pref">Art preference</label>
            <select
              id="art-pref"
              value={art}
              onChange={(e) => setArt(e.target.value as typeof art)}
            >
              <option value="any">Any (color first)</option>
              <option value="art">Art / dual art sleeves</option>
              <option value="basic">Basic matte color</option>
            </select>
            <p className="muted" style={{ marginTop: "0.35rem", fontSize: "0.9rem" }}>
              Art prefers illustrated dual-art sleeves; basic prefers solid matte colors.
            </p>
          </div>
          <div className="actions">
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => void onFindSleeves()}
              disabled={loading}
            >
              {loading ? "Matching…" : "Find sleeves"}
            </button>
          </div>
        </div>

        <div className="panel panel-strong">
          {loading && (
            <div
              className="progress-block"
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={stagePct}
              aria-label="Sleeve matching progress"
              style={{ marginTop: 0 }}
            >
              <div className="progress-block__meta">
                <span>{stageLabel}</span>
                <span>{stagePct}%</span>
              </div>
              <div className="progress-track">
                <div
                  className={`progress-fill${stagePct < 100 ? " progress-fill--pulse" : ""}`}
                  style={{ width: `${stagePct}%` }}
                />
              </div>
            </div>
          )}
          {result ? (
            <>
              <h2 style={{ marginTop: loading ? "1rem" : 0 }}>Best match</h2>
              <p className="muted" style={{ marginTop: 0 }}>
                Color names tried: {result.colorNames.join(", ")}
              </p>
              <div style={{ display: "flex", gap: "0.75rem", alignItems: "center" }}>
                <div
                  className="color-swatch"
                  style={{ width: 48, height: 48, margin: 0, background: result.matchHex }}
                  title={result.colorName}
                />
                <div>
                  <p style={{ margin: 0 }}>
                    <strong>{result.colorName}</strong>
                  </p>
                  <p className="muted" style={{ margin: 0 }}>
                    Hue family: {result.hue}
                    {result.source === "amazon" ? " · live Amazon hit" : " · catalog match"}
                  </p>
                </div>
              </div>
              <p style={{ marginTop: "1rem" }}>{result.title}</p>
              <a className="btn btn-brass" href={result.url} target="_blank" rel="noreferrer">
                Open product on Amazon
              </a>
            </>
          ) : null}
          {!loading && !result ? (
            <p className="muted">Adjust your color and options, then click Find sleeves.</p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
