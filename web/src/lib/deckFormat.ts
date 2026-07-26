/**
 * Multi-format deck list parse / serialize.
 * Formats: HXDEC (hex compact), Moxfield, Plain text, Archidekt.
 * HXDEC spec: https://edhpowerlevel.com/hxdec/
 */
import { encodeHxdec, isHxdec, parseHxdec, serializeHxdecAsync } from "./hxdec";
import { collectionLookup } from "./scryfall";
import type { DeckListFormat } from "./settings";
import { DECK_FORMAT_META } from "./settings";

export type DeckLine = {
  quantity: number;
  name: string;
  setCode?: string;
  collectorNumber?: string;
  isFoil?: boolean;
  /** etched | foil | glossy | nonfoil */
  finish?: string;
  category?: string;
};

export type SerializeOptions = {
  format?: DeckListFormat;
  /** Include set + collector number when present (ignored by plain). Default true for most formats. */
  includeSet?: boolean;
};

const CATEGORY_HEADER =
  /^(Commander|Sideboard|Maybeboard|Deck|Mainboard|Main|Companion|Creatures?|Instants?|Sorceries|Artifacts?|Enchantments?|Planeswalkers?|Lands?|Battles?|Other)$/i;

/** Sync parse for traditional list formats. HXDEC needs `parseDeckListAsync`. */
export function parseDeckList(text: string): DeckLine[] {
  const trimmedAll = text.trim();
  if (isHxdec(trimmedAll)) {
    // Structural-only fallback without Scryfall names — prefer parseDeckListAsync.
    return [];
  }

  const lines = text.split(/\r?\n/);
  const result: DeckLine[] = [];
  let category = "Main";

  for (const raw of lines) {
    const trimmed = raw.trim();
    if (!trimmed) continue;

    // Skip HXDEC header comments if any legacy lists used them
    if (/^#\s*hxdec\b/i.test(trimmed)) continue;

    // Skip pure comments that aren't Archidekt categories
    if (trimmed.startsWith("//")) {
      const cat = trimmed.replace(/^\/\/\s*/, "").replace(/:$/, "").trim();
      if (CATEGORY_HEADER.test(cat) || /^(commander|deck|main|sideboard|maybeboard)$/i.test(cat)) {
        category = normalizeCategory(cat);
      }
      continue;
    }

    // MTGO / DEC sideboard prefix
    let line = trimmed;
    let forcedCategory: string | undefined;
    const sb = line.match(/^SB:\s*(.+)$/i);
    if (sb) {
      line = sb[1].trim();
      forcedCategory = "Sideboard";
    }

    // Section headers without leading digit (Moxfield / Arena)
    if (CATEGORY_HEADER.test(line) && !/^\d/.test(line)) {
      category = normalizeCategory(line.replace(/:$/, ""));
      continue;
    }

    // Archidekt / Moxfield / plain: 1 Name, 1x Name, 1 Name (set) cn *F*
    const match = line.match(
      /^(\d+)\s*x?\s+(.+?)(?:\s+\(([a-z0-9]+)\)\s*([a-z0-9★☆✦]+)?)?(?:\s+\*(F|FOIL|E|ETCHED)\*)?(?:\s+#\S+)*\s*$/i,
    );
    if (!match) continue;

    const quantity = Number(match[1]);
    let name = match[2].trim();
    name = name.replace(/(?:\s+\*(?:F|FOIL|E|ETCHED)\*)+$/i, "");
    name = name.replace(/\s+#\S+/g, "");
    name = name.replace(/\s+\[[^\]]*\]/g, "");
    name = name.trim();
    if (!name) continue;

    const finishMark = match[5]?.toUpperCase();
    const isFoil = finishMark === "F" || finishMark === "FOIL" || /\*F\*/i.test(line);
    const finish =
      finishMark === "E" || finishMark === "ETCHED"
        ? "etched"
        : isFoil
          ? "foil"
          : undefined;

    result.push({
      quantity,
      name,
      setCode: match[3]?.toLowerCase(),
      collectorNumber: match[4],
      isFoil: isFoil || undefined,
      finish,
      category: forcedCategory ?? category,
    });
  }

  return result;
}

/** Parse any supported format, including HXDEC (resolves names via Scryfall). */
export async function parseDeckListAsync(text: string): Promise<DeckLine[]> {
  if (isHxdec(text.trim())) return parseHxdec(text);
  return parseDeckList(text);
}

/** @deprecated Use parseDeckList - kept as alias for existing imports. */
export function parseMoxfieldList(text: string): DeckLine[] {
  return parseDeckList(text);
}

function normalizeCategory(cat: string): string {
  const c = cat.replace(/:$/, "").trim();
  if (/^mainboard$/i.test(c) || /^main$/i.test(c)) return "Deck";
  if (/^creatures?$/i.test(c)) return "Deck";
  if (/^instants?$/i.test(c)) return "Deck";
  if (/^sorceries$/i.test(c)) return "Deck";
  if (/^artifacts?$/i.test(c)) return "Deck";
  if (/^enchantments?$/i.test(c)) return "Deck";
  if (/^planeswalkers?$/i.test(c)) return "Deck";
  if (/^lands?$/i.test(c)) return "Deck";
  if (/^battles?$/i.test(c)) return "Deck";
  if (/^other$/i.test(c)) return "Deck";
  return c;
}

export function serializeDeckList(lines: DeckLine[], opts?: SerializeOptions): string {
  const format = opts?.format ?? "moxfield";
  const includeSet = opts?.includeSet ?? format !== "plain";

  switch (format) {
    case "plain":
      return serializePlain(lines);
    case "archidekt":
      return serializeArchidekt(lines, includeSet);
    case "hxdec": {
      // Sync path: uses cached set indices when available.
      const encoded = encodeHxdec(lines, { foil: true });
      return encoded || serializeMoxfield(lines, includeSet);
    }
    case "moxfield":
    default:
      return serializeMoxfield(lines, includeSet);
  }
}

/** Async serialize (loads Scryfall set index when exporting HXDEC). */
export async function serializeDeckListAsync(
  lines: DeckLine[],
  opts?: SerializeOptions,
): Promise<string> {
  const format = opts?.format ?? "moxfield";
  if (format === "hxdec") {
    const encoded = await serializeHxdecAsync(lines, { foil: true });
    return encoded || serializeMoxfield(lines, opts?.includeSet ?? true);
  }
  return serializeDeckList(lines, opts);
}

/** @deprecated Prefer serializeDeckList with format option. */
export function toMoxfieldList(lines: DeckLine[], includeSet = true): string {
  return serializeMoxfield(lines, includeSet);
}

function finishSuffix(l: DeckLine): string {
  const f = l.finish ?? (l.isFoil ? "foil" : undefined);
  if (f === "etched") return " *E*";
  if (f === "foil") return " *F*";
  if (f === "glossy") return " *G*";
  return "";
}

function serializePlain(lines: DeckLine[]): string {
  return lines.map((l) => `${l.quantity} ${l.name}`).join("\n");
}

function serializeMoxfield(lines: DeckLine[], includeSet: boolean): string {
  const byCategory = new Map<string, DeckLine[]>();
  for (const line of lines) {
    const cat = line.category ?? "Deck";
    const list = byCategory.get(cat) ?? [];
    list.push(line);
    byCategory.set(cat, list);
  }

  const formatLine = (l: DeckLine) => {
    let base = `${l.quantity} ${l.name}`;
    if (includeSet && l.setCode && l.collectorNumber) {
      base = `${base} (${l.setCode}) ${l.collectorNumber}`;
    }
    return base + finishSuffix(l);
  };

  const categories = [...byCategory.keys()];
  const hasSections =
    categories.some((c) => c !== "Main" && c !== "Deck") || categories.length > 1;
  if (!hasSections) {
    return lines.map(formatLine).join("\n");
  }

  const order = ["Commander", "Companion", "Deck", "Mainboard", "Main", "Sideboard", "Maybeboard"];
  const sorted = [
    ...order.filter((c) => byCategory.has(c)),
    ...categories.filter((c) => !order.includes(c)),
  ];

  return sorted
    .map((cat) => {
      const header = cat === "Main" || cat === "Mainboard" ? "Deck" : cat;
      const body = (byCategory.get(cat) ?? []).map(formatLine).join("\n");
      return `${header}\n${body}`;
    })
    .join("\n\n");
}

function serializeArchidekt(lines: DeckLine[], includeSet: boolean): string {
  const byCategory = new Map<string, DeckLine[]>();
  for (const line of lines) {
    const cat = line.category ?? "Deck";
    const list = byCategory.get(cat) ?? [];
    list.push(line);
    byCategory.set(cat, list);
  }

  const formatLine = (l: DeckLine) => {
    let base = `${l.quantity}x ${l.name}`;
    if (includeSet && l.setCode && l.collectorNumber) {
      base = `${base} (${l.setCode}) ${l.collectorNumber}`;
    }
    return base + finishSuffix(l);
  };

  const order = ["Commander", "Companion", "Deck", "Mainboard", "Main", "Sideboard", "Maybeboard"];
  const categories = [...byCategory.keys()];
  const sorted = [
    ...order.filter((c) => byCategory.has(c)),
    ...categories.filter((c) => !order.includes(c)),
  ];

  if (sorted.length === 1 && (sorted[0] === "Deck" || sorted[0] === "Main")) {
    return (byCategory.get(sorted[0]) ?? []).map(formatLine).join("\n");
  }

  return sorted
    .map((cat) => {
      const header = cat === "Main" || cat === "Mainboard" ? "Deck" : cat;
      const body = (byCategory.get(cat) ?? []).map(formatLine).join("\n");
      return `//${header}\n${body}`;
    })
    .join("\n\n");
}

/** Build a list from Scryfall-like cards (qty collapsed by set+cn+name). */
export function cardsToDeckList(
  cards: {
    name: string;
    set?: string;
    collector_number?: string;
    finishes?: string[];
  }[],
  opts?: SerializeOptions,
): string {
  const map = new Map<string, DeckLine>();
  for (const c of cards) {
    const finish = c.finishes?.includes("etched")
      ? "etched"
      : c.finishes?.includes("foil") && !c.finishes?.includes("nonfoil")
        ? "foil"
        : undefined;
    const key = `${c.name}|${c.set ?? ""}|${c.collector_number ?? ""}|${finish ?? ""}`;
    const existing = map.get(key);
    if (existing) existing.quantity += 1;
    else {
      map.set(key, {
        quantity: 1,
        name: c.name.split(" // ")[0],
        setCode: c.set,
        collectorNumber: c.collector_number,
        isFoil: finish === "foil" || undefined,
        finish,
        category: "Deck",
      });
    }
  }
  return serializeDeckList([...map.values()], opts);
}

export async function cardsToDeckListAsync(
  cards: {
    name: string;
    set?: string;
    collector_number?: string;
    finishes?: string[];
  }[],
  opts?: SerializeOptions,
): Promise<string> {
  const map = new Map<string, DeckLine>();
  for (const c of cards) {
    const finish = c.finishes?.includes("etched")
      ? "etched"
      : c.finishes?.includes("foil") && !c.finishes?.includes("nonfoil")
        ? "foil"
        : undefined;
    const key = `${c.name}|${c.set ?? ""}|${c.collector_number ?? ""}|${finish ?? ""}`;
    const existing = map.get(key);
    if (existing) existing.quantity += 1;
    else {
      map.set(key, {
        quantity: 1,
        name: c.name.split(" // ")[0],
        setCode: c.set,
        collectorNumber: c.collector_number,
        isFoil: finish === "foil" || undefined,
        finish,
        category: "Deck",
      });
    }
  }
  return serializeDeckListAsync([...map.values()], opts);
}

/** @deprecated Prefer cardsToDeckList. */
export function cardsToMoxfieldList(
  cards: { name: string; set?: string; collector_number?: string }[],
): string {
  return cardsToDeckList(cards, { format: "moxfield", includeSet: true });
}

export function flattenQuantities(lines: DeckLine[]): string[] {
  const names: string[] = [];
  for (const line of lines) {
    for (let i = 0; i < line.quantity; i++) names.push(line.name);
  }
  return names;
}

export function uniqueNames(lines: DeckLine[]): string[] {
  return [...new Set(lines.map((l) => l.name))];
}

export function formatLabel(format: DeckListFormat): string {
  return DECK_FORMAT_META[format]?.label ?? format;
}

export type FormatConvertResult = {
  text: string;
  lines: DeckLine[];
  warnings: string[];
  detectedFormat: DeckListFormat | "unknown";
};

/** Best-effort detect which format a pasted list most resembles. */
export function detectDeckFormat(text: string): DeckListFormat | "unknown" {
  const t = text.trim();
  if (!t) return "unknown";
  if (isHxdec(t)) return "hxdec";
  if (/^\/\//m.test(t) || /^\d+x\s+/m.test(t)) return "archidekt";
  if (/^(Commander|Deck|Sideboard|Maybeboard)\s*$/im.test(t)) return "moxfield";
  if (/^\d+\s+\S+/m.test(t) && !/\([a-z0-9]+\)/i.test(t)) return "plain";
  if (/^\d+\s+.+\([a-z0-9]+\)/im.test(t)) return "moxfield";
  return "unknown";
}

function conversionWarnings(
  lines: DeckLine[],
  from: DeckListFormat | "unknown",
  to: DeckListFormat,
): string[] {
  const warnings: string[] = [];
  const hasSet = lines.some((l) => l.setCode && l.collectorNumber);
  const hasFinish = lines.some((l) => l.finish || l.isFoil);
  const hasCats = lines.some(
    (l) => l.category && !/^(deck|main|mainboard)$/i.test(l.category),
  );

  if (to === "plain") {
    if (hasSet) warnings.push("Plain text drops set codes and collector numbers.");
    if (hasFinish) warnings.push("Plain text drops foil / etched / finish markers.");
    if (hasCats) warnings.push("Plain text drops Commander / Sideboard section headers.");
  }

  if (to === "moxfield") {
    if (from === "archidekt") {
      warnings.push("Archidekt-only tags and custom category labels may be simplified.");
    }
  }

  if (to === "archidekt") {
    if (from === "hxdec" && hasFinish) {
      warnings.push("Finish markers are kept when present; Archidekt tag colors are not.");
    }
  }

  if (to === "hxdec") {
    const missing = lines.filter((l) => !l.setCode || !l.collectorNumber);
    if (missing.length) {
      warnings.push(
        `HXDEC needs set + collector number on every card; ${missing.length} line${missing.length === 1 ? "" : "s"} lacked them and were omitted from the compact string.`,
      );
    }
    if (hasCats) {
      warnings.push(
        "HXDEC only keeps Main / Commander / Sideboard / Maybeboard (other categories map to main).",
      );
    }
    warnings.push("HXDEC stores printings, not card names; names are resolved via Scryfall when importing.");
  }

  if (from === "hxdec" && to !== "hxdec") {
    warnings.push("Decoded from HXDEC via Scryfall; verify names if any printings were ambiguous.");
  }

  if (from === "plain" && (to === "moxfield" || to === "archidekt" || to === "hxdec")) {
    if (!hasSet) {
      warnings.push("Source list had no set/collector data; output cannot invent exact printings.");
    }
  }

  return [...new Set(warnings)];
}

/**
 * Convert a deck list between formats. Resolves HXDEC via Scryfall when needed.
 * Emits warnings whenever the target format cannot preserve source information.
 */
export async function convertDeckFormat(
  text: string,
  to: DeckListFormat,
  from?: DeckListFormat | "unknown",
): Promise<FormatConvertResult> {
  const detected = from && from !== "unknown" ? from : detectDeckFormat(text);
  const lines = await parseDeckListAsync(text);
  if (!lines.length) {
    throw new Error("No cards found in the list.");
  }

  // For HXDEC output, try to fill missing set/CN from Scryfall names.
  if (to === "hxdec") {
    const need = lines.filter((l) => !l.setCode || !l.collectorNumber);
    if (need.length) {
      const cards = await collectionLookup(
        [...new Set(need.map((l) => l.name.split(" // ")[0]))].map((name) => ({ name })),
      );
      const byName = new Map(
        cards.map((c) => [c.name.toLowerCase().split(" // ")[0], c] as const),
      );
      for (const line of lines) {
        if (line.setCode && line.collectorNumber) continue;
        const card = byName.get(line.name.toLowerCase().split(" // ")[0]);
        if (!card) continue;
        line.setCode = card.set;
        line.collectorNumber = card.collector_number;
      }
    }
  }

  const serialized = await serializeDeckListAsync(lines, { format: to, includeSet: true });
  if (to === "hxdec" && !serialized.trim()) {
    throw new Error("Could not build HXDEC output (missing set data for all cards).");
  }

  return {
    text: serialized,
    lines,
    warnings: conversionWarnings(lines, detected, to),
    detectedFormat: detected,
  };
}

