import type { ScryfallCard } from "./scryfall";
import { namedCard, randomCommander, type CommanderFilters } from "./scryfall";

export type PodOptions = {
  players: number;
  bracket: number;
  colors?: string[];
  playstyle?: string;
  set?: string;
  partners: boolean;
  seeded?: string[]; // manually entered commander names
};

export type PodSeat = {
  commander: ScryfallCard;
  partner?: ScryfallCard;
  role: string;
};

const ROLES = ["Aggro pressure", "Interaction / control", "Value engine", "Wildcard chaos", "Stax / taxes", "Combo threat"];

function colorKey(card: ScryfallCard): string {
  return [...card.color_identity].sort().join("") || "C";
}

function overlap(a: string[], b: string[]): number {
  const set = new Set(a);
  return b.filter((c) => set.has(c)).length;
}

function isBalanced(seats: PodSeat[]): boolean {
  // Prefer not all mono-same-color and not identical identities
  const keys = seats.map((s) => colorKey(s.commander));
  const unique = new Set(keys);
  if (unique.size === 1 && seats.length > 2) return false;

  // Avoid heavy color pile-up on same 2 colors only when 4 players
  const allColors = seats.flatMap((s) => s.commander.color_identity);
  const counts: Record<string, number> = {};
  for (const c of allColors) counts[c] = (counts[c] ?? 0) + 1;
  const max = Math.max(0, ...Object.values(counts));
  if (max >= seats.length + 1) return false;

  // Pairwise identity shouldn't be identical
  for (let i = 0; i < keys.length; i++) {
    for (let j = i + 1; j < keys.length; j++) {
      if (keys[i] === keys[j] && keys[i].length >= 3) return false;
    }
  }
  return true;
}

async function namedOrRandom(
  name: string | undefined,
  filters: CommanderFilters,
  avoidIds: Set<string>,
): Promise<ScryfallCard> {
  if (name?.trim()) {
    const card = await namedCard(name.trim());
    if (card.legalities?.commander === "legal" || card.type_line.includes("Legendary")) {
      return card;
    }
    throw new Error(`"${name}" is not a usable commander`);
  }

  for (let attempt = 0; attempt < 12; attempt++) {
    const card = await randomCommander(filters);
    if (!avoidIds.has(card.id)) return card;
  }
  throw new Error("no pods within filters found");
}

export async function generatePod(options: PodOptions): Promise<PodSeat[]> {
  const filters: CommanderFilters = {
    colors: options.colors,
    playstyle: options.playstyle,
    set: options.set,
    partners: options.partners,
    colorMode: "include",
  };

  const seats: PodSeat[] = [];
  const avoid = new Set<string>();
  const seeded = options.seeded?.filter(Boolean) ?? [];

  try {
    for (let i = 0; i < options.players; i++) {
      const commander = await namedOrRandom(seeded[i], filters, avoid);
      avoid.add(commander.id);

      let partner: ScryfallCard | undefined;
      if (options.partners) {
        const text = `${commander.oracle_text ?? ""} ${(commander.keywords ?? []).join(" ")}`;
        const wantsPartner =
          /partner/i.test(text) ||
          /friends forever/i.test(text) ||
          /choose a background/i.test(text) ||
          /background/i.test(commander.type_line);

        if (wantsPartner) {
          try {
            partner = await randomCommander({ ...filters, partners: true });
            if (overlap(commander.color_identity, partner.color_identity) > 2) {
              partner = await randomCommander({ ...filters, partners: true });
            }
            avoid.add(partner.id);
          } catch {
            partner = undefined;
          }
        }
      }

      seats.push({
        commander,
        partner,
        role: ROLES[i % ROLES.length],
      });
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("no commanders") || msg.includes("404") || msg.includes("no pods")) {
      throw new Error("no pods within filters found");
    }
    throw err;
  }

  // Balance pass: regenerate non-seeded seats if unbalanced
  if (!isBalanced(seats)) {
    for (let i = 0; i < seats.length; i++) {
      if (seeded[i]) continue;
      for (let attempt = 0; attempt < 8; attempt++) {
        const replacement = await randomCommander(filters);
        if (avoid.has(replacement.id)) continue;
        const trial = seats.map((s, idx) =>
          idx === i ? { ...s, commander: replacement } : s,
        );
        if (isBalanced(trial)) {
          avoid.delete(seats[i].commander.id);
          avoid.add(replacement.id);
          seats[i] = { ...seats[i], commander: replacement };
          break;
        }
      }
    }
  }

  if (!isBalanced(seats) && seeded.length === 0) {
    // Last resort: still return but we tried; only fail if all identical mono
    const keys = new Set(seats.map((s) => colorKey(s.commander)));
    if (keys.size === 1) throw new Error("no pods within filters found");
  }

  // Bracket is informational / soft filter via cmc diversity
  void options.bracket;
  return seats;
}
