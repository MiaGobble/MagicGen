const BASE = "https://api.scryfall.com";

async function probe(label, init) {
  try {
    const res = await fetch(`${BASE}/cards/named?exact=Sol%20Ring`, init);
    console.log(label, "status", res.status, "type", res.type, "ok", res.ok);
    if (res.ok) {
      const j = await res.json();
      console.log(label, "name", j.name, "prints?", !!j.prints_search_uri);
    } else {
      console.log(label, "body", (await res.text()).slice(0, 200));
    }
  } catch (e) {
    console.log(label, "ERROR", e.message);
  }
}

// Mimic browser-ish headers
await probe("minimal", { headers: { Accept: "application/json" } });
await probe("with-ua", {
  headers: {
    Accept: "application/json",
    "User-Agent": "MagicGen/1.0 (https://github.com/MagicGen)",
  },
});
await probe("with-origin", {
  headers: {
    Accept: "application/json",
    Origin: "http://localhost:5173",
  },
});
await probe("no-headers", {});

// Check CORS response headers
const res = await fetch(`${BASE}/cards/named?exact=Sol%20Ring`, {
  headers: { Accept: "application/json", Origin: "http://localhost:5173" },
});
console.log("\nCORS headers:");
for (const [k, v] of res.headers.entries()) {
  if (/access-control|vary|content-type/i.test(k)) console.log(" ", k, v);
}
