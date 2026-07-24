/**
 * Amazon product selection + affiliate helpers.
 * Supply generator uses Amazon search URLs (ASINs go stale / remapped).
 * Precons may still use /dp/{ASIN} when a sealed product ASIN is known.
 * Proxy supplies and sleeve search also use Amazon search URLs.
 */

export const AFFILIATE_TAG = "igottic-20";

export function amazonProductUrl(asin: string): string {
  const params = new URLSearchParams({ tag: AFFILIATE_TAG, th: "1", psc: "1" });
  return `https://www.amazon.com/dp/${asin}?${params.toString()}`;
}

export function amazonSearchUrl(query: string): string {
  const params = new URLSearchParams({ k: query, tag: AFFILIATE_TAG });
  return `https://www.amazon.com/s?${params.toString()}`;
}

export type HueName =
  | "red"
  | "orange"
  | "yellow"
  | "green"
  | "teal"
  | "blue"
  | "purple"
  | "pink"
  | "brown"
  | "black"
  | "white"
  | "gray";

const PREMIUM_SLEEVE_BRANDS = ["dragon shield", "ultimate guard", "katana", "gamegenic"];

type SleeveCatalogEntry = {
  name: string;
  brand: string;
  hex: string;
  asin: string;
  art?: boolean;
  premium?: boolean;
};

/**
 * Curated sleeve catalog — Dragon Shield Matte hexes tuned to product photos
 * (approximate; used for CIEDE2000 nearest-neighbor matching).
 */
const SLEEVE_CATALOG: SleeveCatalogEntry[] = [
  { name: "Blood Red", brand: "Dragon Shield", hex: "#6E0F14", asin: "B0B337ZY41", premium: true },
  { name: "Red", brand: "Dragon Shield", hex: "#C62828", asin: "B0B337ZY41", premium: true },
  { name: "Crimson", brand: "Dragon Shield", hex: "#9B1B2F", asin: "B08GCZ427C", premium: true },
  { name: "Ruby", brand: "Dragon Shield", hex: "#D32F2F", asin: "B08GCZ427C", premium: true },
  { name: "Orange", brand: "Dragon Shield", hex: "#EF6C00", asin: "B07KY5Y97G", premium: true },
  { name: "Copper", brand: "Dragon Shield", hex: "#A05A2C", asin: "B01N1PAO9D", premium: true },
  { name: "Yellow", brand: "Dragon Shield", hex: "#FBC02D", asin: "B071D9WJ5K", premium: true },
  { name: "Gold", brand: "Dragon Shield", hex: "#C9A227", asin: "B071D9WJ5K", premium: true },
  { name: "Apple Green", brand: "Dragon Shield", hex: "#8BC34A", asin: "B0C18VY3LL", premium: true },
  { name: "Forest Green", brand: "Dragon Shield", hex: "#2E7D32", asin: "B0C18VY3LL", premium: true },
  { name: "Forest", brand: "Dragon Shield", hex: "#1B5E20", asin: "B0C18VY3LL", premium: true },
  // True emerald green (was incorrectly teal #00897B)
  { name: "Emerald", brand: "Dragon Shield", hex: "#009B4D", asin: "B0C18VY3LL", premium: true },
  { name: "Mint", brand: "Dragon Shield", hex: "#7DCEA0", asin: "B0C18VY3LL", premium: true },
  { name: "Lime", brand: "Dragon Shield", hex: "#C0CA33", asin: "B0C18VY3LL", premium: true },
  { name: "Petrol", brand: "Dragon Shield", hex: "#004D40", asin: "B0BX21VDRV", premium: true },
  { name: "Turquoise", brand: "Dragon Shield", hex: "#26A69A", asin: "B0BX21VDRV", premium: true },
  { name: "Teal", brand: "Ultimate Guard", hex: "#00897B", asin: "B0BX21VDRV", premium: true },
  { name: "Sky Blue", brand: "Dragon Shield", hex: "#4FC3F7", asin: "B00YFVCS7S", premium: true },
  { name: "Blue", brand: "Dragon Shield", hex: "#1565C0", asin: "B00YFVCS7S", premium: true },
  { name: "Sapphire", brand: "Dragon Shield", hex: "#0D47A1", asin: "B07DXLNYH4", premium: true },
  { name: "Midnight Blue", brand: "Dragon Shield", hex: "#0D1B4C", asin: "B0BX21VDRV", premium: true },
  { name: "Night Blue", brand: "Dragon Shield", hex: "#1A237E", asin: "B0BX21VDRV", premium: true },
  { name: "Navy", brand: "Ultimate Guard", hex: "#0A2540", asin: "B07DXLNYH4", premium: true },
  { name: "Purple", brand: "Dragon Shield", hex: "#6A1B9A", asin: "B073G88D1M", premium: true },
  { name: "Amethyst", brand: "Dragon Shield", hex: "#9C27B0", asin: "B073G88D1M", premium: true },
  { name: "Violet", brand: "Ultimate Guard", hex: "#7B1FA2", asin: "B073G88D1M", premium: true },
  { name: "Magenta", brand: "Dragon Shield", hex: "#C2185B", asin: "B0B337ZY41", premium: true },
  { name: "Pink", brand: "Dragon Shield", hex: "#EC407A", asin: "B0B337ZY41", premium: true },
  { name: "Pink Diamond", brand: "Dragon Shield", hex: "#F8BBD0", asin: "B00WX57OO0", premium: true },
  { name: "Rose", brand: "Dragon Shield", hex: "#E91E63", asin: "B0B337ZY41", premium: true },
  { name: "Black", brand: "Dragon Shield", hex: "#1A1A1A", asin: "B00WX57O7M", premium: true },
  { name: "Jet", brand: "Dragon Shield", hex: "#0A0A0A", asin: "B00WX57O7M", premium: true },
  { name: "Silver", brand: "Dragon Shield", hex: "#B0BEC5", asin: "B07KGNM858", premium: true },
  { name: "Gray", brand: "Dragon Shield", hex: "#78909C", asin: "B07KGNM858", premium: true },
  { name: "White", brand: "Dragon Shield", hex: "#FAFAFA", asin: "B00WX57OO0", premium: true },
  { name: "Ivory", brand: "Dragon Shield", hex: "#FFF3E0", asin: "B00WX57OO0", premium: true },
  { name: "Clear", brand: "Dragon Shield", hex: "#ECEFF1", asin: "B01G25NEW2", premium: true },
  // Art / dual-art sleeves — approximate dominant colors for matching
  { name: "Dual Matte Art", brand: "Dragon Shield", hex: "#455A64", asin: "B0DM939C7L", premium: true, art: true },
  { name: "Art Red", brand: "Dragon Shield", hex: "#C62828", asin: "B0DM939C7L", premium: true, art: true },
  { name: "Art Blue", brand: "Dragon Shield", hex: "#1565C0", asin: "B0DM939C7L", premium: true, art: true },
  { name: "Art Green", brand: "Dragon Shield", hex: "#2E7D32", asin: "B0DM939C7L", premium: true, art: true },
  { name: "Art Purple", brand: "Dragon Shield", hex: "#6A1B9A", asin: "B0DM939C7L", premium: true, art: true },
  { name: "Art Black", brand: "Dragon Shield", hex: "#1A1A1A", asin: "B0DM939C7L", premium: true, art: true },
  { name: "Art Pink", brand: "Dragon Shield", hex: "#EC407A", asin: "B0DM939C7L", premium: true, art: true },
  { name: "Budget Clear", brand: "Generic", hex: "#ECEFF1", asin: "B01G25NEW2", premium: false },
  { name: "Budget Black", brand: "Generic", hex: "#1A1A1A", asin: "B00WX57O7M", premium: false },
  { name: "Budget Red", brand: "Generic", hex: "#C62828", asin: "B0B337ZY41", premium: false },
  { name: "Budget Blue", brand: "Generic", hex: "#1565C0", asin: "B00YFVCS7S", premium: false },
  { name: "Budget Green", brand: "Generic", hex: "#2E7D32", asin: "B0C18VY3LL", premium: false },
  { name: "Budget Purple", brand: "Generic", hex: "#6A1B9A", asin: "B073G88D1M", premium: false },
  { name: "Budget Art", brand: "Generic", hex: "#546E7A", asin: "B0DM939C7L", premium: false, art: true },
];

