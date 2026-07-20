# Tars Trading — 50-Phase Build Plan (v1.0, 2026-07-19)

**Mission:** the most beautiful, most educational trading platform ever shipped on iPad — a hedge-fund-grade terminal where anyone, from total beginner to quant, learns every financial instrument, then trains their own AI agents to trade for them (paper first, always safe, always honest).

**Non-negotiables (inherited from CLAUDE.md):**
- Paper trading until explicitly gated otherwise; PAPER/LIVE state visually unmistakable at all times.
- Tars (and every agent) explains, teaches, critiques — never directive advice, never performance claims.
- Secrets never committed. Small, compiling, reviewable commits.
- Design bar: Apple Design Award level. Dark-first, 120Hz, color = meaning.

**Cadence:** each phase ends with the app compiling, runnable, and demo-able. Phases are ~0.5–3 days each. Ten acts, five phases each.

---

## Act I — Foundation & Design DNA (Phases 1–5)

**1. Project scaffold + theme kernel.**
Xcode project (iPadOS 17+, SwiftUI, @Observable), folder layout per CLAUDE.md, `Secrets.swift` template + gitignore audit. `TarsTheme`: full color system (semantic P&L green/red, mode colors, 4 elevation surfaces), SF Pro + monospaced numerics type scale, spacing grid, corner/shadow tokens.
*Done when:* app launches to a themed empty shell; theme showcase debug screen renders every token.

**2. Motion engine.**
A first-class animation layer: spring presets (snappy/fluid/molasses), shared `PhaseAnimator`/`KeyframeAnimator` wrappers, number-ticker (odometer-style rolling digits for prices/P&L), shimmer/skeleton loaders, haptics service (impact map for fills, alerts, errors). Every later phase consumes this — no ad-hoc animation code.
*Done when:* motion gallery screen demos every primitive at 120Hz with zero dropped frames in Instruments.

**3. Networking core + resilience.**
Generic async/await HTTP client: retry with jitter, 429-aware backoff (Massive free tier = 5 req/min), response caching layer (memory + disk), reachability, request coalescing. Typed error surface for UI.
*Done when:* unit tests cover 429/timeout/decode failure; cache demonstrably prevents duplicate calls.

**4. Alpaca Paper + Massive clients.**
`AlpacaClient` (account, positions, orders, clock/calendar) and `MarketDataClient` (quotes, aggregates/bars, tickers, reference data). DTOs → domain models (Account, Position, Order, Quote, Bar). Sandbox smoke-test target.
*Done when:* a debug screen shows live paper account equity + a real quote fetched through the cache.

**5. TradingStore + app skeleton.**
`@Observable` TradingStore (single source of truth: account, positions, orders, watchlist, quotes), optimistic-update + reconciliation pattern, `RootView` with adaptive iPad layout (NavigationSplitView + floating panels), ModeBanner (the PAPER badge — animated, glowing, impossible to miss).
*Done when:* cold launch → themed workspace with real paper account data in < 2s.

## Act II — The Terminal (Phases 6–10)

**6. Watchlist, quotes & the living screen.**
Watchlist CRUD (persisted), quote rows with rolling-digit tickers, micro-sparklines, staleness indicators (EOD data honesty — show data age, never fake liveness). Pull-to-refresh choreography.
*Done when:* watching AAPL/BTC rows feels alive; data age is always visible.

**7. ChartView v1 — Swift Charts candles.**
Candlesticks + volume, timeframe switcher (1D→5Y) with animated interpolation between ranges, crosshair with magnetic scrubbing + haptic ticks, long-press inspect callout (OHLCV card).
*Done when:* scrubbing a 5Y chart is butter at 120Hz.

**8. ChartView v2 — pro overlays.**
SMA/EMA/VWAP/Bollinger overlays with animated draw-in, RSI/MACD sub-panes, drawing tools (trendline, horizontal level, fib retracement) with snap + persistence per symbol.
*Done when:* a saved chart layout restores exactly after relaunch.

**9. Symbol page.**
Company/asset profile, key stats grid with animated counters, news placeholder, related education chips ("What is market cap?" → deep-links into Academy), fundamentals laid out like a terminal, not a table dump.
*Done when:* tapping any symbol anywhere lands here in one animated transition (matched geometry).

**10. Workspace system.**
Multi-panel iPad workspace: draggable/resizable panels (chart, watchlist, positions, Tars), layout presets ("Learn", "Trade", "Monitor"), state persistence, Stage Manager + external display sanity.
*Done when:* user can rebuild a Bloomberg-style 4-panel layout and it survives relaunch.

## Act III — Paper Trading Core (Phases 11–15)

**11. Order ticket v1.**
Market/limit ticket as a cinematic sheet: big type, drag-to-set quantity with haptic detents, estimated cost/impact preview, explicit PAPER stamp on the confirm button, order submission with optimistic fill states.
*Done when:* placing a paper market order feels like the best-designed checkout on iOS.

