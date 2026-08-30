import { evaluateBestHand } from "./evaluator.js";
import { ACTION } from "./table.js";

function preflopScore(cards) {
  if (!cards || cards.length < 2) return 0;
  const [a, b] = cards[0].rank >= cards[1].rank ? cards : [cards[1], cards[0]];
  const suited = a.suit === b.suit;
  const pair = a.rank === b.rank;
  const gap = a.rank - b.rank;
  let score = (a.rank + b.rank) / 28;
  if (pair) score = 0.55 + a.rank / 40;
  if (suited) score += 0.06;
  if (gap === 1) score += 0.05;
  if (gap >= 5 && !pair) score -= 0.08;
  if (a.rank >= 13 && b.rank >= 12) score += 0.12;
  return Math.max(0, Math.min(1, score));
}

function postflopScore(cards, board) {
  if (board.length < 3) return preflopScore(cards);
  const ev = evaluateBestHand([...cards, ...board]);
  const base = ev.category / 9;
  const kicker = (ev.ranks[0] ?? 0) / 14;
  return Math.max(0, Math.min(1, base * 0.85 + kicker * 0.15));
}

function pickRaiseTo(legal, strength, rng) {
  const span = legal.maxRaiseTo - legal.minRaiseTo;
  if (span <= 0) return legal.minRaiseTo;
  const mix = strength > 0.75 ? 0.55 + rng() * 0.45 : 0.05 + rng() * 0.4;
  return Math.round(legal.minRaiseTo + span * mix);
}

/**
 * Lightweight NLHE policy. Uses only public legal-actions + private hole cards.
 */
export function chooseAiAction(table, seat, rng = table.rng) {
  const legal = table.getLegalActions(seat);
  if (!legal) return { type: ACTION.CHECK };
  const p = table.players[seat];
  const strength = postflopScore(p.holeCards, table.communityCards);
  const roll = rng();

  if (legal.canCheck) {
    if (legal.canRaise && strength > 0.42 && roll < 0.38 + strength * 0.25) {
      return { type: ACTION.RAISE, amount: pickRaiseTo(legal, strength, rng) };
    }
    if (legal.canAllIn && strength > 0.88 && roll < 0.12) {
      return { type: ACTION.ALLIN };
    }
    return { type: ACTION.CHECK };
  }

  const potOddsPressure = legal.toCall / Math.max(legal.toCall + 20, 40);
  if (strength < 0.22 && roll < 0.62 + potOddsPressure * 0.2) {
    return { type: ACTION.FOLD };
  }
  if (legal.canRaise && strength > 0.58 && roll < 0.28 + strength * 0.2) {
    return { type: ACTION.RAISE, amount: pickRaiseTo(legal, strength, rng) };
  }
  if (legal.canAllIn && !legal.canCall && strength > 0.35) {
    return { type: ACTION.ALLIN };
  }
  if (legal.canCall) return { type: ACTION.CALL };
  if (legal.canAllIn && strength > 0.5) return { type: ACTION.ALLIN };
  if (legal.canFold) return { type: ACTION.FOLD };
  return { type: ACTION.CHECK };
}
