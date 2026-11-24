import { useEffect, useState } from "react";
import { DeckActions } from "../components/DeckActions";
import { FormatBadge } from "../components/FormatBadge";
import { Seo } from "../components/Seo";
import { useSettings } from "../components/SettingsProvider";
import { maybeShowKofiSupportToast, useToast } from "../components/Toast";
import {
  diffDeckLists,
  formatDiffDelta,
  isEmptyDiff,
  type DeckDiffResult,
} from "../lib/deckDiff";
import { serializeDeckListAsync } from "../lib/deckFormat";
import { DECK_FORMAT_META, type DeckListFormat } from "../lib/settings";

const FORMATS = Object.keys(DECK_FORMAT_META) as DeckListFormat[];

export function DeckDiffPage() {
  const { toast } = useToast();
  const { settings } = useSettings();
  const [before, setBefore] = useState("");
  const [after, setAfter] = useState("");
  const [diff, setDiff] = useState<DeckDiffResult | null>(null);
  const [exportFormat, setExportFormat] = useState<DeckListFormat>(settings.deckFormat);
  const [exportText, setExportText] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setExportFormat(settings.deckFormat);
  }, [settings.deckFormat]);

  useEffect(() => {
    if (!diff || diff.addedLines.length === 0) {
      setExportText("");
      return;
    }
    let cancelled = false;
    void serializeDeckListAsync(diff.addedLines, {
      format: exportFormat,
      includeSet: true,
    }).then((text) => {
      if (!cancelled) setExportText(text);
    });
    return () => {
      cancelled = true;
    };
  }, [diff, exportFormat]);

  async function onCompare() {
    if (!before.trim() || !after.trim()) {
      setError("Paste a before list and an after list.");
      return;
    }
    setLoading(true);
    setError(null);
    setDiff(null);
    try {
      const result = await diffDeckLists(before, after);
      setDiff(result);
      if (isEmptyDiff(result)) {
        toast("Lists are identical by card name", "success");
      } else {
        const parts = [
          result.added.length ? `+${result.added.length}` : null,
          result.removed.length ? `−${result.removed.length}` : null,
          result.changed.length ? `~${result.changed.length}` : null,
        ].filter(Boolean);
        toast(`Diff: ${parts.join(" ")}`, "success");
      }
      maybeShowKofiSupportToast(toast, "deck-diff");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Compare failed");
      toast("Compare failed", "error");
    } finally {
      setLoading(false);
    }
  }

  function onSwap() {
    setBefore(after);
    setAfter(before);
    setDiff(null);
    setError(null);
  }

  function onClear() {
    setBefore("");
    setAfter("");
    setDiff(null);
    setError(null);
  }

  async function onCopyExport() {
    if (!exportText) return;
    try {
      await navigator.clipboard.writeText(exportText);
      toast("Copied added cards", "success");
    } catch {
      toast("Could not copy", "error");
    }
  }

  return (
    <div className="tool-page container">
      <Seo
        title="Deck Diffs"
        description="Compare two Magic deck lists and see cards added, removed, and quantity changes."
        path="/deck-diff"
      />
      <header className="tool-header">
        <h1>Deck Diffs</h1>
        <p>
          Paste a before list and an after list. MagicGen totals quantities by card name and shows
          what changed — set codes and finishes are ignored for the comparison, but kept on the
          added-card export for printing.
        </p>
      </header>

      <div className="split convert-io">
        <div className="field">
          <label htmlFor="diff-before">Before</label>
          <textarea
            id="diff-before"
            value={before}
            onChange={(e) => setBefore(e.target.value)}
            placeholder={"1 Sol Ring\n1 Arcane Signet\n1 Command Tower"}
          />
        </div>
        <div className="field">
          <label htmlFor="diff-after">After</label>
          <textarea
            id="diff-after"
            value={after}
            onChange={(e) => setAfter(e.target.value)}
            placeholder={"1 Sol Ring\n1 Arcane Signet\n1 Reliquary Tower"}
          />
        </div>
      </div>

      <div className="actions convert-actions">
        <button
          type="button"
          className="btn btn-primary"
          onClick={() => void onCompare()}
          disabled={loading || !before.trim() || !after.trim()}
        >
          {loading ? "Comparing…" : "Compare"}
        </button>
        <button
          type="button"
          className="btn btn-secondary"
          onClick={onSwap}
          disabled={loading || (!before.trim() && !after.trim())}
        >
          Swap
        </button>
        <button
          type="button"
          className="btn btn-secondary"
          onClick={onClear}
          disabled={loading || (!before.trim() && !after.trim() && !diff)}
        >
          Clear
        </button>
      </div>

      {error && <p className="error">{error}</p>}

      {diff && <DiffResults diff={diff} />}

      {diff && diff.addedLines.length > 0 && (
        <section className="panel deck-diff-export" style={{ marginTop: "1rem" }}>
          <h2 style={{ marginTop: 0, fontSize: "1.05rem" }}>Added cards (export)</h2>
          <p className="muted" style={{ marginTop: 0 }}>
            New names and quantity increases from the after list, with the same printings. Copy this
            into Proxy tools when you want to print only what changed.
          </p>
          <div className="field" style={{ maxWidth: "16rem", marginBottom: "0.75rem" }}>
            <label htmlFor="diff-export-format">Format</label>
            <select
              id="diff-export-format"
              value={exportFormat}
              onChange={(e) => setExportFormat(e.target.value as DeckListFormat)}
            >
              {FORMATS.map((id) => (
                <option key={id} value={id}>
                  {DECK_FORMAT_META[id].label}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="diff-export-out">Output list</label>
            <textarea
              id="diff-export-out"
              value={exportText}
              readOnly
              placeholder="Added cards appear here after Compare…"
            />
          </div>
          <div className="actions convert-actions">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => void onCopyExport()}
              disabled={!exportText}
            >
              Copy list
            </button>
            <FormatBadge format={exportFormat} compact />
          </div>
          {exportText && <DeckActions list={exportText} hidePimp />}
        </section>
      )}
    </div>
  );
}

function DiffResults({ diff }: { diff: DeckDiffResult }) {
  const empty = isEmptyDiff(diff);

  return (
    <section className="deck-diff-results" aria-live="polite">
      <div className="panel deck-diff-summary">
        <h2 className="deck-diff-summary__title">Summary</h2>
        <p className="deck-diff-summary__meta muted">
          {diff.beforeCards} → {diff.afterCards} cards · {diff.beforeUnique} → {diff.afterUnique}{" "}
          unique
          {diff.unchanged > 0 ? ` · ${diff.unchanged} unchanged` : ""}
        </p>
        {empty ? (
          <p className="success" style={{ marginBottom: 0 }}>
            No differences by card name.
          </p>
        ) : (
          <ul className="deck-diff-summary__stats">
            <li className="deck-diff-stat deck-diff-stat--added">
              <span className="deck-diff-stat__n">+{diff.added.length}</span>
              <span className="deck-diff-stat__label">added</span>
            </li>
            <li className="deck-diff-stat deck-diff-stat--removed">
              <span className="deck-diff-stat__n">−{diff.removed.length}</span>
              <span className="deck-diff-stat__label">removed</span>
            </li>
            <li className="deck-diff-stat deck-diff-stat--changed">
              <span className="deck-diff-stat__n">~{diff.changed.length}</span>
              <span className="deck-diff-stat__label">qty changed</span>
            </li>
          </ul>
        )}
      </div>

      {!empty && (
        <div className="deck-diff-columns">
          <DiffSection
            title="Added"
            tone="added"
            emptyLabel="Nothing added"
            items={diff.added.map((l) => ({
              key: l.name,
              primary: l.name,
              secondary: `×${l.quantity}`,
            }))}
          />
          <DiffSection
            title="Removed"
            tone="removed"
            emptyLabel="Nothing removed"
            items={diff.removed.map((l) => ({
              key: l.name,
              primary: l.name,
              secondary: `×${l.quantity}`,
            }))}
          />
          <DiffSection
            title="Quantity changed"
            tone="changed"
            emptyLabel="No quantity changes"
            items={diff.changed.map((l) => ({
              key: l.name,
              primary: l.name,
              secondary: `${l.before} → ${l.after} (${formatDiffDelta(l.delta)})`,
            }))}
          />
        </div>
      )}
    </section>
  );
}

function DiffSection({
  title,
  tone,
  emptyLabel,
  items,
}: {
  title: string;
  tone: "added" | "removed" | "changed";
  emptyLabel: string;
  items: { key: string; primary: string; secondary: string }[];
}) {
  return (
    <div className={`panel deck-diff-section deck-diff-section--${tone}`}>
      <h3>
        {title}
        <span className="deck-diff-section__count">{items.length}</span>
      </h3>
      {items.length === 0 ? (
        <p className="muted" style={{ margin: 0 }}>
          {emptyLabel}
        </p>
      ) : (
        <ul className="deck-diff-list">
          {items.map((item) => (
            <li key={item.key}>
              <span className="deck-diff-list__name">{item.primary}</span>
              <span className="deck-diff-list__qty muted">{item.secondary}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
