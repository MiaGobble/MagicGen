/**
 * HXDEC — hexadecimal compact MTG decklist format
 * Spec: https://edhpowerlevel.com/hxdec/ (hxdec npm / EDH Power Level)
 *
 * Card code: qtyChar + 3-digit set hex index + collector hex (or ~text~)
 * Sections: h=main, k=commander, s=sideboard, m=maybeboard
 * Qty: u=1 v=2 w=3 x=4; y+1hex=5–15; z+2hex=16–255
 */
import { collectionLookup, scryfallFetch } from "./scryfall";

/** Minimal line shape (avoids circular import with deckFormat). */
export type HxDeckLine = {
  quantity: number;
  name: string;
  setCode?: string;
  collectorNumber?: string;
  isFoil?: boolean;
  finish?: string;
  category?: string;
};

type HxSet = { code: string; hx_set: string; date: number };

const SET_CACHE_KEY = "magicgen-hxdec-sets-v1";
const SET_CACHE_TTL_MS = 10 * 24 * 60 * 60 * 1000;

let setData: HxSet[] = [];
let setLoad: Promise<HxSet[]> | null = null;

type ScryfallSetRow = {
  code: string;
  released_at?: string;
  set_type?: string;
};

/** True if the string looks like an HXDEC list (after stripping wrappers). */
export function isHxdec(list: string): boolean {
  const stripped = list
    .trim()
    .replace(/\s+/g, "")
    .replace(/\[.*?\]/g, "")
    .replace(/\*.*?\*/g, "")
    .replace(/\^.*?\^/g, "")
    .replace(/~.*?~/g, "")
    .replace(/\+.*\+/g, "");
  return /^h[uvwxyzksmpabcdef\d]*$/i.test(stripped);
}

export async function ensureHxdecSets(): Promise<HxSet[]> {
  if (setData.length) return setData;
  if (setLoad) return setLoad;

  setLoad = (async () => {
    try {
      const raw = localStorage.getItem(SET_CACHE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as { age: number; sets: HxSet[] };
        if (parsed?.sets?.length && Date.now() - parsed.age < SET_CACHE_TTL_MS) {
          setData = parsed.sets;
          return setData;
        }
      }
    } catch {
      /* ignore */
    }

    const resp = await scryfallFetch<{ data: ScryfallSetRow[] }>("/sets");
    const rows = [...(resp.data ?? [])].sort((a, b) => {
      const da = a.released_at ? new Date(a.released_at).getTime() : 0;
      const db = b.released_at ? new Date(b.released_at).getTime() : 0;
      return da - db;
    });

    const sets: HxSet[] = [];
    let counter = 1;
    for (const set of rows) {
      if (set.set_type === "token") continue;
      sets.push({
        code: set.code,
        date: set.released_at ? new Date(set.released_at).getTime() : 0,
        hx_set: Number(counter).toString(16).padStart(3, "0"),
      });
      counter += 1;
    }

    setData = sets;
    try {
      localStorage.setItem(SET_CACHE_KEY, JSON.stringify({ age: Date.now(), sets }));
    } catch {
      /* ignore */
    }
    return setData;
  })().finally(() => {
    setLoad = null;
  });

  return setLoad;
}

function hxSetForCode(code: string): string {
  const found = setData.find((s) => s.code.toLowerCase() === code.toLowerCase());
  return found?.hx_set ?? "";
}

function codeForHxSet(hx: string): string {
  const found = setData.find((s) => s.hx_set === hx.toLowerCase());
  return found?.code ?? "";
}

function encodeQty(qty: number): string {
  const q = Math.max(1, Math.min(255, Math.floor(qty)));
  if (q <= 4) return ["u", "v", "w", "x"][q - 1];
  if (q < 16) return `y${q.toString(16)}`;
  return `z${q.toString(16).padStart(2, "0")}`;
}

function encodeCollector(cn: string): string {
  if (/^\d+$/.test(cn)) return Number(cn).toString(16);
  return `~${cn}~`;
}

