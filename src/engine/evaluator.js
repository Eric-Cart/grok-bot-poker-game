/**
 * 5-card (and 5–7 card) Texas Hold'em evaluator.
 * Best hand is chosen from any 5 cards among hole + board.
 * Categories: high-card → royal flush, with kickers.
 */

export const CATEGORY = {
  HIGH_CARD: 0,
  PAIR: 1,
  TWO_PAIR: 2,
  THREE_OF_A_KIND: 3,
  STRAIGHT: 4,
  FLUSH: 5,
  FULL_HOUSE: 6,
  FOUR_OF_A_KIND: 7,
  STRAIGHT_FLUSH: 8,
  ROYAL_FLUSH: 9,
};

export const CATEGORY_NAMES = [
  "High Card",
  "Pair",
  "Two Pair",
  "Three of a Kind",
  "Straight",
  "Flush",
  "Full House",
  "Four of a Kind",
  "Straight Flush",
  "Royal Flush",
];

const RANK_WORD = {
  2: "Two",
  3: "Three",
  4: "Four",
  5: "Five",
  6: "Six",
  7: "Seven",
  8: "Eight",
  9: "Nine",
  10: "Ten",
  11: "Jack",
  12: "Queen",
  13: "King",
  14: "Ace",
};

function combinations(arr, k) {
  const out = [];
  const n = arr.length;
  const idx = Array.from({ length: k }, (_, i) => i);
  if (k > n || k <= 0) return out;
  while (true) {
    out.push(idx.map((i) => arr[i]));
    let i = k - 1;
    while (i >= 0 && idx[i] === n - k + i) i--;
    if (i < 0) break;
    idx[i]++;
    for (let j = i + 1; j < k; j++) idx[j] = idx[j - 1] + 1;
  }
  return out;
}

function uniqueSortedDesc(ranks) {
  return [...new Set(ranks)].sort((a, b) => b - a);
}

/** Ace-low wheel is 5-high. Returns high card or null. */
export function straightHigh(ranks) {
  const uniq = uniqueSortedDesc(ranks);
  if (uniq.length < 5) return null;
  if (uniq.includes(14) && [2, 3, 4, 5].every((r) => uniq.includes(r))) {
    return 5;
  }
  for (let i = 0; i <= uniq.length - 5; i++) {
    const high = uniq[i];
    if (
      uniq[i + 1] === high - 1 &&
      uniq[i + 2] === high - 2 &&
      uniq[i + 3] === high - 3 &&
      uniq[i + 4] === high - 4
    ) {
      return high;
    }
  }
  return null;
}

function rankGroups(ranks) {
  const counts = new Map();
  for (const r of ranks) counts.set(r, (counts.get(r) || 0) + 1);
  return [...counts.entries()].sort((a, b) => {
    if (b[1] !== a[1]) return b[1] - a[1];
    return b[0] - a[0];
  });
}

