import { amazonProductUrl, amazonSearchUrl } from "./affiliate";

export type PlaystyleId =
  | "aggro"
  | "control"
  | "tokens"
  | "bigCreatures"
  | "spellslinger"
  | "lifegain";

export type BeginnerPrecon = {
  name: string;
  commander: string;
  description: string;
  styles: PlaystyleId[];
  /** Product-line year. Used with `recency` for selection bias. */
  year: number;
  /**
   * Availability / freshness 1–10. Newer openly stocked retail decks score higher;
   * older hard-to-find precons score low so they appear less often.
   */
  recency: number;
  /** Amazon product ASIN when known; otherwise search by name. */
  asin?: string;
  searchQuery?: string;
};

/**
 * Beginner precon catalog: recent Commander decks (2024–2026) plus a few
 * still-buyable older staples. Selection weights by `recency` so newer stock wins.
 * Style tags are conservative — only attach playstyles the deck clearly supports.
 */
const BEGINNER_PRECONS: BeginnerPrecon[] = [
  // —— Older but still buyable (low recency) ——
  {
    name: "Party Time",
    commander: "Nalia de'Arnise",
    description: "Assemble a party of creatures and attack together. Fast, social, and easy to pilot.",
    styles: ["aggro", "tokens"],
    year: 2022,
    recency: 2,
    asin: "B09VB4KP78",
  },
  {
    name: "Exit from Exile",
    commander: "Faldorn, Dread Wolf Herald",
    description: "Ramp, exile, then smash with giant threats and wolves. Big and satisfying.",
    styles: ["bigCreatures", "aggro"],
    year: 2022,
    recency: 2,
    asin: "B09VBGNJ7B",
  },
  {
    name: "Mind Flayarrrs",
    commander: "Captain N'ghathrod",
    description: "Mill opponents and steal their best creatures. Teaches timing and answers.",
    styles: ["control"],
    year: 2022,
    recency: 2,
    asin: "B09VB9MX16",
  },
  {
    name: "Draconic Dissent",
    commander: "Firkraag, Cunning Instigator",
    description: "Dragons and goads: play huge flyers and push others into fighting.",
    styles: ["bigCreatures", "aggro"],
    year: 2022,
    recency: 2,
    asin: "B09VB48C59",
  },
  {
    name: "Virtue and Valor",
    commander: "Ellivere of the Wild Court",
    description: "Grow a board of enchanted creatures and tokens. Fun boards without complex rules.",
    styles: ["tokens", "aggro"],
    year: 2023,
    recency: 4,
    asin: "B0C3SR4GVH",
  },
  {
    name: "Fae Dominion",
    commander: "Tegwyll, Duke of Splendor",
    description: "Faerie tricks and reactive spells. Great if you like clever plays.",
    styles: ["control", "spellslinger"],
    year: 2023,
    recency: 4,
    asin: "B0C3SYGRFT",
  },

  // —— Outlaws of Thunder Junction (2024) ——
  {
    name: "Most Wanted",
    commander: "Olivia, Opulent Outlaw",
    description: "Outlaws, treasure, and aggression: flashy combat with easy treasure payoffs.",
    styles: ["aggro", "tokens"],
    year: 2024,
    recency: 5,
    searchQuery: "MTG Commander Most Wanted precon Olivia Outlaws of Thunder Junction",
  },
  {
    name: "Desert Bloom",
    commander: "Yuma, Proud Protector",
    description: "Sacrifice lands for cards and Plant tokens, then grow a stubborn board.",
    styles: ["tokens", "bigCreatures"],
    year: 2024,
    recency: 5,
    searchQuery: "MTG Commander Desert Bloom precon Yuma Outlaws of Thunder Junction",
  },
  {
    name: "Quick Draw",
    commander: "Stella Lee, Wild Card",
    description: "Cast multiple spells in a turn and copy the clever ones. Pure spellslinger fun.",
    styles: ["spellslinger"],
    year: 2024,
    recency: 5,
    searchQuery: "MTG Commander Quick Draw precon Stella Lee Outlaws of Thunder Junction",
  },
  {
    name: "Grand Larceny",
    commander: "Gonti, Canny Acquisitor",
    description: "Steal cards from opponents and cast their best spells. Cheeky control energy.",
    styles: ["control", "spellslinger"],
    year: 2024,
    recency: 5,
    searchQuery: "MTG Commander Grand Larceny precon Gonti Outlaws of Thunder Junction",
  },

  // —— Bloomburrow (2024) ——
  {
    name: "Peace Offering",
    commander: "Ms. Bumbleflower",
    description: "Group-hug gifts that still win: great first precon if you like politics and tokens.",
    styles: ["tokens", "lifegain"],
    year: 2024,
    recency: 6,
    searchQuery: "MTG Commander Peace Offering precon Bloomburrow Bumbleflower",
  },
  {
    name: "Animated Army",
    commander: "Bello, Bard of the Brambles",
    description: "Turn artifacts and enchantments into hasty beaters. Aggressive and easy to follow.",
    styles: ["aggro", "bigCreatures"],
    year: 2024,
    recency: 6,
    searchQuery: "MTG Commander Animated Army precon Bloomburrow Bello",
  },
  {
    name: "Family Matters",
    commander: "Zinnia, Valley's Voice",
    description: "Offspring tokens and go-wide boards: friendly creature strategy for new players.",
    styles: ["tokens", "aggro"],
    year: 2024,
    recency: 6,
    searchQuery: "MTG Commander Family Matters precon Bloomburrow Zinnia",
  },
  {
    name: "Squirreled Away",
    commander: "Hazel of the Rootbloom",
    description: "Make squirrel tokens, tap them for mana, and snowball a go-wide army.",
    styles: ["tokens", "aggro"],
    year: 2024,
    recency: 6,
    searchQuery: "MTG Commander Squirreled Away precon Bloomburrow Hazel",
  },

  // —— Duskmourn (2024) ——
  {
    name: "Endless Punishment",
    commander: "Valgavoth, Harrower of Souls",
    description: "Drain life, grow your demon, and draw cards whenever opponents lose life.",
    styles: ["control", "aggro"],
    year: 2024,
    recency: 6,
    searchQuery: "MTG Commander Endless Punishment precon Duskmourn Valgavoth",
  },
  {
    name: "Miracle Worker",
    commander: "Aminatou, Veil Piercer",
    description: "Surveil into cheap miracle enchantments. Grindy Esper value for patient pilots.",
    styles: ["control", "spellslinger"],
    year: 2024,
    recency: 6,
    searchQuery: "MTG Commander Miracle Worker precon Duskmourn Aminatou",
  },
  {
    name: "Jump Scare!",
    commander: "Zimone, Mystery Unraveler",
    description: "Manifest face-down creatures, then flip them into huge threats.",
    styles: ["bigCreatures", "control"],
    year: 2024,
    recency: 6,
    searchQuery: "MTG Commander Jump Scare precon Duskmourn Zimone",
  },
  {
    name: "Death Toll",
    commander: "Winter, Cynical Opportunist",
    description: "Fill the graveyard with card types, then reanimate and grind out value.",
    styles: ["control", "bigCreatures"],
    year: 2024,
    recency: 6,
    searchQuery: "MTG Commander Death Toll precon Duskmourn Winter",
  },

  // —— Aetherdrift (2025) ——
  {
    name: "Living Energy",
    commander: "Saheeli, Radiant Creator",
    description: "Artifacts and Energy: build machines, spend Energy, then race ahead.",
    styles: ["tokens", "aggro"],
    year: 2025,
    recency: 7,
    searchQuery: "MTG Commander Living Energy precon Aetherdrift Saheeli",
  },
  {
    name: "Eternal Might",
    commander: "Temmet, Naktamun's Will",
    description: "Zombies that get bigger every time you draw. Classic grind with modern packaging.",
    styles: ["control", "tokens", "bigCreatures"],
    year: 2025,
    recency: 7,
    searchQuery: "MTG Commander Eternal Might precon Aetherdrift Temmet",
  },

  // —— Tarkir: Dragonstorm (2025) ——
  {
    name: "Temur Roar",
    commander: "Ureni of the Unwritten",
    description: "Ramp into dragons and cheat huge flyers onto the battlefield.",
    styles: ["bigCreatures", "aggro"],
    year: 2025,
    recency: 8,
    searchQuery: "MTG Commander Temur Roar precon Tarkir Dragonstorm Ureni",
  },
  {
    name: "Mardu Surge",
    commander: "Zurgo Stormrender",
    description: "Tokens and combat tricks: aggressive Mardu that rewards attacking often.",
    styles: ["aggro", "tokens"],
    year: 2025,
    recency: 8,
    searchQuery: "MTG Commander Mardu Surge precon Tarkir Dragonstorm Zurgo",
  },
  {
    name: "Abzan Armor",
    commander: "Felothar the Steadfast",
    description: "Toughness-matters walls that attack. Defensive board that still hits hard.",
    styles: ["control", "bigCreatures", "lifegain"],
    year: 2025,
    recency: 8,
    searchQuery: "MTG Commander Abzan Armor precon Tarkir Dragonstorm Felothar",
  },
  {
    name: "Sultai Arisen",
    commander: "Teval, the Balanced Scale",
    description: "Mill, recur from the graveyard, and grow a resilient Sultai value engine.",
    styles: ["control", "bigCreatures"],
    year: 2025,
    recency: 8,
    searchQuery: "MTG Commander Sultai Arisen precon Tarkir Dragonstorm Teval",
  },
  {
    name: "Jeskai Striker",
    commander: "Shiko and Narset, Unified",
    description: "Instants, sorceries, and prowess-style combat. Spellslinger with a punch.",
    styles: ["spellslinger", "aggro"],
    year: 2025,
    recency: 8,
    searchQuery: "MTG Commander Jeskai Striker precon Tarkir Dragonstorm Shiko Narset",
  },

  // —— Final Fantasy (2025) ——
  {
    name: "Limit Break",
    commander: "Cloud, Ex-SOLDIER",
    description: "Suit up heroes with Equipment and swing as a legendary squad.",
    styles: ["aggro", "bigCreatures"],
    year: 2025,
    recency: 8,
    searchQuery: "MTG Final Fantasy Commander Limit Break precon Cloud",
  },
  {
    name: "Counter Blitz",
    commander: "Tidus, Yuna's Guardian",
    description: "Stack +1/+1 counters, proliferate, and grow a Bant beatdown team.",
    styles: ["aggro", "lifegain"],
    year: 2025,
    recency: 8,
    searchQuery: "MTG Final Fantasy Commander Counter Blitz precon Tidus",
  },
  {
    name: "Scions & Spellcraft",
    commander: "Y'shtola, Night's Blessed",
    description: "Noncreature spells that gain life, deal damage, and grind Esper advantage.",
    styles: ["spellslinger", "control", "lifegain"],
    year: 2025,
    recency: 8,
    searchQuery: "MTG Final Fantasy Commander Scions and Spellcraft precon Y'shtola",
  },
  {
    name: "Revival Trance",
    commander: "Terra, Herald of Hope",
    description: "Mill into the graveyard, then reanimate small creatures and keep attacking.",
    styles: ["aggro", "control"],
    year: 2025,
    recency: 8,
    searchQuery: "MTG Final Fantasy Commander Revival Trance precon Terra",
  },

  // —— Edge of Eternities (2025) ——
  {
    name: "World Shaper",
    commander: "Hearthhull, the Worldseed",
    description: "Lands-matter value: ramp, sacrifice, and rebuild into bigger threats.",
    styles: ["bigCreatures", "control"],
    year: 2025,
    recency: 9,
    searchQuery: "MTG Commander World Shaper precon Edge of Eternities",
  },
  {
    name: "Counter Intelligence",
    commander: "Kilo, Apogee Mind",
    description: "Proliferate and counters: a modern Jeskai engine still common on Amazon.",
    styles: ["spellslinger", "control"],
    year: 2025,
    recency: 9,
    searchQuery: "MTG Commander Counter Intelligence precon Edge of Eternities",
  },

  // —— Lorwyn Eclipsed (2026) ——
  {
    name: "Dance of the Elements",
    commander: "Ashling, the Limitless",
    description: "Five-color Elementals with Evoke: cheat big enters and swing typal style.",
    styles: ["bigCreatures", "aggro", "spellslinger"],
    year: 2026,
    recency: 9,
    searchQuery: "MTG Commander Dance of the Elements precon Lorwyn Eclipsed",
  },
  {
    name: "Blight Curse",
    commander: "Auntie Ool, Cursewretch",
    description: "-1/-1 counters and attrition: a grindier Lorwyn Eclipsed precon.",
    styles: ["control"],
    year: 2026,
    recency: 9,
    searchQuery: "MTG Commander Blight Curse precon Lorwyn Eclipsed",
  },

  // —— Teenage Mutant Ninja Turtles (2026) ——
  {
    name: "Turtle Power!",
    commander: "Leonardo, the Balance",
    description: "Five-color Turtles with partner options: counters, tokens, and teamwork.",
    styles: ["aggro", "tokens", "lifegain"],
    year: 2026,
    recency: 10,
    searchQuery: "MTG Commander Turtle Power precon Teenage Mutant Ninja Turtles Leonardo",
  },

  // —— Secrets of Strixhaven (2026) ——
  {
    name: "Silverquill Influence",
    commander: "Killian, Decisive Mentor",
    description: "Politics, goad, and Auras: talk your way into wins while building a board.",
    styles: ["control", "aggro"],
    year: 2026,
    recency: 10,
    searchQuery: "MTG Commander Silverquill Influence precon Secrets of Strixhaven Killian",
  },
  {
    name: "Prismari Artistry",
    commander: "Rootha, Mastering the Moment",
    description: "Big instants and sorceries that paint the board. Classic spellslinger flair.",
    styles: ["spellslinger", "aggro"],
    year: 2026,
    recency: 10,
    searchQuery: "MTG Commander Prismari Artistry precon Secrets of Strixhaven Rootha",
  },
  {
    name: "Witherbloom Pestilence",
    commander: "Dina, Essence Brewer",
    description: "Sacrifice creatures, gain life, and drain the table. Aristocrats made simple.",
    styles: ["lifegain", "tokens", "control"],
    year: 2026,
    recency: 10,
    searchQuery: "MTG Commander Witherbloom Pestilence precon Secrets of Strixhaven Dina",
  },
  {
    name: "Lorehold Spirit",
    commander: "Quintorius, History Chaser",
    description: "Graveyard Spirits and tokens: dig up the past and swing with history.",
    styles: ["tokens", "aggro"],
    year: 2026,
    recency: 10,
    searchQuery: "MTG Commander Lorehold Spirit precon Secrets of Strixhaven Quintorius",
  },
  {
    name: "Quandrix Unlimited",
    commander: "Zimone, Infinite Analyst",
    description: "+1/+1 counters and X-spells: grow creatures with math-magic Simic toys.",
    styles: ["bigCreatures", "spellslinger", "tokens"],
    year: 2026,
    recency: 10,
    searchQuery: "MTG Commander Quandrix Unlimited precon Secrets of Strixhaven Zimone",
  },

  // —— Marvel Super Heroes (2026) ——
  {
    name: "Avengers Assemble",
    commander: "Captain America, Team Leader",
    description: "Heroes, Equipment, and +1/+1 counters: rally a squad and attack together.",
    styles: ["aggro", "tokens", "lifegain"],
    year: 2026,
    recency: 10,
    searchQuery: "MTG Marvel Super Heroes Commander Avengers Assemble Captain America",
  },
  {
    name: "The Fantastic Four",
    commander: "Mister Fantastic",
    description: "Cast noncreature spells, then copy triggers as Marvel's First Family.",
    styles: ["spellslinger", "control"],
    year: 2026,
    recency: 10,
    searchQuery: "MTG Marvel Super Heroes Commander The Fantastic Four Mister Fantastic",
  },
  {
    name: "Wakanda Forever",
    commander: "T'Challa, the Black Panther",
    description: "Artifacts, tokens, and monarch value: steady Selesnya advantage.",
    styles: ["tokens", "lifegain", "control"],
    year: 2026,
    recency: 10,
    searchQuery: "MTG Marvel Super Heroes Commander Wakanda Forever T'Challa",
  },
  {
    name: "Doom Prevails",
    commander: "Doctor Doom, King of Latveria",
    description: "Villains, discard, and life drain: a sneaky Grixis control grind.",
    styles: ["control", "spellslinger"],
    year: 2026,
    recency: 10,
    searchQuery: "MTG Marvel Super Heroes Commander Doom Prevails Doctor Doom",
  },
];