function encodeFinish(finish?: string, isFoil?: boolean): string {
  const f = (finish ?? (isFoil ? "foil" : "")).toLowerCase();
  if (f === "foil" || f === "f") return "*F*";
  if (f === "etched" || f === "e") return "*E*";
  if (f === "glossy" || f === "g") return "*G*";
  return "";
}

function sectionKey(category?: string): "mainboard" | "commander" | "sideboard" | "maybeboard" {
  const c = (category ?? "Deck").toLowerCase();
  if (c === "commander" || c === "commanders") return "commander";
  if (c === "sideboard" || c === "sb") return "sideboard";
  if (c === "maybeboard") return "maybeboard";
  return "mainboard";
}

function encodeCard(line: HxDeckLine, includeFoil: boolean): string | null {
  if (!line.setCode || !line.collectorNumber) return null;
  const hxSet = hxSetForCode(line.setCode);
  if (!hxSet) return null;
  let out =
    encodeQty(line.quantity) + hxSet + encodeCollector(line.collectorNumber);
  if (includeFoil) out += encodeFinish(line.finish, line.isFoil);
  return out;
}

/**
 * Encode deck lines to HXDEC. Requires set cache (call ensureHxdecSets first).
 * Cards missing set/collector number are omitted from the compact string.
 */
export function encodeHxdec(lines: HxDeckLine[], opts?: { foil?: boolean }): string {
  const foil = opts?.foil ?? true;
  const buckets: Record<"mainboard" | "commander" | "sideboard" | "maybeboard", string[]> = {
    mainboard: [],
    commander: [],
    sideboard: [],
    maybeboard: [],
  };

  for (const line of lines) {
    const encoded = encodeCard(line, foil);
    if (!encoded) continue;
    buckets[sectionKey(line.category)].push(encoded);
  }

  // Official builder requires a mainboard section; if only commanders exist, put them under h.
  let main = buckets.mainboard;
  let commanders = buckets.commander;
  if (!main.length && commanders.length) {
    main = commanders;
    commanders = [];
  }
  if (!main.length) return "";

  let out = `h${main.join("")}`;
  if (commanders.length) out += `k${commanders.join("")}`;
  if (buckets.sideboard.length) out += `s${buckets.sideboard.join("")}`;
  if (buckets.maybeboard.length) out += `m${buckets.maybeboard.join("")}`;
  return out;
}

export async function serializeHxdecAsync(
  lines: HxDeckLine[],
  opts?: { foil?: boolean },
): Promise<string> {
  await ensureHxdecSets();
  return encodeHxdec(lines, opts);
}

type RawHxCard = {
  qty: number;
  set: string;
  collector_number: string;
  foil: string;
  target_section: string;
};

