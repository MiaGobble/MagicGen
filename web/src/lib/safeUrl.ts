/**
 * Shared URL / fetch allowlists for client-side network safety.
 */

const AMAZON_HOSTS = new Set(["www.amazon.com", "amazon.com", "smile.amazon.com"]);
const SCRYFALL_HOSTS = new Set([
  "api.scryfall.com",
  "cards.scryfall.io",
  "c1.scryfall.com",
  "c2.scryfall.com",
  "c3.scryfall.com",
  "c4.scryfall.com",
  "img.scryfall.com",
]);
const EDHREC_HOSTS = new Set(["json.edhrec.com", "edhrec.com", "www.edhrec.com"]);

function parseHttpsUrl(raw: string): URL | null {
  try {
    const u = new URL(raw);
    if (u.protocol !== "https:") return null;
    // Block credentials in URL
    if (u.username || u.password) return null;
    return u;
  } catch {
    return null;
  }
}

export function isAllowedAmazonUrl(raw: string): boolean {
  const u = parseHttpsUrl(raw);
  return Boolean(u && AMAZON_HOSTS.has(u.hostname));
}

export function isAllowedScryfallUrl(raw: string): boolean {
  const u = parseHttpsUrl(raw);
  if (!u) return false;
  if (u.hostname === "api.scryfall.com") return true;
  return SCRYFALL_HOSTS.has(u.hostname);
}

export function isAllowedEdhrecUrl(raw: string): boolean {
  const u = parseHttpsUrl(raw);
  return Boolean(u && EDHREC_HOSTS.has(u.hostname));
}

/** Only allow http(s) links we generate for shopping / docs — never javascript: or data:. */
export function isSafeExternalHref(raw: string): boolean {
  const u = parseHttpsUrl(raw);
  if (!u) return false;
  const host = u.hostname;
  return (
    AMAZON_HOSTS.has(host) ||
    host === "edhrec.com" ||
    host === "www.edhrec.com" ||
    host === "ko-fi.com" ||
    host.endsWith(".ko-fi.com") ||
    host === "scryfall.com" ||
    host === "www.scryfall.com" ||
    host === "magic.wizards.com" ||
    host === "draftsim.com" ||
    host === "www.draftsim.com" ||
    host === "tcgplayer.com" ||
    host === "www.tcgplayer.com" ||
    host === "cardkingdom.com" ||
    host === "www.cardkingdom.com" ||
    host === "manapool.com" ||
    host === "www.manapool.com" ||
    host === "cardsphere.com" ||
    host === "www.cardsphere.com" ||
    host === "edhpowerlevel.com" ||
    host === "www.edhpowerlevel.com" ||
    host === "locator.wizards.com" ||
    host === "discord.gg" ||
    host === "igottic.com" ||
    host.endsWith(".igottic.com") ||
    host === "github.com" ||
    host === "x.com" ||
    host === "twitter.com" ||
    host === "steamcommunity.com"
  );
}

export function assertAllowedFetchUrl(raw: string, kind: "scryfall" | "edhrec" | "amazon"): string {
  const ok =
    kind === "scryfall"
      ? isAllowedScryfallUrl(raw) || (raw.startsWith("/") && !raw.startsWith("//"))
      : kind === "edhrec"
        ? isAllowedEdhrecUrl(raw)
        : isAllowedAmazonUrl(raw);
  if (!ok) throw new Error(`Blocked disallowed ${kind} URL`);
  return raw;
}
