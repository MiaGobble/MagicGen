import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { parseMoxfieldList } from "../lib/moxfield";
import {
  formatUsd,
  optimizePurchase,
  priceDeck,
  vendorQuotes,
  type OptimizedSplit,
  type PricedCard,
  type VendorQuote,
} from "../lib/pricing";

export function BulkPurchasePage() {
  const [params] = useSearchParams();
  const initial = useMemo(() => {
    const raw = params.get("list");
    if (!raw) return "";
    try {
      return decodeURIComponent(raw);
    } catch {
      return raw;
    }
  }, [params]);

  const [input, setInput] = useState(initial);
  const [anyPrinting, setAnyPrinting] = useState(true);
  const [priced, setPriced] = useState<PricedCard[] | null>(null);
  const [quotes, setQuotes] = useState<VendorQuote[]>([]);
  const [optimized, setOptimized] = useState<OptimizedSplit | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onPrice() {
    setLoading(true);
    setError(null);
    try {
      const lines = parseMoxfieldList(input);
      if (!lines.length) throw new Error("No cards parsed from list");
      const rows = await priceDeck(lines, anyPrinting);
      setPriced(rows);
      setQuotes(vendorQuotes(rows));
      setOptimized(optimizePurchase(rows));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Pricing failed");
    } finally {
      setLoading(false);
    }
  }

  const scryfallTotal = priced?.reduce((s, p) => s + p.usd * p.quantity, 0) ?? 0;

  return (
    <div className="tool-page container">
      <header className="tool-header">
        <h1>Bulk purchasing</h1>
        <p>
          Paste a Moxfield list, compare vendor totals (Scryfall USD + estimated shipping), and see an
          optimized split across services.
        </p>
      </header>

      <div className="field">
        <label htmlFor="bulk-list">Deck / list</label>
        <textarea
          id="bulk-list"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={"1 Sol Ring\n1 Cyclonic Rift\n1 Fierce Guardianship"}
        />
      </div>

      <label className="check">
        <input
          type="checkbox"
          checked={anyPrinting}
          onChange={(e) => setAnyPrinting(e.target.checked)}
        />
        Use any printings (cheapest Scryfall USD printing preference via named lookup)
      </label>

      <div className="actions">
        <button type="button" className="btn btn-primary" onClick={onPrice} disabled={loading || !input.trim()}>
          {loading ? "Pricing…" : "Get prices"}
        </button>
      </div>

      {error && <p className="error">{error}</p>}

      {priced && (
        <>
          <section className="panel" style={{ marginTop: "1.25rem" }}>
            <h2 style={{ marginTop: 0 }}>Scryfall market total</h2>
            <p>
              <strong>{formatUsd(scryfallTotal)}</strong> across {priced.length} unique lines
            </p>
            <div className="price-buttons">
              {quotes.map((q) => (
                <a
                  key={q.id}
                  className="price-btn"
                  href={q.cartUrl}
                  target="_blank"
                  rel="noreferrer"
                  style={{ textDecoration: "none" }}
                >
                  <span>{q.name}</span>
                  <strong>{formatUsd(q.grandTotal)}</strong>
                  <span className="muted">
                    {formatUsd(q.total)} + {formatUsd(q.shipping)} ship
                  </span>
                </a>
              ))}
            </div>
            <p className="muted" style={{ marginTop: "0.75rem" }}>
              Vendor buttons open that service so you can paste / build a cart. Exact live cart APIs
              vary; totals use Scryfall USD as a shared baseline with modeled shipping.
            </p>
          </section>

          {optimized && (
            <section className="panel" style={{ marginTop: "1rem" }}>
              <h2 style={{ marginTop: 0 }}>Optimized price</h2>
              <p>
                Best modeled total: <strong>{formatUsd(optimized.grandTotal)}</strong> (includes
                shipping per vendor used)
              </p>
              <div className="field-grid">
                {Object.entries(optimized.vendorTotals).map(([id, v]) => (
                  <div key={id} className="panel">
                    <strong>{id}</strong>
                    <div>{v.cards} cards</div>
                    <div>{formatUsd(v.total)}</div>
                  </div>
                ))}
              </div>
              <details style={{ marginTop: "0.75rem" }}>
                <summary>Line assignments</summary>
                <ul>
                  {optimized.assignments.map((a) => (
                    <li key={`${a.vendor}-${a.name}`}>
                      {a.quantity} {a.name} → {a.vendor} ({formatUsd(a.lineTotal)})
                    </li>
                  ))}
                </ul>
              </details>
            </section>
          )}
        </>
      )}
    </div>
  );
}
