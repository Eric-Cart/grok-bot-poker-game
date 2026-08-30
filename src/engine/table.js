import { createDeck, formatCard, parseCard, shuffle } from "./cards.js";
import { compareEvaluations, describeHand, evaluateBestHand } from "./evaluator.js";
import { computePots, potTotal } from "./pots.js";

export const STREET = {
  PREFLOP: "preflop",
  FLOP: "flop",
  TURN: "turn",
  RIVER: "river",
  SHOWDOWN: "showdown",
  HAND_OVER: "handOver",
};

export const ACTION = {
  FOLD: "fold",
  CHECK: "check",
  CALL: "call",
  RAISE: "raise",
  ALLIN: "allin",
};

const AI_NAMES = ["River", "Oak", "Bluff", "Ace", "Nova"];

function cloneCard(card) {
  return { rank: card.rank, suit: card.suit, code: card.code ?? formatCard(card) };
}

function asCard(value) {
  return typeof value === "string" ? parseCard(value) : cloneCard(value);
}

/**
 * NLHE 6-max table: blinds, streets, legal actions, side pots, showdown.
 * UI should call getPublicState() + act() only.
 */
export class Table {
  constructor(config = {}) {
    this.seatCount = config.seatCount ?? 6;
    this.smallBlind = config.smallBlind ?? 5;
    this.bigBlind = config.bigBlind ?? 10;
    this.startingStack = config.startingStack ?? 1000;
    this.humanSeat = config.humanSeat ?? 0;
    this.rng = config.rng ?? Math.random;
    this.autoRebuy = config.autoRebuy ?? true;

    const names = config.names ?? [
      "You",
      ...AI_NAMES.slice(0, this.seatCount - 1),
    ];

    this.players = Array.from({ length: this.seatCount }, (_, seat) => ({
      seat,
      name: names[seat] ?? `Seat ${seat + 1}`,
      isHuman: seat === this.humanSeat,
      stack: config.stacks?.[seat] ?? this.startingStack,
      holeCards: [],
      betThisStreet: 0,
      contributed: 0,
      folded: false,
      allIn: false,
      hasActedThisStreet: false,
      lastAction: null,
    }));

    this.dealerIndex = config.dealerIndex ?? 3;
    this.handNumber = 0;
    this.deck = [];
    this.communityCards = [];
    this.street = STREET.HAND_OVER;
    this.currentBet = 0;
    this.lastFullRaiseSize = this.bigBlind;
    this.toAct = null;
    this.sbSeat = null;
    this.bbSeat = null;
    this.winners = [];
    this.log = [];
    this.pots = [];
  }

  startHand(overrides = {}) {
    if (this.autoRebuy) {
      for (const p of this.players) {
        if (p.stack <= 0) p.stack = this.startingStack;
      }
    }

    const live = this.players.filter((p) => p.stack > 0);
    if (live.length < 2) {
      throw new Error("Need at least two players with chips");
    }

    if (this.handNumber > 0) {
      this.dealerIndex = this.nextLiveSeat(this.dealerIndex);
    }
    this.handNumber += 1;

    this.communityCards = [];
    this.street = STREET.PREFLOP;
    this.currentBet = 0;
    this.lastFullRaiseSize = this.bigBlind;
    this.winners = [];
    this.pots = [];
    this.log = [];
    this.toAct = null;

    for (const p of this.players) {
      p.holeCards = [];
      p.betThisStreet = 0;
      p.contributed = 0;
      p.folded = p.stack <= 0;
      p.allIn = false;
      p.hasActedThisStreet = false;
      p.lastAction = p.stack <= 0 ? "sitting out" : null;
    }

    this.deck = overrides.deck
      ? overrides.deck.map(asCard)
      : shuffle(createDeck(), this.rng);

    this.dealHoleCards(overrides.holeCards);

    if (overrides.communityCards?.length) {
      this.communityCards = overrides.communityCards.map(asCard);
    }

    this.postBlinds();
    this.toAct = this.firstToActPreflop();
    this.skipAllInToAct();
    this.pushLog(
      `Hand #${this.handNumber} · dealer ${this.players[this.dealerIndex].name}`,
    );

    if (this.toAct === null || this.isBettingRoundComplete()) {
      this.advanceStreet();
    }

    return this.getPublicState(this.humanSeat);
  }