const ART_SLEEVE_FALLBACK = "B0DM939C7L";

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  let h = hex.replace("#", "").trim();
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  return {
    r: parseInt(h.slice(0, 2), 16) || 0,
    g: parseInt(h.slice(2, 4), 16) || 0,
    b: parseInt(h.slice(4, 6), 16) || 0,
  };
}

function hexToHsl(hex: string): { h: number; s: number; l: number } {
  const { r, g, b } = hexToRgb(hex);
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  if (max === min) return { h: 0, s: 0, l };
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h = 0;
  if (max === rn) h = ((gn - bn) / d + (gn < bn ? 6 : 0)) / 6;
  else if (max === gn) h = ((bn - rn) / d + 2) / 6;
  else h = ((rn - gn) / d + 4) / 6;
  return { h: h * 360, s, l };
}

function hexToLab(hex: string): { L: number; a: number; b: number } {
  let { r, g, b } = hexToRgb(hex);
  r /= 255;
  g /= 255;
  b /= 255;
  r = r > 0.04045 ? ((r + 0.055) / 1.055) ** 2.4 : r / 12.92;
  g = g > 0.04045 ? ((g + 0.055) / 1.055) ** 2.4 : g / 12.92;
  b = b > 0.04045 ? ((b + 0.055) / 1.055) ** 2.4 : b / 12.92;
  let x = (r * 0.4124 + g * 0.3576 + b * 0.1805) / 0.95047;
  let y = (r * 0.2126 + g * 0.7152 + b * 0.0722) / 1.0;
  let z = (r * 0.0193 + g * 0.1192 + b * 0.9505) / 1.08883;
  x = x > 0.008856 ? x ** (1 / 3) : 7.787 * x + 16 / 116;
  y = y > 0.008856 ? y ** (1 / 3) : 7.787 * y + 16 / 116;
  z = z > 0.008856 ? z ** (1 / 3) : 7.787 * z + 16 / 116;
  return { L: 116 * y - 16, a: 500 * (x - y), b: 200 * (y - z) };
}

/** CIEDE2000 color difference — tighter perceptual match than raw Lab ΔE. */
function deltaE2000(hexA: string, hexB: string): number {
  const A = hexToLab(hexA);
  const B = hexToLab(hexB);
  const { L: L1, a: a1, b: b1 } = A;
  const { L: L2, a: a2, b: b2 } = B;

  const avgLp = (L1 + L2) / 2;
  const C1 = Math.sqrt(a1 * a1 + b1 * b1);
  const C2 = Math.sqrt(a2 * a2 + b2 * b2);
  const avgC = (C1 + C2) / 2;
  const G = 0.5 * (1 - Math.sqrt(avgC ** 7 / (avgC ** 7 + 25 ** 7)));
  const a1p = a1 * (1 + G);
  const a2p = a2 * (1 + G);
  const C1p = Math.sqrt(a1p * a1p + b1 * b1);
  const C2p = Math.sqrt(a2p * a2p + b2 * b2);
  const avgCp = (C1p + C2p) / 2;

  const h1p = (Math.atan2(b1, a1p) * 180) / Math.PI + (Math.atan2(b1, a1p) < 0 ? 360 : 0);
  const h2p = (Math.atan2(b2, a2p) * 180) / Math.PI + (Math.atan2(b2, a2p) < 0 ? 360 : 0);

  let dLp = L2 - L1;
  let dCp = C2p - C1p;
  let dhp = 0;
  if (C1p * C2p !== 0) {
    dhp = h2p - h1p;
    if (dhp > 180) dhp -= 360;
    else if (dhp < -180) dhp += 360;
  }
  const dHp = 2 * Math.sqrt(C1p * C2p) * Math.sin((dhp * Math.PI) / 360);

  let avgHp = h1p + h2p;
  if (C1p * C2p !== 0) {
    if (Math.abs(h1p - h2p) > 180) avgHp += 360;
    avgHp /= 2;
    if (Math.abs(h1p - h2p) > 180) avgHp -= 180;
  } else {
    avgHp /= 2;
  }

  const T =
    1 -
    0.17 * Math.cos(((avgHp - 30) * Math.PI) / 180) +
    0.24 * Math.cos((2 * avgHp * Math.PI) / 180) +
    0.32 * Math.cos(((3 * avgHp + 6) * Math.PI) / 180) -
    0.2 * Math.cos(((4 * avgHp - 63) * Math.PI) / 180);

  const SL = 1 + (0.015 * (avgLp - 50) ** 2) / Math.sqrt(20 + (avgLp - 50) ** 2);
  const SC = 1 + 0.045 * avgCp;
  const SH = 1 + 0.015 * avgCp * T;
  const dRo = 30 * Math.exp(-(((avgHp - 275) / 25) ** 2));
  const RC = 2 * Math.sqrt(avgCp ** 7 / (avgCp ** 7 + 25 ** 7));
  const RT = -RC * Math.sin((2 * dRo * Math.PI) / 180);

  return Math.sqrt((dLp / SL) ** 2 + (dCp / SC) ** 2 + (dHp / SH) ** 2 + RT * (dCp / SC) * (dHp / SH));
}

