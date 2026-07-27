/**
 * Budgetize a commander deck: swap expensive cards for cheaper EDHREC picks
 * until the estimated all-in purchase cost (Scryfall USD + modeled shipping)
 * is under the user's max price.
 * Biases toward a target Commander bracket via EDHREC bracket pages.
 */
import { BRACKET_META, clampBracket, fetchCheapEdhrecPool } from "./edhrec";
import { parseDeckListAsync, toMoxfieldList, type DeckLine } from "./moxfield";
import {
  estimateAllInPurchase,
  formatUsd,
  priceDeck,
  type PricedCard,
} from "./pricing";
import {
  collectionLookup,
  namedCard,
  namedExact,
  type ScryfallCard,
} from "./scryfall";

export type BudgetProgress = {
  done: number;
  total: number;
  label: string;
};

export type BudgetSwap = {
  from: string;
  fromUsd: number;
  to: string;
  toUsd: number;
};

export type BudgetDeckResult = {
  commanderName: string;
  list: string;
  lines: DeckLine[];
  originalTotal: number;
  newTotal: number;
  /** Estimated cards + shipping for the cut list (best purchase plan). */
  estimatedPurchaseTotal: number;
  estimatedShipping: number;
  maxPrice: number;
  bracket: number;
  underBudget: boolean;
  swaps: BudgetSwap[];
  notes: string[];
};

export type BudgetDeckOptions = {
  listText: string;
  maxPrice: number;
  /** Target Commander bracket (1–5). Default 3. */
  bracket?: number;
  /** Override auto-detected commander name. */
  commanderName?: string;
  onProgress?: (progress: BudgetProgress) => void;
};

function normalizeName(name: string): string {
  return name.toLowerCase().split(" // ")[0].trim();
}

function isBasicLandCard(card: ScryfallCard | undefined, name: string): boolean {
  if (card?.type_line) {
    return /\bbasic\b/i.test(card.type_line) && /\bland\b/i.test(card.type_line);
  }
  return /^(snow-covered\s+)?(plains|island|swamp|mountain|forest|wastes)$/i.test(
    name.split(" // ")[0].trim(),
  );
}

function fitsColorIdentity(card: ScryfallCard, commanderCi: string[]): boolean {
  const allowed = new Set(commanderCi);
  for (const c of card.color_identity ?? []) {
    if (!allowed.has(c)) return false;
  }
  return true;
}

function isCommanderLegal(card: ScryfallCard): boolean {
  const legality = card.legalities?.commander;
  if (legality === "banned" || legality === "not_legal") return false;
  const t = card.type_line ?? "";
  const legendary = /\blegendary\b/i.test(t);
  const creature = /\bcreature\b/i.test(t);
  const planeswalker = /\bplaneswalker\b/i.test(t);
  if (legendary && (creature || planeswalker)) return true;
  if (/\bcan be your commander\b/i.test(card.oracle_text ?? "")) return true;
  return false;
}

function lineTotal(priced: PricedCard): number {
  return priced.usd * priced.quantity;
}

function deckTotal(priced: PricedCard[]): number {
  return priced.reduce((s, p) => s + lineTotal(p), 0);
}

/** All-in cost used for budget checks (Scryfall cards + modeled shipping). */
function purchaseTotal(priced: PricedCard[]): number {
  return estimateAllInPurchase(priced).grandTotal;
}

async function resolveCommanderCard(
  lines: DeckLine[],
  overrideName: string | undefined,
  onProgress?: (progress: BudgetProgress) => void,
): Promise<{ commander: ScryfallCard; commanderLines: DeckLine[] }> {
  onProgress?.({ done: 0, total: 5, label: "Finding commander…" });

  if (overrideName?.trim()) {
    try {
      const commander = await namedExact(overrideName.trim());
      const commanderLines = lines.filter((l) => /^commander$/i.test(l.category ?? ""));
      return {
        commander,
        commanderLines: commanderLines.length
          ? commanderLines
          : [{ quantity: 1, name: commander.name, category: "Commander" }],
      };
    } catch {
      const commander = await namedCard(overrideName.trim());
      const commanderLines = lines.filter((l) => /^commander$/i.test(l.category ?? ""));
      return {
        commander,
        commanderLines: commanderLines.length
          ? commanderLines
          : [{ quantity: 1, name: commander.name, category: "Commander" }],
      };
    }
  }

  const section = lines.filter((l) => /^commander$/i.test(l.category ?? ""));
  if (section.length) {
    const primary = section[0];
    try {
      const commander = await namedExact(primary.name.split(" // ")[0]);
      return { commander, commanderLines: section };
    } catch {
      const commander = await namedCard(primary.name.split(" // ")[0]);
      return { commander, commanderLines: section };
    }
  }

  const unique = [...new Set(lines.map((l) => l.name.split(" // ")[0]))].slice(0, 40);
  const cards = await collectionLookup(
    unique.map((name) => ({ name })),
    (done, total, label) =>
      onProgress?.({
        done,
        total: Math.max(total, 1),
        label: label ?? "Detecting commander…",
      }),
  );
  const byName = new Map(cards.map((c) => [normalizeName(c.name), c]));
  for (const line of lines) {
    const card = byName.get(normalizeName(line.name));
    if (card && isCommanderLegal(card)) {
      return {
        commander: card,
        commanderLines: [{ quantity: 1, name: card.name, category: "Commander" }],
      };
    }
  }

  throw new Error(
    "Could not detect a commander. Add a Commander section or enter the commander name.",
  );
}