  dealHoleCards(forced) {
    const order = this.dealOrderFromDealer();
    if (forced) {
      for (const p of this.players) {
        if (p.folded) continue;
        const cards = forced[p.seat] ?? forced[String(p.seat)];
        if (cards) p.holeCards = cards.map(asCard);
      }
    }
    for (let round = 0; round < 2; round++) {
      for (const seat of order) {
        const p = this.players[seat];
        if (p.folded) continue;
        if (p.holeCards[round]) continue;
        p.holeCards[round] = this.draw();
      }
    }
  }

  dealOrderFromDealer() {
    const seats = [];
    for (let i = 1; i <= this.seatCount; i++) {
      const seat = (this.dealerIndex + i) % this.seatCount;
      if (this.players[seat].stack > 0 || this.players[seat].holeCards.length) {
        seats.push(seat);
      }
    }
    return seats;
  }

  draw() {
    if (this.deck.length === 0) throw new Error("Deck is empty");
    return this.deck.shift();
  }

  liveSeats() {
    return this.players.filter((p) => p.stack > 0 && !p.folded).map((p) => p.seat);
  }

  seatedWithChips() {
    return this.players.filter((p) => p.stack > 0).map((p) => p.seat);
  }

  nextLiveSeat(from) {
    for (let i = 1; i <= this.seatCount; i++) {
      const seat = (from + i) % this.seatCount;
      if (this.players[seat].stack > 0) return seat;
    }
    return from;
  }

  postBlinds() {
    const live = this.players
      .filter((p) => !p.folded && p.stack > 0)
      .map((p) => p.seat);
    const n = live.length;
    const dPos = live.indexOf(this.dealerIndex);
    const dealerPos = dPos >= 0 ? dPos : 0;

    if (n === 2) {
      this.sbSeat = live[dealerPos];
      this.bbSeat = live[(dealerPos + 1) % n];
    } else {
      this.sbSeat = live[(dealerPos + 1) % n];
      this.bbSeat = live[(dealerPos + 2) % n];
    }

    this.putBlind(this.sbSeat, this.smallBlind, "SB");
    this.putBlind(this.bbSeat, this.bigBlind, "BB");
    this.currentBet = Math.max(...this.players.map((p) => p.betThisStreet));
    this.lastFullRaiseSize = this.bigBlind;
  }

  putBlind(seat, amount, label) {
    const p = this.players[seat];
    const actual = Math.min(amount, p.stack);
    this.putChips(p, actual);
    p.lastAction = actual < amount ? "all-in" : label;
    this.pushLog(`${p.name} posts ${label} ${actual}`);
  }

  putChips(player, amount) {
    const actual = Math.min(amount, player.stack);
    player.stack -= actual;
    player.betThisStreet += actual;
    player.contributed += actual;
    if (player.stack === 0) player.allIn = true;
    return actual;
  }

  firstToActPreflop() {
    const live = this.players.filter((p) => !p.folded).map((p) => p.seat);
    if (live.length === 2) return this.nextActor(this.bbSeat);
    return this.nextActor(this.bbSeat);
  }

  firstToActPostflop() {
    return this.nextActor(this.dealerIndex);
  }

  nextActor(fromSeat) {
    for (let i = 1; i <= this.seatCount; i++) {
      const seat = (fromSeat + i) % this.seatCount;
      const p = this.players[seat];
      if (!p.folded && !p.allIn) return seat;
    }
    return null;
  }

  skipAllInToAct() {
    if (this.toAct === null) return;
    const p = this.players[this.toAct];
    if (p.folded || p.allIn) this.toAct = this.nextActor(this.toAct);
  }

  contenders() {
    return this.players.filter((p) => !p.folded);
  }

