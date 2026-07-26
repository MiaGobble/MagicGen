import { useMemo, useState } from "react";
import { FormatBadge } from "../components/FormatBadge";
import { Seo } from "../components/Seo";
import { maybeShowKofiSupportToast, useToast } from "../components/Toast";
import {
  convertDeckFormat,
  detectDeckFormat,
  type DeckListFormat,
} from "../lib/deckFormat";
import { DECK_FORMAT_META } from "../lib/settings";

const FORMATS = Object.keys(DECK_FORMAT_META) as DeckListFormat[];

export function FormatConvertPage() {
  const { toast } = useToast();
  const [input, setInput] = useState("");
  const [from, setFrom] = useState<DeckListFormat | "auto">("auto");
  const [to, setTo] = useState<DeckListFormat>("moxfield");
  const [output, setOutput] = useState("");
  const [warnings, setWarnings] = useState<string[]>([]);
  const [detected, setDetected] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const guessed = useMemo(() => (input.trim() ? detectDeckFormat(input) : null), [input]);

  async function onConvert() {
    if (!input.trim()) {
      setError("Paste a deck list first.");
      return;
    }
    setLoading(true);
    setError(null);
    setWarnings([]);
    setOutput("");
    setDetected(null);
    try {
      const result = await convertDeckFormat(
        input,
        to,
        from === "auto" ? undefined : from,
      );
      setOutput(result.text);
      setWarnings(result.warnings);
      setDetected(
        result.detectedFormat === "unknown"
          ? "Could not confidently detect the source format"
          : `Detected as ${DECK_FORMAT_META[result.detectedFormat].label}`,
      );
      toast(`Converted to ${DECK_FORMAT_META[to].label}`, "success");
      maybeShowKofiSupportToast(toast, "format-convert");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Conversion failed");
      toast("Conversion failed", "error");
    } finally {
      setLoading(false);
    }
  }

  async function onCopy() {
    try {
      await navigator.clipboard.writeText(output);
      toast("Copied converted list", "success");
    } catch {
      toast("Could not copy", "error");
    }
  }

  return (
    <div className="tool-page container">
      <Seo
        title="Format converter"
        description="Convert Magic deck lists between Moxfield, Archidekt, HXDEC, and plain text, with loss warnings."
        path="/convert"
      />
      <header className="tool-header">
        <h1>Format converter</h1>
        <p>
          Paste a list, pick a target format, and convert. Warnings appear when the target cannot
          keep set codes, finishes, or sections.
        </p>
      </header>

      <div className="panel field-grid" style={{ marginBottom: "1rem" }}>
        <div className="field">
          <label htmlFor="convert-from">From</label>
          <select
            id="convert-from"
            value={from}
            onChange={(e) => setFrom(e.target.value as DeckListFormat | "auto")}
          >
            <option value="auto">
              Auto-detect{guessed && guessed !== "unknown" ? ` (${DECK_FORMAT_META[guessed].label})` : ""}
            </option>
            {FORMATS.map((id) => (
              <option key={id} value={id}>
                {DECK_FORMAT_META[id].label}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="convert-to">To</label>
          <select
            id="convert-to"
            value={to}
            onChange={(e) => setTo(e.target.value as DeckListFormat)}
          >
            {FORMATS.map((id) => (
              <option key={id} value={id}>
                {DECK_FORMAT_META[id].label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="split convert-io">
        <div className="field">
          <label htmlFor="convert-in">Input list</label>
          <textarea
            id="convert-in"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={"1 Sol Ring\n1 Arcane Signet\n1 Command Tower"}
          />
        </div>
        <div className="field">
          <label htmlFor="convert-out">Converted list</label>
          <textarea id="convert-out" value={output} readOnly placeholder="Results appear here…" />
        </div>
      </div>

      <div className="actions convert-actions">
        <button
          type="button"
          className="btn btn-primary"
          onClick={() => void onConvert()}
          disabled={loading || !input.trim()}
        >
          {loading ? "Converting…" : "Convert"}
        </button>
        {output && (
          <button type="button" className="btn btn-secondary" onClick={() => void onCopy()}>
            Copy output
          </button>
        )}
        {output && <FormatBadge format={to} compact />}
      </div>

      {error && <p className="error">{error}</p>}
      {detected && <p className="muted" style={{ marginTop: "0.5rem" }}>{detected}</p>}

      {warnings.length > 0 && (
        <section className="panel convert-warnings" style={{ marginTop: "1rem" }}>
          <h2 style={{ marginTop: 0, fontSize: "1.05rem" }}>Information loss warnings</h2>
          <ul style={{ marginBottom: 0 }}>
            {warnings.map((w) => (
              <li key={w}>{w}</li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
