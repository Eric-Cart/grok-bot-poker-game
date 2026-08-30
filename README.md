# Texas Hold'em

Playable no-limit Texas Hold'em in the browser. Sit down immediately — no accounts, no real money.

Locked table: **6-max**, blinds **5/10**, starting stack **1000**. You play one seat against five AI opponents.

## Run locally

```bash
npm install
npm run dev
```

Open the URL Vite prints (default `http://localhost:5173`). The first hand deals as soon as the page loads.

```bash
npm test    # engine tests
npm run build
```

## Code layout

The UI and engine are independent modules so they can ship separately.

- `src/engine/` — NLHE rules: cards, 5-card evaluator (high card through royal flush + kickers), side pots, betting state, legal actions, showdown. Public surface is `src/engine/index.js` (`createTable`, `evaluateBestHand`, `computePots`, `getPublicState`, `act`).
- `src/ui/` — oval felt table, six seats, hole/community cards, chip stacks, action bar. Renders `getPublicState()` and emits `{ type, amount? }`.
- `src/app.js` — wires engine + UI, runs AI turns, auto-deals the next hand.

Actions the engine will accept, and only when legal: `fold`, `check`, `call`, `raise` (min-raise enforced), `allin`.
