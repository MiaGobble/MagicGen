/**
 * Commander power level + bracket analysis.
 *
 * Power level (1–10): EDH Power Level curves from https://edhpowerlevel.com/
 * (priceCurve, popCurve, powerCurve, efficiencyLimits, land/reserved factors).
 *
 * Bracket (1–5): WotC Commander bracket barometers only — Game Changers, assembled
 * two-card combos, extra turns, mass land denial. Power score does NOT raise bracket
 * (EDHPL / OCT 2025: tutors removed from bracket rules).
 */
import { KNOWN_COMBO_PAIRS } from "./cardThemes";
import type { DeckLine } from "./deckFormat";
import { collectionLookup, type ScryfallCard } from "./scryfall";

export type PowerProgress = {
  done: number;
  total: number;
  label: string;
};

export type CardImpact = {
  name: string;
  quantity: number;
  impact: number;
  cmc: number;
  isLand: boolean;
  isCommander: boolean;
};

export type BracketFlags = {
  gameChangers: string[];
  tutors: string[];
  extraTurns: string[];
  massLandDenial: string[];
  /** Assembled two-card packages found in the list (e.g. "A + B"). */
  comboPieces: string[];
};

export type PowerReport = {
  /** 1–10 scale (EDH Power Level style). */
  powerLevel: number;
  /** Composite 0–1000 (= impact × efficiency multiplier). */
  score: number;
  /** Total deck impact. */
  impact: number;
  /** Average nonland impact per card. */
  avgImpact: number;
  /** Average CMC excluding lands. */
  avgCmc: number;
  /** CMC band where cumulative nonland impact crosses ~65%. */
  tippingPoint: number;
  /** 1–10 efficiency from curve + tipping point. */
  efficiency: number;
  /** Official-style Commander bracket 1–5. */
  bracket: number;
  bracketLabel: string;
  flags: BracketFlags;
  cards: CardImpact[];
  notes: string[];
};

const BRACKET_LABELS: Record<number, string> = {
  1: "Exhibition",
  2: "Core",
  3: "Upgraded",
  4: "Optimized",
  5: "cEDH",
};

/** Factors mirrored from edhpowerlevel.com (public client config). */
const FACTORS = {
  land: 0.6,
  reserved: 0.2,
  favorPrice: 0.25,
  /** Score stops → power levels 0–10. */
  powerCurve: [0, 250, 320, 350, 380, 420, 470, 560, 760, 890, 1000],
  /** Popularity via (27000 − edhrec_rank). */
  popCurve: [0, 8500, 13600, 17100, 19800, 21900, 23700, 25300, 26200, 26700, 27000],
  priceCurve: [0, 0.5, 1.5, 3.5, 6, 10, 15, 25, 40, 65, 100],
  cmcFloor: 1.75,
  cmcCeiling: 6,
  efficiencyLimits: [0.65, 1.1] as [number, number],
};

/**
 * Official Game Changers (Commander Format Panel, Oct 21 2025 update).
 * @see https://magic.wizards.com/en/news/announcements/commander-brackets-beta-update-october-21-2025
 */
const GAME_CHANGERS = new Set(
  [
    "Drannith Magistrate",
    "Humility",
    "Serra's Sanctum",
    "Smothering Tithe",
    "Enlightened Tutor",
    "Teferi's Protection",
    "Consecrated Sphinx",
    "Cyclonic Rift",
    "Force of Will",
    "Fierce Guardianship",
    "Gifts Ungiven",
    "Intuition",
    "Mystical Tutor",
    "Narset, Parter of Veils",
    "Rhystic Study",
    "Thassa's Oracle",
    "Ad Nauseam",
    "Bolas's Citadel",
    "Braids, Cabal Minion",
    "Demonic Tutor",
    "Imperial Seal",
    "Necropotence",
    "Opposition Agent",
    "Orcish Bowmasters",
    "Tergrid, God of Fright",
    "Vampiric Tutor",
    "Gamble",
    "Jeska's Will",
    "Underworld Breach",
    "Crop Rotation",
    "Gaea's Cradle",
    "Natural Order",
    "Seedborn Muse",
    "Survival of the Fittest",
    "Worldly Tutor",
    "Aura Shards",
    "Coalition Victory",
    "Grand Arbiter Augustin IV",
    "Notion Thief",
    "Ancient Tomb",
    "Chrome Mox",
    "Field of the Dead",
    "Glacial Chasm",
    "Grim Monolith",
    "Lion's Eye Diamond",
    "Mana Vault",
    "Mishra's Workshop",
    "Mox Diamond",
    "Panoptic Mirror",
    "The One Ring",
    "The Tabernacle at Pendrell Vale",
  ].map((n) => n.toLowerCase()),
);

