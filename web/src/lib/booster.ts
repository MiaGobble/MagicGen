import { searchCards, type ScryfallCard } from "./scryfall";

export type RarityRule = {
  rarity: "common" | "uncommon" | "rare" | "mythic";
  count: number;
  query: string; // extra scryfall query; empty = default
};

export type BoosterConfig = {
  set?: string;
  defaultQuery: string;
  packs: number;
  rules: RarityRule[];
};

export type GeneratedPack = {
  index: number;
  cards: ScryfallCard[];
};

async function pickRandomFromQuery(query: string, count: number): Promise<ScryfallCard[]> {
  const list = await searchCards(query);
  const pool = list.data;
  if (!pool.length) return [];
  const picks: ScryfallCard[] = [];
  for (let i = 0; i < count; i++) {
    picks.push(pool[Math.floor(Math.random() * pool.length)]);
  }
  return picks;
}

export async function generateBoosters(config: BoosterConfig): Promise<GeneratedPack[]> {
  const packs: GeneratedPack[] = [];

  for (let p = 0; p < config.packs; p++) {
    const cards: ScryfallCard[] = [];
    for (const rule of config.rules) {
      const parts = [
        config.defaultQuery.trim() || "game:paper -is:digital -is:token",
        `r:${rule.rarity}`,
      ];
      if (config.set?.trim()) parts.push(`set:${config.set.trim()}`);
      if (rule.query.trim()) parts.push(`(${rule.query.trim()})`);
      const q = parts.join(" ");
      try {
        const picked = await pickRandomFromQuery(q, rule.count);
        if (picked.length < rule.count) {
          // fallback to default query only
          const fallbackParts = [
            config.defaultQuery.trim() || "game:paper -is:digital -is:token",
            `r:${rule.rarity}`,
          ];
          if (config.set?.trim()) fallbackParts.push(`set:${config.set.trim()}`);
          const more = await pickRandomFromQuery(fallbackParts.join(" "), rule.count - picked.length);
          cards.push(...picked, ...more);
        } else {
          cards.push(...picked);
        }
      } catch {
        // rarity/query miss — skip
      }
    }
    packs.push({ index: p + 1, cards });
  }

  return packs;
}

export const DEFAULT_BOOSTER_RULES: RarityRule[] = [
  { rarity: "common", count: 10, query: "r:common" },
  { rarity: "uncommon", count: 3, query: "r:uncommon" },
  { rarity: "rare", count: 1, query: "r:rare" },
];
