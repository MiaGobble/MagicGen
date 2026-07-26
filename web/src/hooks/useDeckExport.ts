import { useCallback } from "react";
import { useSettings } from "../components/SettingsProvider";
import { cardsToDeckList, serializeDeckList, type DeckLine } from "../lib/deckFormat";
import { DECK_FORMAT_META, type DeckListFormat } from "../lib/settings";

/** Serialize deck lines/cards using the user's preferred export format. */
export function useDeckExport() {
  const { settings } = useSettings();
  const format = settings.deckFormat;

  const formatLines = useCallback(
    (lines: DeckLine[], override?: DeckListFormat) =>
      serializeDeckList(lines, { format: override ?? format }),
    [format],
  );

  const formatCards = useCallback(
    (
      cards: { name: string; set?: string; collector_number?: string; finishes?: string[] }[],
      override?: DeckListFormat,
    ) => cardsToDeckList(cards, { format: override ?? format }),
    [format],
  );

  return {
    format,
    formatLabel: DECK_FORMAT_META[format].label,
    formatLines,
    formatCards,
  };
}
