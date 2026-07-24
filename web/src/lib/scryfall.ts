export type ScryfallCard = {
  id: string;
  name: string;
  mana_cost?: string;
  cmc?: number;
  type_line: string;
  oracle_text?: string;
  colors?: string[];
  color_identity: string[];
  rarity?: string;
  set?: string;
  set_name?: string;
  collector_number?: string;
  layout?: string;
  digital?: boolean;
  games?: string[];
  prints_search_uri?: string;
  prices?: { usd: string | null; usd_foil: string | null };
  image_uris?: {
    small: string;
    normal: string;
    large: string;
    png: string;
    art_crop: string;
    border_crop: string;
  };
  card_faces?: Array<{
    name: string;
    mana_cost?: string;
    type_line?: string;
    oracle_text?: string;
    image_uris?: ScryfallCard["image_uris"];
  }>;
  keywords?: string[];
  legalities?: Record<string, string>;
  frame_effects?: string[];
  finishes?: string[];
  border_color?: string;
  full_art?: boolean;
  textless?: boolean;
  promo?: boolean;
};

export type ScryfallList = {
  object: string;
  total_cards?: number;
  has_more?: boolean;
  next_page?: string;
  data: ScryfallCard[];
};

const BASE = "https://api.scryfall.com";

/** Local branded card back used before the first flip. */
export const CARD_BACK_URL = "/card-back.svg";

let lastRequest = 0;
let throttleChain: Promise<void> = Promise.resolve();

/** Scryfall asks ~50–100ms between requests; stay conservative for ~100-card decks. */
const SCRYFALL_MIN_GAP_MS = 125;

/** Serialize requests so parallel callers still respect Scryfall's rate limit. */
async function throttle() {
  const run = throttleChain.then(async () => {
    const now = Date.now();
    const wait = Math.max(0, SCRYFALL_MIN_GAP_MS - (now - lastRequest));
    if (wait) await new Promise((r) => setTimeout(r, wait));
    lastRequest = Date.now();
  });
  // Keep the chain alive even if a caller fails after awaiting throttle
  throttleChain = run.catch(() => {});
  await run;
}

export async function scryfallFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const url = path.startsWith("http") ? path : `${BASE}${path}`;
  let attempt = 0;
  while (true) {
    await throttle();
    const res = await fetch(url, {
      ...init,
      headers: {
        Accept: "application/json",
        // Scryfall rejects generic library UAs; browsers already send a real UA
        // (forbidden header — ignored). Helps Node/tests and embedded runtimes.
        "User-Agent": "MagicGen/1.0 (https://github.com/MagicGen)",
        ...(init?.headers ?? {}),
      },
    });
    if (res.status === 429 && attempt < 5) {
      attempt += 1;
      const retryAfterHeader = res.headers.get("Retry-After");
      const retryAfterSec = retryAfterHeader ? Number(retryAfterHeader) : NaN;
      const fromHeader = Number.isFinite(retryAfterSec) ? retryAfterSec * 1000 : 0;
      // Backoff: honor Retry-After, else 1s · 2s · 4s… (capped)
      const backoff = fromHeader > 0 ? fromHeader : Math.min(8000, 1000 * 2 ** (attempt - 1));
      await new Promise((r) => setTimeout(r, backoff));
      continue;
    }
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`Scryfall ${res.status}: ${text || res.statusText}`);
    }
    return res.json() as Promise<T>;
  }
}

export function getCardImage(card: ScryfallCard, size: "normal" | "large" | "png" = "normal") {
  if (card.image_uris?.[size]) return card.image_uris[size];
  const face = card.card_faces?.find((f) => f.image_uris?.[size]);
  if (face?.image_uris?.[size]) return face.image_uris[size];
  // Fallbacks when a size is missing (e.g. some cards lack png)
  if (size === "png") {
    return getCardImage(card, "large");
  }
  if (size === "large") {
    return getCardImage(card, "normal");
  }
  return CARD_BACK_URL;
}

