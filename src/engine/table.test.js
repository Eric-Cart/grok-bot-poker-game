import { describe, expect, it } from "vitest";
import { mulberry32 } from "./cards.js";
import { ACTION, STREET, Table } from "./table.js";

function sixMax(overrides = {}) {
  return new Table({
    seatCount: 6,
    smallBlind: 5,
    bigBlind: 10,
    startingStack: 1000,
    humanSeat: 0,
    dealerIndex: 3,
    autoRebuy: false,
    ...overrides,
  });
}

function actUntil(table, seat, action) {
  const guard = 40;
  for (let i = 0; i < guard; i++) {
    if (table.toAct === seat) {
      table.act(seat, action);
      return;
    }
    if (table.toAct === null) throw new Error("Hand ended before target acted");
    const legal = table.getLegalActions(table.toAct);
    if (legal.canCheck) table.act(table.toAct, { type: ACTION.CHECK });
    else if (legal.canCall) table.act(table.toAct, { type: ACTION.CALL });
    else table.act(table.toAct, { type: ACTION.FOLD });
  }
  throw new Error("Could not reach seat");
}

describe("Table blinds and streets", () => {
  it("posts 5/10 and starts action UTG at a 6-max table", () => {
    const table = sixMax();
    table.startHand();
    expect(table.street).toBe(STREET.PREFLOP);
    expect(table.dealerIndex).toBe(3);
    expect(table.sbSeat).toBe(4);
    expect(table.bbSeat).toBe(5);
    expect(table.toAct).toBe(0);
    expect(table.players[4].contributed).toBe(5);
    expect(table.players[5].contributed).toBe(10);
    expect(table.players[4].stack).toBe(995);
    expect(table.players[5].stack).toBe(990);
    expect(table.getLegalActions(0).toCall).toBe(10);
  });

  it("only offers legal actions and enforces min-raise", () => {
    const table = sixMax();
    table.startHand();
    const legal = table.getLegalActions(0);
    expect(legal.canCheck).toBe(false);
    expect(legal.canCall).toBe(true);
    expect(legal.canRaise).toBe(true);
    expect(legal.minRaiseTo).toBe(20);
    expect(() => table.act(0, { type: ACTION.CHECK })).toThrow();
    expect(() => table.act(0, { type: ACTION.RAISE, amount: 15 })).toThrow(
      /Min raise/,
    );
    table.act(0, { type: ACTION.RAISE, amount: 30 });
    expect(table.currentBet).toBe(30);
    expect(table.players[0].contributed).toBe(30);
    expect(table.toAct).toBe(1);
  });

  it("awards the pot when everyone folds", () => {
    const table = sixMax();
    table.startHand();
    for (const seat of [0, 1, 2, 3, 4]) {
      table.act(seat, { type: ACTION.FOLD });
    }
    expect(table.street).toBe(STREET.HAND_OVER);
    expect(table.winners[0].seat).toBe(5);
    expect(table.players[5].stack).toBe(1005);
  });

  it("runs check-down streets to a showdown", () => {
    const table = sixMax({
      dealerIndex: 3,
    });
    table.startHand({
      holeCards: {
        0: ["Ah", "Kh"],
        1: ["2c", "7d"],
        2: ["3c", "8d"],
        3: ["4c", "9d"],
        4: ["5c", "Td"],
        5: ["6c", "Jd"],
      },
      communityCards: ["2h", "2s", "2d", "Kc", "3h"],
    });

    table.act(0, { type: ACTION.CALL });
    for (const seat of [1, 2, 3]) table.act(seat, { type: ACTION.FOLD });
    table.act(4, { type: ACTION.CALL });
    table.act(5, { type: ACTION.CHECK });

    expect(table.street).toBe(STREET.FLOP);
    while (table.street !== STREET.HAND_OVER) {
      const legal = table.getLegalActions(table.toAct);
      if (legal.canCheck) table.act(table.toAct, { type: ACTION.CHECK });
      else table.act(table.toAct, { type: ACTION.CALL });
    }

    expect(table.communityCards).toHaveLength(5);
    const winner = table.winners[0];
    expect(winner.seat).toBe(0);
    expect(winner.handName).toBe("Full House");
    expect(table.players[0].stack).toBeGreaterThan(1000);
  });

  it("hides opponent hole cards until the hand is over", () => {
    const table = sixMax();
    table.startHand();
    const live = table.getPublicState(0);
    expect(live.players[0].holeCards[0]).not.toBeNull();
    expect(live.players[1].holeCards[0]).toBeNull();
    table.act(0, { type: ACTION.FOLD });
    table.act(1, { type: ACTION.FOLD });
    table.act(2, { type: ACTION.FOLD });
    table.act(3, { type: ACTION.FOLD });
    table.act(4, { type: ACTION.FOLD });
    const done = table.getPublicState(0);
    expect(done.handOver).toBe(true);
    expect(done.players[5].holeCards[0]).not.toBeNull();
    expect(done.players[1].holeCards[0]).toBeNull();
  });
});