/** Two-card packages that typically win before ~turn 4–5 (floor Bracket 4). */
const FAST_COMBO_PAIRS: ReadonlyArray<readonly [string, string]> = [
  ["thassa's oracle", "demonic consultation"],
  ["thassa's oracle", "tainted pact"],
  ["underworld breach", "lion's eye diamond"],
  ["underworld breach", "brain freeze"],
  ["lion's eye diamond", "brain freeze"],
  ["isochron scepter", "dramatic reversal"],
  ["food chain", "temur sabertooth"],
  ["nidax, blighted force", "food chain"],
];

const BASIC_LANDS = new Set(
  [
    "Plains",
    "Island",
    "Swamp",
    "Mountain",
    "Forest",
    "Wastes",
    "Snow-Covered Plains",
    "Snow-Covered Island",
    "Snow-Covered Swamp",
    "Snow-Covered Mountain",
    "Snow-Covered Forest",
    "Snow-Covered Wastes",
  ].map((n) => n.toLowerCase()),
);

function normalizeName(name: string): string {
  return name.toLowerCase().split(" // ")[0].trim();
}

function displayShort(name: string): string {
  return name.split(" // ")[0];
}

function isLand(card: ScryfallCard): boolean {
  return /\bland\b/i.test(card.type_line ?? "");
}

function isMdfcLand(card: ScryfallCard): boolean {
  if (card.layout !== "modal_dfc") return false;
  return (card.card_faces ?? []).some((f) => /\bland\b/i.test(f.type_line ?? ""));
}

function oracleText(card: ScryfallCard): string {
  const faces = card.card_faces?.map((f) => f.oracle_text ?? "").join("\n") ?? "";
  return `${card.oracle_text ?? ""}\n${faces}`.toLowerCase();
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n));
}

/**
 * EDHPL curve interpolator `de(value, stops, stepScale)`.
 * Maps a raw metric onto 0..(stops.length-1)*stepScale.
 */
function curveLookup(value: number, stops: number[], stepScale = 1): number {
  if (value <= stops[0]) return 0;
  if (value > stops[stops.length - 1]) return (stops.length - 1) * stepScale;
  const points = stops.map((max, i) => ({ stop: i * stepScale, max }));
  for (let i = 0; i < points.length - 1; i++) {
    if (value < points[i + 1].max && value >= points[i].max) {
      const span = points[i + 1].max - points[i].max;
      const frac = span > 0 ? (value - points[i].max) / span : 0;
      // Matches edhpowerlevel.com: add 0–1 between stops (not × stepScale).
      return points[i].stop + frac;
    }
  }
  return (stops.length - 1) * stepScale;
}

/** Per-card Impact using EDHPL price + popularity curves. */
export function cardImpactScore(card: ScryfallCard, quantity = 1): number {
  const name = normalizeName(card.name);
  if (BASIC_LANDS.has(name)) return 2 * quantity;

  let price = Number(card.prices?.usd ?? card.prices?.usd_foil ?? 0) || 0;
  if (card.reserved) price *= FACTORS.reserved;

  const pricePart = curveLookup(price, FACTORS.priceCurve, 1 + FACTORS.favorPrice);

  const rank =
    typeof card.edhrec_rank === "number" && card.edhrec_rank > 0
      ? card.edhrec_rank
      : FACTORS.popCurve[FACTORS.popCurve.length - 1];
  const popRaw = FACTORS.popCurve[FACTORS.popCurve.length - 1] - rank;
  const popPart = curveLookup(popRaw, FACTORS.popCurve, 1 + FACTORS.favorPrice * -1);

  let impact = (pricePart + popPart) * quantity;

  if (isLand(card) || isMdfcLand(card)) {
    impact *= FACTORS.land;
  }

  return impact;
}

