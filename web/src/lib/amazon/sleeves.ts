/**
 * Sleeve catalog + Amazon color matcher.
 */
import { amazonProductUrl, amazonSearchUrl } from "./affiliate";
import {
  type HueFamily,
  type HueName,
  hexToHueName,
  colorDistance,
  hueFamilyFromHex,
  isPremiumBrand,
  synonymsForColor,
  titleHasColorSynonym,
  titleHasConflictingColor,
} from "./color";

type SleeveCatalogEntry = {
  name: string;
  brand: string;
  hex: string;
  asin: string;
  family: HueFamily;
  art?: boolean;
  premium?: boolean;
};

/**
 * Curated sleeve catalog — Dragon Shield Matte (+ some Ultimate Guard) hexes
 * approximated from product photos / brand naming. Used for CIEDE2000 matching.
 */
const SLEEVE_CATALOG: SleeveCatalogEntry[] = [
  // —— Reds ——
  { name: "Blood Red", brand: "Dragon Shield", hex: "#6B0F12", asin: "B0B337ZY41", family: "red", premium: true },
  { name: "Ruby", brand: "Dragon Shield", hex: "#C41E3A", asin: "B08GCZ427C", family: "red", premium: true },
  { name: "Crimson", brand: "Dragon Shield", hex: "#9B1B2F", asin: "B08GCZ427C", family: "red", premium: true },
  { name: "Red", brand: "Dragon Shield", hex: "#D32F2F", asin: "B0B337ZY41", family: "red", premium: true },
  { name: "Ember", brand: "Dragon Shield", hex: "#E53935", asin: "B0B337ZY41", family: "red", premium: true },
  // —— Orange / copper / brown ——
  { name: "Orange", brand: "Dragon Shield", hex: "#EF6C00", asin: "B07KY5Y97G", family: "orange", premium: true },
  { name: "Copper", brand: "Dragon Shield", hex: "#A05A2C", asin: "B01N1PAO9D", family: "brown", premium: true },
  { name: "Amber", brand: "Dragon Shield", hex: "#FF8F00", asin: "B07KY5Y97G", family: "orange", premium: true },
  // —— Yellow / gold ——
  { name: "Yellow", brand: "Dragon Shield", hex: "#FBC02D", asin: "B071D9WJ5K", family: "yellow", premium: true },
  { name: "Gold", brand: "Dragon Shield", hex: "#C9A227", asin: "B071D9WJ5K", family: "yellow", premium: true },
  // —— Greens ——
  { name: "Lime", brand: "Dragon Shield", hex: "#C0CA33", asin: "B0C18VY3LL", family: "green", premium: true },
  { name: "Apple Green", brand: "Dragon Shield", hex: "#8BC34A", asin: "B0C18VY3LL", family: "green", premium: true },
  { name: "Green", brand: "Dragon Shield", hex: "#43A047", asin: "B0C18VY3LL", family: "green", premium: true },
  { name: "Forest Green", brand: "Dragon Shield", hex: "#2E7D32", asin: "B0C18VY3LL", family: "green", premium: true },
  { name: "Forest", brand: "Dragon Shield", hex: "#1B5E20", asin: "B0C18VY3LL", family: "green", premium: true },
  { name: "Jade", brand: "Dragon Shield", hex: "#00A86B", asin: "B0C18VY3LL", family: "green", premium: true },
  { name: "Emerald", brand: "Dragon Shield", hex: "#009B4D", asin: "B0C18VY3LL", family: "green", premium: true },
  { name: "Mint", brand: "Dragon Shield", hex: "#7DCEA0", asin: "B0C18VY3LL", family: "green", premium: true },
  // —— Teal / petrol ——
  { name: "Petrol", brand: "Dragon Shield", hex: "#004D40", asin: "B0BX21VDRV", family: "teal", premium: true },
  { name: "Turquoise", brand: "Dragon Shield", hex: "#26A69A", asin: "B0BX21VDRV", family: "teal", premium: true },
  { name: "Teal", brand: "Ultimate Guard", hex: "#00897B", asin: "B0BX21VDRV", family: "teal", premium: true },
  { name: "Amazonite", brand: "Dragon Shield", hex: "#4DB6AC", asin: "B0BX21VDRV", family: "teal", premium: true },
  // —— Blues ——
  { name: "Sky Blue", brand: "Dragon Shield", hex: "#4FC3F7", asin: "B00YFVCS7S", family: "blue", premium: true },
  { name: "Blue", brand: "Dragon Shield", hex: "#1565C0", asin: "B00YFVCS7S", family: "blue", premium: true },
  { name: "Sapphire", brand: "Dragon Shield", hex: "#0D47A1", asin: "B07DXLNYH4", family: "blue", premium: true },
  { name: "Night Blue", brand: "Dragon Shield", hex: "#1A237E", asin: "B0BX21VDRV", family: "blue", premium: true },
  { name: "Midnight Blue", brand: "Dragon Shield", hex: "#0D1B4C", asin: "B0BX21VDRV", family: "blue", premium: true },
  { name: "Navy", brand: "Ultimate Guard", hex: "#0A2540", asin: "B07DXLNYH4", family: "blue", premium: true },
  // —— Purples ——
  { name: "Purple", brand: "Dragon Shield", hex: "#6A1B9A", asin: "B073G88D1M", family: "purple", premium: true },
  { name: "Amethyst", brand: "Dragon Shield", hex: "#9C27B0", asin: "B073G88D1M", family: "purple", premium: true },
  { name: "Violet", brand: "Ultimate Guard", hex: "#7B1FA2", asin: "B073G88D1M", family: "purple", premium: true },
  { name: "Nebula", brand: "Dragon Shield", hex: "#5E35B1", asin: "B073G88D1M", family: "purple", premium: true },
  // —— Pinks / magenta ——
  { name: "Magenta", brand: "Dragon Shield", hex: "#C2185B", asin: "B0B337ZY41", family: "pink", premium: true },
  { name: "Pink", brand: "Dragon Shield", hex: "#EC407A", asin: "B0B337ZY41", family: "pink", premium: true },
  { name: "Pink Diamond", brand: "Dragon Shield", hex: "#F8BBD0", asin: "B00WX57OO0", family: "pink", premium: true },
  { name: "Pink Sapphire", brand: "Dragon Shield", hex: "#F48FB1", asin: "B00WX57OO0", family: "pink", premium: true },
  { name: "Rose", brand: "Dragon Shield", hex: "#E91E63", asin: "B0B337ZY41", family: "pink", premium: true },
  // —— Neutrals ——
  { name: "Black", brand: "Dragon Shield", hex: "#1A1A1A", asin: "B00WX57O7M", family: "neutral", premium: true },
  { name: "Jet", brand: "Dragon Shield", hex: "#0A0A0A", asin: "B00WX57O7M", family: "neutral", premium: true },
  { name: "Silver", brand: "Dragon Shield", hex: "#B0BEC5", asin: "B07KGNM858", family: "neutral", premium: true },
  { name: "Gray", brand: "Dragon Shield", hex: "#78909C", asin: "B07KGNM858", family: "neutral", premium: true },
  { name: "White", brand: "Dragon Shield", hex: "#FAFAFA", asin: "B00WX57OO0", family: "neutral", premium: true },
  { name: "Ivory", brand: "Dragon Shield", hex: "#FFF3E0", asin: "B00WX57OO0", family: "neutral", premium: true },
  { name: "Clear", brand: "Dragon Shield", hex: "#ECEFF1", asin: "B01G25NEW2", family: "neutral", premium: true },
  // Art / dual-art sleeves — approximate dominant colors for matching
  { name: "Dual Matte Art", brand: "Dragon Shield", hex: "#455A64", asin: "B0DM939C7L", family: "neutral", premium: true, art: true },
  { name: "Art Red", brand: "Dragon Shield", hex: "#C62828", asin: "B0DM939C7L", family: "red", premium: true, art: true },
  { name: "Art Blue", brand: "Dragon Shield", hex: "#1565C0", asin: "B0DM939C7L", family: "blue", premium: true, art: true },
  { name: "Art Green", brand: "Dragon Shield", hex: "#2E7D32", asin: "B0DM939C7L", family: "green", premium: true, art: true },
  { name: "Art Purple", brand: "Dragon Shield", hex: "#6A1B9A", asin: "B0DM939C7L", family: "purple", premium: true, art: true },
  { name: "Art Black", brand: "Dragon Shield", hex: "#1A1A1A", asin: "B0DM939C7L", family: "neutral", premium: true, art: true },
  { name: "Art Pink", brand: "Dragon Shield", hex: "#EC407A", asin: "B0DM939C7L", family: "pink", premium: true, art: true },
  // Budget solids (same hex families; soft-prefer when premium is off)
  { name: "Budget Clear", brand: "Generic", hex: "#ECEFF1", asin: "B01G25NEW2", family: "neutral", premium: false },
  { name: "Budget Black", brand: "Generic", hex: "#1A1A1A", asin: "B00WX57O7M", family: "neutral", premium: false },
  { name: "Budget Red", brand: "Generic", hex: "#C62828", asin: "B0B337ZY41", family: "red", premium: false },
  { name: "Budget Blue", brand: "Generic", hex: "#1565C0", asin: "B00YFVCS7S", family: "blue", premium: false },
  { name: "Budget Green", brand: "Generic", hex: "#2E7D32", asin: "B0C18VY3LL", family: "green", premium: false },
  { name: "Budget Purple", brand: "Generic", hex: "#6A1B9A", asin: "B073G88D1M", family: "purple", premium: false },
  { name: "Budget Art", brand: "Generic", hex: "#546E7A", asin: "B0DM939C7L", family: "neutral", premium: false, art: true },
];

