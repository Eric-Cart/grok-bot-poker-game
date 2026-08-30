import { describe, expect, it } from "vitest";
import { computePots, potTotal } from "./pots.js";

describe("computePots", () => {
  it("builds a single main pot when everyone matches", () => {
    const pots = computePots([
      { seat: 0, contributed: 40, folded: false },
      { seat: 1, contributed: 40, folded: false },
      { seat: 2, contributed: 40, folded: false },
    ]);
    expect(pots).toEqual([{ amount: 120, eligible: [0, 1, 2] }]);
  });

  it("creates a side pot when a short stack is all-in", () => {
    const pots = computePots([
      { seat: 0, contributed: 100, folded: false },
      { seat: 1, contributed: 400, folded: false },
      { seat: 2, contributed: 400, folded: false },
    ]);
    expect(pots).toEqual([
      { amount: 300, eligible: [0, 1, 2] },
      { amount: 600, eligible: [1, 2] },
    ]);
    expect(potTotal(pots)).toBe(900);
  });

  it("keeps folded chips in the pot without eligibility", () => {
    const pots = computePots([
      { seat: 0, contributed: 50, folded: true },
      { seat: 1, contributed: 200, folded: false },
      { seat: 2, contributed: 200, folded: false },
    ]);
    expect(pots).toEqual([{ amount: 450, eligible: [1, 2] }]);
  });

  it("supports three all-in levels", () => {
    const pots = computePots([
      { seat: 0, contributed: 20, folded: false },
      { seat: 1, contributed: 80, folded: false },
      { seat: 2, contributed: 200, folded: false },
    ]);
    expect(pots).toEqual([
      { amount: 60, eligible: [0, 1, 2] },
      { amount: 120, eligible: [1, 2] },
      { amount: 120, eligible: [2] },
    ]);
  });
});
