import { amazonSearchUrl } from "./affiliate";

export type SupplyKey =
  | "d20"
  | "d6"
  | "sleeves"
  | "deckBoxes"
  | "cardStorage"
  | "coins"
  | "whiteboardTokens"
  | "playmats"
  | "carryingCases"
  | "plusOneCounters"
  | "diceBoxes"
  | "comboSets";

export const SUPPLY_LABELS: Record<Exclude<SupplyKey, "comboSets">, string> = {
  d20: "D20 dice",
  d6: "D6 dice",
  sleeves: "Sleeves",
  deckBoxes: "Deck boxes",
  cardStorage: "Card storage boxes",
  coins: "Coins / tokens",
  whiteboardTokens: "Whiteboard tokens",
  playmats: "Playmats",
  carryingCases: "Card carrying cases",
  plusOneCounters: "+1/+1 counters",
  diceBoxes: "Dice boxes",
};

type CatalogProduct = { title: string; query: string };

/**
 * Supply catalog: display title + Amazon search query.
 * Search URLs stay accurate when ASINs remapped (e.g. dice → Uno).
 * Premium titles may name brands; budget titles stay generic.
 */
const SUPPLY_CATALOG: Record<string, CatalogProduct> = {
  d20_premium_spindown: {
    title: "Chessex / MTG spindown-style D20 set",
    query: "MTG spindown D20 dice life counter Chessex",
  },
  d20_budget_spindown: {
    title: "Spindown D20 life-counter dice",
    query: "spindown D20 dice MTG life counter",
  },
  d20_premium: {
    title: "Chessex opaque polyhedral D20 dice",
    query: "Chessex opaque D20 polyhedral dice set",
  },
  d20_budget: {
    title: "D20 dice set",
    query: "polyhedral D20 dice set RPG opaque",
  },
  d6_premium: {
    title: "Chessex opaque D6 dice block",
    query: "Chessex opaque dice block D6",
  },
  d6_budget: {
    title: "D6 dice set (pack)",
    query: "opaque D6 dice block 12mm RPG",
  },
  sleeves_premium: {
    title: "Dragon Shield Matte Black (100)",
    query: "Dragon Shield Matte Black sleeves 100",
  },
  sleeves_budget: {
    title: "Matte card sleeves (100)",
    query: "budget matte card sleeves 100 pack trading card",
  },
  deckBoxes_premium: {
    title: "Ultimate Guard Boulder 100+",
    query: "Ultimate Guard Boulder 100+ deck box",
  },
  deckBoxes_premiumMagnetic: {
    title: "Magnetic leather deck box (100+)",
    query: "magnetic leather deck box 100 commander MTG",
  },
  deckBoxes_premiumPlastic: {
    title: "Ultimate Guard Boulder 100+ (plastic)",
    query: "Ultimate Guard Boulder 100+ plastic deck box",
  },
  deckBoxes_budget: {
    title: "100+ card deck box",
    query: "budget deck box 100 double sleeved commander",
  },
  deckBoxes_budgetMagnetic: {
    title: "Magnetic deck box (100+)",
    query: "budget magnetic deck box 100 cards",
  },
  deckBoxes_budgetPlastic: {
    title: "Plastic deck box (100+)",
    query: "budget plastic deck box 100 cards commander",
  },
  cardStorage_premium: {
    title: "BCW card storage box (3200 count)",
    query: "BCW card storage box 3200 count",
  },
  cardStorage_budget: {
    title: "Card storage box (large)",
    query: "budget trading card storage box 3200 5000",
  },
  coins_premium: {
    title: "Metal coins / tokens for MTG",
    query: "MTG metal coins tokens counters set",
  },
  coins_budget: {
    title: "Plastic tokens / coin counters",
    query: "budget plastic tokens coins counters card game",
  },
  whiteboardTokens_premium: {
    title: "Dry-erase whiteboard tokens",
    query: "dry erase whiteboard tokens MTG counters",
  },
  whiteboardTokens_budget: {
    title: "Dry-erase token blanks",
    query: "budget dry erase tokens counters card game",
  },
  playmats_premium: {
    title: "Premium MTG playmat",
    query: "Ultimate Guard or Dragon Shield MTG playmat",
  },
  playmats_premiumArt: {
    title: "Dragon Shield art playmat",
    query: "Dragon Shield art playmat MTG",
  },
  playmats_premiumBasic: {
    title: "Solid-color premium playmat",
    query: "Ultimate Guard solid color playmat MTG",
  },
  playmats_budget: {
    title: "Budget playmat",
    query: "budget mousepad playmat trading card game 24x14",
  },
  playmats_budgetArt: {
    title: "Art playmat (budget)",
    query: "budget art playmat trading card game",
  },
  playmats_budgetBasic: {
    title: "Solid-color playmat",
    query: "budget solid color playmat trading cards",
  },
  // Multi-deck cases — NOT single deck boxes
  carryingCases_premium: {
    title: "Ultimate Guard Twin Flip / multi-deck carrying case",
    query: "Ultimate Guard Twin Flip case OR Gamegenic deck carrying case multiple decks",
  },
  carryingCases_budget: {
    title: "Card carrying case (holds multiple decks)",
    query: "trading card carrying case bag multiple decks commander",
  },
  plusOneCounters_premium: {
    title: "Chessex dice for +1/+1 counters",
    query: "Chessex D6 dice counters MTG +1/+1",
  },
  plusOneCounters_budget: {
    title: "+1/+1 counter dice / tokens",
    query: "budget +1/+1 counter dice tokens MTG",
  },
  diceBoxes_premium: {
    title: "Dice storage box / case",
    query: "Gamegenic or Ultimate Guard dice bag box storage",
  },
  diceBoxes_budget: {
    title: "Dice box / storage tin",
    query: "budget dice storage box tin case RPG",
  },
  comboSets_premium: {
    title: "Premium sleeves + deck box starter bundle",
    query: "Dragon Shield sleeves Ultimate Guard deck box MTG bundle",
  },
  comboSets_budget: {
    title: "Budget sleeves + deck box bundle",
    query: "budget card sleeves deck box starter pack trading cards",
  },
};