/**
 * Map hex → sleeve color names. Primary is the nearest matte catalog color by
 * CIEDE2000; at most one synonym when nearly tied in the same family.
 */
export function colorNamesFromHex(hex: string): string[] {
  const targetFamily = hueFamilyFromHex(hex);
  const matte = SLEEVE_CATALOG.filter((e) => !e.art && !e.name.startsWith("Budget"));

  const pool = matte
    .map((e) => ({
      name: e.name,
      hex: e.hex,
      family: e.family,
      dE: colorDistance(hex, e.hex),
    }))
    .filter((e) => e.family === targetFamily)
    .sort((a, b) => a.dE - b.dE);

  if (!pool.length) {
    if (targetFamily === "purple") return ["Purple", "Amethyst"];
    if (targetFamily === "neutral") return ["Gray"];
    return ["Black"];
  }

  const primary = pool[0];
  const names = [primary.name];
  const runner = pool[1];
  if (runner && runner.dE <= primary.dE + 2.5) {
    names.push(runner.name);
  }
  return names.slice(0, 2);
}

const ART_SLEEVE_FALLBACK = "B0DM939C7L";

function sharedSleeveAsins(): Set<string> {
  const counts = new Map<string, number>();
  for (const e of SLEEVE_CATALOG) {
    const a = e.asin.toUpperCase();
    counts.set(a, (counts.get(a) ?? 0) + 1);
  }
  const shared = new Set<string>();
  for (const [asin, n] of counts) {
    if (n > 1) shared.add(asin);
  }
  return shared;
}

