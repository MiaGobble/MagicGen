/** Affiliate + Amazon search URL builders. Product links are computed at runtime — no ASIN database. */

export const AFFILIATE_TAG = "igottic-20";

export function amazonSearchUrl(
  query: string,
  opts?: { minPrice?: number; maxPrice?: number; category?: string },
): string {
  const params = new URLSearchParams({
    k: query,
    tag: AFFILIATE_TAG,
  });
  if (opts?.category) params.set("i", opts.category);

  // Amazon price filter uses cents: p_36:4000-6000 => $40–$60
  if (opts?.minPrice != null || opts?.maxPrice != null) {
    const min = Math.round((opts.minPrice ?? 0) * 100);
    const max = Math.round((opts.maxPrice ?? 9999) * 100);
    params.set("rh", `p_36:${min}-${max}`);
  }

  return `https://www.amazon.com/s?${params.toString()}`;
}

export type HueName =
  | "red"
  | "orange"
  | "yellow"
  | "green"
  | "teal"
  | "blue"
  | "purple"
  | "pink"
  | "brown"
  | "black"
  | "white"
  | "gray";

/** Official-ish Dragon Shield Matte color names for accurate search hits. */
const HUE_SLEEVE_COLOR: Record<HueName, string> = {
  red: "Blood Red",
  orange: "Orange",
  yellow: "Yellow",
  green: "Forest Green",
  teal: "Petrol",
  blue: "Blue",
  purple: "Purple",
  pink: "Pink",
  brown: "Copper",
  black: "Black",
  white: "White",
  gray: "Silver",
};

export function hexToHueName(hex: string): HueName {
  const { h, s, l } = hexToHsl(hex);
  if (s < 12) {
    if (l < 18) return "black";
    if (l > 82) return "white";
    return "gray";
  }
  if (l < 14) return "black";
  if (l > 90 && s < 25) return "white";

  if (h < 15 || h >= 345) return "red";
  if (h < 40) return "orange";
  if (h < 70) return "yellow";
  if (h < 150) return "green";
  if (h < 185) return "teal";
  if (h < 255) return "blue";
  if (h < 290) return "purple";
  if (h < 330) return "pink";
  return "brown";
}

