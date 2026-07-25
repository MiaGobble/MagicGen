/**
 * Dice catalog + Amazon color matcher (Chessex / Gamegenic focused).
 * Mirrors the sleeve matcher flow: name color → Amazon search → catalog fallback.
 */
import { amazonProductUrl, amazonSearchUrl } from "./affiliate";
import {
  type HueFamily,
  type HueName,
  hexToHueName,
  colorDistance,
  hueFamilyFromHex,
  synonymsForColor,
  titleHasColorSynonym,
  titleHasConflictingColor,
} from "./color";
import { isAllowedAmazonUrl } from "../safeUrl";

export type DiceKind = "any" | "d20" | "d6" | "polyhedral";

/** Chessex-style lines and common dice materials / patterns. */
export type DiceFinish =
  | "any"
  | "opaque"
  | "translucent"
  | "gemini"
  | "borealis"
  | "speckled"
  | "glitter"
  | "vortex"
  | "luminary";

export const DICE_FINISH_OPTIONS: Array<{ id: DiceFinish; label: string }> = [
  { id: "any", label: "Any finish" },
  { id: "opaque", label: "Opaque" },
  { id: "translucent", label: "Translucent" },
  { id: "gemini", label: "Gemini (dual color)" },
  { id: "borealis", label: "Borealis (swirl)" },
  { id: "speckled", label: "Speckled / Lab" },
  { id: "glitter", label: "Glitter" },
  { id: "vortex", label: "Vortex" },
  { id: "luminary", label: "Luminary (glow)" },
];

const FINISH_TITLE_TERMS: Record<Exclude<DiceFinish, "any">, string[]> = {
  opaque: ["opaque", "solid"],
  translucent: ["translucent", "transparent", "clear"],
  gemini: ["gemini", "dual", "two-tone", "two tone"],
  borealis: ["borealis", "swirl", "marbled", "marble"],
  speckled: ["speckled", "lab dice", "labdice", "speckle"],
  glitter: ["glitter", "sparkle", "sparkly"],
  vortex: ["vortex"],
  luminary: ["luminary", "glow", "glow-in-the-dark", "gitd"],
};

function finishLabel(finish: DiceFinish): string {
  return DICE_FINISH_OPTIONS.find((o) => o.id === finish)?.label ?? finish;
}

function finishMatches(entryFinish: DiceFinish, want: DiceFinish): boolean {
  if (want === "any") return true;
  return entryFinish === want;
}

function titleMatchesFinish(title: string, finish: DiceFinish): boolean {
  if (finish === "any") return true;
  const t = title.toLowerCase();
  return FINISH_TITLE_TERMS[finish].some((term) => t.includes(term));
}

function titleHasConflictingFinish(title: string, finish: DiceFinish): boolean {
  if (finish === "any") return false;
  const t = title.toLowerCase();
  for (const [id, terms] of Object.entries(FINISH_TITLE_TERMS) as Array<
    [Exclude<DiceFinish, "any">, string[]]
  >) {
    if (id === finish) continue;
    if (finish === "opaque" && (id === "translucent" || id === "gemini" || id === "borealis")) {
      if (terms.some((term) => t.includes(term))) return true;
    }
    if (finish === "translucent" && id === "opaque" && /\bopaque\b/.test(t)) return true;
    if (
      finish !== "opaque" &&
      finish !== "translucent" &&
      ["gemini", "borealis", "vortex", "luminary", "speckled", "glitter"].includes(id) &&
      terms.some((term) => t.includes(term))
    ) {
      return true;
    }
  }
  return false;
}

type DiceCatalogEntry = {
  name: string;
  brand: string;
  hex: string;
  asin: string;
  family: HueFamily;
  kind: DiceKind;
  finish: Exclude<DiceFinish, "any">;
  premium?: boolean;
};

/**
 * Curated dice colors — Chessex Opaque (+ a few translucent / Gemini) hexes
 * approximated from product photos / line names.
 */