let _sharedSleeveAsins: Set<string> | null = null;
function isSharedSleeveAsin(asin: string): boolean {
  if (!_sharedSleeveAsins) _sharedSleeveAsins = sharedSleeveAsins();
  return _sharedSleeveAsins.has(asin.toUpperCase());
}

/** Open a color-specific listing: unique child ASIN when known, else a precise search. */
export function sleeveListingUrl(opts: {
  brand: string;
  colorName: string;
  asin?: string;
  art?: boolean;
}): string {
  const asin = opts.asin?.replace(/[^A-Z0-9]/gi, "").slice(0, 10);
  if (asin && asin.length === 10 && !isSharedSleeveAsin(asin)) {
    return amazonProductUrl(asin);
  }
  const brand = opts.brand || "Dragon Shield";
  const color = opts.colorName.trim();
  const query = opts.art
    ? `${brand} dual art ${color} sleeves`
    : `${brand} Matte ${color} sleeves 100`;
  return amazonSearchUrl(query);
}

type ScoredSleeve = {
  title: string;
  asin: string;
  url: string;
  matchHex: string;
  colorName: string;
  dE: number;
  family: HueFamily;
  score: number;
  source: "catalog" | "amazon";
  /** Color/Style text from the Amazon listing when available. */
  listingStyle?: string;
};

export type SleeveMatchResult = {
  colorNames: string[];
  colorName: string;
  title: string;
  asin: string;
  url: string;
  matchHex: string;
  hue: HueName;
  source: "catalog" | "amazon";
  /** Color or Style attribute read from the Amazon listing, when found. */
  listingStyle?: string;
  candidates?: Array<{ title: string; score: number; source: string }>;
};

export type SleeveMatchStage = "naming" | "catalog" | "amazon" | "styles" | "done";

/** Progress callback: stage, human label, and 0–100 percent (weighted toward Amazon search). */
export type SleeveMatchProgress = (stage: SleeveMatchStage, label: string, pct: number) => void;

