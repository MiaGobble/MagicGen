import { randomCard, searchCards, searchPrintings, type ScryfallCard } from "./scryfall";

export type RarityRule = {
  rarity: "common" | "uncommon" | "rare" | "mythic";
  count: number;
  query: string; // extra scryfall query; empty = default
};

export type BoosterPresetId = "default" | "mostWanted" | "budget" | "rares";

export type BoosterConfig = {
  set?: string;
  defaultQuery: string;
  packs: number;
  rules: RarityRule[];
  /** Swap each pick to a flashier printing when available */
  pimpedPrintings?: boolean;
  /** 0–100 chance each card is marked foil (and prefers foil printings when pimping). */
  foilChance?: number;
  /** 0–100 chance each card prefers etched when available (after foil roll fails). */
  etchedChance?: number;
  /** When true, never repeat the same oracle card (by name) across all packs. */
  uniqueCards?: boolean;
  onProgress?: (done: number, total: number, label?: string) => void;
};

export type GeneratedPack = {
  index: number;
  cards: ScryfallCard[];
  /** Parallel finish tags for export (foil / etched). */
  finishes?: Array<string | undefined>;
};

/** Always applied so art series, tokens, digital-only, etc. cannot slip through. */
export const BOOSTER_PLAYABLE_FILTER =
  "game:paper -is:digital -is:token -is:emblem -is:artseries -is:memorabilia -is:planar -is:scheme -is:vanguard -is:attraction -is:stickers -t:card -st:art_series -st:token -st:memorabilia";

export const DEFAULT_BOOSTER_QUERY = BOOSTER_PLAYABLE_FILTER;

export const DEFAULT_BOOSTER_RULES: RarityRule[] = [
  { rarity: "common", count: 10, query: "r:common" },
  { rarity: "uncommon", count: 3, query: "r:uncommon" },
  { rarity: "rare", count: 1, query: "r:rare" },
];

export const BOOSTER_PRESETS: Record<
  BoosterPresetId,
  { label: string; blurb: string; defaultQuery: string; rules: RarityRule[] }
> = {
  default: {
    label: "Default",
    blurb: "Classic draft mix: commons, uncommons, and a rare.",
    defaultQuery: DEFAULT_BOOSTER_QUERY,
    rules: DEFAULT_BOOSTER_RULES,
  },
  mostWanted: {
    label: "Most wanted",
    blurb: "Chase-y premium treatments and higher-value cards.",
    defaultQuery: `${DEFAULT_BOOSTER_QUERY} (is:showcase OR is:borderless OR is:extended OR set:sld OR usd>=3)`,
    rules: [
      { rarity: "rare", count: 8, query: "r:rare (is:showcase OR is:borderless OR is:extended OR usd>=5 OR set:sld)" },
      { rarity: "mythic", count: 4, query: "r:mythic (is:showcase OR is:borderless OR usd>=8 OR set:sld)" },
      { rarity: "uncommon", count: 2, query: "r:uncommon (is:showcase OR is:borderless OR usd>=2)" },
    ],
  },
  budget: {
    label: "Budget",
    blurb: "Cheap paper cards only, great for casual packs.",
    defaultQuery: `${DEFAULT_BOOSTER_QUERY} usd<=0.5`,
    rules: [
      { rarity: "common", count: 10, query: "r:common usd<=0.35" },
      { rarity: "uncommon", count: 3, query: "r:uncommon usd<=0.5" },
      { rarity: "rare", count: 1, query: "r:rare usd<=1" },
    ],
  },
  rares: {
    label: "Rares",
    blurb: "Mythics and rares only (no commons or uncommons).",
    defaultQuery: DEFAULT_BOOSTER_QUERY,
    rules: [
      { rarity: "rare", count: 10, query: "r:rare" },
      { rarity: "mythic", count: 4, query: "r:mythic" },
    ],
  },
};

const NON_PLAYABLE_LAYOUTS = new Set([
  "art_series",
  "token",
  "double_faced_token",
  "emblem",
  "planar",
  "scheme",
  "vanguard",
  "augment",
  "host",
]);