function hexToHsl(hex: string): { h: number; s: number; l: number } {
  let h = hex.replace("#", "").trim();
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  const r = parseInt(h.slice(0, 2), 16) / 255;
  const g = parseInt(h.slice(2, 4), 16) / 255;
  const b = parseInt(h.slice(4, 6), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return { h: 0, s: 0, l: l * 100 };
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let hue = 0;
  switch (max) {
    case r:
      hue = ((g - b) / d + (g < b ? 6 : 0)) * 60;
      break;
    case g:
      hue = ((b - r) / d + 2) * 60;
      break;
    default:
      hue = ((r - g) / d + 4) * 60;
  }
  return { h: hue, s: s * 100, l: l * 100 };
}

export type SupplyKey =
  | "d20"
  | "d6"
  | "sleeves"
  | "deckBoxes"
  | "cardStorage"
  | "coins"
  | "whiteboardTokens"
  | "playmats"
  | "carryingCases"
  | "plusOneCounters"
  | "diceBoxes"
  | "comboSets";

export const SUPPLY_LABELS: Record<Exclude<SupplyKey, "comboSets">, string> = {
  d20: "D20 dice",
  d6: "D6 dice",
  sleeves: "Sleeves",
  deckBoxes: "Deck boxes",
  cardStorage: "Card storage boxes",
  coins: "Coins / tokens",
  whiteboardTokens: "Whiteboard tokens",
  playmats: "Playmats",
  carryingCases: "Card carrying cases",
  plusOneCounters: "+1/+1 counters",
  diceBoxes: "Dice boxes",
};

export type SupplyOptions = {
  items: SupplyKey[];
  premium: boolean;
  spindown: boolean;
  deckBoxType: "any" | "magnetic" | "plastic";
  playmatType: "any" | "art" | "basic";
  allowCombo: boolean;
};

export type SupplyResult = {
  label: string;
  title: string;
  query: string;
  url: string;
};

/** Build Amazon search queries from preferences — no stored product IDs. */
export function buildSupplyQueries(options: SupplyOptions): SupplyResult[] {
  const results: SupplyResult[] = [];

  if (options.allowCombo) {
    const query = options.premium
      ? 'Ultimate Guard "deck box" dice sleeves Magic Commander kit'
      : "trading card game accessory kit sleeves dice deck box";
    results.push({
      label: "Combo / bulk sets",
      title: options.premium ? "Premium accessory combo search" : "Budget accessory kit search",
      query,
      url: amazonSearchUrl(query, { category: "toys-and-games" }),
    });
  }

  for (const key of options.items) {
    if (key === "comboSets") continue;
    const built = supplyQueryFor(key, options);
    if (built) results.push(built);
  }

  return results;
}

function supplyQueryFor(key: Exclude<SupplyKey, "comboSets">, options: SupplyOptions): SupplyResult {
  const premium = options.premium;
  let query = "";
  let title = "";

  switch (key) {
    case "d20":
      if (options.spindown) {
        query = premium
          ? 'Ultra Pro "Magic" spindown life counter D20'
          : "spindown D20 life counter Magic The Gathering";
        title = premium ? "Premium MTG spindown D20" : "Budget spindown D20";
      } else {
        query = premium ? "Gamegenic D20 dice set" : "opaque D20 dice polyhedral";
        title = premium ? "Premium D20 dice" : "Budget D20 dice";
      }
      break;
    case "d6":
      query = premium ? "Gamegenic dice D6 opaque set" : "Chessex opaque dice block D6";
      title = premium ? "Premium D6 dice" : "Budget D6 dice";
      break;
    case "sleeves":
      query = premium
        ? 'Dragon Shield Matte sleeves 100 "standard size"'
        : 'Ultra Pro deck protectors 100 standard size Magic';
      title = premium ? "Dragon Shield Matte sleeves" : "Budget standard sleeves";
      break;
    case "deckBoxes":
      if (options.deckBoxType === "magnetic") {
        query = premium
          ? "magnetic flip deck box 100 sleeved Commander"
          : "cheap magnetic deck box 100 cards";
        title = "Magnetic deck box";
      } else if (options.deckBoxType === "plastic") {
        query = premium
          ? 'Ultimate Guard Boulder 100+ deck case'
          : "plastic deck box 100 sleeved cards";
        title = "Plastic deck box";
      } else {
        query = premium
          ? 'Ultimate Guard Boulder 100+ soft-touch'
          : "deck box 100 sleeved Magic Commander";
        title = premium ? "Premium deck box" : "Budget deck box";
      }
      break;
    case "cardStorage":
      query = premium
        ? "BCW card storage box 3200 count"
        : "trading card storage box 800 1600";
      title = "Card storage box";
      break;
    case "coins":
      query = premium
        ? "metal coin tokens Magic The Gathering"
        : "metal board game coin tokens";
      title = "Coins / tokens";
      break;
    case "whiteboardTokens":
      query = premium
        ? "dry erase tokens round Magic counters"
        : "blank dry erase tokens circular";
      title = "Whiteboard tokens";
      break;
    case "playmats":
      if (options.playmatType === "art") {
        query = premium
          ? 'Ultra Pro "Magic The Gathering" playmat art'
          : "gaming playmat art XL budget";
        title = "Art playmat";
      } else if (options.playmatType === "basic") {
        query = premium
          ? "solid color gaming playmat stitched edge"
          : "solid color XL mouse pad gaming";
        title = "Basic color playmat";
      } else {
        query = premium
          ? 'Ultra Pro "Magic The Gathering" playmat'
          : "gaming playmat XL Magic";
        title = "Playmat";
      }
      break;
    case "carryingCases":
      query = premium
        ? 'Ultimate Guard Superhive OR Arkhive deck case'
        : "trading card carrying case binder bag";
      title = "Card carrying case";
      break;
    case "plusOneCounters":
      query = premium
        ? 'Gamegenic "+1/+1" counters Magic'
        : "+1/+1 counters plastic tokens MTG";
      title = "+1/+1 counters";
      break;
    case "diceBoxes":
      query = premium
        ? "Gamegenic dice bag tray storage"
        : "small dice storage box foam";
      title = "Dice box";
      break;
  }

  return {
    label: SUPPLY_LABELS[key],
    title,
    query,
    url: amazonSearchUrl(query, { category: "toys-and-games" }),
  };
}

export function sleeveQueryFor(
  hex: string,
  premium: boolean,
  art: "any" | "art" | "basic",
): { hue: HueName; colorName: string; title: string; query: string; url: string } {
  const hue = hexToHueName(hex);
  const colorName = HUE_SLEEVE_COLOR[hue];

  let query: string;
  let title: string;

  if (art === "art") {
    if (premium) {
      query = `Dragon Shield Art Sleeves ${colorName} standard size 100`;
      title = `Dragon Shield Art — ${colorName}`;
    } else {
      query = `${colorName} art card sleeves 100 standard size -uno -pokemon Japanese`;
      title = `Budget art sleeves — ${colorName}`;
    }
  } else if (art === "basic" || art === "any") {
    if (premium) {
      // Exact Matte color name in quotes so Amazon surfaces that color variant first
      query = `Dragon Shield Matte "${colorName}" 100 standard size sleeves`;
      title = `Dragon Shield Matte — ${colorName}`;
    } else {
      query = `"${colorName}" card sleeves 100 standard size matte -uno`;
      title = `Budget sleeves — ${colorName}`;
    }
  } else {
    query = `Dragon Shield Matte "${colorName}" 100`;
    title = `Sleeves — ${colorName}`;
  }

  // Art preference "any" with premium still uses solid Matte color; budget uses generic colored sleeves
  if (art === "any" && premium) {
    query = `Dragon Shield Matte "${colorName}" 100 standard size sleeves`;
    title = `Dragon Shield Matte — ${colorName}`;
  } else if (art === "any" && !premium) {
    query = `"${colorName}" standard size card sleeves 100 -uno`;
    title = `Budget sleeves — ${colorName}`;
  }

  return {
    hue,
    colorName,
    title,
    query,
    url: amazonSearchUrl(query, { category: "toys-and-games" }),
  };
}

export function proxySupplyLinks(tier: "budget" | "premium"): { name: string; query: string; url: string }[] {
  if (tier === "budget") {
    return [
      {
        name: "Letter-size cardstock (65–110 lb)",
        query: "Hammermill cardstock letter 110 lb white",
      },
      {
        name: "Matte photo / inkjet paper",
        query: "matte photo paper letter inkjet",
      },
      {
        name: "Paper cutter / craft knife",
        query: "Fiskars paper trimmer 12 inch",
      },
      {
        name: "Budget sleeves for proxies",
        query: "Ultra Pro clear deck protectors 100 standard",
      },
    ].map((item) => ({ ...item, url: amazonSearchUrl(item.query) }));
  }

  return [
    {
      name: "Premium laser-safe cardstock",
      query: "premium cover stock cardstock 100 lb letter",
    },
    {
      name: "Precision paper cutter",
      query: "guillotine paper cutter precision 12 inch",
    },
    {
      name: "Dragon Shield Clear sleeves",
      query: 'Dragon Shield Matte Clear 100 standard size',
    },
    {
      name: "Dragon Shield Perfect Fit inners",
      query: "Dragon Shield Perfect Fit side loading clear",
    },
  ].map((item) => ({ ...item, url: amazonSearchUrl(item.query) }));
}

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
  /** Rough street range suitable for $40–60 shopping */
  budgetFriendly: boolean;
  /** Precise Amazon search phrase for this sealed product */
  searchName: string;
};

