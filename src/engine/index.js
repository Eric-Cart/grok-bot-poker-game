/**
 * NLHE engine public API.
 * The UI should depend on this module only — never on table internals.
 *
 * Locked table: 6-max, blinds 5/10, starting stack 1000.
 *
 *   const table = createTable();
 *   table.startHand();
 *   const state = table.getPublicState(0);
 *   table.act(state.toAct, { type: 'call' });
 *   table.act(state.toAct, { type: 'raise', amount: state.legalActions.minRaiseTo });
 */

import { Table } from "./table.js";

export {
  createDeck,
  formatCard,
  mulberry32,
  parseCard,
  RANK_LABELS,
  shuffle,
  SUIT_SYMBOLS,
} from "./cards.js";
export {
  CATEGORY,
  CATEGORY_NAMES,
  compareEvaluations,
  describeHand,
  evaluateBestHand,
  evaluateFive,
} from "./evaluator.js";
export { computePots, mergePots, potTotal } from "./pots.js";
export { ACTION, STREET, Table } from "./table.js";
export { chooseAiAction } from "./ai.js";

export const TABLE_SPEC = {
  seatCount: 6,
  smallBlind: 5,
  bigBlind: 10,
  startingStack: 1000,
};

export function createTable(config = {}) {
  return new Table({ ...TABLE_SPEC, ...config });
}
