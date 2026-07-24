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

async function throttle() {
  const now = Date.now();
  const wait = Math.max(0, 80 - (now - lastRequest));
  if (wait) await new Promise((r) => setTimeout(r, wait));
  lastRequest = Date.now();
}

export async function scryfallFetch<T>(path: string, init?: RequestInit): Promise<T> {
  await throttle();
  const url = path.startsWith("http") ? path : `${BASE}${path}`;
  const res = await fetch(url, {
    ...init,
    headers: {
      Accept: "application/json",
      ...(init?.headers ?? {}),
    },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Scryfall ${res.status}: ${text || res.statusText}`);
  }
  return res.json() as Promise<T>;
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
  const out: ScryfallCard[] = [];
  for (let i = 0; i < idents.length; i += 75) {
    const chunk = idents.slice(i, i + 75);
    const data = await scryfallFetch<{ data: ScryfallCard[]; not_found?: unknown[] }>(
      "/cards/collection",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifiers: chunk }),
      },
    );
    out.push(...data.data);
  }
  return out;
}

export async function searchPrintings(name: string): Promise<ScryfallCard[]> {
  const q = encodeURIComponent(`!"${name}" unique:prints -is:digital`);
  const all: ScryfallCard[] = [];
  let url: string | undefined = `/cards/search?q=${q}&order=released`;
  while (url) {
    const page: ScryfallList = await scryfallFetch<ScryfallList>(url);
    all.push(...page.data);
    url = page.has_more && page.next_page ? page.next_page : undefined;
    if (all.length > 200) break;
  }
  return all;
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
