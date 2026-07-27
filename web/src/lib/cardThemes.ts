/**
 * Local theme tagging and combo-pair helpers for pool-to-decks coherence.
 * Purely algorithmic — no LLM / paid APIs.
 */
import type { ScryfallCard } from "./scryfall";

function normalizeName(name: string): string {
  return name.toLowerCase().split(" // ")[0].trim();
}

function cardOracleText(card: ScryfallCard): string {
  if (card.oracle_text) return card.oracle_text;
  return (
    card.card_faces
      ?.map((f) => `${f.name}\n${f.oracle_text ?? ""}`)
      .join("\n") ?? ""
  );
}

function cardTypeLine(card: ScryfallCard): string {
  if (card.type_line) return card.type_line;
  return card.card_faces?.map((f) => f.type_line ?? "").join(" // ") ?? "";
}

/** Known 2-card packages — either half present boosts keeping its mate. */
export const KNOWN_COMBO_PAIRS: ReadonlyArray<readonly [string, string]> = [
  ["thassa's oracle", "demonic consultation"],
  ["thassa's oracle", "tainted pact"],
  ["underworld breach", "lion's eye diamond"],
  ["underworld breach", "brain freeze"],
  ["lion's eye diamond", "brain freeze"],
  ["isochron scepter", "dramatic reversal"],
  ["dualcaster mage", "twinflame"],
  ["dualcaster mage", "heat shimmer"],
  ["dualcaster mage", "ghostly flicker"],
  ["food chain", "temur sabertooth"],
  ["dockside extortionist", "temur sabertooth"],
  ["nidax, blighted force", "food chain"],
];

const COMBO_MATES = (() => {
  const map = new Map<string, string[]>();
  for (const [a, b] of KNOWN_COMBO_PAIRS) {
    const listA = map.get(a) ?? [];
    listA.push(b);
    map.set(a, listA);
    const listB = map.get(b) ?? [];
    listB.push(a);
    map.set(b, listB);
  }
  return map;
})();

/** Creature subtypes worth treating as tribal themes when dense enough. */
const TRIBAL_TYPES = [
  "elf",
  "elves",
  "goblin",
  "goblins",
  "zombie",
  "zombies",
  "vampire",
  "vampires",
  "dragon",
  "dragons",
  "angel",
  "angels",
  "demon",
  "demons",
  "dinosaur",
  "dinosaurs",
  "merfolk",
  "wizard",
  "wizards",
  "warrior",
  "warriors",
  "soldier",
  "soldiers",
  "spirit",
  "spirits",
  "elemental",
  "elementals",
  "beast",
  "beasts",
  "cat",
  "cats",
  "human",
  "humans",
  "pirate",
  "pirates",
  "sliver",
  "slivers",
  "eldrazi",
  "phyrexian",
  "phyrexians",
  "insect",
  "insects",
  "faerie",
  "faeries",
  "knight",
  "knights",
  "rogue",
  "rogues",
  "druid",
  "druids",
  "cleric",
  "clerics",
  "shaman",
  "shamans",
  "ninja",
  "ninjas",
  "samurai",
  "hydra",
  "hydras",
  "treefolk",
  "spider",
  "spiders",
  "horror",
  "horrors",
  "construct",
  "constructs",
  "vehicle",
  "vehicles",
];

function singularTribal(subtype: string): string {
  const s = subtype.toLowerCase();
  if (s.endsWith("ves")) return s.slice(0, -3) + "f"; // elves → elf
  if (s.endsWith("ies")) return s.slice(0, -3) + "y";
  if (s.endsWith("s") && !s.endsWith("ss") && !s.endsWith("us")) return s.slice(0, -1);
  return s;
}

/**
 * Tag a card with playstyle / package themes from type line, oracle text, and keywords.
 */
