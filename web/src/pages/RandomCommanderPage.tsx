import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { CommanderFilters, DEFAULT_FILTERS, type FilterState } from "../components/CommanderFilters";
import { DeckActions } from "../components/DeckActions";
import { ColorIdentity, ManaCost } from "../components/Mana";
import { generateAverageDeck, edhrecUrl } from "../lib/edhrec";
import {
  CARD_BACK_URL,
  getCardImage,
  getManaCost,
  getOracleText,
  namedCard,
  randomCommander,
  type ScryfallCard,
} from "../lib/scryfall";

export function RandomCommanderPage() {
  const [params] = useSearchParams();
  const [filters, setFilters] = useState<FilterState>(DEFAULT_FILTERS);
  const [card, setCard] = useState<ScryfallCard | null>(null);
  const [displaySrc, setDisplaySrc] = useState(CARD_BACK_URL);
  const [flipping, setFlipping] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [deck, setDeck] = useState<string | null>(null);
  const [deckSource, setDeckSource] = useState<string | null>(null);
  const [bracket, setBracket] = useState(Number(params.get("bracket") || 3));
  const [deckLoading, setDeckLoading] = useState(false);

  useEffect(() => {
    const name = params.get("name");
    if (!name) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const c = await namedCard(name);
        if (cancelled) return;
        setCard(c);
        setDisplaySrc(getCardImage(c, "normal"));
        if (params.get("autodeck") === "1") {
          const result = await generateAverageDeck(c, Number(params.get("bracket") || 3));
          if (!cancelled) {
            setDeck(result.list);
            setDeckSource(result.source);
          }
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load commander");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [params]);

  async function flipTo(next: ScryfallCard) {
    setFlipping(true);
    await new Promise((r) => setTimeout(r, 320));
    setDisplaySrc(CARD_BACK_URL);
    await new Promise((r) => setTimeout(r, 280));
    setCard(next);
    setDisplaySrc(getCardImage(next, "normal"));
    setFlipping(false);
  }

  async function onNewCommander() {
    setError(null);
    setDeck(null);
    setDeckSource(null);
    setLoading(true);
    try {
      const next = await randomCommander({
        colors: filters.colors,
        colorMode: filters.colorMode,
        playstyle: filters.playstyle || undefined,
        set: filters.set || undefined,
        partners: filters.partners,
      });
      await flipTo(next);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to fetch commander";
      setError(msg.includes("no commanders") ? "no commanders within filters found" : msg);
    } finally {
      setLoading(false);
    }
  }

  async function onGenerateDeck() {
    if (!card) return;
    setDeckLoading(true);
    setError(null);
    try {
      const result = await generateAverageDeck(card, bracket);
      setDeck(result.list);
      setDeckSource(result.source);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Deck generation failed");
    } finally {
      setDeckLoading(false);
    }
  }

  return (
    <div className="tool-page container">
      <header className="tool-header">
        <h1>Random commander</h1>
        <p>Keep flipping until something sparks a deck idea — then pull an average list from EDHREC.</p>
      </header>

      <CommanderFilters value={filters} onChange={setFilters} />

      <div className="actions">
        <button type="button" className="btn btn-primary" onClick={onNewCommander} disabled={loading || flipping}>
          {loading ? "Searching…" : "New commander"}
        </button>
      </div>

      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}

      <div className="split" style={{ marginTop: "1.5rem" }}>
        <div>
          <div className="card-art" aria-live="polite">
            <div className={`card-flip${flipping ? " is-flipping" : ""}`}>
              <div className="card-face">
                <img src={displaySrc} alt={card ? card.name : "Magic card back"} />
              </div>
              <div className="card-face card-face--back">
                <img src={CARD_BACK_URL} alt="" />
              </div>
            </div>
          </div>
        </div>

        <div className="panel panel-strong">
          {card ? (
            <>
              <h2 style={{ marginTop: 0 }}>{card.name}</h2>
              <p>
                <ManaCost cost={getManaCost(card)} /> ·{" "}
                <ColorIdentity colors={card.color_identity} />
              </p>
              <p className="muted" style={{ whiteSpace: "pre-wrap" }}>
                {getOracleText(card)}
              </p>
              <div className="actions">
                <a
                  className="btn btn-secondary"
                  href={edhrecUrl(card.name.split(" // ")[0])}
                  target="_blank"
                  rel="noreferrer"
                >
                  Open EDHREC
                </a>
                <button type="button" className="btn btn-primary" onClick={onGenerateDeck} disabled={deckLoading}>
                  {deckLoading ? "Building…" : "Generate deck"}
                </button>
              </div>
              <div className="field" style={{ marginTop: "0.75rem", maxWidth: 200 }}>
                <label htmlFor="bracket">Deck bracket</label>
                <select id="bracket" value={bracket} onChange={(e) => setBracket(Number(e.target.value))}>
                  {[1, 2, 3, 4, 5].map((b) => (
                    <option key={b} value={b}>
                      Bracket {b}
                    </option>
                  ))}
                </select>
              </div>
            </>
          ) : (
            <p className="muted">
              Hit “New commander” to flip the first card. Default art is the MagicGen card back.
            </p>
          )}
        </div>
      </div>

      {deck && (
        <section className="panel" style={{ marginTop: "1.5rem" }}>
          <h2>Generated deck</h2>
          <p className="muted">
            Source: {deckSource}. Power metrics from{" "}
            <a href="https://edhpowerlevel.com/" target="_blank" rel="noreferrer">
              edhpowerlevel.com
            </a>{" "}
            are skipped (no public API).
          </p>
          <pre className="list-block">{deck}</pre>
          <DeckActions list={deck} />
          <div className="actions">
            <Link className="btn btn-ghost" to={`/pimp?list=${encodeURIComponent(deck)}`}>
              Send to deck pimping
            </Link>
          </div>
        </section>
      )}

      <p className="disclosure">Card data via Scryfall. Deck averages via EDHREC JSON pages.</p>
    </div>
  );
}
