import { NavLink, Outlet } from "react-router";
import { useEffect, useState } from "react";
import { ToastProvider } from "./Toast";

const LINKS = [
  { to: "/commander", label: "Random commander" },
  { to: "/pod", label: "Pod generator" },
  { to: "/pimp", label: "Deck pimping" },
  { to: "/booster", label: "Booster generator" },
  { to: "/proxy", label: "Proxy tools" },
  { to: "/bulk", label: "Bulk purchasing" },
  { to: "/supplies", label: "MTG supplies" },
  { to: "/sleeves", label: "Sleeve color matcher" },
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
    <ToastProvider>
      <div className="site-shell">
        <div
          className={`site-sidebar__backdrop${open ? " open" : ""}`}
          onClick={close}
          aria-hidden={!open}
        />

        <aside className={`site-sidebar${open ? " open" : ""}`}>
          <div className="site-sidebar__top">
            <NavLink to="/" className="brand" onClick={close}>
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
            <a
              className="nav-kofi"
              href="https://ko-fi.com/igottic"
              target="_blank"
              rel="noopener noreferrer"
              onClick={close}
            >
              Support on Ko-fi
            </a>
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
                <span>With love by Mia Gobble</span>
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
  );
}
