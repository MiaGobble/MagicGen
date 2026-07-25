import { searchCards, searchPrintings, type ScryfallCard } from "./scryfall";

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
  onProgress?: (done: number, total: number, label?: string) => void;
};

export type GeneratedPack = {
  index: number;
  cards: ScryfallCard[];
};

export const DEFAULT_BOOSTER_QUERY = "game:paper -is:digital -is:token";

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

async function pimpCard(card: ScryfallCard): Promise<ScryfallCard> {
  try {
    const prints = await searchPrintings(card.name.split(" // ")[0]);
    if (!prints.length) return card;
    return [...prints].sort((a, b) => scorePrinting(b) - scorePrinting(a))[0] ?? card;
  } catch {
    return card;
  }
}

export async function generateBoosters(config: BoosterConfig): Promise<GeneratedPack[]> {
  const packs: GeneratedPack[] = [];
  const rules = config.rules.filter((r) => r.count > 0);
  const cardsPerPack = rules.reduce((s, r) => s + r.count, 0);
  const total =
    config.packs * (1 + (config.pimpedPrintings ? Math.max(cardsPerPack, 1) : 0));
  let done = 0;

  const report = (label: string) => {
    config.onProgress?.(done, Math.max(total, 1), label);
  };

  report(config.packs > 1 ? "Opening packs…" : "Opening pack…");

  for (let p = 0; p < config.packs; p++) {
    const cards: ScryfallCard[] = [];
    report(`Opening pack ${p + 1} of ${config.packs}…`);
    for (const rule of rules) {
      const parts = [
        config.defaultQuery.trim() || DEFAULT_BOOSTER_QUERY,
        `r:${rule.rarity}`,
      ];
      if (config.set?.trim()) parts.push(`set:${config.set.trim()}`);
      if (rule.query.trim()) parts.push(`(${rule.query.trim()})`);
      const q = parts.join(" ");
      try {
        const picked = await pickRandomFromQuery(q, rule.count);
        if (picked.length < rule.count) {
          const fallbackParts = [
            config.defaultQuery.trim() || DEFAULT_BOOSTER_QUERY,
            `r:${rule.rarity}`,
          ];
          if (config.set?.trim()) fallbackParts.push(`set:${config.set.trim()}`);
          const more = await pickRandomFromQuery(
            fallbackParts.join(" "),
            rule.count - picked.length,
          );
          cards.push(...picked, ...more);
        } else {
          cards.push(...picked);
        }
      } catch {
        // rarity/query miss — skip
      }
    }

    done += 1;
    report(`Opened pack ${p + 1} of ${config.packs}`);

    if (config.pimpedPrintings && cards.length) {
      const pimped: ScryfallCard[] = [];
      const expected = Math.max(cardsPerPack, cards.length);
      for (let i = 0; i < cards.length; i++) {
        report(`Pimping pack ${p + 1} · card ${i + 1} of ${cards.length}…`);
        pimped.push(await pimpCard(cards[i]));
        done += 1;
      }
      // If a pack returned fewer cards than expected, still consume the budgeted steps
      if (cards.length < expected) {
        done += expected - cards.length;
      }
      packs.push({ index: p + 1, cards: pimped });
      report(`Finished pack ${p + 1} of ${config.packs}`);
    } else {
      packs.push({ index: p + 1, cards });
    }
  }

  config.onProgress?.(Math.max(total, done), Math.max(total, 1), "Done");
  return packs;
}