  isBettingRoundComplete() {
    const contenders = this.contenders();
    if (contenders.length <= 1) return true;
    const canAct = contenders.filter((p) => !p.allIn);
    if (canAct.length === 0) return true;
    for (const p of canAct) {
      if (!p.hasActedThisStreet) return false;
      if (p.betThisStreet < this.currentBet) return false;
    }
    return true;
  }

  getLegalActions(seat = this.toAct) {
    if (seat === null || seat === undefined) return null;
    if (this.street === STREET.SHOWDOWN || this.street === STREET.HAND_OVER) {
      return null;
    }
    if (this.toAct !== seat) return null;

    const p = this.players[seat];
    const toCall = Math.max(0, this.currentBet - p.betThisStreet);
    const canCheck = toCall === 0;
    const maxRaiseTo = p.betThisStreet + p.stack;
    const minRaiseTo =
      this.currentBet === 0
        ? this.bigBlind
        : this.currentBet + this.lastFullRaiseSize;
    const canFullRaise = p.stack > toCall && maxRaiseTo >= minRaiseTo;
    const callIsAllIn = toCall > 0 && toCall >= p.stack;

    return {
      canFold: true,
      canCheck,
      canCall: toCall > 0 && !callIsAllIn,
      callAmount: Math.min(toCall, p.stack),
      canRaise: canFullRaise,
      minRaiseTo,
      maxRaiseTo,
      canAllIn: p.stack > 0,
      toCall,
    };
  }

  act(seat, action) {
    if (this.toAct !== seat) {
      throw new Error("Not this player's turn");
    }
    const legal = this.getLegalActions(seat);
    if (!legal) throw new Error("No legal actions");

    const type = action.type;
    const p = this.players[seat];

    if (type === ACTION.FOLD) {
      if (!legal.canFold) throw new Error("Cannot fold");
      p.folded = true;
      p.hasActedThisStreet = true;
      p.lastAction = "fold";
      this.pushLog(`${p.name} folds`);
    } else if (type === ACTION.CHECK) {
      if (!legal.canCheck) throw new Error("Cannot check");
      p.hasActedThisStreet = true;
      p.lastAction = "check";
      this.pushLog(`${p.name} checks`);
    } else if (type === ACTION.CALL) {
      if (!legal.canCall && !(legal.canAllIn && legal.toCall > 0)) {
        throw new Error("Cannot call");
      }
      const paid = this.putChips(p, legal.toCall);
      p.hasActedThisStreet = true;
      p.lastAction = p.allIn ? "all-in" : "call";
      this.pushLog(`${p.name} ${p.allIn ? "calls all-in" : "calls"} ${paid}`);
    } else if (type === ACTION.RAISE) {
      this.applyRaise(p, legal, action.amount);
    } else if (type === ACTION.ALLIN) {
      if (!legal.canAllIn) throw new Error("Cannot go all-in");
      this.applyAllIn(p);
    } else {
      throw new Error(`Unknown action: ${type}`);
    }

    this.afterAction();
    return this.getPublicState(this.humanSeat);
  }

  applyRaise(p, legal, amount) {
    if (!legal.canRaise) throw new Error("Cannot raise");
    const raiseTo = Number(amount);
    if (!Number.isFinite(raiseTo)) throw new Error("Raise amount required");
    if (raiseTo < legal.minRaiseTo) {
      throw new Error(`Min raise is ${legal.minRaiseTo}`);
    }
    if (raiseTo > legal.maxRaiseTo) {
      throw new Error(`Max raise is ${legal.maxRaiseTo}`);
    }
    const add = raiseTo - p.betThisStreet;
    const increment = raiseTo - this.currentBet;
    this.putChips(p, add);
    this.currentBet = raiseTo;
    this.lastFullRaiseSize = increment;
    this.resetActedExcept(p.seat);
    p.hasActedThisStreet = true;
    p.lastAction = p.allIn ? "all-in" : this.street === STREET.PREFLOP && legal.toCall === 0
      ? "raise"
      : this.currentBet > 0 && legal.toCall === 0
        ? "bet"
        : "raise";
    if (legal.toCall === 0 && this.street !== STREET.PREFLOP) {
      p.lastAction = p.allIn ? "all-in" : "bet";
    } else {
      p.lastAction = p.allIn ? "all-in" : "raise";
    }
    this.pushLog(
      `${p.name} ${p.lastAction === "bet" ? "bets" : "raises to"} ${raiseTo}`,
    );
  }

