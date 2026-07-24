# MagicGen

Local-first Magic: The Gathering tools site (random commanders, pods, proxies, supplies, and more).

Intended production host: `mtggen.igottic.com` — this repo is set up for **local development only**.

## Stack

- Vite + React 19 + TypeScript
- React Router
- Scryfall API (card data/images)
- EDHREC public JSON pages (average decks)
- Configurable Amazon affiliate queries in `src/data/amazon.json`

## Run locally (Windows / macOS / Linux)

```bash
cd web
npm install
npm run dev
```

Then open the URL Vite prints (usually `http://localhost:5173`).

### Other scripts

```bash
npm run build    # production build to web/dist
npm run preview  # serve the production build locally
```

## Tools

| Route | Planning doc | Description |
|-------|--------------|-------------|
| `/` | `main.md` | Landing + tool index |
| `/commander` | `randomcommander.md` | Random commander + EDHREC average deck |
| `/pod` | `podgenerator.md` | Balanced commander pods |
| `/pimp` | `deckpimping.md` | Upgrade printings on a Moxfield list |
| `/booster` | `boostergen.md` | Custom rarity-query booster packs |
| `/proxy` | `proxytools.md` | Search/import/print playtest proxies |
| `/bulk` | `bulkpurchase.md` | Multi-vendor pricing + optimized split |
| `/supplies` | `mtgsupplies.md` | Amazon supplies list generator |
| `/sleeves` | `sleevecolor.md` | Sleeve color → Amazon matcher |
| `/beginner` | `beginnerstarter.md` | Learn → Find → Get → Play flow |

## Configuring shop links

Edit `web/src/data/amazon.json` — affiliate tag, supply queries, sleeve hue queries, proxy supplies, and beginner precon searches. All Amazon URLs are built with tag `igottic-20` by default.

## Notes

- Card images/text come from [Scryfall](https://scryfall.com/); a disclosure is shown in the footer.
- EDH power-level metrics are omitted (no public API on edhpowerlevel.com).
- Do not commit secrets; none are required for local use.