export type SupplyOptions = {
  items: SupplyKey[];
  premium: boolean;
  spindown: boolean;
  deckBoxType: "any" | "magnetic" | "plastic";
  playmatType: "any" | "art" | "basic";
  allowCombo: boolean;
};

export type SupplyResult = {
  label: string;
  title: string;
  /** Stable key for list rendering (was ASIN; now catalog/query id). */
  id: string;
  url: string;
};

function pickCatalog(key: string): CatalogProduct | null {
  return SUPPLY_CATALOG[key] ?? null;
}

function toSupplyResult(label: string, id: string, product: CatalogProduct): SupplyResult {
  return {
    label,
    title: product.title,
    id,
    url: amazonSearchUrl(product.query),
  };
}

/** Algorithm: map options → catalog key → Amazon search URL. */
export function buildSupplyQueries(options: SupplyOptions): SupplyResult[] {
  const tier = options.premium ? "premium" : "budget";
  const results: SupplyResult[] = [];

  if (options.allowCombo) {
    const catalogKey = `comboSets_${tier}`;
    const p = pickCatalog(catalogKey);
    if (p) results.push(toSupplyResult("Combo / bulk sets", catalogKey, p));
  }

  for (const key of options.items) {
    if (key === "comboSets") continue;
    let catalogKey = `${key}_${tier}`;

    if (key === "d20") {
      catalogKey = options.spindown ? `d20_${tier}_spindown` : `d20_${tier}`;
    } else if (key === "deckBoxes") {
      if (options.deckBoxType === "magnetic") catalogKey = `deckBoxes_${tier}Magnetic`;
      else if (options.deckBoxType === "plastic") catalogKey = `deckBoxes_${tier}Plastic`;
      else catalogKey = `deckBoxes_${tier}`;
    } else if (key === "playmats") {
      if (options.playmatType === "art") catalogKey = `playmats_${tier}Art`;
      else if (options.playmatType === "basic") catalogKey = `playmats_${tier}Basic`;
      else catalogKey = `playmats_${tier}`;
    }

    const product = pickCatalog(catalogKey) ?? pickCatalog(`${key}_${tier}`);
    if (!product) continue;
    results.push(toSupplyResult(SUPPLY_LABELS[key], catalogKey, product));
  }

  return results;
}

export function proxySupplyLinks(tier: "budget" | "premium"): { name: string; url: string }[] {
  if (tier === "budget") {
    return [
      { name: "Letter-size cardstock (65–110 lb)", query: "letter size cardstock 65 lb 110 lb" },
      { name: "Matte photo / inkjet paper", query: "matte photo paper inkjet letter" },
      { name: "Paper cutter / craft knife", query: "paper cutter craft knife guillotine" },
      { name: "Budget sleeves for proxies", query: "budget card sleeves mtg clear matte" },
    ].map((item) => ({ name: item.name, url: amazonSearchUrl(item.query) }));
  }
  return [
    { name: "Premium laser-safe cardstock", query: "premium laser cardstock letter heavyweight" },
    { name: "Precision paper cutter", query: "precision paper trimmer cutter Fiskars" },
    { name: "Dragon Shield Clear sleeves", query: "Dragon Shield Clear matte sleeves 100" },
    { name: "Dragon Shield Black outers", query: "Dragon Shield Matte Black sleeves 100" },
  ].map((item) => ({ name: item.name, url: amazonSearchUrl(item.query) }));
}