export function getOracleText(card: ScryfallCard) {
  if (card.oracle_text) return card.oracle_text;
  return (
    card.card_faces
      ?.map((f) => `${f.name}\n${f.oracle_text ?? ""}`)
      .join("\n\n") ?? ""
  );
}

export function getManaCost(card: ScryfallCard) {
  return card.mana_cost || card.card_faces?.[0]?.mana_cost || "";
}

export type CommanderFilters = {
  colors?: string[];
  colorMode?: "exact" | "include" | "atMost";
  playstyle?: string;
  set?: string;
  partners?: boolean;
  queryExtra?: string;
};

const PLAYSTYLE_QUERIES: Record<string, string> = {
  aggro: "(o:haste OR o:attack OR keyword:haste OR type:warrior)",
  control: "(o:counter OR o:destroy OR o:exile target)",
  tokens: "(o:create OR o:token)",
  aristocrats: "(o:dies OR o:sacrifice)",
  spellslinger: "(o:instant OR o:sorcery OR type:wizard)",
  voltron: "(o:equip OR o:aura OR o:attached)",
  stompy: "(o:trample OR power>=5)",
  lifegain: "(o:\"gain\" life OR o:\"life total\")",
  treasure: "(o:treasure)",
  reanimator: "(o:graveyard)",
};

export function buildCommanderQuery(filters: CommanderFilters): string {
  const parts = ["is:commander", "legal:commander", "-is:digital", "-is:token"];

  if (filters.partners) {
    parts.push(
      '(keyword:Partner OR o:"Partner with" OR keyword:"Friends forever" OR keyword:"Choose a Background" OR o:Background)',
    );
  }

  const colors = filters.colors?.filter(Boolean) ?? [];
  if (colors.length) {
    const id = colors.join("");
    const mode = filters.colorMode ?? "include";
    if (mode === "exact") parts.push(`id=${id}`);
    else if (mode === "atMost") parts.push(`id<=${id}`);
    else parts.push(`id>=${id}`);
  }

  if (filters.set?.trim()) {
    parts.push(`set:${filters.set.trim()}`);
  }

  if (filters.playstyle && PLAYSTYLE_QUERIES[filters.playstyle]) {
    parts.push(PLAYSTYLE_QUERIES[filters.playstyle]);
  }

  if (filters.queryExtra?.trim()) {
    parts.push(`(${filters.queryExtra.trim()})`);
  }

  return parts.join(" ");
}

export async function randomCommander(filters: CommanderFilters): Promise<ScryfallCard> {
  const q = encodeURIComponent(buildCommanderQuery(filters));
  try {
    return await scryfallFetch<ScryfallCard>(`/cards/random?q=${q}`);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (message.includes("404") || message.includes("No cards") || message.includes("not_found")) {
      throw new Error("no commanders within filters found");
    }
    throw err;
  }
}

export async function searchCards(query: string, page = 1): Promise<ScryfallList> {
  const q = encodeURIComponent(query);
  return scryfallFetch<ScryfallList>(`/cards/search?q=${q}&page=${page}`);
}

export async function namedCard(name: string): Promise<ScryfallCard> {
  const q = encodeURIComponent(name.trim());
  return scryfallFetch<ScryfallCard>(`/cards/named?fuzzy=${q}`);
}

export async function namedExact(name: string): Promise<ScryfallCard> {
  const q = encodeURIComponent(name.trim());
  return scryfallFetch<ScryfallCard>(`/cards/named?exact=${q}`);
}

export type CollectionIdentifier =
  | { name: string }
  | { id: string }
  | { set: string; collector_number: string };

export async function collectionLookup(idents: CollectionIdentifier[]): Promise<ScryfallCard[]> {
  const { cards } = await collectionLookupDetailed(idents);
  return cards;
}