function colorDistance(a: string, b: string): number {
  return deltaE2000(a, b);
}

/** Extra penalty when saturated hues disagree (stops teal beating green, etc.). */
function hueMismatchPenalty(target: string, candidate: string): number {
  const t = hexToHsl(target);
  const c = hexToHsl(candidate);
  if (t.s < 0.18 || c.s < 0.18) {
    // Near-neutrals: lightness mismatch matters more
    return Math.abs(t.l - c.l) * 48;
  }
  let dh = Math.abs(t.h - c.h);
  if (dh > 180) dh = 360 - dh;
  // Stronger hue gate: ~15° free, then steep climb so wrong families lose
  if (dh < 12) return dh * 0.4;
  if (dh < 28) return 6 + (dh - 12) * 2.2;
  if (dh < 50) return 42 + (dh - 28) * 2.8;
  return 105 + (dh - 50) * 2.2;
}

/** Perceptual distance used for catalog ranking (ΔE2000 + hue gate). */
function perceptualColorCost(target: string, candidate: string): number {
  return colorDistance(target, candidate) * 4 + hueMismatchPenalty(target, candidate);
}

/**
 * Map hex → sleeve color names. Primary is the nearest matte catalog color
 * (CIEDE2000 + hue penalty); optional 2nd/3rd names are close runners-up in-family.
 */
export function colorNamesFromHex(hex: string): string[] {
  const matte = SLEEVE_CATALOG.filter((e) => !e.art && !e.name.startsWith("Budget"));
  const ranked = matte
    .map((e) => ({ name: e.name, cost: perceptualColorCost(hex, e.hex), hex: e.hex }))
    .sort((a, b) => a.cost - b.cost);

  if (!ranked.length) return ["Black"];

  const primary = ranked[0];
  const names = [primary.name];
  const primaryHsl = hexToHsl(primary.hex);

  for (const cand of ranked.slice(1)) {
    if (names.length >= 3) break;
    // Only add a runner-up if it's still close and not a wild hue jump
    if (cand.cost > primary.cost + 55) break;
    const dh = (() => {
      let d = Math.abs(hexToHsl(cand.hex).h - primaryHsl.h);
      if (d > 180) d = 360 - d;
      return d;
    })();
    const bothNeutral = hexToHsl(cand.hex).s < 0.15 && primaryHsl.s < 0.15;
    if (!bothNeutral && dh > 38) continue;
    if (!names.includes(cand.name)) names.push(cand.name);
  }

  return names;
}

export function hexToHueName(hex: string): HueName {
  const { h, s, l } = hexToHsl(hex);
  if (l < 0.12) return "black";
  if (l > 0.9 && s < 0.15) return "white";
  if (s < 0.12) return l < 0.45 ? "gray" : "white";
  if (h < 15 || h >= 345) return "red";
  if (h < 40) return "orange";
  if (h < 70) return "yellow";
  if (h < 150) return "green";
  if (h < 190) return "teal";
  if (h < 255) return "blue";
  if (h < 295) return "purple";
  if (h < 335) return "pink";
  return "red";
}

function isPremiumBrand(text: string): boolean {
  const t = text.toLowerCase();
  return PREMIUM_SLEEVE_BRANDS.some((b) => t.includes(b));
}

function nameMatchScore(title: string, colorNames: string[]): number {
  const t = title.toLowerCase();
  let best = 0;
  for (const name of colorNames) {
    const n = name.toLowerCase();
    if (t.includes(n)) best = Math.max(best, 50 + n.length * 2);
    else {
      const parts = n.split(/\s+/);
      if (parts.every((p) => t.includes(p))) best = Math.max(best, 32);
    }
  }
  return best;
}

type ScoredSleeve = {
  title: string;
  asin: string;
  url: string;
  matchHex: string;
  colorName: string;
  score: number;
  source: "catalog" | "amazon";
};

function scoreCatalogEntry(
  entry: SleeveCatalogEntry,
  hex: string,
  colorNames: string[],
  premium: boolean,
  art: "any" | "art" | "basic",
): ScoredSleeve {
  const dE = colorDistance(hex, entry.hex);
  const huePen = hueMismatchPenalty(hex, entry.hex);
  // Color accuracy dominates (~0–220). ΔE≈0 → ~220; wrong hue collapses fast
  let score = 220 - dE * 4 - huePen;

  score += nameMatchScore(`${entry.brand} ${entry.name}`, colorNames);

  // Soft premium preference — must not overturn a clearly better color (±8–12 vs hue swings of 40+)
  const entryPremium = Boolean(entry.premium || isPremiumBrand(entry.brand));
  if (premium) {
    if (entryPremium) score += 10;
    else score -= 4;
  } else {
    if (!entryPremium) score += 10;
    else score -= 5;
  }

  // Soft art preference — never hard-filter; keep well below a solid hue win
  if (art === "art") score += entry.art ? 36 : -18;
  else if (art === "basic") score += entry.art ? -30 : 16;

  const displayTitle = entry.art
    ? `${entry.brand}: ${entry.name} (Art / dual art)`
    : premium || entryPremium
      ? `${entry.brand}: ${entry.name} Matte`
      : `Matte card sleeves: ${entry.name}`;

  return {
    title: displayTitle,
    asin: entry.asin,
    url: amazonProductUrl(entry.asin),
    matchHex: entry.hex,
    colorName: entry.name,
    score,
    source: "catalog",
  };
}

