import { useRef, useState } from "react";
import { Seo } from "../components/Seo";
import { maybeShowKofiSupportToast, useToast } from "../components/Toast";
import { matchSleeveColor, type SleeveMatchResult } from "../lib/amazon";
import { isSafeExternalHref } from "../lib/safeUrl";

export function SleeveColorPage() {
  const { toast } = useToast();
  const [color, setColor] = useState("#2a6b55");
  const [premium, setPremium] = useState(true);
  const [result, setResult] = useState<SleeveMatchResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [stageLabel, setStageLabel] = useState("Matching…");
  const [stagePct, setStagePct] = useState(0);
  const runId = useRef(0);

  async function onFindSleeves() {
    const id = ++runId.current;
    setLoading(true);
    setStageLabel("Naming color…");
    setStagePct(10);
    try {
      const match = await matchSleeveColor(color, premium, "any", (_stage, label, pct) => {
        if (runId.current !== id) return;
        setStageLabel(label);
        setStagePct(pct);
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
      <Seo
        title="Sleeve Color Matcher"
        description="Pick a color and find matching Dragon Shield, Ultimate Guard, and other Magic card sleeves on Amazon."
        path="/sleeves"
      />
      <header className="tool-header">
        <h1>Sleeve color matcher</h1>
        <p>
          Pick a color. MagicGen names it, searches Amazon sleeve listings, reads each listing&apos;s
          Color/Style data when available, and falls back to a curated catalog if live search fails.
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
          <label className="check" style={{ marginTop: "1rem" }}>
            <input type="checkbox" checked={premium} onChange={(e) => setPremium(e.target.checked)} />
            Prefer premium brands (soft preference; better color wins)
          </label>
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
                  {result.listingStyle ? (
                    <p className="muted" style={{ margin: 0 }}>
                      Listing style: {result.listingStyle}
                    </p>
                  ) : null}
                </div>
              </div>
              <p style={{ marginTop: "1rem" }}>{result.title}</p>
              <a
                className="btn btn-brass"
                href={isSafeExternalHref(result.url) ? result.url : "https://www.amazon.com/s?k=Dragon+Shield+Matte"}
                target="_blank"
                rel="noopener noreferrer"
              >
                {result.url.includes("/dp/") ? "Open product on Amazon" : "Open color search on Amazon"}
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