const DICE_CATALOG: DiceCatalogEntry[] = [
  // —— Reds ——
  { name: "Red", brand: "Chessex", hex: "#C62828", asin: "B0006O81JA", family: "red", kind: "polyhedral", finish: "opaque", premium: true },
  { name: "Blood Red", brand: "Chessex", hex: "#6B0F12", asin: "B0006O81JA", family: "red", kind: "polyhedral", finish: "opaque", premium: true },
  { name: "Ruby", brand: "Chessex", hex: "#E53935", asin: "B07GXZQY8L", family: "red", kind: "polyhedral", finish: "translucent", premium: true },
  // —— Orange / brown ——
  { name: "Orange", brand: "Chessex", hex: "#EF6C00", asin: "B0006O81K4", family: "orange", kind: "polyhedral", finish: "opaque", premium: true },
  { name: "Copper", brand: "Chessex", hex: "#A05A2C", asin: "B0006O81K4", family: "brown", kind: "polyhedral", finish: "opaque", premium: true },
  { name: "Brown", brand: "Chessex", hex: "#6D4C41", asin: "B0015ZSS5A", family: "brown", kind: "polyhedral", finish: "opaque", premium: true },
  // —— Yellow / gold ——
  { name: "Yellow", brand: "Chessex", hex: "#FBC02D", asin: "B0006O81KE", family: "yellow", kind: "polyhedral", finish: "opaque", premium: true },
  { name: "Gold", brand: "Chessex", hex: "#C9A227", asin: "B0006O81KE", family: "yellow", kind: "polyhedral", finish: "opaque", premium: true },
  { name: "Ivory", brand: "Chessex", hex: "#FFF3E0", asin: "B0006O81I6", family: "neutral", kind: "polyhedral", finish: "opaque", premium: true },
  // —— Greens ——
  { name: "Green", brand: "Chessex", hex: "#2E7D32", asin: "B0006O81KO", family: "green", kind: "polyhedral", finish: "opaque", premium: true },
  { name: "Light Green", brand: "Chessex", hex: "#8BC34A", asin: "B0006O81KO", family: "green", kind: "polyhedral", finish: "opaque", premium: true },
  { name: "Forest", brand: "Chessex", hex: "#1B5E20", asin: "B0006O81KO", family: "green", kind: "polyhedral", finish: "opaque", premium: true },
  { name: "Jade", brand: "Chessex", hex: "#26A69A", asin: "B07GXZQY8L", family: "teal", kind: "polyhedral", finish: "translucent", premium: true },
  // —— Teal ——
  { name: "Teal", brand: "Chessex", hex: "#00897B", asin: "B07N8SJ8XQ", family: "teal", kind: "polyhedral", finish: "opaque", premium: true },
  { name: "Turquoise", brand: "Chessex", hex: "#26A69A", asin: "B07N8SJ8XQ", family: "teal", kind: "polyhedral", finish: "opaque", premium: true },
  // —— Blues ——
  { name: "Blue", brand: "Chessex", hex: "#1565C0", asin: "B0006O81KY", family: "blue", kind: "polyhedral", finish: "opaque", premium: true },
  { name: "Light Blue", brand: "Chessex", hex: "#4FC3F7", asin: "B0006O81KY", family: "blue", kind: "polyhedral", finish: "opaque", premium: true },
  { name: "Navy", brand: "Chessex", hex: "#0A2540", asin: "B0006O81KY", family: "blue", kind: "polyhedral", finish: "opaque", premium: true },
  { name: "Sapphire", brand: "Chessex", hex: "#1E88E5", asin: "B07GXZQY8L", family: "blue", kind: "polyhedral", finish: "translucent", premium: true },
  // —— Purples ——
  { name: "Purple", brand: "Chessex", hex: "#6A1B9A", asin: "B0006O81L8", family: "purple", kind: "polyhedral", finish: "opaque", premium: true },
  { name: "Violet", brand: "Chessex", hex: "#7B1FA2", asin: "B0006O81L8", family: "purple", kind: "polyhedral", finish: "opaque", premium: true },
  { name: "Amethyst", brand: "Chessex", hex: "#AB47BC", asin: "B07GXZQY8L", family: "purple", kind: "polyhedral", finish: "translucent", premium: true },
  // —— Pinks ——
  { name: "Pink", brand: "Chessex", hex: "#EC407A", asin: "B0015ZSS6E", family: "pink", kind: "polyhedral", finish: "opaque", premium: true },
  { name: "Rose", brand: "Chessex", hex: "#E91E63", asin: "B0015ZSS6E", family: "pink", kind: "polyhedral", finish: "opaque", premium: true },
  // —— Neutrals ——
  { name: "Black", brand: "Chessex", hex: "#1A1A1A", asin: "B0006O81HM", family: "neutral", kind: "polyhedral", finish: "opaque", premium: true },
  { name: "White", brand: "Chessex", hex: "#FAFAFA", asin: "B0006O81I6", family: "neutral", kind: "polyhedral", finish: "opaque", premium: true },
  { name: "Gray", brand: "Chessex", hex: "#78909C", asin: "B0015ZSS64", family: "neutral", kind: "polyhedral", finish: "opaque", premium: true },
  { name: "Silver", brand: "Chessex", hex: "#B0BEC5", asin: "B0015ZSS64", family: "neutral", kind: "polyhedral", finish: "opaque", premium: true },
  // —— Spindown D20 (MTG life counters) ——
  { name: "Black", brand: "Wizards", hex: "#1A1A1A", asin: "B08GQQZJ8Y", family: "neutral", kind: "d20", finish: "opaque", premium: false },
  { name: "White", brand: "Wizards", hex: "#FAFAFA", asin: "B08GQQZJ8Y", family: "neutral", kind: "d20", finish: "opaque", premium: false },
  { name: "Red", brand: "Wizards", hex: "#C62828", asin: "B08GQQZJ8Y", family: "red", kind: "d20", finish: "opaque", premium: false },
  { name: "Blue", brand: "Wizards", hex: "#1565C0", asin: "B08GQQZJ8Y", family: "blue", kind: "d20", finish: "opaque", premium: false },
  { name: "Green", brand: "Wizards", hex: "#2E7D32", asin: "B08GQQZJ8Y", family: "green", kind: "d20", finish: "opaque", premium: false },
  { name: "Purple", brand: "Wizards", hex: "#6A1B9A", asin: "B08GQQZJ8Y", family: "purple", kind: "d20", finish: "opaque", premium: false },
  // —— D6 blocks ——
  { name: "Black", brand: "Chessex", hex: "#1A1A1A", asin: "B00000JBJ3", family: "neutral", kind: "d6", finish: "opaque", premium: true },
  { name: "White", brand: "Chessex", hex: "#FAFAFA", asin: "B00000JBJ3", family: "neutral", kind: "d6", finish: "opaque", premium: true },
  { name: "Red", brand: "Chessex", hex: "#C62828", asin: "B00000JBJ3", family: "red", kind: "d6", finish: "opaque", premium: true },
  { name: "Blue", brand: "Chessex", hex: "#1565C0", asin: "B00000JBJ3", family: "blue", kind: "d6", finish: "opaque", premium: true },
  { name: "Green", brand: "Chessex", hex: "#2E7D32", asin: "B00000JBJ3", family: "green", kind: "d6", finish: "opaque", premium: true },
  { name: "Purple", brand: "Chessex", hex: "#6A1B9A", asin: "B00000JBJ3", family: "purple", kind: "d6", finish: "opaque", premium: true },
  { name: "Orange", brand: "Chessex", hex: "#EF6C00", asin: "B00000JBJ3", family: "orange", kind: "d6", finish: "opaque", premium: true },
  { name: "Yellow", brand: "Chessex", hex: "#FBC02D", asin: "B00000JBJ3", family: "yellow", kind: "d6", finish: "opaque", premium: true },
  { name: "Pink", brand: "Chessex", hex: "#EC407A", asin: "B00000JBJ3", family: "pink", kind: "d6", finish: "opaque", premium: true },
  // —— Budget ——
  { name: "Budget Black", brand: "Generic", hex: "#1A1A1A", asin: "B08GQQZJ8Y", family: "neutral", kind: "any", finish: "opaque", premium: false },
  { name: "Budget Red", brand: "Generic", hex: "#C62828", asin: "B08GQQZJ8Y", family: "red", kind: "any", finish: "opaque", premium: false },
  { name: "Budget Blue", brand: "Generic", hex: "#1565C0", asin: "B08GQQZJ8Y", family: "blue", kind: "any", finish: "opaque", premium: false },
  { name: "Budget Green", brand: "Generic", hex: "#2E7D32", asin: "B08GQQZJ8Y", family: "green", kind: "any", finish: "opaque", premium: false },
  { name: "Budget Purple", brand: "Generic", hex: "#6A1B9A", asin: "B08GQQZJ8Y", family: "purple", kind: "any", finish: "opaque", premium: false },
];

