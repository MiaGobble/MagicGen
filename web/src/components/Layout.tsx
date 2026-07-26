import { NavLink, Outlet } from "react-router";
import { useEffect, useState } from "react";
import { SettingsProvider } from "./SettingsProvider";
import { ToastProvider } from "./Toast";

const LINKS = [
  { to: "/commander", label: "Random commander" },
  { to: "/pod", label: "Pod generator" },
  { to: "/pimp", label: "Deck pimping" },
  { to: "/budget", label: "Deck cost cutter" },
  { to: "/convert", label: "Format converter" },
  { to: "/pool-decks", label: "Pool to decks" },
  { to: "/booster", label: "Booster generator" },
  { to: "/pack-wars", label: "Pack Wars generator" },
  { to: "/proxy", label: "Proxy tools" },
  { to: "/bulk", label: "Bulk purchasing" },
  { to: "/supplies", label: "MTG supplies" },
  { to: "/sleeves", label: "Sleeve color matcher" },
  { to: "/dice", label: "Dice color matcher" },
  { to: "/beginner", label: "Beginner starter" },
];

export function Layout() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  useEffect(() => {
    document.body.classList.toggle("nav-open", open);
    return () => document.body.classList.remove("nav-open");
  }, [open]);

  const close = () => setOpen(false);

  return (
    <SettingsProvider>
      <ToastProvider>
      <div className="site-shell">
        <div
          className={`site-sidebar__backdrop${open ? " open" : ""}`}
          onClick={close}
          aria-hidden={!open}
        />

        <aside className={`site-sidebar${open ? " open" : ""}`}>
          <div className="site-sidebar__top">
            <NavLink to="/home" className="brand" onClick={close}>
              <img className="brand__logo" src="/logo.png" alt="" width={40} height={40} />
              MagicGen
            </NavLink>
            <button
              type="button"
              className="nav-close"
              aria-label="Close navigation"
              onClick={close}
            >
              Close
            </button>
          </div>

          <nav className="site-nav" aria-label="Primary">
            {LINKS.map((l) => (
              <NavLink
                key={l.to}
                to={l.to}
                className={({ isActive }) => (isActive ? "active" : undefined)}
                onClick={close}
              >
                {l.label}
              </NavLink>
            ))}
          </nav>

          <div className="site-sidebar__foot">
            <div className="site-sidebar__foot-row">
              <a
                className="nav-kofi"
                href="https://ko-fi.com/igottic"
                target="_blank"
                rel="noopener noreferrer"
                onClick={close}
              >
                Support on Ko-fi
              </a>
              <NavLink
                to="/settings"
                className={({ isActive }) =>
                  `nav-settings${isActive ? " nav-settings--active" : ""}`
                }
                aria-label="Settings"
                title="Settings"
                onClick={close}
              >
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden
                >
                  <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
                  <circle cx="12" cy="12" r="3" />
                </svg>
              </NavLink>
            </div>
          </div>
        </aside>

        <div className="site-content">
          <header className="site-mobile-bar">
            <NavLink to="/" className="brand" onClick={close}>
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
                    <a href="https://scryfall.com/" target="_blank" rel="noopener noreferrer">
                      Scryfall
                    </a>
                    . Power level and bracket estimates follow the methodology popularized by{" "}
                    <a
                      href="https://edhpowerlevel.com/"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      EDH Power Level
                    </a>{" "}
                    (impact, efficiency, tipping point); MagicGen is not affiliated with that
                    project. Magic: The Gathering is a trademark of Wizards of the Coast. This site
                    is unofficial Fan Content permitted under the Fan Content Policy (not affiliated
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
                      <a href="https://ko-fi.com/igottic" target="_blank" rel="noopener noreferrer">
                        Support on Ko-fi
                      </a>
                    </li>
                    <li>
                      <a href="https://scds.igottic.com/" target="_blank" rel="noopener noreferrer">
                        SCDS / FIE rating
                      </a>
                    </li>
                  </ul>
                </div>
                <div>
                  <h3>Links</h3>
                  <ul>
                    <li>
                      <a href="https://igottic.com/" target="_blank" rel="noopener noreferrer">
                        Portfolio
                      </a>
                    </li>
                    <li>
                      <a
                        href="https://github.com/MiaGobble"
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        GitHub
                      </a>
                    </li>
                    <li>
                      <a
                        href="https://x.com/iGottic_Real"
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        Twitter / X
                      </a>
                    </li>
                  </ul>
                </div>
              </div>

              <div className="site-footer__meta">
                <span>Made with 💞 by Mia Gobble</span>
                <a
                  className="fie-badge"
                  href="https://scds.igottic.com/"
                  target="_blank"
                  rel="noopener noreferrer"
                  title="SCDS FIE rating"
                >
                  <img src="/fie-rating.png" alt="SCDS FIE rating badge" />
                  <span>FIE rating · SCDS</span>
                </a>
              </div>
            </div>
          </footer>
        </div>
      </div>
      </ToastProvider>
    </SettingsProvider>
  );
}
