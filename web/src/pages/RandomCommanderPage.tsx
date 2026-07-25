import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router";
import { CommanderFilters, DEFAULT_FILTERS, type FilterState } from "../components/CommanderFilters";
import { DeckActions } from "../components/DeckActions";
import { ColorIdentity, ManaCost } from "../components/Mana";
import { Seo } from "../components/Seo";
import { maybeShowKofiSupportToast, useToast } from "../components/Toast";
import { generateAverageDeck, edhrecUrl, BRACKET_META, clampBracket } from "../lib/edhrec";
import {
  CARD_BACK_URL,
  getCardFaceImages,
  getCardImage,
  getManaCost,
  getOracleText,
  isMultiFaceCard,
  namedCard,
  randomCommander,
  type ScryfallCard,
} from "../lib/scryfall";

export function RandomCommanderPage() {
  const { toast } = useToast();
  const [params] = useSearchParams();
  const [filters, setFilters] = useState<FilterState>(DEFAULT_FILTERS);
  const [card, setCard] = useState<ScryfallCard | null>(null);
  const [displaySrc, setDisplaySrc] = useState(CARD_BACK_URL);
  const [faceIndex, setFaceIndex] = useState(0);
  const [flipping, setFlipping] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [deck, setDeck] = useState<string | null>(null);
  const [deckSource, setDeckSource] = useState<string | null>(null);
  const [bracket, setBracket] = useState(clampBracket(Number(params.get("bracket") || 3)));
  const [deckLoading, setDeckLoading] = useState(false);

  const faceImages = card ? getCardFaceImages(card, "normal") : [];
  const multiFace = card ? isMultiFaceCard(card) : false;

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
        setFaceIndex(0);
        setDisplaySrc(getCardImage(c, "normal"));
        if (params.get("autodeck") === "1") {
          const result = await generateAverageDeck(c, clampBracket(Number(params.get("bracket") || 3)));
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
    setFaceIndex(0);
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
        set: filters.set || undefined,
        partners: filters.partners,
      });
      await flipTo(next);
      toast("Commander ready", "success");
      maybeShowKofiSupportToast(toast);
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
      toast("Average deck ready", "success");
      maybeShowKofiSupportToast(toast);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Deck generation failed");
      toast("Deck generation failed", "error");
    } finally {
      setDeckLoading(false);
    }
  }

  function showFace(index: number) {
    if (!card || !faceImages[index]) return;
    setFaceIndex(index);
    setDisplaySrc(faceImages[index].src);
  }

  return (
    <div className="tool-page container">
      <Seo
        title="Random Commander"
        description="Flip random Magic: The Gathering commanders with color and set filters, then build an average EDHREC deck."
        path="/commander"
      />
      <header className="tool-header">
        <h1>Random commander</h1>
        <p>Keep flipping until something sparks a deck idea, then pull an average list from EDHREC.</p>
      </header>

      <CommanderFilters value={filters} onChange={setFilters} showPlaystyle={false} />

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
          {multiFace && faceImages.length >= 2 && !flipping ? (
            <div className="dfc-faces" aria-live="polite">
              {faceImages.map((face, i) => (
                <button
                  key={`${face.name}-${i}`}
                  type="button"
                  className={`dfc-face${faceIndex === i ? " is-active" : ""}`}
                  onClick={() => showFace(i)}
                  aria-pressed={faceIndex === i}
                  aria-label={`Show ${face.name}`}
                >
                  <img src={face.src} alt={face.name} />
                  <span className="dfc-face__label">{face.name}</span>
                </button>
              ))}
            </div>
          ) : (
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
          )}
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
              {multiFace && faceImages.length >= 2 && (
                <div className="actions">
                  <button
                    type="button"
                    className="btn btn-ghost"
                    onClick={() => showFace((faceIndex + 1) % faceImages.length)}
                  >
                    Show {faceImages[(faceIndex + 1) % faceImages.length]?.name ?? "other face"}
                  </button>
                </div>
              )}
              <div className="actions">
                <a
                  className="btn btn-secondary"
                  href={edhrecUrl(card.name.split(" // ")[0])}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Open EDHREC
                </a>
                <button type="button" className="btn btn-primary" onClick={onGenerateDeck} disabled={deckLoading}>
                  {deckLoading ? "Building…" : "Generate deck"}
                </button>
              </div>
              <div className="field" style={{ marginTop: "0.75rem", maxWidth: 260 }}>
                <label htmlFor="bracket">Deck bracket</label>
                <select
                  id="bracket"
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
            <a href="https://edhpowerlevel.com/" target="_blank" rel="noopener noreferrer">
              edhpowerlevel.com
            </a>{" "}
            are skipped (no public API).
          </p>
          <pre className="list-block">{deck}</pre>
          <div className="actions">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => {
                void navigator.clipboard.writeText(deck).then(
                  () => toast("Copied deck list", "success"),
                  () => toast("Could not copy", "error"),
                );
              }}
            >
              Copy list
            </button>
          </div>
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
