/**
 * Import and exercise the real searchPrintingsForPimp pipeline.
 * Uses dynamic import of compiled-ish TS via tsx.
 */
import {
  searchPrintingsForPimp,
  normalizeCardNameForSearch,
  namedExact,
  scryfallFetch,
} from "./src/lib/scryfall.ts";
import { parseMoxfieldList } from "./src/lib/moxfield.ts";
import { pimpDeckList } from "./src/lib/pimp.ts";

const sampleList = `1 Sol Ring
1 Forest
1 Command Tower
1 Arcane Signet
1 Counterspell
1 Lightning Bolt
1 Swords to Plowshares
1 Cultivate
1 Rhystic Study
1 Cyclonic Rift`;

console.log("=== parseMoxfieldList ===");
const parsed = parseMoxfieldList(sampleList);
console.log(parsed.map((l) => JSON.stringify(l)));

console.log("\n=== searchPrintingsForPimp per card ===");
for (const line of parsed) {
  const t0 = Date.now();
  const prints = await searchPrintingsForPimp(line.name);
  console.log(
    line.name,
    "→",
    prints.length,
    "printings in",
    Date.now() - t0,
    "ms",
    prints[0] ? `(first ${prints[0].set} #${prints[0].collector_number})` : "",
  );
}

console.log("\n=== pimpDeckList (full) ===");
const result = await pimpDeckList(sampleList, (done, total) => {
  process.stdout.write(`\rprogress ${done}/${total}`);
});
console.log("\nnotes:");
for (const n of result.notes) console.log(" -", n);
const empty = result.notes.filter((n) => /no printings|lookup failed|rate limit/i.test(n));
console.log("\nfailure notes:", empty.length, "/", result.notes.length);
console.log("cards resolved:", result.cards.length);

// Stress: simulate a slightly messy list
console.log("\n=== messy names ===");
const messy = [
  "Sol Ring (c21) 252",
  "Sol Ring *F*",
  "1 Sol Ring (c21) 252 *F* #Ramp",
  "Wear // Tear",
  "Fire // Ice",
  "Birgi, God of Storytelling // Harnfel, Horn of Bounty",
];
for (const raw of messy) {
  const lines = parseMoxfieldList(/^\d/.test(raw) ? raw : `1 ${raw}`);
  const name = lines[0]?.name ?? raw;
  const norm = normalizeCardNameForSearch(name);
  const prints = await searchPrintingsForPimp(name);
  console.log({ raw, name, norm, count: prints.length });
}