function parseAmazonSearchHtml(html: string): { title: string; asin: string }[] {
  const found = new Map<string, string>();
  const asinRe = /data-asin="([A-Z0-9]{10})"/gi;
  let m: RegExpExecArray | null;
  while ((m = asinRe.exec(html)) !== null) {
    const asin = m[1];
    if (found.has(asin)) continue;
    // Look nearby for a title
    const slice = html.slice(Math.max(0, m.index - 200), m.index + 1200);
    const titleMatch =
      slice.match(/aria-label="([^"]{8,160})"/i) ||
      slice.match(/<span[^>]*class="[^"]*a-text-normal[^"]*"[^>]*>([^<]{8,160})<\/span>/i) ||
      slice.match(/alt="([^"]{8,160})"/i);
    const title = titleMatch?.[1]?.replace(/&amp;/g, "&").replace(/&#39;/g, "'").trim();
    if (title && /sleeve/i.test(title)) found.set(asin, title);
    else if (title) found.set(asin, title);
  }

  // Also catch /dp/ASIN links with titles
  const dpRe = /\/dp\/([A-Z0-9]{10})/gi;
  while ((m = dpRe.exec(html)) !== null) {
    if (found.has(m[1])) continue;
    const slice = html.slice(Math.max(0, m.index - 400), m.index + 200);
    const titleMatch = slice.match(/alt="([^"]{8,160})"/i);
    if (titleMatch) found.set(m[1], titleMatch[1].replace(/&amp;/g, "&").trim());
  }

  return [...found.entries()].slice(0, 24).map(([asin, title]) => ({ asin, title }));
}

async function fetchViaCorsProxy(url: string): Promise<string | null> {
  const proxies = [
    `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`,
    `https://corsproxy.io/?${encodeURIComponent(url)}`,
  ];
  for (const proxy of proxies) {
    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 6000);
      const res = await fetch(proxy, { signal: ctrl.signal });
      clearTimeout(timer);
      if (!res.ok) continue;
      const text = await res.text();
      if (text && text.length > 500) return text;
    } catch {
      /* try next proxy */
    }
  }
  return null;
}

async function searchAmazonSleeves(
  hex: string,
  colorNames: string[],
  premium: boolean,
  art: "any" | "art" | "basic",
): Promise<ScoredSleeve[]> {
  const primary = colorNames[0] ?? "black";
  const secondary = colorNames[1] ?? primary;
  const queries: string[] = [];

  if (art === "art") {
    if (premium) {
      queries.push(`Dragon Shield dual art sleeves ${primary}`);
      queries.push(`Dragon Shield art sleeves ${primary}`);
      queries.push(`Ultimate Guard art sleeves ${primary}`);
    } else {
      queries.push(`art card sleeves ${primary} dual`);
      queries.push(`illustrated card sleeves ${primary}`);
    }
  } else if (art === "basic") {
    if (premium) {
      queries.push(`Dragon Shield Matte ${primary}`);
      queries.push(`Ultimate Guard Supreme ${primary} matte sleeves`);
    } else {
      queries.push(`matte card sleeves ${primary} solid color`);
      queries.push(`budget matte card sleeves ${primary}`);
    }
  } else if (premium) {
    queries.push(`Dragon Shield Matte ${primary}`);
    queries.push(`Ultimate Guard Supreme ${primary} sleeves`);
  } else {
    queries.push(`card sleeves ${primary} matte`);
    queries.push(`budget card sleeves ${primary}`);
  }

  queries.push(
    art === "art"
      ? `Dragon Shield art ${secondary}`
      : `Dragon Shield Matte ${secondary}`,
  );

  const scored: ScoredSleeve[] = [];
  const seen = new Set<string>();

  // Limit live fetches to keep latency reasonable
  for (const q of queries.slice(0, 2)) {
    const html = await fetchViaCorsProxy(amazonSearchUrl(q));
    if (!html) continue;
    for (const hit of parseAmazonSearchHtml(html)) {
      if (seen.has(hit.asin)) continue;
      seen.add(hit.asin);
      const titleLower = hit.title.toLowerCase();
      if (!/sleeve|dragon shield|ultimate guard|katana|gamegenic/.test(titleLower)) continue;

      let score = 30 + nameMatchScore(hit.title, colorNames);
      // Modest brand preference
      if (premium && isPremiumBrand(hit.title)) score += 12;
      else if (premium && !isPremiumBrand(hit.title)) score -= 4;
      else if (!premium && !isPremiumBrand(hit.title)) score += 10;
      else if (!premium && isPremiumBrand(hit.title)) score -= 4;

      const looksArt = /art|dual art|illustrated|artwork/.test(titleLower);
      const looksMatte = /matte|solid|opaque/.test(titleLower);
      if (art === "art") {
        if (looksArt) score += 36;
        else score -= 18;
      } else if (art === "basic") {
        if (looksArt) score -= 28;
        else if (looksMatte) score += 14;
      } else if (looksMatte) {
        score += 6;
      }

      // Infer color from title → catalog; penalize hue drift from the user's pick
      const catalogHit =
        SLEEVE_CATALOG.find((e) =>
          colorNames.some((n) => e.name.toLowerCase() === n.toLowerCase() && Boolean(e.art) === looksArt),
        ) ??
        SLEEVE_CATALOG.find((e) => colorNames.some((n) => e.name.toLowerCase() === n.toLowerCase())) ??
        SLEEVE_CATALOG.find((e) => titleLower.includes(e.name.toLowerCase()) && !e.art);

      const matchHex = catalogHit?.hex ?? "#888888";
      score -= perceptualColorCost(hex, matchHex) * 0.45;

      scored.push({
        title: hit.title,
        asin: hit.asin,
        url: amazonProductUrl(hit.asin),
        matchHex,
        colorName: catalogHit?.name ?? primary,
        score,
        source: "amazon",
      });
    }
  }

  return scored;
}

