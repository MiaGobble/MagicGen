import { useState } from "react";
import { buildSupplyQueries, SUPPLY_LABELS, type SupplyKey } from "../lib/amazon";
import { useToast } from "../components/Toast";

const ITEMS = (Object.keys(SUPPLY_LABELS) as Exclude<SupplyKey, "comboSets">[]).map((key) => ({
  key,
  label: SUPPLY_LABELS[key],
}));

export function SuppliesPage() {
  const { toast } = useToast();
  const [selected, setSelected] = useState<SupplyKey[]>([
    "d20",
    "d6",
    "sleeves",
    "deckBoxes",
  ]);
  const [premium, setPremium] = useState(true);
  const [spindown, setSpindown] = useState(true);
  const [deckBoxType, setDeckBoxType] = useState<"any" | "magnetic" | "plastic">("any");
  const [playmatType, setPlaymatType] = useState<"any" | "art" | "basic">("any");
  const [allowCombo, setAllowCombo] = useState(false);
  const [results, setResults] = useState<ReturnType<typeof buildSupplyQueries> | null>(null);

  function toggle(key: SupplyKey) {
    setSelected((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]));
  }

  function onGenerate() {
    const next = buildSupplyQueries({
      items: selected,
      premium,
      spindown,
      deckBoxType,
      playmatType,
      allowCombo,
    });
    setResults(next);
    toast(`Ready: ${next.length} supply link${next.length === 1 ? "" : "s"}`, "success");
  }

  return (
    <div className="tool-page container">
      <header className="tool-header">
        <h1>MTG supplies</h1>
        <p>
          Check what you need, tune preferences, then open Amazon <strong>search</strong> results
          matched to those choices (brand tier, box type, mat type, and more). Each link is a
          search, not a single product page, so you pick the listing.
        </p>
      </header>

      <section className="panel">
        <h2 style={{ marginTop: 0, fontSize: "1.15rem" }}>Supplies</h2>
        <div className="check-row">
          {ITEMS.map((item) => (
            <label key={item.key} className="check">
              <input
                type="checkbox"
                checked={selected.includes(item.key)}
                onChange={() => toggle(item.key)}
              />
              {item.label}
            </label>
          ))}
        </div>
      </section>

      <section className="panel" style={{ marginTop: "1rem" }}>
        <h2 style={{ marginTop: 0, fontSize: "1.15rem" }}>Preferences</h2>
        <div className="field-grid">
          <div className="field">
            <label htmlFor="pref">Query preference</label>
            <select
              id="pref"
              value={premium ? "premium" : "budget"}
              onChange={(e) => setPremium(e.target.value === "premium")}
            >
              <option value="premium">Premium (name brands)</option>
              <option value="budget">Off-brand / budget</option>
            </select>
          </div>
          <div className="field">
            <label htmlFor="boxType">Deck box type</label>
            <select
              id="boxType"
              value={deckBoxType}
              onChange={(e) => setDeckBoxType(e.target.value as typeof deckBoxType)}
            >
              <option value="any">Any</option>
              <option value="magnetic">Magnetic leather</option>
              <option value="plastic">Plastic</option>
            </select>
          </div>
          <div className="field">
            <label htmlFor="matType">Playmat type</label>
            <select
              id="matType"
              value={playmatType}
              onChange={(e) => setPlaymatType(e.target.value as typeof playmatType)}
            >
              <option value="any">Any</option>
              <option value="art">Art</option>
              <option value="basic">Basic color</option>
            </select>
          </div>
        </div>
        <div className="check-row" style={{ marginTop: "0.85rem" }}>
          <label className="check">
            <input type="checkbox" checked={spindown} onChange={(e) => setSpindown(e.target.checked)} />
            Require D20 spindown
          </label>
          <label className="check">
            <input
              type="checkbox"
              checked={allowCombo}
              onChange={(e) => setAllowCombo(e.target.checked)}
            />
            Allow combo / bulk sets
          </label>
        </div>
      </section>

      <div className="actions">
        <button type="button" className="btn btn-primary" onClick={onGenerate} disabled={!selected.length}>
          Get supplies
        </button>
      </div>

      {results && (
        <section className="panel panel-strong" style={{ marginTop: "1.25rem" }}>
          <h2 style={{ marginTop: 0 }}>Your supplies list</h2>
          <ul className="tool-links" style={{ listStyle: "none", padding: 0 }}>
            {results.map((r) => (
              <li key={`${r.label}-${r.id}`}>
                <a className="tool-link" href={r.url} target="_blank" rel="noreferrer">
                  <span className="tool-link__index">↗</span>
                  <span>
                    <h3>{r.label}</h3>
                    <p>{r.title}</p>
                  </span>
                </a>
              </li>
            ))}
          </ul>
          <p className="disclosure">
            Every result opens an <strong>Amazon search</strong> for that supply type (affiliate tag
            igottic-20), not a fixed product page. Compare listings and choose one that matches the
            title intent; stock and sellers change often.
          </p>
        </section>
      )}
    </div>
  );
}