/**
 * Curated precon knowledge for playstyle matching only.
 * Purchase URLs are always generated live via Amazon search (no ASINs).
 */
const BEGINNER_PRECONS: BeginnerPrecon[] = [
  {
    name: "Party Time",
    commander: "Nalia de'Arnise",
    description: "Assemble a party of creatures and attack together. Fast, social, and easy to pilot.",
    styles: ["aggro", "tokens", "lifegain"],
    budgetFriendly: true,
    searchName: 'Magic The Gathering "Party Time" Commander Deck',
  },
  {
    name: "Exit from Exile",
    commander: "Faldorn, Dread Wolf Herald",
    description: "Ramp, exile, then smash with giant threats and wolves. Big and satisfying.",
    styles: ["bigCreatures", "aggro"],
    budgetFriendly: true,
    searchName: 'Magic The Gathering "Exit from Exile" Commander Deck',
  },
  {
    name: "Mind Flayarrrs",
    commander: "Captain N'ghathrod",
    description: "Mill opponents and steal their best creatures. Teaches timing and answers.",
    styles: ["control", "spellslinger"],
    budgetFriendly: true,
    searchName: 'Magic The Gathering "Mind Flayarrrs" Commander Deck',
  },
  {
    name: "Virtue and Valor",
    commander: "Ellivere of the Wild Court",
    description: "Grow a board of enchanted creatures and tokens. Fun boards without complex rules.",
    styles: ["tokens", "lifegain", "spellslinger"],
    budgetFriendly: true,
    searchName: 'Magic The Gathering "Virtue and Valor" Commander Deck',
  },
  {
    name: "Draconic Dissent",
    commander: "Firkraag, Cunning Instigator",
    description: "Dragons and goads — play huge flyers and push others into fighting.",
    styles: ["bigCreatures", "aggro"],
    budgetFriendly: true,
    searchName: 'Magic The Gathering "Draconic Dissent" Commander Deck',
  },
  {
    name: "Fae Dominion",
    commander: "Tegwyll, Duke of Splendor",
    description: "Faerie tricks and reactive spells. Great if you like clever plays.",
    styles: ["control", "spellslinger"],
    budgetFriendly: true,
    searchName: 'Magic The Gathering "Fae Dominion" Commander Deck',
  },
  {
    name: "Pirates of the Blue Flag (Starter Commander)",
    commander: "Admiral Brass, Unsinkable",
    description: "Pirate tribal aggression — attack, plunder, and keep the pressure on.",
    styles: ["aggro"],
    budgetFriendly: true,
    searchName: 'Magic "Starter Commander" Deck pirates OR "Admiral Brass"',
  },
  {
    name: "Grave Danger (Starter Commander)",
    commander: "Grave Danger precon",
    description: "Zombies and graveyard value — resilient and beginner-friendly.",
    styles: ["control", "tokens"],
    budgetFriendly: true,
    searchName: 'Magic "Starter Commander Deck" "Grave Danger"',
  },
];

