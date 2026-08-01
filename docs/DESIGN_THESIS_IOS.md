# Tars iOS — Design Thesis (the transformation wave)

Researched: Kalshi (production tokens scraped), Robinhood (Porto Rocha era),
TradingView mobile, Mercury/Linear/Copilot/Coinbase. Full reports in session;
distilled here into laws. This file is the tie-breaker for visual decisions.

## The verdict on our old skin
Dead space where a hero belongs; system blue leaking from our own accent
token; every surface the same gray card blob; gold used as paint (five
mustard tiles) instead of signal; a muddy flooded chart in a frame; an app
icon with three ideas and none of them ours.

## The thesis: a lit terminal, edited like a magazine
Tars is a professional desk that teaches. The skin must read pro-terminal
first (Kalshi/TradingView), with editorial warmth in the words (we already
write well — the type should let the words breathe).

### Laws
1. **One accent: the gold.** Brand = capital = action. Interactive tint,
   selected states, the PAPER mark — all the same gold. Blue is dead. Green
   and red belong to P&L only, purple to analysts only. One saturated color
   per screen state.
2. **Elevation by luminance, hierarchy by hairline.** bg0→bg3 ramp (already
   blue-black, correct per Kalshi #0A0C0F / Mercury #0F0F14). Cards are flat
   fills + 1px white@7% border. No shadows on content. Radius 12 for cards,
   16 for sheets — the 20pt+ bubble is consumer, not terminal.
3. **The number is the header.** Screens open with the figure that matters
   (equity, price) where a nav title would be. No large-title dead zones.
   Numbers are condensed, tabular, and ROLL (`.contentTransition(.numericText)`)
   — they never snap.
4. **Lists, not cards, for data.** Positions, orders, board rows: full-bleed
   rows with hairline separators. Panels are reserved for genuinely grouped
   stat blocks. (Robinhood + TradingView both.)
5. **Charts are chromeless.** Edge-to-edge, 2pt line, gradient fade
   ~20%→0, no gridlines, no frame. Timeframe selector is text-only — active
   = white semibold, rest = tertiary. Direction color lives in the canvas
   and the delta text; chrome stays neutral.
6. **Solid fill is a privilege.** Exactly the contextual primary actions get
   solid fills (Buy = gain fill / Sell = loss fill, dark text — Kalshi's
   paired team buttons). Everything else is outlined or quiet.
7. **Labels whisper.** ALL-CAPS micro-labels at +8% tracking in tertiary ink,
   sentence case for everything else. Weight band 400–600; bold is for the
   one number that owns the screen.
8. **The icon is one mark.** Gold monogram on the blue-black field, flat
   layers, no baked lighting, no starfields, no candlesticks.
