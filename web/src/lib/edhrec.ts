import { collectionLookup, type ScryfallCard } from "./scryfall";
import { isAllowedEdhrecUrl } from "./safeUrl";
import { toMoxfieldList, type DeckLine } from "./moxfield";

type EdhrecCard = {
  name?: string;
  sanitized?: string;
  num_decks?: number;
  synergy?: number;
  url?: string;
  cards?: EdhrecCard[];
};

type EdhrecPage = {
  container?: {
    json_dict?: {
      card?: { name?: string; url?: string };
      cardlists?: Array<{
        header?: string;
        cardviews?: EdhrecCard[];
      }>;
    };
  };
  bracket_counts?: Record<string, number>;
  similar?: unknown;
};

type AverageDeckJson = {
  description?: string;
  deck?: Record<string, number> | string[];
  animals?: unknown;
};

export class EdhrecHttpError extends Error {
  readonly status: number;

  constructor(status: number, message?: string) {
    super(message || `EDHREC ${status}`);
    this.name = "EdhrecHttpError";
    this.status = status;
  }

  get isNotFound() {
    // S3 missing keys often surface as 403 Forbidden (no public listing).
    return this.status === 404 || this.status === 403;
  }
}

/**
 * EDHREC JSON fetch — separate from Scryfall's rate-limit queue.
 * Avoid custom headers so browsers skip CORS preflight (S3 403s are flaky with preflight).
 */
async function edhrecFetch<T>(url: string, opts?: { retries?: number }): Promise<T> {
  if (!isAllowedEdhrecUrl(url)) throw new Error("Blocked disallowed EDHREC URL");
  const retries = opts?.retries ?? 1;
  let attempt = 0;
  while (true) {
    try {
      const res = await fetch(url, { mode: "cors", credentials: "omit" });
      if (!res.ok) {
        throw new EdhrecHttpError(res.status, `EDHREC ${res.status}`);
      }
      return (await res.json()) as T;
    } catch (err) {
      if (err instanceof EdhrecHttpError) throw err;
      const transient =
        err instanceof TypeError ||
        (err instanceof Error &&
          /failed to fetch|networkerror|load failed|fetch failed/i.test(err.message));
      if (transient && attempt < retries) {
        attempt += 1;
        await new Promise((r) => setTimeout(r, 400 * attempt));
        continue;
      }
      if (transient) throw new Error("network error, try again");
      throw err;
    }
  }
}

/** Optional page: no retries — missing bracket paths should fail instantly. */
async function edhrecFetchOptional<T>(url: string): Promise<T | null> {
  try {
    return await edhrecFetch<T>(url, { retries: 0 });
  } catch (err) {
    if (err instanceof EdhrecHttpError && err.isNotFound) return null;
    // CORS-masked errors on missing S3 objects also look like TypeError — treat as missing.
    if (
      err instanceof TypeError ||
      (err instanceof Error && /failed to fetch|network error/i.test(err.message))
    ) {
      return null;
    }
    return null;
  }
}

/** Official Commander bracket labels / EDHREC path slugs. */
export const BRACKET_META: Record<number, { label: string; slug: string }> = {
  1: { label: "Exhibition", slug: "exhibition" },
  2: { label: "Core", slug: "core" },
  3: { label: "Upgraded", slug: "upgraded" },
  4: { label: "Optimized", slug: "optimized" },
  5: { label: "cEDH", slug: "cedh" },
};

export function clampBracket(bracket: number): number {
  const n = Math.round(Number(bracket));
  if (!Number.isFinite(n)) return 3;
  return Math.min(5, Math.max(1, n));
}

function bracketSlug(bracket: number): string {
  return BRACKET_META[clampBracket(bracket)].slug;
}

