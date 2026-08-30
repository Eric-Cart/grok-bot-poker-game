/** Card ranks: 2–14 (T=10, J=11, Q=12, K=13, A=14). Suits: s h d c. */

export const RANK_CHARS = "23456789TJQKA";
export const SUITS = ["s", "h", "d", "c"];
export const SUIT_SYMBOLS = { s: "♠", h: "♥", d: "♦", c: "♣" };
export const RANK_LABELS = {
  2: "2",
  3: "3",
  4: "4",
  5: "5",
  6: "6",
  7: "7",
  8: "8",
  9: "9",
  10: "T",
  11: "J",
  12: "Q",
  13: "K",
  14: "A",
};

export function rankFromChar(ch) {
  const idx = RANK_CHARS.indexOf(String(ch).toUpperCase());
  if (idx < 0) throw new Error(`Invalid rank: ${ch}`);
  return idx + 2;
}

export function parseCard(code) {
  const raw = String(code).trim();
  if (raw.length < 2) throw new Error(`Invalid card: ${code}`);
  const rank = rankFromChar(raw[0]);
  const suit = raw[1].toLowerCase();
  if (!SUITS.includes(suit)) throw new Error(`Invalid suit: ${code}`);
  return { rank, suit, code: `${RANK_LABELS[rank]}${suit}` };
}

export function formatCard(card) {
  return `${RANK_LABELS[card.rank]}${card.suit}`;
}

export function createDeck() {
  const deck = [];
  for (const suit of SUITS) {
    for (let rank = 2; rank <= 14; rank++) {
      deck.push({ rank, suit, code: `${RANK_LABELS[rank]}${suit}` });
    }
  }
  return deck;
}

export function shuffle(deck, rng = Math.random) {
  const a = deck.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function mulberry32(seed) {
  let t = seed >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let x = t;
    x = Math.imul(x ^ (x >>> 15), x | 1);
    x ^= x + Math.imul(x ^ (x >>> 7), x | 61);
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}
