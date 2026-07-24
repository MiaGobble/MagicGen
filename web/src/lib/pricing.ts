import type { DeckLine } from "./moxfield";
import { collectionLookup, type ScryfallCard } from "./scryfall";

export type PricedCard = {
  name: string;
  quantity: number;
  usd: number;
  card?: ScryfallCard;
};

export type VendorListMode = "prefill" | "clipboard";

export type VendorQuote = {
  id: string;
  name: string;
  total: number;
  shipping: number;
  grandTotal: number;
  missing: string[];
  cartUrl: string;
  /** prefills URL with list vs opens import page (list already copied). */
  listMode: VendorListMode;
};

/** Optional Mana Pool affiliate referral code (`?ref=`). Leave empty if none. */
const MANAPOOL_REF = "";

function deckListText(priced: PricedCard[]): string {
  return priced.map((p) => `${p.quantity} ${p.name.split(" // ")[0]}`).join("\n");
}

/** UTF-8 → standard base64 (Mana Pool `deck=` param). */
function utf8ToBase64(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary);
}

const SHIPPING: Record<string, number> = {
  tcgplayer: 4.99,
  cardkingdom: 4.99,
  cardsphere: 3.99,
  manapool: 2.99,
};

export async function priceDeck(
  lines: DeckLine[],
  anyPrinting = true,
): Promise<PricedCard[]> {
  const idents = lines.map((l) => {
    if (!anyPrinting && l.setCode && l.collectorNumber) {
      return { set: l.setCode, collector_number: l.collectorNumber };
    }
    return { name: l.name.split(" // ")[0] };
  });

  const cards = await collectionLookup(idents);
  const byName = new Map(cards.map((c) => [c.name.toLowerCase(), c]));

  return lines.map((l) => {
    const card =
      byName.get(l.name.toLowerCase()) ||
      byName.get(l.name.split(" // ")[0].toLowerCase());
    const usd = Number(card?.prices?.usd ?? card?.prices?.usd_foil ?? 0) || 0;
    return { name: l.name, quantity: l.quantity, usd, card };
  });
}

/** TCGPlayer mass-entry deep link (cards pre-filled for add-to-cart). */
export function tcgplayerMassEntryUrl(priced: PricedCard[]): string {
  const c = priced.map((p) => `${p.quantity} ${p.name.split(" // ")[0]}`).join("||");
  const params = new URLSearchParams({
    productLineName: "magic",
    c,
  });
  return `https://www.tcgplayer.com/massentry?${params.toString()}`;
}

/** Card Kingdom deck builder with list preloaded. */
export function cardKingdomBuilderUrl(priced: PricedCard[]): string {
  const params = new URLSearchParams({
    partner: "magicgen",
    utm_source: "magicgen",
    c: deckListText(priced),
  });
  return `https://www.cardkingdom.com/builder?${params.toString()}`;
}

/**
 * Mana Pool mass entry — official deep link used by EDHREC / affiliates:
 * https://manapool.com/add-deck?deck=<base64(qty name\\n...)>&ref=<code>
 */
export function manapoolCartUrl(priced: PricedCard[]): string {
  const params = new URLSearchParams({
    deck: utf8ToBase64(deckListText(priced)),
    ref_meta: "referrer:magicgen,decklist",
  });
  if (MANAPOOL_REF) params.set("ref", MANAPOOL_REF);
  return `https://manapool.com/add-deck?${params.toString()}`;
}

/**
 * Cardsphere has no public cart/list deep link. Open Wants (text importer lives
 * under Actions → Import after login); caller should copy the list first.
 */
export function cardsphereUrl(_priced: PricedCard[]): string {
  return "https://www.cardsphere.com/wants";
}

export function vendorQuotes(priced: PricedCard[]): VendorQuote[] {
  const subtotal = priced.reduce((s, p) => s + p.usd * p.quantity, 0);
  const missing = priced.filter((p) => !p.usd).map((p) => p.name);

  const mk = (
    id: string,
    name: string,
    cartUrl: string,
    listMode: VendorListMode,
  ): VendorQuote => {
    const shipping = SHIPPING[id] ?? 5;
    return {
      id,
      name,
      total: subtotal,
      shipping,
      grandTotal: subtotal + shipping,
      missing,
      cartUrl,
      listMode,
    };
  };

  return [
    mk("tcgplayer", "TCGPlayer", tcgplayerMassEntryUrl(priced), "prefill"),
    mk("cardkingdom", "Card Kingdom", cardKingdomBuilderUrl(priced), "prefill"),
    mk("manapool", "Manapool", manapoolCartUrl(priced), "prefill"),
    mk("cardsphere", "Cardsphere", cardsphereUrl(priced), "clipboard"),
  ];
}