const PREMIUM_DICE_BRANDS = ["chessex", "gamegenic", "q workshop", "hd dice", "die hard"];

function isPremiumDiceBrand(text: string): boolean {
  const t = text.toLowerCase();
  return PREMIUM_DICE_BRANDS.some((b) => t.includes(b));
}

function kindMatches(entryKind: DiceKind, want: DiceKind): boolean {
  if (want === "any" || entryKind === "any") return true;
  return entryKind === want;
}

function familyFallbackNames(family: HueFamily): string[] {
  if (family === "purple") return ["Purple", "Violet"];
  if (family === "neutral") return ["Gray"];
  return [family.charAt(0).toUpperCase() + family.slice(1)];
}

function catalogHasFinish(finish: DiceFinish): boolean {
  if (finish === "any") return true;
  return DICE_CATALOG.some((e) => e.finish === finish);
}

/** Map hex → dice color names from the catalog (preferring the chosen finish). */
export function diceColorNamesFromHex(hex: string, finish: DiceFinish = "any"): string[] {
  const targetFamily = hueFamilyFromHex(hex);

  const poolFor = (wantFinish: DiceFinish) =>
    DICE_CATALOG.filter((e) => {
      if (e.name.startsWith("Budget") || !e.premium) return false;
      if (e.kind !== "polyhedral" && e.kind !== "any") return false;
      return finishMatches(e.finish, wantFinish);
    })
      .map((e) => ({
        name: e.name,
        family: e.family,
        dE: colorDistance(hex, e.hex),
      }))
      .filter((e) => e.family === targetFamily)
      .sort((a, b) => a.dE - b.dE);

  // Specialty finishes rarely cover every hue — name from the finish first,
  // then opaque / any, never invent "Black" for a chromatic color.
  let pool = poolFor(finish);
  if (!pool.length && finish !== "any" && finish !== "opaque") {
    pool = poolFor("opaque");
  }
  if (!pool.length && finish !== "any") {
    pool = poolFor("any");
  }
  if (!pool.length) return familyFallbackNames(targetFamily);

  const primary = pool[0];
  const names = [primary.name];
  const runner = pool[1];
  if (runner && runner.dE <= primary.dE + 2.5) names.push(runner.name);
  return names.slice(0, 2);
}