export type PowerEstimateInput = {
  card: ScryfallCard;
  quantity: number;
  isCommander?: boolean;
};

/**
 * Fast EDHPL-style power estimate from already-resolved Scryfall cards (no network).
 * Used by pool-to-decks when comparing alternate builds.
 */
export function estimatePowerFromCards(entries: PowerEstimateInput[]): {
  powerLevel: number;
  score: number;
  impact: number;
} {
  const impacts: CardImpact[] = entries.map((e) => {
    const land = isLand(e.card) || isMdfcLand(e.card);
    return {
      name: displayShort(e.card.name),
      quantity: e.quantity,
      impact: cardImpactScore(e.card, e.quantity),
      cmc: land ? 0 : (e.card.cmc ?? 0),
      isLand: land,
      isCommander: !!e.isCommander,
    };
  });

  const totalImpact = impacts.reduce((s, c) => s + c.impact, 0);
  const nonlands = impacts.filter((c) => !c.isLand);
  const cmcCards = nonlands.filter((c) => !c.isCommander);
  const cmcQty = cmcCards.reduce((s, c) => s + c.quantity, 0) || 1;
  const avgCmc = cmcCards.reduce((s, c) => s + c.cmc * c.quantity, 0) / cmcQty;
  const tippingPoint = computeTippingPoint(impacts);

  const g = (avgCmc + tippingPoint) / 2;
  const ce = clamp(
    (FACTORS.cmcCeiling - g) / (FACTORS.cmcCeiling - FACTORS.cmcFloor),
    0,
    1.5,
  );
  const [effLo, effHi] = FACTORS.efficiencyLimits;
  const efficiencyMultiplier = effLo + (effHi - effLo) * ce;
  const score = totalImpact * efficiencyMultiplier;
  const powerLevel = Math.round(curveLookup(score, FACTORS.powerCurve) * 100) / 100;

  return {
    powerLevel: clamp(powerLevel, 0, 10),
    score: Math.round(clamp(score, 0, 1000)),
    impact: Math.round(totalImpact * 100) / 100,
  };
}

function isTutor(card: ScryfallCard): boolean {
  const t = oracleText(card);
  if (/search your library for (a|an|up to|any)/i.test(t) && /then shuffle/i.test(t)) {
    if (
      /\bbasic land\b/i.test(t) &&
      !/nonland|creature|artifact|enchantment|planeswalker|instant|sorcery/i.test(t)
    ) {
      return false;
    }
    return true;
  }
  return false;
}

function isExtraTurn(card: ScryfallCard): boolean {
  // Require the actual extra-turn effect — not loose "extra turn" mentions.
  return /take an extra turn/i.test(oracleText(card));
}

function isMassLandDenial(card: ScryfallCard): boolean {
  const t = oracleText(card);
  const n = normalizeName(card.name);
  // Stax like Winter Orb ("lands don't untap") is NOT treated as MLD — that was
  // falsely pushing many decks to Bracket 4.
  return (
    /destroy all lands|exile all lands|each player sacrifices (all|each of their) lands/i.test(
      t,
    ) ||
    /armageddon|ravages of war|obliterate|sunder|wildfire|burning of xinye|decree of annihilation|from the ashes|impending disaster|wake of destruction/i.test(
      n,
    )
  );
}

function isFastComboPair(a: string, b: string): boolean {
  const x = normalizeName(a);
  const y = normalizeName(b);
  return FAST_COMBO_PAIRS.some(
    ([p, q]) => (p === x && q === y) || (p === y && q === x),
  );
}

/** Find assembled two-card packages present in the deck (both halves). */
function findAssembledCombos(deckKeys: Set<string>): {
  labels: string[];
  fastCount: number;
  lateCount: number;
} {
  const labels: string[] = [];
  let fastCount = 0;
  let lateCount = 0;
  const seen = new Set<string>();

  for (const [a, b] of [...KNOWN_COMBO_PAIRS, ...FAST_COMBO_PAIRS]) {
    if (!deckKeys.has(a) || !deckKeys.has(b)) continue;
    const key = [a, b].sort().join("|");
    if (seen.has(key)) continue;
    seen.add(key);
    const label = `${titleCaseName(a)} + ${titleCaseName(b)}`;
    labels.push(label);
    if (isFastComboPair(a, b)) fastCount += 1;
    else lateCount += 1;
  }

  return { labels, fastCount, lateCount };
}

