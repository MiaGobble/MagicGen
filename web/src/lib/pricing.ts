/**
 * Deck pricing + purchase estimates (Scryfall USD + modeled shipping).
 *
 * Card prices come from Scryfall. Vendor "multipliers" are rough relative
 * storefront bias — not live inventory. Shipping models:
 * - Single-warehouse stores (CK, Mana Pool, Cardsphere): one fee, with free-ship thresholds.
 * - TCGPlayer mass-entry: marketplace multi-seller estimate (dominant real-world cost).
 */
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
  /** Estimated distinct shippers (TCGPlayer marketplace). */
  sellers?: number;
  /** Short explanation of how shipping was estimated. */
  shippingNote?: string;
};

/** Optional Mana Pool affiliate referral code (`?ref=`). Leave empty if none. */
const MANAPOOL_REF = "";

type VendorModel = {
  id: string;
  name: string;
  /** Synthetic price vs Scryfall (live quotes unavailable). */
  mult: number;
  /** Flat shipping when treated as one warehouse. */
  baseShipping: number;
  /** Free shipping when modeled subtotal ≥ this (0 = never). */
  freeShipAt: number;
  /** Marketplace mass-entry (many sellers). */
  marketplace: boolean;
  listMode: VendorListMode;
};

const VENDORS: VendorModel[] = [
  {
    id: "tcgplayer",
    name: "TCGPlayer",
    mult: 1.0,
    baseShipping: 4.99,
    freeShipAt: 0,
    marketplace: true,
    listMode: "prefill",
  },
  {
    id: "cardkingdom",
    name: "Card Kingdom",
    mult: 1.08,
    baseShipping: 4.99,
    freeShipAt: 50,
    marketplace: false,
    listMode: "prefill",
  },
  {
    id: "manapool",
    name: "Manapool",
    mult: 0.97,
    baseShipping: 2.99,
    freeShipAt: 50,
    marketplace: false,
    listMode: "prefill",
  },
  {
    id: "cardsphere",
    name: "Cardsphere",
    mult: 1.03,
    baseShipping: 3.99,
    freeShipAt: 0,
    marketplace: false,
    listMode: "clipboard",
  },
];

/** ~lines per marketplace seller in a mixed mass-entry cart (conservative = lower). */
const TCG_LINES_PER_SELLER = 2.5;
/** Typical small-order seller shipping on TCGPlayer marketplace. */
const TCG_PER_SELLER_SHIP = 1.49;
const TCG_MAX_SELLERS = 45;

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

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function uniquePricedLines(priced: PricedCard[]): number {
  return priced.filter((p) => p.usd > 0).length;
}

/**
 * Estimate TCGPlayer marketplace shipping for a mass-entry cart.
 * Real carts often pull from dozens of sellers; flat $4.99 wildly understates that.
 */
export function estimateTcgplayerMarketplaceShipping(uniqueLines: number): {
  sellers: number;
  shipping: number;
  note: string;
} {
  const lines = Math.max(0, uniqueLines);
  if (lines <= 0) {
    return { sellers: 0, shipping: 0, note: "No priced lines" };
  }
  const sellers = Math.max(
    1,
    Math.min(TCG_MAX_SELLERS, Math.ceil(lines / TCG_LINES_PER_SELLER)),
  );
  const shipping = round2(sellers * TCG_PER_SELLER_SHIP);
  return {
    sellers,
    shipping,
    note: `~${sellers} marketplace sellers × ${formatUsd(TCG_PER_SELLER_SHIP)} (mass-entry estimate)`,
  };
}

/** Shipping for a vendor given modeled subtotal and how many unique lines go there. */
export function estimateVendorShipping(
  vendorId: string,
  subtotal: number,
  uniqueLines: number,
): { shipping: number; sellers: number; note: string } {
  const v = VENDORS.find((x) => x.id === vendorId);
  if (!v) {
    return { shipping: 5, sellers: 1, note: "Flat estimate" };
  }
  if (v.marketplace) {
    return estimateTcgplayerMarketplaceShipping(uniqueLines);
  }
  if (v.freeShipAt > 0 && subtotal >= v.freeShipAt) {
    return {
      shipping: 0,
      sellers: 1,
      note: `Free shipping at ${formatUsd(v.freeShipAt)}+`,
    };
  }
  return {
    shipping: v.baseShipping,
    sellers: 1,
    note: `Single-store ship${v.freeShipAt > 0 ? ` (free at ${formatUsd(v.freeShipAt)}+)` : ""}`,
  };
}