describe("side pots", () => {
  it("pays a short all-in only from the main pot", () => {
    const table = sixMax({
      stacks: [40, 1000, 1000, 1000, 1000, 1000],
    });
    table.startHand({
      holeCards: {
        0: ["Ah", "Ad"],
        1: ["Kc", "Kd"],
        2: ["7c", "2d"],
        3: ["8c", "3d"],
        4: ["9c", "4d"],
        5: ["Tc", "5d"],
      },
      communityCards: ["As", "2h", "3h", "4h", "9d"],
    });

    table.act(0, { type: ACTION.ALLIN });
    actUntil(table, 1, { type: ACTION.RAISE, amount: 200 });
    while (table.toAct !== null && table.street !== STREET.HAND_OVER) {
      const legal = table.getLegalActions(table.toAct);
      if (legal.canFold && table.toAct !== 1 && table.toAct !== 0) {
        table.act(table.toAct, { type: ACTION.FOLD });
      } else if (legal.canCall) {
        table.act(table.toAct, { type: ACTION.CALL });
      } else if (legal.canCheck) {
        table.act(table.toAct, { type: ACTION.CHECK });
      } else {
        table.act(table.toAct, { type: ACTION.FOLD });
      }
    }

    expect(table.street).toBe(STREET.HAND_OVER);
    expect(table.pots.length).toBeGreaterThan(1);
    const wonBySeat = new Map();
    for (const w of table.winners) {
      wonBySeat.set(w.seat, (wonBySeat.get(w.seat) ?? 0) + w.amount);
    }
    expect(wonBySeat.get(0)).toBeGreaterThan(0);
    expect(table.players[0].stack).toBeLessThan(table.players[1].stack);
  });
});

describe("full-hand smoke", () => {
  it("plays 20 random hands without getting stuck", () => {
    const table = sixMax({ rng: mulberry32(42), autoRebuy: true });
    for (let h = 0; h < 20; h++) {
      table.startHand();
      let steps = 0;
      while (table.toAct !== null && steps < 200) {
        const legal = table.getLegalActions(table.toAct);
        const options = [];
        if (legal.canCheck) options.push({ type: ACTION.CHECK });
        if (legal.canCall) options.push({ type: ACTION.CALL });
        if (legal.canRaise) {
          options.push({ type: ACTION.RAISE, amount: legal.minRaiseTo });
        }
        if (legal.canAllIn) options.push({ type: ACTION.ALLIN });
        if (legal.canFold && options.length === 0) options.push({ type: ACTION.FOLD });
        if (legal.canFold && table.rng() < 0.15) options.push({ type: ACTION.FOLD });
        table.act(table.toAct, options[Math.floor(table.rng() * options.length)]);
        steps += 1;
      }
      expect(table.street).toBe(STREET.HAND_OVER);
      expect(table.winners.length).toBeGreaterThan(0);
    }
  });
});

describe("heads-up blinds", () => {
  it("posts the button as SB when only two players have chips", () => {
    const table = sixMax({
      stacks: [1000, 0, 0, 0, 0, 1000],
      dealerIndex: 0,
    });
    table.startHand();
    expect(table.sbSeat).toBe(0);
    expect(table.bbSeat).toBe(5);
    expect(table.toAct).toBe(0);
  });
});
