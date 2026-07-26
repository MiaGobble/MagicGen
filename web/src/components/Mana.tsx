import { parseManaSymbols } from "../lib/scryfall";

export function ManaCost({ cost }: { cost: string }) {
  const symbols = parseManaSymbols(cost);
  if (!symbols.length) return <span className="muted">-</span>;
  return (
    <span className="mana" aria-label={cost}>
      {symbols.map((s, i) => (
        <span key={`${s}-${i}`} className={`mana-pip ${s.length === 1 ? s : "C"}`}>
          {s}
        </span>
      ))}
    </span>
  );
}

export function ColorIdentity({ colors }: { colors: string[] }) {
  if (!colors.length) return <span className="mana-pip C">C</span>;
  return (
    <span className="mana" aria-label={`Color identity ${colors.join("")}`}>
      {colors.map((c) => (
        <span key={c} className={`mana-pip ${c}`}>
          {c}
        </span>
      ))}
    </span>
  );
}
