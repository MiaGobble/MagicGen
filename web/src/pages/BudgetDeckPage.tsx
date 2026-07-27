import { useMemo, useState } from "react";
import { useSearchParams } from "react-router";
import { DeckActions } from "../components/DeckActions";
import { FormatBadge } from "../components/FormatBadge";
import { PowerLevelBadge } from "../components/PowerLevelBadge";
import { Seo } from "../components/Seo";
import { maybeShowKofiSupportToast, useToast } from "../components/Toast";
import { useDeckExport } from "../hooks/useDeckExport";
import { budgetizeDeck, type BudgetDeckResult, type BudgetProgress } from "../lib/budgetDeck";
import { parseDeckListAsync, serializeDeckList } from "../lib/deckFormat";
import { BRACKET_META, clampBracket } from "../lib/edhrec";
import { analyzeDeckPower, type PowerReport } from "../lib/powerLevel";
import { formatUsd } from "../lib/pricing";

export function BudgetDeckPage() {
  const { toast } = useToast();
  const { format } = useDeckExport();
  const [params] = useSearchParams();
  const initial = useMemo(() => {
    const raw = params.get("list");
    if (!raw) return "";
    try {
      return decodeURIComponent(raw);
    } catch {
      return raw;
    }
  }, [params]);

  const [input, setInput] = useState(initial);
  const [maxPrice, setMaxPrice] = useState(50);
  const [bracket, setBracket] = useState(() => clampBracket(Number(params.get("bracket") || 3)));
  const [commanderOverride, setCommanderOverride] = useState("");
  const [result, setResult] = useState<BudgetDeckResult | null>(null);
  const [powerBefore, setPowerBefore] = useState<PowerReport | null>(null);
  const [powerAfter, setPowerAfter] = useState<PowerReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<BudgetProgress | null>(null);

  const cutList = useMemo(
    () => (result ? serializeDeckList(result.lines, { format, includeSet: true }) : ""),
    [result, format],
  );

  async function onBudgetize() {
    setLoading(true);
    setError(null);
    setResult(null);
    setPowerBefore(null);
    setPowerAfter(null);
    setProgress({ done: 0, total: 5, label: "Starting…" });
    try {
      const out = await budgetizeDeck({
        listText: input,
        maxPrice,
        bracket,
        commanderName: commanderOverride.trim() || undefined,
        onProgress: setProgress,
      });
      setResult(out);
      setProgress({ done: 4, total: 6, label: "Analyzing power levels…" });
      const originalLines = await parseDeckListAsync(input);
      const [before, after] = await Promise.all([
        analyzeDeckPower(originalLines).catch(() => null),
        analyzeDeckPower(out.lines).catch(() => null),
      ]);
      setPowerBefore(before);
      setPowerAfter(after);
      if (out.underBudget) {
        toast(
          `Cut to est. ${formatUsd(out.estimatedPurchaseTotal)} (${out.swaps.length} swap${out.swaps.length === 1 ? "" : "s"})`,
          "success",
        );
      } else {
        toast(`Best effort: est. ${formatUsd(out.estimatedPurchaseTotal)} (still over target)`, "info");
      }
      maybeShowKofiSupportToast(toast, "budget-deck");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Budgetize failed");
      toast("Budgetize failed", "error");
    } finally {
      setLoading(false);
      setProgress(null);
    }
  }

  const progressPct =
    progress && progress.total > 0 ? Math.round((progress.done / progress.total) * 100) : 0;

  return (
    <div className="tool-page container">
      <Seo
        title="Deck Cost Cutter"
        description="Paste a commander deck, set a max price, and swap expensive cards for cheaper EDHREC picks."
        path="/budget"
      />
      <header className="tool-header">
        <h1>Deck cost cutter</h1>
        <p>
          Set a max all-in purchase budget (cards + estimated shipping), paste your commander list,
          and replace expensive cards with cheaper EDHREC recommendations.
        </p>
      </header>

      <details className="panel methodology">
        <summary>How it works</summary>
        <div className="methodology__body">
          <p>
            The commander stays fixed. Everything else (including pricey nonbasics) can be swapped.
            Basics are left alone. Replacements come from EDHREC for your target bracket (plus budget
            fillers for lower brackets), filtered to color identity, then priced via Scryfall USD.
            The budget target uses an estimated purchase total that includes shipping — TCGPlayer
            mass-entry is modeled as many marketplace sellers, while single stores use flat fees /
            free-ship thresholds.
          </p>
          <ul>
            <li>
              <strong>Detect.</strong> Uses the Commander section when present; otherwise finds a
              legendary commander-legal card, or the override name you enter.
            </li>
            <li>
              <strong>Bracket.</strong> Prefers that bracket’s EDHREC page and average deck. Cuts
              expensive off-bracket cards first; prefers in-bracket cheap replacements.
            </li>
            <li>
              <strong>Swap.</strong> Repeatedly replaces expensive cards until estimated purchase
              cost (cards + shipping) hits the budget or cheaper swaps run out.
            </li>
          </ul>
        </div>
      </details>

      <div className="split">
        <div className="field">
          <label htmlFor="budget-max">Max purchase budget (USD, incl. shipping)</label>
          <input
            id="budget-max"
            type="number"
            min={0}
            step={1}
            value={maxPrice}
            onChange={(e) => setMaxPrice(Number(e.target.value))}
          />
        </div>
        <div className="field">
          <label htmlFor="budget-bracket">Target bracket</label>
          <select
            id="budget-bracket"
            value={bracket}
            onChange={(e) => setBracket(clampBracket(Number(e.target.value)))}
          >
            {([1, 2, 3, 4, 5] as const).map((b) => (
              <option key={b} value={b}>
                Bracket {b} · {BRACKET_META[b].label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="field">
        <label htmlFor="budget-cmd">Commander (optional override)</label>
        <input
          id="budget-cmd"
          value={commanderOverride}
          onChange={(e) => setCommanderOverride(e.target.value)}
          placeholder="Auto-detect from list"
        />
      </div>

      <div className="field">
        <label htmlFor="budget-list">Commander deck list</label>
        <textarea
          id="budget-list"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={"Commander\n1 Atraxa, Praetors' Voice\n\nDeck\n1 Sol Ring\n1 Cyclonic Rift\n…"}
        />
      </div>

      <div className="actions">
        <button
          type="button"
          className="btn btn-primary"
          onClick={() => void onBudgetize()}
          disabled={loading || !input.trim() || maxPrice < 0}
        >
          {loading ? "Cutting costs…" : "Make it cheap"}
        </button>
      </div>

      {loading && progress && (
        <div
          className="progress-block"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={progress.total || 100}
          aria-valuenow={progress.done}
          aria-label="Deck cost cutter progress"
        >
          <div className="progress-block__meta">
            <span>{progress.label}</span>
            <span>{progressPct}%</span>
          </div>
          <div className="progress-track">
            <div className="progress-fill" style={{ width: `${progressPct}%` }} />
          </div>
          <p className="progress-block__note muted">
            EDHREC lookups plus Scryfall pricing - large decks take a bit.
          </p>
        </div>
      )}

      {error && <p className="error">{error}</p>}

      {result && (
        <>
          <section className="panel" style={{ marginTop: "1.25rem" }}>
            <h2 style={{ marginTop: 0 }}>{result.commanderName}</h2>
            <p>
              Cards <strong>{formatUsd(result.originalTotal)}</strong>
              {" → "}
              <strong>{formatUsd(result.newTotal)}</strong>
              <span className="muted">
                {" "}
                · est. purchase <strong>{formatUsd(result.estimatedPurchaseTotal)}</strong> (incl. ~
                {formatUsd(result.estimatedShipping)} ship)
              </span>
              <span className="muted">
                {" "}
                (target {formatUsd(result.maxPrice)} · Bracket {result.bracket} ·{" "}
                {BRACKET_META[result.bracket as 1 | 2 | 3 | 4 | 5]?.label}
                {result.underBudget ? " · under budget" : " · still over"})
              </span>
            </p>
            <p className="muted" style={{ marginBottom: 0 }}>
              {result.swaps.length} swap{result.swaps.length === 1 ? "" : "s"}
            </p>
            {(powerBefore || powerAfter) && (
              <div style={{ marginTop: "0.85rem", display: "grid", gap: "0.5rem" }}>
                {powerBefore && <PowerLevelBadge report={powerBefore} title="Before" compact />}
                {powerAfter && <PowerLevelBadge report={powerAfter} title="After" compact />}
              </div>
            )}
          </section>

          {result.swaps.length > 0 && (
            <details className="panel" style={{ marginTop: "1rem" }} open>
              <summary style={{ cursor: "pointer", fontWeight: 600 }}>
                Swap log ({result.swaps.length})
              </summary>
              <ul>
                {result.swaps.map((s, i) => (
                  <li key={`${s.from}-${s.to}-${i}`}>
                    {s.from} ({formatUsd(s.fromUsd)}) → {s.to} ({formatUsd(s.toUsd)})
                  </li>
                ))}
              </ul>
            </details>
          )}

          {result.notes.length > 0 && (
            <ul className="muted" style={{ marginTop: "0.75rem" }}>
              {result.notes.map((n) => (
                <li key={n}>{n}</li>
              ))}
            </ul>
          )}

          <section className="panel" style={{ marginTop: "1rem" }}>
            <h2 style={{ marginTop: 0 }}>Cut-cost list</h2>
            <FormatBadge />
            <pre className="list-block">{cutList}</pre>
            <div className="actions">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => {
                  void navigator.clipboard.writeText(cutList).then(
                    () => toast("Copied list", "success"),
                    () => toast("Could not copy", "error"),
                  );
                }}
              >
                Copy list
              </button>
            </div>
            <DeckActions list={cutList} />
          </section>
        </>
      )}
    </div>
  );
}
