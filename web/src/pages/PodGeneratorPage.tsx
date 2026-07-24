import { useState } from "react";
import { Link } from "react-router-dom";
import { CommanderFilters, DEFAULT_FILTERS, type FilterState } from "../components/CommanderFilters";
import { ColorIdentity } from "../components/Mana";
import { Seo } from "../components/Seo";
import { maybeShowKofiSupportToast, useToast } from "../components/Toast";
import { getCardImage } from "../lib/scryfall";
import { generatePod, type PodSeat } from "../lib/pod";

export function PodGeneratorPage() {
  const { toast } = useToast();
  const [filters, setFilters] = useState<FilterState>(DEFAULT_FILTERS);
  const [players, setPlayers] = useState(4);
  const [bracket, setBracket] = useState(3);
  const [seeds, setSeeds] = useState<string[]>(["", "", "", ""]);
  const [pod, setPod] = useState<PodSeat[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function updateSeed(index: number, value: string) {
    setSeeds((prev) => {
      const next = [...prev];
      next[index] = value;
      return next;
    });
  }

  async function onGenerate() {
    setLoading(true);
    setError(null);
    setPod(null);
    try {
      const seats = await generatePod({
        players,
        bracket,
        colors: filters.colors,
        playstyle: filters.playstyle || undefined,
        set: filters.set || undefined,
        partners: filters.partners,
        seeded: seeds.slice(0, players),
      });
      setPod(seats);
      toast(`Pod ready (${seats.length} seats)`, "success");
      maybeShowKofiSupportToast(toast);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed";
      setError(msg.includes("no pods") ? "no pods within filters found" : msg);
      toast("Pod generation failed", "error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="tool-page container">
      <Seo
        title="Commander Pod Generator"
        description="Build balanced multiplayer Magic: The Gathering commander pods that counter and complement each other."
        path="/pod"
      />
      <header className="tool-header">
        <h1>Commander pod generator</h1>
        <p>
          Build a table of commanders that counter and complement each other: fun pods where nothing
          feels like the only threat.
        </p>
      </header>

      <details className="panel methodology">
        <summary>How it works</summary>
        <div className="methodology__body">
          <p>
            The pod builder fills each seat with a commander, then nudges the table toward variety so
            identities don’t pile up on the same colors.
          </p>
          <ul>
            <li>
              <strong>Seeds first.</strong> Optional seat names lock those commanders in; empty seats
              draw random legendary commanders from Scryfall using your color, playstyle, set, and
              partner filters.
            </li>
            <li>
              <strong>Filters.</strong> Color identity, playstyle keywords, set code, and partner
              options feed the same Scryfall query used by the random commander tool (
              <code>include</code> color mode).
            </li>
            <li>
              <strong>Partners.</strong> If partners are enabled and a commander’s text/type suggests
              Partner, Friends Forever, or Background, a second random partner is pulled (retrying
              once if color overlap is heavy).
            </li>
            <li>
              <strong>Balance pass.</strong> After the first draft, non-seeded seats may be
              re-rolled (up to 8 tries each) when the table fails balance checks: avoid every seat
              sharing one identity, avoid identical 3+ color identities, and avoid one color
              appearing on nearly every deck.
            </li>
            <li>
              <strong>Roles &amp; bracket.</strong> Seat labels (Aggro pressure, Interaction /
              control, etc.) rotate for flavor. Bracket is passed through for deck links but is not a
              hard power filter in matching.
            </li>
            <li>
              <strong>Randomness.</strong> Unseeded picks use Scryfall’s random endpoint, so
              regenerating with the same filters yields different pods.
            </li>
          </ul>
        </div>
      </details>

      <div className="field-grid" style={{ marginBottom: "1rem" }}>
        <div className="field">
          <label htmlFor="players">Players</label>
          <select id="players" value={players} onChange={(e) => setPlayers(Number(e.target.value))}>
            {[2, 3, 4, 5, 6].map((n) => (
              <option key={n} value={n}>
                {n} players
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="podBracket">Bracket</label>
          <select id="podBracket" value={bracket} onChange={(e) => setBracket(Number(e.target.value))}>
            {[1, 2, 3, 4, 5].map((b) => (
              <option key={b} value={b}>
                Bracket {b}
              </option>
            ))}
          </select>
        </div>
      </div>

      <CommanderFilters value={filters} onChange={setFilters} />

      <section className="panel" style={{ marginTop: "1rem" }}>
        <h2 style={{ marginTop: 0, fontSize: "1.15rem" }}>Seed commanders (optional)</h2>
        <p className="muted">Lock in one or more names; the rest auto-match around them.</p>
        <div className="field-grid">
          {Array.from({ length: players }, (_, i) => (
            <div className="field" key={i}>
              <label htmlFor={`seed-${i}`}>Seat {i + 1}</label>
              <input
                id={`seed-${i}`}
                placeholder="Commander name"
                value={seeds[i] ?? ""}
                onChange={(e) => updateSeed(i, e.target.value)}
              />
            </div>
          ))}
        </div>
      </section>

      <div className="actions">
        <button type="button" className="btn btn-primary" onClick={onGenerate} disabled={loading}>
          {loading ? "Matching…" : "Generate pod"}
        </button>
      </div>

      {error && <p className="error">{error}</p>}

      {pod && (
        <div className="tool-links" style={{ marginTop: "1.5rem" }}>
          {pod.map((seat, i) => (
            <PodCard key={seat.commander.id} seat={seat} index={i} bracket={bracket} />
          ))}
        </div>
      )}
    </div>
  );
}

function PodCard({ seat, index, bracket }: { seat: PodSeat; index: number; bracket: number }) {
  const c = seat.commander;
  return (
    <article className="panel panel-strong" style={{ display: "grid", gridTemplateColumns: "100px 1fr", gap: "1rem" }}>
      <img
        src={getCardImage(c, "normal")}
        alt={c.name}
        style={{ borderRadius: 8, width: 100, height: "auto" }}
      />
      <div>
        <p className="muted" style={{ margin: 0 }}>
          Seat {index + 1} · {seat.role}
        </p>
        <h3 style={{ margin: "0.2rem 0" }}>{c.name}</h3>
        <ColorIdentity colors={c.color_identity} />
        {seat.partner && (
          <p className="muted" style={{ marginTop: "0.5rem" }}>
            Partner: {seat.partner.name}
          </p>
        )}
        <div className="actions">
          <Link
            className="btn btn-secondary"
            to={`/commander?name=${encodeURIComponent(c.name)}&bracket=${bracket}&autodeck=1`}
          >
            Generate average deck
          </Link>
        </div>
      </div>
    </article>
  );
}
