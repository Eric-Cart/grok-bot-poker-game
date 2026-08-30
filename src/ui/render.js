import { boardHtml, holeCardsHtml } from "./cards.js";
import { chipStackHtml } from "./chips.js";

const STREET_LABEL = {
  preflop: "Preflop",
  flop: "Flop",
  turn: "Turn",
  river: "River",
  showdown: "Showdown",
  handOver: "Hand complete",
};

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function seatBadges(player) {
  const bits = [];
  if (player.isDealer) bits.push(`<span class="dealer-btn" title="Dealer">D</span>`);
  if (player.isSB) bits.push(`<span class="blind-tag">SB</span>`);
  if (player.isBB) bits.push(`<span class="blind-tag">BB</span>`);
  return bits.join("");
}

function seatHtml(player) {
  const classes = [
    `seat seat-${player.seat}`,
    player.isHuman ? "you" : "",
    player.folded ? "is-folded" : "",
    player.isToAct ? "is-acting" : "",
    player.allIn ? "is-allin" : "",
  ]
    .filter(Boolean)
    .join(" ");

  const action = player.lastAction
    ? `<div class="seat-action">${escapeHtml(player.lastAction)}</div>`
    : "";
  const bet =
    player.betThisStreet > 0
      ? `<div class="seat-bet">
          ${chipStackHtml(player.betThisStreet, { compact: true })}
          <span>${player.betThisStreet}</span>
        </div>`
      : `<div class="seat-bet empty"></div>`;

  return `
    <section class="${classes}" data-seat="${player.seat}">
      ${bet}
      <div class="seat-panel">
        ${holeCardsHtml(player.holeCards, { folded: player.folded })}
        <div class="seat-meta">
          <div class="seat-name">
            ${escapeHtml(player.name)}
            ${seatBadges(player)}
          </div>
          <div class="seat-stack">${player.stack}</div>
          ${chipStackHtml(player.stack, { compact: true, label: `${player.name} stack` })}
        </div>
      </div>
      ${action}
    </section>
  `;
}

function winnerBanner(state) {
  if (!state.handOver || !state.winners.length) return "";
  const bySeat = new Map();
  for (const w of state.winners) {
    const prev = bySeat.get(w.seat) ?? { ...w, amount: 0 };
    prev.amount += w.amount;
    prev.description = w.description;
    bySeat.set(w.seat, prev);
  }
  const lines = [...bySeat.values()]
    .map((w) => {
      const name = state.players[w.seat]?.name ?? `Seat ${w.seat}`;
      const why =
        w.handName === "uncontested"
          ? "everyone else folded"
          : w.description;
      return `<div><strong>${escapeHtml(name)}</strong> wins ${w.amount} · ${escapeHtml(why)}</div>`;
    })
    .join("");
  return `<div class="winner-banner">${lines}</div>`;
}

function actionBar(state, raiseTo) {
  if (state.handOver) {
    return `
      <div class="action-bar">
        <p class="action-hint">Next hand deals automatically.</p>
        <button type="button" class="btn primary" data-act="nexthand">Deal now</button>
      </div>
    `;
  }

  const legal = state.legalActions;
  if (!legal) {
    const actor = state.players.find((p) => p.isToAct);
    return `
      <div class="action-bar">
        <p class="action-hint">Waiting for ${escapeHtml(actor?.name ?? "the table")}…</p>
      </div>
    `;
  }

  const callLabel = legal.canCall ? `Call ${legal.callAmount}` : "Call";
  const raiseValue = Math.min(
    legal.maxRaiseTo,
    Math.max(legal.minRaiseTo, raiseTo ?? legal.minRaiseTo),
  );
  const raiseDisabled = legal.canRaise ? "" : "disabled";

  return `
    <div class="action-bar">
      <p class="action-hint">Your action · to call ${legal.toCall}</p>
      <div class="action-buttons">
        <button type="button" class="btn danger" data-act="fold" ${legal.canFold ? "" : "disabled"}>Fold</button>
        <button type="button" class="btn" data-act="check" ${legal.canCheck ? "" : "disabled"}>Check</button>
        <button type="button" class="btn" data-act="call" ${legal.canCall ? "" : "disabled"}>${callLabel}</button>
        <button type="button" class="btn warn" data-act="allin" ${legal.canAllIn ? "" : "disabled"}>All-in</button>
      </div>
      <div class="raise-row">
        <label for="raise-range">Raise to</label>
        <input id="raise-range" type="range" min="${legal.minRaiseTo}" max="${legal.maxRaiseTo}"
          step="5" value="${raiseValue}" ${raiseDisabled} />
        <input id="raise-input" type="number" min="${legal.minRaiseTo}" max="${legal.maxRaiseTo}"
          step="5" value="${raiseValue}" ${raiseDisabled} />
        <button type="button" class="btn primary" data-act="raise" ${raiseDisabled}>
          Raise to ${raiseValue}
        </button>
      </div>
    </div>
  `;
}

export function renderApp(root, { state, raiseTo }) {
  const potLabel = state.pots.length > 1 ? "Pots" : "Pot";
  const side = state.pots.length > 1
    ? state.pots.map((p, i) => `${i === 0 ? "Main" : "Side"} ${p.amount}`).join(" · ")
    : "";

  root.innerHTML = `
    <div class="shell">
      <header class="topbar">
        <div>
          <p class="eyebrow">No-limit Hold'em · play chips only</p>
          <h1>Texas Hold'em</h1>
        </div>
        <dl class="spec">
          <div><dt>Table</dt><dd>6-max</dd></div>
          <div><dt>Blinds</dt><dd>${state.blinds.small}/${state.blinds.big}</dd></div>
          <div><dt>Buy-in</dt><dd>${state.startingStack}</dd></div>
          <div><dt>Hand</dt><dd>#${state.handNumber}</dd></div>
        </dl>
      </header>

      <main class="stage">
        <div class="table-wrap">
          <div class="rail">
            <div class="felt">
              <div class="felt-center">
                <div class="street-pill">${STREET_LABEL[state.street] ?? state.street}</div>
                ${boardHtml(state.communityCards)}
                <div class="pot-well">
                  ${chipStackHtml(state.potTotal, { label: "pot" })}
                  <div class="pot-label">${potLabel} ${state.potTotal}${side ? ` · ${side}` : ""}</div>
                </div>
                ${winnerBanner(state)}
              </div>
            </div>
          </div>
          ${state.players.map(seatHtml).join("")}
        </div>
        <aside class="log" aria-label="Hand history">
          <h2>Hand log</h2>
          <ol>${state.log.map((line) => `<li>${escapeHtml(line)}</li>`).join("")}</ol>
        </aside>
      </main>

      ${actionBar(state, raiseTo)}
    </div>
  `;
}