function slugifyCommander(name: string): string {
  return name
    .toLowerCase()
    .replace(/[/"']/g, "")
    .replace(/,\s+/g, "-")
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function normalizeCardName(name: string): string {
  return name.toLowerCase().split(" // ")[0].trim();
}

export function edhrecUrl(commanderName: string): string {
  return `https://edhrec.com/commanders/${slugifyCommander(commanderName)}`;
}

/** Deck counts per Commander bracket from EDHREC (keys 1–5). */
export async function fetchBracketCounts(
  name: string,
): Promise<Record<number, number> | null> {
  const slug = slugifyCommander(name.split(" // ")[0]);
  try {
    const page = await edhrecFetch<EdhrecPage>(
      `https://json.edhrec.com/pages/commanders/${slug}.json`,
      { retries: 1 },
    );
    const raw = page.bracket_counts;
    if (!raw) return null;
    const out: Record<number, number> = {};
    for (const [k, v] of Object.entries(raw)) {
      const n = Number(k);
      if (n >= 1 && n <= 5) out[n] = Number(v) || 0;
    }
    return out;
  } catch {
    return null;
  }
}

/**
 * True when EDHREC shows meaningful play for this commander in `bracket`.
 * Bracket 5 (cEDH) is intentionally strict — fringe “tagged cEDH” decks don’t count.
 */
export function fitsBracketCounts(
  counts: Record<number, number> | null | undefined,
  bracket: number,
): boolean {
  if (!counts) return false;
  const b = clampBracket(bracket);
  const n = counts[b] ?? 0;
  if (n <= 0) return false;

  const total = Object.values(counts).reduce((s, v) => s + v, 0);
  if (total <= 0) return false;

  // Absolute floor before we even look at share.
  const minAbs: Record<number, number> = { 1: 5, 2: 12, 3: 20, 4: 40, 5: 200 };
  if (n < (minAbs[b] ?? 10)) return false;

  const share = n / total;
  // Either a real share of this commander’s decks, or enough absolute volume that
  // they’re established even if also popular in lower brackets (e.g. Kenrith).
  const shareFloor: Record<number, number> = { 1: 0.03, 2: 0.05, 3: 0.08, 4: 0.12, 5: 0.2 };
  const strongAbs: Record<number, number> = { 1: 25, 2: 60, 3: 100, 4: 200, 5: 500 };
  return share >= (shareFloor[b] ?? 0.05) || n >= (strongAbs[b] ?? 50);
}

export async function commanderUsedInBracket(
  name: string,
  bracket: number,
  cache?: Map<string, Record<number, number> | null>,
): Promise<boolean> {
  const key = normalizeCardName(name);
  let counts: Record<number, number> | null;
  if (cache?.has(key)) {
    counts = cache.get(key) ?? null;
  } else {
    counts = await fetchBracketCounts(name);
    cache?.set(key, counts);
  }
  return fitsBracketCounts(counts, bracket);
}

/** Popular commander names from EDHREC week/month/year lists (deduped). */
export async function fetchPopularCommanderNames(): Promise<string[]> {
  const names: string[] = [];
  const seen = new Set<string>();
  for (const period of ["week", "month", "year"] as const) {
    try {
      const page = await edhrecFetch<{
        container?: {
          json_dict?: {
            cardlists?: Array<{ cardviews?: Array<{ name?: string }> }>;
          };
        };
      }>(`https://json.edhrec.com/pages/commanders/${period}.json`, { retries: 1 });
      for (const list of page.container?.json_dict?.cardlists ?? []) {
        for (const card of list.cardviews ?? []) {
          const name = card.name?.trim();
          if (!name) continue;
          const key = normalizeCardName(name);
          if (seen.has(key)) continue;
          seen.add(key);
          names.push(name);
        }
      }
    } catch {
      // Optional enrichment — ignore period failures
    }
  }
  return names;
}

export async function fetchEdhrecCommander(name: string, bracket?: number): Promise<EdhrecPage> {
  const slug = slugifyCommander(name);
  if (bracket != null) {
    const b = bracketSlug(bracket);
    const bracketed = await edhrecFetchOptional<EdhrecPage>(
      `https://json.edhrec.com/pages/commanders/${slug}/${b}.json`,
    );
    if (bracketed) return bracketed;
  }
  return edhrecFetch<EdhrecPage>(`https://json.edhrec.com/pages/commanders/${slug}.json`);
}

/**
 * Prefer EDHREC's budget commander recommendations; fall back to the main page.
 */
export async function fetchEdhrecCommanderBudget(name: string): Promise<EdhrecPage> {
  const slug = slugifyCommander(name.split(" // ")[0]);
  const budgeted = await edhrecFetchOptional<EdhrecPage>(
    `https://json.edhrec.com/pages/commanders/${slug}/budget.json`,
  );
  if (budgeted?.container?.json_dict?.cardlists?.length) return budgeted;
  return fetchEdhrecCommander(name);
}

/**
 * Prefer the bracket-specific average deck page when `bracket` is set.
 * Returns null when that bracket page is missing (no overall fallback).
 */
export async function fetchAverageDeckJson(
  name: string,
  bracket?: number,
): Promise<{ data: AverageDeckJson; bracketSpecific: boolean } | null> {
  const slug = slugifyCommander(name);
  if (bracket != null) {
    const b = bracketSlug(bracket);
    const bracketed = await edhrecFetchOptional<AverageDeckJson>(
      `https://json.edhrec.com/pages/average-decks/${slug}/${b}.json`,
    );
    if (bracketed?.deck) return { data: bracketed, bracketSpecific: true };
    return null;
  }
  try {
    const data = await edhrecFetch<AverageDeckJson>(
      `https://json.edhrec.com/pages/average-decks/${slug}.json`,
      { retries: 2 },
    );
    return { data, bracketSpecific: false };
  } catch {
    return null;
  }
}

/** EDHREC average-decks budget list (often shorter than 99; names only). */
export async function fetchBudgetAverageDeckNames(name: string): Promise<string[]> {
  const slug = slugifyCommander(name.split(" // ")[0]);
  const page = await edhrecFetchOptional<AverageDeckJson>(
    `https://json.edhrec.com/pages/average-decks/${slug}/budget.json`,
  );
  if (!page?.deck) return [];
  const names: string[] = [];
  if (Array.isArray(page.deck)) {
    for (const entry of page.deck) {
      const m = String(entry).match(/^(\d+)\s+(.+)$/);
      names.push((m ? m[2] : String(entry)).trim());
    }
  } else {
    names.push(...Object.keys(page.deck));
  }
  return names.filter(Boolean);
}

export type EdhrecPoolCard = {
  name: string;
  synergy: number;
  numDecks: number;
  header: string;
  /** Appears on the target bracket’s EDHREC page or average deck. */
  inBracket: boolean;
};

const SKIP_POOL_HEADERS = /game\s*changers|new\s*cards/i;

/**
 * Flatten EDHREC cardlists into a ranked synergy pool.
 * Skips Game Changers (and New Cards) unless `includeGameChangers` is set.
 */
export function edhrecCardPool(
  page: EdhrecPage,
  opts?: { includeGameChangers?: boolean },
): EdhrecPoolCard[] {
  const byName = new Map<string, EdhrecPoolCard>();
  const includeGc = Boolean(opts?.includeGameChangers);

  for (const list of page.container?.json_dict?.cardlists ?? []) {
    const header = list.header?.trim() || "Cards";
    if (!includeGc && SKIP_POOL_HEADERS.test(header)) continue;
    for (const card of list.cardviews ?? []) {
      const name = card.name?.trim();
      if (!name) continue;
      const key = normalizeCardName(name);
      const synergy = Number(card.synergy) || 0;
      const numDecks = Number(card.num_decks) || 0;
      const existing = byName.get(key);
      if (!existing || synergy > existing.synergy || (synergy === existing.synergy && numDecks > existing.numDecks)) {
        byName.set(key, {
          name: name.split(" // ")[0],
          synergy,
          numDecks,
          header,
          inBracket: false,
        });
      }
    }
  }

  return [...byName.values()].sort((a, b) => {
    if (b.synergy !== a.synergy) return b.synergy - a.synergy;
    return b.numDecks - a.numDecks;
  });
}

/**
 * Synergy scores for cards commonly played with a commander (EDHREC).
 * Prefers Optimized (4) then Upgraded (3) pages, then overall.
 * Average-deck inclusions get a large bonus so builds lean staples / high power.
 */
export async function fetchCommanderSynergyScores(
  commanderName: string,
): Promise<Map<string, number>> {
  const scores = new Map<string, number>();
  const name = commanderName.split(" // ")[0].trim();
  if (!name) return scores;

  let page: EdhrecPage | null = null;
  for (const bracket of [4, 3] as const) {
    try {
      page = await fetchEdhrecCommander(name, bracket);
      if (page?.container?.json_dict?.cardlists?.length) break;
    } catch {
      page = null;
    }
  }
  if (!page) {
    try {
      page = await fetchEdhrecCommander(name);
    } catch {
      return scores;
    }
  }

  for (const c of edhrecCardPool(page, { includeGameChangers: true })) {
    const key = normalizeCardName(c.name);
    // EDHREC synergy is typically a small fraction; amplify with deck-count signal.
    const s = c.synergy * 200 + Math.log10((c.numDecks || 0) + 1) * 14;
    scores.set(key, Math.max(scores.get(key) ?? 0, s));
  }

  for (const bracket of [4, 3, undefined] as const) {
    try {
      const avg = await fetchAverageDeckJson(name, bracket);
      if (!avg?.data) continue;
      for (const cardName of namesFromAverageDeck(avg.data)) {
        const key = normalizeCardName(cardName);
        scores.set(key, (scores.get(key) ?? 0) + 90);
      }
      break;
    } catch {
      // try next bracket
    }
  }

  return scores;
}

function namesFromAverageDeck(avg: AverageDeckJson): string[] {
  if (!avg.deck) return [];
  if (Array.isArray(avg.deck)) {
    return avg.deck
      .map((entry) => {
        const m = String(entry).match(/^(\d+)\s+(.+)$/);
        return (m ? m[2] : String(entry)).trim();
      })
      .filter(Boolean);
  }
  return Object.keys(avg.deck);
}

/**
 * Build a replacement pool biased to a target Commander bracket.
 * Bracket page + average deck are preferred; lower brackets also pull budget fillers.
 */
export async function fetchCheapEdhrecPool(
  commanderName: string,
  bracket = 3,
): Promise<EdhrecPoolCard[]> {
  const b = clampBracket(bracket);
  const cmdKey = normalizeCardName(commanderName);
  const byName = new Map<string, EdhrecPoolCard>();

  const upsert = (card: EdhrecPoolCard) => {
    const key = normalizeCardName(card.name);
    if (key === cmdKey) return;
    const existing = byName.get(key);
    if (!existing) {
      byName.set(key, { ...card });
      return;
    }
    const next: EdhrecPoolCard = {
      ...existing,
      inBracket: existing.inBracket || card.inBracket,
    };
    if (
      card.synergy > next.synergy ||
      (card.synergy === next.synergy && card.numDecks > next.numDecks)
    ) {
      next.name = card.name;
      next.synergy = card.synergy;
      next.numDecks = card.numDecks;
      next.header = card.header;
    }
    byName.set(key, next);
  };

  // —— Target bracket recommendations ——
  try {
    const bracketPage = await fetchEdhrecCommander(commanderName, b);
    for (const c of edhrecCardPool(bracketPage, { includeGameChangers: b >= 5 })) {
      upsert({ ...c, inBracket: true });
    }
  } catch {
    // fall through to budget / overall
  }

  const avg = await fetchAverageDeckJson(commanderName, b);
  if (avg?.bracketSpecific) {
    for (const name of namesFromAverageDeck(avg.data)) {
      upsert({
        name: name.split(" // ")[0],
        synergy: 0.01,
        numDecks: 1,
        header: `Bracket ${b} average`,
        inBracket: true,
      });
    }
  }

  // —— Budget fillers (stronger for lower brackets) ——
  if (b <= 4) {
    try {
      const budgetPage = await fetchEdhrecCommanderBudget(commanderName);
      for (const c of edhrecCardPool(budgetPage)) {
        upsert({ ...c, inBracket: false });
      }
    } catch {
      // optional
    }
    try {
      for (const name of await fetchBudgetAverageDeckNames(commanderName)) {
        upsert({
          name: name.split(" // ")[0],
          synergy: 0,
          numDecks: 0,
          header: "Budget average",
          inBracket: false,
        });
      }
    } catch {
      // optional
    }
  }

  // Overall page fallback if bracket data was thin
  if (byName.size < 20) {
    try {
      const overall = await fetchEdhrecCommander(commanderName);
      for (const c of edhrecCardPool(overall, { includeGameChangers: b >= 5 })) {
        upsert({ ...c, inBracket: false });
      }
    } catch {
      // optional
    }
  }

  return [...byName.values()].sort((a, b) => {
    if (a.inBracket !== b.inBracket) return a.inBracket ? -1 : 1;
    if (b.synergy !== a.synergy) return b.synergy - a.synergy;
    return b.numDecks - a.numDecks;
  });
}

function isCommanderName(name: string, commander: ScryfallCard): boolean {
  const n = normalizeCardName(name);
  const cmd = normalizeCardName(commander.name);
  if (n === cmd) return true;
  for (const face of commander.card_faces ?? []) {
    if (normalizeCardName(face.name) === n) return true;
  }
  return false;
}

/** Collapse duplicate names and ensure positive quantities. */
function coalesceLines(lines: DeckLine[]): DeckLine[] {
  const map = new Map<string, DeckLine>();
  for (const line of lines) {
    if (line.quantity <= 0) continue;
    const key = normalizeCardName(line.name);
    const existing = map.get(key);
    if (existing) existing.quantity += line.quantity;
    else map.set(key, { ...line, name: line.name.split(" // ")[0] });
  }
  return [...map.values()];
}

/**
 * Trim or pad the 99-card main deck (commander lives separately).
 * Always returns lines that sum to exactly `target`.
 */
function fitDeckSize(lines: DeckLine[], target: number, colorId: string[]): DeckLine[] {
  let deck = coalesceLines(lines.filter((l) => l.quantity > 0));
  let total = deck.reduce((s, l) => s + l.quantity, 0);

  if (total > target) {
    let over = total - target;
    for (let i = deck.length - 1; i >= 0 && over > 0; i--) {
      const take = Math.min(deck[i].quantity, over);
      deck[i].quantity -= take;
      over -= take;
    }
    deck = deck.filter((l) => l.quantity > 0);
    total = deck.reduce((s, l) => s + l.quantity, 0);
  }

  if (total < target) {
    deck = deck.concat(basicLandsFor(colorId, target - total));
  }

  deck = coalesceLines(deck);
  total = deck.reduce((s, l) => s + l.quantity, 0);
  if (total !== target) {
    const landIdx = deck.findIndex((l) =>
      ["Plains", "Island", "Swamp", "Mountain", "Forest", "Wastes"].includes(l.name),
    );
    if (landIdx >= 0) {
      deck[landIdx].quantity += target - total;
      if (deck[landIdx].quantity <= 0) deck.splice(landIdx, 1);
    } else if (total < target) {
      deck.push(...basicLandsFor(colorId, target - total));
    }
  }

  return coalesceLines(deck);
}

function linesFromAverageDeck(avg: AverageDeckJson, commander: ScryfallCard): DeckLine[] {
  const main: DeckLine[] = [];
  if (!avg.deck) return main;

  if (Array.isArray(avg.deck)) {
    for (const entry of avg.deck) {
      const m = String(entry).match(/^(\d+)\s+(.+)$/);
      const qty = m ? Number(m[1]) : 1;
      const name = m ? m[2] : String(entry);
      if (isCommanderName(name, commander)) continue;
      main.push({ quantity: qty, name, category: "Deck" });
    }
  } else {
    for (const [name, qty] of Object.entries(avg.deck)) {
      if (isCommanderName(name, commander)) continue;
      main.push({ quantity: Number(qty) || 1, name, category: "Deck" });
    }
  }
  return main;
}

/** Build an "average" deck from EDHREC data for the selected bracket. Always 100 cards. */
export async function generateAverageDeck(
  commander: ScryfallCard,
  bracket: number,
): Promise<{ list: string; lines: DeckLine[]; source: string }> {
  const colorId = commander.color_identity ?? [];
  const b = clampBracket(bracket);
  const meta = BRACKET_META[b];
  const commanderName = commander.name.split(" // ")[0];

  const counts = await fetchBracketCounts(commanderName);
  const bracketDecks = counts?.[b] ?? 0;
  if (bracketDecks <= 0) {
    throw new Error(
      `No EDHREC decks found for Bracket ${b} (${meta.label}) with ${commanderName}. Try another bracket.`,
    );
  }

  const avg = await fetchAverageDeckJson(commanderName, b);
  if (!avg?.data.deck || !avg.bracketSpecific) {
    throw new Error(
      `No EDHREC average deck for Bracket ${b} (${meta.label}) with ${commanderName}. Try another bracket.`,
    );
  }

  let main = linesFromAverageDeck(avg.data, commander);
  const sampleSize = main.reduce((s, l) => s + l.quantity, 0);
  if (sampleSize < 20) {
    throw new Error(
      `Not enough Bracket ${b} (${meta.label}) deck data on EDHREC for ${commanderName}. Try another bracket.`,
    );
  }

  const source = `EDHREC average deck · Bracket ${b} (${meta.label})`;

  main = main.filter((l) => !isCommanderName(l.name, commander));
  main = fitDeckSize(main, 99, colorId);

  const lines: DeckLine[] = [
    {
      quantity: 1,
      name: commander.name,
      setCode: commander.set,
      collectorNumber: commander.collector_number,
      category: "Commander",
    },
    ...main.map((l) => ({ ...l, category: "Deck" as const })),
  ];

  // Attach set + collector numbers so HXDEC / Moxfield exports match the selected format.
  try {
    const names = [...new Set(lines.map((l) => l.name.split(" // ")[0].trim()))];
    const resolved = await collectionLookup(names.map((name) => ({ name })));
    const byName = new Map<string, ScryfallCard>();
    for (const c of resolved) {
      byName.set(c.name.toLowerCase().split(" // ")[0], c);
      byName.set(c.name.toLowerCase(), c);
    }
    for (const line of lines) {
      if (line.setCode && line.collectorNumber) continue;
      const card = byName.get(line.name.toLowerCase().split(" // ")[0]);
      if (!card) continue;
      line.setCode = card.set;
      line.collectorNumber = card.collector_number;
      if (!line.name.includes(" // ")) line.name = card.name.split(" // ")[0];
    }
  } catch {
    /* export still works without set codes for non-HXDEC formats */
  }

  const list = toMoxfieldList(lines, true);
  const total = lines.reduce((s, l) => s + l.quantity, 0);
  if (total !== 100) {
    throw new Error(`Deck size invariant failed: got ${total} cards (expected 100)`);
  }

  return { list, lines, source };
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
