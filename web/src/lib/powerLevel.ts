/**
 * Commander power level + bracket analysis.
 * Implements the published EDH Power Level curves from https://edhpowerlevel.com/
 * (priceCurve, popCurve, powerCurve, efficiencyLimits, land/reserved factors).
 */
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
  /** Power-level gates used when flags are ambiguous. */
  bracketCurve: [0, 4.7, 6.7, 7.7, 9.25, 10],
  cmcFloor: 1.75,
  cmcCeiling: 6,
  efficiencyLimits: [0.65, 1.1] as [number, number],
};

/** Official-ish Game Changers (Commander bracket panel). */
const GAME_CHANGERS = new Set(
  [
    "Ancient Tomb",
    "Bolas's Citadel",
    "Braids, Cabal Minion",
    "Chrome Mox",
    "Coalition Victory",
    "Consecrated Sphinx",
    "Crop Rotation",
    "Cyclonic Rift",
    "Demonic Tutor",
    "Drannith Magistrate",
    "Enlightened Tutor",
    "Field of the Dead",
    "Food Chain",
    "Gaea's Cradle",
    "Gamble",
    "Gifts Ungiven",
    "Grand Arbiter Augustin IV",
    "Grim Monolith",
    "Humility",
    "Imperial Seal",
    "Intuition",
    "Jeska's Will",
    "Lim-Dûl's Vault",
    "Lim-Dul's Vault",
    "Lion's Eye Diamond",
    "Mana Crypt",
    "Mana Drain",
    "Mana Vault",
    "Mishra's Workshop",
    "Mox Diamond",
    "Mystical Tutor",
    "Natural Order",
    "Necropotence",
    "Oath of Druids",
    "Opposition Agent",
    "Pact of Negation",
    "Panoptic Mirror",
    "Rhystic Study",
    "Saruman of Many Colors",
    "Seedborn Muse",
    "Smothering Tithe",
    "Survival of the Fittest",
    "Teferi's Puzzle Box",
    "Thassa's Oracle",
    "The One Ring",
    "The Tabernacle at Pendrell Vale",
    "Urza, Lord High Artificer",
    "Vampiric Tutor",
    "Worldly Tutor",
    "Ad Nauseam",
    "Biorhythm",
    "Drift of Phantasms",
    "Farewell",
    "Force of Will",
    "Fierce Guardianship",
    "Deadly Rollick",
    "Deflecting Swat",
    "Flawless Maneuver",
    "Veil of Summer",
    "Notion Thief",
    "Narset, Parter of Veils",
    "Rule of Law",
    "Deafening Silence",
    "Winter Orb",
    "Static Orb",
    "Stasis",
    "Rising Waters",
  ].map((n) => n.toLowerCase()),
);

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
  return /take an extra turn|extra turn/i.test(oracleText(card));
}

function isMassLandDenial(card: ScryfallCard): boolean {
  const t = oracleText(card);
  const n = normalizeName(card.name);
  return (
    /destroy all lands|all lands.*destroy|exile all lands|each player sacrifices .{0,40}lands|lands don't untap/i.test(
      t,
    ) ||
    /armageddon|ravages of war|cataclysm|obliterate|sunder|wildfire|burning of xinye|decree of annihilation|from the ashes|impending disaster|wake of destruction/i.test(
      n,
    )
  );
}

function isComboPiece(card: ScryfallCard): boolean {
  const n = normalizeName(card.name);
  const known = [
    "thassa's oracle",
    "demonic consultation",
    "tainted pact",
    "underworld breach",
    "lion's eye diamond",
    "brain freeze",
    "dockside extortionist",
    "temur sabertooth",
    "food chain",
    "isochron scepter",
    "dramatic reversal",
    "dualcaster mage",
    "nidax, blighted force",
    "consultation",
  ];
  if (known.includes(n)) return true;
  const t = oracleText(card);
  return /you win the game|wins the game|infinite (mana|turns|combats)/i.test(t);
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
 * WotC-style brackets from flags, with EDHPL power gates as a soft check.
 * Bracket 1–2: no game changers / MLD / early 2-card combos / chaining extra turns.
 * Bracket 3: up to 3 game changers; Bracket 4–5 unrestricted power.
 */
function detectBracket(flags: BracketFlags, powerLevel: number): number {
  const gc = flags.gameChangers.length;
  const mld = flags.massLandDenial.length;
  const turns = flags.extraTurns.length;
  const combos = flags.comboPieces.length;
  const tutors = flags.tutors.length;

  // Hard rule bumps
  if (combos >= 2 && (gc >= 3 || tutors >= 5) && powerLevel >= FACTORS.bracketCurve[4]) {
    return 5;
  }
  if (mld >= 1 || gc >= 4 || (combos >= 1 && gc >= 2) || powerLevel >= FACTORS.bracketCurve[3]) {
    return 4;
  }
  if (gc >= 1 || turns >= 2 || combos >= 1 || tutors >= 3 || powerLevel >= FACTORS.bracketCurve[2]) {
    // Bracket 3 allows up to 3 GCs
    if (gc <= 3) return 3;
    return 4;
  }
  if (tutors >= 1 || turns >= 1 || powerLevel >= FACTORS.bracketCurve[1]) {
    return 2;
  }
  return 1;
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
      name: card.name.split(" // ")[0],
      quantity: line.quantity,
      impact,
      cmc: land ? 0 : (card.cmc ?? 0),
      isLand: land,
      isCommander,
    });

    if (!isCommander) {
      const n = normalizeName(card.name);
      const short = card.name.split(" // ")[0];
      if (GAME_CHANGERS.has(n) && !flags.gameChangers.includes(short)) {
        flags.gameChangers.push(short);
      }
      if (isTutor(card) && !flags.tutors.includes(short)) flags.tutors.push(short);
      if (isExtraTurn(card) && !flags.extraTurns.includes(short)) flags.extraTurns.push(short);
      if (isMassLandDenial(card) && !flags.massLandDenial.includes(short)) {
        flags.massLandDenial.push(short);
      }
      if (isComboPiece(card) && !flags.comboPieces.includes(short)) {
        flags.comboPieces.push(short);
      }
    }
  }

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
  const bracket = detectBracket(flags, powerLevel);

  notes.push(
    `Impact ${totalImpact.toFixed(1)} · Efficiency ${efficiency.toFixed(2)}/10 · Tipping point ${tippingPoint}.`,
  );
  if (flags.gameChangers.length) {
    notes.push(`${flags.gameChangers.length} game changer(s) detected.`);
  }

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