export function tagCardThemes(card: ScryfallCard): Set<string> {
  const themes = new Set<string>();
  const t = cardTypeLine(card);
  const text = cardOracleText(card);
  const kw = (card.keywords ?? []).map((k) => k.toLowerCase());
  const blob = `${t}\n${text}\n${kw.join(" ")}`.toLowerCase();

  // Playstyles aligned with scryfall PLAYSTYLE_QUERIES
  if (
    /\bhaste\b/.test(blob) ||
    /\battack\b/.test(text.toLowerCase()) ||
    /\bwarrior\b/i.test(t)
  ) {
    themes.add("aggro");
  }
  if (
    /\bcounter (target|all)\b/i.test(text) ||
    /\bdestroy target\b/i.test(text) ||
    /\bexile target\b/i.test(text)
  ) {
    themes.add("control");
  }
  if (/\bcreate\b/i.test(text) || /\btoken\b/i.test(blob)) {
    themes.add("tokens");
  }
  if (/\bdies\b/i.test(text) || /\bsacrifice\b/i.test(text)) {
    themes.add("aristocrats");
  }
  if (
    /\binstant\b/i.test(t) ||
    /\bsorcery\b/i.test(t) ||
    /\bwizard\b/i.test(t) ||
    /\bcast\b/i.test(text)
  ) {
    if (/\binstant\b|\bsorcery\b|\bwizard\b|\bspells? you cast\b/i.test(blob)) {
      themes.add("spellslinger");
    }
  }
  if (/\bequip\b/i.test(blob) || /\baura\b/i.test(t) || /\battached\b/i.test(text)) {
    themes.add("voltron");
  }
  if (/\btrample\b/i.test(blob) || /\bpower\b/i.test(text)) {
    // stompy: large creatures / trample
    const powerMatch = t.match(/(\d+)\s*\/\s*\d+/);
    if (/\btrample\b/i.test(blob) || (powerMatch && Number(powerMatch[1]) >= 5)) {
      themes.add("stompy");
    }
  }
  if (
    (/\bgain life\b/i.test(text) || /\blifelink\b/i.test(blob)) &&
    !(/\bloses life\b/i.test(text) || /\blose life\b/i.test(text) || /\bextort\b/i.test(blob))
  ) {
    themes.add("lifegain");
  }
  if (/\btreasure\b/i.test(blob)) {
    themes.add("treasure");
  }
  if (/\bgraveyard\b/i.test(text) || /\bfrom (your |a )?graveyard\b/i.test(text)) {
    themes.add("reanimator");
    themes.add("graveyard");
  }

  // Pool-builder extensions
  if (/\bartifact\b/i.test(t) || /\bartifact\b/i.test(text)) {
    themes.add("artifacts");
  }
  if (
    /\bcounter\b/i.test(text) &&
    (/\b\+1\/\+1\b/.test(text) ||
      /\bproliferate\b/i.test(blob) ||
      /\bcharge counter\b/i.test(text) ||
      /\bexperience counter\b/i.test(text))
  ) {
    themes.add("counters");
  }
  if (/\bproliferate\b/i.test(blob)) themes.add("counters");
  if (
    /\bexile (target|it|a creature).*(return|put).*battlefield\b/i.test(text) ||
    /\bblink\b/i.test(text) ||
    /\bflicker\b/i.test(text) ||
    /\benters (the battlefield )?(tapped )?(and )?(then )?exile\b/i.test(text)
  ) {
    themes.add("blink");
  }
  if (
    /\bwhenever a land enters\b/i.test(text) ||
    /\blandfall\b/i.test(blob) ||
    /\blands? you control\b/i.test(text)
  ) {
    themes.add("landfall");
  }
  if (
    /\bsearch your library for (a |an )?(basic )?(forest|island|swamp|mountain|plains|land)\b/i.test(
      text,
    ) ||
    /add \{[wubrgc0-9]+\}/i.test(text) ||
    /\bramp\b/i.test(text)
  ) {
    themes.add("ramp");
  }
  if (/\bdraw (a|two|three|x|\d+) cards?\b/i.test(text) || /\bdraw a card\b/i.test(text)) {
    themes.add("draw");
  }
  if (
    /\bdestroy target\b/i.test(text) ||
    /\bexile target\b/i.test(text) ||
    /\bcounter target\b/i.test(text) ||
    /\b-X\/-X\b/.test(text) ||
    /\bdeals? \d+ damage to (any target|target creature)\b/i.test(text)
  ) {
    themes.add("removal");
  }

  // Tribal subtypes from type line (after em-dash / hyphen)
  const typeParts = t.split(/[—–-]/);
  const subtypes = (typeParts[1] ?? "")
    .split(/\/|\s+/)
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  for (const sub of subtypes) {
    const singular = singularTribal(sub);
    if (TRIBAL_TYPES.includes(sub) || TRIBAL_TYPES.includes(singular)) {
      themes.add(`tribal:${singular}`);
    }
  }
  // Lords / typal payoffs in oracle
  for (const tribe of TRIBAL_TYPES) {
    const sing = singularTribal(tribe);
    if (new RegExp(`\\b${tribe}\\b`, "i").test(text) && !themes.has(`tribal:${sing}`)) {
      // Only tag tribal from text if it looks like a typal payoff
      if (
        new RegExp(`other ${tribe}|${tribe} you control|${tribe} spells|${tribe} creatures`, "i").test(
          text,
        )
      ) {
        themes.add(`tribal:${sing}`);
      }
    }
  }

  return themes;
}