/** Paper, non-token, non-art-series card that is legal in at least one format. */
export function isPlayableBoosterCard(card: ScryfallCard): boolean {
  if (card.digital) return false;
  if (Array.isArray(card.games) && card.games.length > 0 && !card.games.includes("paper")) {
    return false;
  }

  const layout = (card.layout ?? "").toLowerCase();
  if (NON_PLAYABLE_LAYOUTS.has(layout)) return false;

  const type = (card.type_line ?? "").trim();
  // Art Series / memorabilia faces are typed as bare "Card"
  if (/^card(\s*\/\/\s*card)?$/i.test(type)) return false;
  if (/\btoken\b/i.test(type)) return false;
  if (/\bemblem\b/i.test(type)) return false;

  const setTypeHints = (card.set_name ?? "").toLowerCase();
  if (setTypeHints.includes("art series") || setTypeHints.includes("minigame")) return false;

  const legalities = card.legalities;
  if (legalities) {
    const statuses = Object.values(legalities);
    const playable = statuses.some(
      (v) => v === "legal" || v === "restricted" || v === "banned",
    );
    // All not_legal → not a deck card (art series, tokens, etc.)
    if (!playable) return false;
  }

  return true;
}

const PICK_CHUNK_SIZE = 20;

function withPlayableFilter(query: string): string {
  const base = query.trim() || DEFAULT_BOOSTER_QUERY;
  // Always append safety terms so custom queries cannot drop them.
  return `(${base}) ${BOOSTER_PLAYABLE_FILTER}`;
}

async function pickRandomFromQuery(
  query: string,
  count: number,
  opts?: { usedNames?: Set<string> },
): Promise<ScryfallCard[]> {
  if (count <= 0) return [];
  const safeQuery = withPlayableFilter(query);
  const picks: ScryfallCard[] = [];
  const usedIds = new Set<string>();
  const usedNames = opts?.usedNames;

  const nameKey = (c: ScryfallCard) => c.name.toLowerCase().split(" // ")[0].trim();

  // Always use /cards/random so picks are drawn from the full Scryfall result set,
  // not just the first search page (which is name-sorted and heavily biased).
  let failures = 0;
  const maxAttempts = count * 8 + 16;
  while (picks.length < count && failures < maxAttempts) {
    const card = await randomCard(safeQuery);
    failures += 1;
    if (!card || !isPlayableBoosterCard(card)) continue;
    const key = nameKey(card);
    if (usedNames?.has(key)) continue;
    if (usedIds.has(card.id)) {
      // Allow a duplicate printing only after many unique misses (tiny print pools).
      if (failures < count * 4) continue;
    } else {
      usedIds.add(card.id);
    }
    if (usedNames) usedNames.add(key);
    picks.push(card);
  }

  // Last resort: fill from a search page if random kept missing (bad/narrow query).
  if (picks.length < count) {
    try {
      const list = await searchCards(safeQuery);
      const available = (list.data ?? []).filter((c) => {
        if (!isPlayableBoosterCard(c) || usedIds.has(c.id)) return false;
        if (usedNames?.has(nameKey(c))) return false;
        return true;
      });
      while (picks.length < count && available.length) {
        const idx = Math.floor(Math.random() * available.length);
        const card = available.splice(idx, 1)[0];
        usedIds.add(card.id);
        if (usedNames) usedNames.add(nameKey(card));
        picks.push(card);
      }
    } catch {
      /* ignore */
    }
  }

  return picks.slice(0, count);
}

type PickSlot = {
  packIndex: number;
  query: string;
  fallbackQuery: string;
};

