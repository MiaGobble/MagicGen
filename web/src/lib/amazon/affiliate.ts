/** Affiliate Amazon URL helpers. */
export const AFFILIATE_TAG = "igottic-20";

export function amazonProductUrl(asin: string): string {
  const clean = asin.replace(/[^A-Z0-9]/gi, "").slice(0, 10);
  if (clean.length !== 10) {
    return amazonSearchUrl("card sleeves matte");
  }
  const params = new URLSearchParams({ tag: AFFILIATE_TAG, th: "1", psc: "1" });
  return `https://www.amazon.com/dp/${clean}?${params.toString()}`;
}

export function amazonSearchUrl(query: string): string {
  const params = new URLSearchParams({ k: query, tag: AFFILIATE_TAG });
  return `https://www.amazon.com/s?${params.toString()}`;
}