function sharedDiceAsins(): Set<string> {
  const counts = new Map<string, number>();
  for (const e of DICE_CATALOG) {
    const a = e.asin.toUpperCase();
    counts.set(a, (counts.get(a) ?? 0) + 1);
  }
  const shared = new Set<string>();
  for (const [asin, n] of counts) {
    if (n > 1) shared.add(asin);
  }
  return shared;
}

let _sharedDiceAsins: Set<string> | null = null;
function isSharedDiceAsin(asin: string): boolean {
  if (!_sharedDiceAsins) _sharedDiceAsins = sharedDiceAsins();
  return _sharedDiceAsins.has(asin.toUpperCase());
}

function kindSearchTerms(kind: DiceKind): string {
  if (kind === "d20") return "D20 spindown OR polyhedral D20";
  if (kind === "d6") return "D6 dice block OR opaque D6";
  if (kind === "polyhedral") return "polyhedral dice set";
  return "dice";
}

export function diceListingUrl(opts: {
  brand: string;
  colorName: string;
  kind: DiceKind;
  finish?: DiceFinish;
  asin?: string;
}): string {
  const asin = opts.asin?.replace(/[^A-Z0-9]/gi, "").slice(0, 10);
  if (asin && asin.length === 10 && !isSharedDiceAsin(asin)) {
    return amazonProductUrl(asin);
  }
  const brand = opts.brand || "Chessex";
  const color = opts.colorName.trim();
  const kindBit = kindSearchTerms(opts.kind);
  const finishBit =
    opts.finish && opts.finish !== "any" ? FINISH_TITLE_TERMS[opts.finish][0] : "";
  return amazonSearchUrl([brand, finishBit, color, kindBit].filter(Boolean).join(" "));
}

type ScoredDice = {
  title: string;
  asin: string;
  url: string;
  matchHex: string;
  colorName: string;
  dE: number;
  family: HueFamily;
  score: number;
  source: "catalog" | "amazon";
  listingStyle?: string;
};

export type DiceMatchResult = {
  colorNames: string[];
  colorName: string;
  title: string;
  asin: string;
  url: string;
  matchHex: string;
  hue: HueName;
  kind: DiceKind;
  finish: DiceFinish;
  source: "catalog" | "amazon";
  listingStyle?: string;
};

export type DiceMatchStage = "naming" | "catalog" | "amazon" | "styles" | "done";
export type DiceMatchProgress = (stage: DiceMatchStage, label: string, pct: number) => void;

type AmazonSearchHit = {
  title: string;
  asin: string;
  styleHint?: string;
};

function scoreCatalogEntry(
  entry: DiceCatalogEntry,
  hex: string,
  targetFamily: HueFamily,
  premium: boolean,
  kind: DiceKind,
  finish: DiceFinish,
): ScoredDice | null {
  if (entry.family !== targetFamily) return null;
  if (!kindMatches(entry.kind, kind)) return null;

  const exactFinish = finishMatches(entry.finish, finish);
  // When the catalog has no rows for Gemini / Speckled / etc., use opaque
  // colors for ΔE naming while keeping the requested finish in search links.
  const finishStandIn =
    !exactFinish &&
    finish !== "any" &&
    !catalogHasFinish(finish) &&
    entry.finish === "opaque";
  if (!exactFinish && !finishStandIn) return null;

  const dE = colorDistance(hex, entry.hex);
  let score = 400 - dE * 12;

  const entryPremium = Boolean(entry.premium || isPremiumDiceBrand(entry.brand));
  if (premium) {
    if (entryPremium) score += 8;
    else score -= 3;
  } else {
    if (!entryPremium) score += 8;
    else score -= 4;
  }

  if (kind !== "any" && entry.kind === kind) score += 18;
  if (finish !== "any" && exactFinish) score += 22;
  else if (finishStandIn) score -= 12;

  const linkFinish: DiceFinish = finishStandIn ? finish : entry.finish;
  const displayFinish = finishStandIn ? finish : entry.finish;
  const colorName = entry.name.replace(/^Budget\s+/i, "") || entry.name;
  const displayTitle =
    premium || entryPremium
      ? `${entry.brand}: ${colorName} ${finishLabel(displayFinish)} ${kindLabel(entry.kind)}`
      : `Dice: ${colorName} ${finishLabel(displayFinish)} ${kindLabel(entry.kind)}`;

  return {
    title: displayTitle,
    asin: entry.asin,
    url: diceListingUrl({
      brand: entry.brand,
      colorName,
      kind: entry.kind === "any" ? kind : entry.kind,
      finish: linkFinish,
      asin: entry.asin,
    }),
    matchHex: entry.hex,
    colorName,
    dE,
    family: entry.family,
    score,
    source: "catalog",
  };
}