/** Count of shared theme tags between two sets. */
export function themeOverlap(a: Set<string> | Iterable<string>, b: Set<string> | Iterable<string>): number {
  const setB = b instanceof Set ? b : new Set(b);
  let n = 0;
  for (const t of a) {
    if (setB.has(t)) n += 1;
  }
  return n;
}

/** Merge theme sets (mutates `into`). */
export function mergeThemes(into: Set<string>, from: Iterable<string>): void {
  for (const t of from) into.add(t);
}

/**
 * If `cardKey` completes a known combo with any name already in `presentKeys`, return how many mates hit.
 */
export function comboPairHits(cardKey: string, presentKeys: Iterable<string>): number {
  const mates = COMBO_MATES.get(normalizeName(cardKey));
  if (!mates?.length) return 0;
  const present = new Set([...presentKeys].map(normalizeName));
  let hits = 0;
  for (const m of mates) {
    if (present.has(m)) hits += 1;
  }
  return hits;
}

/** Shared tribal:* tags between card themes and a profile. */
export function tribalOverlap(cardThemes: Set<string>, profile: Set<string>): number {
  let n = 0;
  for (const t of cardThemes) {
    if (t.startsWith("tribal:") && profile.has(t)) n += 1;
  }
  return n;
}

/**
 * Pool support density for a commander candidate: theme overlap + tribal density
 * over color-identity-fitting non-commander cards.
 */
export function poolThemeSupport(
  commanderThemes: Set<string>,
  fittingCards: Array<{ themes: Set<string>; isBasic?: boolean }>,
): number {
  let score = 0;
  const themeCounts = new Map<string, number>();
  for (const c of fittingCards) {
    if (c.isBasic) continue;
    const overlap = themeOverlap(commanderThemes, c.themes);
    score += overlap * 3;
    for (const t of c.themes) {
      if (commanderThemes.has(t)) {
        themeCounts.set(t, (themeCounts.get(t) ?? 0) + 1);
      }
    }
    // Tribal density: cards sharing commander tribal tags
    score += tribalOverlap(c.themes, commanderThemes) * 4;
  }
  // Bonus for themes that appear multiple times in the pool (real package density)
  for (const count of themeCounts.values()) {
    if (count >= 3) score += count * 1.5;
    else if (count >= 2) score += count;
  }
  return score;
}
