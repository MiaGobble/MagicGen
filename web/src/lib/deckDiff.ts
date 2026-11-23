/**
 * Compare two deck lists by card name + quantity.
 * Ignores set codes / finishes; aggregates quantities across sections.
 */
import { parseDeckListAsync, type DeckLine } from "./deckFormat";
import { normalizeCardNameForSearch } from "./scryfall";

export type DiffQtyLine = {
  name: string;
  quantity: number;
};

export type DiffChangedLine = {
  name: string;
  before: number;
  after: number;
  delta: number;
};

export type DeckDiffResult = {
  added: DiffQtyLine[];
  removed: DiffQtyLine[];
  changed: DiffChangedLine[];
  unchanged: number;
  beforeCards: number;
  afterCards: number;
  beforeUnique: number;
  afterUnique: number;
};

type QtyEntry = { name: string; quantity: number };

function aggregateByName(lines: DeckLine[]): Map<string, QtyEntry> {
  const map = new Map<string, QtyEntry>();
  for (const line of lines) {
    if (line.quantity <= 0) continue;
    const key = normalizeCardNameForSearch(line.name).toLowerCase();
    if (!key) continue;
    const existing = map.get(key);
    if (existing) {
      existing.quantity += line.quantity;
      continue;
    }
    map.set(key, {
      name: normalizeCardNameForSearch(line.name),
      quantity: line.quantity,
    });
  }
  return map;
}

function sortByName<T extends { name: string }>(items: T[]): T[] {
  return [...items].sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }));
}

/** Pure compare of already-parsed lines. */
export function diffDeckLines(before: DeckLine[], after: DeckLine[]): DeckDiffResult {
  const beforeMap = aggregateByName(before);
  const afterMap = aggregateByName(after);

  const added: DiffQtyLine[] = [];
  const removed: DiffQtyLine[] = [];
  const changed: DiffChangedLine[] = [];
  let unchanged = 0;

  for (const [key, afterEntry] of afterMap) {
    const beforeEntry = beforeMap.get(key);
    if (!beforeEntry) {
      added.push({ name: afterEntry.name, quantity: afterEntry.quantity });
      continue;
    }
    if (beforeEntry.quantity === afterEntry.quantity) {
      unchanged += 1;
      continue;
    }
    changed.push({
      name: afterEntry.name,
      before: beforeEntry.quantity,
      after: afterEntry.quantity,
      delta: afterEntry.quantity - beforeEntry.quantity,
    });
  }

  for (const [key, beforeEntry] of beforeMap) {
    if (afterMap.has(key)) continue;
    removed.push({ name: beforeEntry.name, quantity: beforeEntry.quantity });
  }

  const sumQty = (m: Map<string, QtyEntry>) =>
    [...m.values()].reduce((s, e) => s + e.quantity, 0);

  return {
    added: sortByName(added),
    removed: sortByName(removed),
    changed: sortByName(changed),
    unchanged,
    beforeCards: sumQty(beforeMap),
    afterCards: sumQty(afterMap),
    beforeUnique: beforeMap.size,
    afterUnique: afterMap.size,
  };
}

/** Parse both lists (any supported format) and return the diff. */
export async function diffDeckLists(beforeText: string, afterText: string): Promise<DeckDiffResult> {
  const [before, after] = await Promise.all([
    parseDeckListAsync(beforeText),
    parseDeckListAsync(afterText),
  ]);
  if (before.length === 0 && beforeText.trim()) {
    throw new Error("Could not parse the before list. Check the format and try again.");
  }
  if (after.length === 0 && afterText.trim()) {
    throw new Error("Could not parse the after list. Check the format and try again.");
  }
  return diffDeckLines(before, after);
}

export function formatDiffDelta(delta: number): string {
  if (delta > 0) return `+${delta}`;
  return String(delta);
}

export function isEmptyDiff(diff: DeckDiffResult): boolean {
  return diff.added.length === 0 && diff.removed.length === 0 && diff.changed.length === 0;
}
