import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router";
import { Seo } from "../components/Seo";
import { maybeShowKofiSupportToast, useToast } from "../components/Toast";
import { toMoxfieldList, type DeckLine } from "../lib/moxfield";
import { pimpDeckList, type PimpPick } from "../lib/pimp";
import { getCardImage, searchPrintingsForPimp, type ScryfallCard } from "../lib/scryfall";

function artCrop(card: ScryfallCard) {
  if (card.image_uris?.art_crop) return card.image_uris.art_crop;
  const face = card.card_faces?.find((f) => f.image_uris?.art_crop);
  return face?.image_uris?.art_crop ?? getCardImage(card, "large");
}

function printingLabel(card: ScryfallCard) {
  return `${card.set_name} · #${card.collector_number}`;
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
  const [lines, setLines] = useState<DeckLine[]>([]);
  const [picks, setPicks] = useState<PimpPick[]>([]);
  const [notes, setNotes] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [editingPick, setEditingPick] = useState<number | null>(null);
  const [printOptions, setPrintOptions] = useState<ScryfallCard[]>([]);
  const [printLoading, setPrintLoading] = useState(false);
  const [printError, setPrintError] = useState<string | null>(null);

  const editing = editingPick != null ? picks[editingPick] : null;
  const pct =
    progress && progress.total > 0 ? Math.round((progress.done / progress.total) * 100) : 0;

  useEffect(() => {
    if (editingPick == null) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") closePicker();
    }
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", onKey);
    };
  }, [editingPick]);

  async function onPimp() {
    setLoading(true);
    setError(null);
    setProgress({ done: 0, total: 0 });
    setEditingPick(null);
    setPrintOptions([]);
    try {
      const result = await pimpDeckList(input, (done, total) => {
        setProgress({ done, total });
      });
      setOutput(result.list);
      setLines(result.lines);
      setPicks(result.picks);
      setNotes(result.notes);
      toast(`Pimped ${result.cards.length} card${result.cards.length === 1 ? "" : "s"}`, "success");
      maybeShowKofiSupportToast(toast, "pimp");
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

  function closePicker() {
    setEditingPick(null);
    setPrintOptions([]);
    setPrintError(null);
    setPrintLoading(false);
  }

  async function openPicker(pickIndex: number) {
    const pick = picks[pickIndex];
    if (!pick) return;
    setEditingPick(pickIndex);
    setPrintOptions([]);
    setPrintError(null);
    setPrintLoading(true);
    try {
      const prints = await searchPrintingsForPimp(pick.card.name);
      setPrintOptions(prints);
      if (!prints.length) setPrintError("No paper printings found for this card.");
    } catch (err) {
      setPrintError(err instanceof Error ? err.message : "Could not load printings");
    } finally {
      setPrintLoading(false);
    }
  }

  function applyPrinting(printing: ScryfallCard) {
    if (editingPick == null) return;
    const pick = picks[editingPick];
    if (!pick) return;

    const nextPicks = picks.map((p, i) =>
      i === editingPick ? { ...p, card: printing } : p,
    );
    const nextLines = lines.map((l, i) =>
      i === pick.lineIndex
        ? {
            ...l,
            setCode: printing.set,
            collectorNumber: printing.collector_number,
          }
        : l,
    );

    setPicks(nextPicks);
    setLines(nextLines);
    setOutput(toMoxfieldList(nextLines, true));
    setNotes((prev) => [
      `${printing.name}: manually set to ${printing.set_name} #${printing.collector_number}`,
      ...prev,
    ]);
    closePicker();
    toast(`Updated ${printing.name}`, "success");
  }

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
            number. After pimping, click any card in the gallery to pick a different printing.
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
            <li>
              <strong>Manual override.</strong> Click a gallery card to browse its paper printings
              and swap the set code / collector number in the output list.
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
          <>
            <Link className="btn btn-brass" to={`/bulk?list=${encodeURIComponent(output)}`}>
              Price / purchase
            </Link>
            <button type="button" className="btn btn-secondary" onClick={() => void onCopy()}>
              Copy output
            </button>
            <Link className="btn btn-secondary" to={`/proxy?list=${encodeURIComponent(output)}`}>
              Proxy this list
            </Link>
          </>
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

      {picks.length > 0 && (
        <section className="pimp-gallery" aria-label="Pimped printings">
          <p className="pimp-gallery__hint muted">Click a card to change its printing.</p>
          <div className="pimp-rail">
            {picks.map((pick, i) => (
              <button
                key={`${pick.lineIndex}-${pick.card.id}`}
                type="button"
                className={`pimp-tile${editingPick === i ? " pimp-tile--active" : ""}`}
                onClick={() => void openPicker(i)}
                aria-label={`Change printing for ${pick.card.name}`}
              >
                <div className="pimp-tile__art">
                  <img src={artCrop(pick.card)} alt="" />
                  <img className="pimp-tile__card" src={getCardImage(pick.card)} alt="" />
                </div>
                <span className="pimp-tile__cap">
                  <strong>{pick.card.name}</strong>
                  <span>{printingLabel(pick.card)}</span>
                </span>
              </button>
            ))}
          </div>
        </section>
      )}

      {editing && (
        <div
          className="pimp-picker"
          role="dialog"
          aria-modal="true"
          aria-labelledby="pimp-picker-title"
        >
          <button
            type="button"
            className="pimp-picker__backdrop"
            aria-label="Close printing picker"
            onClick={closePicker}
          />
          <div className="pimp-picker__panel">
            <header className="pimp-picker__header">
              <div>
                <p className="pimp-picker__eyebrow">Choose printing</p>
                <h2 id="pimp-picker-title">{editing.card.name}</h2>
              </div>
              <button type="button" className="btn btn-ghost" onClick={closePicker}>
                Close
              </button>
            </header>

            {printLoading && <p className="muted">Loading printings from Scryfall…</p>}
            {printError && <p className="error">{printError}</p>}

            {!printLoading && printOptions.length > 0 && (
              <div className="pimp-picker__grid">
                {printOptions.map((opt) => {
                  const selected = opt.id === editing.card.id;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      className={`pimp-picker__option${selected ? " pimp-picker__option--selected" : ""}`}
                      onClick={() => applyPrinting(opt)}
                      aria-pressed={selected}
                    >
                      <img src={getCardImage(opt)} alt="" />
                      <span>
                        <strong>{opt.set_name}</strong>
                        <span>
                          {opt.set?.toUpperCase()} #{opt.collector_number}
                          {opt.full_art ? " · full art" : ""}
                          {opt.border_color === "borderless" ? " · borderless" : ""}
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {notes.length > 0 && (
        <details className="panel" style={{ marginTop: "1.25rem" }}>
          <summary style={{ cursor: "pointer", fontWeight: 600 }}>Change log ({notes.length})</summary>
          <ul>
            {notes.map((n, i) => (
              <li key={`${i}-${n}`}>{n}</li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
