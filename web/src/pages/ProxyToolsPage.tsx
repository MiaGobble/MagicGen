import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { proxySupplyLinks } from "../lib/amazon";
import { parseMoxfieldList } from "../lib/moxfield";
import { generateProxyPdf, type ProxyPdfOptions } from "../lib/proxyPdf";
import { collectionLookup, getCardImage, namedCard, searchCards, type ScryfallCard } from "../lib/scryfall";

type ProxyEntry = { card: ScryfallCard; quantity: number };

const SITE = "https://mtggen.igottic.com";
const STAMP = `Unofficial Print · ${SITE}`;

export function ProxyToolsPage() {
  const [params] = useSearchParams();
  const initialList = useMemo(() => {
    const raw = params.get("list");
    if (!raw) return "";
    try {
      return decodeURIComponent(raw);
    } catch {
      return raw;
    }
  }, [params]);

  const [listText, setListText] = useState(initialList);
  const [search, setSearch] = useState("");
  const [hits, setHits] = useState<ScryfallCard[]>([]);
  const [entries, setEntries] = useState<ProxyEntry[]>([]);
  const [includeTokens, setIncludeTokens] = useState(true);
  const [loading, setLoading] = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [bleedMm, setBleedMm] = useState(2);
  const [cutGuides, setCutGuides] = useState(true);
  const [gapMm, setGapMm] = useState(1);
  const [paper, setPaper] = useState<ProxyPdfOptions["paper"]>("letter");
  const [columns, setColumns] = useState(3);
  const [rows, setRows] = useState(3);

  const budgetSupplies = useMemo(() => proxySupplyLinks("budget"), []);
  const premiumSupplies = useMemo(() => proxySupplyLinks("premium"), []);

  useEffect(() => {
    if (initialList.trim()) void importList(initialList);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function importList(text = listText) {
    setLoading(true);
    setError(null);
    try {
      const lines = parseMoxfieldList(text);
      const cards = await collectionLookup(lines.map((l) => ({ name: l.name.split(" // ")[0] })));
      const byName = new Map(cards.map((c) => [c.name.toLowerCase(), c]));
      const next: ProxyEntry[] = [];
      for (const line of lines) {
        const card =
          byName.get(line.name.toLowerCase()) ||
          byName.get(line.name.split(" // ")[0].toLowerCase());
        if (card) next.push({ card, quantity: line.quantity });
      }
      setEntries(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Import failed");
    } finally {
      setLoading(false);
    }
  }

  async function onSearch() {
    if (!search.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const res = await searchCards(`${search} game:paper`);
      setHits(res.data.slice(0, 12));
    } catch {
      try {
        const card = await namedCard(search);
        setHits([card]);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Search failed");
      }
    } finally {
      setLoading(false);
    }
  }

  function addCard(card: ScryfallCard) {
    setEntries((prev) => {
      const idx = prev.findIndex((e) => e.card.id === card.id);
      if (idx >= 0) {
        const copy = [...prev];
        copy[idx] = { ...copy[idx], quantity: copy[idx].quantity + 1 };
        return copy;
      }
      return [...prev, { card, quantity: 1 }];
    });
  }

  async function maybeAddTokens() {
    if (!includeTokens || !entries.length) return;
    setLoading(true);
    try {
      const legendary = entries.find((e) => e.card.type_line.includes("Legendary Creature"));
      if (!legendary) return;
      const res = await searchCards(`type:token legal:commander`);
      setHits(res.data.slice(0, 8));
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }

  const sheets = flattenForPrint(entries);

  async function onGeneratePdf() {
    if (!sheets.length) return;
    setPdfLoading(true);
    setError(null);
    try {
      await generateProxyPdf(sheets, {
        bleedMm,
        cutGuides,
        gapMm,
        paper,
        columns,
        rows,
        stamp: STAMP,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "PDF generation failed");
    } finally {
      setPdfLoading(false);
    }
  }

  return (
    <div className="tool-page container">
      <header className="tool-header no-print">
        <h1>Proxy tools</h1>
        <p>
          Search cards, import a list, and generate a print-ready PDF. Every proxy is stamped{" "}
          <strong>Unofficial Print</strong> with a link to this site.
        </p>
      </header>

      <section className="panel no-print">
        <h2 style={{ marginTop: 0, fontSize: "1.15rem" }}>Proxy etiquette</h2>
        <p>
          Proxies come with community guidelines — read{" "}
          <a
            href="https://www.letsproxy.com/mtg-proxy-cards-the-complete-guide-to-making-using-and-printing-them/"
            target="_blank"
            rel="noreferrer"
          >
            Let’s Proxy’s complete guide
          </a>{" "}
          before printing for events.
        </p>
      </section>

      <div className="split no-print" style={{ marginTop: "1rem" }}>
        <div className="panel">
          <div className="field">
            <label htmlFor="proxy-search">Card search</label>
            <input
              id="proxy-search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && void onSearch()}
              placeholder="Sol Ring"
            />
          </div>
          <div className="actions">
            <button type="button" className="btn btn-secondary" onClick={onSearch} disabled={loading}>
              Search
            </button>
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", marginTop: "0.75rem" }}>
            {hits.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => addCard(c)}
                style={{ border: "none", padding: 0, background: "none", cursor: "pointer" }}
                title={`Add ${c.name}`}
              >
                <img src={getCardImage(c)} alt={c.name} style={{ width: 72, borderRadius: 6 }} />
              </button>
            ))}
          </div>
        </div>

        <div className="panel">
          <div className="field">
            <label htmlFor="proxy-list">Import Moxfield list</label>
            <textarea id="proxy-list" value={listText} onChange={(e) => setListText(e.target.value)} />
          </div>
          <label className="check">
            <input
              type="checkbox"
              checked={includeTokens}
              onChange={(e) => setIncludeTokens(e.target.checked)}
            />
            Enable token helpers
          </label>
          <div className="actions">
            <button type="button" className="btn btn-primary" onClick={() => importList()} disabled={loading}>
              {loading ? "Loading…" : "Import list"}
            </button>
            {includeTokens && (
              <button type="button" className="btn btn-ghost" onClick={maybeAddTokens}>
                Suggest tokens
              </button>
            )}
          </div>
          {error && <p className="error">{error}</p>}
        </div>
      </div>

      <section className="panel no-print" style={{ marginTop: "1rem" }}>
        <h2 style={{ marginTop: 0, fontSize: "1.15rem" }}>Print layout</h2>
        <div className="field-grid">
          <div className="field">
            <label htmlFor="bleed">Bleed (mm)</label>
            <input
              id="bleed"
              type="number"
              min={0}
              max={5}
              step={0.5}
              value={bleedMm}
              onChange={(e) => setBleedMm(Number(e.target.value))}
            />
          </div>
          <div className="field">
            <label htmlFor="gap">Gap between cards (mm)</label>
            <input
              id="gap"
              type="number"
              min={0}
              max={8}
              step={0.5}
              value={gapMm}
              onChange={(e) => setGapMm(Number(e.target.value))}
            />
          </div>
          <div className="field">
            <label htmlFor="paper">Paper size</label>
            <select
              id="paper"
              value={paper}
              onChange={(e) => setPaper(e.target.value as ProxyPdfOptions["paper"])}
            >
              <option value="letter">US Letter</option>
              <option value="a4">A4</option>
            </select>
          </div>
          <div className="field">
            <label htmlFor="cols">Columns</label>
            <input
              id="cols"
              type="number"
              min={1}
              max={4}
              value={columns}
              onChange={(e) => setColumns(Number(e.target.value))}
            />
          </div>
          <div className="field">
            <label htmlFor="rows">Rows</label>
            <input
              id="rows"
              type="number"
              min={1}
              max={4}
              value={rows}
              onChange={(e) => setRows(Number(e.target.value))}
            />
          </div>
        </div>
        <div className="check-row" style={{ marginTop: "0.75rem" }}>
          <label className="check">
            <input
              type="checkbox"
              checked={cutGuides}
              onChange={(e) => setCutGuides(e.target.checked)}
            />
            Cut guides (crop marks)
          </label>
        </div>
        <p className="muted" style={{ marginTop: "0.5rem" }}>
          Bleed extends art past the cut line so edges don’t show white after trimming. Cut guides
          mark each card’s finished 63×88 mm size.
        </p>
        <div className="actions">
          <button
            type="button"
            className="btn btn-brass"
            onClick={onGeneratePdf}
            disabled={pdfLoading || !sheets.length}
          >
            {pdfLoading ? "Building PDF…" : "Generate PDF"}
          </button>
        </div>
      </section>

      <details className="panel no-print" style={{ marginTop: "1rem" }}>
        <summary style={{ cursor: "pointer", fontWeight: 600 }}>
          Queue ({sheets.length} cards) — text list
        </summary>
        <ul>
          {entries.map((e) => (
            <li key={e.card.id}>
              {e.quantity}× {e.card.name}{" "}
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => setEntries((prev) => prev.filter((x) => x.card.id !== e.card.id))}
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      </details>

      <section className="proxy-sheet" aria-label="Proxy preview">
        <div
          className="proxy-grid"
          style={{
            gap: `${gapMm}mm`,
          }}
        >
          {sheets.map((card, i) => (
            <div
              className={`proxy-card${cutGuides ? " proxy-card--guides" : ""}`}
              key={`${card.id}-${i}`}
              style={{
                padding: bleedMm > 0 ? `${bleedMm}mm` : undefined,
              }}
            >
              <img src={getCardImage(card, "large")} alt={card.name} />
              <div className="proxy-card__stamp">{STAMP}</div>
            </div>
          ))}
        </div>
      </section>

      <section className="panel no-print" style={{ marginTop: "1.5rem" }}>
        <h2 style={{ marginTop: 0 }}>Proxy supplies</h2>
        <div className="split">
          <div>
            <h3>Budget</h3>
            <ul>
              {budgetSupplies.map((item) => (
                <li key={item.name}>
                  <a href={item.url} target="_blank" rel="noreferrer">
                    {item.name}
                  </a>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h3>High-end</h3>
            <ul>
              {premiumSupplies.map((item) => (
                <li key={item.name}>
                  <a href={item.url} target="_blank" rel="noreferrer">
                    {item.name}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>
    </div>
  );
}

function flattenForPrint(entries: ProxyEntry[]): ScryfallCard[] {
  const out: ScryfallCard[] = [];
  for (const e of entries) {
    for (let i = 0; i < e.quantity; i++) out.push(e.card);
  }
  return out;
}
