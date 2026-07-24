import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { DeckActions } from "../components/DeckActions";
import { pimpDeckList } from "../lib/pimp";
import { getCardImage, type ScryfallCard } from "../lib/scryfall";

function artCrop(card: ScryfallCard) {
  if (card.image_uris?.art_crop) return card.image_uris.art_crop;
  const face = card.card_faces?.find((f) => f.image_uris?.art_crop);
  return face?.image_uris?.art_crop ?? getCardImage(card, "large");
}

export function DeckPimpingPage() {
  const [params] = useSearchParams();
  const initial = useMemo(() => {
    try {
      return params.get("list") ? decodeURIComponent(params.get("list")!) : "";
    } catch {
      return params.get("list") ?? "";
    }
  }, [params]);

  const [input, setInput] = useState(initial);
  const [output, setOutput] = useState("");
  const [cards, setCards] = useState<ScryfallCard[]>([]);
  const [notes, setNotes] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onPimp() {
    setLoading(true);
    setError(null);
    try {
      const result = await pimpDeckList(input);
      setOutput(result.list);
      setCards(result.cards);
      setNotes(result.notes);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Pimping failed");
    } finally {
      setLoading(false);
    }
  }

  const hero = cards[0];

  return (
    <div className="tool-page container">
      <header className="tool-header">
        <h1>Deck pimping</h1>
        <p>Paste a Moxfield-style list and swap each card to a cooler, more desirable printing.</p>
      </header>

      <div className="split">
        <div className="field">
          <label htmlFor="pimp-in">Input list</label>
          <textarea
            id="pimp-in"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={"1 Sol Ring\n1 Arcane Signet\n1 Command Tower"}
          />
        </div>
        <div className="field">
          <label htmlFor="pimp-out">Pimped Moxfield list</label>
          <textarea id="pimp-out" value={output} readOnly placeholder="Results appear here…" />
        </div>
      </div>

      <div className="actions">
        <button type="button" className="btn btn-primary" onClick={onPimp} disabled={loading || !input.trim()}>
          {loading ? "Pimping… (Scryfall lookups)" : "Pimp my deck"}
        </button>
        {output && (
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => navigator.clipboard.writeText(output)}
          >
            Copy output
          </button>
        )}
      </div>

      {error && <p className="error">{error}</p>}

      {output && <DeckActions list={output} />}

      {cards.length > 0 && (
        <section className="pimp-gallery" aria-label="Pimped printings">
          {hero && (
            <div className="pimp-hero">
              <img src={artCrop(hero)} alt="" className="pimp-hero__bg" />
              <div className="pimp-hero__veil" />
              <div className="pimp-hero__content">
                <p className="pimp-hero__eyebrow">Pimped printing</p>
                <h2>{hero.name}</h2>
                <p>
                  {hero.set_name} · #{hero.collector_number}
                </p>
                <img
                  className="pimp-hero__card"
                  src={getCardImage(hero, "large")}
                  alt={hero.name}
                />
              </div>
            </div>
          )}

          <div className="pimp-rail">
            {cards.map((c) => (
              <figure key={`${c.id}-${c.collector_number}`} className="pimp-tile">
                <div className="pimp-tile__art">
                  <img src={artCrop(c)} alt="" />
                  <img className="pimp-tile__card" src={getCardImage(c)} alt={c.name} />
                </div>
                <figcaption>
                  <strong>{c.name}</strong>
                  <span>
                    {c.set_name} #{c.collector_number}
                  </span>
                </figcaption>
              </figure>
            ))}
          </div>
        </section>
      )}

      {notes.length > 0 && (
        <details className="panel" style={{ marginTop: "1.25rem" }}>
          <summary style={{ cursor: "pointer", fontWeight: 600 }}>Change log ({notes.length})</summary>
          <ul>
            {notes.map((n) => (
              <li key={n}>{n}</li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
