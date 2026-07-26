/**
 * Backward-compatible deck list API.
 * Prefer importing from `./deckFormat` for new code.
 */
export {
  parseDeckList,
  parseDeckListAsync,
  parseMoxfieldList,
  serializeDeckList,
  serializeDeckListAsync,
  convertDeckFormat,
  detectDeckFormat,
  toMoxfieldList,
  cardsToDeckList,
  cardsToDeckListAsync,
  cardsToMoxfieldList,
  flattenQuantities,
  uniqueNames,
  formatLabel,
  type DeckLine,
  type SerializeOptions,
  type FormatConvertResult,
} from "./deckFormat";
