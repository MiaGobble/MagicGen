import type { ScryfallCard } from "./scryfall";
import { searchPrintings } from "./scryfall";
import { parseMoxfieldList, toMoxfieldList, type DeckLine } from "./moxfield";

const PREMIUM_SETS = new Set([
  "sld",
  "mb2",
  "phed",
  "plist",
  "sta",
  "mul",
  "bot",
  "brr",
  "brc",
  "clb",
  "2x2",
  "mh2",
  "mh3",
  "cmm",
  "ltr",
  "who",
  "pip",
  "acr",
  "spg",
  "big",
  "otp",
  "rvr",
  "dmc",
  "ncc",
  "nec",
  "moc",
  "onc",
  "lcc",
  "scc",
  "woc",
  "mat",
  "one",
  "mom",
  "mat",
  "woe",
  "lci",
  "mkm",
  "otj",
  "blb",
  "dsk",
  "fdn",
  "dft",
  "tdm",
]);

function scorePrinting(card: ScryfallCard): number {
  let score = 0;
  const set = (card.set ?? "").toLowerCase();
  const setName = card.set_name?.toLowerCase() ?? "";
  const frame = card.frame_effects ?? [];
  const finishes = card.finishes ?? [];
  const border = card.border_color ?? "";
  const fullArt = card.full_art;
  const textless = card.textless;
  const promo = card.promo;

  if (PREMIUM_SETS.has(set)) score += 40;
  if (set.startsWith("p") && set.length === 4) score += 18;
  if (card.rarity === "mythic") score += 8;
  if (card.rarity === "rare") score += 4;

  if (setName.includes("secret lair")) score += 55;
  if (setName.includes("showcase")) score += 28;
  if (setName.includes("borderless")) score += 26;
  if (setName.includes("extended")) score += 22;
  if (setName.includes("anime")) score += 30;
  if (setName.includes("textured")) score += 35;
  if (setName.includes("oil slick")) score += 32;
  if (setName.includes("serialized")) score += 40;
  if (setName.includes("step-and-compleat") || setName.includes("phyrexian")) score += 24;
  if (setName.includes("invocations") || setName.includes("inventions")) score += 45;
  if (setName.includes("expedition") || setName.includes("zendikar rising expeditions")) score += 38;
  if (setName.includes("masterpiece")) score += 42;

  if (fullArt) score += 20;
  if (textless) score += 18;
  if (promo) score += 12;
  if (border === "borderless") score += 20;
  if (frame.includes("legendary") || frame.includes("showcase") || frame.includes("extendedart")) {
    score += 16;
  }
  if (finishes.includes("etched") || finishes.includes("glossy")) score += 14;

  const cn = Number(card.collector_number);
  if (!Number.isNaN(cn) && cn >= 300) score += 12;
  if (!Number.isNaN(cn) && cn >= 400) score += 8;

  const usd = Number(card.prices?.usd ?? 0);
  if (usd > 0) score += Math.min(30, Math.log10(usd + 1) * 14);

  // Prefer printings that actually have dramatic art crops
  if (card.image_uris?.art_crop || card.card_faces?.some((f) => f.image_uris?.art_crop)) {
    score += 6;
  }

  return score;
}

export type PimpResult = {
  list: string;
  lines: DeckLine[];
  cards: ScryfallCard[];
  notes: string[];
};

export async function pimpDeckList(text: string): Promise<PimpResult> {
  const parsed = parseMoxfieldList(text);
  const notes: string[] = [];
  const out: DeckLine[] = [];
  const cards: ScryfallCard[] = [];

  for (const line of parsed) {
    try {
      const prints = await searchPrintings(line.name);
      if (!prints.length) {
        out.push(line);
        notes.push(`Kept original: ${line.name} (no printings found)`);
        continue;
      }
      const ranked = [...prints].sort((a, b) => scorePrinting(b) - scorePrinting(a));
      const best = ranked[0];
      out.push({
        ...line,
        setCode: best.set,
        collectorNumber: best.collector_number,
        category: line.category ?? "Deck",
      });
      cards.push(best);
      if (line.setCode && line.setCode !== best.set) {
        notes.push(`${line.name}: ${line.setCode} → ${best.set} (${best.set_name})`);
      } else {
        notes.push(`${line.name}: ${best.set_name} #${best.collector_number}`);
      }
    } catch {
      out.push(line);
      notes.push(`Kept original: ${line.name} (lookup failed)`);
    }
  }

  return { list: toMoxfieldList(out, true), lines: out, cards, notes };
}
