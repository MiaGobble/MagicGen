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

export function edhrecUrl(commanderName: string): string {
  return `https://edhrec.com/commanders/${slugifyCommander(commanderName)}`;
}

export async function fetchEdhrecCommander(name: string): Promise<EdhrecPage> {
  const slug = slugifyCommander(name);
  return scryfallFetch<EdhrecPage>(`https://json.edhrec.com/pages/commanders/${slug}.json`);
}

export async function fetchAverageDeckJson(name: string): Promise<{
  description?: string;
  deck?: Record<string, number> | string[];
  animals?: unknown;
} | null> {
  const slug = slugifyCommander(name);
  try {
    return await scryfallFetch(`https://json.edhrec.com/pages/average-decks/${slug}.json`);
  } catch {
    return null;
  }
}

/** Build an "average" deck from EDHREC top cards + basic lands. */
export async function generateAverageDeck(
  commander: ScryfallCard,
  bracket: number,
): Promise<{ list: string; lines: DeckLine[]; source: string }> {
  const colorId = commander.color_identity ?? [];
  const avg = await fetchAverageDeckJson(commander.name.split(" // ")[0]);

  let lines: DeckLine[] = [
    { quantity: 1, name: commander.name, category: "Commander" },
  ];

  if (avg?.deck) {
    if (Array.isArray(avg.deck)) {
      for (const entry of avg.deck) {
        const m = String(entry).match(/^(\d+)\s+(.+)$/);
        if (m) lines.push({ quantity: Number(m[1]), name: m[2] });
        else lines.push({ quantity: 1, name: String(entry) });
      }
    } else {
      for (const [name, qty] of Object.entries(avg.deck)) {
        if (name.toLowerCase() === commander.name.toLowerCase()) continue;
        lines.push({ quantity: Number(qty) || 1, name });
      }
    }
  } else {
    const page = await fetchEdhrecCommander(commander.name.split(" // ")[0]);
    const lists = page.container?.json_dict?.cardlists ?? [];
    const pool: string[] = [];
    for (const list of lists) {
      for (const card of list.cardviews ?? []) {
        if (card.name) pool.push(card.name);
      }
    }

    const unique = [...new Set(pool)].filter(
      (n) => n.toLowerCase() !== commander.name.toLowerCase(),
    );

    // Bracket loosely affects how many nonland cards we prefer from the top of the list
    const nonlandTarget = bracket >= 4 ? 62 : bracket <= 2 ? 55 : 58;
    const picked = unique.slice(0, nonlandTarget);
    for (const name of picked) {
      lines.push({ quantity: 1, name });
    }

    const landCount = Math.max(0, 99 - picked.length);
    const basics = basicLandsFor(colorId, landCount);
    lines = lines.concat(basics);
  }

  // Ensure ~100 cards
  const total = lines.reduce((s, l) => s + l.quantity, 0);
  if (total < 100) {
    const need = 100 - total;
    lines = lines.concat(basicLandsFor(colorId, need));
  }

  const deckLines = lines.filter((l) => l.category !== "Commander");
  const list = toMoxfieldList(
    [
      { quantity: 1, name: commander.name, category: "Commander" },
      ...deckLines.map((l) => ({
        ...l,
        category: "Deck",
        setCode: undefined,
        collectorNumber: undefined,
      })),
    ],
    false,
  );

  return {
    list,
    lines,
    source: avg ? "EDHREC average deck" : "EDHREC top cards (assembled average)",
  };
}

function basicLandsFor(colorId: string[], count: number): DeckLine[] {
  const map: Record<string, string> = {
    W: "Plains",
    U: "Island",
    B: "Swamp",
    R: "Mountain",
    G: "Forest",
  };
  const colors = colorId.length ? colorId : ["C"];
  if (colors.length === 1 && colors[0] === "C") {
    return [{ quantity: count, name: "Wastes" }];
  }

  const lands = colors.map((c) => map[c]).filter(Boolean);
  if (!lands.length) return [{ quantity: count, name: "Wastes" }];

  const base = Math.floor(count / lands.length);
  let rem = count % lands.length;
  return lands.map((name) => {
    const qty = base + (rem > 0 ? 1 : 0);
    if (rem > 0) rem -= 1;
    return { quantity: qty, name };
  });
}