export type CollectionLookupResult = {
  cards: ScryfallCard[];
  /** Original identifiers that Scryfall could not resolve */
  notFound: CollectionIdentifier[];
};

export async function collectionLookupDetailed(
  idents: CollectionIdentifier[],
): Promise<CollectionLookupResult> {
  const cards: ScryfallCard[] = [];
  const notFound: CollectionIdentifier[] = [];

  for (let i = 0; i < idents.length; i += 75) {
    const chunk = idents.slice(i, i + 75);
    const data = await scryfallFetch<{
      data: ScryfallCard[];
      not_found?: CollectionIdentifier[];
    }>("/cards/collection", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ identifiers: chunk }),
    });
    cards.push(...data.data);
    if (data.not_found?.length) notFound.push(...data.not_found);
  }

  return { cards, notFound };
}

export async function searchPrintings(name: string): Promise<ScryfallCard[]> {
  const escaped = normalizeCardNameForSearch(name);
  const q = encodeURIComponent(`!"${escaped}" unique:prints -is:digital`);
  return collectSearchPages(`/cards/search?q=${q}&order=released`, 200);
}

/** Fetch pages for a Scryfall search, optionally capped. Never throws — returns []. */
async function collectSearchPages(
  path: string,
  maxCards = 175,
): Promise<ScryfallCard[]> {
  const all: ScryfallCard[] = [];
  let url: string | undefined = path;
  try {
    while (url) {
      const page: ScryfallList = await scryfallFetch<ScryfallList>(url);
      all.push(...page.data);
      url = page.has_more && page.next_page ? page.next_page : undefined;
      if (all.length >= maxCards) break;
    }
  } catch {
    // 404 (no cards) / 400 (bad query) / exhausted 429 — caller may fall back
  }
  return all;
}

/**
 * Normalize deck-list names for Scryfall lookup.
 * Strips foil markers, Moxfield #tags, [SET] brackets, trailing (SET) CN,
 * and ASCII quotes. Keeps `//` for split/DFC full names.
 */
