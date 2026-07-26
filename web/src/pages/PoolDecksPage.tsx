import { useMemo, useState } from "react";
import { useSearchParams } from "react-router";
import { DeckActions } from "../components/DeckActions";
import { FormatBadge } from "../components/FormatBadge";
import { ColorIdentity } from "../components/Mana";
import { PowerLevelBadge } from "../components/PowerLevelBadge";
import { Seo } from "../components/Seo";
import { maybeShowKofiSupportToast, useToast } from "../components/Toast";
import { useDeckExport } from "../hooks/useDeckExport";
import {
  clampDeckCount,
  generatePoolDecks,
  MIN_DECKS,
  type PoolDeck,
  type PoolProgress,
  type PoolStrategy,
} from "../lib/poolDecks";

const STRATEGIES: { id: PoolStrategy; label: string; blurb: string }[] = [
  {
    id: "color",
    label: "Color identity",
    blurb: "Coherent mana - cards go to seats they fit, exclusives first.",
  },
  {
    id: "balanced",
    label: "Balanced",
    blurb: "Snake-draft high-value cards so each seat gets a fair share.",
  },
  {
    id: "greedy",
    label: "Greedy",
    blurb: "Best deck first, then the next from leftovers.",
  },
];

export function PoolDecksPage() {
  const { toast } = useToast();
  const { formatLines } = useDeckExport();
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
  const [deckCount, setDeckCount] = useState(2);
  const [strategy, setStrategy] = useState<PoolStrategy>("color");
  const [decks, setDecks] = useState<PoolDeck[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<PoolProgress | null>(null);

  async function onGenerate() {
    setLoading(true);
    setError(null);
    setDecks(null);
    setProgress({ done: 0, total: 4, label: "Starting…" });
    try {
      const result = await generatePoolDecks({
        listText: input,
        deckCount: clampDeckCount(deckCount),
        strategy,
        onProgress: setProgress,
      });
      setDecks(result);
      toast(
        `Built ${result.length} commander deck${result.length === 1 ? "" : "s"}`,
        "success",
      );
      maybeShowKofiSupportToast(toast, "pool-decks");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to build decks");
      toast("Pool to decks failed", "error");
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
        title="Pool to Decks"
        description="Turn a shared card pool into multiple Commander decks with color, balanced, or greedy splits."
        path="/pool-decks"
      />
      <header className="tool-header">
        <h1>Pool to decks</h1>
        <p>
          Paste a shared card pool, pick how many Commander decks to build, and split by color,
          balance, or greedy - each seat drafts using EDHREC synergy with its commander.
        </p>
      </header>

      <details className="panel methodology">
        <summary>How it works</summary>
        <div className="methodology__body">
          <p>
            Looks up your pool on Scryfall, drops cards that aren’t legal in Commander, then picks
            commanders ranked by EDHREC popularity. Each seat loads that commander’s EDHREC synergy
            (Optimized → Upgraded → overall) plus average-deck staples, and drafts the highest-synergy
            legal cards that fit color identity.
          </p>
          <ul>
            <li>
              <strong>Color identity.</strong> Cards that only fit one seat go there first; shared
              cards prefer the seat with the best EDHREC synergy score.
            </li>
            <li>
              <strong>Balanced.</strong> Snake-drafts high-synergy cards across seats so value is
              shared more evenly.
            </li>
            <li>
              <strong>Greedy.</strong> Builds the strongest seat first (best commander + top synergy
              cards), then the next from leftovers.
            </li>
            <li>
              <strong>Lands.</strong> Targets about 37 lands (band 35–39), padding with basics when
              the pool is short.
            </li>
          </ul>
          <p className="muted" style={{ marginBottom: 0 }}>
            Partners are not supported yet - one commander per deck. You need at least as many
            commander-legal cards as decks.
          </p>
        </div>
      </details>

      <div className="split">
        <div className="field">
          <label htmlFor="pool-count">Number of decks</label>
          <input
            id="pool-count"
            type="number"
            min={MIN_DECKS}
            step={1}
            value={deckCount}
            onChange={(e) => setDeckCount(clampDeckCount(Number(e.target.value)))}
          />
          <p className="muted" style={{ margin: 0, fontSize: "0.88rem" }}>
            No upper limit. You need at least as many commander-legal cards as decks.
          </p>
        </div>
      </div>

      <fieldset className="field" style={{ border: "none", padding: 0, margin: "1rem 0" }}>
        <legend style={{ fontWeight: 600, marginBottom: "0.5rem" }}>Build strategy</legend>
        <div style={{ display: "grid", gap: "0.65rem" }}>
          {STRATEGIES.map((s) => (
            <label key={s.id} className="check" style={{ alignItems: "flex-start" }}>
              <input
                type="radio"
                name="pool-strategy"
                value={s.id}
                checked={strategy === s.id}
                onChange={() => setStrategy(s.id)}
              />
              <span>
                <strong>{s.label}</strong>
                <span className="muted" style={{ display: "block", fontWeight: 400 }}>
                  {s.blurb}
                </span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      <div className="field">
        <label htmlFor="pool-list">Card pool</label>
        <p className="muted" style={{ margin: "0 0 0.35rem" }}>
          Lists accept Moxfield, Archidekt, HXDEC, and plain text.
        </p>
        <textarea
          id="pool-list"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={"1 Atraxa, Praetors' Voice\n1 The Ur-Dragon\n1 Sol Ring\n1 Command Tower\n…"}
          rows={12}
        />
      </div>

      <div className="actions">
        <button
          type="button"
          className="btn btn-primary"
          onClick={() => void onGenerate()}
          disabled={loading || !input.trim()}
        >
          {loading ? "Building decks…" : "Build decks"}
        </button>
      </div>

      {loading && progress && (
        <div
          className="progress-block"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={progress.total || 100}
          aria-valuenow={progress.done}
          aria-label="Pool to decks progress"
        >
          <div className="progress-block__meta">
            <span>{progress.label}</span>
            <span>{progressPct}%</span>
          </div>
          <div className="progress-track">
            <div className="progress-fill" style={{ width: `${progressPct}%` }} />
          </div>
          <p className="progress-block__note muted">
            Scryfall lookup plus EDHREC synergy per commander - large pools take a bit.
          </p>
        </div>
      )}

      {error && <p className="error">{error}</p>}

      {decks &&
        decks.map((deck) => (
          <section key={deck.index} className="panel" style={{ marginTop: "1rem" }}>
            <h2 style={{ marginTop: 0, display: "flex", flexWrap: "wrap", gap: "0.5rem", alignItems: "center" }}>
              <span>
                Deck {deck.index}
                <span className="muted" style={{ fontWeight: 500, fontSize: "0.95rem" }}>
                  {" "}
                  · {deck.cardCount} cards
                </span>
              </span>
              <ColorIdentity colors={deck.colorIdentity} />
            </h2>
            <p style={{ marginTop: 0 }}>
              <strong>{deck.commanderName}</strong>
            </p>
            {deck.power && <PowerLevelBadge report={deck.power} compact />}
            {deck.notes.length > 0 && (
              <ul className="muted" style={{ marginTop: 0 }}>
                {deck.notes.map((n) => (
                  <li key={n}>{n}</li>
                ))}
              </ul>
            )}
            <FormatBadge compact />
            <div className="actions">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => {
                  const list = formatLines(deck.lines);
                  void navigator.clipboard.writeText(list).then(
                    () => toast(`Copied deck ${deck.index} list`, "success"),
                    () => toast("Could not copy", "error"),
                  );
                }}
              >
                Copy list
              </button>
            </div>
            <DeckActions list={formatLines(deck.lines)} compact />
          </section>
        ))}
    </div>
  );
}