export function pickBeginnerPrecon(
  style: PlaystyleId,
  opts?: { preferBudget?: boolean; avoidName?: string },
): BeginnerPrecon {
  const preferBudget = opts?.preferBudget ?? true;
  let pool = BEGINNER_PRECONS.filter((p) => p.styles.includes(style));
  if (preferBudget) {
    const budget = pool.filter((p) => p.budgetFriendly);
    if (budget.length) pool = budget;
  }
  if (opts?.avoidName) {
    const filtered = pool.filter((p) => p.name !== opts.avoidName);
    if (filtered.length) pool = filtered;
  }
  if (!pool.length) pool = BEGINNER_PRECONS;
  return pool[Math.floor(Math.random() * pool.length)];
}

export function beginnerPreconUrl(precon: BeginnerPrecon, preferBudget: boolean): string {
  return amazonSearchUrl(precon.searchName, {
    category: "toys-and-games",
    ...(preferBudget ? { minPrice: 40, maxPrice: 60 } : {}),
  });
}

export function beginnerSupplyLinks(): { name: string; url: string }[] {
  return [
    {
      name: "Deck box — Ultimate Guard Boulder 100+",
      url: amazonSearchUrl('Ultimate Guard Boulder 100+ deck case', { category: "toys-and-games" }),
    },
    {
      name: "D6 dice — Chessex Opaque Dice Block",
      url: amazonSearchUrl("Chessex opaque dice block", { category: "toys-and-games" }),
    },
    {
      name: "Spindown D20 — Ultra Pro Magic Life Counter",
      url: amazonSearchUrl('Ultra Pro Magic spindown life counter', { category: "toys-and-games" }),
    },
    {
      name: "Sleeves — Dragon Shield Matte Black",
      url: amazonSearchUrl('Dragon Shield Matte Black 100 standard size', { category: "toys-and-games" }),
    },
  ];
}