**12. Order ticket v2 + order management.**
Stop, stop-limit, trailing stop, bracket orders (with visual TP/SL handles drawn ON the chart), GTC/day TIF, open-orders panel with cancel/replace, animated order-lifecycle timeline (accepted → filled) driven by polling the paper API respectfully.
*Done when:* a bracket order's TP/SL levels are draggable on the chart and sync to Alpaca.

**13. Positions & P&L theater.**
Positions panel: per-position cards with live-ish P&L tickers, cost basis, day vs. total, animated close-position flow (slide-to-close with confirmation). Account header: equity curve mini-chart, buying power, margin readout.
*Done when:* P&L changes animate meaningfully (color pulse + ticker roll), never chaotically.

**14. Portfolio analytics.**
Equity curve (Swift Charts, animated draw), allocation donut with exploding segments, exposure by sector/asset class, basic risk stats (max drawdown, volatility, beta vs SPY) each with a "what is this?" education hook.
*Done when:* every stat on screen is tappable and explains itself.

**15. Trade journal (auto).**
Every fill auto-journaled: entry/exit, thesis prompt ("why did you take this?"), screenshots of chart at entry, outcome tagging. Journal timeline view with streaks. This becomes training data for Tars's critiques AND for agent training later.
*Done when:* closing a trade prompts a 10-second thesis capture and it appears in the journal.

## Act IV — Design: Out of This World (Phases 16–20)

**16. Signature launch + identity.**
App icon set, animated launch sequence (constellation forming the Tars mark → dissolves into workspace), onboarding hero screens with parallax starfield. Original Tars mascot design language locked (NO Interstellar resemblance — legal).
*Done when:* first launch gives goosebumps; icon survives App Store review guidelines.

**17. Transitions & spatial continuity.**
Matched-geometry everywhere: watchlist row → symbol page → chart fullscreen are one continuous object. Custom navigation transitions, sheet choreography, contextual zoom. No default slide-ins anywhere in primary flows.
*Done when:* a full session can be screen-recorded and every transition looks intentional.

**18. Data-visualization art pass.**
Chart gradients/glow tuned per theme, P&L "aurora" background tint that subtly shifts with portfolio state, heatmap view of watchlist, depth-of-field blur layering for panel focus. Restraint pass: color only where it means something.
*Done when:* screenshots are indistinguishable from concept art.

**19. Sound & haptic identity.**
Optional, mixable sound design: fill chime, alert tones, Tars voice blips; haptic score for order lifecycle. Full mute + reduce-motion + reduce-transparency compliance from day one.
*Done when:* the app is delightful with sound on, perfect with it off, and respects every accessibility toggle.

**20. Design QA gauntlet #1.**
Frame-rate audit (Instruments), dynamic type sweep, all-orientations sweep, light-mode (secondary but shippable), empty/error/loading states designed for every screen. Fix list burned to zero.
*Done when:* zero screens have an undesigned state.

## Act V — Academy: Every Instrument, Every Human (Phases 21–27)

**21. Academy engine.**
Curriculum data model (tracks → courses → lessons → interactive widgets → quizzes), progress persistence, XP/streak system (tasteful, not casino), adaptive path chooser: "I'm brand new" → "I trade already" → "I'm a quant."
*Done when:* a lesson renders from data with interactive widget slots.

**22. Track 1: Market foundations.**
What a market is, exchanges, tickers, order books, bid/ask, order types (interactive: a playable mini order book where you place orders against simulated flow), market/limit visualized with animation, settlement, corporate actions.
*Done when:* the playable order book teaches bid/ask better than any book.

**23. Track 2: Equities & ETFs deep dive.**
Valuation basics, market cap, indices, ETFs vs mutual funds, dividends (interactive dividend timeline), splits, earnings, reading fundamentals — each concept linked live to real symbols in the terminal.
*Done when:* every stat on the symbol page deep-links to its lesson.

**24. Track 3: Options — the crown jewel.**
Calls/puts with an interactive payoff-diagram builder (drag strikes, watch P&L curves morph), the Greeks animated (delta as slope, theta as melting ice), spreads/straddles/condors constructed visually, assignment/exercise, IV explained with a volatility playground.
*Done when:* payoff builder handles 4-leg strategies with animated Greeks readout.

**25. Track 4: Crypto, futures, FX, fixed income.**
Crypto mechanics (custody, 24/7 markets, on-chain basics), futures (contracts, margin, contango — animated term-structure widget), FX pairs and carry, bonds/yield curves (interactive yield-curve sculptor), commodities. Futures/FX/bonds are education-first (trading comes when brokers do).
*Done when:* the yield-curve sculptor makes inversion click for a beginner.

