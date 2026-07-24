import type { ScryfallCard } from "./scryfall";
import { searchPrintingsForPimp } from "./scryfall";
import { parseMoxfieldList, toMoxfieldList, type DeckLine } from "./moxfield";

/** Sets that are special product lines (not regular Standard/Commander print runs). */
const SPECIAL_PRODUCT_SETS = new Set([
  "sld",
  "slp",
  "slu",
  "mb2",
  "phed",
  "plist",
  "sta",
  "mul",
  "bot",
  "brr",
  "spg",
  "big",
  "otp",
  "mps",
  "mp2",
  "exp",
  "zne",
  "puma",
  "ust",
  "unf",
  "ugl",
  "und",
]);

/** Sets that often carry showcase / borderless / special guest treatments. */
const FANCY_SET_BONUS = new Set([
  "sld",
  "slp",
  "slu",
  "sta",
  "mul",
  "bot",
  "brr",
  "spg",
  "big",
  "otp",
  "mps",
  "mp2",
  "exp",
  "zne",
  "puma",
  "ust",
  "unf",
  "ugl",
  "und",
  "2x2",
  "mh2",
  "mh3",
  "cmm",
  "ltr",
  "who",
  "pip",
  "acr",
  "clb",
  "mat",
  "one",
  "mom",
  "woe",
  "lci",
  "mkm",
  "otj",
  "blb",
  "dsk",
  "fdn",
  "dft",
  "tdm",
  "zen",
  "bfz",
  "ogw",
  "znr",
  "akh",
  "hou",
  "rvr",
]);

const BASIC_LAND_NAMES = new Set([
  "plains",
  "island",
  "swamp",
  "mountain",
  "forest",
  "wastes",
  "snow-covered plains",
  "snow-covered island",
  "snow-covered swamp",
  "snow-covered mountain",
  "snow-covered forest",
]);

/** Core / early commander products that usually mean a plain default frame. */
const PLAIN_CORE_SETS = new Set([
  "lea",
  "leb",
  "2ed",
  "3ed",
  "4ed",
  "5ed",
  "6ed",
  "7ed",
  "8ed",
  "9ed",
  "10e",
  "m10",
  "m11",
  "m12",
  "m13",
  "m14",
  "m15",
  "m19",
  "m20",
  "m21",
  "ori",
  "c13",
  "c14",
  "c15",
  "c16",
  "c17",
  "c18",
  "c19",
  "c20",
  "c21",
  "cmr",
  "cmd",
  "cma",
  "cm2",
  "afc",
  "mic",
  "voc",
  "nec",
  "ncc",
  "dmc",
  "moc",
  "onc",
  "lcc",
  "scc",
  "woc",
  "brc",
]);

function hasSpecialFrame(card: ScryfallCard): boolean {
  const frame = card.frame_effects ?? [];
  return frame.some((f) =>
    ["showcase", "extendedart", "inverted", "legendary", "companion", "snow"].includes(f),
  );
}

/** True for the boring default: black border, no treatments, low CN, non-special product. */
function isPlainDefaultPrinting(card: ScryfallCard): boolean {
  const set = (card.set ?? "").toLowerCase();
  const frame = card.frame_effects ?? [];
  const finishes = card.finishes ?? [];
  const border = card.border_color ?? "black";
  const cn = Number(card.collector_number);

  // Truly special product lines are never "default"
  if (SPECIAL_PRODUCT_SETS.has(set)) return false;
  if (set === "sld" || set.startsWith("p")) return false;
  if (card.full_art || card.textless || card.promo) return false;
  if (border === "borderless" || border === "silver" || border === "gold") return false;
  if (hasSpecialFrame(card) || frame.length > 0) return false;
  if (finishes.includes("etched") || finishes.includes("glossy")) return false;
  // High collector numbers are usually alternate arts / special frames
  if (!Number.isNaN(cn) && cn >= 300) return false;
  if (border !== "black") return false;

  return true;
}

