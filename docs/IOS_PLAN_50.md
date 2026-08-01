# Tars Trading iOS — the 50-phase plan

**Target:** universal iPhone + iPad, TestFlight via CLI, Apple-Design-Award-grade.
**Benchmark:** better than the Kalshi iOS app — which wins on speed and cleanliness,
and has nothing to say about *teaching*, *margin transparency*, or *multi-venue
breadth*. We match its speed and beat it where it's empty.

**Architecture (settled):** the app is a secretless client of the platform API
(`tarstrading.com/api/*`). Same account as the web. The server thinks; the phone
feels. The old direct-to-Alpaca Services layer is retired; the polished SwiftUI
theme/motion/haptics layer from Acts I–V is retained.

**The five edges over Kalshi** (each maps to specific phases below):
1. **The teaching is felt, not read** — margin cure clock as a Live Activity,
   SPAN credit appearing as you build a hedge, fills that carry their lesson.
2. **Honesty as design** — provenance on every price, AFTER HOURS states,
   PAPER identity, "you vs the index" on the risk page.
3. **Breadth** — 1,700+ markets across 8 venues + options; Kalshi has one kind of thing.
4. **The order ritual** — hold-to-confirm with haptic score; committing money
   should feel like a decision, not a tap.
5. **iPad as a terminal** — real multi-column trading desk, not a stretched phone app.

---

## Act 0 — Rails (1–6)
1. Register `com.tarsit.tarstrading` bundle ID + create the App Store Connect
   app record via the ASC API (CLI, no clicking).
2. Server: Bearer-token auth — `POST /api/auth/token` (login → long-lived device
   token, revocable per device), token table migration, middleware accepting
   `Authorization: Bearer` beside cookies.
3. Server: `GET /api/bootstrap` — account + watchlist + notifications + board
   head in one call; cold-start budget one round trip.
4. Xcode project surgery: retire AlpacaClient/MarketDataClient/Secrets.swift;
   the target builds clean with zero secrets and zero third-party deps.
5. `TarsAPIClient`: async/await, typed endpoints, Keychain token storage,
   401 → re-auth flow, staleness stamps on every payload.
6. Build/upload scripts: `xcodebuild archive` → `exportArchive` → `altool
   --apiKey` upload, one command end to end; version/build-number automation.

## Act I — Foundation (7–12)
7. Models mirroring API payloads (Quote+provenance, BoardRow, AccountRisk with
   SPAN, Order with bracket/filledQty, JournalEntry, Notification).
8. `SessionStore` (@Observable): login/signup/logout, token lifecycle, the
   $100k welcome moment.
9. Login/signup screens in the house style — the first screen must already
   feel like the award app.
10. `MarketStore`: board polling (20s, lifecycle-aware — foreground resumes,
    background stops), per-symbol quote subscriptions.
11. States system: loading skeletons, stale-data banner, offline mode with
    last-good reads clearly marked — honesty even when the network lies.
12. Environment plumbing: prod by default, localhost debug toggle; PAPER/
    SIMULATED identity woven into the shell (badge in the tab bar area).

## Act II — Markets (13–20)
13. Markets home: pulse strip (indices + breadth), venue map rail — "the whole
    desk" moment on a phone.
14. Board lists per venue with range meters, provenance chips, AFTER HOURS.
15. Search: instant in-room filter + full-universe symbol search; pull-to-jump.
16. Symbol page: header with live tick flash, day stats, 52-week range meter.
17. Charts: Swift Charts candles + line, timeframe picker, scrub with haptic
    detents and a price readout lens — the Kalshi-beating chart feel.
18. The tape: cross-venue marquee as an ambient strip; tap-through; pauses on
    touch; respects Reduce Motion.
19. Watchlist: add/remove/reorder (drag), synced with web via API rank.
20. Options chain: strikes/expiries browser, mid prices, the defined-risk
    framing (covered / cash-secured / vertical) surfaced in copy.