**26. Track 5: Risk, psychology, and how funds actually work.**
Position sizing (interactive Kelly/fixed-fraction sandbox), drawdown math, diversification, leverage dangers (simulator that lets you blow up a fake account safely), hedge-fund structures (long/short, market-neutral, global macro, quant), fees, why most traders lose — radical honesty as a feature.
*Done when:* the "blow up an account" simulator is both terrifying and clarifying.

**27. Learn-by-doing bridges.**
Every lesson ends in a real paper-trading mission ("place a limit buy 2% below market; journal why"). Mission verification against actual account activity, XP awards, Tars debriefs each mission using the journal entry.
*Done when:* curriculum and terminal are one loop, not two tabs.

## Act VI — Tars, the AI Mentor (Phases 28–32)

**28. TarsEngine protocol + chat UI.**
Protocol-based engine (swap on-device/cloud later), streaming token UI with elegant typing animation, Tars personality system prompt (dry wit, radically honest, never directive), guardrail layer that hard-blocks directive-advice phrasing and performance claims at the output boundary.
*Done when:* chat UI streams beautifully with a stub engine; guardrail tests pass.

**29. Cloud engine v1.**
Wire a hosted open-weight model endpoint (config-driven, key in Secrets), context assembly: current screen, symbol, positions, recent journal. Cost/latency budget + response cache.
*Done when:* "Tars, what am I looking at?" answers correctly about the live screen.

**30. On-device engine (MLX/Core ML) exploration.**
Benchmark a small open-weight model on-device for offline Q&A and journal critique; automatic engine selection (on-device for private/light tasks, cloud for heavy). Graceful degradation.
*Done when:* airplane-mode Tars can still explain a concept and critique a journal entry.

**31. Tars as teacher & critic.**
Lesson-aware tutoring (Socratic mode: answers with questions first), trade debriefs ("your thesis said X, price action said Y — what would falsify your idea sooner?"), weekly portfolio review letter, generated from journal + analytics, in Tars's voice.
*Done when:* the weekly letter is good enough to screenshot and share.

**32. Tars everywhere.**
Contextual Tars button on every panel (explain this chart pattern, this Greek, this drawdown), proactive-but-polite nudges engine (rate-limited, user-tunable, never nagging), full conversation history with search.
*Done when:* Tars feels like a colleague in the room, not a chatbot in a drawer.

## Act VII — Agent Lab: Train AI to Trade for You (Phases 33–39)

**33. Strategy representation.**
`TradingAgent` model: universe, signals, entry/exit rules, risk limits (max position, max drawdown kill-switch, daily loss cap — mandatory, not optional), schedule. Serializable, versioned, explainable ("agent card" that states its logic in plain English).
*Done when:* an agent's full behavior is readable by a beginner on its card.

**34. Backtest engine v1.**
Event-driven backtester over cached Massive EOD bars: fills with slippage/commission models, equity curve, stats (CAGR, Sharpe, max DD, win rate, exposure). Honest-by-design: overfitting warnings, out-of-sample split enforced in UI.
*Done when:* a moving-average-cross agent backtests over 5y with in/out-of-sample results shown separately.

**35. Strategy Lab UI.**
Visual strategy builder: drag signal blocks (MA cross, RSI threshold, breakout, volatility filter) onto a canvas, wire conditions, set risk panel (always visible, always mandatory). Animated backtest playback — watch the agent trade across history like a film with scrubber.
*Done when:* a beginner builds and backtests an agent in under 5 minutes without docs.

**36. Paper autopilot.**
Agents run against the Alpaca paper account: scheduler respecting market hours + rate limits, every agent order tagged & journaled with its reasoning snapshot, PAPER-AGENT badge on all agent activity, kill switch (one giant red button; also automatic on risk-limit breach). Multiple agents with capital allocation between them.
*Done when:* an agent trades paper for a full week unattended; every trade is explainable after the fact.

**37. Agent training loop.**
Parameter optimization (walk-forward, not naive grid-overfit), Tars-assisted iteration ("your agent overtrades in chop — consider a volatility filter"), A/B agent tournaments on paper capital, agent leaderboard vs. buy-and-hold benchmark shown honestly.
*Done when:* the improve→retest→redeploy loop is a single flow with overfitting guardrails.

**38. Fund mode — your personal (paper) hedge fund.**
Portfolio-of-agents dashboard styled like an LP report: strategy sleeves, correlation matrix between agents, aggregate risk (VaR-lite, exposure netting), monthly tear-sheet generation (PDF export). Education track 6 unlocks alongside: "How to think like an allocator."
*Done when:* the tear-sheet PDF looks like it came from a real fund's ops team — stamped PAPER.

