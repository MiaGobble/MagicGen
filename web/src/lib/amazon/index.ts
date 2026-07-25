/** Amazon helpers: affiliate URLs, sleeves, supplies, beginner precons. */
export { AFFILIATE_TAG, amazonProductUrl, amazonSearchUrl } from "./affiliate";
export { hexToHueName, type HueName, type HueFamily } from "./color";
export {
  matchSleeveColor,
  sleeveListingUrl,
  colorNamesFromHex,
  type SleeveMatchResult,
  type SleeveMatchStage,
  type SleeveMatchProgress,
} from "./sleeves";
export {
  matchDiceColor,
  diceListingUrl,
  diceColorNamesFromHex,
  DICE_FINISH_OPTIONS,
  type DiceKind,
  type DiceFinish,
  type DiceMatchResult,
  type DiceMatchStage,
  type DiceMatchProgress,
} from "./dice";
export {
  SUPPLY_LABELS,
  buildSupplyQueries,
  proxySupplyLinks,
  type SupplyKey,
  type SupplyOptions,
  type SupplyResult,
} from "./supplies";
export {
  pickBeginnerPrecon,
  beginnerPreconUrl,
  beginnerSupplyTypes,
  type BeginnerPrecon,
  type PlaystyleId,
} from "./beginner";
