/** Color science + naming helpers for sleeve matching. */

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

/** Coarse hue families used to block cross-family sleeve wins (navy≠purple). */
export type HueFamily =
  | "red"
  | "orange"
  | "yellow"
  | "green"
  | "teal"
  | "blue"
  | "purple"
  | "pink"
  | "brown"
  | "neutral";

/** Tight synonyms accepted in Amazon titles for a given winning color name. */
const COLOR_SYNONYMS: Record<string, string[]> = {
  "blood red": ["blood red", "blood"],
  ruby: ["ruby"],
  crimson: ["crimson"],
  red: ["red"],
  ember: ["ember"],
  orange: ["orange"],
  copper: ["copper"],
  amber: ["amber"],
  yellow: ["yellow"],
  gold: ["gold"],
  lime: ["lime"],
  "apple green": ["apple green", "apple"],
  green: ["green"],
  "forest green": ["forest green", "forest"],
  forest: ["forest", "forest green"],
  jade: ["jade"],
  emerald: ["emerald"],
  mint: ["mint"],
  petrol: ["petrol"],
  turquoise: ["turquoise"],
  teal: ["teal"],
  amazonite: ["amazonite"],
  "sky blue": ["sky blue", "sky"],
  blue: ["blue"],
  sapphire: ["sapphire"],
  "night blue": ["night blue", "nightblue"],
  "midnight blue": ["midnight blue", "midnight"],
  navy: ["navy"],
  purple: ["purple", "amethyst", "violet", "nebula"],
  amethyst: ["amethyst", "purple", "violet"],
  violet: ["violet", "purple", "amethyst"],
  nebula: ["nebula", "purple", "violet"],
  magenta: ["magenta"],
  pink: ["pink"],
  "pink diamond": ["pink diamond"],
  "pink sapphire": ["pink sapphire"],
  rose: ["rose"],
  black: ["black"],
  jet: ["jet"],
  silver: ["silver"],
  gray: ["gray", "grey"],
  white: ["white"],
  ivory: ["ivory"],
  clear: ["clear", "transparent"],
};

/** Conflicting color words that disqualify an Amazon title for a given family. */
const FAMILY_CONFLICT_WORDS: Record<HueFamily, string[]> = {
  red: ["blue", "navy", "green", "purple", "violet", "teal", "pink", "yellow", "orange", "gray", "grey", "silver"],
  orange: ["blue", "navy", "green", "purple", "pink", "teal", "gray", "grey", "silver"],
  yellow: ["blue", "navy", "purple", "pink", "red", "green", "gray", "grey", "silver"],
  green: ["blue", "navy", "purple", "pink", "red", "magenta", "violet", "gray", "grey", "silver"],
  teal: ["purple", "pink", "red", "magenta", "orange", "yellow", "gray", "grey", "silver"],
  blue: ["purple", "violet", "amethyst", "pink", "magenta", "red", "orange", "green", "yellow", "gray", "grey", "silver"],
  purple: [
    "navy",
    "blue",
    "sky",
    "sapphire",
    "teal",
    "green",
    "orange",
    "yellow",
    "red",
    "gray",
    "grey",
    "silver",
    "white",
    "black",
    "clear",
    "jet",
    "ivory",
  ],
  pink: ["blue", "navy", "green", "teal", "orange", "yellow", "gray", "grey", "silver"],
  brown: ["blue", "navy", "purple", "pink", "green", "teal", "gray", "grey", "silver"],
  neutral: ["purple", "violet", "amethyst", "nebula", "red", "blue", "green", "pink", "orange", "yellow", "teal"],
};

export const PREMIUM_SLEEVE_BRANDS = ["dragon shield", "ultimate guard", "katana", "gamegenic"];

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

export function colorDistance(a: string, b: string): number {
  return deltaE2000(a, b);
}

/** Lab chroma — better achromatic detector than HSL saturation alone. */
function labChroma(hex: string): number {
  const { a, b } = hexToLab(hex);
  return Math.sqrt(a * a + b * b);
}

/** True only for near-gray / near-black / near-white picks — never saturated hues. */
function isAchromaticHex(hex: string): boolean {
  const { s, l } = hexToHsl(hex);
  const C = labChroma(hex);
  // Near black / white by lightness
  if (l < 0.08 || l > 0.94) return true;
  // Low chroma in Lab (saturated purple has C* ≫ 20 even when HSL s looks modest)
  if (C < 12) return true;
  // Extremely low HSL saturation only when Lab agrees it is dull
  if (s < 0.08 && C < 18) return true;
  return false;
}

export function hueFamilyFromHex(hex: string): HueFamily {
  if (isAchromaticHex(hex)) return "neutral";
  const { h } = hexToHsl(hex);
  if (h < 15 || h >= 345) return "red";
  if (h < 40) return "orange";
  if (h < 70) return "yellow";
  if (h < 155) return "green";
  if (h < 195) return "teal";
  // End blue earlier so blue-violet / deep indigo lands in purple (not navy/gray path)
  if (h < 250) return "blue";
  if (h < 310) return "purple";
  if (h < 335) return "pink";
  return "red";
}

export function hexToHueName(hex: string): HueName {
  if (isAchromaticHex(hex)) {
    const { l } = hexToHsl(hex);
    if (l < 0.12) return "black";
    if (l > 0.9) return "white";
    return "gray";
  }
  const { h } = hexToHsl(hex);
  if (h < 15 || h >= 345) return "red";
  if (h < 40) return "orange";
  if (h < 70) return "yellow";
  if (h < 150) return "green";
  if (h < 190) return "teal";
  if (h < 250) return "blue";
  if (h < 310) return "purple";
  if (h < 335) return "pink";
  return "red";
}

export function isPremiumBrand(text: string): boolean {
  const t = text.toLowerCase();
  return PREMIUM_SLEEVE_BRANDS.some((b) => t.includes(b));
}

export function synonymsForColor(colorName: string): string[] {
  const key = colorName.toLowerCase();
  return COLOR_SYNONYMS[key] ?? [key];
}

export function titleHasColorSynonym(title: string, colorName: string): boolean {
  const t = title.toLowerCase();
  return synonymsForColor(colorName).some((s) => t.includes(s));
}

export function titleHasConflictingColor(title: string, family: HueFamily, colorName: string): boolean {
  const t = title.toLowerCase();
  const allowed = new Set(synonymsForColor(colorName).map((s) => s.toLowerCase()));
  for (const word of FAMILY_CONFLICT_WORDS[family] ?? []) {
    if (allowed.has(word)) continue;
    // Word-boundary-ish: avoid matching "red" inside "hundred"
    const re = new RegExp(`(?:^|[^a-z])${word}(?:[^a-z]|$)`, "i");
    if (re.test(t)) return true;
  }
  return false;
}