function kindLabel(kind: DiceKind): string {
  if (kind === "d20") return "D20";
  if (kind === "d6") return "D6";
  if (kind === "polyhedral") return "polyhedral set";
  return "dice";
}

function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&amp;/g, "&")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .trim();
}

function extractStyleHintFromSlice(slice: string): string | undefined {
  const patterns = [
    /(?:Color|Colour|Style)\s*:\s*<\/?(?:span|td|th|div)[^>]*>\s*([^<]{2,60})/i,
    /(?:Color|Colour|Style)\s*:\s*([A-Za-z][A-Za-z0-9 /&-]{1,50})/i,
    /aria-label="(?:Color|Colour|Style)\s*:\s*([^"]{2,60})"/i,
  ];
  for (const re of patterns) {
    const m = slice.match(re);
    if (m?.[1]) {
      const cleaned = decodeHtmlEntities(m[1]).replace(/\s+/g, " ").trim();
      if (cleaned.length >= 2 && cleaned.length <= 60) return cleaned;
    }
  }
  return undefined;
}

function parseListingStyleFromProductHtml(html: string): string | undefined {
  const patterns = [
    /id="inline-twister-expanded-dimension-text-color_name"[^>]*>\s*([^<]{2,60})/i,
    /variation_color_name[\s\S]{0,400}?class="selection"[^>]*>\s*([^<]{2,60})/i,
    /<(?:th|td|span)[^>]*>\s*(?:Color|Colour|Style)\s*<\/(?:th|td|span)>\s*<(?:td|span)[^>]*>\s*([^<]{2,60})/i,
    /"color_name"\s*:\s*"([^"]{2,60})"/i,
  ];
  for (const re of patterns) {
    const m = html.match(re);
    if (m?.[1]) {
      const cleaned = decodeHtmlEntities(m[1]).replace(/\s+/g, " ").trim();
      if (/^(select|see options|click|n\/a)$/i.test(cleaned)) continue;
      if (cleaned.length >= 2 && cleaned.length <= 60) return cleaned;
    }
  }
  return undefined;
}

function findVariationAsinForColor(html: string, colorName: string): string | undefined {
  const target = colorName.toLowerCase().trim();
  if (!target) return undefined;
  const synonyms = new Set(synonymsForColor(colorName).map((s) => s.toLowerCase()));
  synonyms.add(target);

  const pairRe = /"([A-Z0-9]{10})"\s*:\s*\[\s*"([^"]+)"/gi;
  let m: RegExpExecArray | null;
  while ((m = pairRe.exec(html)) !== null) {
    const asin = m[1];
    const label = decodeHtmlEntities(m[2]).toLowerCase();
    if (synonyms.has(label) || label.includes(target) || [...synonyms].some((s) => label.includes(s))) {
      return asin;
    }
  }
  return undefined;
}

function scoreListingStyleAgainstTarget(
  styleText: string,
  colorNames: string[],
  family: HueFamily,
): { delta: number; matchedName?: string } | null {
  const style = styleText.trim();
  if (!style) return null;
  const styleLower = style.toLowerCase();

  for (const name of colorNames) {
    if (styleLower.includes(name.toLowerCase()) || titleHasColorSynonym(style, name)) {
      return { delta: 70, matchedName: name };
    }
  }
  if (titleHasConflictingColor(style, family, colorNames[0] ?? "")) {
    return { delta: -120 };
  }
  const familyHit = DICE_CATALOG.find(
    (e) =>
      e.family === family &&
      !e.name.startsWith("Budget") &&
      (styleLower.includes(e.name.toLowerCase()) || titleHasColorSynonym(style, e.name)),
  );
  if (familyHit) return { delta: 45, matchedName: familyHit.name };
  return { delta: 0 };
}

function parseAmazonSearchHtml(html: string): AmazonSearchHit[] {
  const found = new Map<string, AmazonSearchHit>();
  const asinRe = /data-asin="([A-Z0-9]{10})"/gi;
  let m: RegExpExecArray | null;
  while ((m = asinRe.exec(html)) !== null) {
    const asin = m[1];
    if (found.has(asin)) continue;
    const slice = html.slice(Math.max(0, m.index - 200), m.index + 1800);
    const titleMatch =
      slice.match(/aria-label="([^"]{8,180})"/i) ||
      slice.match(/<span[^>]*class="[^"]*a-text-normal[^"]*"[^>]*>([^<]{8,180})<\/span>/i) ||
      slice.match(/alt="([^"]{8,180})"/i);
    const title = titleMatch?.[1] ? decodeHtmlEntities(titleMatch[1]) : "";
    if (!title) continue;
    found.set(asin, { asin, title, styleHint: extractStyleHintFromSlice(slice) });
  }

  const dpRe = /\/dp\/([A-Z0-9]{10})/gi;
  while ((m = dpRe.exec(html)) !== null) {
    if (found.has(m[1])) continue;
    const slice = html.slice(Math.max(0, m.index - 400), m.index + 400);
    const titleMatch = slice.match(/alt="([^"]{8,180})"/i);
    if (titleMatch) {
      found.set(m[1], {
        asin: m[1],
        title: decodeHtmlEntities(titleMatch[1]),
        styleHint: extractStyleHintFromSlice(slice),
      });
    }
  }
  return [...found.values()].slice(0, 20);
}