export type SleeveMatchResult = {
  colorNames: string[];
  colorName: string;
  title: string;
  asin: string;
  url: string;
  matchHex: string;
  hue: HueName;
  source: "catalog" | "amazon";
  candidates?: Array<{ title: string; score: number; source: string }>;
};

export type SleeveMatchStage = "naming" | "catalog" | "amazon" | "done";

export type SleeveMatchProgress = (stage: SleeveMatchStage, label: string) => void;

/**
 * Match a picked color to sleeve products:
 * 1) Derive color-name candidates from HSL
 * 2) Score curated catalog (CIEDE2000 + hue penalty + soft premium/art prefs)
 * 3) Optionally enrich via Amazon search through a CORS proxy
 */
export async function matchSleeveColor(
  hex: string,
  premium: boolean,
  art: "any" | "art" | "basic" = "any",
  onProgress?: SleeveMatchProgress,
): Promise<SleeveMatchResult> {
  onProgress?.("naming", "Naming color…");
  const colorNames = colorNamesFromHex(hex);
  const hue = hexToHueName(hex);

  onProgress?.("catalog", "Scoring sleeve catalog…");
  // Score full catalog: art/basic/premium are soft preferences, not hard filters
  const catalogScored = SLEEVE_CATALOG.map((e) =>
    scoreCatalogEntry(e, hex, colorNames, premium, art),
  );

  onProgress?.("amazon", "Checking Amazon…");
  let amazonScored: ScoredSleeve[] = [];
  try {
    amazonScored = await searchAmazonSleeves(hex, colorNames, premium, art);
  } catch {
    amazonScored = [];
  }

  const bestCatalog = [...catalogScored].sort((a, b) => b.score - a.score)[0];
  const bestAmazon = [...amazonScored].sort((a, b) => b.score - a.score)[0];

  // Prefer opening the best catalog color match. Amazon may only win when it
  // clearly beats catalog AND stays within a reasonable hue of the pick.
  let best = bestCatalog;
  if (bestAmazon && bestCatalog) {
    const amazonHueCost = perceptualColorCost(hex, bestAmazon.matchHex);
    const catalogHueCost = perceptualColorCost(hex, bestCatalog.matchHex);
    const amazonHueOk = amazonHueCost <= catalogHueCost + 28;
    if (amazonHueOk && bestAmazon.score >= bestCatalog.score + 35) {
      best = bestAmazon;
    }
  } else if (bestAmazon && !bestCatalog) {
    best = bestAmazon;
  }

  const all = [...catalogScored, ...amazonScored].sort((a, b) => b.score - a.score);

  if (!best) {
    const fallback =
      (art === "art" ? SLEEVE_CATALOG.find((e) => e.art) : undefined) ?? SLEEVE_CATALOG[0];
    best = {
      title: `${fallback.brand}: ${fallback.name}`,
      asin: art === "art" ? ART_SLEEVE_FALLBACK : fallback.asin,
      url: amazonProductUrl(art === "art" ? ART_SLEEVE_FALLBACK : fallback.asin),
      matchHex: fallback.hex,
      colorName: fallback.name,
      score: 0,
      source: "catalog",
    };
  }

  onProgress?.("done", "Match ready");

  return {
    colorNames,
    colorName: best.colorName,
    title: best.title,
    asin: best.asin,
    url: best.url,
    matchHex: best.matchHex,
    hue,
    source: best.source,
    candidates: all.slice(0, 5).map((c) => ({ title: c.title, score: Math.round(c.score), source: c.source })),
  };
}

/** @deprecated Prefer matchSleeveColor — kept for sync callers */
export function sleeveQueryFor(
  hex: string,
  premium: boolean,
  art: "any" | "art" | "basic",
): {
  hue: HueName;
  colorName: string;
  title: string;
  asin: string;
  url: string;
  matchHex: string;
} {
  const colorNames = colorNamesFromHex(hex);
  const hue = hexToHueName(hex);
  const ranked = SLEEVE_CATALOG.map((e) => scoreCatalogEntry(e, hex, colorNames, premium, art)).sort(
    (a, b) => b.score - a.score,
  );
  const best = ranked[0] ?? {
    title: premium ? "Dragon Shield Matte: Black" : "Matte card sleeves: Black",
    asin: "B00WX57O7M",
    url: amazonProductUrl("B00WX57O7M"),
    matchHex: "#212121",
    colorName: "Black",
    score: 0,
    source: "catalog" as const,
  };
  return {
    hue,
    colorName: best.colorName,
    title: best.title,
    asin: best.asin,
    url: best.url,
    matchHex: best.matchHex,
  };
}

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

export type PlaystyleId =
  | "aggro"
  | "control"
  | "tokens"
  | "bigCreatures"
  | "spellslinger"
  | "lifegain";

export type BeginnerPrecon = {
  name: string;
  commander: string;
  description: string;
  styles: PlaystyleId[];
  /** Product-line year. Used with `recency` for selection bias. */
  year: number;
  /**
   * Availability / freshness 1–10. Newer openly stocked retail decks score higher;
   * older hard-to-find precons score low so they appear less often.
   */
  recency: number;
  /** Amazon product ASIN when known; otherwise search by name. */
  asin?: string;
  searchQuery?: string;
};

/**
 * Beginner precon catalog: recent Commander decks (2024–2026) plus a few
 * still-buyable older staples. Selection weights by `recency` so newer stock wins.
 * Style tags are conservative — only attach playstyles the deck clearly supports.
 */