type AmazonSearchHit = {
  title: string;
  asin: string;
  /** Color / Style snippet from the search card when Amazon exposes it. */
  styleHint?: string;
};

function scoreCatalogEntry(
  entry: SleeveCatalogEntry,
  hex: string,
  targetFamily: HueFamily,
  premium: boolean,
  art: "any" | "art" | "basic",
): ScoredSleeve | null {
  const dE = colorDistance(hex, entry.hex);

  // Hard hue-family gate: same family only (purple never → Gray/Silver/Navy)
  if (entry.family !== targetFamily) return null;

  // Color accuracy dominates. Soft prefs must lose to a clearly better ΔE (~15+)
  let score = 400 - dE * 12;

  const entryPremium = Boolean(entry.premium || isPremiumBrand(entry.brand));
  // Soft premium: ±8 — a ΔE gap of ~1 already outweighs this; 15 ΔE ≫ premium
  if (premium) {
    if (entryPremium) score += 8;
    else score -= 3;
  } else {
    if (!entryPremium) score += 8;
    else score -= 4;
  }

  // Soft art preference
  if (art === "art") score += entry.art ? 28 : -14;
  else if (art === "basic") score += entry.art ? -24 : 12;

  const displayTitle = entry.art
    ? `${entry.brand}: ${entry.name} (Art / dual art)`
    : premium || entryPremium
      ? `${entry.brand}: ${entry.name} Matte`
      : `Matte card sleeves: ${entry.name}`;

  return {
    title: displayTitle,
    asin: entry.asin,
    url: sleeveListingUrl({
      brand: entry.brand,
      colorName: entry.name.replace(/^Budget\s+/i, "").replace(/^Art\s+/i, "") || entry.name,
      asin: entry.asin,
      art: entry.art,
    }),
    matchHex: entry.hex,
    colorName: entry.name.replace(/^Budget\s+/i, "").replace(/^Art\s+/i, "") || entry.name,
    dE,
    family: entry.family,
    score,
    source: "catalog",
  };
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

/** Pull Color:/Style: labels from a search-result HTML slice. */
function extractStyleHintFromSlice(slice: string): string | undefined {
  const patterns = [
    /(?:Color|Colour|Style)\s*:\s*<\/?(?:span|td|th|div)[^>]*>\s*([^<]{2,60})/i,
    /(?:Color|Colour|Style)\s*:\s*([A-Za-z][A-Za-z0-9 /&-]{1,50})/i,
    /aria-label="(?:Color|Colour|Style)\s*:\s*([^"]{2,60})"/i,
    /data-csa-c-element-id="[^"]*color[^"]*"[^>]*>\s*([^<]{2,40})/i,
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

/**
 * Parse listing Color / Style attributes from a product page (regex only).
 * Amazon twister + detail tables often expose the real sleeve color here.
 */
function parseListingStyleFromProductHtml(html: string): string | undefined {
  const patterns = [
    // Selected twister variation
    /id="inline-twister-expanded-dimension-text-color_name"[^>]*>\s*([^<]{2,60})/i,
    /id="inline-twister-expanded-dimension-text-style_name"[^>]*>\s*([^<]{2,60})/i,
    /variation_color_name[\s\S]{0,400}?class="selection"[^>]*>\s*([^<]{2,60})/i,
    /variation_style_name[\s\S]{0,400}?class="selection"[^>]*>\s*([^<]{2,60})/i,
    // Product overview / detail table
    /<(?:th|td|span)[^>]*>\s*(?:Color|Colour|Style)\s*<\/(?:th|td|span)>\s*<(?:td|span)[^>]*>\s*([^<]{2,60})/i,
    // Embedded JSON common on DP pages
    /"color_name"\s*:\s*"([^"]{2,60})"/i,
    /"style_name"\s*:\s*"([^"]{2,60})"/i,
    /"displayLabels"\s*:\s*\[[^\]]*"Color"[^\]]*\][\s\S]{0,200}"displayValues"\s*:\s*\[\s*"([^"]{2,60})"/i,
  ];
  for (const re of patterns) {
    const m = html.match(re);
    if (m?.[1]) {
      const cleaned = decodeHtmlEntities(m[1]).replace(/\s+/g, " ").trim();
      // Skip generic placeholders
      if (/^(select|see options|click|n\/a)$/i.test(cleaned)) continue;
      if (cleaned.length >= 2 && cleaned.length <= 60) return cleaned;
    }
  }
  return undefined;
}

