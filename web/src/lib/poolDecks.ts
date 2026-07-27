/**
 * Build X Commander decks from a shared card pool.
 * Strategies: color identity, balanced snake-draft, or greedy best-first.
 * Scores cards via EDHREC synergy blended with local theme/package fit.
 */
import {
  comboPairHits,
  mergeThemes,
  poolThemeSupport,
  tagCardThemes,
  themeOverlap,
  tribalOverlap,
} from "./cardThemes";
import {
  fetchBracketCounts,
  fetchCommanderSynergyScores,
} from "./edhrec";
import { parseDeckListAsync, toMoxfieldList, type DeckLine } from "./moxfield";
import { analyzeDeckPower, type PowerReport } from "./powerLevel";
import { collectionLookup, type ScryfallCard } from "./scryfall";

export type PoolStrategy = "color" | "balanced" | "greedy";

export type PoolProgress = {
  done: number;
  total: number;
  label: string;
};

export type PoolDeck = {
  index: number;
  commanderName: string;
  colorIdentity: string[];
  list: string;
  lines: DeckLine[];
  cardCount: number;
  notes: string[];
  power?: PowerReport;
};

export type PoolDecksOptions = {
  listText: string;
  deckCount: number;
  strategy: PoolStrategy;
  onProgress?: (progress: PoolProgress) => void;
};

const WUBRG = ["W", "U", "B", "R", "G"] as const;
const MAIN_SIZE = 99;
/** Typical EDH land count — keep decks on curve. */
const TARGET_LANDS = 37;
const MIN_LANDS = 35;
const MAX_LANDS = 39;
const MIN_DECKS = 1;

function clampDeckCount(n: number): number {
  if (!Number.isFinite(n)) return 2;
  return Math.max(MIN_DECKS, Math.round(n));
}

type PoolItem = {
  key: string;
  name: string;
  quantity: number;
  card: ScryfallCard;
  isBasic: boolean;
  isLand: boolean;
  isCommanderLegal: boolean;
  /** Local heuristic only (fallback when EDHREC misses). */
  baseScore: number;
  /** Precomputed oracle/type theme tags. */
  themes: Set<string>;
};

type Seat = {
  commander: ScryfallCard;
  ci: string[];
  /** Mainboard names → qty (excludes commander) */
  main: Map<string, { quantity: number; card: ScryfallCard; isLand: boolean; score: number }>;
  notes: string[];
  /** EDHREC synergy scores keyed by normalized card name. */
  synergy: Map<string, number>;
  /** Running theme profile: commander themes + drafted cards. */
  themes: Set<string>;
};

/** Blended score bands for fill phases (not EDHREC-raw floors). */
const HIGH_FIT_SCORE = 200;
const SOLID_FIT_SCORE = 35;

function normalizeName(name: string): string {
  return name.toLowerCase().split(" // ")[0].trim();
}

function displayName(card: ScryfallCard): string {
  return card.name.split(" // ")[0];
}

function ciKey(ci: string[]): string {
  return WUBRG.filter((c) => ci.includes(c)).join("") || "C";
}

function isBasicLandCard(card: ScryfallCard): boolean {
  return /\bbasic\b/i.test(card.type_line) && /\bland\b/i.test(card.type_line);
}

function isLandCard(card: ScryfallCard): boolean {
  return /\bland\b/i.test(card.type_line);
}

/** Legal to put in a Commander deck (basics always ok). */
function isLegalInCommander(card: ScryfallCard): boolean {
  if (isBasicLandCard(card)) return true;
  const legality = card.legalities?.commander;
  return legality === "legal" || legality === "restricted";
}

function fitsColorIdentity(card: ScryfallCard, commanderCi: string[]): boolean {
  const allowed = new Set(commanderCi);
  for (const c of card.color_identity ?? []) {
    if (!allowed.has(c)) return false;
  }
  return true;
}

/** Can be chosen as a commander. */
function isValidCommander(card: ScryfallCard): boolean {
  if (!isLegalInCommander(card)) return false;
  const t = card.type_line ?? "";
  const legendary = /\blegendary\b/i.test(t);
  const creature = /\bcreature\b/i.test(t);
  const planeswalker = /\bplaneswalker\b/i.test(t);
  if (legendary && (creature || planeswalker)) return true;
  if (/\bcan be your commander\b/i.test(card.oracle_text ?? "")) return true;
  return false;
}

function rarityWeight(rarity: string | undefined): number {
  switch ((rarity ?? "").toLowerCase()) {
    case "mythic":
      return 4;
    case "rare":
      return 3;
    case "uncommon":
      return 2;
    case "common":
      return 1;
    default:
      return 1.5;
  }
}