async function fetchViaCorsProxy(url: string): Promise<string | null> {
  if (!isAllowedAmazonUrl(url)) return null;
  const proxies = [
    `https://corsproxy.io/?${encodeURIComponent(url)}`,
    `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`,
  ];
  for (const proxy of proxies) {
    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 3500);
      const res = await fetch(proxy, { signal: ctrl.signal });
      clearTimeout(timer);
      if (!res.ok) continue;
      const text = await res.text();
      if (text && text.length > 500 && text.length < 2_500_000) return text;
    } catch {
      /* try next */
    }
  }
  return null;
}

function buildDiceSearchQueries(
  colorName: string,
  premium: boolean,
  kind: DiceKind,
  finish: DiceFinish,
): string[] {
  const finishBit = finish !== "any" ? FINISH_TITLE_TERMS[finish][0] : "opaque";
  const kindBit = kindSearchTerms(kind);
  if (kind === "d20") {
    return [
      `MTG spindown D20 ${colorName}`,
      `spindown dice ${colorName} life counter`,
      premium ? `Chessex D20 ${colorName}` : `D20 dice ${colorName}`,
    ].slice(0, 3);
  }
  if (kind === "d6") {
    return [
      `Chessex ${finishBit} ${colorName} D6 dice block`,
      `Chessex ${colorName} D6 ${finishBit}`,
      premium ? `${finishBit} D6 ${colorName} Chessex` : `D6 dice ${colorName} ${finishBit}`,
    ].slice(0, 3);
  }
  const queries = [
    `Chessex ${finishBit} ${colorName} polyhedral dice`,
    `Chessex ${colorName} ${finishBit} dice set`,
  ];
  if (premium) queries.push(`Gamegenic ${colorName} ${finishBit} dice`);
  else queries.push(`${kindBit} ${colorName} ${finishBit}`);
  return queries.slice(0, 3);
}

function scoreAmazonDiceTitle(
  title: string,
  colorName: string,
  family: HueFamily,
  premium: boolean,
  kind: DiceKind,
  finish: DiceFinish,
): number | null {
  const titleLower = title.toLowerCase();
  if (!/\bdice\b|d20|d6|polyhedral|spindown|chessex|gamegenic/.test(titleLower)) return null;

  if (kind === "d20" && !/d20|spindown|twenty/.test(titleLower)) return null;
  if (kind === "d6" && !/\bd6\b|six.?sided|cube dice|dice block/.test(titleLower)) return null;
  if (kind === "polyhedral" && !/polyhedral|dice set|rpg dice|7.?piece|chessex/.test(titleLower)) {
    if (!/chessex/.test(titleLower)) return null;
  }

  const exactColor = titleLower.includes(colorName.toLowerCase());
  const synHit = titleHasColorSynonym(title, colorName);
  if (!exactColor && !synHit) return null;
  if (titleHasConflictingColor(title, family, colorName)) return null;
  if (finish !== "any" && titleHasConflictingFinish(title, finish)) return null;

  let score = 50;
  if (exactColor) score += 55;
  else if (synHit) score += 28;

  if (/chessex/.test(titleLower)) score += 24;
  else if (/gamegenic/.test(titleLower)) score += 16;
  else if (/q.?workshop|die hard/.test(titleLower)) score += 12;
  if (/\bdice\b/.test(titleLower)) score += 10;
  if (titleMatchesFinish(title, finish === "any" ? "opaque" : finish)) score += 18;
  else if (finish !== "any") score -= 12;
  if (/spindown/.test(titleLower) && (kind === "d20" || kind === "any")) score += 14;

  if (premium && isPremiumDiceBrand(title)) score += 16;
  else if (premium && !isPremiumDiceBrand(title)) score -= 8;
  else if (!premium && !isPremiumDiceBrand(title)) score += 12;
  else if (!premium && isPremiumDiceBrand(title)) score -= 4;

  const escaped = colorName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  if (new RegExp(`chessex\\s+(?:${finishBitPattern(finish)}\\s+)?${escaped}`, "i").test(titleLower)) {
    score += 40;
  }

  return score;
}

function finishBitPattern(finish: DiceFinish): string {
  if (finish === "any") return "(?:opaque|translucent|gemini|borealis|speckled|glitter|vortex|luminary)";
  return FINISH_TITLE_TERMS[finish].map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|");
}

function isHighConfidenceAmazonHit(title: string, colorName: string): boolean {
  const t = title.toLowerCase();
  const c = colorName.toLowerCase();
  return t.includes("chessex") && t.includes(c) && (t.includes("opaque") || t.includes("dice"));
}