const BEGINNER_PRECONS: BeginnerPrecon[] = [
  // —— Older but still buyable (low recency) ——
  {
    name: "Party Time",
    commander: "Nalia de'Arnise",
    description: "Assemble a party of creatures and attack together. Fast, social, and easy to pilot.",
    styles: ["aggro", "tokens"],
    year: 2022,
    recency: 2,
    asin: "B09VB4KP78",
  },
  {
    name: "Exit from Exile",
    commander: "Faldorn, Dread Wolf Herald",
    description: "Ramp, exile, then smash with giant threats and wolves. Big and satisfying.",
    styles: ["bigCreatures", "aggro"],
    year: 2022,
    recency: 2,
    asin: "B09VBGNJ7B",
  },
  {
    name: "Mind Flayarrrs",
    commander: "Captain N'ghathrod",
    description: "Mill opponents and steal their best creatures. Teaches timing and answers.",
    styles: ["control"],
    year: 2022,
    recency: 2,
    asin: "B09VB9MX16",
  },
  {
    name: "Draconic Dissent",
    commander: "Firkraag, Cunning Instigator",
    description: "Dragons and goads: play huge flyers and push others into fighting.",
    styles: ["bigCreatures", "aggro"],
    year: 2022,
    recency: 2,
    asin: "B09VB48C59",
  },
  {
    name: "Virtue and Valor",
    commander: "Ellivere of the Wild Court",
    description: "Grow a board of enchanted creatures and tokens. Fun boards without complex rules.",
    styles: ["tokens", "aggro"],
    year: 2023,
    recency: 4,
    asin: "B0C3SR4GVH",
  },
  {
    name: "Fae Dominion",
    commander: "Tegwyll, Duke of Splendor",
    description: "Faerie tricks and reactive spells. Great if you like clever plays.",
    styles: ["control", "spellslinger"],
    year: 2023,
    recency: 4,
    asin: "B0C3SYGRFT",
  },

  // —— Outlaws of Thunder Junction (2024) ——
  {
    name: "Most Wanted",
    commander: "Olivia, Opulent Outlaw",
    description: "Outlaws, treasure, and aggression: flashy combat with easy treasure payoffs.",
    styles: ["aggro", "tokens"],
    year: 2024,
    recency: 5,
    searchQuery: "MTG Commander Most Wanted precon Olivia Outlaws of Thunder Junction",
  },
  {
    name: "Desert Bloom",
    commander: "Yuma, Proud Protector",
    description: "Sacrifice lands for cards and Plant tokens, then grow a stubborn board.",
    styles: ["tokens", "bigCreatures"],
    year: 2024,
    recency: 5,
    searchQuery: "MTG Commander Desert Bloom precon Yuma Outlaws of Thunder Junction",
  },
  {
    name: "Quick Draw",
    commander: "Stella Lee, Wild Card",
    description: "Cast multiple spells in a turn and copy the clever ones. Pure spellslinger fun.",
    styles: ["spellslinger"],
    year: 2024,
    recency: 5,
    searchQuery: "MTG Commander Quick Draw precon Stella Lee Outlaws of Thunder Junction",
  },
  {
    name: "Grand Larceny",
    commander: "Gonti, Canny Acquisitor",
    description: "Steal cards from opponents and cast their best spells. Cheeky control energy.",
    styles: ["control", "spellslinger"],
    year: 2024,
    recency: 5,
    searchQuery: "MTG Commander Grand Larceny precon Gonti Outlaws of Thunder Junction",
  },

  // —— Bloomburrow (2024) ——
  {
    name: "Peace Offering",
    commander: "Ms. Bumbleflower",
    description: "Group-hug gifts that still win: great first precon if you like politics and tokens.",
    styles: ["tokens", "lifegain"],
    year: 2024,
    recency: 6,
    searchQuery: "MTG Commander Peace Offering precon Bloomburrow Bumbleflower",
  },
  {
    name: "Animated Army",
    commander: "Bello, Bard of the Brambles",
    description: "Turn artifacts and enchantments into hasty beaters. Aggressive and easy to follow.",
    styles: ["aggro", "bigCreatures"],
    year: 2024,
    recency: 6,
    searchQuery: "MTG Commander Animated Army precon Bloomburrow Bello",
  },
  {
    name: "Family Matters",
    commander: "Zinnia, Valley's Voice",
    description: "Offspring tokens and go-wide boards: friendly creature strategy for new players.",
    styles: ["tokens", "aggro"],
    year: 2024,
    recency: 6,
    searchQuery: "MTG Commander Family Matters precon Bloomburrow Zinnia",
  },
  {
    name: "Squirreled Away",
    commander: "Hazel of the Rootbloom",
    description: "Make squirrel tokens, tap them for mana, and snowball a go-wide army.",
    styles: ["tokens", "aggro"],
    year: 2024,
    recency: 6,
    searchQuery: "MTG Commander Squirreled Away precon Bloomburrow Hazel",
  },

  // —— Duskmourn (2024) ——
  {
    name: "Endless Punishment",
    commander: "Valgavoth, Harrower of Souls",
    description: "Drain life, grow your demon, and draw cards whenever opponents lose life.",
    styles: ["control", "aggro"],
    year: 2024,
    recency: 6,
    searchQuery: "MTG Commander Endless Punishment precon Duskmourn Valgavoth",
  },
  {
    name: "Miracle Worker",
    commander: "Aminatou, Veil Piercer",
    description: "Surveil into cheap miracle enchantments. Grindy Esper value for patient pilots.",
    styles: ["control", "spellslinger"],
    year: 2024,
    recency: 6,
    searchQuery: "MTG Commander Miracle Worker precon Duskmourn Aminatou",
  },
  {
    name: "Jump Scare!",
    commander: "Zimone, Mystery Unraveler",
    description: "Manifest face-down creatures, then flip them into huge threats.",
    styles: ["bigCreatures", "control"],
    year: 2024,
    recency: 6,
    searchQuery: "MTG Commander Jump Scare precon Duskmourn Zimone",
  },
  {
    name: "Death Toll",
    commander: "Winter, Cynical Opportunist",
    description: "Fill the graveyard with card types, then reanimate and grind out value.",
    styles: ["control", "bigCreatures"],
    year: 2024,
    recency: 6,
    searchQuery: "MTG Commander Death Toll precon Duskmourn Winter",
  },

  // —— Aetherdrift (2025) ——
  {
    name: "Living Energy",
    commander: "Saheeli, Radiant Creator",
    description: "Artifacts and Energy: build machines, spend Energy, then race ahead.",
    styles: ["tokens", "aggro"],
    year: 2025,
    recency: 7,
    searchQuery: "MTG Commander Living Energy precon Aetherdrift Saheeli",
  },
  {
    name: "Eternal Might",
    commander: "Temmet, Naktamun's Will",
    description: "Zombies that get bigger every time you draw. Classic grind with modern packaging.",
    styles: ["control", "tokens", "bigCreatures"],
    year: 2025,
    recency: 7,
    searchQuery: "MTG Commander Eternal Might precon Aetherdrift Temmet",
  },

  // —— Tarkir: Dragonstorm (2025) ——
  {
    name: "Temur Roar",
    commander: "Ureni of the Unwritten",
    description: "Ramp into dragons and cheat huge flyers onto the battlefield.",
    styles: ["bigCreatures", "aggro"],
    year: 2025,
    recency: 8,
    searchQuery: "MTG Commander Temur Roar precon Tarkir Dragonstorm Ureni",
  },
  {
    name: "Mardu Surge",
    commander: "Zurgo Stormrender",
    description: "Tokens and combat tricks: aggressive Mardu that rewards attacking often.",
    styles: ["aggro", "tokens"],
    year: 2025,
    recency: 8,
    searchQuery: "MTG Commander Mardu Surge precon Tarkir Dragonstorm Zurgo",
  },
  {
    name: "Abzan Armor",
    commander: "Felothar the Steadfast",
    description: "Toughness-matters walls that attack. Defensive board that still hits hard.",
    styles: ["control", "bigCreatures", "lifegain"],
    year: 2025,
    recency: 8,
    searchQuery: "MTG Commander Abzan Armor precon Tarkir Dragonstorm Felothar",
  },
  {
    name: "Sultai Arisen",
    commander: "Teval, the Balanced Scale",
    description: "Mill, recur from the graveyard, and grow a resilient Sultai value engine.",
    styles: ["control", "bigCreatures"],
    year: 2025,
    recency: 8,
    searchQuery: "MTG Commander Sultai Arisen precon Tarkir Dragonstorm Teval",
  },
  {
    name: "Jeskai Striker",
    commander: "Shiko and Narset, Unified",
    description: "Instants, sorceries, and prowess-style combat. Spellslinger with a punch.",
    styles: ["spellslinger", "aggro"],
    year: 2025,
    recency: 8,
    searchQuery: "MTG Commander Jeskai Striker precon Tarkir Dragonstorm Shiko Narset",
  },

  // —— Final Fantasy (2025) ——
  {
    name: "Limit Break",
    commander: "Cloud, Ex-SOLDIER",
    description: "Suit up heroes with Equipment and swing as a legendary squad.",
    styles: ["aggro", "bigCreatures"],
    year: 2025,
    recency: 8,
    searchQuery: "MTG Final Fantasy Commander Limit Break precon Cloud",
  },
  {
    name: "Counter Blitz",
    commander: "Tidus, Yuna's Guardian",
    description: "Stack +1/+1 counters, proliferate, and grow a Bant beatdown team.",
    styles: ["aggro", "lifegain"],
    year: 2025,
    recency: 8,
    searchQuery: "MTG Final Fantasy Commander Counter Blitz precon Tidus",
  },
  {
    name: "Scions & Spellcraft",
    commander: "Y'shtola, Night's Blessed",
    description: "Noncreature spells that gain life, deal damage, and grind Esper advantage.",
    styles: ["spellslinger", "control", "lifegain"],
    year: 2025,
    recency: 8,
    searchQuery: "MTG Final Fantasy Commander Scions and Spellcraft precon Y'shtola",
  },
  {
    name: "Revival Trance",
    commander: "Terra, Herald of Hope",
    description: "Mill into the graveyard, then reanimate small creatures and keep attacking.",
    styles: ["aggro", "control"],
    year: 2025,
    recency: 8,
    searchQuery: "MTG Final Fantasy Commander Revival Trance precon Terra",
  },

  // —— Edge of Eternities (2025) ——
  {
    name: "World Shaper",
    commander: "Hearthhull, the Worldseed",
    description: "Lands-matter value: ramp, sacrifice, and rebuild into bigger threats.",
    styles: ["bigCreatures", "control"],
    year: 2025,
    recency: 9,
    searchQuery: "MTG Commander World Shaper precon Edge of Eternities",
  },
  {
    name: "Counter Intelligence",
    commander: "Kilo, Apogee Mind",
    description: "Proliferate and counters: a modern Jeskai engine still common on Amazon.",
    styles: ["spellslinger", "control"],
    year: 2025,
    recency: 9,
    searchQuery: "MTG Commander Counter Intelligence precon Edge of Eternities",
  },

  // —— Lorwyn Eclipsed (2026) ——
  {
    name: "Dance of the Elements",
    commander: "Ashling, the Limitless",
    description: "Five-color Elementals with Evoke: cheat big enters and swing typal style.",
    styles: ["bigCreatures", "aggro", "spellslinger"],
    year: 2026,
    recency: 9,
    searchQuery: "MTG Commander Dance of the Elements precon Lorwyn Eclipsed",
  },
  {
    name: "Blight Curse",
    commander: "Auntie Ool, Cursewretch",
    description: "-1/-1 counters and attrition: a grindier Lorwyn Eclipsed precon.",
    styles: ["control"],
    year: 2026,
    recency: 9,
    searchQuery: "MTG Commander Blight Curse precon Lorwyn Eclipsed",
  },

  // —— Teenage Mutant Ninja Turtles (2026) ——
  {
    name: "Turtle Power!",
    commander: "Leonardo, the Balance",
    description: "Five-color Turtles with partner options: counters, tokens, and teamwork.",
    styles: ["aggro", "tokens", "lifegain"],
    year: 2026,
    recency: 10,
    searchQuery: "MTG Commander Turtle Power precon Teenage Mutant Ninja Turtles Leonardo",
  },

  // —— Secrets of Strixhaven (2026) ——
  {
    name: "Silverquill Influence",
    commander: "Killian, Decisive Mentor",
    description: "Politics, goad, and Auras: talk your way into wins while building a board.",
    styles: ["control", "aggro"],
    year: 2026,
    recency: 10,
    searchQuery: "MTG Commander Silverquill Influence precon Secrets of Strixhaven Killian",
  },
  {
    name: "Prismari Artistry",
    commander: "Rootha, Mastering the Moment",
    description: "Big instants and sorceries that paint the board. Classic spellslinger flair.",
    styles: ["spellslinger", "aggro"],
    year: 2026,
    recency: 10,
    searchQuery: "MTG Commander Prismari Artistry precon Secrets of Strixhaven Rootha",
  },
  {
    name: "Witherbloom Pestilence",
    commander: "Dina, Essence Brewer",
    description: "Sacrifice creatures, gain life, and drain the table. Aristocrats made simple.",
    styles: ["lifegain", "tokens", "control"],
    year: 2026,
    recency: 10,
    searchQuery: "MTG Commander Witherbloom Pestilence precon Secrets of Strixhaven Dina",
  },
  {
    name: "Lorehold Spirit",
    commander: "Quintorius, History Chaser",
    description: "Graveyard Spirits and tokens: dig up the past and swing with history.",
    styles: ["tokens", "aggro"],
    year: 2026,
    recency: 10,
    searchQuery: "MTG Commander Lorehold Spirit precon Secrets of Strixhaven Quintorius",
  },
  {
    name: "Quandrix Unlimited",
    commander: "Zimone, Infinite Analyst",
    description: "+1/+1 counters and X-spells: grow creatures with math-magic Simic toys.",
    styles: ["bigCreatures", "spellslinger", "tokens"],
    year: 2026,
    recency: 10,
    searchQuery: "MTG Commander Quandrix Unlimited precon Secrets of Strixhaven Zimone",
  },

  // —— Marvel Super Heroes (2026) ——
  {
    name: "Avengers Assemble",
    commander: "Captain America, Team Leader",
    description: "Heroes, Equipment, and +1/+1 counters: rally a squad and attack together.",
    styles: ["aggro", "tokens", "lifegain"],
    year: 2026,
    recency: 10,
    searchQuery: "MTG Marvel Super Heroes Commander Avengers Assemble Captain America",
  },
  {
    name: "The Fantastic Four",
    commander: "Mister Fantastic",
    description: "Cast noncreature spells, then copy triggers as Marvel's First Family.",
    styles: ["spellslinger", "control"],
    year: 2026,
    recency: 10,
    searchQuery: "MTG Marvel Super Heroes Commander The Fantastic Four Mister Fantastic",
  },
  {
    name: "Wakanda Forever",
    commander: "T'Challa, the Black Panther",
    description: "Artifacts, tokens, and monarch value: steady Selesnya advantage.",
    styles: ["tokens", "lifegain", "control"],
    year: 2026,
    recency: 10,
    searchQuery: "MTG Marvel Super Heroes Commander Wakanda Forever T'Challa",
  },
  {
    name: "Doom Prevails",
    commander: "Doctor Doom, King of Latveria",
    description: "Villains, discard, and life drain: a sneaky Grixis control grind.",
    styles: ["control", "spellslinger"],
    year: 2026,
    recency: 10,
    searchQuery: "MTG Marvel Super Heroes Commander Doom Prevails Doctor Doom",
  },
];

