# Design Audit — 100 flaws and improvements (2026-08-01)

Method: 21 fresh screenshots across iPhone 17 Pro + iPad Pro 13" (every tab,
every desk route, ticket, FX symbol, onboarding, login, XXXL type), judged
against docs/DESIGN_THESIS_IOS.md. Severity: ■ broken · ▲ off-thesis · ● polish.

## The five systemic diseases (cause most of the 100)
A. **Two design generations coexist** — transformed screens (Markets, Symbol,
   Desk) vs untouched ones (Trade tab, Academy, More, Alerts, Risk, Journal,
   Login, Onboarding). Every untouched screen re-imports the diseases the
   thesis killed: gold-washed capsules, card blobs, dead headers.
B. **Four brand marks** — stepped-T (icon), apex pyramid (headers), plain
   triangle (login), orbit ring (onboarding/avatar/launch). One family must win.
C. **Selector anarchy** — text tabs (new), gold-filled capsules (Risk/Journal/
   Academy), iOS default segments (Alerts), old capsule pills (Trade tab).
D. **Gold still leaks as paint** on legacy surfaces (icons, capsules, bubbles).
E. **Bottom-void screens** — Margin/Floor/Alerts/More end mid-screen with
   orphaned footnotes floating in the dark.

## Global / system
1. ■ Legacy **Trade tab is visually broken**: circular blobs with letters
   wrapping vertically one-per-line ("M/o/n/i/t/o/r"), overlapping shapes,
   permanent skeletons. It duplicates Markets+Symbol. Replace or remove.
2. ■ Same broken workspace is the iPad rail's "Terminal" section.
3. ▲ PAPER mark has three placements (banner pill, workspace chip, More
   mid-screen) — one chrome position, always.
4. ■ Root tabs show BACK chevrons (More, Assistant) — stack misuse; roots
   never show back.
5. ▲ Gold-filled capsule selectors: Risk (30d/90d/180d/365d), Journal
   (All/Trades/Events), Academy (path buttons) — law-1 violations.
6. ▲ Alerts uses iOS-default gray segmented controls — third selector style.
7. ▲ Old capsule timeframe picker (1D…5Y) still lives on Trade tab.
8. ▲ Icon language mixed: filled gold icons (More), stroke ink (Desk links),
   filled tab glyphs — pick stroke ink + gold-only-when-live.
9. ● Academy and Notifications content scrolls visibly under the floating
   tab bar (missing 72pt clearance).
10. ● Dead bottom halves: Margin, Floor, Alerts, More.
11. ● Floating gold search circle (Trade/Academy/More) is a stray control —
    unify search entry per-screen.
12. ● No landscape story on iPhone symbol page (rotate → fullscreen chart is
    the TradingView signature and free wow).

## Login & Onboarding
13. ▲ Login mark is a plain rounded triangle — not the stepped-T, not the
    apex. Brand mark #3.
