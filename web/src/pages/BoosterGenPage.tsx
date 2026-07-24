import { useState } from "react";
import { DeckActions } from "../components/DeckActions";
import { DEFAULT_BOOSTER_RULES, generateBoosters, type GeneratedPack, type RarityRule } from "../lib/booster";
import { getCardImage, type ScryfallCard } from "../lib/scryfall";
import { cardsToMoxfieldList } from "../lib/moxfield";

export function BoosterGenPage() {
  const [setCode, setSetCode] = useState("");
  const [defaultQuery, setDefaultQuery] = useState("game:paper -is:digital -is:token");
  const [packs, setPacks] = useState(1);
  const [rules, setRules] = useState<RarityRule[]>(DEFAULT_BOOSTER_RULES);
  const [result, setResult] = useState<GeneratedPack[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function addRule() {
    setRules((prev) => [...prev, { rarity: "common", count: 1, query: "r:common" }]);
  }

  function updateRule(index: number, patch: Partial<RarityRule>) {
    setRules((prev) =>
      prev.map((r, i) => {
        if (i !== index) return r;
        const next = { ...r, ...patch };
        if (patch.rarity && (!r.query.trim() || /^r:(common|uncommon|rare|mythic)\b/i.test(r.query))) {
          const rest = r.query.replace(/^r:(common|uncommon|rare|mythic)\s*/i, "").trim();
          next.query = rest ? `r:${patch.rarity} ${rest}` : `r:${patch.rarity}`;
        }
        return next;
      }),
    );
  }

  async function onGenerate() {
    setLoading(true);
    setError(null);
    try {
      const packsOut = await generateBoosters({
        set: setCode || undefined,
        defaultQuery,
        packs,
        rules,
      });
      setResult(packsOut);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate");
    } finally {
      setLoading(false);
    }
  }

  const moxfield = result
    ? cardsToMoxfieldList(result.flatMap((p) => p.cards))
    : "";

  return (
    <div className="tool-page container">
      <header className="tool-header">
        <h1>Booster pack generator</h1>
        <p>
          Build draftable packs with per-rarity Scryfall queries. Empty rarity queries fall back to
          the default query.
        </p>
      </header>

      <div className="panel field-grid">
        <div className="field">
          <label htmlFor="boost-set">Set code (optional)</label>
          <input id="boost-set" value={setCode} onChange={(e) => setSetCode(e.target.value)} placeholder="mh3" />
        </div>
        <div className="field">
          <label htmlFor="boost-packs">Number of packs</label>
          <input
            id="boost-packs"
            type="number"
            min={1}
            max={12}
            value={packs}
            onChange={(e) => setPacks(Number(e.target.value))}
          />
        </div>
        <div className="field" style={{ gridColumn: "1 / -1" }}>
          <label htmlFor="boost-q">Default query</label>
          <input
            id="boost-q"
            value={defaultQuery}
            onChange={(e) => setDefaultQuery(e.target.value)}
          />
        </div>
      </div>

      <section className="panel" style={{ marginTop: "1rem" }}>
        <h2 style={{ marginTop: 0, fontSize: "1.15rem" }}>Rarity rules</h2>
        {rules.map((rule, i) => (
          <div key={i} className="field-grid" style={{ marginBottom: "0.75rem" }}>
            <div className="field">
              <label>Rarity</label>
              <select
                value={rule.rarity}
                onChange={(e) =>
                  updateRule(i, { rarity: e.target.value as RarityRule["rarity"] })
                }
              >
                <option value="common">Common</option>
                <option value="uncommon">Uncommon</option>
                <option value="rare">Rare</option>
                <option value="mythic">Mythic</option>
              </select>
            </div>
            <div className="field">
              <label>Count</label>
              <input
                type="number"
                min={0}
                max={20}
                value={rule.count}
                onChange={(e) => updateRule(i, { count: Number(e.target.value) })}
              />
            </div>
            <div className="field">
              <label>Extra query (optional)</label>
              <input
                value={rule.query}
                onChange={(e) => updateRule(i, { query: e.target.value })}
                placeholder="e.g. r:common type:creature"
              />
            </div>
          </div>
        ))}
        <button type="button" className="btn btn-ghost" onClick={addRule}>
          + Add rarity rule
        </button>
      </section>

      <div className="actions">
        <button type="button" className="btn btn-primary" onClick={onGenerate} disabled={loading}>
          {loading ? "Opening packs…" : "Generate boosters"}
        </button>
      </div>

      {error && <p className="error">{error}</p>}

      {result && (
        <>
          {result.map((pack) => (
            <section key={pack.index} className="panel" style={{ marginTop: "1rem" }}>
              <h2 style={{ marginTop: 0 }}>Pack {pack.index}</h2>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
                {pack.cards.map((c: ScryfallCard, idx) => (
                  <img
                    key={`${c.id}-${idx}`}
                    src={getCardImage(c)}
                    alt={c.name}
                    title={`${c.name} (${c.rarity})`}
                    style={{ width: 90, borderRadius: 6 }}
                  />
                ))}
              </div>
            </section>
          ))}
          <section className="panel" style={{ marginTop: "1rem" }}>
            <h2 style={{ marginTop: 0 }}>Combined list</h2>
            <pre className="list-block">{moxfield}</pre>
            <DeckActions list={moxfield} />
          </section>
        </>
      )}
    </div>
  );
}
