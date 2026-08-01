# 50 gaps & improvements — round 3 (2026-08-01)

## First: are all the admin-controlled markets present?

**The venues: yes, all eight, exactly.** The app's list matches the
server's payload one-for-one (Stocks, ETFs, Crypto, Global, FX, Income,
Indices, Futures), and their counts sum to the stated total with nothing
missing:

| Venue | Server has |
|---|---|
| Stocks | 563 |
| Global | 719 |
| Income | 218 |
| ETFs | 169 |
| Futures | 35 |
| FX | 17 |
| Crypto | 15 |
| Indices | 6 |
| **Total** | **1,742** ✓ |

**The rows: no — and this is the biggest gap in the app.** The board is
fetched with `limit: 250`, so:

- **Global shows 250 of 719.** 469 markets are unreachable.
- **Stocks shows 250 of 563.** 313 unreachable.
- Everything else fits under the cap and is complete.

Worse, search is client-side over the LOADED rows, so searching Global
for a company sitting at row 400 returns "nothing matches" — the app
tells you a market doesn't exist when it does. The app also advertises
"1,742 listed", which is true of the desk and false of what you can
actually reach. Items 1–6.

---

## Reach & truth (1–6) — the market-universe gap
1. ■ Board caps at 250 rows; Global (719) and Stocks (563) are truncated
   with no indication.
2. ■ Search only searches loaded rows — a real market reads as missing.
   Needs a server-side symbol search endpoint.
3. ■ "1,742 listed" implies reachability the app doesn't have.
4. ▲ Infinite scroll / "load more" doesn't exist; the list just ends.
5. ▲ The venue list is HARDCODED in the app; a ninth venue added in the
   console would never appear, even though the server already sends the
   venue payload the app could drive from.
6. ● No count per venue tab ("Global 719") though the payload carries it.

## Markets (7–14)
7. Trending has no explanation of what makes something trend.
8. No watchlist on iOS at all — the web has one; you can't pin a market.
9. No sort control (by change, by name, by price).
10. Board rows can't be swiped for quick actions (watch, alert, trade).
11. No "recently viewed" despite the web's palette having recents.
12. Movers rail scrolls but has no peek gradient at the edge.
13. Crypto (15) and Indices (6) leave big empty rooms with no filler
    context — a sparse room should say why it's small.
14. Search has no recent queries and no suggestions when empty.

## Symbol page (15–22)
15. Buy/Sell outrank the position card they depend on — reorder.
16. No "Close position" shortcut when you hold it.
17. No prev-close reference line, so a green 3M chart over a red day reads
    contradictory.
18. Day high/low unused though the board payload carries them.
19. No volume anywhere on the chart.
20. No watch/alert action from the symbol page.
21. Scrubbing has no haptic on release, and no way to compare two dates.
22. Landscape doesn't go fullscreen-chart (the TradingView signature).

## Trading (23–29)
23. Only market orders on iOS — no limit, stop, or trailing, though the
    server supports them and the web exposes them.
24. No order cancel from the app; working orders are read-only.
25. No position-size presets ($100 / 25% / Max).
26. No fractional-share entry for expensive names.
27. Ticket has no "review" step for large notional relative to equity.
28. No confirmation haptic difference between fill and rejection.
29. Bracket exits can't be edited after the order is placed.

## Desk (30–35)
30. Orders aren't grouped by day and there's no "see all".
31. No empty state art or first-trade guidance when the book is empty.
32. Positions can't be sorted or filtered.
33. No per-position "close" action from the Desk list.
34. Journal isn't reachable from a position (it should be).
35. No export/share of the day's activity.

## Assistant (36–40)
36. No way to start a NEW conversation or clear history.
37. Long answers can't be copied as a block or shared.
38. No streaming — answers land in one lump after a wait.
39. Assistant can't deep-link into the symbol it just discussed.
40. No indication of which analysts it can act on before you ask.

## Academy & learning (41–45)
41. Academy hero is still a purple→gold gradient card, off-system.
42. No "continue where you left off" despite tracked progress.
43. Lessons don't link back into the market they describe.
44. The instrument explainer doesn't link to a matching lesson.
45. No glossary surface, though the profiles now contain one implicitly.

## System & polish (46–50)
46. Sub-screens still use system nav bars while roots own their headers.
47. No pull-to-refresh on the Assistant or Academy.
48. No offline/error state for a failed board fetch beyond the stale line.
49. No haptic or visual confirmation when switching theme.
50. iPad: the Desk is still one stretched column; the terminal's right
    pane could dock a mini position/orders column.

---

## Build status (same day)

**Shipped (6 — the whole market-reach block):**
1. Board limit 250 → 800. Global now returns 719 of 719, Stocks 563 of
   563 — verified against production. Nothing is hidden any more.
2. New server endpoint `/api/market/search` searches all 1,742 symbols by
   ticker AND by name, ranked exact → prefix → substring, pricing only
   the ≤40 rows it returns. The app debounces 220ms and shows its answer.
   Verified: APPLE→AAPL, NVID→NVDA, BITCOIN→BTC+BCH.
3. Search count now reads "N of M across the desk", not "in this room".
5. Venue tabs are driven by the SERVER's payload — a ninth venue added in
   the console appears without an app release.

**Honest finding while building #2:** the name catalog the search matches
against (web/src/lib/symbols.ts, 137 entries) has drifted from the iOS
profile catalog (182). Searching "NOVO" finds nothing because Novo
Nordisk is in the app's catalog but not the web's. Merging the two into
one server-side source is the right fix and is NOT done — items 4, 6 and
the catalog merge remain open, along with 7–50.

## Capability wave (items 8, 16, 23, 24, 33)

Shipped: watchlist (star on the symbol page, Watch in every long-press
menu, a "Watching" room first in the venue tabs, state shared with the
web through the same endpoint); limit and stop orders with their plain
explanations; order CANCEL on working orders (button and swipe); CLOSE
POSITION from both the symbol page and a Desk swipe, pre-sized to the
whole position so it can't leave a remainder behind.

All five were already supported by the server and exposed on the web —
this was the phone catching up, not new platform capability.
