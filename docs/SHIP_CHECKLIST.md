# Tars Trading — Ship Checklist (Acts IX–X)

## Needs Abdullah (can't be done from CLI alone)
- [ ] **App Store Connect app record** for `com.tarsit.tarstrading` (name "Tars Trading" — check availability, have "Tars Trading: Learn Markets" as backup)
- [ ] **ASC API key**: issuer ID + .p8 (the Persona key BKZVRBPQ5Q should work — same team XG936GFSKZ). Export `ASC_KEY_ID`, `ASC_ISSUER_ID`, `ASC_KEY_PATH`, then run `scripts/ship-testflight.sh`
- [ ] **Alpaca paper keys + Massive key** into `TarsTrading/Config/Secrets.swift` (file exists, gitignored) to switch the app from DEMO to PAPER mode
- [ ] Optional: hosted open-weight model endpoint for Tars cloud engine (works fully offline without it)
- [ ] TestFlight beta group + invite emails

## App Review compliance notes (finance category)
- App is **educational + simulated/paper trading only**; no real-money trading, no brokerage services, no crypto wallet → avoids most 3.1.5(viii) friction
- PAPER/DEMO badge is persistent and unmistakable (hard requirement kept)
- Zero performance claims / "beat the market" language (audited in Act IV/IX passes)
- Disclosures screen in Settings: simulated results ≠ future returns; not investment advice; Tars is software
- Age rating: 4+ content but set **17+ / frequent simulated gambling? NO** — simulated *trading* is not gambling; expect 4+ with finance topics. If reviewer pushes back, cite education category precedent (Investopedia sim, TradingView paper)
- Privacy nutrition label: no data collected off-device in demo mode (journal/progress stay local); update if analytics ever added

## Store listing (draft)
- **Subtitle:** Learn markets. Train AI agents. Paper trade like a pro.
- **Promo text:** The terminal that teaches. Hedge-fund-grade paper trading, a full markets academy, and AI agents you design, backtest honestly, and set loose on simulated money.
- **Keywords:** paper trading,learn investing,stock simulator,options,trading academy,AI trading,backtest
- Screenshots: workspace (Trade preset), chart w/ crosshair, payoff builder widget, agent card + kill switch, backtest honesty line, journal. iPad Pro 13" frames, dark.

## Known deferred items (v2 candidates — see BUILD_PLAN_V2.md)
- WidgetKit home-screen widgets + Live Activities (needs extension target)
- On-device MLX Tars engine (protocol ready; CloudTarsEngine ships behind config)
- Alpaca real options paper endpoints (sandbox book ships in v1)
- Watch app, localization beyond RTL-ready layouts
- Live-money trading: **explicitly out** — requires broker entitlements + regulatory work (managing others' money = RIA/fund registration)