/** Local power heuristic — used when EDHREC has no data for a card. */
function baseScoreCard(card: ScryfallCard): number {
  let s = rarityWeight(card.rarity) * 10;
  const cmc = card.cmc ?? 0;
  if (cmc >= 2 && cmc <= 4) s += 4;
  else if (cmc === 1 || cmc === 5) s += 2;
  else if (cmc >= 6) s -= 1;

  const t = card.type_line ?? "";
  const text = card.oracle_text ?? "";
  if (/\bcreature\b/i.test(t)) s += 2;
  if (/\bartifact\b/i.test(t) && !/\bland\b/i.test(t)) s += 1.5;
  if (/draw a card|tutor|search your library|counter target|destroy target|exile target|\bramp\b|add \{/i.test(text)) {
    s += 5;
  }
  if (/cascade|extra turn|copy (target|this)|storm|infinite/i.test(text)) s += 4;
  if (/\bland\b/i.test(t)) {
    s = rarityWeight(card.rarity) * 8;
    if (/enters|tap.*add|fetch|search your library for a|shock|dual|triome|pathway/i.test(text)) {
      s += 8;
    }
    if (isBasicLandCard(card)) s = 2;
  }
  return s;
}

function seatCardScore(seat: Seat, item: PoolItem): number {
  const syn = seat.synergy.get(item.key) ?? 0;
  // EDHREC when present; no cliff penalty when absent.
  const edh = syn > 0 ? syn * 25 : 0;
  const themeFit = themeOverlap(item.themes, seat.themes) * 18;
  const combo = comboPairHits(item.key, seat.main.keys()) * 120;
  const tribal = tribalOverlap(item.themes, seat.themes) * 12;
  return edh + themeFit + combo + tribal + item.baseScore;
}

function basicLandsFor(colorId: string[], count: number): DeckLine[] {
  if (count <= 0) return [];
  const map: Record<string, string> = {
    W: "Plains",
    U: "Island",
    B: "Swamp",
    R: "Mountain",
    G: "Forest",
  };
  const colors = colorId.length ? colorId : ["C"];
  if (colors.length === 1 && colors[0] === "C") {
    return [{ quantity: count, name: "Wastes", category: "Deck" }];
  }

  const lands = colors.map((c) => map[c]).filter(Boolean);
  if (!lands.length) return [{ quantity: count, name: "Wastes", category: "Deck" }];

  const base = Math.floor(count / lands.length);
  let rem = count % lands.length;
  return lands.map((name) => {
    const qty = base + (rem > 0 ? 1 : 0);
    if (rem > 0) rem -= 1;
    return { quantity: qty, name, category: "Deck" };
  });
}

function seatMainCount(seat: Seat): number {
  let n = 0;
  for (const e of seat.main.values()) n += e.quantity;
  return n;
}

function seatLandCount(seat: Seat): number {
  let n = 0;
  for (const e of seat.main.values()) if (e.isLand) n += e.quantity;
  return n;
}

function canPlayInSeat(seat: Seat, item: PoolItem): boolean {
  if (item.quantity <= 0) return false;
  if (!isLegalInCommander(item.card)) return false;
  if (!fitsColorIdentity(item.card, seat.ci)) return false;
  return true;
}

function addToSeat(seat: Seat, item: PoolItem, qty = 1): boolean {
  if (!canPlayInSeat(seat, item)) return false;
  const room = MAIN_SIZE - seatMainCount(seat);
  if (room <= 0) return false;
  const take = Math.min(qty, room, item.quantity);
  if (take <= 0) return false;

  const score = seatCardScore(seat, item);
  const existing = seat.main.get(item.key);
  if (existing) {
    existing.quantity += take;
    existing.score = Math.max(existing.score, score);
  } else {
    seat.main.set(item.key, {
      quantity: take,
      card: item.card,
      isLand: item.isLand,
      score,
    });
  }
  mergeThemes(seat.themes, item.themes);
  item.quantity -= take;
  return true;
}

function takeFromPool(pool: PoolItem[], key: string, qty = 1): boolean {
  const item = pool.find((p) => p.key === key);
  if (!item || item.quantity < qty) return false;
  item.quantity -= qty;
  return true;
}

function availableItems(pool: PoolItem[]): PoolItem[] {
  return pool.filter((p) => p.quantity > 0);
}

function colorsCovered(cis: string[][]): Set<string> {
  const s = new Set<string>();
  for (const ci of cis) for (const c of ci) s.add(c);
  return s;
}

function fittingForSeat(
  pool: PoolItem[],
  seat: Seat,
  opts?: { landsOnly?: boolean; nonlandsOnly?: boolean },
): PoolItem[] {
  return availableItems(pool).filter((p) => {
    if (!canPlayInSeat(seat, p)) return false;
    if (opts?.landsOnly && !p.isLand) return false;
    if (opts?.nonlandsOnly && p.isLand) return false;
    return true;
  });
}

/** Rank commanders by EDHREC bracket popularity (Optimized/Upgraded/cEDH). */
async function rankCommandersByPower(candidates: PoolItem[]): Promise<PoolItem[]> {
  const top = [...candidates].sort((a, b) => b.baseScore - a.baseScore).slice(0, 24);
  const ranked = await Promise.all(
    top.map(async (item) => {
      let power = item.baseScore;
      try {
        const counts = await fetchBracketCounts(item.name);
        if (counts) {
          power +=
            (counts[5] ?? 0) * 0.05 +
            (counts[4] ?? 0) * 0.04 +
            (counts[3] ?? 0) * 0.02 +
            (counts[2] ?? 0) * 0.005;
        }
      } catch {
        // keep local score
      }
      return { item, power };
    }),
  );
  ranked.sort((a, b) => b.power - a.power);

  const ordered = ranked.map((r) => r.item);
  const seen = new Set(ordered.map((i) => i.key));
  for (const c of candidates) {
    if (!seen.has(c.key)) ordered.push(c);
  }
  return ordered;
}

/** Theme + tribal density of CI-fitting pool cards for a commander candidate. */
function commanderPoolSupport(cmd: PoolItem, pool: PoolItem[]): number {
  const ci = cmd.card.color_identity ?? [];
  const fitting = pool.filter(
    (p) => p.key !== cmd.key && p.quantity > 0 && fitsColorIdentity(p.card, ci),
  );
  return poolThemeSupport(cmd.themes, fitting);
}

/** Prefer diverse color identities among power-ranked, pool-supported candidates. */
function pickDiverseCommanders(ranked: PoolItem[], count: number, pool: PoolItem[]): PoolItem[] {
  const remaining = [...ranked];
  const picked: PoolItem[] = [];
  const usedKeys = new Set<string>();

  while (picked.length < count && remaining.length) {
    let bestIdx = 0;
    let bestValue = -Infinity;
    const covered = colorsCovered(picked.map((p) => p.card.color_identity ?? []));
    const usedCiKeys = new Set(picked.map((p) => ciKey(p.card.color_identity ?? [])));

    for (let i = 0; i < remaining.length; i++) {
      const c = remaining[i];
      if (usedKeys.has(c.key)) continue;
      const ci = c.card.color_identity ?? [];
      const key = ciKey(ci);
      const newColors = ci.filter((x) => !covered.has(x)).length;
      const duplicateCi = usedCiKeys.has(key) ? -20 : 0;
      const rankBonus = Math.max(0, 30 - i);
      const support = commanderPoolSupport(c, pool);
      const value =
        newColors * 14 + duplicateCi + rankBonus + c.baseScore * 0.05 + support * 0.35;
      if (value > bestValue) {
        bestValue = value;
        bestIdx = i;
      }
    }

    const chosen = remaining.splice(bestIdx, 1)[0];
    picked.push(chosen);
    usedKeys.add(chosen.key);
  }

  return picked;
}

/** Next greedy commander: blend EDHREC rank order with pool theme support. */
function pickGreedyCommander(
  ranked: PoolItem[],
  usedKeys: Set<string>,
  pool: PoolItem[],
): PoolItem | undefined {
  let best: PoolItem | undefined;
  let bestValue = -Infinity;
  for (let i = 0; i < ranked.length; i++) {
    const c = ranked[i];
    if (c.quantity <= 0 || usedKeys.has(c.key)) continue;
    const rankBonus = Math.max(0, 40 - i);
    const support = commanderPoolSupport(c, pool);
    const value = rankBonus + support * 0.4 + c.baseScore * 0.05;
    if (value > bestValue) {
      bestValue = value;
      best = c;
    }
  }
  return best;
}

/**
 * Fill a seat preferring high blended fit (EDHREC + themes + packages), with a land band.
 */
function fillSeatSynergy(seat: Seat, pool: PoolItem[]): void {
  const nonlandTarget = MAIN_SIZE - TARGET_LANDS;

  const pickBest = (
    opts: { landsOnly?: boolean; nonlandsOnly?: boolean; minScore: number },
  ): boolean => {
    let candidates = fittingForSeat(pool, seat, {
      landsOnly: opts.landsOnly,
      nonlandsOnly: opts.nonlandsOnly,
    }).filter((p) => seatCardScore(seat, p) >= opts.minScore);
    if (!candidates.length) return false;
    candidates.sort((a, b) => seatCardScore(seat, b) - seatCardScore(seat, a));
    return addToSeat(seat, candidates[0], 1);
  };

  // 1) High-fit nonlands (strong EDHREC and/or theme packages)
  while (seatMainCount(seat) - seatLandCount(seat) < nonlandTarget && seatMainCount(seat) < MAIN_SIZE) {
    if (!pickBest({ nonlandsOnly: true, minScore: HIGH_FIT_SCORE })) break;
  }
  // 2) Solid theme/local-fit nonlands
  while (seatMainCount(seat) - seatLandCount(seat) < nonlandTarget && seatMainCount(seat) < MAIN_SIZE) {
    if (!pickBest({ nonlandsOnly: true, minScore: SOLID_FIT_SCORE })) break;
  }
  // 3) High-fit lands
  while (seatLandCount(seat) < TARGET_LANDS && seatMainCount(seat) < MAIN_SIZE) {
    if (!pickBest({ landsOnly: true, minScore: HIGH_FIT_SCORE })) break;
  }
  // 4) Solid-fit lands
  while (seatLandCount(seat) < TARGET_LANDS && seatMainCount(seat) < MAIN_SIZE) {
    if (!pickBest({ landsOnly: true, minScore: SOLID_FIT_SCORE })) break;
  }
  // 5) Fill remaining — prefer solid fit, then any legal card
  while (seatMainCount(seat) < MAIN_SIZE) {
    const lands = seatLandCount(seat);
    const nonlands = seatMainCount(seat) - lands;
    if (lands < MIN_LANDS) {
      if (pickBest({ landsOnly: true, minScore: SOLID_FIT_SCORE })) continue;
      if (pickBest({ landsOnly: true, minScore: -Infinity })) continue;
    } else if (lands >= MAX_LANDS || nonlands < nonlandTarget) {
      if (pickBest({ nonlandsOnly: true, minScore: SOLID_FIT_SCORE })) continue;
      if (pickBest({ nonlandsOnly: true, minScore: -Infinity })) continue;
    }
    if (pickBest({ minScore: SOLID_FIT_SCORE })) continue;
    if (pickBest({ minScore: -Infinity })) continue;
    break;
  }
}

function assignColorStrategy(seats: Seat[], pool: PoolItem[]): void {
  // Exclusive CI fits first — still score by the only seat's synergy
  for (const item of availableItems(pool)) {
    while (item.quantity > 0) {
      const fitSeats = seats.filter((s) => canPlayInSeat(s, item) && seatMainCount(s) < MAIN_SIZE);
      if (fitSeats.length !== 1) break;
      const seat = fitSeats[0];
      const lands = seatLandCount(seat);
      const nonlands = seatMainCount(seat) - lands;
      if (item.isLand && lands >= MAX_LANDS) break;
      if (!item.isLand && nonlands >= MAIN_SIZE - MIN_LANDS && lands < MIN_LANDS) break;
      if (!addToSeat(seat, item, 1)) break;
    }
  }

  let progress = true;
  while (progress) {
    progress = false;
    const items = availableItems(pool).sort((a, b) => {
      const bestA = Math.max(...seats.map((s) => (canPlayInSeat(s, a) ? seatCardScore(s, a) : -1)));
      const bestB = Math.max(...seats.map((s) => (canPlayInSeat(s, b) ? seatCardScore(s, b) : -1)));
      return bestB - bestA;
    });

    for (const item of items) {
      const fitSeats = seats.filter((s) => canPlayInSeat(s, item) && seatMainCount(s) < MAIN_SIZE);
      if (!fitSeats.length) continue;

      fitSeats.sort((a, b) => {
        const scoreDiff = seatCardScore(b, item) - seatCardScore(a, item);
        if (Math.abs(scoreDiff) > 0.01) return scoreDiff;
        if (item.isLand) return seatLandCount(a) - seatLandCount(b);
        return seatMainCount(a) - seatLandCount(a) - (seatMainCount(b) - seatLandCount(b));
      });

      const seat = fitSeats[0];
      const lands = seatLandCount(seat);
      if (item.isLand && lands >= MAX_LANDS) continue;
      if (!item.isLand && lands < MIN_LANDS && seatMainCount(seat) - lands >= MAIN_SIZE - MIN_LANDS) {
        continue;
      }
      if (addToSeat(seat, item, 1)) progress = true;
    }
  }

  for (const seat of seats) fillSeatSynergy(seat, pool);
}

function assignBalancedStrategy(seats: Seat[], pool: PoolItem[]): void {
  const order: number[] = [];
  let forward = true;
  while (order.length < seats.length * MAIN_SIZE) {
    if (forward) {
      for (let i = 0; i < seats.length; i++) order.push(i);
    } else {
      for (let i = seats.length - 1; i >= 0; i--) order.push(i);
    }
    forward = !forward;
  }

  for (const seatIdx of order) {
    const seat = seats[seatIdx];
    if (seatMainCount(seat) >= MAIN_SIZE) continue;

    const lands = seatLandCount(seat);
    const nonlands = seatMainCount(seat) - lands;
    let candidates: PoolItem[];
    if (lands < TARGET_LANDS && nonlands >= MAIN_SIZE - TARGET_LANDS) {
      candidates = fittingForSeat(pool, seat, { landsOnly: true });
      if (!candidates.length) candidates = fittingForSeat(pool, seat);
    } else if (lands >= MAX_LANDS) {
      candidates = fittingForSeat(pool, seat, { nonlandsOnly: true });
      if (!candidates.length) candidates = fittingForSeat(pool, seat);
    } else {
      candidates = fittingForSeat(pool, seat, { nonlandsOnly: true });
      if (!candidates.length) candidates = fittingForSeat(pool, seat);
    }
    if (!candidates.length) continue;
    candidates.sort((a, b) => seatCardScore(seat, b) - seatCardScore(seat, a));
    addToSeat(seat, candidates[0], 1);
  }

  for (const seat of seats) fillSeatSynergy(seat, pool);
}

function addBasicToSeat(seat: Seat, name: string, qty: number): void {
  if (qty <= 0) return;
  const key = normalizeName(name);
  const existing = seat.main.get(key);
  if (existing) {
    existing.quantity += qty;
    return;
  }
  seat.main.set(key, {
    quantity: qty,
    card: {
      id: `basic-${key}`,
      name,
      type_line: "Basic Land - " + name,
      color_identity: [...seat.ci],
      legalities: { commander: "legal" },
    },
    isLand: true,
    score: 2,
  });
}

function coalesceMainByDisplayName(seat: Seat): void {
  const merged = new Map<
    string,
    { quantity: number; card: ScryfallCard; isLand: boolean; score: number }
  >();
  for (const entry of seat.main.values()) {
    if (entry.quantity <= 0) continue;
    if (!isLegalInCommander(entry.card) && !entry.isLand) continue;
    const key = normalizeName(displayName(entry.card));
    const prev = merged.get(key);
    if (prev) {
      prev.quantity += entry.quantity;
      prev.score = Math.max(prev.score, entry.score);
    } else {
      merged.set(key, {
        quantity: entry.quantity,
        card: entry.card,
        isLand: entry.isLand,
        score: entry.score,
      });
    }
  }
  seat.main = merged;
}

/** Swap worst nonlands for basics until land count is in band (when short). */
function rebalanceLands(seat: Seat): void {
  while (seatLandCount(seat) < MIN_LANDS && seatMainCount(seat) >= MAIN_SIZE) {
    let worstKey: string | null = null;
    let worstScore = Infinity;
    for (const [key, e] of seat.main) {
      if (e.isLand) continue;
      if (e.score < worstScore) {
        worstScore = e.score;
        worstKey = key;
      }
    }
    if (!worstKey) break;
    const e = seat.main.get(worstKey)!;
    e.quantity -= 1;
    if (e.quantity <= 0) seat.main.delete(worstKey);
    const basic = basicLandsFor(seat.ci, 1)[0]?.name ?? "Wastes";
    addBasicToSeat(seat, basic, 1);
  }

  // Too many lands: cut lowest-scored lands (basics first) if we somehow exceeded
  // and have room conceptually — only when over MAIN_SIZE handled elsewhere.
  while (seatLandCount(seat) > MAX_LANDS && seatMainCount(seat) > MAIN_SIZE) {
    let key =
      [...seat.main.keys()].find((k) =>
        ["plains", "island", "swamp", "mountain", "forest", "wastes"].includes(k),
      ) ?? null;
    if (!key) {
      let worst: string | null = null;
      let worstScore = Infinity;
      for (const [k, e] of seat.main) {
        if (!e.isLand) continue;
        if (e.score < worstScore) {
          worstScore = e.score;
          worst = k;
        }
      }
      key = worst;
    }
    if (!key) break;
    const e = seat.main.get(key)!;
    e.quantity -= 1;
    if (e.quantity <= 0) seat.main.delete(key);
  }
}

function forceMainSize(seat: Seat): { trimmed: number; padded: number } {
  const cmdKey = normalizeName(displayName(seat.commander));
  seat.main.delete(cmdKey);
  coalesceMainByDisplayName(seat);

  // Strip any illegal leftovers
  for (const [key, e] of [...seat.main.entries()]) {
    if (!isLegalInCommander(e.card)) seat.main.delete(key);
  }

  let trimmed = 0;
  while (seatMainCount(seat) > MAIN_SIZE) {
    let worstKey: string | null = null;
    let worstScore = Infinity;
    for (const [key, e] of seat.main) {
      if (e.isLand) continue;
      if (e.score < worstScore) {
        worstScore = e.score;
        worstKey = key;
      }
    }
    if (!worstKey) {
      worstScore = Infinity;
      for (const [key, e] of seat.main) {
        if (e.score < worstScore) {
          worstScore = e.score;
          worstKey = key;
        }
      }
    }
    if (!worstKey) break;
    const e = seat.main.get(worstKey)!;
    e.quantity -= 1;
    trimmed += 1;
    if (e.quantity <= 0) seat.main.delete(worstKey);
  }

  rebalanceLands(seat);

  let padded = 0;
  // Prefer hitting land target when padding
  while (seatMainCount(seat) < MAIN_SIZE) {
    const needLands = seatLandCount(seat) < TARGET_LANDS;
    const name = needLands
      ? (basicLandsFor(seat.ci, 1)[0]?.name ?? "Wastes")
      : (basicLandsFor(seat.ci, 1)[0]?.name ?? "Wastes");
    addBasicToSeat(seat, name, 1);
    padded += 1;
  }

  while (seatMainCount(seat) > MAIN_SIZE) {
    let key =
      [...seat.main.keys()].find((k) =>
        ["plains", "island", "swamp", "mountain", "forest", "wastes"].includes(k),
      ) ?? null;
    if (!key) key = seat.main.keys().next().value ?? null;
    if (!key) break;
    const e = seat.main.get(key)!;
    e.quantity -= 1;
    trimmed += 1;
    if (e.quantity <= 0) seat.main.delete(key);
  }

  rebalanceLands(seat);

  // Final size lock after rebalance
  while (seatMainCount(seat) < MAIN_SIZE) {
    addBasicToSeat(seat, basicLandsFor(seat.ci, 1)[0]?.name ?? "Wastes", 1);
    padded += 1;
  }
  while (seatMainCount(seat) > MAIN_SIZE) {
    let key =
      [...seat.main.keys()].find((k) =>
        ["plains", "island", "swamp", "mountain", "forest", "wastes"].includes(k),
      ) ?? seat.main.keys().next().value ?? null;
    if (!key) break;
    const e = seat.main.get(key)!;
    e.quantity -= 1;
    trimmed += 1;
    if (e.quantity <= 0) seat.main.delete(key);
  }

  return { trimmed, padded };
}

function finalizeSeat(seat: Seat, index: number): PoolDeck {
  const notes = [...seat.notes];
  const synHits = [...seat.main.keys()].filter((k) => (seat.synergy.get(k) ?? 0) > 0).length;
  if (seat.synergy.size > 0) {
    notes.push(`EDHREC synergy: ${synHits} pool cards matched recommendations.`);
  } else {
    notes.push("No EDHREC data for this commander - used local theme and power heuristics.");
  }
  const themeTags = [...seat.themes].filter((t) => !t.startsWith("tribal:")).slice(0, 6);
  if (themeTags.length) {
    notes.push(`Theme profile: ${themeTags.join(", ")}.`);
  }

  const { trimmed, padded } = forceMainSize(seat);

  if (trimmed > 0) {
    notes.push(`Trimmed ${trimmed} excess card${trimmed === 1 ? "" : "s"} to fit 99.`);
  }
  if (padded > 0) {
    notes.push(`Added ${padded} basic land${padded === 1 ? "" : "s"} to reach 99.`);
  }

  const landCount = seatLandCount(seat);
  notes.push(`${landCount} lands (target ${TARGET_LANDS}).`);

  const mainLines: DeckLine[] = [...seat.main.entries()]
    .filter(([, e]) => e.quantity > 0)
    .map(([, e]) => ({
      quantity: e.quantity,
      name: displayName(e.card),
      category: "Deck" as const,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));

  const mainQty = mainLines.reduce((s, l) => s + l.quantity, 0);
  if (mainQty !== MAIN_SIZE) {
    const deficit = MAIN_SIZE - mainQty;
    if (deficit > 0) {
      const name = basicLandsFor(seat.ci, 1)[0]?.name ?? "Wastes";
      mainLines.push({ quantity: deficit, name, category: "Deck" });
      notes.push(`Added ${deficit} ${name} to enforce 100-card deck.`);
    } else {
      let over = -deficit;
      for (let i = mainLines.length - 1; i >= 0 && over > 0; i--) {
        const take = Math.min(mainLines[i].quantity, over);
        mainLines[i].quantity -= take;
        over -= take;
        if (mainLines[i].quantity <= 0) mainLines.splice(i, 1);
      }
    }
  }

  const lines: DeckLine[] = [
    { quantity: 1, name: displayName(seat.commander), category: "Commander" },
    ...mainLines.filter((l) => l.quantity > 0),
  ];
  const list = toMoxfieldList(lines, false);
  const cardCount = lines.reduce((s, l) => s + l.quantity, 0);

  if (cardCount !== 100) {
    notes.push(`Warning: deck size is ${cardCount} (expected 100).`);
  }

  return {
    index,
    commanderName: displayName(seat.commander),
    colorIdentity: [...(seat.commander.color_identity ?? [])],
    list,
    lines,
    cardCount,
    notes,
  };
}

function buildPoolFromCards(
  parsed: DeckLine[],
  byName: Map<string, ScryfallCard>,
): { pool: PoolItem[]; unresolved: string[]; illegalSkipped: number } {
  const qtyByKey = new Map<string, number>();
  const unresolved: string[] = [];
  let illegalSkipped = 0;

  for (const line of parsed) {
    const key = normalizeName(line.name);
    const card = byName.get(key);
    if (!card) {
      unresolved.push(line.name);
      continue;
    }
    if (!isLegalInCommander(card)) {
      illegalSkipped += line.quantity;
      continue;
    }
    const isBasic = isBasicLandCard(card);
    const add = isBasic ? line.quantity : Math.min(line.quantity, 1);
    qtyByKey.set(key, (qtyByKey.get(key) ?? 0) + add);
  }

  const pool: PoolItem[] = [];
  for (const [key, quantity] of qtyByKey) {
    const card = byName.get(key)!;
    const isBasic = isBasicLandCard(card);
    pool.push({
      key,
      name: displayName(card),
      quantity: isBasic ? quantity : Math.min(quantity, 1),
      card,
      isBasic,
      isLand: isLandCard(card),
      isCommanderLegal: isValidCommander(card),
      baseScore: baseScoreCard(card),
      themes: tagCardThemes(card),
    });
  }

  return { pool, unresolved, illegalSkipped };
}

async function loadSeatSynergy(
  commander: ScryfallCard,
  onProgress?: (label: string) => void,
): Promise<Map<string, number>> {
  const name = displayName(commander);
  onProgress?.(`EDHREC synergy · ${name}…`);
  try {
    return await fetchCommanderSynergyScores(name);
  } catch {
    return new Map();
  }
}

export async function generatePoolDecks(opts: PoolDecksOptions): Promise<PoolDeck[]> {
  const deckCount = clampDeckCount(opts.deckCount);
  const strategy = opts.strategy;
  const onProgress = opts.onProgress;
  const totalSteps = 7;

  onProgress?.({ done: 0, total: totalSteps, label: "Parsing list…" });
  const parsed = await parseDeckListAsync(opts.listText);
  if (!parsed.length) throw new Error("No cards found in the list. Paste a deck/pool list.");

  const uniqueNames = [...new Set(parsed.map((l) => l.name.split(" // ")[0].trim()))];
  onProgress?.({ done: 1, total: totalSteps, label: `Looking up ${uniqueNames.length} cards…` });

  const cards = await collectionLookup(
    uniqueNames.map((name) => ({ name })),
    (done, total, label) => {
      onProgress?.({
        done: 1,
        total: totalSteps,
        label: label ?? `Looking up cards (${done}/${total})…`,
      });
    },
  );

  const byName = new Map<string, ScryfallCard>();
  for (const c of cards) byName.set(normalizeName(c.name), c);

  const { pool, unresolved, illegalSkipped } = buildPoolFromCards(parsed, byName);

  onProgress?.({ done: 2, total: totalSteps, label: "Ranking commanders (pool support)…" });

  const commanderCandidates = pool
    .filter((p) => p.isCommanderLegal && p.quantity > 0)
    .sort((a, b) => b.baseScore - a.baseScore);

  if (commanderCandidates.length < deckCount) {
    throw new Error(
      `Need at least ${deckCount} commander-legal cards in the pool; found ${commanderCandidates.length}.`,
    );
  }

  const ranked = await rankCommandersByPower(commanderCandidates);
  const seats: Seat[] = [];
  const usedCommanderKeys = new Set<string>();

  if (strategy === "greedy") {
    onProgress?.({ done: 3, total: totalSteps, label: "Building decks (greedy + themes)…" });
    for (let i = 0; i < deckCount; i++) {
      const cmd = pickGreedyCommander(ranked, usedCommanderKeys, pool);
      if (!cmd) throw new Error(`Could not pick commander for deck ${i + 1}.`);
      usedCommanderKeys.add(cmd.key);
      if (!takeFromPool(pool, cmd.key, 1)) {
        throw new Error(`Commander ${cmd.name} was already used.`);
      }
      const synergy = await loadSeatSynergy(cmd.card, (label) =>
        onProgress?.({ done: 3, total: totalSteps, label }),
      );
      const seat: Seat = {
        commander: cmd.card,
        ci: cmd.card.color_identity ?? [],
        main: new Map(),
        notes: [],
        synergy,
        themes: new Set(cmd.themes),
      };
      fillSeatSynergy(seat, pool);
      seats.push(seat);
    }
  } else {
    const picked = pickDiverseCommanders(ranked, deckCount, pool);
    onProgress?.({ done: 3, total: totalSteps, label: "Loading EDHREC synergy…" });

    for (const cmd of picked) {
      usedCommanderKeys.add(cmd.key);
      if (!takeFromPool(pool, cmd.key, 1)) {
        throw new Error(`Commander ${cmd.name} was already used.`);
      }
      const synergy = await loadSeatSynergy(cmd.card, (label) =>
        onProgress?.({ done: 3, total: totalSteps, label }),
      );
      seats.push({
        commander: cmd.card,
        ci: cmd.card.color_identity ?? [],
        main: new Map(),
        notes: [],
        synergy,
        themes: new Set(cmd.themes),
      });
    }

    onProgress?.({
      done: 4,
      total: totalSteps,
      label:
        strategy === "color"
          ? "Assigning by color + theme fit…"
          : "Snake-drafting by theme fit…",
    });

    if (strategy === "color") assignColorStrategy(seats, pool);
    else assignBalancedStrategy(seats, pool);
  }

  onProgress?.({ done: 5, total: totalSteps, label: "Balancing lands & finalizing…" });

  const orphans = availableItems(pool).filter((p) => !p.isBasic);
  const unusable = orphans.filter(
    (p) =>
      !seats.some((s) => canPlayInSeat(s, p) && seatMainCount(s) < MAIN_SIZE),
  );

  const decks = seats.map((seat, i) => finalizeSeat(seat, i + 1));

  onProgress?.({ done: 6, total: totalSteps, label: "Scoring power levels…" });
  for (let i = 0; i < decks.length; i++) {
    onProgress?.({
      done: 6,
      total: totalSteps,
      label: `Power analysis · deck ${i + 1} of ${decks.length}…`,
    });
    const deck = decks[i];
    if (!deck) continue;
    try {
      const power = await analyzeDeckPower(deck.lines);
      deck.power = power;
      deck.notes.push(
        `Power ${power.powerLevel.toFixed(2)}/10 · Bracket ${power.bracket} (${power.bracketLabel}).`,
      );
    } catch {
      deck.notes.push("Power analysis unavailable for this deck.");
    }
  }

  if (decks.length) {
    if (illegalSkipped > 0) {
      decks[0].notes.unshift(
        `Skipped ${illegalSkipped} card${illegalSkipped === 1 ? "" : "s"} not legal in Commander.`,
      );
    }
    if (unresolved.length) {
      decks[0].notes.push(
        `Skipped ${unresolved.length} unresolved name${unresolved.length === 1 ? "" : "s"} (not on Scryfall).`,
      );
    }
    if (unusable.length > 0) {
      decks[0].notes.push(
        `${unusable.length} legal nonbasic${unusable.length === 1 ? "" : "s"} left unused (wrong colors, full decks, or lower fit).`,
      );
    }
  }

  onProgress?.({ done: totalSteps, total: totalSteps, label: "Done" });
  return decks;
}

export { MIN_DECKS, clampDeckCount };
