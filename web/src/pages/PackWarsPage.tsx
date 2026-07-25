import { useState } from "react";
import { Seo } from "../components/Seo";
import { maybeShowKofiSupportToast, useToast } from "../components/Toast";
import {
  generatePackWarsDecks,
  PACK_WARS_LAND_NOTE,
  type PackWarsDeck,
  type PackWarsProgress,
} from "../lib/packWars";

export function PackWarsPage() {
  const { toast } = useToast();
  const [players, setPlayers] = useState(1);
  const [setCode, setSetCode] = useState("");
  const [doubleStack, setDoubleStack] = useState(false);
  const [decks, setDecks] = useState<PackWarsDeck[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<PackWarsProgress | null>(null);

  async function onGenerate() {
    setLoading(true);
    setError(null);
    setProgress({ done: 0, total: 1, label: "Starting…" });
    try {
      const result = await generatePackWarsDecks({
        players,
        set: setCode || undefined,
        packsPerPlayer: doubleStack ? 2 : 1,
        onProgress: setProgress,
      });
      setDecks(result);
      toast(
        `Opened ${result.length} Pack Wars deck${result.length === 1 ? "" : "s"}`,
        "success",
      );
      maybeShowKofiSupportToast(toast, "pack-wars");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate");
      toast("Pack Wars generation failed", "error");
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
        title="Pack Wars Generator"
        description="Generate Mini-Master / Pack Wars decks: open a booster, add 15 basic lands, and play immediately."
        path="/pack-wars"
      />
      <header className="tool-header">
        <h1>Pack Wars generator</h1>
        <p>
          Mini-Master style decks: crack a booster, add three of each basic land, and play without
          looking first.
        </p>
      </header>

      <details className="panel methodology">
        <summary>How Pack Wars / Mini-Master works</summary>
        <div className="methodology__body">
          <p>
            Pack Wars (also called Mini-Master) is a casual limited format invented by Mark Rosewater
            and Henry Stern. Each player opens one booster without studying the contents, removes
            tokens / ads / the basic-land insert, then shuffles in{" "}
            <strong>three of each basic land</strong> (15 lands) for a ~30-card deck and plays a
            normal game of Magic.
          </p>
          <ul>
            <li>
              <strong>Blind discovery.</strong> The fun is drawing into your own pack — many groups
              skip mulligans so you never peek. Lists stay hidden here too; copy when you’re ready to
              proxy or import.
            </li>
            <li>
              <strong>This tool.</strong> Builds that deck for you: a draft-style pack (10 commons, 3
              uncommons, 1 rare/mythic) plus the 15 basics, ready to proxy or copy into Moxfield.
            </li>
            <li>
              <strong>Double-stack.</strong> Optional two packs per player for a thicker pool (still
              the same 15 basics unless you edit the list).
            </li>
            <li>
              <strong>Variants.</strong> Official minigames also mention “whole pack as opening hand
              + a land from outside the game each turn” and escalating packs after wins — play those
              however your table likes.
            </li>
          </ul>
          <p className="muted" style={{ marginBottom: 0 }}>
            Rules overview:{" "}
            <a href="https://mtg.fandom.com/wiki/Mini-Master" target="_blank" rel="noopener noreferrer">
              Mini-Master on MTG Wiki
            </a>
            .
          </p>
        </div>
      </details>

      <section className="panel" style={{ marginBottom: "1rem" }}>
        <div className="split">
          <div className="field">
            <label htmlFor="pw-players">Players / decks</label>
            <select
              id="pw-players"
              value={players}
              onChange={(e) => setPlayers(Number(e.target.value))}
            >
              {[1, 2, 3, 4].map((n) => (
                <option key={n} value={n}>
                  {n} deck{n === 1 ? "" : "s"}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="pw-set">Set code (optional)</label>
            <input
              id="pw-set"
              value={setCode}
              onChange={(e) => setSetCode(e.target.value)}
              placeholder="e.g. mh3, blb, dsk"
            />
          </div>
        </div>
        <label className="check" style={{ marginTop: "0.75rem" }}>
          <input
            type="checkbox"
            checked={doubleStack}
            onChange={(e) => setDoubleStack(e.target.checked)}
          />
          <span>Double-stack (two packs per deck)</span>
        </label>
        <p className="muted" style={{ marginBottom: 0, marginTop: "0.65rem" }}>
          {PACK_WARS_LAND_NOTE}
        </p>
      </section>

      <div className="actions">
        <button type="button" className="btn btn-primary" onClick={() => void onGenerate()} disabled={loading}>
          {loading ? "Opening packs…" : "Generate Pack Wars decks"}
        </button>
      </div>

      {loading && progress && (
        <div
          className="progress-block"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={progress.total || 100}
          aria-valuenow={progress.done}
          aria-label="Pack Wars generation progress"
        >
          <div className="progress-block__meta">
            <span>{progress.label}</span>
            <span>{progressPct}%</span>
          </div>
          <div className="progress-track">
            <div className="progress-fill" style={{ width: `${progressPct}%` }} />
          </div>
        </div>
      )}

      {error && <p className="error">{error}</p>}

      {decks &&
        decks.map((deck) => (
          <section key={deck.player} className="panel" style={{ marginTop: "1rem" }}>
            <h2 style={{ marginTop: 0 }}>
              {decks.length === 1 ? "Your deck" : `Player ${deck.player}`}
              <span className="muted" style={{ fontWeight: 500, fontSize: "0.95rem" }}>
                {" "}
                · {deck.cardCount} cards · {deck.packCount} pack
                {deck.packCount === 1 ? "" : "s"} + 15 basics
              </span>
            </h2>
            <div className="actions">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => {
                  void navigator.clipboard.writeText(deck.list).then(
                    () =>
                      toast(
                        decks.length === 1
                          ? "Copied list"
                          : `Copied player ${deck.player} list`,
                        "success",
                      ),
                    () => toast("Could not copy", "error"),
                  );
                }}
              >
                Copy list
              </button>
            </div>
          </section>
        ))}
    </div>
  );
}