/** Closest alternate styles when the primary pool is thin. */
const PLAYSTYLE_NEIGHBORS: Record<PlaystyleId, PlaystyleId[]> = {
  aggro: ["tokens", "bigCreatures"],
  control: ["spellslinger", "lifegain"],
  tokens: ["aggro", "lifegain"],
  bigCreatures: ["aggro", "tokens"],
  spellslinger: ["control", "aggro"],
  lifegain: ["tokens", "control"],
};

function weightedPickPrecon(pool: BeginnerPrecon[]): BeginnerPrecon {
  // Square recency so newer stock dominates when styles match.
  const weights = pool.map((p) => Math.max(1, p.recency) ** 2);
  const total = weights.reduce((sum, w) => sum + w, 0);
  let roll = Math.random() * total;
  for (let i = 0; i < pool.length; i++) {
    roll -= weights[i];
    if (roll <= 0) return pool[i];
  }
  return pool[pool.length - 1];
}

function poolForStyle(style: PlaystyleId, avoidName?: string): BeginnerPrecon[] {
  let pool = BEGINNER_PRECONS.filter((p) => p.styles.includes(style));
  if (avoidName) {
    const filtered = pool.filter((p) => p.name !== avoidName);
    if (filtered.length) pool = filtered;
  }
  return pool;
}