/** Closest alternate styles when the primary pool is thin. */
const PLAYSTYLE_NEIGHBORS: Record<PlaystyleId, PlaystyleId[]> = {
  aggro: ["tokens", "bigCreatures"],
  control: ["spellslinger", "lifegain"],
  tokens: ["aggro", "lifegain"],
  bigCreatures: ["aggro", "tokens"],
  spellslinger: ["control", "aggro"],
  lifegain: ["tokens", "control"],
};

function weightedPickPrecon(pool: BeginnerPrecon[]): BeginnerPrecon {
  // Square recency so newer stock dominates when styles match.
  const weights = pool.map((p) => Math.max(1, p.recency) ** 2);
  const total = weights.reduce((sum, w) => sum + w, 0);
  let roll = Math.random() * total;
  for (let i = 0; i < pool.length; i++) {
    roll -= weights[i];
    if (roll <= 0) return pool[i];
  }
  return pool[pool.length - 1];
}

function poolForStyle(style: PlaystyleId, avoidName?: string): BeginnerPrecon[] {
  let pool = BEGINNER_PRECONS.filter((p) => p.styles.includes(style));
  if (avoidName) {
    const filtered = pool.filter((p) => p.name !== avoidName);
    if (filtered.length) pool = filtered;
  }
  return pool;
}