/**
 * Find the child variation ASIN for a target color on a twister product page.
 * Amazon embeds maps like "B0XXXX1234":["Amazonite"] in dimensionValuesDisplayData.
 */
function findVariationAsinForColor(html: string, colorName: string): string | undefined {
  const target = colorName.toLowerCase().trim();
  if (!target) return undefined;
  const synonyms = new Set(synonymsForColor(colorName).map((s) => s.toLowerCase()));
  synonyms.add(target);

  // "ASIN":["Amazonite"] or "ASIN":["Amazonite","Matte"]
  const pairRe = /"([A-Z0-9]{10})"\s*:\s*\[\s*"([^"]+)"/gi;
  let m: RegExpExecArray | null;
  while ((m = pairRe.exec(html)) !== null) {
    const asin = m[1];
    const label = decodeHtmlEntities(m[2]).toLowerCase();
    if (synonyms.has(label) || label.includes(target) || [...synonyms].some((s) => label.includes(s))) {
      return asin;
    }
  }

  // Title-in-URL style: /dp/ASIN/...Amazonite or data-asin with nearby color
  const dpColorRe = new RegExp(
    `\\/dp\\/([A-Z0-9]{10})[^"']{0,80}${target.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`,
    "i",
  );
  const dpHit = html.match(dpColorRe);
  if (dpHit?.[1]) return dpHit[1];

  return undefined;
}

/** How well a listing Color/Style string agrees with the target color family. */
function scoreListingStyleAgainstTarget(
  styleText: string,
  colorNames: string[],
  family: HueFamily,
): { delta: number; matchedName?: string } | null {
  const style = styleText.trim();
  if (!style) return null;
  const styleLower = style.toLowerCase();

  // Exact / synonym hit against requested names
  for (const name of colorNames) {
    if (styleLower.includes(name.toLowerCase()) || titleHasColorSynonym(style, name)) {
      return { delta: 70, matchedName: name };
    }
  }

  // Conflict with the target hue family → reject
  if (titleHasConflictingColor(style, family, colorNames[0] ?? "")) {
    return { delta: -120 };
  }

  // Soft: style mentions a catalog color in the same family
  const familyHit = SLEEVE_CATALOG.find(
    (e) =>
      e.family === family &&
      !e.art &&
      (styleLower.includes(e.name.toLowerCase()) ||
        titleHasColorSynonym(style, e.name)),
  );
  if (familyHit) return { delta: 45, matchedName: familyHit.name };

  // Neutral style text (e.g. "Standard") — no signal
  return { delta: 0 };
}

/** Parse ASINs + titles (+ Color/Style hints) from Amazon HTML via regex only. */
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
    found.set(asin, {
      asin,
      title,
      styleHint: extractStyleHintFromSlice(slice),
    });
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
  // Prefer one fast proxy; fall back once. Short timeouts so catalog fallback is quick.
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
      // Text only — callers must regex-parse; never assign to innerHTML
      if (text && text.length > 500) return text;
    } catch {
      /* try next proxy */
    }
  }
  return null;
}

function buildSleeveSearchQueries(
  colorName: string,
  premium: boolean,
  art: "any" | "art" | "basic",
): string[] {
  // Prefer 2–3 high-quality queries over many slow serial searches
  if (art === "art") {
    return [
      `Dragon Shield dual art sleeves ${colorName}`,
      `Dragon Shield art sleeves ${colorName}`,
      `Ultimate Guard art sleeves ${colorName}`,
    ];
  }
  const queries = [
    `Dragon Shield Matte ${colorName}`,
    `Dragon Shield ${colorName} sleeves 100`,
  ];
  if (premium) {
    queries.push(`Ultimate Guard ${colorName} matte sleeves`);
  } else {
    queries.push(`matte card sleeves ${colorName} 100`);
  }
  if (art === "basic") {
    queries.push(`solid color matte sleeves ${colorName}`);
  }
  return queries.slice(0, 3);
}