function isBasicLandCard(card: ScryfallCard): boolean {
  const name = card.name?.toLowerCase() ?? "";
  if (BASIC_LAND_NAMES.has(name)) return true;
  return /\bbasic\b/i.test(card.type_line ?? "") && /\bland\b/i.test(card.type_line ?? "");
}

function hasSpecialTreatment(card: ScryfallCard): boolean {
  const set = (card.set ?? "").toLowerCase();
  const setName = card.set_name?.toLowerCase() ?? "";
  const frame = card.frame_effects ?? [];
  const finishes = card.finishes ?? [];
  const border = card.border_color ?? "";
  if (card.full_art || card.textless) return true;
  if (border === "borderless" || border === "silver" || border === "gold") return true;
  if (hasSpecialFrame(card) || frame.length > 0) return true;
  if (finishes.includes("etched") || finishes.includes("glossy")) return true;
  if (SPECIAL_PRODUCT_SETS.has(set) || setName.includes("secret lair")) return true;
  if (setName.includes("showcase") || setName.includes("borderless") || setName.includes("extended")) {
    return true;
  }
  if (!Number.isNaN(Number(card.collector_number)) && Number(card.collector_number) >= 300) {
    return true;
  }
  return false;
}

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
  const basic = isBasicLandCard(card);
  const special = hasSpecialTreatment(card);

  // Fancy-set bonus only when the printing actually has a special treatment
  if (special && FANCY_SET_BONUS.has(set)) score += 35;
  if (SPECIAL_PRODUCT_SETS.has(set)) score += 40;
  // Promo-set bump is modest: Guru/APAC lands are pricey but look like plain basics
  if (set.startsWith("p") && set.length === 4) score += 8;
  if (card.rarity === "mythic") score += 8;
  if (card.rarity === "rare") score += 4;

  if (set === "sld" || set === "slp" || setName.includes("secret lair")) score += 100;
  if (setName.includes("showcase") || frame.includes("showcase")) score += 55;
  if (setName.includes("borderless") || border === "borderless") score += 52;
  if (setName.includes("extended") || frame.includes("extendedart")) score += 48;
  if (setName.includes("anime")) score += 42;
  if (setName.includes("textured")) score += 45;
  if (setName.includes("oil slick")) score += 42;
  if (setName.includes("serialized")) score += 50;
  if (setName.includes("step-and-compleat") || setName.includes("phyrexian")) score += 36;
  if (setName.includes("invocations") || setName.includes("inventions")) score += 70;
  if (setName.includes("expedition") || setName.includes("zendikar rising expeditions")) score += 62;
  if (setName.includes("masterpiece") || set === "mps" || set === "mp2" || set === "exp") score += 75;
  if (setName.includes("universes beyond") || setName.includes("special guest")) score += 28;
  if (["ust", "unf", "ugl", "und"].includes(set) || setName.includes("unstable") || setName.includes("unfinity")) {
    score += 50;
  }
  if (frame.includes("snow") || setName.includes("snow")) score += 42;

  if (fullArt) score += 48;
  if (textless) score += 34;
  // Promo alone is weak signal for basics (many look identical to standard frame)
  if (promo) score += basic ? 6 : 24;
  if (frame.includes("legendary")) score += 12;
  if (frame.includes("inverted")) score += 30;
  if (finishes.includes("etched")) score += 36;
  if (finishes.includes("glossy")) score += 20;

  const cn = Number(card.collector_number);
  if (!Number.isNaN(cn) && cn >= 300) score += 18;
  if (!Number.isNaN(cn) && cn >= 400) score += 12;
  if (!Number.isNaN(cn) && cn >= 500) score += 10;

  // Price is a weak tiebreaker; special frames matter more than Alpha/Guru premiums
  const usd = Number(card.prices?.usd ?? 0);
  if (usd > 0) score += Math.min(basic ? 18 : 28, Math.log10(usd + 1) * (basic ? 8 : 12));

  if (card.image_uris?.art_crop || card.card_faces?.some((f) => f.image_uris?.art_crop)) {
    score += 6;
  }

  if (special) score += 30;
  else score -= 35;

  // Penalize plain black-border defaults (low CN, no treatments)
  if (isPlainDefaultPrinting(card)) {
    score -= 90;
    if (PLAIN_CORE_SETS.has(set)) score -= 35;
    if (!Number.isNaN(cn) && cn < 50) score -= 15;
  }

  // Extra push for basics: full-art / borderless / SLD / snow / Un-set must win
  if (basic) {
    if (fullArt || border === "borderless" || set === "sld") score += 50;
    if (frame.includes("snow") || ["ust", "unf", "ugl", "und"].includes(set)) score += 35;
    if (isPlainDefaultPrinting(card)) score -= 40;
  }

  return score;
}

