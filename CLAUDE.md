# CLAUDE.md — Tars Trading

## What this is
iPad-first iOS trading app: hedge-fund-grade education + paper trading that mimics a live professional terminal + "Tars," an AI trading mentor built on an open-weight model. Full spec in `docs/PRD_Tars_Trading_v0.2.md` — read it before large tasks.

## Current phase
Phase 1 MVP, local-first architecture:
- SwiftUI iPadOS app (iPadOS 17+), dark-mode-first, built for Apple Design Award-level polish
- NO backend yet — app talks directly to Alpaca Paper API and Massive (Polygon) market data
- Paper trading ONLY, but the UX mimics a live pro terminal (with an unmistakable PAPER badge — this is a hard safety requirement)
- US equities + crypto first; options next; futures later (needs non-Alpaca broker)

## Tech decisions (settled — don't relitigate without asking)
- Swift / SwiftUI / Swift Charts / @Observable (iOS 17+), async/await networking, no third-party dependencies unless clearly justified
- Trading API: Alpaca Paper — base `https://paper-api.alpaca.markets/v2`, auth headers `APCA-API-KEY-ID` / `APCA-API-SECRET-KEY`
- Market data: Massive (formerly Polygon.io) — base `https://api.massive.com` (legacy `api.polygon.io` works). Free tier = 5 req/min, EOD data → always handle 429s gracefully, cache aggressively
- Secrets: loaded from `Secrets.swift` (gitignored). NEVER hardcode keys in committed files. Keys live in `KEYS.md` (gitignored) — read it locally for values
- Tars AI: open-weight model, on-device (MLX/Core ML) with cloud fallback — NOT yet integrated; build the chat UI with a protocol-based `TarsEngine` so the model can be swapped in later

## Hard rules
- `KEYS.md`, `Secrets.swift`, `.env*` must stay in `.gitignore` — check before every commit
- Tars (the AI) never gives directive advice ("buy X") — it explains, teaches, critiques
- No performance claims / "beat the market" language anywhere in UI copy
- Paper/live mode state must always be visually unmistakable
- Latency matters: no polling where streaming exists; no blocking UI on network; optimistic UI with reconciliation

## Design language
Professional, elegant, restrained. Dark-first. Color reserved for meaning (P&L green/red, mode state). 120Hz-smooth interactions. Tars mascot = original character (NO Interstellar TARS resemblance — legal requirement), dry wit, radically honest.

## Project layout (target)
```
TarsTrading/
  TarsTradingApp.swift
  Config/        Secrets.swift (gitignored), AppConfig.swift
  Theme/         TarsTheme.swift (colors, type, spacing)
  Models/        Account, Position, Order, Quote, Bar
  Services/      AlpacaClient, MarketDataClient (Massive), TarsEngine
  Stores/        TradingStore (@Observable app state)
  Views/         RootView, WorkspaceView, ChartView, OrderTicketView,
                 PositionsView, WatchlistView, TarsPanelView, ModeBanner
docs/            PRD + specs
```

## Workflow
- User builds/runs in Xcode manually after changes; keep changes compiling
- Small, reviewable commits with clear messages
- When adding a feature, check the PRD's acceptance criteria first