/** Structural decode (needs set cache). Names left empty. */
export function digestHxdec(list: string): RawHxCard[] {
  let working = list.trim().replace(/\s+/g, "");

  const captureWrapped = (wrap1: string, wrap2: string, regex: RegExp): string[] => {
    const captured: string[] = [];
    const matches = working.match(regex) || [];
    matches.forEach((match) => {
      captured.push(match.slice(wrap1.length, match.length - wrap2.length));
      working = working.replace(match, `${wrap1}${captured.length - 1}${wrap2}`);
    });
    return captured;
  };

  const textSets = captureWrapped("~", "~", /~(.*?)~/g);
  const foilValues = captureWrapped("*", "*", /\*(.*?)\*/g);
  captureWrapped("[", "]", /\[(.*?)\]/g);
  captureWrapped("^", "^", /\^(.*?)\^/g);
  captureWrapped("+", "+", /\+(.*)\+/g);
  working = working.replace(/\+.*\+/g, "");

  const cards: RawHxCard[] = [];
  const sections = working.split(/(?=[hksm])/i).filter(Boolean);

  for (const section of sections) {
    const type = section[0]?.toLowerCase();
    const data = section.slice(1);
    const target =
      type === "h"
        ? "mainboard"
        : type === "k"
          ? "commander"
          : type === "s"
            ? "sideboard"
            : type === "m"
              ? "maybeboard"
              : null;
    if (!target) continue;

    const cardCodes = data.split(/(?=[uvwxyz])/i).filter(Boolean);
    for (let code of cardCodes) {
      const qtyChar = code[0]?.toLowerCase();
      code = code.slice(1);
      let qty = ["u", "v", "w", "x", "y", "z"].indexOf(qtyChar) + 1;
      if (qtyChar === "y") {
        qty = parseInt(code.slice(0, 1), 16);
        code = code.slice(1);
      } else if (qtyChar === "z") {
        qty = parseInt(code.slice(0, 2), 16);
        code = code.slice(2);
      }

      let foil = "";
      if (code.includes("*")) {
        const foilMatch = code.match(/\*(.*?)\*/);
        if (foilMatch) {
          foil = foilValues[parseInt(foilMatch[1], 10)] ?? foilMatch[1];
          code = code.replace(foilMatch[0], "");
        }
      }
      if (code.includes("^")) {
        const tagMatch = code.match(/\^(.*?)\^/);
        if (tagMatch) code = code.replace(tagMatch[0], "");
      }
      if (code.includes("[")) {
        const catMatch = code.match(/\[(.*?)\]/);
        if (catMatch) code = code.replace(catMatch[0], "");
      }

      const setHx = code.slice(0, 3).toLowerCase();
      let numberHx = code.slice(3);
      let number = String(parseInt(numberHx, 16));
      if (Number.isNaN(parseInt(number, 10)) && numberHx.includes("~")) {
        const idx = parseInt(numberHx.replace(/~/g, ""), 10);
        number = textSets[idx] ?? numberHx.replace(/~/g, "");
      } else if (Number.isNaN(parseInt(number, 10))) {
        continue;
      }

      const set = codeForHxSet(setHx);
      cards.push({
        qty,
        set,
        collector_number: number,
        foil,
        target_section: target,
      });
    }
  }

  return cards;
}

function categoryFromSection(section: string): string {
  if (section === "commander") return "Commander";
  if (section === "sideboard") return "Sideboard";
  if (section === "maybeboard") return "Maybeboard";
  return "Deck";
}

/** Decode HXDEC → lines with card names resolved via Scryfall. */
export async function parseHxdec(list: string): Promise<HxDeckLine[]> {
  await ensureHxdecSets();
  const raw = digestHxdec(list);
  if (!raw.length) return [];

  const idents = raw
    .filter((c) => c.set && c.collector_number)
    .map((c) => ({ set: c.set, collector_number: c.collector_number }));

  const cards = idents.length ? await collectionLookup(idents) : [];
  const byKey = new Map(
    cards.map((c) => [`${(c.set ?? "").toLowerCase()}|${c.collector_number}`, c]),
  );

  const lines: HxDeckLine[] = [];
  for (const c of raw) {
    const key = `${c.set.toLowerCase()}|${c.collector_number}`;
    const card = byKey.get(key);
    const finish =
      c.foil.toLowerCase() === "f" || c.foil.toLowerCase() === "foil"
        ? "foil"
        : c.foil.toLowerCase() === "e" || c.foil.toLowerCase() === "etched"
          ? "etched"
          : c.foil.toLowerCase() === "g" || c.foil.toLowerCase() === "glossy"
            ? "glossy"
            : undefined;

    lines.push({
      quantity: c.qty,
      name: card?.name?.split(" // ")[0] ?? `${c.set.toUpperCase()} #${c.collector_number}`,
      setCode: c.set || undefined,
      collectorNumber: c.collector_number || undefined,
      isFoil: finish === "foil" || undefined,
      finish,
      category: categoryFromSection(c.target_section),
    });
  }
  return lines;
}
