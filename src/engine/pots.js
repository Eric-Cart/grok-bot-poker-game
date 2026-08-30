/**
 * Side-pot builder.
 * Folded chips stay in the pot; only non-folded contributors are eligible.
 */

function sameEligible(a, b) {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}

export function mergePots(pots) {
  const merged = [];
  for (const pot of pots) {
    if (pot.amount <= 0) continue;
    const eligible = [...pot.eligible].sort((x, y) => x - y);
    const prev = merged[merged.length - 1];
    if (prev && sameEligible(prev.eligible, eligible)) {
      prev.amount += pot.amount;
    } else {
      merged.push({ amount: pot.amount, eligible });
    }
  }
  return merged;
}

/**
 * @param {{ seat: number, contributed: number, folded: boolean }[]} players
 * @returns {{ amount: number, eligible: number[] }[]}
 */
export function computePots(players) {
  const contributors = players.filter((p) => p.contributed > 0);
  if (contributors.length === 0) return [];

  const levels = [...new Set(contributors.map((p) => p.contributed))].sort(
    (a, b) => a - b,
  );
  const pots = [];
  let prev = 0;

  for (const level of levels) {
    const layer = contributors.filter((p) => p.contributed >= level);
    const amount = (level - prev) * layer.length;
    const eligible = layer.filter((p) => !p.folded).map((p) => p.seat);
    if (amount > 0) pots.push({ amount, eligible });
    prev = level;
  }

  return mergePots(pots);
}

export function potTotal(pots) {
  return pots.reduce((sum, p) => sum + p.amount, 0);
}
