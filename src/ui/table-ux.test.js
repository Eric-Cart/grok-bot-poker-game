import { describe, expect, it } from "vitest";
import { boardHtml, holeCardsHtml } from "./cards.js";
import { SEAT_COUNT, seatsHtml } from "./render.js";

describe("table UX review", () => {
  it("shows hero hole cards face-up and opponents face-down", () => {
    const hero = holeCardsHtml(
      [
        { rank: 14, suit: "s", code: "As" },
        { rank: 13, suit: "h", code: "Kh" },
      ],
      { hero: true },
    );
    expect(hero).toContain('data-hole="hero"');
    expect(hero.match(/data-face="up"/g)).toHaveLength(2);
    expect(hero).not.toContain('data-face="down"');

    const opp = holeCardsHtml([null, null]);
    expect(opp).toContain('data-hole="opponent"');
    expect(opp.match(/data-face="down"/g)).toHaveLength(2);
    expect(opp).not.toContain('data-face="up"');
  });

  it("always renders 5 board slots, including empty placeholders", () => {
    const preflop = boardHtml([]);
    expect(preflop).toContain('data-board-slots="5"');
    expect(preflop.match(/data-board-slot="/g)).toHaveLength(5);
    expect(preflop.match(/is-empty/g)).toHaveLength(5);
    expect(preflop).toContain("Turn");
    expect(preflop).toContain("River");

    const flop = boardHtml([
      { rank: 2, suit: "h", code: "2h" },
      { rank: 7, suit: "d", code: "7d" },
      { rank: 9, suit: "c", code: "9c" },
    ]);
    expect(flop.match(/data-filled="true"/g)).toHaveLength(3);
    expect(flop.match(/data-filled="false"/g)).toHaveLength(2);
  });

  it("keeps all 6 seats on the oval when some are unoccupied", () => {
    const html = seatsHtml([
      {
        seat: 0,
        name: "You",
        isHuman: true,
        stack: 1000,
        holeCards: [
          { rank: 14, suit: "s" },
          { rank: 13, suit: "s" },
        ],
        occupied: true,
      },
      {
        seat: 2,
        name: "Oak",
        isHuman: false,
        stack: 1000,
        holeCards: [null, null],
        occupied: true,
      },
    ]);
    expect(html.match(/data-seat="/g)).toHaveLength(SEAT_COUNT);
    expect(html.match(/data-occupied="false"/g)).toHaveLength(4);
    expect(html.match(/data-occupied="true"/g)).toHaveLength(2);
    expect(html).toContain("is-empty");
    expect(html).toMatch(/Empty/);
    expect(html).not.toContain("display: none");
  });
});
