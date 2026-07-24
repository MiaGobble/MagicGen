import { useMemo, useState } from "react";
import { useSearchParams } from "react-router";
import { Seo } from "../components/Seo";
import { maybeShowKofiSupportToast, useToast } from "../components/Toast";
import { parseMoxfieldList } from "../lib/moxfield";
import {
  formatUsd,
  optimizePurchase,
  priceDeck,
  vendorCartUrlForSplit,
  vendorQuotes,
  type OptimizedSplit,
  type PricedCard,
  type VendorQuote,
} from "../lib/pricing";

export function BulkPurchasePage() {
  const { toast } = useToast();
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
      toast(`Priced ${rows.length} unique line${rows.length === 1 ? "" : "s"}`, "success");
      maybeShowKofiSupportToast(toast);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Pricing failed");
      toast("Pricing failed", "error");
    } finally {
      setLoading(false);
    }
  }

  const scryfallTotal = priced?.reduce((s, p) => s + p.usd * p.quantity, 0) ?? 0;

  async function openVendorCart(
    url: string,
    rows: PricedCard[],
    listMode: "prefill" | "clipboard" = "prefill",
  ) {
    const list = rows.map((p) => `${p.quantity} ${p.name.split(" // ")[0]}`).join("\n");
    let copied = false;
    try {
      await navigator.clipboard.writeText(list);
      copied = true;
    } catch {
      /* clipboard may be blocked */
    }

    if (listMode === "clipboard") {
      toast(
        copied
          ? "List copied — paste into Cardsphere Wants → Actions → Import"
          : "Open Cardsphere Wants and paste your list (clipboard copy failed)",
        copied ? "success" : "info",
      );
    } else if (copied) {
      toast("List copied to clipboard (backup)", "success");
    } else {
      toast("Opened vendor (clipboard backup failed)", "info");
    }
    window.open(url, "_blank", "noopener,noreferrer");
  }

  return (
    <div className="tool-page container">
      <Seo
        title="Bulk Purchasing"
        description="Price a Magic deck list across vendors, compare shipping splits, and open optimized carts."
        path="/bulk"
      />
      <header className="tool-header">
        <h1>Bulk purchasing</h1>
        <p>
          Paste a Moxfield list, compare vendor totals (Scryfall USD + estimated shipping), and open
          mass-entry / builder pages with your list preloaded.
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
                <button
                  key={q.id}
                  type="button"
                  className="price-btn"
                  onClick={() => openVendorCart(q.cartUrl, priced, q.listMode)}
                >
                  <span>{q.name}</span>
                  <strong>{formatUsd(q.grandTotal)}</strong>
                  <span className="muted">
                    {formatUsd(q.total)} + {formatUsd(q.shipping)} ship ·{" "}
                    {q.listMode === "prefill" ? "list preloaded" : "copy list + open import"}
                  </span>
                </button>
              ))}
            </div>
            <p className="muted" style={{ marginTop: "0.75rem" }}>
              TCGPlayer Mass Entry, Card Kingdom builder, and Mana Pool add-deck preload your list in
              the URL. Cardsphere has no cart deep link — we copy the list and open Wants so you can
              paste into Actions → Import. The list is also copied as a backup for the other vendors.
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
                {Object.entries(optimized.vendorTotals).map(([id, v]) => {
                  const subset = optimized.assignments
                    .filter((a) => a.vendor === id)
                    .map((a) => ({
                      name: a.name,
                      quantity: a.quantity,
                      usd: a.unit,
                    }));
                  return (
                    <div key={id} className="panel">
                      <strong>{id}</strong>
                      <div>{v.cards} cards</div>
                      <div>{formatUsd(v.total)}</div>
                      <button
                        type="button"
                        className="btn btn-secondary"
                        style={{ marginTop: "0.5rem" }}
                        onClick={() =>
                          openVendorCart(
                            vendorCartUrlForSplit(id, subset),
                            subset,
                            id === "cardsphere" ? "clipboard" : "prefill",
                          )
                        }
                      >
                        Open {id} with these cards
                      </button>
                    </div>
                  );
                })}
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
