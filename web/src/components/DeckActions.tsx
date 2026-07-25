import { Link } from "react-router";

type Props = {
  list: string;
  compact?: boolean;
  /** Hide the link back to deck pimping (e.g. when already on that tool). */
  hidePimp?: boolean;
  /** Render buttons only (no wrapping `.actions` row) for embedding. */
  bare?: boolean;
};

/** Shared actions for any generated deck/list: proxy or purchase. */
export function DeckActions({ list, compact, hidePimp, bare }: Props) {
  const encoded = encodeURIComponent(list);

  const buttons = (
    <>
      <Link className="btn btn-secondary" to={`/proxy?list=${encoded}`}>
        Proxy this list
      </Link>
      <Link className="btn btn-brass" to={`/bulk?list=${encoded}`}>
        Price / purchase
      </Link>
      {!hidePimp && (
        <Link className="btn btn-ghost" to={`/pimp?list=${encoded}`}>
          Pimp printings
        </Link>
      )}
    </>
  );

  if (bare) return buttons;

  return <div className={`actions${compact ? "" : ""}`}>{buttons}</div>;
}