  applyAllIn(p) {
    const add = p.stack;
    const newBet = p.betThisStreet + add;
    const increment = newBet - this.currentBet;
    const isRaise = newBet > this.currentBet;
    const isFullRaise = isRaise && increment >= this.lastFullRaiseSize;
    this.putChips(p, add);
    if (isRaise) {
      this.currentBet = newBet;
      if (isFullRaise) {
        this.lastFullRaiseSize = increment;
        this.resetActedExcept(p.seat);
      }
    }
    p.hasActedThisStreet = true;
    p.lastAction = "all-in";
    this.pushLog(`${p.name} is all-in (${p.contributed})`);
  }

  resetActedExcept(seat) {
    for (const q of this.players) {
      if (q.seat !== seat && !q.folded && !q.allIn) {
        q.hasActedThisStreet = false;
      }
    }
  }

  afterAction() {
    const alive = this.contenders();
    if (alive.length === 1) {
      this.awardUncontested(alive[0]);
      return;
    }
    if (this.isBettingRoundComplete()) {
      this.advanceStreet();
      return;
    }
    this.toAct = this.nextActor(this.toAct);
  }

  awardUncontested(winner) {
    const pots = this.currentPots();
    const total = potTotal(pots);
    winner.stack += total;
    this.pots = pots;
    this.winners = [
      {
        seat: winner.seat,
        amount: total,
        handName: "uncontested",
        description: `${winner.name} wins ${total} uncontested`,
      },
    ];
    this.street = STREET.HAND_OVER;
    this.toAct = null;
    this.pushLog(`${winner.name} wins ${total} uncontested`);
  }

  currentPots() {
    return computePots(
      this.players.map((p) => ({
        seat: p.seat,
        contributed: p.contributed,
        folded: p.folded,
      })),
    );
  }

  dealCommunity(count) {
    if (this.deck.length) this.draw();
    for (let i = 0; i < count; i++) {
      this.communityCards.push(this.draw());
    }
  }

  runOutBoard() {
    if (this.communityCards.length === 0) this.dealCommunity(3);
    while (this.communityCards.length < 5) this.dealCommunity(1);
  }

  resetStreetBets() {
    for (const p of this.players) {
      p.betThisStreet = 0;
      p.hasActedThisStreet = false;
      if (!p.folded && !p.allIn) p.lastAction = null;
    }
    this.currentBet = 0;
    this.lastFullRaiseSize = this.bigBlind;
  }

  shouldRunOut() {
    const alive = this.contenders();
    if (alive.length < 2) return false;
    const canAct = alive.filter((p) => !p.allIn);
    return canAct.length <= 1;
  }

  advanceStreet() {
    if (this.street === STREET.RIVER) {
      this.showdown();
      return;
    }

    this.resetStreetBets();

    if (this.street === STREET.PREFLOP) {
      if (this.communityCards.length < 3) this.dealCommunity(3);
      this.street = STREET.FLOP;
      this.pushLog(`Flop ${this.communityCards.map((c) => c.code).join(" ")}`);
    } else if (this.street === STREET.FLOP) {
      if (this.communityCards.length < 4) this.dealCommunity(1);
      this.street = STREET.TURN;
      this.pushLog(`Turn ${this.communityCards[3].code}`);
    } else if (this.street === STREET.TURN) {
      if (this.communityCards.length < 5) this.dealCommunity(1);
      this.street = STREET.RIVER;
      this.pushLog(`River ${this.communityCards[4].code}`);
    }

    if (this.shouldRunOut()) {
      this.runOutBoard();
      this.showdown();
      return;
    }

    this.toAct = this.firstToActPostflop();
    if (this.toAct === null) {
      this.runOutBoard();
      this.showdown();
    }
  }