export function pickBeginnerPrecon(
  style: PlaystyleId,
  opts?: { avoidName?: string },
): BeginnerPrecon {
  // 1) Exact style matches (prefer a healthy pool of recent decks)
  let pool = poolForStyle(style, opts?.avoidName);

  // 2) Sparse / empty → expand to neighbor styles (still thematic, not random)
  if (pool.length < 3) {
    const seen = new Set(pool.map((p) => p.name));
    for (const neighbor of PLAYSTYLE_NEIGHBORS[style] ?? []) {
      for (const p of poolForStyle(neighbor, opts?.avoidName)) {
        if (!seen.has(p.name)) {
          seen.add(p.name);
          pool.push(p);
        }
      }
      if (pool.length >= 5) break;
    }
  }

  // 3) Last resort: full catalog (should be rare)
  if (!pool.length) {
    pool = opts?.avoidName
      ? BEGINNER_PRECONS.filter((p) => p.name !== opts.avoidName)
      : [...BEGINNER_PRECONS];
    if (!pool.length) pool = [...BEGINNER_PRECONS];
  }

  return weightedPickPrecon(pool);
}

export function beginnerPreconUrl(precon: BeginnerPrecon): string {
  if (precon.asin) return amazonProductUrl(precon.asin);
  return amazonSearchUrl(
    precon.searchQuery ?? `MTG Commander ${precon.name} precon deck`,
  );
}

/** Gear types for the beginner Get step — labels only, no product links. */
export function beginnerSupplyTypes(): string[] {
  return ["Deck box", "D6 dice", "Spindown D20", "Card sleeves"];
}