export async function priceDeck(
  lines: DeckLine[],
  anyPrinting = true,
  onProgress?: (done: number, total: number, label?: string) => void,
): Promise<PricedCard[]> {
  const idents = lines.map((l) => {
    if (!anyPrinting && l.setCode && l.collectorNumber) {
      return { set: l.setCode, collector_number: l.collectorNumber };
    }
    return { name: l.name.split(" // ")[0] };
  });

  const cards = await collectionLookup(idents, onProgress);
  const byName = new Map(cards.map((c) => [c.name.toLowerCase(), c]));

  onProgress?.(
    Math.max(1, Math.ceil(idents.length / 75)),
    Math.max(1, Math.ceil(idents.length / 75)),
    "Building price table…",
  );

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

function cartUrlFor(id: string, priced: PricedCard[]): string {
  switch (id) {
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

export function vendorQuotes(priced: PricedCard[]): VendorQuote[] {
  const missing = priced.filter((p) => !p.usd).map((p) => p.name);
  const lines = uniquePricedLines(priced);

  return VENDORS.map((v) => {
    const total = round2(priced.reduce((s, p) => s + p.usd * v.mult * p.quantity, 0));
    const ship = estimateVendorShipping(v.id, total, lines);
    return {
      id: v.id,
      name: v.name,
      total,
      shipping: ship.shipping,
      grandTotal: round2(total + ship.shipping),
      missing,
      cartUrl: cartUrlFor(v.id, priced),
      listMode: v.listMode,
      sellers: ship.sellers,
      shippingNote: ship.note,
    };
  });
}

export function vendorCartUrlForSplit(vendorId: string, priced: PricedCard[]): string {
  return cartUrlFor(vendorId, priced);
}

export type OptimizedSplit = {
  assignments: Array<{
    name: string;
    quantity: number;
    vendor: string;
    unit: number;
    lineTotal: number;
  }>;
  vendorTotals: Record<
    string,
    { cards: number; subtotal: number; shipping: number; total: number; sellers?: number }
  >;
  grandTotal: number;
  /** Why this plan beat the alternatives. */
  strategyNote: string;
};

function buildTotalsFromAssignments(
  assignments: OptimizedSplit["assignments"],
): OptimizedSplit["vendorTotals"] {
  const vendorTotals: OptimizedSplit["vendorTotals"] = {};
  const linesByVendor = new Map<string, number>();

  for (const a of assignments) {
    if (!vendorTotals[a.vendor]) {
      vendorTotals[a.vendor] = { cards: 0, subtotal: 0, shipping: 0, total: 0 };
      linesByVendor.set(a.vendor, 0);
    }
    vendorTotals[a.vendor].cards += a.quantity;
    vendorTotals[a.vendor].subtotal += a.lineTotal;
    if (a.unit > 0) {
      linesByVendor.set(a.vendor, (linesByVendor.get(a.vendor) ?? 0) + 1);
    }
  }

  for (const id of Object.keys(vendorTotals)) {
    const sub = round2(vendorTotals[id].subtotal);
    vendorTotals[id].subtotal = sub;
    const ship = estimateVendorShipping(id, sub, linesByVendor.get(id) ?? 0);
    vendorTotals[id].shipping = ship.shipping;
    vendorTotals[id].sellers = ship.sellers;
    vendorTotals[id].total = round2(sub + ship.shipping);
  }

  return vendorTotals;
}

function grandFromTotals(vendorTotals: OptimizedSplit["vendorTotals"]): number {
  return round2(Object.values(vendorTotals).reduce((s, v) => s + v.total, 0));
}

function singleVendorPlan(priced: PricedCard[], vendorId: string): OptimizedSplit {
  const v = VENDORS.find((x) => x.id === vendorId)!;
  const assignments = priced.map((p) => {
    const unit = p.usd * v.mult;
    return {
      name: p.name,
      quantity: p.quantity,
      vendor: v.id,
      unit,
      lineTotal: round2(unit * p.quantity),
    };
  });
  const vendorTotals = buildTotalsFromAssignments(assignments);
  return {
    assignments,
    vendorTotals,
    grandTotal: grandFromTotals(vendorTotals),
    strategyNote: `All-in at ${v.name}`,
  };
}

/**
 * Shipping-aware purchase plan.
 * Strongly prefers a single storefront — multi-vendor splits stack shipping,
 * and TCGPlayer mass-entry already behaves like many sellers.
 */
export function optimizePurchase(priced: PricedCard[]): OptimizedSplit {
  // 1) Best single-vendor plan (with marketplace / free-ship modeling)
  const singles = VENDORS.map((v) => singleVendorPlan(priced, v.id)).sort(
    (a, b) => a.grandTotal - b.grandTotal,
  );
  let best = singles[0];

  // 2) Greedy multi-vendor by card price only, then price with full shipping
  const greedyAssign: OptimizedSplit["assignments"] = [];
  for (const p of priced) {
    if (!p.usd) {
      greedyAssign.push({
        name: p.name,
        quantity: p.quantity,
        vendor: "tcgplayer",
        unit: 0,
        lineTotal: 0,
      });
      continue;
    }
    let bestV = VENDORS[0];
    let bestCost = p.usd * bestV.mult;
    for (const v of VENDORS) {
      const c = p.usd * v.mult;
      if (c < bestCost) {
        bestV = v;
        bestCost = c;
      }
    }
    greedyAssign.push({
      name: p.name,
      quantity: p.quantity,
      vendor: bestV.id,
      unit: bestCost,
      lineTotal: round2(bestCost * p.quantity),
    });
  }

  let splitAssign = greedyAssign;
  let splitTotals = buildTotalsFromAssignments(splitAssign);
  let splitGrand = grandFromTotals(splitTotals);

  // 3) Local search: drop the costliest-shipping vendor bucket into the next-best home
  for (let pass = 0; pass < 6; pass++) {
    const ids = Object.keys(splitTotals);
    if (ids.length <= 1) break;

    // Prefer eliminating the bucket with worst shipping-to-subtotal ratio / highest ship
    ids.sort((a, b) => splitTotals[b].shipping - splitTotals[a].shipping);
    const victim = ids[0];
    let improved = false;

    const homes = [
      ...new Set([
        ...ids.filter((id) => id !== victim),
        ...VENDORS.map((v) => v.id),
      ]),
    ];

    for (const home of homes) {
      if (home === victim) continue;
      const trial = splitAssign.map((a) => {
        if (a.vendor !== victim) return a;
        const prevMult = VENDORS.find((x) => x.id === a.vendor)?.mult ?? 1;
        const scryfallUnit = prevMult > 0 ? a.unit / prevMult : 0;
        const v = VENDORS.find((x) => x.id === home)!;
        const newUnit = scryfallUnit * v.mult;
        return {
          ...a,
          vendor: home,
          unit: newUnit,
          lineTotal: round2(newUnit * a.quantity),
        };
      });
      const trialTotals = buildTotalsFromAssignments(trial);
      const trialGrand = grandFromTotals(trialTotals);
      if (trialGrand + 0.005 < splitGrand) {
        splitAssign = trial;
        splitTotals = trialTotals;
        splitGrand = trialGrand;
        improved = true;
        break;
      }
    }
    if (!improved) break;
  }

  if (splitGrand + 0.005 < best.grandTotal) {
    best = {
      assignments: splitAssign,
      vendorTotals: splitTotals,
      grandTotal: splitGrand,
      strategyNote:
        Object.keys(splitTotals).length > 1
          ? "Split across vendors after shipping-aware consolidation"
          : `Consolidated to ${VENDORS.find((v) => v.id === Object.keys(splitTotals)[0])?.name ?? "one vendor"}`,
    };
  } else {
    best = {
      ...best,
      strategyNote: `Single storefront beats multi-vendor once shipping is counted (${best.strategyNote})`,
    };
  }

  return best;
}

/**
 * Best estimated all-in purchase cost (cards + modeled shipping) for a priced list.
 * Used by bulk UI and deck cost cutter budget checks.
 */
export function estimateAllInPurchase(priced: PricedCard[]): {
  cardTotal: number;
  shipping: number;
  grandTotal: number;
  vendorId: string;
  vendorName: string;
  sellers: number;
  note: string;
} {
  const plan = optimizePurchase(priced);
  const entries = Object.entries(plan.vendorTotals);
  const primary =
    entries.sort((a, b) => b[1].total - a[1].total)[0] ??
    (["tcgplayer", { cards: 0, subtotal: 0, shipping: 0, total: 0, sellers: 1 }] as const);
  const cardTotal = round2(priced.reduce((s, p) => s + p.usd * p.quantity, 0));
  const shipping = round2(entries.reduce((s, [, v]) => s + v.shipping, 0));
  const vMeta = VENDORS.find((v) => v.id === primary[0]);
  return {
    cardTotal,
    shipping,
    grandTotal: plan.grandTotal,
    vendorId: primary[0],
    vendorName: vMeta?.name ?? primary[0],
    sellers: entries.reduce((s, [, v]) => s + (v.sellers ?? 1), 0),
    note: plan.strategyNote,
  };
}

export function formatUsd(n: number): string {
  return n.toLocaleString("en-US", { style: "currency", currency: "USD" });
}
