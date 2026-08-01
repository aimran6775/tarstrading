# 50 layout & design changes (2026-08-01, second pass)

Sweep of every surface after the audit fix-down. Answers first, then the list.

## Your three questions

**Light mode?** No — `PreferencesStore.colorScheme` is hardcoded `.dark`, and
Settings ships a placeholder that says "Light mode ships the day it can be
shipped proudly. That day is not today." That was an honest holding
position, but the web ships light and the phone should stop apologising.
Items 1–6 make the theme genuinely dynamic (System / Light / Dark), with
the video scene staying a committed dark world in both — the same contract
the web's VideoHero already keeps.

**Is the Desk good?** Much better, not finished. The scene is beautiful but
eats ~55% of the first screen, so positions — the reason you opened the
tab — start below the fold. "SIMULATED · LIVE BOOK" is clipped at the right
edge. Items 12–22.

**Assistant?** It's the weakest first-class screen. No header identity, a
leftover search button that does nothing there, no way to start a new
conversation, no timestamps, starter questions vanish forever after the
first message. Items 30–38.

## Theme system (1–6)
1. Make every TarsTheme surface/ink token a DYNAMIC color (light + dark
   pair) instead of a fixed dark value.
2. Add `Appearance: System · Light · Dark` to PreferencesStore and apply at
   the root via `.preferredColorScheme`.
3. Replace the Settings placeholder with a real three-way selector.
4. Light-mode meaning colors: gain/loss/accent need darker variants — the
   dark-tuned gold is illegible on white.
5. The scene hero and its scrims stay dark in BOTH themes (fixed constants,
   never tokens) — the web's rule, ported.
6. Sweep hardcoded `.white`/`Color.black` opacities that assume dark.

## Global chrome (7–11)
7. Sub-screens (Margin, Risk, Journal, Floor, Alerts, Notifications) still
   use the system nav bar while roots use owned headers — unify on owned.
8. The Assistant's header search button does nothing there — remove.
9. Back chevron is a floating circle on sub-screens, inconsistent weight.
10. PAPER pill sits above owned headers on roots but below nav titles on
    sub-screens — one vertical position.
11. Bottom void persists on Floor, Margin, Alerts.

## Desk (12–22)
12. Scene hero is ~55% of the viewport; cap it (~300pt) so positions clear
    the fold.
13. "SIMULATED · LIVE BOOK" is CLIPPED at the right edge — shorten to
    "LIVE BOOK" or drop the dot pair.
14. The equity-curve panel crowds the card's bottom edge.
15. Desk links: 5 cramped tiles; go 3-up + 2-up, or a scrollable row with
    real labels.
16. Positions show no day % and no sparkline while board rows have both.
17. Orders: no day grouping, no "see all", 20 rows of undifferentiated text.
18. CANCELED rows leave a hole where FILLED rows show a price.
19. Docked equity in the header isn't tappable (should scroll to top).
20. No empty-state art when there are no positions — just a sentence.
21. Notifications live behind a bell while five lesser things get tiles.
22. Sync line is quaternary at micro size — below comfortable contrast.

## Markets (23–29)
23. Movers rail cards have no sparkline while board rows do.
24. Movers rail third card is clipped with no peek gradient.
25. Board has no section grouping when Trending mixes venues.
26. Search results give no count ("12 of 1,742").
27. Search has no recents and no empty-state guidance.
28. Tape cells aren't tappable (only long-pressable) — tapping should open.
29. Board rows: name + provenance compete on one line; provenance should
    trail the price instead.

## Symbol page (30–34)
30. Buy/Sell sit above the position card — the action outranks the context
    it depends on.
31. No "Close position" shortcut when you hold the thing.
32. Chart has no prev-close reference line, so a green chart over a red day
    reads contradictory.
33. Range dot can vanish at the extremes.
34. No day high/low even though the board payload carries them.

## Assistant (35–43)
35. No owned header — the nav title is the only identity.
36. Remove the meaningless search button.
37. No "new conversation" action.
38. Starter questions vanish forever after the first message; they should
    return when the transcript is empty or behind a "suggestions" chip.
39. No timestamps or day separators in the transcript.
40. Bubbles are full-width at 48pt inset — long answers become walls.
41. The thinking state is a bare spinner; give it a typing rhythm.
42. Composer is a plain field with no attach/quick-ask affordances.
43. No scroll-to-latest button when you've scrolled up.

## Floor / sub-desks (44–47)
44. Floor analyst cards: sleeve + drawdown line wraps mid-phrase.
45. Floor: retired analysts aren't visually separated from live ones.
46. Notifications: identical green seal on every row regardless of kind;
    "15 hr, 48 min" should read "15h"; no day grouping.
47. Notifications rows sit in a card while Desk rows are flat — pick one.

## Academy & More (48–50)
48. Academy hero is a purple→gold gradient card, off the material system.
49. Academy: no "continue where you left off" when progress exists.
50. More: reachable settings (sound, haptics, complexity) could surface as
    inline toggles rather than one more push.

---

## Build status (same day)

**Shipped (34):** 1–6 (full dynamic theme + System/Light/Dark selector),
7 partial, 8, 11 partial, 12, 13, 14, 15, 16, 18, 19, 22, 23, 26, 28,
35, 36, 37, 38, 39, 40, 41, 44, 45, 46, 47, plus the scene-blend bug this
pass exposed.

**Deferred to the next wave (16):** 9, 10, 17 (order day-grouping), 20,
21, 24, 25, 27, 29, 30–34 (symbol page reorder, close-position shortcut,
prev-close line, day high/low), 42, 43, 48, 49, 50.