function samePrinting(a: ScryfallCard, line: DeckLine): boolean {
  if (!line.setCode) return false;
  const setMatch = a.set?.toLowerCase() === line.setCode.toLowerCase();
  if (!setMatch) return false;
  if (!line.collectorNumber) return true;
  return a.collector_number === line.collectorNumber;
}

/**
 * Among available paper printings, never pick a plain default when a special
 * treatment exists. Prefer away from the user's original printing.
 */
function pickBestPrinting(prints: ScryfallCard[], line: DeckLine): ScryfallCard {
  const ranked = [...prints].sort((a, b) => scorePrinting(b) - scorePrinting(a));
  const specials = ranked.filter(hasSpecialTreatment);
  const nonPlain = ranked.filter((c) => !isPlainDefaultPrinting(c));

  // Prefer special treatments; else any non-plain; else best-scored among plains
  let pool = specials.length ? specials : nonPlain.length ? nonPlain : ranked;

  // Prefer a different printing than the input when alternatives exist
  const different = pool.filter((c) => !samePrinting(c, line));
  if (different.length) pool = different;

  return pool[0];
}

export type PimpResult = {
  list: string;
  lines: DeckLine[];
  cards: ScryfallCard[];
  notes: string[];
};

export type PimpProgress = (done: number, total: number) => void;

export async function pimpDeckList(
  text: string,
  onProgress?: PimpProgress,
): Promise<PimpResult> {
  const parsed = parseMoxfieldList(text);
  const notes: string[] = [];
  const out: DeckLine[] = [];
  const cards: ScryfallCard[] = [];
  const total = parsed.length;

  onProgress?.(0, total);

  for (let i = 0; i < parsed.length; i++) {
    const line = parsed[i];
    try {
      const prints = await searchPrintingsForPimp(line.name);
      if (!prints.length) {
        out.push(line);
        notes.push(`Kept original: ${line.name} (no printings found)`);
        onProgress?.(i + 1, total);
        continue;
      }

      // When multiple printings exist, always pick via scoring (never early-exit to original)
      const best = prints.length === 1 ? prints[0] : pickBestPrinting(prints, line);

      out.push({
        ...line,
        setCode: best.set,
        collectorNumber: best.collector_number,
        category: line.category ?? "Deck",
      });
      cards.push(best);

      const changed =
        !line.setCode ||
        line.setCode.toLowerCase() !== (best.set ?? "").toLowerCase() ||
        (line.collectorNumber != null && line.collectorNumber !== best.collector_number);

      if (changed && line.setCode) {
        notes.push(`${line.name}: ${line.setCode} → ${best.set} (${best.set_name}) #${best.collector_number}`);
      } else {
        notes.push(`${line.name}: ${best.set_name} #${best.collector_number}`);
      }
    } catch (err) {
      // searchPrintingsForPimp is non-throwing; this is for unexpected failures only
      out.push(line);
      const detail = err instanceof Error ? err.message.replace(/\s+/g, " ").slice(0, 80) : "";
      notes.push(
        detail
          ? `Kept original: ${line.name} (${detail})`
          : `Kept original: ${line.name} (lookup failed)`,
      );
    }
    onProgress?.(i + 1, total);
  }

  return { list: toMoxfieldList(out, true), lines: out, cards, notes };
}
