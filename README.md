# Tars Trading

iPad-first trading education platform: a hedge-fund-grade **paper trading terminal**, a full **markets academy** with interactive widgets, **Tars** — an AI mentor that teaches and critiques but never tips — and an **Agent Lab** where you design, honestly backtest, and run AI trading agents on simulated money.

**No real money, anywhere.** The PAPER/DEMO badge is permanent by design.

## Run it
```sh
brew install xcodegen   # once
xcodegen generate
open TarsTrading.xcodeproj   # build to an iPad simulator / device
```
Zero keys needed — without keys the app runs on a full synthetic market (demo broker with real order matching). Add Alpaca Paper + Massive keys via `KEYS.md` → `TarsTrading/Config/Secrets.swift` to trade against a real paper account.

Build output belongs on the LaCie drive: `xcodebuild ... -derivedDataPath /Volumes/LaCie/TarsTradingBuild/DerivedData` (see `scripts/`).

## Map
- `TarsTrading/Theme` — design tokens + motion engine (every animation flows through here)
- `TarsTrading/Services` — HTTP core, Alpaca/Massive clients, demo market+broker, Tars engines, alert engine
- `TarsTrading/Services/AgentEngine` — indicator math, backtester (in/out-of-sample honesty), paper autopilot with kill switch
- `TarsTrading/Stores` — @Observable state: trading, academy progress, agent lab, Tars, prefs
- `TarsTrading/Views` — terminal, chart, ticket, portfolio, journal, academy (+12 interactive widgets), agent lab, screener, alerts, options sandbox, settings
- `docs/` — PRD, 50-phase build plan, ship checklist, v2 roadmap

## Rules that don't bend
Paper only. Tars never says "buy X". No performance claims. Secrets never committed.