**39. Agent safety & honesty audit.**
Red-team pass: ensure agents can't exceed risk limits under any code path, chaos tests (API down mid-order, partial fills, stale data), all UX copy audited against no-performance-claims rule, disclosure screens ("simulated results ≠ future returns") designed beautifully, not buried.
*Done when:* chaos suite passes; legal-copy checklist signed off.

## Act VIII — Depth & Breadth (Phases 40–44)

**40. Options paper trading.**
Alpaca paper options: chain UI (strikes ladder with animated IV skew visualization), single-leg + vertical spreads through the same cinematic ticket, position Greeks aggregation in portfolio, Academy Track 3 missions go live-fire (paper).
*Done when:* buy a paper call spread from the payoff builder in two taps.

**41. Crypto depth.**
24/7 handling (UI states for stocks closed/crypto open), crypto-specific education inline, crypto agents with weekend scheduling, portfolio views that don't pretend crypto has a closing bell.
*Done when:* Sunday-night crypto agent trades work flawlessly.

**42. Screeners & discovery.**
Screener builder (fundamental + technical filters) with animated result reordering, preset screens ("quality dividend", "high momentum" — each with a lesson on what the screen assumes and its failure modes), screener → watchlist → agent-universe pipeline.
*Done when:* a screener result can become an agent's trading universe in one tap.

**43. Alerts & notifications.**
Price/indicator/news alerts, agent-event pushes (fill, risk-limit hit, kill-switch), Tars daily brief notification (markets recap in his voice), all through a notification preferences center that defaults quiet.
*Done when:* alerts arrive fast and are individually mutable.

**44. Widgets, Live Activities, watchOS seed.**
Lock-screen/home widgets (portfolio, watchlist, agent status), Live Activity for an in-flight agent session or bracket order, minimal watchOS glance app. All honoring PAPER badging even at widget size.
*Done when:* Dynamic Island shows an agent's live paper session.

## Act IX — For All Kinds of People (Phases 45–47)

**45. Accessibility as a flagship feature.**
Full VoiceOver pass with custom chart audio-graphs (Apple's audio graph API — hear the equity curve), Switch Control, color-blind safe P&L palettes (shape + color dual encoding), reduced-motion complete parity, localization scaffold (RTL-ready layouts).
*Done when:* a blind user can hear a chart, place a paper trade, and query Tars end-to-end.

**46. Modes for every human.**
Simple Mode (big buttons, essential info, guided flows — grandma-proof) vs Pro Mode (dense terminal) — one toggle, same data, per-panel overrides. Kids/teen education mode (Academy-only, no trading, parental note). Font-scale extremes designed, not just supported.
*Done when:* the same app demos convincingly to a 15-year-old, a retiree, and a quant.

**47. Performance & scale hardening.**
Launch < 1.5s, memory audit with 500-symbol watchlists, chart with 10y minute-data downsampling strategy, cache eviction policy, battery audit for autopilot sessions, offline mode (cached everything + on-device Tars).
*Done when:* Instruments dashboards green across all budgets on a base iPad Air.

## Act X — Ship It (Phases 48–50)

**48. Beta program.**
TestFlight pipeline (mirror Persona's: archive on LaCie, CLI upload), crash/analytics (privacy-first, opt-in), in-app feedback with screenshot annotation, beta cohort onboarding (friends → 100 users), feedback triage board.
*Done when:* build is on 25+ devices with crash-free rate > 99.5%.

**49. App Store launch package.**
Product page (screenshots that look like movie posters, app preview video with the motion engine starring), review-guideline compliance audit (finance app rules, simulated-trading disclosures, age rating), privacy nutrition labels, press kit + landing page on Railway (like persona-web).
*Done when:* submitted for review with zero known guideline risks.

**50. Launch + the road to live.**
Ship v1.0. Post-launch war room (crash triage SLA, review responses in Tars's polite-human voice). Then open the *next* 50: live trading gating research (KYC, broker agreements, entitlements, the regulatory reality that "your own hedge fund" for others' money = RIA/fund registration — v1 stays your-money-your-account), Android (the CLOUD_DATA_MODEL playbook), and Tars v2.
*Done when:* v1.0 is live, stable, and the v2 plan exists as `docs/BUILD_PLAN_V2.md`.

---

## Sequencing notes

- **Critical path:** 1→5 (foundation) → 6–15 (terminal + paper trading) unblocks everything; Acts V–VII can then interleave.
- **Parallelizable:** Academy content (21–27) can be written while Acts III–IV are built; design passes (16–20) overlap terminal work.
- **External dependencies:** Alpaca paper options availability (40), Massive rate-tier upgrade decision (~Phase 34, backtesting needs bar history — budget for a paid tier or aggressive caching), hosted model endpoint choice (29).
- **Honesty architecture is load-bearing:** phases 15 (journal), 34 (out-of-sample), 37 (walk-forward), 39 (audit) are what make "best hedge fund there is" a credible claim instead of a dangerous one. They don't get cut.