/** Fill a chunk of slots (≤20), grouping identical queries into one request each. */
async function pickChunk(
  slots: PickSlot[],
  opts?: { usedNames?: Set<string> },
): Promise<(ScryfallCard | null)[]> {
  const out: (ScryfallCard | null)[] = Array.from({ length: slots.length }, () => null);
  const byQuery = new Map<string, number[]>();

  for (let i = 0; i < slots.length; i++) {
    const key = slots[i].query;
    const list = byQuery.get(key) ?? [];
    list.push(i);
    byQuery.set(key, list);
  }

  for (const [query, indices] of byQuery) {
    const picked = await pickRandomFromQuery(query, indices.length, opts);
    let used = 0;
    for (let j = 0; j < indices.length; j++) {
      if (used < picked.length) {
        out[indices[j]] = picked[used++];
      }
    }

    const missing = indices.filter((idx) => !out[idx]);
    if (!missing.length) continue;

    const fallbackQuery = slots[missing[0]].fallbackQuery;
    const more = await pickRandomFromQuery(fallbackQuery, missing.length, opts);
    for (let j = 0; j < missing.length && j < more.length; j++) {
      out[missing[j]] = more[j];
    }
  }

  return out;
}

function scorePrinting(card: ScryfallCard): number {
  let score = 0;
  const set = (card.set ?? "").toLowerCase();
  const setName = card.set_name?.toLowerCase() ?? "";
  if (set === "sld" || setName.includes("secret lair")) score += 50;
  if (setName.includes("showcase")) score += 28;
  if (setName.includes("borderless") || card.border_color === "borderless") score += 26;
  if (setName.includes("extended") || card.frame_effects?.includes("extendedart")) score += 22;
  if (card.full_art) score += 20;
  if (card.rarity === "mythic") score += 8;
  if (card.rarity === "rare") score += 4;
  const usd = Number(card.prices?.usd ?? 0);
  if (usd > 0) score += Math.min(30, Math.log10(usd + 1) * 14);
  const cn = Number(card.collector_number);
  if (!Number.isNaN(cn) && cn >= 300) score += 12;
  return score;
}

async function pimpCard(card: ScryfallCard, preferFinish?: "foil" | "etched"): Promise<ScryfallCard> {
  try {
    let prints = (await searchPrintings(card.name.split(" // ")[0])).filter(isPlayableBoosterCard);
    if (!prints.length) return card;
    if (preferFinish === "etched") {
      const etched = prints.filter((p) => p.finishes?.includes("etched"));
      if (etched.length) prints = etched;
    } else if (preferFinish === "foil") {
      const foils = prints.filter((p) => p.finishes?.includes("foil") || p.finishes?.includes("etched"));
      if (foils.length) prints = foils;
    }
    return [...prints].sort((a, b) => scorePrinting(b) - scorePrinting(a))[0] ?? card;
  } catch {
    return card;
  }
}

function rollFinish(foilChance: number, etchedChance: number): string | undefined {
  const foil = Math.max(0, Math.min(100, foilChance));
  const etched = Math.max(0, Math.min(100, etchedChance));
  if (Math.random() * 100 < foil) return "foil";
  if (Math.random() * 100 < etched) return "etched";
  return undefined;
}

