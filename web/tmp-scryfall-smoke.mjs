const BASE = "https://api.scryfall.com";
const UA = {
  Accept: "application/json",
  "User-Agent": "MagicGen/1.0 (https://github.com/MagicGen)",
};

async function fetchJson(url) {
  const res = await fetch(url, { headers: UA });
  const text = await res.text();
  console.log("STATUS", res.status, url.slice(0, 140));
  if (!res.ok) {
    console.log("BODY", text.slice(0, 400));
    return null;
  }
  return JSON.parse(text);
}

async function collectPages(startUrl, max = 200) {
  const all = [];
  let url = startUrl;
  while (url && all.length < max) {
    const full = url.startsWith("http") ? url : BASE + url;
    const page = await fetchJson(full);
    if (!page) break;
    all.push(...(page.data || []));
    console.log(
      "  page got",
      page.data?.length,
      "total",
      all.length,
      "has_more",
      page.has_more,
      "next_page starts",
      page.next_page?.slice(0, 80),
    );
    url = page.has_more && page.next_page ? page.next_page : undefined;
    await new Promise((r) => setTimeout(r, 150));
  }
  return all;
}

function isPaperPrinting(card) {
  if (card.digital) return false;
  if (
    card.layout === "art_series" ||
    card.layout === "token" ||
    card.layout === "double_faced_token"
  ) {
    return false;
  }
  if (card.games && card.games.length > 0 && !card.games.includes("paper")) return false;
  return true;
}

const names = [
  "Sol Ring",
  "Forest",
  "Command Tower",
  "Arcane Signet",
  "Counterspell",
  "Lightning Bolt",
  "Swords to Plowshares",
  "Cultivate",
  "Rhystic Study",
  "Cyclonic Rift",
];

for (const name of names) {
  console.log("\n====", name, "====");
  const card = await fetchJson(`${BASE}/cards/named?exact=${encodeURIComponent(name)}`);
  if (!card) {
    console.log("NAMED FAILED");
    continue;
  }
  console.log(
    "named ok:",
    card.name,
    "set",
    card.set,
    "prints_uri:",
    card.prints_search_uri?.slice(0, 120),
  );
  console.log("digital?", card.digital, "layout", card.layout, "games", card.games);
  await new Promise((r) => setTimeout(r, 150));
  const prints = await collectPages(card.prints_search_uri, 80);
  console.log("printings fetched:", prints.length);
  const paper = prints.filter(isPaperPrinting);
  console.log("after paper filter:", paper.length);
  if (!paper.length && prints.length) {
    console.log("SAMPLE filtered-out:", JSON.stringify(prints[0], null, 0).slice(0, 300));
  }
  await new Promise((r) => setTimeout(r, 150));
}

console.log("\nDONE");
