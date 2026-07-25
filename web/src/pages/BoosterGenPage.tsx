import { useState } from "react";
import { DeckActions } from "../components/DeckActions";
import { Seo } from "../components/Seo";
import { maybeShowKofiSupportToast, useToast } from "../components/Toast";
import {
  BOOSTER_PRESETS,
  DEFAULT_BOOSTER_RULES,
  generateBoosters,
  type BoosterPresetId,
  type GeneratedPack,
  type RarityRule,
} from "../lib/booster";
import { getCardImage, type ScryfallCard } from "../lib/scryfall";
import { cardsToMoxfieldList } from "../lib/moxfield";

export function BoosterGenPage() {
  const { toast } = useToast();
  const [preset, setPreset] = useState<BoosterPresetId>("default");
  const [setCode, setSetCode] = useState("");
  const [defaultQuery, setDefaultQuery] = useState(BOOSTER_PRESETS.default.defaultQuery);
  const [packs, setPacks] = useState(1);
  const [rules, setRules] = useState<RarityRule[]>(DEFAULT_BOOSTER_RULES);
  const [pimpedPrintings, setPimpedPrintings] = useState(false);
  const [result, setResult] = useState<GeneratedPack[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function applyPreset(id: BoosterPresetId) {
    const p = BOOSTER_PRESETS[id];
    setPreset(id);
    setDefaultQuery(p.defaultQuery);
    setRules(p.rules.map((r) => ({ ...r })));
  }

  function addRule() {
    setRules((prev) => [...prev, { rarity: "common", count: 1, query: "r:common" }]);
  }

  function removeRule(index: number) {
    setRules((prev) => prev.filter((_, i) => i !== index));
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
    if (!rules.length) {
      setError("Add at least one rarity rule (or pick a preset).");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const packsOut = await generateBoosters({
        set: setCode || undefined,
        defaultQuery,
        packs,
        rules,
        pimpedPrintings,
      });
      setResult(packsOut);
      const n = packsOut.reduce((s, p) => s + p.cards.length, 0);
      toast(`Generated ${packsOut.length} pack${packsOut.length === 1 ? "" : "s"} (${n} cards)`, "success");
      maybeShowKofiSupportToast(toast, "boosters");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate");
      toast("Booster generation failed", "error");
    } finally {
      setLoading(false);
    }
  }

  const moxfield = result ? cardsToMoxfieldList(result.flatMap((p) => p.cards)) : "";

  return (
    <div className="tool-page container">
      <Seo
        title="Booster Pack Generator"
        description="Build custom Magic: The Gathering draft boosters with per-rarity Scryfall queries and presets."
        path="/booster"
      />
      <header className="tool-header">
        <h1>Booster pack generator</h1>
        <p>
          Build draftable packs with per-rarity Scryfall queries. Empty rarity queries fall back to
          the default query.
        </p>
      </header>

      <section className="panel" style={{ marginBottom: "1rem" }}>
        <h2 style={{ marginTop: 0, fontSize: "1.15rem" }}>Presets</h2>
        <div className="check-row" style={{ flexDirection: "column", alignItems: "stretch", gap: "0.35rem" }}>
          {(Object.keys(BOOSTER_PRESETS) as BoosterPresetId[]).map((id) => {
            const p = BOOSTER_PRESETS[id];
            return (
              <label key={id} className="check" style={{ padding: "0.35rem 0" }}>
                <input
                  type="radio"
                  name="booster-preset"
                  checked={preset === id}
                  onChange={() => applyPreset(id)}
                />
                <span>
                  <strong>{p.label}</strong>: {p.blurb}
                </span>
              </label>
            );
          })}
        </div>
      </section>

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
        <label className="check" style={{ gridColumn: "1 / -1" }}>
          <input
            type="checkbox"
            checked={pimpedPrintings}
            onChange={(e) => setPimpedPrintings(e.target.checked)}
          />
          Pimped printings (swap each card to a flashier printing)
        </label>
      </div>

      <section className="panel" style={{ marginTop: "1rem" }}>
        <h2 style={{ marginTop: 0, fontSize: "1.15rem" }}>Rarity rules</h2>
        {rules.length === 0 && (
          <p className="muted">No rarity rules. Add one or choose a preset.</p>
        )}
        {rules.map((rule, i) => (
          <div key={i} className="field-grid" style={{ marginBottom: "0.75rem", alignItems: "end" }}>
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
            <div className="field">
              <button type="button" className="btn btn-ghost" onClick={() => removeRule(i)}>
                Remove
              </button>
            </div>
          </div>
        ))}
        <button type="button" className="btn btn-ghost" onClick={addRule}>
          + Add rarity rule
        </button>
      </section>

      <div className="actions">
        <button type="button" className="btn btn-primary" onClick={onGenerate} disabled={loading}>
          {loading
            ? pimpedPrintings
              ? "Opening & pimping packs…"
              : "Opening packs…"
            : "Generate boosters"}
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
                    title={`${c.name} (${c.rarity}${c.set ? ` · ${c.set}` : ""})`}
                    style={{ width: 90, borderRadius: 6 }}
                  />
                ))}
              </div>
            </section>
          ))}
          <section className="panel" style={{ marginTop: "1rem" }}>
            <h2 style={{ marginTop: 0 }}>Combined list</h2>
            <pre className="list-block">{moxfield}</pre>
            <div className="actions">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => {
                  void navigator.clipboard.writeText(moxfield).then(
                    () => toast("Copied booster list", "success"),
                    () => toast("Could not copy", "error"),
                  );
                }}
              >
                Copy list
              </button>
            </div>
            <DeckActions list={moxfield} />
          </section>
        </>
      )}
    </div>
  );
}
