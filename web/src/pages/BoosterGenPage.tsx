import { useState } from "react";
import { DeckActions } from "../components/DeckActions";
import { FormatBadge } from "../components/FormatBadge";
import { Seo } from "../components/Seo";
import { maybeShowKofiSupportToast, useToast } from "../components/Toast";
import { useDeckExport } from "../hooks/useDeckExport";
import {
  BOOSTER_PRESETS,
  DEFAULT_BOOSTER_RULES,
  generateBoosters,
  type BoosterPresetId,
  type GeneratedPack,
  type RarityRule,
} from "../lib/booster";
import { getCardImage, type ScryfallCard } from "../lib/scryfall";
import type { DeckLine } from "../lib/deckFormat";

export function BoosterGenPage() {
  const { toast } = useToast();
  const { formatLines } = useDeckExport();
  const [preset, setPreset] = useState<BoosterPresetId>("default");
  const [setCode, setSetCode] = useState("");
  const [defaultQuery, setDefaultQuery] = useState(BOOSTER_PRESETS.default.defaultQuery);
  const [packs, setPacks] = useState(1);
  const [rules, setRules] = useState<RarityRule[]>(DEFAULT_BOOSTER_RULES);
  const [pimpedPrintings, setPimpedPrintings] = useState(false);
  const [uniqueCards, setUniqueCards] = useState(false);
  const [foilChance, setFoilChance] = useState(0);
  const [etchedChance, setEtchedChance] = useState(0);
  const [result, setResult] = useState<GeneratedPack[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<{ done: number; total: number; label?: string } | null>(
    null,
  );

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
    setProgress({ done: 0, total: 1, label: "Starting…" });
    try {
      const packsOut = await generateBoosters({
        set: setCode || undefined,
        defaultQuery,
        packs,
        rules,
        pimpedPrintings,
        uniqueCards,
        foilChance,
        etchedChance,
        onProgress: (done, total, label) => setProgress({ done, total, label }),
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
      setProgress(null);
    }
  }

  const moxfield = result
    ? formatLines(
        result.flatMap((p) => {
          const lines: DeckLine[] = [];
          p.cards.forEach((c, i) => {
            const finish = p.finishes?.[i];
            lines.push({
              quantity: 1,
              name: c.name.split(" // ")[0],
              setCode: c.set,
              collectorNumber: c.collector_number,
              finish,
              isFoil: finish === "foil" || undefined,
              category: "Deck",
            });
          });
          return lines;
        }),
      )
    : "";
  const progressPct =
    progress && progress.total > 0 ? Math.round((progress.done / progress.total) * 100) : 0;

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
          Build draftable packs with per-rarity Scryfall queries. Every pack is filtered to paper,
          playable cards (no art series, tokens, or digital-only).
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
        <label className="check" style={{ gridColumn: "1 / -1" }}>
          <input
            type="checkbox"
            checked={uniqueCards}
            onChange={(e) => setUniqueCards(e.target.checked)}
          />
          No duplicate cards (one of each name across all packs)
        </label>
        <div className="field">
          <label htmlFor="boost-foil">Foil chance (%)</label>
          <input
            id="boost-foil"
            type="number"
            min={0}
            max={100}
            value={foilChance}
            onChange={(e) => setFoilChance(Math.max(0, Math.min(100, Number(e.target.value) || 0)))}
          />
        </div>
        <div className="field">
          <label htmlFor="boost-etched">Etched chance (%)</label>
          <input
            id="boost-etched"
            type="number"
            min={0}
            max={100}
            value={etchedChance}
            onChange={(e) =>
              setEtchedChance(Math.max(0, Math.min(100, Number(e.target.value) || 0)))
            }
          />
        </div>
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

      {loading && progress && (
        <div
          className="progress-block"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={progress.total || 100}
          aria-valuenow={progress.done}
          aria-label="Booster generation progress"
        >
          <div className="progress-block__meta">
            <span>{progress.label ?? (progress.total > 0 ? `${progress.done} / ${progress.total}` : "Starting…")}</span>
            <span>{progressPct}%</span>
          </div>
          <div className="progress-track">
            <div className="progress-fill" style={{ width: `${progressPct}%` }} />
          </div>
          <p className="progress-block__note muted">
            Cards are requested in chunks of 20
            {progress.total > 1 ? ` · step ${progress.done} of ${progress.total}` : ""}.
          </p>
        </div>
      )}

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
            <FormatBadge />
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
