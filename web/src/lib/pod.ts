import {
  clampBracket,
  commanderUsedInBracket,
  fetchPopularCommanderNames,
} from "./edhrec";
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
  onProgress?: (progress: PodProgress) => void;
};

export type PodProgress = {
  done: number;
  total: number;
  label: string;
};

export type PodSeat = {
  commander: ScryfallCard;
  partner?: ScryfallCard;
  role: string;
};

const ROLES = [
  "Aggro pressure",
  "Interaction / control",
  "Value engine",
  "Wildcard chaos",
  "Stax / taxes",
  "Combo threat",
];

/** Scryfall bias toward efficient / partner-capable commanders at high brackets. */
function competitiveQueryExtra(bracket: number): string | undefined {
  if (bracket >= 5) {
    return '(cmc<=3 OR keyword:Partner OR o:"Partner with" OR keyword:"Friends forever")';
  }
  if (bracket >= 4) {
    return "(cmc<=4 OR keyword:Partner OR o:\"Partner with\")";
  }
  return undefined;
}

function colorKey(card: ScryfallCard): string {
  return [...card.color_identity].sort().join("") || "C";
}

function overlap(a: string[], b: string[]): number {
  const set = new Set(a);
  return b.filter((c) => set.has(c)).length;
}

function matchesColorFilters(card: ScryfallCard, filters: CommanderFilters): boolean {
  const want = filters.colors?.filter(Boolean) ?? [];
  if (!want.length) return true;
  const have = new Set(card.color_identity);
  const mode = filters.colorMode ?? "include";
  if (mode === "exact") {
    if (have.size !== want.length) return false;
    return want.every((c) => have.has(c));
  }
  if (mode === "atMost") {
    return [...have].every((c) => want.includes(c));
  }
  // include: commander must include all selected colors
  return want.every((c) => have.has(c));
}

function isBalanced(seats: PodSeat[]): boolean {
  const keys = seats.map((s) => colorKey(s.commander));
  const unique = new Set(keys);
  if (unique.size === 1 && seats.length > 2) return false;

  const allColors = seats.flatMap((s) => s.commander.color_identity);
  const counts: Record<string, number> = {};
  for (const c of allColors) counts[c] = (counts[c] ?? 0) + 1;
  const max = Math.max(0, ...Object.values(counts));
  if (max >= seats.length + 1) return false;

  for (let i = 0; i < keys.length; i++) {
    for (let j = i + 1; j < keys.length; j++) {
      if (keys[i] === keys[j] && keys[i].length >= 3) return false;
    }
  }
  return true;
}

async function buildBracketPool(
  bracket: number,
  filters: CommanderFilters,
  bracketCache: Map<string, Record<number, number> | null>,
  onProgress?: (label: string) => void,
): Promise<ScryfallCard[]> {
  onProgress?.("Loading EDHREC commander pool…");
  const names = await fetchPopularCommanderNames();
  const pool: ScryfallCard[] = [];
  // Cap lookups so pool build stays snappy; shuffle for variety across regenerations
  const shuffled = [...names].sort(() => Math.random() - 0.5).slice(0, 80);
  for (const name of shuffled) {
    if (!(await commanderUsedInBracket(name, bracket, bracketCache))) continue;
    try {
      const card = await namedCard(name);
      if (!matchesColorFilters(card, filters)) continue;
      if (card.legalities?.commander === "legal" || card.type_line.includes("Legendary")) {
        pool.push(card);
      }
    } catch {
      // skip unresolvable names
    }
  }
  return pool;
}

