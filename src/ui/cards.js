const SUIT = { s: "♠", h: "♥", d: "♦", c: "♣" };
const RANK = { 11: "J", 12: "Q", 13: "K", 14: "A" };
const BOARD_SLOT_LABELS = ["Flop", "Flop", "Flop", "Turn", "River"];

function rankText(rank) {
  return RANK[rank] ?? String(rank === 10 ? "10" : rank);
}

export function cardHtml(card, { hidden = false, empty = false, small = false } = {}) {
  const size = small ? "small" : "";
  if (empty) {
    return `<div class="playing-card placeholder ${size}" data-face="empty" aria-label="Empty card slot"></div>`;
  }
  if (!card || hidden) {
    return `<div class="playing-card back ${size}" data-face="down" aria-label="Facedown card"></div>`;
  }
  const red = card.suit === "h" || card.suit === "d";
  const suit = SUIT[card.suit];
  const rank = rankText(card.rank);
  return `
    <div class="playing-card face-up ${red ? "red" : "black"} ${size}" data-face="up" aria-label="${rank}${suit}">
      <span class="card-corner tl"><b>${rank}</b><i>${suit}</i></span>
      <span class="card-pip">${suit}</span>
      <span class="card-corner br"><b>${rank}</b><i>${suit}</i></span>
    </div>
  `;
}

export function holeCardsHtml(cards, { folded = false, vacant = false, hero = false } = {}) {
  const slots = [0, 1].map((i) => {
    const card = cards?.[i];
    if (vacant) return cardHtml(null, { empty: true });
    if (!card) return cardHtml(null, { hidden: true });
    return cardHtml(card);
  });
  const kind = vacant ? "vacant" : hero ? "hero" : "opponent";
  return `<div class="hole-cards ${kind} ${folded ? "folded" : ""}" data-hole="${kind}">${slots.join("")}</div>`;
}

export function boardHtml(cards = []) {
  const slots = [0, 1, 2, 3, 4].map((i) => {
    const card = cards[i];
    const label = BOARD_SLOT_LABELS[i];
    if (card) {
      return `<div class="board-slot is-filled" data-board-slot="${i}" data-filled="true">${cardHtml(card)}</div>`;
    }
    return `
      <div class="board-slot is-empty" data-board-slot="${i}" data-filled="false">
        ${cardHtml(null, { empty: true })}
        <span class="slot-label">${label}</span>
      </div>
    `;
  });
  return `<div class="board" data-board-slots="5">${slots.join("")}</div>`;
}
