export type DeckLine = {
  quantity: number;
  name: string;
  setCode?: string;
  collectorNumber?: string;
  isFoil?: boolean;
  category?: string;
};

/** Parse Moxfield-style decklists (qty name, optional set + CN). */
export function parseMoxfieldList(text: string): DeckLine[] {
  const lines = text.split(/\r?\n/);
  const result: DeckLine[] = [];
  let category = "Main";

  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;

    if (/^(Commander|Sideboard|Maybeboard|Deck|Mainboard|Companion)/i.test(line) && !/^\d/.test(line)) {
      category = line.replace(/:$/, "");
      continue;
    }

    // 1 Sol Ring (c21) 252
    // 1 Sol Ring
    // 1x Sol Ring
    // 1 Sol Ring (c21) 252 *F* #Ramp
    const match = line.match(
      /^(\d+)\s*x?\s+(.+?)(?:\s+\(([a-z0-9]+)\)\s*([a-z0-9★☆✦]+)?)?(?:\s+\*F\*)?(?:\s+#\S+)*\s*$/i,
    );
    if (!match) continue;

    const quantity = Number(match[1]);
    let name = match[2].trim();
    // Strip foil markers, #tags, and [SET] brackets that leaked into the name
    name = name.replace(/(?:\s+\*F\*)+$/i, "");
    name = name.replace(/\s+#\S+/g, "");
    name = name.replace(/\s+\[[^\]]*\]/g, "");
    name = name.trim();
    if (!name) continue;

    result.push({
      quantity,
      name,
      setCode: match[3]?.toLowerCase(),
      collectorNumber: match[4],
      isFoil: /\*F\*/i.test(line) || undefined,
      category,
    });
  }

  return result;
}

export function toMoxfieldList(lines: DeckLine[], includeSet = true): string {
  const byCategory = new Map<string, DeckLine[]>();
  for (const line of lines) {
    const cat = line.category ?? "Deck";
    const list = byCategory.get(cat) ?? [];
    list.push(line);
    byCategory.set(cat, list);
  }

  const formatLine = (l: DeckLine) => {
    const base = `${l.quantity} ${l.name}`;
    if (includeSet && l.setCode && l.collectorNumber) {
      return `${base} (${l.setCode}) ${l.collectorNumber}`;
    }
    return base;
  };

  // Prefer Moxfield section headers when categories are present
  const categories = [...byCategory.keys()];
  const hasSections = categories.some((c) => c !== "Main" && c !== "Deck") || categories.length > 1;
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

/** Build a Moxfield list from Scryfall cards (qty collapsed by set+cn+name). */
export function cardsToMoxfieldList(
  cards: { name: string; set?: string; collector_number?: string }[],
): string {
  const map = new Map<string, DeckLine>();
  for (const c of cards) {
    const key = `${c.name}|${c.set ?? ""}|${c.collector_number ?? ""}`;
    const existing = map.get(key);
    if (existing) existing.quantity += 1;
    else {
      map.set(key, {
        quantity: 1,
        name: c.name,
        setCode: c.set,
        collectorNumber: c.collector_number,
        category: "Deck",
      });
    }
  }
  return toMoxfieldList([...map.values()], true);
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
