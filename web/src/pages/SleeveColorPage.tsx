import { useEffect, useState } from "react";
import { sleeveQueryFor } from "../lib/amazon";

export function SleeveColorPage() {
  const [color, setColor] = useState("#2a6b55");
  const [premium, setPremium] = useState(true);
  const [art, setArt] = useState<"any" | "art" | "basic">("any");
  const [result, setResult] = useState<ReturnType<typeof sleeveQueryFor> | null>(null);

  // Recompute whenever settings change so premium / art preference always matter
  useEffect(() => {
    setResult(sleeveQueryFor(color, premium, art));
  }, [color, premium, art]);

  return (
    <div className="tool-page container">
      <header className="tool-header">
        <h1>Sleeve color matcher</h1>
        <p>
          Pick a color — we build a live Amazon search for that exact sleeve color (Dragon Shield
          Matte names when premium).
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
            Prefer premium brands
          </label>
          <div className="field" style={{ marginTop: "0.75rem" }}>
            <label htmlFor="art-pref">Art preference</label>
            <select
              id="art-pref"
              value={art}
              onChange={(e) => setArt(e.target.value as typeof art)}
            >
              <option value="any">Any</option>
              <option value="art">Art sleeves</option>
              <option value="basic">Basic color</option>
            </select>
          </div>
        </div>

        <div className="panel panel-strong">
          {result ? (
            <>
              <h2 style={{ marginTop: 0 }}>Closest match</h2>
              <p>
                Mapped hue: <strong>{result.hue}</strong> → <strong>{result.colorName}</strong>
              </p>
              <p>{result.title}</p>
              <p className="muted" style={{ fontSize: "0.85rem" }}>
                Search: {result.query}
              </p>
              <a className="btn btn-brass" href={result.url} target="_blank" rel="noreferrer">
                Open on Amazon
              </a>
            </>
          ) : (
            <p className="muted">Pick a color to see a matched sleeve search.</p>
          )}
        </div>
      </div>
    </div>
  );
}