export function vendorCartUrlForSplit(vendorId: string, priced: PricedCard[]): string {
  switch (vendorId) {
    case "tcgplayer":
      return tcgplayerMassEntryUrl(priced);
    case "cardkingdom":
      return cardKingdomBuilderUrl(priced);
    case "manapool":
      return manapoolCartUrl(priced);
    default:
      return cardsphereUrl(priced);
  }
}

export type OptimizedSplit = {
  assignments: Array<{
    name: string;
    quantity: number;
    vendor: string;
    unit: number;
    lineTotal: number;
  }>;
  vendorTotals: Record<string, { cards: number; subtotal: number; shipping: number; total: number }>;
  grandTotal: number;
};

export function optimizePurchase(priced: PricedCard[]): OptimizedSplit {
  const vendors = [
    { id: "tcgplayer", mult: 1.0, shipping: SHIPPING.tcgplayer },
    { id: "cardkingdom", mult: 1.08, shipping: SHIPPING.cardkingdom },
    { id: "manapool", mult: 0.97, shipping: SHIPPING.manapool },
    { id: "cardsphere", mult: 1.03, shipping: SHIPPING.cardsphere },
  ];

  const assignments: OptimizedSplit["assignments"] = [];
  const used = new Set<string>();

  for (const p of priced) {
    if (!p.usd) {
      assignments.push({
        name: p.name,
        quantity: p.quantity,
        vendor: "tcgplayer",
        unit: 0,
        lineTotal: 0,
      });
      used.add("tcgplayer");
      continue;
    }
    let best = vendors[0];
    let bestCost = p.usd * best.mult;
    for (const v of vendors) {
      const c = p.usd * v.mult;
      if (c < bestCost) {
        best = v;
        bestCost = c;
      }
    }
    used.add(best.id);
    assignments.push({
      name: p.name,
      quantity: p.quantity,
      vendor: best.id,
      unit: bestCost,
      lineTotal: bestCost * p.quantity,
    });
  }

  const singleTotals = vendors.map((v) => {
    const sub = priced.reduce((s, p) => s + p.usd * v.mult * p.quantity, 0);
    return { id: v.id, total: sub + v.shipping, sub, shipping: v.shipping };
  });
  singleTotals.sort((a, b) => a.total - b.total);

  const splitSub = assignments.reduce((s, a) => s + a.lineTotal, 0);
  const splitShip = [...used].reduce((s, id) => {
    const v = vendors.find((x) => x.id === id);
    return s + (v?.shipping ?? 0);
  }, 0);
  const splitTotal = splitSub + splitShip;

  if (singleTotals[0].total <= splitTotal) {
    const v = singleTotals[0];
    const mult = vendors.find((x) => x.id === v.id)!.mult;
    const consolidated = priced.map((p) => ({
      name: p.name,
      quantity: p.quantity,
      vendor: v.id,
      unit: p.usd * mult,
      lineTotal: p.usd * mult * p.quantity,
    }));
    return {
      assignments: consolidated,
      vendorTotals: {
        [v.id]: {
          cards: priced.reduce((s, p) => s + p.quantity, 0),
          subtotal: v.sub,
          shipping: v.shipping,
          total: v.total,
        },
      },
      grandTotal: v.total,
    };
  }

  const vendorTotals: OptimizedSplit["vendorTotals"] = {};
  for (const a of assignments) {
    const v = vendors.find((x) => x.id === a.vendor)!;
    if (!vendorTotals[a.vendor]) {
      vendorTotals[a.vendor] = { cards: 0, subtotal: 0, shipping: v.shipping, total: 0 };
    }
    vendorTotals[a.vendor].cards += a.quantity;
    vendorTotals[a.vendor].subtotal += a.lineTotal;
  }
  for (const id of Object.keys(vendorTotals)) {
    vendorTotals[id].total = vendorTotals[id].subtotal + vendorTotals[id].shipping;
  }

  return {
    assignments,
    vendorTotals,
    grandTotal: Object.values(vendorTotals).reduce((s, v) => s + v.total, 0),
  };
}

export function formatUsd(n: number): string {
  return n.toLocaleString("en-US", { style: "currency", currency: "USD" });
}