function titleCaseName(key: string): string {
  return key.replace(/\b\w/g, (c) => c.toUpperCase());
}

/** CMC where cumulative nonland impact exceeds 65% (EDHPL tipping point). */
function computeTippingPoint(cards: CardImpact[]): number {
  const nonlands = cards.filter((c) => !c.isLand);
  const total = nonlands.reduce((s, c) => s + c.impact, 0);
  if (total <= 0) return 3;
  const byCmc = new Map<number, number>();
  for (const c of nonlands) {
    const cmc = Math.min(8, Math.max(0, Math.floor(c.cmc)));
    byCmc.set(cmc, (byCmc.get(cmc) ?? 0) + c.impact);
  }
  let cum = 0;
  for (let cmc = 0; cmc <= 8; cmc++) {
    cum += byCmc.get(cmc) ?? 0;
    if (cum > total * 0.65) return Math.max(0, cmc);
  }
  return 4;
}

/**
 * WotC / EDHPL-style brackets from barometers only.
 * Power level is intentionally ignored — expensive/popular lists must not inflate bracket.
 *
 * Prefer under-bracketing soft signals: late/ambiguous combos and a few extra turns are
 * noted but do not raise the floor. Hard floors stay on Game Changers, real MLD, and
 * known fast two-card win packages.
 *
 * Baseline is Bracket 2 (Core).
 */
function detectBracket(
  flags: BracketFlags,
  comboFast: number,
  _comboLate: number,
): number {
  const gc = flags.gameChangers.length;
  const mld = flags.massLandDenial.length;
  const turns = flags.extraTurns.length;

  let bracket = 2;

  // Game Changers: 1–3 → B3 floor; 4+ → B4 floor (official hard rule)
  if (gc >= 4) bracket = Math.max(bracket, 4);
  else if (gc >= 1) bracket = Math.max(bracket, 3);

  // True mass land denial → Optimized
  if (mld >= 1) bracket = Math.max(bracket, 4);

  // B2/B3 allow a few extra turns if not chained. Only a dense suite implies chaining.
  if (turns >= 5) bracket = Math.max(bracket, 4);

  // Only known fast two-card win packages raise bracket (→ Optimized).
  // Late/blink-adjacent packages are flagged for discussion but do not auto-bump.
  if (comboFast >= 1) bracket = Math.max(bracket, 4);

  // cEDH: multiple fast win packages plus heavy Game Changer density
  if (comboFast >= 2 && gc >= 4) bracket = 5;

  return bracket;
}

