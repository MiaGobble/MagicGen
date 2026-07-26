/** App settings persisted in localStorage. */

export type DeckListFormat = "hxdec" | "moxfield" | "plain" | "archidekt";

export type HomePageId =
  | "/"
  | "/commander"
  | "/pod"
  | "/pimp"
  | "/budget"
  | "/convert"
  | "/pool-decks"
  | "/booster"
  | "/pack-wars"
  | "/proxy"
  | "/bulk"
  | "/supplies"
  | "/sleeves"
  | "/dice"
  | "/beginner";

export type AppSettings = {
  /** Default list format for export / copy / generated decks. */
  deckFormat: DeckListFormat;
  /** Show toast notifications. */
  toastsEnabled: boolean;
  /** Show Ko-fi support nudges after successful tool use. */
  kofiEnabled: boolean;
  /** Landing route when visiting the site root (or `/`). */
  defaultHome: HomePageId;
};

export const DECK_FORMAT_META: Record<
  DeckListFormat,
  { label: string; short: string; blurb: string }
> = {
  moxfield: {
    label: "Moxfield",
    short: "Moxfield",
    blurb: "Section headers (Commander / Deck) with optional (set) collector number. Default.",
  },
  plain: {
    label: "Plain text",
    short: "Plain",
    blurb: "Simple qty + card name lines only.",
  },
  archidekt: {
    label: "Archidekt",
    short: "Archidekt",
    blurb: "//Category comments and 1x Name (set) cn lines.",
  },
  hxdec: {
    label: "HXDEC",
    short: "HXDEC",
    blurb:
      "Hex compact format from EDH Power Level (set index + collector hex). Needs set/CN on cards.",
  },
};

export const HOME_PAGE_OPTIONS: { id: HomePageId; label: string }[] = [
  { id: "/", label: "Home (tool gallery)" },
  { id: "/commander", label: "Random commander" },
  { id: "/pod", label: "Pod generator" },
  { id: "/pimp", label: "Deck pimping" },
  { id: "/budget", label: "Deck cost cutter" },
  { id: "/convert", label: "Format converter" },
  { id: "/pool-decks", label: "Pool to decks" },
  { id: "/booster", label: "Booster generator" },
  { id: "/pack-wars", label: "Pack Wars generator" },
  { id: "/proxy", label: "Proxy tools" },
  { id: "/bulk", label: "Bulk purchasing" },
  { id: "/supplies", label: "MTG supplies" },
  { id: "/sleeves", label: "Sleeve color matcher" },
  { id: "/dice", label: "Dice color matcher" },
  { id: "/beginner", label: "Beginner starter" },
];

export const DEFAULT_SETTINGS: AppSettings = {
  deckFormat: "moxfield",
  toastsEnabled: true,
  kofiEnabled: true,
  defaultHome: "/",
};

const STORAGE_KEY = "magicgen-settings-v1";

export function loadSettings(): AppSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_SETTINGS };
    const parsed = JSON.parse(raw) as Partial<AppSettings>;
    return {
      deckFormat: isDeckFormat(parsed.deckFormat) ? parsed.deckFormat : DEFAULT_SETTINGS.deckFormat,
      toastsEnabled:
        typeof parsed.toastsEnabled === "boolean"
          ? parsed.toastsEnabled
          : DEFAULT_SETTINGS.toastsEnabled,
      kofiEnabled:
        typeof parsed.kofiEnabled === "boolean" ? parsed.kofiEnabled : DEFAULT_SETTINGS.kofiEnabled,
      defaultHome: isHomePage(parsed.defaultHome)
        ? parsed.defaultHome
        : DEFAULT_SETTINGS.defaultHome,
    };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function saveSettings(settings: AppSettings): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // ignore quota / private mode
  }
}

function isDeckFormat(v: unknown): v is DeckListFormat {
  return v === "hxdec" || v === "moxfield" || v === "plain" || v === "archidekt";
}

function isHomePage(v: unknown): v is HomePageId {
  return HOME_PAGE_OPTIONS.some((o) => o.id === v);
}