export function normalizeCardNameForSearch(name: string): string {
  let n = name.trim();
  // Foil markers anywhere at the end (possibly repeated)
  n = n.replace(/(?:\s+\*F\*)+$/i, "");
  // Moxfield / Archidekt tags: #Ramp, #maybe
  n = n.replace(/\s+#\S+/g, "");
  // Bracket set codes: [C21], [Commander 2021]
  n = n.replace(/\s+\[[^\]]*\]/g, "");
  // Trailing (SET) optional collector number — only when SET looks like a code
  n = n.replace(/\s+\(([a-z0-9]{2,5})\)(?:\s+[a-z0-9★☆✦]+)?$/i, "");
  // Straight double quotes (oracle names use them rarely; Scryfall exact prefers without)
  n = n.replace(/"/g, "");
  return n.trim();
}

function frontFaceName(name: string): string | null {
  const parts = name.split(/\s*\/\/\s*/);
  if (parts.length < 2) return null;
  const front = parts[0].trim();
  return front && front !== name ? front : null;
}

/** Paper playable printings only — filter in code, not via brittle search operators. */
function isPaperPrinting(card: ScryfallCard): boolean {
  if (card.digital) return false;
  if (card.layout === "art_series" || card.layout === "token" || card.layout === "double_faced_token") {
    return false;
  }
  if (card.games && card.games.length > 0 && !card.games.includes("paper")) return false;
  return true;
}

function mergePrintings(into: Map<string, ScryfallCard>, cards: ScryfallCard[]) {
  for (const card of cards) {
    if (!isPaperPrinting(card)) continue;
    if (!into.has(card.id)) into.set(card.id, card);
  }
}

/**
 * Resolve a card by exact name (full then front face), then fuzzy.
 * Returns null only when Scryfall cannot resolve the name at all.
 */
async function resolveNamedCard(name: string): Promise<ScryfallCard | null> {
  const candidates = [name];
  const front = frontFaceName(name);
  if (front) candidates.push(front);

  for (const candidate of candidates) {
    try {
      return await namedExact(candidate);
    } catch {
      /* try next */
    }
  }

  try {
    return await namedCard(name);
  } catch {
    if (front) {
      try {
        return await namedCard(front);
      } catch {
        /* fall through */
      }
    }
  }
  return null;
}

/** Paginate prints_search_uri; basics get a higher cap (many land arts). */
async function fetchPrintsFromUri(
  card: ScryfallCard,
  maxCards = 200,
): Promise<ScryfallCard[]> {
  const uri = card.prints_search_uri;
  if (!uri) return isPaperPrinting(card) ? [card] : [];
  const pages = await collectSearchPages(uri, maxCards);
  if (pages.length) return pages;
  return isPaperPrinting(card) ? [card] : [];
}

/**
 * Printings for deck pimping.
 *
 * Reliable pipeline (serialized via scryfallFetch throttle):
 * 1) Normalize the deck-list name
 * 2) Resolve via /cards/named (exact → fuzzy)
 * 3) Paginate card.prints_search_uri; filter digital / art series in code
 * 4) If still empty, simple `!"Name" unique:prints` search (± `-is:digital`)
 *
 * Special-treatment preference lives in scoring (`pimp.ts`), not in requiring
 * special-only search queries to succeed (those 404s caused false negatives).
 */
export async function searchPrintingsForPimp(name: string): Promise<ScryfallCard[]> {
  const primary = normalizeCardNameForSearch(name);
  if (!primary) return [];

  const byId = new Map<string, ScryfallCard>();

  // —— Primary: named → prints_search_uri ——
  const resolved = await resolveNamedCard(primary);
  if (resolved) {
    const isBasic = /\bbasic\b/i.test(resolved.type_line ?? "") && /\bland\b/i.test(resolved.type_line ?? "");
    mergePrintings(byId, await fetchPrintsFromUri(resolved, isBasic ? 350 : 200));
  }

  // —— Fallback search queries (never conclude empty from special-only filters) ——
  if (!byId.size) {
    const variants = [primary];
    const front = frontFaceName(primary);
    if (front) variants.push(front);

    for (const escaped of variants) {
      if (byId.size) break;
      const exact = `!"${escaped}" unique:prints`;
      mergePrintings(
        byId,
        await collectSearchPages(
          `/cards/search?q=${encodeURIComponent(`${exact} -is:digital`)}&order=released`,
          200,
        ),
      );
      if (!byId.size) {
        mergePrintings(
          byId,
          await collectSearchPages(
            `/cards/search?q=${encodeURIComponent(exact)}&order=released`,
            200,
          ),
        );
      }
    }
  }

  // Last resort: the single resolved printing itself
  if (!byId.size && resolved && isPaperPrinting(resolved)) {
    byId.set(resolved.id, resolved);
  }

  return [...byId.values()];
}

export const COLOR_OPTIONS = [
  { id: "W", label: "White" },
  { id: "U", label: "Blue" },
  { id: "B", label: "Black" },
  { id: "R", label: "Red" },
  { id: "G", label: "Green" },
] as const;

export const PLAYSTYLE_OPTIONS = [
  { id: "", label: "Any playstyle" },
  { id: "aggro", label: "Aggro" },
  { id: "control", label: "Control" },
  { id: "tokens", label: "Tokens" },
  { id: "aristocrats", label: "Aristocrats" },
  { id: "spellslinger", label: "Spellslinger" },
  { id: "voltron", label: "Voltron" },
  { id: "stompy", label: "Stompy" },
  { id: "lifegain", label: "Lifegain" },
  { id: "treasure", label: "Treasure" },
  { id: "reanimator", label: "Reanimator" },
] as const;

export function parseManaSymbols(cost: string): string[] {
  const matches = cost.match(/\{[^}]+\}/g);
  return matches?.map((m) => m.slice(1, -1)) ?? [];
}