function scoreAmazonSleeveTitle(
  title: string,
  colorName: string,
  family: HueFamily,
  premium: boolean,
  art: "any" | "art" | "basic",
): number | null {
  const titleLower = title.toLowerCase();
  if (!/sleeve|dragon shield|ultimate guard|katana|gamegenic/.test(titleLower)) return null;

  const exactColor = titleLower.includes(colorName.toLowerCase());
  const synHit = titleHasColorSynonym(title, colorName);
  if (!exactColor && !synHit) return null;
  if (titleHasConflictingColor(title, family, colorName)) return null;

  let score = 50;
  if (exactColor) score += 55;
  else if (synHit) score += 28;

  if (/dragon shield/.test(titleLower)) score += 22;
  else if (/ultimate guard/.test(titleLower)) score += 18;
  else if (/katana/.test(titleLower)) score += 14;
  else if (/gamegenic/.test(titleLower)) score += 10;
  if (/sleeve/.test(titleLower)) score += 12;
  if (/matte/.test(titleLower)) score += 10;
  if (/\b100\b/.test(titleLower)) score += 4;

  if (premium && isPremiumBrand(title)) score += 16;
  else if (premium && !isPremiumBrand(title)) score -= 8;
  else if (!premium && !isPremiumBrand(title)) score += 12;
  else if (!premium && isPremiumBrand(title)) score -= 4;

  const looksArt = /art|dual art|illustrated|artwork/.test(titleLower);
  const looksMatte = /matte|solid|opaque/.test(titleLower);
  if (art === "art") {
    if (looksArt) score += 30;
    else score -= 18;
  } else if (art === "basic") {
    if (looksArt) score -= 28;
    else if (looksMatte) score += 16;
  }

  // Exact Dragon Shield Matte {Color} is a high-confidence hit
  const escaped = colorName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  if (new RegExp(`dragon shield\\s+matte\\s+${escaped}`, "i").test(titleLower)) score += 40;

  return score;
}

function isHighConfidenceAmazonHit(title: string, colorName: string): boolean {
  const t = title.toLowerCase();
  const c = colorName.toLowerCase();
  if (/\b(gray|grey|silver)\b/.test(t) && !c.includes("gray") && !c.includes("grey") && c !== "silver") {
    return false;
  }
  return t.includes("dragon shield") && t.includes("matte") && t.includes(c);
}

async function enrichListingsWithProductStyles(
  candidates: ScoredSleeve[],
  colorNames: string[],
  family: HueFamily,
  onProgress?: SleeveMatchProgress,
): Promise<void> {
  // Only open the top few product pages — style data is expensive via CORS proxy
  const top = [...candidates].sort((a, b) => b.score - a.score).slice(0, 5);
  if (!top.length) return;

  onProgress?.("styles", "Reading listing Color / Style…", 86);
  const PARALLEL = 2;
  let done = 0;
  const wantedColor = colorNames[0] ?? "";

  for (let i = 0; i < top.length; i += PARALLEL) {
    const batch = top.slice(i, i + PARALLEL);
    const pages = await Promise.all(
      batch.map((c) => fetchViaCorsProxy(amazonProductUrl(c.asin))),
    );
    for (let j = 0; j < batch.length; j++) {
      done += 1;
      const pct = 86 + Math.round((done / top.length) * 4);
      onProgress?.(
        "styles",
        `Reading listing styles (${done}/${top.length})…`,
        Math.min(90, pct),
      );

      const html = pages[j];
      if (!html) continue;
      const cand = batch[j];
      const style = parseListingStyleFromProductHtml(html);
      if (style) cand.listingStyle = style;

      const targetName = cand.colorName || wantedColor;
      // Prefer the child ASIN for the desired color on twister parents
      const childAsin =
        findVariationAsinForColor(html, targetName) ||
        (wantedColor && wantedColor !== targetName
          ? findVariationAsinForColor(html, wantedColor)
          : undefined);

      if (childAsin && childAsin.toUpperCase() !== cand.asin.toUpperCase()) {
        cand.asin = childAsin;
        cand.url = amazonProductUrl(childAsin);
        cand.score += 35;
      } else if (isSharedSleeveAsin(cand.asin) || !childAsin) {
        // Shared parent /dp links default to the wrong swatch (e.g. Midnight Blue).
        // Point at a color-specific search so the right variation is easy to pick.
        cand.url = sleeveListingUrl({
          brand: "Dragon Shield",
          colorName: targetName || wantedColor,
          asin: childAsin ?? cand.asin,
          art: /art|dual art/i.test(cand.title),
        });
      }

      if (!style) continue;
      const styleScore = scoreListingStyleAgainstTarget(style, colorNames, family);
      if (!styleScore) continue;

      cand.score += styleScore.delta;
      if (styleScore.matchedName) {
        cand.colorName = styleScore.matchedName;
        // Style on page may be wrong color for this ASIN — retarget URL
        if (styleScore.delta <= -100 || styleScore.matchedName.toLowerCase() !== style.toLowerCase()) {
          const child =
            findVariationAsinForColor(html, styleScore.matchedName) ??
            findVariationAsinForColor(html, wantedColor);
          if (child) {
            cand.asin = child;
            cand.url = amazonProductUrl(child);
          } else {
            cand.url = sleeveListingUrl({
              brand: "Dragon Shield",
              colorName: styleScore.matchedName,
              art: /art|dual art/i.test(cand.title),
            });
          }
        }
      }
      if (styleScore.delta <= -100) {
        cand.score = -9999;
        cand.url = sleeveListingUrl({
          brand: "Dragon Shield",
          colorName: wantedColor || targetName,
          art: /art|dual art/i.test(cand.title),
        });
      }
    }
  }
}