export async function generateBoosters(config: BoosterConfig): Promise<GeneratedPack[]> {
  const rules = config.rules.filter((r) => r.count > 0);
  const slots: PickSlot[] = [];

  for (let p = 0; p < config.packs; p++) {
    for (const rule of rules) {
      const parts = [
        config.defaultQuery.trim() || DEFAULT_BOOSTER_QUERY,
        `r:${rule.rarity}`,
      ];
      if (config.set?.trim()) parts.push(`set:${config.set.trim()}`);
      if (rule.query.trim()) parts.push(`(${rule.query.trim()})`);
      const query = parts.join(" ");

      const fallbackParts = [DEFAULT_BOOSTER_QUERY, `r:${rule.rarity}`];
      if (config.set?.trim()) fallbackParts.push(`set:${config.set.trim()}`);
      const fallbackQuery = fallbackParts.join(" ");

      for (let i = 0; i < rule.count; i++) {
        slots.push({ packIndex: p, query, fallbackQuery });
      }
    }
  }

  const fetchChunks = Math.max(1, Math.ceil(Math.max(slots.length, 1) / PICK_CHUNK_SIZE));
  const pimpChunks = config.pimpedPrintings
    ? Math.max(1, Math.ceil(Math.max(slots.length, 1) / PICK_CHUNK_SIZE))
    : 0;
  const total = fetchChunks + pimpChunks;
  let done = 0;

  const report = (label: string) => {
    config.onProgress?.(done, Math.max(total, 1), label);
  };

  report(
    slots.length
      ? `Fetching cards 1–${Math.min(PICK_CHUNK_SIZE, slots.length)} of ${slots.length}…`
      : "Opening packs…",
  );

  const packCards: ScryfallCard[][] = Array.from({ length: config.packs }, () => []);
  const usedNames = config.uniqueCards ? new Set<string>() : undefined;

  for (let offset = 0; offset < slots.length; offset += PICK_CHUNK_SIZE) {
    const chunk = slots.slice(offset, offset + PICK_CHUNK_SIZE);
    const from = offset + 1;
    const to = offset + chunk.length;
    report(`Fetching cards ${from}–${to} of ${slots.length}…`);

    try {
      const picked = await pickChunk(chunk, { usedNames });
      for (let i = 0; i < chunk.length; i++) {
        const card = picked[i];
        if (card && isPlayableBoosterCard(card)) {
          packCards[chunk[i].packIndex].push(card);
        }
      }
    } catch {
      // chunk miss — continue
    }

    done += 1;
    report(
      to >= slots.length
        ? `Fetched ${slots.length} card${slots.length === 1 ? "" : "s"}`
        : `Fetched ${to} of ${slots.length} cards…`,
    );
  }

  if (!slots.length) {
    done = fetchChunks;
    report("No cards to fetch");
  }

  const foilChance = config.foilChance ?? 0;
  const etchedChance = config.etchedChance ?? 0;
  const packs: GeneratedPack[] = [];

  if (config.pimpedPrintings) {
    const flat: { packIndex: number; card: ScryfallCard; finish?: string }[] = [];
    for (let p = 0; p < config.packs; p++) {
      for (const card of packCards[p]) {
        flat.push({ packIndex: p, card, finish: rollFinish(foilChance, etchedChance) });
      }
    }

    const pimpedByPack: ScryfallCard[][] = Array.from({ length: config.packs }, () => []);
    const finishesByPack: Array<Array<string | undefined>> = Array.from(
      { length: config.packs },
      () => [],
    );

    for (let offset = 0; offset < flat.length; offset += PICK_CHUNK_SIZE) {
      const chunk = flat.slice(offset, offset + PICK_CHUNK_SIZE);
      const from = offset + 1;
      const to = offset + chunk.length;
      report(`Pimping cards ${from}-${to} of ${flat.length}…`);

      for (const item of chunk) {
        const prefer =
          item.finish === "etched" ? "etched" : item.finish === "foil" ? "foil" : undefined;
        const next = await pimpCard(item.card, prefer);
        const card = isPlayableBoosterCard(next) ? next : item.card;
        pimpedByPack[item.packIndex].push(card);
        finishesByPack[item.packIndex].push(item.finish);
      }

      done += 1;
      report(
        to >= flat.length
          ? `Pimped ${flat.length} card${flat.length === 1 ? "" : "s"}`
          : `Pimped ${to} of ${flat.length} cards…`,
      );
    }

    if (!flat.length) {
      done += pimpChunks;
      report("Nothing to pimp");
    }

    for (let p = 0; p < config.packs; p++) {
      packs.push({ index: p + 1, cards: pimpedByPack[p], finishes: finishesByPack[p] });
    }
  } else {
    for (let p = 0; p < config.packs; p++) {
      const finishes = packCards[p].map(() => rollFinish(foilChance, etchedChance));
      packs.push({ index: p + 1, cards: packCards[p], finishes });
    }
  }

  config.onProgress?.(Math.max(total, done), Math.max(total, 1), "Done");
  return packs;
}