async function enrichListingsWithProductStyles(
  candidates: ScoredDice[],
  colorNames: string[],
  family: HueFamily,
  kind: DiceKind,
  finish: DiceFinish,
  onProgress?: DiceMatchProgress,
): Promise<void> {
  const top = [...candidates].sort((a, b) => b.score - a.score).slice(0, 5);
  if (!top.length) return;

  onProgress?.("styles", "Reading listing Color / Style…", 86);
  const PARALLEL = 2;
  let done = 0;
  const wantedColor = colorNames[0] ?? "";

  for (let i = 0; i < top.length; i += PARALLEL) {
    const batch = top.slice(i, i + PARALLEL);
    const pages = await Promise.all(batch.map((c) => fetchViaCorsProxy(amazonProductUrl(c.asin))));
    for (let j = 0; j < batch.length; j++) {
      done += 1;
      const pct = 86 + Math.round((done / top.length) * 4);
      onProgress?.("styles", `Reading listing styles (${done}/${top.length})…`, Math.min(90, pct));

      const html = pages[j];
      if (!html) continue;
      const cand = batch[j];
      const style = parseListingStyleFromProductHtml(html);
      if (style) cand.listingStyle = style;

      const targetName = cand.colorName || wantedColor;
      const childAsin =
        findVariationAsinForColor(html, targetName) ||
        (wantedColor && wantedColor !== targetName
          ? findVariationAsinForColor(html, wantedColor)
          : undefined);

      if (childAsin && childAsin.toUpperCase() !== cand.asin.toUpperCase()) {
        cand.asin = childAsin;
        cand.url = amazonProductUrl(childAsin);
        cand.score += 35;
      } else if (isSharedDiceAsin(cand.asin) || !childAsin) {
        cand.url = diceListingUrl({
          brand: "Chessex",
          colorName: targetName || wantedColor,
          kind,
          finish,
          asin: childAsin ?? cand.asin,
        });
      }

      if (!style) continue;
      const styleScore = scoreListingStyleAgainstTarget(style, colorNames, family);
      if (!styleScore) continue;
      cand.score += styleScore.delta;
      if (styleScore.matchedName) cand.colorName = styleScore.matchedName;
      if (styleScore.delta <= -100) {
        cand.score = -9999;
        cand.url = diceListingUrl({
          brand: "Chessex",
          colorName: wantedColor || targetName,
          kind,
          finish,
        });
      }
    }
  }
}

async function searchAmazonDice(
  hex: string,
  colorNames: string[],
  family: HueFamily,
  premium: boolean,
  kind: DiceKind,
  finish: DiceFinish,
  onProgress?: DiceMatchProgress,
): Promise<ScoredDice[]> {
  const scored: ScoredDice[] = [];
  const seen = new Set<string>();
  const querySet = new Set<string>();
  for (const colorName of colorNames.slice(0, 2)) {
    for (const q of buildDiceSearchQueries(colorName, premium, kind, finish)) {
      querySet.add(q);
    }
  }
  const queries = [...querySet].slice(0, 3);
  const PARALLEL = 2;
  let completed = 0;
  let stopEarly = false;

  const ingestHtml = (html: string | null) => {
    if (!html || stopEarly) return;
    for (const hit of parseAmazonSearchHtml(html)) {
      if (seen.has(hit.asin)) continue;
      seen.add(hit.asin);

      let bestForHit: { colorName: string; score: number } | null = null;
      for (const colorName of colorNames.slice(0, 2)) {
        const score = scoreAmazonDiceTitle(hit.title, colorName, family, premium, kind, finish);
        if (score == null) continue;
        if (!bestForHit || score > bestForHit.score) bestForHit = { colorName, score };
      }

      let listingStyle = hit.styleHint;
      if (listingStyle) {
        const styleScore = scoreListingStyleAgainstTarget(listingStyle, colorNames, family);
        if (styleScore) {
          if (styleScore.delta <= -100) continue;
          if (!bestForHit && styleScore.matchedName && styleScore.delta >= 40) {
            if (!/\bdice\b|d20|d6|chessex|polyhedral|spindown/i.test(hit.title)) continue;
            bestForHit = { colorName: styleScore.matchedName, score: 40 + styleScore.delta };
          } else if (bestForHit) {
            bestForHit.score += styleScore.delta;
            if (styleScore.matchedName) bestForHit.colorName = styleScore.matchedName;
          }
        }
      }

      if (!bestForHit) continue;

      const catalogHit =
        DICE_CATALOG.find(
          (e) =>
            e.name.toLowerCase() === bestForHit!.colorName.toLowerCase() &&
            e.family === family &&
            kindMatches(e.kind, kind) &&
            finishMatches(e.finish, finish),
        ) ??
        DICE_CATALOG.find(
          (e) =>
            e.name.toLowerCase() === bestForHit!.colorName.toLowerCase() &&
            e.family === family &&
            finishMatches(e.finish, finish),
        ) ??
        DICE_CATALOG.find(
          (e) => e.name.toLowerCase() === bestForHit!.colorName.toLowerCase() && e.family === family,
        );

      const matchHex = catalogHit?.hex ?? hex;
      const dE = colorDistance(hex, matchHex);
      const score = bestForHit.score - dE * 2;

      scored.push({
        title: hit.title,
        asin: hit.asin,
        url: diceListingUrl({
          brand: "Chessex",
          colorName: catalogHit?.name ?? bestForHit.colorName,
          kind,
          finish: catalogHit?.finish ?? finish,
          asin: hit.asin,
        }),
        matchHex,
        colorName: catalogHit?.name ?? bestForHit.colorName,
        dE,
        family: catalogHit?.family ?? family,
        score,
        source: "amazon",
        listingStyle,
      });

      if (isHighConfidenceAmazonHit(hit.title, bestForHit.colorName)) {
        const styleOk =
          !listingStyle ||
          (scoreListingStyleAgainstTarget(listingStyle, colorNames, family)?.delta ?? 0) >= 0;
        if (styleOk) {
          stopEarly = true;
          return;
        }
      }
    }
  };

  for (let i = 0; i < queries.length && !stopEarly; i += PARALLEL) {
    const batch = queries.slice(i, i + PARALLEL);
    const results = await Promise.all(batch.map((q) => fetchViaCorsProxy(amazonSearchUrl(q))));
    for (const html of results) {
      completed += 1;
      const pct = 12 + Math.round((completed / Math.max(queries.length, 1)) * 66);
      onProgress?.(
        "amazon",
        `Searching Amazon dice (${completed}/${queries.length})…`,
        Math.min(78, pct),
      );
      ingestHtml(html);
    }
  }

  if (scored.length) {
    await enrichListingsWithProductStyles(scored, colorNames, family, kind, finish, onProgress);
  }
  return scored.filter((s) => s.score > -500);
}

