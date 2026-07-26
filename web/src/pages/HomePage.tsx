import { Link } from "react-router";
import { Seo } from "../components/Seo";
import { SITE_ORIGIN } from "../lib/site";

const TOOLS = [
  {
    to: "/commander",
    title: "Random commander",
    blurb: "Flip through commanders, then build an average EDHREC deck.",
  },
  {
    to: "/pod",
    title: "Pod generator",
    blurb: "Balanced multiplayer commander pods that play well together.",
  },
  {
    to: "/pimp",
    title: "Deck pimping",
    blurb: "Upgrade a Moxfield list to flashier printings.",
  },
  {
    to: "/budget",
    title: "Deck cost cutter",
    blurb: "Cut a commander list down to a max Scryfall price with EDHREC swaps.",
  },
  {
    to: "/convert",
    title: "Format converter",
    blurb: "Convert between Moxfield, Archidekt, HXDEC, and plain text with loss warnings.",
  },
  {
    to: "/pool-decks",
    title: "Pool to decks",
    blurb: "Split a shared card pool into multiple Commander decks.",
  },
  {
    to: "/booster",
    title: "Booster generator",
    blurb: "Craft custom draft packs with rarity queries.",
  },
  {
    to: "/pack-wars",
    title: "Pack Wars generator",
    blurb: "Mini-Master decks: one booster, fifteen basics, play immediately.",
  },
  {
    to: "/proxy",
    title: "Proxy tools",
    blurb: "Search, layout, and print playtest proxies with clear labeling.",
  },
  {
    to: "/bulk",
    title: "Bulk purchasing",
    blurb: "Price a list across vendors and optimize shipping splits.",
  },
  {
    to: "/supplies",
    title: "MTG supplies",
    blurb: "Build an Amazon supplies cart for dice, sleeves, mats, and more.",
  },
  {
    to: "/sleeves",
    title: "Sleeve color matcher",
    blurb: "Pick a color, get close-matching sleeve shopping links.",
  },
  {
    to: "/dice",
    title: "Dice color matcher",
    blurb: "Match Chessex, spindown D20s, and D6 blocks to a color you pick.",
  },
  {
    to: "/beginner",
    title: "Beginner starter",
    blurb: "A linear path from learning the rules to your first game.",
  },
];

export function HomePage() {
  return (
    <>
      <Seo
        title="MagicGen | MTG tools and generators"
        description="Handy Magic: The Gathering tools for anybody playing: random commanders, pods, deck pimping, proxies, boosters, supplies, and more."
        path="/"
        jsonLd={[
          {
            "@context": "https://schema.org",
            "@type": "WebSite",
            name: "MagicGen",
            url: `${SITE_ORIGIN}/`,
            description:
              "A suite of Magic: The Gathering tools and generators by Mia Gobble.",
          },
          {
            "@context": "https://schema.org",
            "@type": "SoftwareApplication",
            name: "MagicGen",
            applicationCategory: "GameApplication",
            operatingSystem: "Web",
            url: `${SITE_ORIGIN}/`,
            offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
          },
        ]}
      />
      <section className="home-hero" aria-label="MagicGen hero">
        <div className="home-hero__bg" aria-hidden />
        <div className="container home-hero__content">
          <h1 className="home-hero__brand">MagicGen</h1>
          <p className="home-hero__headline">Handy tools for anybody playing MTG</p>
          <p className="home-hero__support">
            Generators, proxies, supplies, and more to get you playing Magic The Gathering the way
            you want.
          </p>
          <div className="home-hero__cta">
            <Link className="btn btn-brass" to="/commander">
              Start with a commander
            </Link>
            <Link className="btn btn-secondary home-hero__ghost" to="/beginner">
              New to Magic?
            </Link>
          </div>
        </div>
      </section>

      <section className="home-section">
        <div className="container">
          <h2>The workshop</h2>
          <p className="lede">
            One destination for the tools you reach for between games, from random commanders to
            sleeve shopping.
          </p>
          <div className="tool-links">
            {TOOLS.map((tool, i) => (
              <Link
                key={tool.to}
                to={tool.to}
                className="tool-link"
                style={{ animationDelay: `${i * 40}ms` }}
              >
                <span className="tool-link__index">{String(i + 1).padStart(2, "0")}</span>
                <span>
                  <h3>{tool.title}</h3>
                  <p>{tool.blurb}</p>
                </span>
                <span aria-hidden className="muted">
                  →
                </span>
              </Link>
            ))}
          </div>

          <div className="support-band">
            <div className="support-band__copy">
              <h2>Support MagicGen on Ko-fi</h2>
              <p>
                MagicGen is free and local-friendly. Tips on Ko-fi help support new tools.
                Tip directly below without leaving the site.
              </p>
              <a
                className="btn btn-secondary home-hero__ghost"
                href="https://ko-fi.com/igottic"
                target="_blank"
                rel="noopener noreferrer"
              >
                Open Ko-fi page
              </a>
            </div>
            <div className="kofi-embed">
              <iframe
                id="kofiframe"
                src="https://ko-fi.com/igottic/?hidefeed=true&widget=true&embed=true"
                title="Support MagicGen on Ko-fi"
                loading="lazy"
                allow="payment"
              />
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