14. ▲ "TARS TRADING" in SF Rounded caps — brand voice is condensed now.
15. ● Focused field: gold border + system-blue cursor — set tint.
16. ● Form floats mid-screen; footer disclaimer orphaned at the very bottom.
17. ● Disabled "Sign in" is an indistinct gray slab — use disabled formula.
18. ■ No "create account" or "forgot password" path — a new user hits a wall.
19. ▲ Onboarding page 1: orbit-ring mascot (brand mark #4), 60% empty screen.
20. ▲ Onboarding gold-washed chip + rounded type + default page dots.

## Markets home
21. ● Venue tile rail clips third tile with no peek/fade affordance.
22. ● Venue icons mix metaphors and weights (filled bitcoin vs strokes).
23. ● Breadth counts at full saturation (green/red) — mute to caption tone.
24. ● Pulse index names truncate ("Nasdaq…", "Russell…") — fit or shorten.
25. ■ Movers card shows "$0.00" for SHIB/USD — sub-cent price formatting.
26. ● GOOG + GOOGL both in movers — dedupe share classes.
27. ● Provenance chip repeats EOD on every row — show only when it differs
    from the venue's default; noise now.
28. ■ Sparkline column ragged: rows without sparks shift the price column.
    Reserve the 56pt slot.
29. ● "DERIVED" provenance never explained on iOS (web has room notes).
30. ● VIX −17.28% wears loss-red at hero weight — index moves aren't P&L.
31. ● Text tabs selected state is weight-only — add ink contrast (white vs
    55%) per Kalshi.
32. ● Board rows lack tap feedback (no pressed state on flat rows).

## Symbol page
33. ■ FX flat day: "−0.00%" rendered RED (twice: header + TODAY) — zero must
    be neutral; add epsilon.
34. ● AAPL: green 3M chart above red −7.82% day delta reads contradictory —
    add dashed prev-close reference line to explain the two frames.
35. ● Lens line ("Jul 30, 2026 $308.91") shows at rest with no label —
    reads as a second price; add "LAST CLOSE" micro-label.
36. ● Y-axis labels collide with the line's right endpoint — inset or fade.
37. ■ XXXL: lens price wraps mid-number ("$308.9 / 1") — a11y regression on
    the new surface.
38. ■ XXXL: axis labels eat ~40% of plot width — cap chart text size.
39. ■ XXXL: timeframe row + "3M RANGE" overflow into the tab bar.
40. ● Buy/Sell give no affordability hint (shares you can afford) pre-ticket.
41. ● Position card lacks a "Close" shortcut (sell exactly my qty).
42. ● Range dot invisible at extremes — clamp with edge padding.
43. ● factsRow ignores dayHigh/dayLow the board payload already carries.
44. ● No volume/anything on the chart footer — Kalshi prints "$861k vol".

## Trade ticket
45. ▲ "Hold to buy" is a gold WASH with gold text — by our own law it reads
    disabled. The one contextual action must be SOLID gold, dark text.
46. ● Title "Buy AAPL" is plain heading — no eyebrow ("MARKET ORDER"), no
    price context at top.
47. ● Minus stepper at qty=1 not visibly disabled.
48. ● No quick-size chips ($100 / $1k / 25% / Max) — genre standard teach-in.
49. ● Est. cost lacks "of $198,752 buying power" — the teaching moment.
50. ● Attach-exits toggle is untinted default; no subtext until enabled.
51. ● Sheet: grabber only, no X close (Kalshi ships both).
52. ● Footnote quaternary-on-bg1 fails comfortable contrast at that size.

## Desk
53. ● Five desk-link chips flat-priority while Notifications hides in bell —
    IA inconsistency.
54. ● Position rows poorer than board rows: no sparkline, no day %.
55. ● Orders: 20 undifferentiated rows, no day grouping, no "see all".
56. ● CANCELED rows leave an empty hole where price sits on FILLED rows.
57. ● Docked equity isn't tappable (should scroll-to-top).
58. ● Pinned header needs a hairline once content scrolls beneath it.

## Sub-desk screens
59. ● Margin: disclaimer floats as orphan; pin as footer.
60. ▲ Margin: "CASH" tag in accent gold for a neutral fact.
61. ● Margin: Initial $126 vs Maintenance $126 — two cells, same number,
    no delta explanation.
62. ▲ Risk: gold-filled window capsules (worst law-1 instance).
63. ▲ Risk: "1.0" concentration in giant warning-orange — neutral metric
    wearing an alarm color.
64. ● Risk: correlation bars read as interactive sliders — restyle as viz
    (thinner track, no thumb-like dot).
65. ● Risk: stat type sizes inconsistent (beta −0.08 vs 0.6% weights).
66. ▲ Journal: gold-filled filter capsules.
67. ● Journal: 13 identical rows, no day grouping or aggregate line
    ("13 closes · −$2.94").
68. ● Event chip palette undefined (FINANCING green, CLOSED gray, TRIGGERED
    gold) — codify one chip system.
69. ▲ Alerts: two default segments — convert to house selectors.
70. ● Alerts: disabled "Set alert" identical to a secondary button.
71. ● Alerts: duplicates listed (VIX ×2, EUR/USD ×2), triggered mixed with
    armed — section + dedupe.
72. ● Notifications: one green seal for every row; verbose "20 hr, 30 min"
    → "20h"; icon should follow kind.

## Assistant & Floor
73. ■ Assistant root shows back chevron.
74. ▲ User bubbles are full-saturation gold slabs — the loudest element in
    the app; mute to gold wash + gold text or neutral.
75. ■ First transcript bubble clips behind the PAPER pill on load (scroll
    inset).
76. ● Send button disabled state (bg3 + tertiary arrow) reads broken, not
    disabled.
77. ● No timestamps/date separators in transcript.
78. ● Money formatting "$8.7" → "$8.70"; superseded wrong answers ($6.83)
    sit uncorrected above the fix ($7.13) — style "corrected below" or trim.
79. ● Floor: status chip treatments inconsistent (BACKTESTED bare gold text
    vs RUNNING green) — one chip container.
80. ● Floor: thesis + boundary copy both quaternary — flat hierarchy.
81. ▲ Purple sigils are now the only purple in the app — commit agentPurple
    as the analyst accent everywhere or retire it.
82. ● "+$0.00" floor P&L should be neutral ink (zero-neutral law).

## Academy & More
83. ▲ Academy hero: purple→gold gradient card — off the material system.
84. ▲ Academy: three giant gold capsule path buttons — heaviest gold blobs
    left in the app.
85. ■ Academy content scrolls under the tab bar (no clearance).
86. ● Cold-start hero ("Observer, 0 XP") has no CTA — "Start Foundations".
87. ■ More: back chevron on root + ~40% header void before content.
88. ▲ More rows: cards with gold filled icons → flat rows, ink strokes.
89. ▲ More: PAPER pill floats mid-screen (placement variant #3).
90. ● Settings/Screener/Agents/Journal(old) never swept for the new system.

## iPad
91. ● Desk is one 1300pt-wide stretched column — cap content width or go
    two-column (positions | orders).
92. ■ Rail "Terminal" opens the broken legacy workspace (see #1).
93. ▲ Rail wears two orbit avatars (top brand + bottom Tars) — brand mark #4
    twice; align with apex family.
94. ● Terminal right pane still bottom-heavy with void — dock a mini desk
    column (position, working orders, alerts for the symbol).
95. ● ⌘K exists but is undiscoverable — no hint, no menu, no shortcut help.
96. ● PAPER banner centers over the CONTENT column, off-axis from the rail —
    center over the full window or lead-align.

## Brand & app-level
97. ▲ Four marks in circulation (stepped-T icon, apex header, login triangle,
    orbit rings) — consolidate: stepped-T (icon) + apex (in-app), retire rest.
98. ● No iOS 18+ dark/tinted icon variants — single PNG only.
99. ● Launch overlay still plays the old orbit identity — first frame should
    match the icon the user just tapped.
100. ● No stated light-mode position on iOS while the web ships light —
     decide (dark-only is a legitimate Kalshi-style stance) and document it.
