import { Link } from "react-router";
import { useSettings } from "./SettingsProvider";
import { DECK_FORMAT_META, type DeckListFormat } from "../lib/settings";

type Props = {
  /** Override displayed format (defaults to settings.deckFormat). */
  format?: DeckListFormat;
  compact?: boolean;
};

/** Shows the active export format and a link to change the default in Settings. */
export function FormatBadge({ format, compact }: Props) {
  const { settings } = useSettings();
  const id = format ?? settings.deckFormat;
  const meta = DECK_FORMAT_META[id];

  return (
    <p
      className="muted"
      style={{
        margin: compact ? "0.35rem 0 0" : "0.5rem 0 0",
        fontSize: compact ? "0.85rem" : undefined,
        display: "flex",
        flexWrap: "wrap",
        gap: "0.35rem 0.75rem",
        alignItems: "center",
      }}
    >
      <span>
        Format: <strong>{meta.label}</strong>
      </span>
      <Link to="/settings#deck-format" style={{ fontWeight: 600 }}>
        Change default
      </Link>
    </p>
  );
}
