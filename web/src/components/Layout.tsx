import { NavLink, Outlet } from "react-router-dom";
import { useState } from "react";
import { ToastProvider } from "./Toast";

const LINKS = [
  { to: "/commander", label: "Commander" },
  { to: "/pod", label: "Pod" },
  { to: "/pimp", label: "Deck Pimp" },
  { to: "/booster", label: "Boosters" },
  { to: "/proxy", label: "Proxies" },
  { to: "/bulk", label: "Bulk Buy" },
  { to: "/supplies", label: "Supplies" },
  { to: "/sleeves", label: "Sleeves" },
  { to: "/beginner", label: "Beginner" },
];

export function Layout() {
  const [open, setOpen] = useState(false);

  return (
    <ToastProvider>
      <header className="site-header">
        <div className="container site-header__inner">
          <NavLink to="/" className="brand" onClick={() => setOpen(false)}>
            <img className="brand__logo" src="/logo.png" alt="" width={40} height={40} />
            MagicGen
          </NavLink>
          <button
            type="button"
            className="nav-toggle"
            aria-expanded={open}
            aria-label="Toggle navigation"
            onClick={() => setOpen((v) => !v)}
          >
            Menu
          </button>
          <nav className={`site-nav${open ? " open" : ""}`} aria-label="Primary">
            {LINKS.map((l) => (
              <NavLink
                key={l.to}
                to={l.to}
                className={({ isActive }) => (isActive ? "active" : undefined)}
                onClick={() => setOpen(false)}
              >
                {l.label}
              </NavLink>
            ))}
            <a
              className="nav-kofi"
              href="https://ko-fi.com/igottic"
              target="_blank"
              rel="noreferrer"
              onClick={() => setOpen(false)}
            >
              Support on Ko-fi
            </a>
          </nav>
        </div>
      </header>

      <main className="site-main">
        <Outlet />
      </main>

      <footer className="site-footer">
        <div className="container">
          <div className="site-footer__grid">
            <div>
              <h3 className="brand-wordmark">MagicGen</h3>
              <p className="muted">
                A workshop of Magic: The Gathering tools and generators by Mia Gobble.
              </p>
              <p className="disclosure">
                Card images and text are provided by{" "}
                <a href="https://scryfall.com/" target="_blank" rel="noreferrer">
                  Scryfall
                </a>
                . Magic: The Gathering is a trademark of Wizards of the Coast. This site is
                unofficial Fan Content permitted under the Fan Content Policy (not affiliated
                with Wizards).
              </p>
            </div>
            <div>
              <h3>Support</h3>
              <p className="muted" style={{ marginTop: 0 }}>
                Enjoying the tools? A tip keeps MagicGen growing.
              </p>
              <ul>
                <li>
                  <a href="https://ko-fi.com/igottic" target="_blank" rel="noreferrer">
                    Support on Ko-fi
                  </a>
                </li>
                <li>
                  <a href="https://scds.igottic.com/" target="_blank" rel="noreferrer">
                    SCDS / FIE rating
                  </a>
                </li>
              </ul>
            </div>
            <div>
              <h3>Links</h3>
              <ul>
                <li>
                  <a href="https://igottic.com/" target="_blank" rel="noreferrer">
                    Portfolio
                  </a>
                </li>
                <li>
                  <a href="https://github.com/MiaGobble" target="_blank" rel="noreferrer">
                    GitHub
                  </a>
                </li>
                <li>
                  <a href="https://x.com/iGottic_Real" target="_blank" rel="noreferrer">
                    Twitter / X
                  </a>
                </li>
              </ul>
            </div>
          </div>

          <div className="site-footer__meta">
            <span>made with ❤️ by mia gobble</span>
            <a
              className="fie-badge"
              href="https://scds.igottic.com/"
              target="_blank"
              rel="noreferrer"
              title="SCDS FIE rating"
            >
              <img src="/fie-rating.png" alt="SCDS FIE rating badge" />
              <span>FIE rating · SCDS</span>
            </a>
          </div>
        </div>
      </footer>
    </ToastProvider>
  );
}