type PoolPick = {
  name: string;
  usd: number;
  card: ScryfallCard;
  inBracket: boolean;
};

/**
 * Greedily replace expensive deck cards with cheaper EDHREC recommendations
 * until the estimated all-in purchase cost (cards + modeled shipping) is at or
 * under `maxPrice`. Prefers target-bracket cards for replacements and cuts
 * off-bracket staples first.
 */
export async function budgetizeDeck(options: BudgetDeckOptions): Promise<BudgetDeckResult> {
  const maxPrice = Math.max(0, Number(options.maxPrice) || 0);
  const bracket = clampBracket(options.bracket ?? 3);
  const bracketLabel = BRACKET_META[bracket].label;
  const report = (done: number, total: number, label: string) => {
    options.onProgress?.({ done, total, label });
  };

  const parsed = await parseDeckListAsync(options.listText);
  if (!parsed.length) throw new Error("No cards parsed from list");

  const { commander, commanderLines } = await resolveCommanderCard(
    parsed,
    options.commanderName,
    options.onProgress,
  );
  const commanderKeys = new Set(
    commanderLines.map((l) => normalizeName(l.name)).concat([normalizeName(commander.name)]),
  );
  const commanderCi = commander.color_identity ?? [];

  report(1, 5, `Loading Bracket ${bracket} (${bracketLabel}) EDHREC picks…`);
  const edhPool = await fetchCheapEdhrecPool(commander.name.split(" // ")[0], bracket);
  if (!edhPool.length) {
    throw new Error(`No EDHREC recommendations found for ${commander.name}`);
  }
  const bracketKeys = new Set(
    edhPool.filter((c) => c.inBracket).map((c) => normalizeName(c.name)),
  );

  let working: DeckLine[] = parsed.map((l) => ({ ...l }));
  const hasCommanderSection = working.some((l) => /^commander$/i.test(l.category ?? ""));
  if (!hasCommanderSection) {
    working = [
      ...commanderLines.map((l) => ({ ...l, category: "Commander" as const })),
      ...working.filter((l) => !commanderKeys.has(normalizeName(l.name))),
    ];
  }

  report(2, 5, "Pricing your deck…");
  let priced = await priceDeck(working, true, (done, total, label) => {
    report(2, 5, label ?? `Pricing deck (${done}/${total})…`);
  });

  const originalTotal = deckTotal(priced);

  report(3, 5, "Pricing EDHREC picks…");
  const poolMeta = new Map(edhPool.map((c) => [normalizeName(c.name), c]));
  const deckKeys = new Set(working.map((l) => normalizeName(l.name)));
  const poolIdents = edhPool
    .filter((n) => !commanderKeys.has(normalizeName(n.name)))
    .map((c) => ({ name: c.name.split(" // ")[0] }));

  const poolCards = await collectionLookup(poolIdents, (done, total, label) => {
    report(3, 5, label ?? `Pricing picks (${done}/${total})…`);
  });

  const available: PoolPick[] = [];
  const seenPool = new Set<string>();
  for (const card of poolCards) {
    const key = normalizeName(card.name);
    if (seenPool.has(key) || commanderKeys.has(key)) continue;
    if (!fitsColorIdentity(card, commanderCi)) continue;
    if (isBasicLandCard(card, card.name)) continue;
    const usd = Number(card.prices?.usd ?? card.prices?.usd_foil ?? 0) || 0;
    if (usd <= 0) continue;
    seenPool.add(key);
    available.push({
      name: card.name.split(" // ")[0],
      usd,
      card,
      inBracket: poolMeta.get(key)?.inBracket ?? false,
    });
  }
  available.sort((a, b) => {
    if (a.inBracket !== b.inBracket) return a.inBracket ? -1 : 1;
    return a.usd - b.usd || a.name.localeCompare(b.name);
  });

  if (!available.length) {
    throw new Error("No priced EDHREC replacements fit this commander’s color identity");
  }

  const usedPool = new Set<string>([...deckKeys]);
  const swaps: BudgetSwap[] = [];
  const notes: string[] = [];
  const maxSwaps = 200;
  let swapGuard = 0;

  report(4, 5, `Swapping toward Bracket ${bracket}…`);

  while (purchaseTotal(priced) > maxPrice && swapGuard < maxSwaps) {
    swapGuard += 1;

    const candidates = priced
      .filter((p) => {
        if (commanderKeys.has(normalizeName(p.name))) return false;
        if (isBasicLandCard(p.card, p.name)) return false;
        if (p.usd <= 0) return false;
        return true;
      })
      .sort((a, b) => {
        const aIn = bracketKeys.has(normalizeName(a.name));
        const bIn = bracketKeys.has(normalizeName(b.name));
        if (aIn !== bIn) return aIn ? 1 : -1;
        return b.usd - a.usd;
      });

    if (!candidates.length) {
      notes.push("Stopped: no more replaceable expensive cards.");
      break;
    }

    let didSwap = false;

    for (const target of candidates) {
      const targetKey = normalizeName(target.name);
      const replacement =
        available.find(
          (pick) =>
            pick.inBracket &&
            !usedPool.has(normalizeName(pick.name)) &&
            pick.usd < target.usd &&
            normalizeName(pick.name) !== targetKey,
        ) ??
        available.find(
          (pick) =>
            !usedPool.has(normalizeName(pick.name)) &&
            pick.usd < target.usd &&
            normalizeName(pick.name) !== targetKey,
        );
      if (!replacement) continue;

      let swapped = false;
      working = working.flatMap((line) => {
        if (swapped) return [line];
        if (normalizeName(line.name) !== targetKey) return [line];
        if (/^commander$/i.test(line.category ?? "")) return [line];
        swapped = true;
        const out: DeckLine[] = [];
        if (line.quantity > 1) out.push({ ...line, quantity: line.quantity - 1 });
        out.push({
          quantity: 1,
          name: replacement.name,
          setCode: replacement.card.set,
          collectorNumber: replacement.card.collector_number,
          category: line.category === "Main" ? "Deck" : line.category ?? "Deck",
        });
        return out;
      });

      if (!swapped) continue;

      const coalesced = new Map<string, DeckLine>();
      for (const line of working) {
        const key = `${(line.category ?? "Deck").toLowerCase()}|${normalizeName(line.name)}`;
        const existing = coalesced.get(key);
        if (existing) existing.quantity += line.quantity;
        else coalesced.set(key, { ...line });
      }
      working = [...coalesced.values()];

      usedPool.add(normalizeName(replacement.name));
      const stillInDeck = working.some((l) => normalizeName(l.name) === targetKey);
      if (!stillInDeck) usedPool.delete(targetKey);

      swaps.push({
        from: target.name.split(" // ")[0],
        fromUsd: target.usd,
        to: replacement.name,
        toUsd: replacement.usd,
      });

      priced = working.map((l) => {
        const key = normalizeName(l.name);
        if (key === normalizeName(replacement.name)) {
          return {
            name: l.name,
            quantity: l.quantity,
            usd: replacement.usd,
            card: replacement.card,
          };
        }
        const prev = priced.find((p) => normalizeName(p.name) === key);
        if (prev) return { ...prev, name: l.name, quantity: l.quantity };
        return { name: l.name, quantity: l.quantity, usd: 0 };
      });

      report(
        4,
        5,
        `Swapped ${swaps.length}: ${target.name.split(" // ")[0]} → ${replacement.name}…`,
      );
      didSwap = true;
      break;
    }

    if (!didSwap) {
      notes.push("Stopped: no cheaper EDHREC swaps left for remaining expensive cards.");
      break;
    }
  }

  report(5, 5, "Final pricing…");
  priced = await priceDeck(working, true);
  const newTotal = deckTotal(priced);
  const purchase = estimateAllInPurchase(priced);
  const underBudget = purchase.grandTotal <= maxPrice;

  if (!underBudget) {
    notes.push(
      `Best effort: estimated purchase ${formatUsd(purchase.grandTotal)} (cards ${formatUsd(newTotal)} + ~${formatUsd(purchase.shipping)} ship) still over the ${formatUsd(maxPrice)} target after ${swaps.length} swap${swaps.length === 1 ? "" : "s"}.`,
    );
  } else if (!swaps.length && purchase.grandTotal <= maxPrice) {
    notes.push("Deck was already under budget including estimated shipping - no changes made.");
  } else {
    notes.push(
      `Estimated purchase ${formatUsd(purchase.grandTotal)} via ${purchase.vendorName} (cards ${formatUsd(newTotal)} + ~${formatUsd(purchase.shipping)} ship).`,
    );
  }
  notes.push(
    "Budget target includes modeled shipping (TCGPlayer mass-entry ≈ many sellers; single stores use flat/free-ship thresholds).",
  );

  const inBracketCount = working.filter(
    (l) =>
      !/^commander$/i.test(l.category ?? "") && bracketKeys.has(normalizeName(l.name)),
  ).length;
  notes.unshift(
    `Target Bracket ${bracket} (${bracketLabel}) · ${inBracketCount} main-deck lines match that bracket’s EDHREC pool.`,
  );

  const outLines = working.map((l) => ({
    ...l,
    category: /^commander$/i.test(l.category ?? "")
      ? "Commander"
      : l.category === "Main" || l.category === "Mainboard"
        ? "Deck"
        : l.category ?? "Deck",
  }));

  report(5, 5, "Done");

  return {
    commanderName: commander.name,
    list: toMoxfieldList(outLines, true),
    lines: outLines,
    originalTotal,
    newTotal,
    estimatedPurchaseTotal: purchase.grandTotal,
    estimatedShipping: purchase.shipping,
    maxPrice,
    bracket,
    underBudget,
    swaps,
    notes,
  };
}