/**
 * Match a picked color to dice products:
 * 1) Hex → color name(s)
 * 2) Amazon search (Chessex / spindown / D6)
 * 3) Catalog ΔE backup
 */
export async function matchDiceColor(
  hex: string,
  premium: boolean,
  kind: DiceKind = "any",
  finish: DiceFinish = "any",
  onProgress?: DiceMatchProgress,
): Promise<DiceMatchResult> {
  onProgress?.("naming", "Naming color…", 10);
  const colorNames = diceColorNamesFromHex(hex, finish);
  const hue = hexToHueName(hex);
  const targetFamily = hueFamilyFromHex(hex);

  onProgress?.("amazon", "Searching Amazon dice…", 12);
  let amazonScored: ScoredDice[] = [];
  try {
    amazonScored = await searchAmazonDice(
      hex,
      colorNames,
      targetFamily,
      premium,
      kind,
      finish,
      onProgress,
    );
  } catch {
    amazonScored = [];
  }

  onProgress?.("catalog", "Scoring dice matches…", 92);
  const catalogScored = DICE_CATALOG.map((e) =>
    scoreCatalogEntry(e, hex, targetFamily, premium, kind, finish),
  ).filter((s): s is ScoredDice => s != null);

  const bestAmazon = [...amazonScored].sort((a, b) => b.score - a.score)[0];
  const bestCatalog = [...catalogScored].sort((a, b) => b.score - a.score)[0];
  let best = bestAmazon ?? bestCatalog;

  if (best && best.source === "catalog" && bestCatalog) {
    const clearer = catalogScored
      .filter((c) => c.dE + 15 < best!.dE && c.family === best!.family)
      .sort((a, b) => a.dE - b.dE)[0];
    if (clearer) best = clearer;
  }

  if (
    best &&
    best.source === "catalog" &&
    targetFamily !== "neutral" &&
    best.family === "neutral"
  ) {
    const chromatic = catalogScored
      .filter((c) => c.family === targetFamily)
      .sort((a, b) => a.dE - b.dE)[0];
    if (chromatic) best = chromatic;
  }

  if (!best) {
    const fallbackName = colorNames[0] ?? familyFallbackNames(targetFamily)[0];
    onProgress?.("done", "Done", 100);
    return {
      colorNames,
      colorName: fallbackName,
      title: `Search: ${fallbackName} ${finishLabel(finish)} dice`,
      asin: "",
      url: diceListingUrl({ brand: "Chessex", colorName: fallbackName, kind, finish }),
      matchHex: hex,
      hue,
      kind,
      finish,
      source: "catalog",
    };
  }

  if (isSharedDiceAsin(best.asin)) {
    best.url = diceListingUrl({
      brand: "Chessex",
      colorName: best.colorName,
      kind,
      finish,
      asin: best.asin,
    });
  }

  onProgress?.("done", "Done", 100);
  return {
    colorNames,
    colorName: best.colorName,
    title: best.title,
    asin: best.asin,
    url: best.url,
    matchHex: best.matchHex,
    hue,
    kind,
    finish,
    source: best.source,
    listingStyle: best.listingStyle,
  };
}
