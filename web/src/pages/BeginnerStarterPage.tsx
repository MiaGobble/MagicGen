import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  beginnerPreconUrl,
  beginnerSupplyLinks,
  pickBeginnerPrecon,
  type BeginnerPrecon,
  type PlaystyleId,
} from "../lib/amazon";

const STEPS = ["Learn", "Find", "Get", "Play"] as const;
type Step = (typeof STEPS)[number];

const PLAYSTYLES = [
  { id: "aggro" as const, label: "Fast & aggressive", blurb: "I want to attack early and often." },
  { id: "control" as const, label: "Careful & controlling", blurb: "I like stopping threats, then winning." },
  { id: "tokens" as const, label: "Lots of creatures", blurb: "Fill the board with little buddies." },
  { id: "bigCreatures" as const, label: "Giant monsters", blurb: "Ramp up and smash with huge creatures." },
  { id: "spellslinger" as const, label: "Clever spells", blurb: "Cast lots of instants and sorceries." },
  { id: "lifegain" as const, label: "Gain life", blurb: "Stay safe and grow stronger over time." },
];

export function BeginnerStarterPage() {
  const [step, setStep] = useState<Step>("Learn");
  const [knowsRules, setKnowsRules] = useState<boolean | null>(null);
  const [style, setStyle] = useState<PlaystyleId>("aggro");
  const [preferBudget, setPreferBudget] = useState(true);
  const [precon, setPrecon] = useState<BeginnerPrecon>(() =>
    pickBeginnerPrecon("aggro", { preferBudget: true }),
  );

  useEffect(() => {
    setPrecon(pickBeginnerPrecon(style, { preferBudget }));
  }, [style, preferBudget]);

  function regenerate() {
    setPrecon(pickBeginnerPrecon(style, { preferBudget, avoidName: precon.name }));
  }

  const stepIndex = STEPS.indexOf(step);
  const deckUrl = beginnerPreconUrl(precon, preferBudget);
  const supplyLinks = beginnerSupplyLinks();

  return (
    <div className="tool-page container">
      <header className="tool-header">
        <h1>Beginner starter</h1>
        <p>A linear path: learn the game, find a precon, get supplies, then play.</p>
      </header>

      <div className="stepper" aria-label="Progress">
        {STEPS.map((s, i) => (
          <span key={s} className={i === stepIndex ? "active" : i < stepIndex ? "done" : ""}>
            {s}
          </span>
        ))}
      </div>

      <section className="panel panel-strong" style={{ minHeight: 280, animation: "riseIn 400ms ease" }}>
        {step === "Learn" && (
          <>
            <h2 style={{ marginTop: 0 }}>Do you know how to play?</h2>
            <div className="actions">
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => {
                  setKnowsRules(true);
                  setStep("Find");
                }}
              >
                Yes — skip ahead
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setKnowsRules(false)}
              >
                Not yet
              </button>
            </div>
            {knowsRules === false && (
              <div style={{ marginTop: "1.25rem" }}>
                <p>Start here:</p>
                <ul>
                  <li>
                    <a href="https://magic.wizards.com/en/how-to-play" target="_blank" rel="noreferrer">
                      Official Magic how-to-play
                    </a>
                  </li>
                  <li>
                    <a href="https://draftsim.com/mtg-commander/" target="_blank" rel="noreferrer">
                      Commander rules overview (Draftsim)
                    </a>
                  </li>
                </ul>
                <button type="button" className="btn btn-brass" onClick={() => setStep("Find")}>
                  I’ve got the basics — continue
                </button>
              </div>
            )}
          </>
        )}

        {step === "Find" && (
          <>
            <h2 style={{ marginTop: 0 }}>What sounds fun?</h2>
            <p className="muted">Pick a broad playstyle — no rules jargon required.</p>
            <label className="check" style={{ marginBottom: "0.75rem" }}>
              <input
                type="checkbox"
                checked={preferBudget}
                onChange={(e) => setPreferBudget(e.target.checked)}
              />
              Prefer budget options ($40–$60)
            </label>
            <div className="check-row" style={{ flexDirection: "column", alignItems: "stretch" }}>
              {PLAYSTYLES.map((p) => (
                <label key={p.id} className="check" style={{ padding: "0.35rem 0" }}>
                  <input
                    type="radio"
                    name="style"
                    checked={style === p.id}
                    onChange={() => setStyle(p.id)}
                  />
                  <span>
                    <strong>{p.label}</strong> — {p.blurb}
                  </span>
                </label>
              ))}
            </div>
            <div className="panel" style={{ marginTop: "1rem" }}>
              <h3 style={{ marginTop: 0 }}>{precon.name}</h3>
              <p className="muted">Commander: {precon.commander}</p>
              <p>{precon.description}</p>
              <div className="actions">
                <button type="button" className="btn btn-ghost" onClick={regenerate}>
                  Regenerate suggestion
                </button>
                <a className="btn btn-brass" href={deckUrl} target="_blank" rel="noreferrer">
                  View on Amazon
                </a>
                <button type="button" className="btn btn-primary" onClick={() => setStep("Get")}>
                  This looks good
                </button>
              </div>
            </div>
          </>
        )}

        {step === "Get" && (
          <>
            <h2 style={{ marginTop: 0 }}>Get your gear</h2>
            <p>
              Grab <strong>{precon.name}</strong>, then kit out with starter supplies: a deck box, D6
              dice, spindown D20s, and sleeves.
            </p>
            <div className="actions">
              <a className="btn btn-brass" href={deckUrl} target="_blank" rel="noreferrer">
                Buy {precon.name} on Amazon
              </a>
              <Link className="btn btn-secondary" to="/supplies">
                Generate MTG supplies
              </Link>
            </div>
            <ul>
              {supplyLinks.map((item) => (
                <li key={item.name}>
                  <a href={item.url} target="_blank" rel="noreferrer">
                    {item.name}
                  </a>
                </li>
              ))}
            </ul>
            <button type="button" className="btn btn-primary" onClick={() => setStep("Play")}>
              Next: how to play
            </button>
          </>
        )}

        {step === "Play" && (
          <>
            <h2 style={{ marginTop: 0 }}>Play online or in person</h2>
            <div className="split">
              <div>
                <h3>Online</h3>
                <ol>
                  <li>
                    Get{" "}
                    <a
                      href="https://store.steampowered.com/app/286160/Tabletop_Simulator/"
                      target="_blank"
                      rel="noreferrer"
                    >
                      Tabletop Simulator
                    </a>{" "}
                    on Steam.
                  </li>
                  <li>
                    Subscribe to popular MTG / Commander workshop tables and card imports (search
                    “MTG” / “EDH” in the Workshop).
                  </li>
                  <li>
                    Find games via{" "}
                    <a href="https://discord.gg/blacklotuscollective" target="_blank" rel="noreferrer">
                      Black Lotus Collective
                    </a>
                    .
                  </li>
                </ol>
              </div>
              <div>
                <h3>In person</h3>
                <ol>
                  <li>
                    Find a store with the{" "}
                    <a href="https://locator.wizards.com/" target="_blank" rel="noreferrer">
                      Wizards Store & Event Locator
                    </a>
                    .
                  </li>
                  <li>Ask about Commander / EDH nights — most stores run weekly casual pods.</li>
                  <li>Bring your precon, sleeves, and a smile. Tell the table you’re new.</li>
                </ol>
              </div>
            </div>
            <div className="actions">
              <button type="button" className="btn btn-ghost" onClick={() => setStep("Learn")}>
                Start over
              </button>
              <Link className="btn btn-primary" to="/commander">
                Try a random commander next
              </Link>
            </div>
          </>
        )}
      </section>
    </div>
  );
}
