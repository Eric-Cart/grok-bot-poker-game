import { describe, expect, it } from "vitest";
import { parseCard } from "./cards.js";
import {
  CATEGORY,
  compareEvaluations,
  describeHand,
  evaluateBestHand,
  evaluateFive,
} from "./evaluator.js";

const C = (...codes) => codes.map(parseCard);

describe("evaluateFive", () => {
  it("ranks royal flush above straight flush", () => {
    const royal = evaluateFive(C("As", "Ks", "Qs", "Js", "Ts"));
    const sf = evaluateFive(C("9h", "8h", "7h", "6h", "5h"));
    expect(royal.category).toBe(CATEGORY.ROYAL_FLUSH);
    expect(sf.category).toBe(CATEGORY.STRAIGHT_FLUSH);
    expect(compareEvaluations(royal, sf)).toBeGreaterThan(0);
  });

  it("treats the wheel as 5-high straight", () => {
    const wheel = evaluateFive(C("Ah", "2c", "3d", "4s", "5h"));
    const sixHigh = evaluateFive(C("6c", "5d", "4h", "3s", "2c"));
    expect(wheel.category).toBe(CATEGORY.STRAIGHT);
    expect(wheel.ranks[0]).toBe(5);
    expect(compareEvaluations(sixHigh, wheel)).toBeGreaterThan(0);
  });

  it("uses kickers for pairs", () => {
    const better = evaluateFive(C("Ah", "Ad", "Kc", "9s", "2h"));
    const worse = evaluateFive(C("As", "Ac", "Qd", "9h", "2c"));
    expect(better.category).toBe(CATEGORY.PAIR);
    expect(compareEvaluations(better, worse)).toBeGreaterThan(0);
  });

  it("uses the higher pair, then kicker, for two pair", () => {
    const a = evaluateFive(C("Kh", "Kd", "3c", "3s", "Ah"));
    const b = evaluateFive(C("Ks", "Kc", "3d", "3h", "Qh"));
    expect(a.category).toBe(CATEGORY.TWO_PAIR);
    expect(compareEvaluations(a, b)).toBeGreaterThan(0);
  });

  it("ranks full house over flush", () => {
    const boat = evaluateFive(C("Ah", "Ad", "Ac", "2s", "2h"));
    const flush = evaluateFive(C("Ks", "Js", "9s", "7s", "3s"));
    expect(compareEvaluations(boat, flush)).toBeGreaterThan(0);
  });

  it("ranks quads over full house", () => {
    const quads = evaluateFive(C("9h", "9d", "9c", "9s", "2h"));
    const boat = evaluateFive(C("Ah", "Ad", "Ac", "Ks", "Kh"));
    expect(compareEvaluations(quads, boat)).toBeGreaterThan(0);
  });

  it("breaks quads with the kicker", () => {
    const aceKicker = evaluateFive(C("8h", "8d", "8c", "8s", "Ah"));
    const kingKicker = evaluateFive(C("8h", "8d", "8c", "8s", "Kh"));
    expect(compareEvaluations(aceKicker, kingKicker)).toBeGreaterThan(0);
  });

  it("ranks high-card kickers in order", () => {
    const a = evaluateFive(C("Ah", "Kd", "7c", "4s", "2h"));
    const b = evaluateFive(C("As", "Kc", "7d", "4h", "3c"));
    expect(a.category).toBe(CATEGORY.HIGH_CARD);
    expect(compareEvaluations(b, a)).toBeGreaterThan(0);
  });
});

describe("evaluateBestHand (7-card)", () => {
  it("picks the best five from hole + board", () => {
    const ev = evaluateBestHand(
      C("Ah", "Kh", "Qh", "Jh", "2c", "3d", "Th"),
    );
    expect(ev.category).toBe(CATEGORY.ROYAL_FLUSH);
  });

  it("does not play a sixth kicker", () => {
    const a = evaluateBestHand(C("Ah", "Kd", "Qs", "Jh", "9c", "2d", "3h"));
    const b = evaluateBestHand(C("As", "Kc", "Qd", "Jc", "9s", "2h", "8d"));
    expect(a.ranks).toEqual([14, 13, 12, 11, 9]);
    expect(compareEvaluations(a, b)).toBe(0);
  });

  it("describes a made hand", () => {
    const ev = evaluateFive(C("Ah", "Ad", "Kc", "Ks", "2h"));
    expect(describeHand(ev)).toBe("Two Pair, Aces and Kings");
  });
});