export function evaluateFive(cards) {
  if (cards.length !== 5) throw new Error("evaluateFive expects 5 cards");
  const ranks = cards.map((c) => c.rank).sort((a, b) => b - a);
  const isFlush = cards.every((c) => c.suit === cards[0].suit);
  const sHigh = straightHigh(ranks);
  const isStraight = sHigh !== null;
  const groups = rankGroups(ranks);

  if (isStraight && isFlush) {
    if (sHigh === 14) {
      return {
        category: CATEGORY.ROYAL_FLUSH,
        ranks: [14],
        name: CATEGORY_NAMES[CATEGORY.ROYAL_FLUSH],
        bestFive: cards.slice(),
      };
    }
    return {
      category: CATEGORY.STRAIGHT_FLUSH,
      ranks: [sHigh],
      name: CATEGORY_NAMES[CATEGORY.STRAIGHT_FLUSH],
      bestFive: cards.slice(),
    };
  }
  if (groups[0][1] === 4) {
    return {
      category: CATEGORY.FOUR_OF_A_KIND,
      ranks: [groups[0][0], groups[1][0]],
      name: CATEGORY_NAMES[CATEGORY.FOUR_OF_A_KIND],
      bestFive: cards.slice(),
    };
  }
  if (groups[0][1] === 3 && groups[1][1] === 2) {
    return {
      category: CATEGORY.FULL_HOUSE,
      ranks: [groups[0][0], groups[1][0]],
      name: CATEGORY_NAMES[CATEGORY.FULL_HOUSE],
      bestFive: cards.slice(),
    };
  }
  if (isFlush) {
    return {
      category: CATEGORY.FLUSH,
      ranks,
      name: CATEGORY_NAMES[CATEGORY.FLUSH],
      bestFive: cards.slice(),
    };
  }
  if (isStraight) {
    return {
      category: CATEGORY.STRAIGHT,
      ranks: [sHigh],
      name: CATEGORY_NAMES[CATEGORY.STRAIGHT],
      bestFive: cards.slice(),
    };
  }
  if (groups[0][1] === 3) {
    return {
      category: CATEGORY.THREE_OF_A_KIND,
      ranks: [groups[0][0], ...groups.slice(1).map((g) => g[0])],
      name: CATEGORY_NAMES[CATEGORY.THREE_OF_A_KIND],
      bestFive: cards.slice(),
    };
  }
  if (groups[0][1] === 2 && groups[1]?.[1] === 2) {
    return {
      category: CATEGORY.TWO_PAIR,
      ranks: [groups[0][0], groups[1][0], groups[2][0]],
      name: CATEGORY_NAMES[CATEGORY.TWO_PAIR],
      bestFive: cards.slice(),
    };
  }
  if (groups[0][1] === 2) {
    return {
      category: CATEGORY.PAIR,
      ranks: [groups[0][0], ...groups.slice(1).map((g) => g[0])],
      name: CATEGORY_NAMES[CATEGORY.PAIR],
      bestFive: cards.slice(),
    };
  }
  return {
    category: CATEGORY.HIGH_CARD,
    ranks,
    name: CATEGORY_NAMES[CATEGORY.HIGH_CARD],
    bestFive: cards.slice(),
  };
}

export function compareEvaluations(a, b) {
  if (a.category !== b.category) return a.category - b.category;
  const n = Math.max(a.ranks.length, b.ranks.length);
  for (let i = 0; i < n; i++) {
    const av = a.ranks[i] ?? 0;
    const bv = b.ranks[i] ?? 0;
    if (av !== bv) return av - bv;
  }
  return 0;
}

export function evaluateBestHand(cards) {
  if (cards.length < 5) {
    throw new Error("Need at least 5 cards to evaluate a Hold'em hand");
  }
  if (cards.length === 5) return evaluateFive(cards);
  let best = null;
  for (const five of combinations(cards, 5)) {
    const ev = evaluateFive(five);
    if (!best || compareEvaluations(ev, best) > 0) best = ev;
  }
  return best;
}

export function describeHand(ev) {
  if (!ev) return "";
  const r = ev.ranks;
  switch (ev.category) {
    case CATEGORY.ROYAL_FLUSH:
      return "Royal Flush";
    case CATEGORY.STRAIGHT_FLUSH:
      return `Straight Flush, ${RANK_WORD[r[0]]} high`;
    case CATEGORY.FOUR_OF_A_KIND:
      return `Four of a Kind, ${RANK_WORD[r[0]]}s`;
    case CATEGORY.FULL_HOUSE:
      return `Full House, ${RANK_WORD[r[0]]}s full of ${RANK_WORD[r[1]]}s`;
    case CATEGORY.FLUSH:
      return `Flush, ${RANK_WORD[r[0]]} high`;
    case CATEGORY.STRAIGHT:
      return `Straight, ${RANK_WORD[r[0]]} high`;
    case CATEGORY.THREE_OF_A_KIND:
      return `Three of a Kind, ${RANK_WORD[r[0]]}s`;
    case CATEGORY.TWO_PAIR:
      return `Two Pair, ${RANK_WORD[r[0]]}s and ${RANK_WORD[r[1]]}s`;
    case CATEGORY.PAIR:
      return `Pair of ${RANK_WORD[r[0]]}s`;
    default:
      return `${RANK_WORD[r[0]]} high`;
  }
}