async function namedOrRandom(
  name: string | undefined,
  filters: CommanderFilters,
  avoidIds: Set<string>,
  bracket: number,
  bracketCache: Map<string, Record<number, number> | null>,
  pool: ScryfallCard[],
): Promise<ScryfallCard> {
  if (name?.trim()) {
    const card = await namedCard(name.trim());
    if (card.legalities?.commander === "legal" || card.type_line.includes("Legendary")) {
      return card;
    }
    throw new Error(`"${name}" is not a usable commander`);
  }

  // Prefer verified EDHREC pool picks when available (especially important for cEDH).
  const poolHits = pool.filter((c) => !avoidIds.has(c.id));
  if (poolHits.length) {
    const pick = poolHits[Math.floor(Math.random() * poolHits.length)];
    return pick;
  }

  const maxAttempts = bracket >= 5 ? 60 : bracket >= 4 ? 40 : 28;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const card = await randomCommander(filters);
    if (avoidIds.has(card.id)) continue;
    const ok = await commanderUsedInBracket(card.name, bracket, bracketCache);
    if (ok) return card;
  }
  throw new Error("no pods within filters found");
}

export async function generatePod(options: PodOptions): Promise<PodSeat[]> {
  const bracket = clampBracket(options.bracket);
  const filters: CommanderFilters = {
    colors: options.colors,
    playstyle: options.playstyle,
    set: options.set,
    partners: options.partners,
    colorMode: "include",
    queryExtra: competitiveQueryExtra(bracket),
  };

  const seats: PodSeat[] = [];
  const avoid = new Set<string>();
  const seeded = options.seeded?.filter(Boolean) ?? [];
  const bracketCache = new Map<string, Record<number, number> | null>();
  const total = options.players + 1;
  const report = (done: number, label: string) => {
    options.onProgress?.({ done, total, label });
  };

  report(0, "Finding commanders…");

  // High brackets: seed a pool from popular EDHREC commanders that actually play there
  let pool: ScryfallCard[] = [];
  if (bracket >= 4 && seeded.length < options.players) {
    try {
      pool = await buildBracketPool(bracket, filters, bracketCache, (label) => report(0, label));
    } catch {
      pool = [];
    }
  }

  try {
    for (let i = 0; i < options.players; i++) {
      report(i, `Matching seat ${i + 1} of ${options.players}…`);
      const commander = await namedOrRandom(
        seeded[i],
        filters,
        avoid,
        bracket,
        bracketCache,
        pool,
      );
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
            const partnerAttempts = bracket >= 5 ? 20 : 12;
            for (let pAttempt = 0; pAttempt < partnerAttempts; pAttempt++) {
              const candidate = await randomCommander({ ...filters, partners: true });
              if (avoid.has(candidate.id)) continue;
              if (!(await commanderUsedInBracket(candidate.name, bracket, bracketCache))) continue;
              if (overlap(commander.color_identity, candidate.color_identity) > 2 && pAttempt < 8) {
                continue;
              }
              partner = candidate;
              avoid.add(partner.id);
              break;
            }
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
      report(i + 1, `Seat ${i + 1} of ${options.players} ready`);
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("no commanders") || msg.includes("404") || msg.includes("no pods")) {
      throw new Error("no pods within filters found");
    }
    throw err;
  }

  report(options.players, "Balancing color identities…");

  if (!isBalanced(seats)) {
    for (let i = 0; i < seats.length; i++) {
      if (seeded[i]) continue;
      const balanceAttempts = bracket >= 5 ? 24 : 14;
      for (let attempt = 0; attempt < balanceAttempts; attempt++) {
        let replacement: ScryfallCard;
        const poolHits = pool.filter((c) => !avoid.has(c.id) && c.id !== seats[i].commander.id);
        if (poolHits.length && attempt < Math.ceil(balanceAttempts / 2)) {
          replacement = poolHits[Math.floor(Math.random() * poolHits.length)];
        } else {
          replacement = await randomCommander(filters);
          if (avoid.has(replacement.id)) continue;
          if (!(await commanderUsedInBracket(replacement.name, bracket, bracketCache))) continue;
        }
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
    const keys = new Set(seats.map((s) => colorKey(s.commander)));
    if (keys.size === 1) throw new Error("no pods within filters found");
  }

  report(total, "Pod ready");
  return seats;
}
