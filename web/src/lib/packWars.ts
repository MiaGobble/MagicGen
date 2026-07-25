/**
 * Pack Wars / Mini-Master: one (or more) draft boosters + 3 of each basic land.
 * @see https://mtg.fandom.com/wiki/Mini-Master
 */
import {
  DEFAULT_BOOSTER_QUERY,
  generateBoosters,
} from "./booster";
import { toMoxfieldList, type DeckLine } from "./moxfield";
import { namedExact, type ScryfallCard } from "./scryfall";

const BASIC_NAMES = ["Plains", "Island", "Swamp", "Mountain", "Forest"] as const;
const BASICS_EACH = 3;

/** Classic draft-ish pack without the basic-land slot. */
const PACK_RULES = [
  { rarity: "common" as const, count: 10, query: "r:common -t:basic" },
  { rarity: "uncommon" as const, count: 3, query: "r:uncommon -t:basic" },
];

export type PackWarsConfig = {
  /** How many decks / seats to generate (1–4). */
  players: number;
  /** Optional set code (e.g. mh3). Empty = any paper set. */
  set?: string;
  /** Packs shuffled into each deck (1 = classic, 2 = double-stack). */
  packsPerPlayer?: 1 | 2;
  /** Chance the rare slot is a mythic (default ~1/8 like modern boosters). */
  mythicChance?: number;
};

export type PackWarsDeck = {
  player: number;
  /** Non-land cards from the opened pack(s). */
  packCards: ScryfallCard[];
  /** Full deck including basics (for gallery / counts). */
  cards: ScryfallCard[];
  list: string;
  cardCount: number;
  packCount: number;
};

let basicsCache: Promise<ScryfallCard[]> | null = null;

async function loadBasicLands(): Promise<ScryfallCard[]> {
  if (!basicsCache) {
    basicsCache = Promise.all(BASIC_NAMES.map((name) => namedExact(name)));
  }
  return basicsCache;
}

function isBasicLand(card: ScryfallCard): boolean {
  const t = card.type_line ?? "";
  return /\bbasic\b/i.test(t) && /\bland\b/i.test(t);
}

function isPlayablePackCard(card: ScryfallCard): boolean {
  if (card.digital) return false;
  if (isBasicLand(card)) return false;
  const layout = card.layout ?? "";
  if (layout === "token" || layout === "art_series" || layout === "double_faced_token") {
    return false;
  }
  return true;
}

async function openOnePack(config: PackWarsConfig): Promise<ScryfallCard[]> {
  const mythicChance = config.mythicChance ?? 1 / 8;
  const rareIsMythic = Math.random() < mythicChance;
  const rules = [
    ...PACK_RULES,
    rareIsMythic
      ? { rarity: "mythic" as const, count: 1, query: "r:mythic -t:basic" }
      : { rarity: "rare" as const, count: 1, query: "r:rare -t:basic" },
  ];

  const packs = await generateBoosters({
    set: config.set?.trim() || undefined,
    defaultQuery: `${DEFAULT_BOOSTER_QUERY} -t:basic -is:token`,
    packs: 1,
    rules,
  });

  return (packs[0]?.cards ?? []).filter(isPlayablePackCard);
}

function linesFromDeck(packCards: ScryfallCard[], basics: ScryfallCard[]): DeckLine[] {
  const map = new Map<string, DeckLine>();

  const bump = (card: ScryfallCard, qty = 1) => {
    const key = `${card.name}|${card.set ?? ""}|${card.collector_number ?? ""}`;
    const existing = map.get(key);
    if (existing) {
      existing.quantity += qty;
      return;
    }
    map.set(key, {
      quantity: qty,
      name: card.name,
      setCode: card.set,
      collectorNumber: card.collector_number,
      category: "Deck",
    });
  };

  for (const card of packCards) bump(card, 1);
  for (const land of basics) bump(land, BASICS_EACH);

  return [...map.values()];
}

/**
 * Generate Pack Wars / Mini-Master decks:
 * open pack(s) → strip basics/tokens → add 3 of each basic land → shuffle-ready list.
 */
export async function generatePackWarsDecks(
  config: PackWarsConfig,
): Promise<PackWarsDeck[]> {
  const players = Math.min(4, Math.max(1, Math.floor(config.players) || 1));
  const packsPerPlayer = config.packsPerPlayer === 2 ? 2 : 1;
  const basics = await loadBasicLands();

  const decks: PackWarsDeck[] = [];
  for (let p = 0; p < players; p++) {
    const packCards: ScryfallCard[] = [];
    for (let i = 0; i < packsPerPlayer; i++) {
      packCards.push(...(await openOnePack(config)));
    }

    const lines = linesFromDeck(packCards, basics);
    const list = toMoxfieldList(lines, true);
    const cards: ScryfallCard[] = [
      ...packCards,
      ...basics.flatMap((land) => Array.from({ length: BASICS_EACH }, () => land)),
    ];

    decks.push({
      player: p + 1,
      packCards,
      cards,
      list,
      cardCount: packCards.length + BASIC_NAMES.length * BASICS_EACH,
      packCount: packsPerPlayer,
    });
  }

  return decks;
}

export const PACK_WARS_LAND_NOTE =
  "Each deck includes 3 Plains, 3 Island, 3 Swamp, 3 Mountain, and 3 Forest (15 basics).";
