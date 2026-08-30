import { chooseAiAction, createTable } from "./engine/index.js";
import { mount } from "./ui/index.js";

const root = document.querySelector("#app");
const table = createTable();

let raiseTo = null;
let aiTimer = 0;
let nextTimer = 0;

function clearTimers() {
  window.clearTimeout(aiTimer);
  window.clearTimeout(nextTimer);
}

function currentRaise(state) {
  const legal = state.legalActions;
  if (!legal?.canRaise) return null;
  return Math.min(legal.maxRaiseTo, Math.max(legal.minRaiseTo, raiseTo ?? legal.minRaiseTo));
}

function paint() {
  const state = table.getPublicState(0);
  mount(root, {
    state,
    raiseTo: currentRaise(state),
    onRaiseChange: (value) => {
      raiseTo = value;
      paint();
    },
    onAction: (action) => {
      if (table.toAct === table.humanSeat) {
        table.act(table.humanSeat, action);
        raiseTo = null;
        loop();
      }
    },
    onNextHand: () => {
      clearTimers();
      table.startHand();
      raiseTo = null;
      loop();
    },
  });
}

function loop() {
  clearTimers();
  paint();
  const state = table.getPublicState(0);

  if (state.handOver) {
    nextTimer = window.setTimeout(() => {
      table.startHand();
      raiseTo = null;
      loop();
    }, 3200);
    return;
  }

  if (state.toAct !== null && state.toAct !== table.humanSeat) {
    const seat = state.toAct;
    aiTimer = window.setTimeout(() => {
      if (table.toAct !== seat) return;
      table.act(seat, chooseAiAction(table, seat));
      loop();
    }, 550 + Math.floor(Math.random() * 650));
  }
}

table.startHand();
loop();
