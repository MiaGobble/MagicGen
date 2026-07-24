import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { DeckActions } from "../components/DeckActions";
import { Seo } from "../components/Seo";
import { maybeShowKofiSupportToast, useToast } from "../components/Toast";
import { pimpDeckList } from "../lib/pimp";
import { getCardImage, type ScryfallCard } from "../lib/scryfall";

function artCrop(card: ScryfallCard) {
  if (card.image_uris?.art_crop) return card.image_uris.art_crop;
  const face = card.card_faces?.find((f) => f.image_uris?.art_crop);
  return face?.image_uris?.art_crop ?? getCardImage(card, "large");
}

export function DeckPimpingPage() {
  const { toast } = useToast();
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
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function onPimp() {
    setLoading(true);
    setError(null);
    setProgress({ done: 0, total: 0 });
    try {
      const result = await pimpDeckList(input, (done, total) => {
        setProgress({ done, total });
      });
      setOutput(result.list);
      setCards(result.cards);
      setNotes(result.notes);
      toast(`Pimped ${result.cards.length} card${result.cards.length === 1 ? "" : "s"}`, "success");
      maybeShowKofiSupportToast(toast);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Pimping failed");
      toast("Pimping failed", "error");
    } finally {
      setLoading(false);
      setProgress(null);
    }
  }

  async function onCopy() {
    try {
      await navigator.clipboard.writeText(output);
      toast("Copied pimped list", "success");
    } catch {
      toast("Could not copy", "error");
    }
  }

  const hero = cards[0];
  const pct =
    progress && progress.total > 0 ? Math.round((progress.done / progress.total) * 100) : 0;

  return (
    <div className="tool-page container">
      <Seo
        title="Deck Pimping"
        description="Paste a Moxfield-style Magic deck list and upgrade each card to a cooler, more desirable printing."
        path="/pimp"
      />
      <header className="tool-header">
        <h1>Deck pimping</h1>
        <p>Paste a Moxfield-style list and swap each card to a cooler, more desirable printing.</p>
      </header>

      <details className="panel methodology">
        <summary>How printing picks work</summary>
        <div className="methodology__body">
          <p>
            Each line is resolved on Scryfall, a capped set of paper printings is loaded, then
            scored. The highest-scoring printing wins and is written back with set code + collector
            number.
          </p>
          <ul>
            <li>
              <strong>Lookup.</strong> Each name is resolved via Scryfall’s named endpoint, then up
              to about one page of paper printings is loaded from that card’s prints URI (two pages
              for basics). Digital / art-series prints are filtered in code. Completeness is capped
              so long decks stay reliable.
            </li>
            <li>
              <strong>Scoring.</strong> Secret Lair and premium treatments score highest; showcase /
              borderless / extended / full-art / etched add large bonuses. Plain core-set black-border
              defaults are heavily penalized. Price is only a weak tiebreaker.
            </li>
            <li>
              <strong>Lands.</strong> Expensive “plain looking” promo basics lose to full-art,
              borderless, or Secret Lair lands so the list looks pimped, not just pricey.
            </li>
            <li>
              <strong>Failures.</strong> If Scryfall truly has no paper printing for a name, the
              original line is kept and noted. Network errors and rate limits say “try again”
              (not “no printings found”).
            </li>
          </ul>
        </div>
      </details>

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
          <button type="button" className="btn btn-secondary" onClick={() => void onCopy()}>
            Copy output
          </button>
        )}
      </div>

      {loading && progress && (
        <div
          className="progress-block"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={progress.total || 100}
          aria-valuenow={progress.done}
          aria-label="Pimping progress"
        >
          <div className="progress-block__meta">
            <span>
              {progress.total > 0
                ? `${progress.done} / ${progress.total} cards`
                : "Starting…"}
            </span>
            <span>{pct}%</span>
          </div>
          <div className="progress-track">
            <div className="progress-fill" style={{ width: `${pct}%` }} />
          </div>
          <p className="progress-block__note muted">
            Pimping can take a few minutes. Scryfall rate limits slow large decks.
          </p>
        </div>
      )}

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
