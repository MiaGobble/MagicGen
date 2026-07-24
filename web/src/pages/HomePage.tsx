import { Link } from "react-router-dom";

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
    to: "/booster",
    title: "Booster generator",
    blurb: "Craft custom draft packs with rarity queries.",
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
    to: "/beginner",
    title: "Beginner starter",
    blurb: "A linear path from learning the rules to your first game.",
  },
];

export function HomePage() {
  return (
    <>
      <section className="home-hero" aria-label="MagicGen hero">
        <div className="home-hero__bg" aria-hidden />
        <div className="container home-hero__content">
          <h1 className="home-hero__brand">MagicGen</h1>
          <p className="home-hero__headline">Tools for every corner of the table.</p>
          <p className="home-hero__support">
            Generators, proxies, supplies, and starter guidance — powered by Scryfall, built for
            local playtesting and real-world shopping.
          </p>
          <div className="home-hero__cta">
            <Link className="btn btn-brass" to="/commander">
              Start with a commander
            </Link>
            <Link className="btn btn-secondary" to="/beginner" style={{ borderColor: "rgba(247,243,234,0.35)", color: "#f7f3ea" }}>
              New to Magic?
            </Link>
          </div>
        </div>
      </section>

      <section className="home-section">
        <div className="container">
          <h2>The workshop</h2>
          <p className="lede">
            One destination for the tools you reach for between games — from random commanders to
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
            <div>
              <h2>Keep the generators humming</h2>
              <p>MagicGen is free and local-friendly. Tips on Ko-fi help fund new tools.</p>
            </div>
            <a className="btn btn-brass" href="https://ko-fi.com/igottic" target="_blank" rel="noreferrer">
              Support on Ko-fi
            </a>
          </div>
        </div>
      </section>
    </>
  );
}