export function pickBeginnerPrecon(
  style: PlaystyleId,
  opts?: { avoidName?: string },
): BeginnerPrecon {
  // 1) Exact style matches (prefer a healthy pool of recent decks)
  let pool = poolForStyle(style, opts?.avoidName);

  // 2) Sparse / empty → expand to neighbor styles (still thematic, not random)
  if (pool.length < 3) {
    const seen = new Set(pool.map((p) => p.name));
    for (const neighbor of PLAYSTYLE_NEIGHBORS[style] ?? []) {
      for (const p of poolForStyle(neighbor, opts?.avoidName)) {
        if (!seen.has(p.name)) {
          seen.add(p.name);
          pool.push(p);
        }
      }
      if (pool.length >= 5) break;
    }
  }

  // 3) Last resort: full catalog (should be rare)
  if (!pool.length) {
    pool = opts?.avoidName
      ? BEGINNER_PRECONS.filter((p) => p.name !== opts.avoidName)
      : [...BEGINNER_PRECONS];
    if (!pool.length) pool = [...BEGINNER_PRECONS];
  }

  return weightedPickPrecon(pool);
}

export function beginnerPreconUrl(precon: BeginnerPrecon): string {
  if (precon.asin) return amazonProductUrl(precon.asin);
  return amazonSearchUrl(
    precon.searchQuery ?? `MTG Commander ${precon.name} precon deck`,
  );
}

/** Gear types for the beginner Get step — labels only, no product links. */
export function beginnerSupplyTypes(): string[] {
  return ["Deck box", "D6 dice", "Spindown D20", "Card sleeves"];
}