  showdown() {
    this.street = STREET.SHOWDOWN;
    this.toAct = null;
    this.runOutBoard();
    const pots = this.currentPots();
    this.pots = pots;
    this.winners = [];

    for (const pot of pots) {
      if (pot.eligible.length === 0) continue;
      const scored = pot.eligible.map((seat) => {
        const p = this.players[seat];
        const ev = evaluateBestHand([...p.holeCards, ...this.communityCards]);
        return { seat, ev, name: p.name };
      });
      let best = scored[0].ev;
      for (const s of scored) {
        if (compareEvaluations(s.ev, best) > 0) best = s.ev;
      }
      const winners = scored.filter((s) => compareEvaluations(s.ev, best) === 0);
      const share = Math.floor(pot.amount / winners.length);
      let remainder = pot.amount - share * winners.length;
      const ordered = winners.slice().sort((a, b) => {
        const da = (a.seat - this.dealerIndex - 1 + this.seatCount) % this.seatCount;
        const db = (b.seat - this.dealerIndex - 1 + this.seatCount) % this.seatCount;
        return da - db;
      });
      for (const w of ordered) {
        const extra = remainder > 0 ? 1 : 0;
        remainder -= extra;
        const amount = share + extra;
        this.players[w.seat].stack += amount;
        this.winners.push({
          seat: w.seat,
          amount,
          potAmount: pot.amount,
          handName: w.ev.name,
          description: describeHand(w.ev),
          ranks: w.ev.ranks,
          category: w.ev.category,
        });
      }
      const names = ordered.map((w) => this.players[w.seat].name).join(" & ");
      this.pushLog(
        `${names} win${ordered.length === 1 ? "s" : ""} ${pot.amount} with ${describeHand(best)}`,
      );
    }

    this.street = STREET.HAND_OVER;
  }

  pushLog(line) {
    this.log.push(line);
    if (this.log.length > 40) this.log.shift();
  }

  /**
   * Snapshot the UI can render. Opponent hole cards stay hidden until showdown
   * (or if that player never folded and the hand is over).
   */
  getPublicState(viewerSeat = this.humanSeat) {
    const pots = this.street === STREET.HAND_OVER ? this.pots : this.currentPots();
    const reveal =
      this.street === STREET.SHOWDOWN || this.street === STREET.HAND_OVER;

    return {
      handNumber: this.handNumber,
      street: this.street,
      blinds: { small: this.smallBlind, big: this.bigBlind },
      startingStack: this.startingStack,
      dealerSeat: this.dealerIndex,
      sbSeat: this.sbSeat,
      bbSeat: this.bbSeat,
      toAct: this.toAct,
      currentBet: this.currentBet,
      potTotal: potTotal(pots),
      pots,
      communityCards: this.communityCards.map(cloneCard),
      winners: this.winners.map((w) => ({ ...w })),
      log: this.log.slice(),
      legalActions:
        viewerSeat === this.toAct ? this.getLegalActions(viewerSeat) : null,
      handOver: this.street === STREET.HAND_OVER,
      players: this.players.map((p) => {
        const showCards =
          p.seat === viewerSeat ||
          (reveal && !p.folded && p.holeCards.length === 2);
        return {
          seat: p.seat,
          name: p.name,
          isHuman: p.isHuman,
          stack: p.stack,
          betThisStreet: p.betThisStreet,
          contributed: p.contributed,
          folded: p.folded,
          allIn: p.allIn,
          lastAction: p.lastAction,
          isDealer: p.seat === this.dealerIndex,
          isSB: p.seat === this.sbSeat,
          isBB: p.seat === this.bbSeat,
          isToAct: p.seat === this.toAct,
          holeCards: showCards
            ? p.holeCards.map(cloneCard)
            : p.holeCards.map(() => null),
          revealed: showCards && p.seat !== viewerSeat,
        };
      }),
    };
  }
}
