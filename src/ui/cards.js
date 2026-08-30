const SUIT = { s: "♠", h: "♥", d: "♦", c: "♣" };
const RANK = { 11: "J", 12: "Q", 13: "K", 14: "A" };

function rankText(rank) {
  return RANK[rank] ?? String(rank === 10 ? "10" : rank);
}

export function cardHtml(card, { hidden = false, small = false } = {}) {
  if (!card || hidden) {
    return `<div class="playing-card back ${small ? "small" : ""}" aria-label="Facedown card"></div>`;
  }
  const red = card.suit === "h" || card.suit === "d";
  const suit = SUIT[card.suit];
  const rank = rankText(card.rank);
  return `
    <div class="playing-card ${red ? "red" : "black"} ${small ? "small" : ""}" aria-label="${rank}${suit}">
      <span class="card-corner tl"><b>${rank}</b><i>${suit}</i></span>
      <span class="card-pip">${suit}</span>
      <span class="card-corner br"><b>${rank}</b><i>${suit}</i></span>
    </div>
  `;
}

export function holeCardsHtml(cards, { folded = false } = {}) {
  const slots = [0, 1].map((i) => {
    const card = cards?.[i];
    return cardHtml(card, { hidden: !card });
  });
  return `<div class="hole-cards ${folded ? "folded" : ""}">${slots.join("")}</div>`;
}

export function boardHtml(cards) {
  const slots = [];
  for (let i = 0; i < 5; i++) {
    if (cards[i]) slots.push(cardHtml(cards[i]));
    else slots.push(`<div class="playing-card placeholder"></div>`);
  }
  return `<div class="board">${slots.join("")}</div>`;
}
