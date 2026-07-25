import type { ScryfallCard } from "./scryfall";
import { scryfallFetch } from "./scryfall";
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
  similar?: unknown;
};

type AverageDeckJson = {
  description?: string;
  deck?: Record<string, number> | string[];
  animals?: unknown;
};

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

export async function fetchEdhrecCommander(name: string, bracket?: number): Promise<EdhrecPage> {
  const slug = slugifyCommander(name);
  if (bracket != null) {
    const b = bracketSlug(bracket);
    try {
      return await scryfallFetch<EdhrecPage>(
        `https://json.edhrec.com/pages/commanders/${slug}/${b}.json`,
      );
    } catch {
      // Fall through to unfiltered commander page
    }
  }
  return scryfallFetch<EdhrecPage>(`https://json.edhrec.com/pages/commanders/${slug}.json`);
}

/**
 * Prefer the bracket-specific average deck page when `bracket` is set.
 * Falls back to the overall average if the bracket page is missing.
 */
export async function fetchAverageDeckJson(
  name: string,
  bracket?: number,
): Promise<{ data: AverageDeckJson; bracketSpecific: boolean } | null> {
  const slug = slugifyCommander(name);
  if (bracket != null) {
    const b = bracketSlug(bracket);
    try {
      const data = await scryfallFetch<AverageDeckJson>(
        `https://json.edhrec.com/pages/average-decks/${slug}/${b}.json`,
      );
      return { data, bracketSpecific: true };
    } catch {
      // Fall through to overall average
    }
  }
  try {
    const data = await scryfallFetch<AverageDeckJson>(
      `https://json.edhrec.com/pages/average-decks/${slug}.json`,
    );
    return { data, bracketSpecific: false };
  } catch {
    return null;
  }
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

async function assembleFromTopCards(
  commander: ScryfallCard,
  bracket: number,
): Promise<DeckLine[]> {
  const page = await fetchEdhrecCommander(commander.name.split(" // ")[0], bracket);
  const lists = page.container?.json_dict?.cardlists ?? [];
  const pool: string[] = [];
  for (const list of lists) {
    for (const card of list.cardviews ?? []) {
      if (card.name && !isCommanderName(card.name, commander)) pool.push(card.name);
    }
  }

  const unique = [...new Set(pool)];
  const nonlandTarget = bracket >= 4 ? 62 : bracket <= 2 ? 55 : 58;
  const picked = unique.slice(0, nonlandTarget);
  const main: DeckLine[] = picked.map((name) => ({ quantity: 1, name, category: "Deck" }));
  const landCount = Math.max(0, 99 - picked.length);
  return main.concat(
    basicLandsFor(commander.color_identity ?? [], landCount).map((l) => ({
      ...l,
      category: "Deck" as const,
    })),
  );
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

  const avg = await fetchAverageDeckJson(commanderName, b);
  let main: DeckLine[] = [];
  let source: string;

  if (avg?.data.deck) {
    main = linesFromAverageDeck(avg.data, commander);
    source = avg.bracketSpecific
      ? `EDHREC average deck · Bracket ${b} (${meta.label})`
      : `EDHREC average deck (overall; no Bracket ${b} sample)`;
  } else {
    main = await assembleFromTopCards(commander, b);
    source = `EDHREC top cards · Bracket ${b} (${meta.label})`;
  }

  main = main.filter((l) => !isCommanderName(l.name, commander));
  main = fitDeckSize(main, 99, colorId);

  const lines: DeckLine[] = [
    { quantity: 1, name: commander.name, category: "Commander" },
    ...main.map((l) => ({ ...l, category: "Deck" as const })),
  ];

  const list = toMoxfieldList(lines, false);
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
