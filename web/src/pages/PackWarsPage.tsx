import { useState } from "react";
import { DeckActions } from "../components/DeckActions";
import { Seo } from "../components/Seo";
import { maybeShowKofiSupportToast, useToast } from "../components/Toast";
import {
  generatePackWarsDecks,
  PACK_WARS_LAND_NOTE,
  type PackWarsDeck,
} from "../lib/packWars";
import { getCardImage } from "../lib/scryfall";

export function PackWarsPage() {
  const { toast } = useToast();
  const [players, setPlayers] = useState(2);
  const [setCode, setSetCode] = useState("");
  const [doubleStack, setDoubleStack] = useState(false);
  const [decks, setDecks] = useState<PackWarsDeck[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onGenerate() {
    setLoading(true);
    setError(null);
    try {
      const result = await generatePackWarsDecks({
        players,
        set: setCode || undefined,
        packsPerPlayer: doubleStack ? 2 : 1,
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
    }
  }

  return (
    <div className="tool-page container">
      <Seo
        title="Pack Wars Deck Generator"
        description="Generate Mini-Master / Pack Wars decks: open a booster, add 15 basic lands, and play immediately."
        path="/pack-wars"
      />
      <header className="tool-header">
        <h1>Pack Wars</h1>
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
              skip mulligans so you never peek.
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

      {error && <p className="error">{error}</p>}

      {decks &&
        decks.map((deck) => (
          <section key={deck.player} className="panel" style={{ marginTop: "1rem" }}>
            <h2 style={{ marginTop: 0 }}>
              Player {deck.player}
              <span className="muted" style={{ fontWeight: 500, fontSize: "0.95rem" }}>
                {" "}
                · {deck.cardCount} cards · {deck.packCount} pack
                {deck.packCount === 1 ? "" : "s"} + 15 basics
              </span>
            </h2>
            <p className="muted" style={{ marginTop: 0 }}>
              Pack contents ({deck.packCards.length} cards) — basics omitted from the gallery:
            </p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
              {deck.packCards.map((c, idx) => (
                <img
                  key={`${deck.player}-${c.id}-${idx}`}
                  src={getCardImage(c)}
                  alt={c.name}
                  title={`${c.name} (${c.rarity}${c.set ? ` · ${c.set}` : ""})`}
                  style={{ width: 90, borderRadius: 6 }}
                />
              ))}
            </div>
            <h3 style={{ fontSize: "1.05rem", marginBottom: "0.35rem" }}>Deck list</h3>
            <pre className="list-block">{deck.list}</pre>
            <div className="actions">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => {
                  void navigator.clipboard.writeText(deck.list).then(
                    () => toast(`Copied player ${deck.player} list`, "success"),
                    () => toast("Could not copy", "error"),
                  );
                }}
              >
                Copy list
              </button>
            </div>
            <DeckActions list={deck.list} />
          </section>
        ))}
    </div>
  );
}