async function searchAmazonSleeves(
  hex: string,
  colorNames: string[],
  family: HueFamily,
  premium: boolean,
  art: "any" | "art" | "basic",
  onProgress?: SleeveMatchProgress,
): Promise<ScoredSleeve[]> {
  const scored: ScoredSleeve[] = [];
  const seen = new Set<string>();
  const primary = colorNames[0] ?? "Black";
  const querySet = new Set<string>();
  for (const colorName of colorNames.slice(0, 2)) {
    for (const q of buildSleeveSearchQueries(colorName, premium, art)) {
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
        const score = scoreAmazonSleeveTitle(hit.title, colorName, family, premium, art);
        if (score == null) continue;
        if (!bestForHit || score > bestForHit.score) {
          bestForHit = { colorName, score };
        }
      }

      // Search-card Color/Style hint can admit a hit even when the title is vague,
      // or boost/penalize an existing title score.
      let listingStyle = hit.styleHint;
      if (listingStyle) {
        const styleScore = scoreListingStyleAgainstTarget(listingStyle, colorNames, family);
        if (styleScore) {
          if (styleScore.delta <= -100) continue; // conflicting style on the card
          if (!bestForHit && styleScore.matchedName && styleScore.delta >= 40) {
            // Title alone missed color, but Style/Color clearly matches
            if (!/sleeve|dragon shield|ultimate guard|katana|gamegenic/i.test(hit.title)) {
              continue;
            }
            bestForHit = { colorName: styleScore.matchedName, score: 40 + styleScore.delta };
          } else if (bestForHit) {
            bestForHit.score += styleScore.delta;
            if (styleScore.matchedName) bestForHit.colorName = styleScore.matchedName;
          }
        }
      }

      if (!bestForHit) continue;

      const titleLower = hit.title.toLowerCase();
      const looksArt = /art|dual art|illustrated|artwork/.test(titleLower);
      const catalogHit =
        SLEEVE_CATALOG.find(
          (e) =>
            e.name.toLowerCase() === bestForHit!.colorName.toLowerCase() &&
            Boolean(e.art) === looksArt &&
            e.family === family,
        ) ??
        SLEEVE_CATALOG.find(
          (e) => e.name.toLowerCase() === bestForHit!.colorName.toLowerCase() && e.family === family,
        ) ??
        SLEEVE_CATALOG.find(
          (e) => titleLower.includes(e.name.toLowerCase()) && !e.art && e.family === family,
        );

      const matchHex = catalogHit?.hex ?? hex;
      const dE = colorDistance(hex, matchHex);
      const score = bestForHit.score - dE * 2;

      scored.push({
        title: hit.title,
        asin: hit.asin,
        url: sleeveListingUrl({
          brand: "Dragon Shield",
          colorName: catalogHit?.name ?? bestForHit.colorName,
          asin: hit.asin,
          art: looksArt,
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
    const results = await Promise.all(
      batch.map((q) => fetchViaCorsProxy(amazonSearchUrl(q))),
    );
    for (const html of results) {
      completed += 1;
      // Search phase occupies ~12% → 78%
      const pct = 12 + Math.round((completed / Math.max(queries.length, 1)) * 66);
      onProgress?.(
        "amazon",
        `Searching Amazon sleeves (${completed}/${queries.length})…`,
        Math.min(78, pct),
      );
      ingestHtml(html);
      if (stopEarly) break;
    }
  }

  for (const s of scored) {
    if (s.colorName.toLowerCase() === primary.toLowerCase()) s.score += 6;
  }

  // Fetch product pages for top candidates and read Color/Style twister data
  if (scored.length) {
    await enrichListingsWithProductStyles(scored, colorNames, family, onProgress);
    // Drop hard style rejects
    const kept = scored.filter((s) => s.score > -500);
    scored.length = 0;
    scored.push(...kept);
  }

  // Recompute dE against the user's hex using catalog hex for the final color name
  for (const s of scored) {
    const catalogHit = SLEEVE_CATALOG.find(
      (e) => e.family === family && e.name.toLowerCase() === s.colorName.toLowerCase() && !e.art,
    );
    if (catalogHit) {
      s.matchHex = catalogHit.hex;
      s.dE = colorDistance(hex, catalogHit.hex);
    } else {
      s.dE = colorDistance(hex, s.matchHex);
    }
  }

  return scored;
}

/**
 * Match a picked color to sleeve products:
 * 1) Hex → 1 primary color name (+ optional synonym)
 * 2) Amazon search; score titles, then read Color/Style on top listings
 * 3) Catalog ΔE match only as backup when Amazon fetch fails entirely
 */
export async function matchSleeveColor(
  hex: string,
  premium: boolean,
  art: "any" | "art" | "basic" = "any",
  onProgress?: SleeveMatchProgress,
): Promise<SleeveMatchResult> {
  onProgress?.("naming", "Naming color…", 10);
  const colorNames = colorNamesFromHex(hex);
  const hue = hexToHueName(hex);
  const targetFamily = hueFamilyFromHex(hex);

  onProgress?.("amazon", "Searching Amazon sleeves…", 12);
  let amazonScored: ScoredSleeve[] = [];
  try {
    amazonScored = await searchAmazonSleeves(
      hex,
      colorNames,
      targetFamily,
      premium,
      art,
      onProgress,
    );
  } catch {
    amazonScored = [];
  }

  onProgress?.("catalog", "Scoring sleeve matches…", 92);
  const catalogScored = SLEEVE_CATALOG.map((e) =>
    scoreCatalogEntry(e, hex, targetFamily, premium, art),
  ).filter((s): s is ScoredSleeve => s != null);

  const bestAmazon = [...amazonScored].sort((a, b) => b.score - a.score)[0];
  const bestCatalog = [...catalogScored].sort((a, b) => b.score - a.score)[0];

  // Amazon-first when live hits exist; catalog is backup only
  let best = bestAmazon ?? bestCatalog;

  if (best && best.source === "catalog" && bestCatalog) {
    const clearer = catalogScored
      .filter((c) => c.dE + 15 < best!.dE && c.family === best!.family)
      .sort((a, b) => a.dE - b.dE)[0];
    if (clearer) best = clearer;
  }

  // Final safety: never ship a neutral catalog win for a chromatic pick
  if (best && targetFamily !== "neutral" && best.family === "neutral") {
    const chromatic = catalogScored
      .filter((c) => c.family === targetFamily)
      .sort((a, b) => b.score - a.score)[0];
    if (chromatic) best = chromatic;
  }

  const all = [...amazonScored, ...catalogScored].sort((a, b) => b.score - a.score);

  if (!best) {
    const fallback =
      SLEEVE_CATALOG.find((e) => e.family === targetFamily && !e.art) ??
      (art === "art" ? SLEEVE_CATALOG.find((e) => e.art) : undefined) ??
      SLEEVE_CATALOG[0];
    best = {
      title: `${fallback.brand}: ${fallback.name}`,
      asin: art === "art" ? ART_SLEEVE_FALLBACK : fallback.asin,
      url: sleeveListingUrl({
        brand: fallback.brand,
        colorName: fallback.name,
        asin: art === "art" ? ART_SLEEVE_FALLBACK : fallback.asin,
        art: art === "art" || fallback.art,
      }),
      matchHex: fallback.hex,
      colorName: fallback.name,
      dE: colorDistance(hex, fallback.hex),
      family: fallback.family,
      score: 0,
      source: "catalog",
    };
  }

  // Final URL safety: never open a shared parent ASIN that defaults to the wrong swatch
  best.url = sleeveListingUrl({
    brand: /ultimate guard/i.test(best.title) ? "Ultimate Guard" : "Dragon Shield",
    colorName: best.colorName,
    asin: best.asin,
    art: art === "art" || /art|dual art/i.test(best.title),
  });

  onProgress?.("done", "Match ready", 100);

  return {
    colorNames,
    colorName: best.colorName,
    title: best.title,
    asin: best.asin,
    url: best.url,
    matchHex: best.matchHex,
    hue,
    source: best.source,
    listingStyle: best.listingStyle,
    candidates: all.slice(0, 8).map((c) => ({
      title: c.title,
      score: Math.round(c.score),
      source: c.source,
    })),
  };
}