export async function analyzeDeckPower(
  lines: DeckLine[],
  opts?: { onProgress?: (p: PowerProgress) => void },
): Promise<PowerReport> {
  const onProgress = opts?.onProgress;
  const notes: string[] = [];

  onProgress?.({ done: 0, total: 3, label: "Resolving cards for power analysis…" });

  const unique = [...new Set(lines.map((l) => l.name.split(" // ")[0].trim()))];
  const cards = await collectionLookup(
    unique.map((name) => ({ name })),
    (done, total, label) =>
      onProgress?.({
        done: 1,
        total: 3,
        label: label ?? `Looking up cards (${done}/${total})…`,
      }),
  );

  const byName = new Map<string, ScryfallCard>();
  for (const c of cards) byName.set(normalizeName(c.name), c);

  onProgress?.({ done: 2, total: 3, label: "Scoring impact & brackets…" });

  const impacts: CardImpact[] = [];
  const flags: BracketFlags = {
    gameChangers: [],
    tutors: [],
    extraTurns: [],
    massLandDenial: [],
    comboPieces: [],
  };

  const deckKeys = new Set<string>();
  let unresolved = 0;
  for (const line of lines) {
    const key = normalizeName(line.name);
    const card = byName.get(key);
    if (!card) {
      unresolved += line.quantity;
      continue;
    }
    const cat = (line.category ?? "").toLowerCase();
    const isCommander = cat === "commander";
    const land = isLand(card) || isMdfcLand(card);
    const impact = cardImpactScore(card, line.quantity);
    impacts.push({
      name: displayShort(card.name),
      quantity: line.quantity,
      impact,
      cmc: land ? 0 : (card.cmc ?? 0),
      isLand: land,
      isCommander,
    });

    deckKeys.add(key);

    // Commanders on the Game Changers list still count toward the GC cap.
    const n = normalizeName(card.name);
    const short = displayShort(card.name);
    if (GAME_CHANGERS.has(n) && !flags.gameChangers.includes(short)) {
      flags.gameChangers.push(short);
    }

    if (!isCommander) {
      if (isTutor(card) && !flags.tutors.includes(short)) flags.tutors.push(short);
      if (isExtraTurn(card) && !flags.extraTurns.includes(short)) flags.extraTurns.push(short);
      if (isMassLandDenial(card) && !flags.massLandDenial.includes(short)) {
        flags.massLandDenial.push(short);
      }
    }
  }

  const assembled = findAssembledCombos(deckKeys);
  flags.comboPieces = assembled.labels;

  if (unresolved) notes.push(`Skipped ${unresolved} unresolved card(s) in power analysis.`);

  const totalImpact = impacts.reduce((s, c) => s + c.impact, 0);
  const nonlands = impacts.filter((c) => !c.isLand);
  const nonlandQty = nonlands.reduce((s, c) => s + c.quantity, 0) || 1;
  const avgImpact = nonlands.reduce((s, c) => s + c.impact, 0) / nonlandQty;
  const cmcCards = nonlands.filter((c) => !c.isCommander);
  const cmcQty = cmcCards.reduce((s, c) => s + c.quantity, 0) || 1;
  const avgCmc = cmcCards.reduce((s, c) => s + c.cmc * c.quantity, 0) / cmcQty;
  const tippingPoint = computeTippingPoint(impacts);

  // EDHPL efficiency
  const g = (avgCmc + tippingPoint) / 2;
  const ce = clamp(
    (FACTORS.cmcCeiling - g) / (FACTORS.cmcCeiling - FACTORS.cmcFloor),
    0,
    1.5,
  );
  const [effLo, effHi] = FACTORS.efficiencyLimits;
  const efficiencyMultiplier = effLo + (effHi - effLo) * ce;
  const efficiency = clamp(ce * 10, 0, 15);

  const score = totalImpact * efficiencyMultiplier;
  const powerLevel = Math.round(curveLookup(score, FACTORS.powerCurve) * 100) / 100;
  const bracket = detectBracket(flags, assembled.fastCount, assembled.lateCount);

  notes.push(
    `Impact ${totalImpact.toFixed(1)} · Efficiency ${efficiency.toFixed(2)}/10 · Tipping point ${tippingPoint}.`,
  );
  if (flags.gameChangers.length) {
    notes.push(`${flags.gameChangers.length} game changer(s) detected.`);
  }
  if (assembled.labels.length) {
    notes.push(`${assembled.labels.length} assembled two-card combo(s) detected.`);
  }
  if (assembled.lateCount > 0 && assembled.fastCount === 0) {
    notes.push(
      "Late/ambiguous combo packages noted but did not raise bracket (discuss intent).",
    );
  }
  notes.push(
    "Bracket floors: Game Changers, fast combos, true MLD, dense extra turns — not power score, tutors, or stax.",
  );

  onProgress?.({ done: 3, total: 3, label: "Done" });

  return {
    powerLevel: clamp(powerLevel, 0, 10),
    score: Math.round(clamp(score, 0, 1000)),
    impact: Math.round(totalImpact * 100) / 100,
    avgImpact: Math.round(avgImpact * 100) / 100,
    avgCmc: Math.round(avgCmc * 100) / 100,
    tippingPoint,
    efficiency: Math.round(efficiency * 100) / 100,
    bracket,
    bracketLabel: BRACKET_LABELS[bracket] ?? `Bracket ${bracket}`,
    flags,
    cards: impacts,
    notes,
  };
}

export { BRACKET_LABELS };