## Act III — Trading (21–28)
21. Ticket foundation: market/limit/stop/stop-limit/trailing, whole-share and
    contract validation mirrored client-side, server as truth.
22. Hold-to-confirm ritual ported: ring trace, haptic score, cancel-on-slide,
    two-tap accessibility alternative.
23. Brackets on the ticket: attach TP/SL, OCO explanation inline; working
    orders show both children linked to their parent.
24. Futures ticket: initial margin, notional, $/point — leverage legible
    before commit; SPAN what-if preview inline ("this hedge FREES $1,610").
25. Positions: signed qty, SHORT badges, futures margin+notional display,
    close flows with the ritual.
26. Orders: working/partial ("3,000 of 10,000 filled at $101.20 avg"),
    cancel, OCO group visualization.
27. Fills as moments: fill sheet with price, costs (commission + slippage
    stated), and the journal line it wrote.
28. Trade-anywhere: order ticket reachable from board rows, charts, search —
    two taps from anywhere to a ticket.

## Act IV — Money (29–34)
29. Portfolio hero: equity count-up, day P&L, sparkline; the monumental
    number treatment from the original app.
30. Margin Desk: requirement itemized by regime, SPAN credits by name, live
    financing rates, buying-power meter.
31. What-if margin: symbol+qty → requirement delta, same API as the gate.
32. Risk page: beta, vol, drawdown, effective positions, correlation bars —
    and "you vs the index," stated plainly.
33. Journal: trades vs desk events, the thesis sentences, financing rows —
    the record as a first-class surface.
34. Margin call experience: full-screen state with cure countdown, one-tap
    "show me what to close," liquidation ladder preview.

## Act V — The living layer (35–40)
35. Notification center: bell, unread, "since you left" digest on foreground.
36. Alerts: price alerts on any venue + $MARGIN usage alerts, managed natively.
37. APNs push: server sender on the notify() spine; fills, margin calls,
    alerts reach the lock screen. (Needs APNs key — small ask at this phase.)
38. Live Activities: margin-call cure clock and working-order progress in the
    Dynamic Island and on the lock screen — the award-moment feature.
39. WidgetKit: portfolio widget (equity + day), watchlist widget, margin
    usage gauge; StandBy-ready.
40. App Intents: "check my margin," "what's my P&L" via Siri/Shortcuts;
    Spotlight indexing of symbols.

## Act VI — Desk intelligence (41–44)
41. Assistant chat: streaming replies, the margin-aware brief doing its work
    on a phone; order confirmations inline.
42. Analysts floor: bench view with SVG sigils rendered native, live P&L,
    status control (pause/kill with the ritual).
43. Hire flow: describe a strategy in plain English → backtest resume →
    deploy on your word.
44. Activity feed: everything the desk did while you were away — analyst
    entries, fills, dividends, splits — as a scrollable story.

## Act VII — Award polish + ship (45–50)
45. iPad terminal: three-column desk (board | chart+ticket | tray), Stage
    Manager/keyboard/trackpad, hover states — a real terminal, not a big phone.
46. Accessibility full pass: VoiceOver on every surface, Dynamic Type to
    XXXL without truncation, Reduce Motion honored everywhere, charts with
    audio-graph descriptions.
47. Performance pass: 120Hz scroll everywhere, cold start < 1.5s to live
    board, memory/battery budget on the polling layer.
48. Haptic + motion score: one review of every interaction against the
    motion laws; delete anything that moves without meaning.
49. TestFlight ship: icon set, App Store metadata, screenshots (device
    frames), privacy manifest ("data not collected" where true), beta notes;
    upload via CLI; external tester group.
50. The gauntlet: full E2E on physical-device TestFlight build — every order
    type, margin call drill, alert round-trip, offline behavior; fix list;
    build 2.

---

**Cadence:** phases ship in waves of ~4–6; each wave ends with both simulators
verified (iPhone 17 Pro + iPad Pro M5) and a TestFlight build from Act III
onward. Academy is deliberately out of scope for v1 (links out); it becomes
its own act post-TestFlight.
