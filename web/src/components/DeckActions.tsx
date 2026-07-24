import { Link } from "react-router";

type Props = {
  list: string;
  compact?: boolean;
};

/** Shared actions for any generated deck/list: proxy or purchase. */
export function DeckActions({ list, compact }: Props) {
  const encoded = encodeURIComponent(list);

  return (
    <div className={`actions${compact ? "" : ""}`}>
      <Link className="btn btn-secondary" to={`/proxy?list=${encoded}`}>
        Proxy this list
      </Link>
      <Link className="btn btn-brass" to={`/bulk?list=${encoded}`}>
        Price / purchase
      </Link>
      <Link className="btn btn-ghost" to={`/pimp?list=${encoded}`}>
        Pimp printings
      </Link>
    </div>
  );
}
