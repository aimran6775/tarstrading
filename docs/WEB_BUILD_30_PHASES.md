# Tars Trading — Web Platform, 30 Phases

**Pivot:** the product moves from iPadOS to the web (tarstrading.com). Multi-user,
simulated-money trading with real market data, the full Academy, and
user-programmable AI agents. The iOS app remains in the repo as reference; all
new product work happens in `web/`.

**The brief:** anyone can join, get **$100,000 simulated**, learn everything about
markets with an AI mentor, and deploy as many trading agents as they want —
agents do *exactly* what the user programs, at user level. Fast (no perceptible
latency), professional, dramatic and elegant — an Apple-launch-page marketing
surface wrapping a pro terminal. Dark AND light mode, premium color, animation,
3D. Full frontend and backend.

## Stack (settled)
- **Next.js 15 (App Router) + TypeScript** — one repo, one deploy, API routes as backend
- **Tailwind CSS v4** with a custom token layer (the web port of TarsTheme)
- **Framer Motion** for the motion system; **react-three-fiber** for the hero 3D orb
- **lightweight-charts** (TradingView OSS) for candles — the professional standard
- **SQLite via Drizzle ORM** for dev (swap to Postgres at deploy), server-side only
- **Cookie sessions + scrypt** password hashing — no third-party auth dependency
- **Market data:** Massive API proxied server-side ONLY (key never ships to client),
  aggressive caching + token-bucket rate limiting (free tier: 5 req/min)
- **Broker:** our own simulated exchange server-side (port of DemoBroker):
  market/limit/stop orders, slippage model, $100k on signup — every user isolated
- **Agents:** server-side rule engine (port of AgentRunner/Backtester/IndicatorMath):
  SMA/EMA/RSI/crosses, per-user agents, kill switch, honest backtests (70/30 split)

## Hard rules (carried over)
- PAPER/simulated state visually unmistakable on every screen
- Tars never gives directive advice; no performance claims anywhere
- Secrets server-side only; `.env*` gitignored
- Color is meaning: green/red = P&L, amber = simulated badge, blue = interactive, purple = agents

---

## Act I — Foundation (1–6)
1. **Scaffold + repo shape** — `web/` Next.js app, TS strict, ESLint, folder architecture (`app/`, `lib/`, `components/`, `server/`), env plumbing, README.
2. **Design tokens** — the TarsTheme port: P3-ish premium palette via CSS `color-mix`/OKLCH, dark-first with a real light theme, type ramp (Inter + JetBrains Mono for numerals), spacing/radius/motion tokens, `prefers-color-scheme` + manual toggle.
3. **Database + models** — Drizzle schema: users, sessions, accounts (cash/equity), positions, orders, fills, watchlists, agents, agent_runs, journal, lesson_progress, equity_history.
4. **Auth** — signup/login (scrypt + httpOnly cookie sessions), $100k account seeded on signup, middleware guards, rate limiting.
5. **Market data service** — server-side Massive client: quotes (prev-close), bars (aggs), crypto `X:` ticker mapping, token-bucket limiter, layered cache (memory), staleness metadata on every payload.
6. **Simulated exchange** — order lifecycle (accepted → filled/rejected/canceled), market/limit/stop, slippage + commission model, buying-power checks, position blending, equity marking; deterministic and unit-tested.

## Act II — Marketing surface (7–10)
7. **Landing hero** — the dramatic open: 3D Tars orb (react-three-fiber), scroll-driven scenes, headline typography, dark/light both stunning. Apple-launch energy.
8. **Feature scenes** — scroll-through sections: the terminal, the Academy, the Agent Lab, honesty-first backtesting; each with live-feeling motion mockups.
9. **Signup flow** — the $100k moment: join → account funds animate in ($0 → $100,000 roll) → straight into the terminal.
10. **Disclosures & trust** — simulated-money disclosure page, education-not-advice language, footer, privacy page.

## Act III — The terminal (11–17)
11. **App shell** — authenticated layout: nav rail, command palette (⌘K), SIMULATED badge always visible, theme toggle, account strip (equity ticker).
12. **Watchlist + quotes** — live quote table (polling with etag/cadence tuned to free tier), staleness labels, add/remove/reorder symbols, sparklines.
13. **Chart** — lightweight-charts integration: candles/line, timeframes, volume, crosshair, last-price line, market-closed banner; chart setup persists.
14. **Order ticket** — buy/sell, market/limit/stop, qty stepper, est. cost vs buying power meter, **hold-to-submit** (the signature interaction, ported), fill choreography, order status stream.
15. **Positions & orders** — live P&L rows, close position flow, open-order management with cancel.
16. **Portfolio** — equity hero + curve (equity_history), allocation bar, day/all-time P&L, journal strip.
17. **Symbol pages** — /s/AAPL: chart, stats grid, position card, trade CTA.

## Act IV — Academy + Tars (18–22)
18. **Curriculum engine** — lesson schema (sections, key ideas, quizzes), progress + XP server-side, track home with progress rings.
19. **Content port wave 1** — Tracks 1–2 (foundations, market mechanics) ported from the iOS curriculum.
20. **Interactive widgets** — order-book sim, payoff builder, risk sliders as React components inside lessons.
21. **Tars chat** — mentor panel: streaming chat UI, scripted engine with market context (positions, visible symbol), LLM endpoint pluggable via env; never directive.
22. **Content port wave 2** — Tracks 3–6 (risk, options, macro, agents).

## Act V — Agent Lab (23–27)
23. **Agent builder** — visual rule editor (IF indicator × comparator × value/indicator), universe picker, allocation slider, plain-English thesis rendering.
24. **Backtester** — server-side against Massive EOD bars: fills w/ slippage, equity curve, CAGR/Sharpe/max-DD, **70/30 in/out-of-sample honesty split** rendered as first-class UI.
25. **Agent runtime** — scheduler evaluating rules on quote refresh; orders tagged by agent; activity feed narrating every decision; per-agent allocation limits.
26. **Kill switch + guardrails** — deliberate hold-to-kill, auto-halt on drawdown breach, paused/killed/draft lifecycle.
27. **Fund mode** — multi-agent overview: sleeves, aggregate curve, per-agent contribution.

## Act VI — Polish & launch (28–30)
28. **Performance pass** — route-level code splitting, RSC-first data flow, chart virtualization, Lighthouse ≥ 95 perf/a11y, zero layout shift, image/3D lazy loading.
29. **The gauntlet** — dark/light × mobile/desktop sweep, keyboard-only pass, empty/loading/error states everywhere, reduced-motion variants of all animation.
30. **Deploy readiness** — Postgres migration path, env docs, Dockerfile/Vercel config, seed script, tarstrading.com checklist.

## Sequencing
Acts land as commits per phase-group; the app must run (`npm run dev`) after every
commit. Phases 5–6 (data + exchange) unblock everything in Act III; the marketing
surface (Act II) can proceed in parallel visually but ships after auth works.
