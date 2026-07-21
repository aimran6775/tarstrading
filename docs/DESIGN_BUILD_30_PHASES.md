# Tars Trading — Design Build, 30 Phases

**Mission:** make the app indistinguishable from something Apple's own design team shipped — on iPhone *and* iPad. Design only; each phase produces decisions and specs precise enough that the later coding pass is mechanical. No new features. Every phase ends with an "Apple bar" — the acceptance test a Cupertino design review would apply.

**The one-sentence brief:** *A dark, quiet, precision instrument that moves like water and rewards attention — never a dashboard, never a toy.*

---

## The Ten Laws (govern every phase)

1. **One material system.** Every surface is either the void, a panel, or glass. No orphan grays.
2. **One physics.** Every motion comes from the same spring family. Nothing linear, nothing eased-in-out, nothing 300ms-default.
3. **Color is meaning.** Green/red = P&L. Amber = mode. Blue = interactive/Tars. Purple = agents. Anything else is a bug.
4. **Numbers are the heroes.** Monospaced digits, generous size, everything else recedes.
5. **Interruptible always.** Any animation can be redirected mid-flight; the user is never locked out.
6. **Touch first, hover as a gift.** Everything works with a thumb; pointer/keyboard make it sing on iPad.
7. **Hierarchy by light, not lines.** Elevation via luminance and material, hairlines only where light fails.
8. **Nothing decorative moves.** Motion communicates state change, spatial origin, or live data — or it doesn't exist.
9. **The PAPER badge is sacred.** Restyle it endlessly; never dilute it.
10. **When in doubt, remove.** The Apple move is always subtraction.

---

# Act I — Foundations (Phases 1–6)

### Phase 1 — Audit & north-star frames
**Goal:** know exactly where we are and where we're going before touching a token.
- Screenshot every surface (36 views) on iPhone 16 Pro, iPhone 16 Pro Max, iPad Pro 11", iPad Pro 13" — light on the simulator matrix from Phase 30.
- Grade each against the Ten Laws; produce a ranked defect list (spacing drift, orphan colors, dead motion, truncation, inconsistent radii).
- Design 5 **north-star frames** (static mockups rendered in SwiftUI previews): iPhone Workspace, iPhone Order Ticket, iPad Workspace, Symbol Detail, Tars panel. These are the taste anchors every later phase must match.
- **Apple bar:** a stranger shown the north-star frames next to Stocks/Weather/Fitness cannot tell which app is Apple's.

### Phase 2 — Color 2.0: semantic tokens & wide gamut
**Goal:** rebuild `TarsTheme` colors as a *semantic* token system, P3-native.
- Rename by role, not value: `surface.void/panel/card/raised`, `ink.primary/secondary/tertiary/quaternary`, `signal.gain/loss/neutral`, `mode.paper/live`, `tint.interactive`, `tint.agent`.
- Re-derive all values in Display P3; tune gain/loss so they pass 4.5:1 on `surface.panel` *and* don't vibrate on OLED black. Add pressed/hover/disabled derivations as formulas (opacity + luminance shift), not hand-picked one-offs.
- **Elevation via tint:** each step up adds +2% luminance *and* +1% blue-violet tint (how Apple's dark surfaces feel lit from the screen, not painted gray).
- Define the **light appearance** now, even though dark ships as canonical: a "graphite" light theme (paper-white void, ink flips, same signal hues darkened for contrast). Decision: dark is default and marketing-canonical; light exists and is flawless, because Apple never ships dark-only.
- **Apple bar:** zero raw `Color(red:green:blue:)` literals outside the token file; every token pair passes WCAG AA in both appearances.

### Phase 3 — Typography 2.0: the ramp
**Goal:** a complete, Dynamic-Type-native type ramp.
- Three voices, strictly cast: **SF Pro** (UI text, optical sizes automatic), **SF Pro Rounded** (Tars's voice, Academy warmth, celebratory numerals), **SF Mono / monospaced digits** (every number that can change).
- Replace fixed sizes with a ramp anchored to text styles so Dynamic Type works: `display(56/bold/condensed)`, `displayM(44)`, `hero(→ .largeTitle rounded)`, `title(→ .title2)`, `heading(→ .headline)`, `body(→ .body)`, `caption(→ .caption)`, `micro(→ .caption2 semibold, smallcaps tracking +0.6)`.
- Numeric styles get `.monospacedDigit()` plus **tabular fractions rule**: prices ≥ $1,000 drop cents in compact contexts; sub-$1 crypto shows 4 significant decimals.
- Tracking table: condensed display numerals −0.5; micro labels +0.6 (uppercased); everything else default. Line-height rule: multiline body 1.35×, data rows 1.0×.
- **Apple bar:** at AX5 Dynamic Type, every screen remains usable (layouts reflow, nothing truncates a number); at default size, screenshots kern like the Stocks app.

### Phase 4 — Space & shape: the grid
**Goal:** one spatial system both devices share.
- 4pt base grid; spacing tokens `4/8/12/16/24/32/48` (adds 32/48 for iPad breathing room). Screen margins: iPhone 16pt (20pt on Max), iPad 24pt; panel internal padding 16pt; card internal 12pt.
- **Concentric radius law** (the single biggest "Apple-built" tell): inner radius = outer radius − inset. Panels 22 → cards inside 14 → controls inside 8. Buttons/chips: capsule or 10pt, never in between. All `.continuous` curvature.
- Hairline policy: only between sibling rows inside the same surface; never around a surface that already has elevation contrast. Kill double-bordering everywhere the audit found it.
- Standard control metrics: row height 44pt minimum (52 for primary lists), button heights 50/44/36 (primary/secondary/compact), min tap target 44×44 without exception.
- **Apple bar:** overlay a 4pt grid on any screenshot — everything snaps; nested corners look concentric at a glance.

### Phase 5 — Materials & depth: glass
**Goal:** replace flat fills with a real material hierarchy — this phase moves the app a generation forward.
- Material stack: **void** (opaque `surface.void`) → **panel** (opaque `surface.panel`) → **glass** (`.ultraThinMaterial` with `surface.panel` tint at 60%) for anything that floats: mode banner, command palette, order-ticket sheet, Tars panel, toolbars, tab bar.
- Adopt the current OS design language (Liquid Glass era): floating glass toolbars with content scrolling *under* them, edge-to-edge content, scroll-edge effects where the system provides them. Follow the system — never fake glass with static blur screenshots.
- Shadow system, dark-tuned: shadows barely work on near-black, so depth = material + a 1pt **top-light hairline** (`white 8%` on the top edge of raised surfaces) + soft ambient shadow only under true overlays (radius 30, y 10, black 35%).
- Whole-app depth map: which of the 36 surfaces sits at which level; the Tars aurora and P&L mood-light survive but only on the void layer, never on glass.
- **Apple bar:** scroll any list — content visibly slides beneath glass chrome exactly like Music/Safari; nothing looks like a gray rectangle painted on.

### Phase 6 — Iconography & symbols
**Goal:** every glyph intentional.
- Full SF Symbols pass: one weight pairing rule (symbol weight matches adjacent text weight; scale `.medium` in rows, `.large` in heroes). Fill vs outline: fill = selected/active, outline = idle — everywhere, no exceptions.
- Symbol effects charter (used sparingly, per Law 8): `.bounce` on watchlist add, `.pulse` on live/streaming indicators, `.variableColor` on connection status, `.wiggle` reserved for destructive confirmations (agent kill switch arm).
- Design 6 **custom SF Symbols** (drawn in the SF template, all 9 weights interpolable): Tars mark, agent bot, payoff-curve, paper-badge glyph, backtest-honesty (split candle), journal quill.
- **Apple bar:** custom symbols are indistinguishable in optical weight from system ones at 17pt; toggling weight in one place shifts every glyph coherently.

---

# Act II — Motion & Feel (Phases 7–11)

### Phase 7 — The motion charter
**Goal:** rewrite `Motion.swift`'s vocabulary into a complete physics spec.
- Keep four springs, retuned and renamed by intent:
  `instant` (response 0.20, damping 0.90 — touch feedback), `snappy` (0.30/0.85 — controls, selection), `spatial` (0.45/0.82 — panels, navigation, sheets), `grand` (0.70/0.88 — heroes, launch, celebrations). Plus `ticker` (0.35/1.0 — critically damped, numbers only).
- Laws: no `.linear` outside progress bars; no `.easeInOut` anywhere; every `withAnimation` names a preset; all transitions interruptible (spring-based, velocity-preserving); stagger children 25ms, max 6 staggered items (beyond that, animate as a block).
- **Reduce Motion variants specified per preset:** spatial moves become 0.2s crossfades; ticker keeps `numericText` (it's informative); staggers collapse to simultaneous.
- Deliverable: a motion spec table — every animated moment in the app × preset × trigger × reduce-motion fallback.
- **Apple bar:** screen-record any 30 seconds of use; every moving element decelerates like it has the same mass.

### Phase 8 — Transition choreography
**Goal:** navigation feels spatial — things come *from* somewhere and return *there*.
- **Hero transitions:** watchlist row → Symbol Detail (the symbol's sparkline morphs into the full chart via the system zoom navigation transition); Academy card → lesson; agent card → backtest report.
- Sheet taxonomy: order ticket = detented sheet (medium/large) with glass background; command palette = full-screen glass overlay, springs from top; confirmations = compact detent; Settings = standard sheet. Corner radii concentric with device bezel.
- Tab/pane switches: content cross-slides 12pt with opacity, direction follows tab order (left tab → content enters from left).
- Dismissal is always the reverse of arrival, velocity-matched to the gesture that caused it.
- **Apple bar:** navigate anywhere and back with a scrub gesture held halfway — the interface tracks the finger perfectly, no jump on release.

### Phase 9 — Micro-interactions
**Goal:** the 200ms layer that makes it feel expensive.
- Buttons: pressed = scale 0.97 + brightness −6% via `instant`; primary CTAs get a 1pt inner top-light that brightens on press (feels like physical key travel).
- Toggles/segmented controls: thumb overshoots 4% with `snappy`; selection background is a matched-geometry capsule that *slides* between options, never fades.
- Steppers (qty, price): press-and-hold accelerates (1×, then 5× after 600ms, 25× after 1.6s) with `Haptics.tick()` per detent.
- Pull-to-refresh: custom Tars indicator — the mark's aperture irises open with pull progress, spins with `variableColor` while loading.
- Watchlist rows: swipe actions with symbol-effect bounce on reveal; long-press lifts the row (scale 1.02, ambient shadow) into a context-menu preview.
- **Apple bar:** every interactive element responds within one frame of touch-down; nothing "blinks" state without motion.

### Phase 10 — The haptic score
**Goal:** haptics composed like a soundtrack, not sprinkled.
- Keep the semantic API; add **CoreHaptics custom patterns** for the four signature moments:
  - *Order staged:* soft single transient (intensity 0.5, sharpness 0.3).
  - *Order filled:* double-tap pattern — transient 0.8 then 0.4, 80ms apart (a heartbeat).
  - *Stop-loss triggered:* three descending transients (falling feeling).
  - *Agent kill switch:* long continuous rumble 0.3s ramping down (powering off).
- Pairing law: every haptic co-fires with its `SoundService` cue at matched intensity; system settings (silent switch, reduce haptics) respected via one gate.
- Haptic map deliverable: full table of every haptic in the app × trigger × pattern × sound pairing. Rule: no haptic on *incoming* data (prices tick constantly — haptics only answer the user's own actions, plus fills/alerts they explicitly armed).
- **Apple bar:** use the app eyes-closed; you can tell staged vs filled vs rejected by feel alone.

### Phase 11 — Live-data motion
**Goal:** streaming numbers feel alive but never noisy.
- Ticker choreography law: digits roll via `numericText`; direction flash (gain/loss color) holds 900ms then decays via `grand`; **flash only on trades ≥ 1 tick**, and when >4 instruments update in one frame, only the focused instrument flashes (the rest roll silently) — the "quiet tape" rule.
- Chart streaming: new candle grows from the right edge; last-price line glides with `ticker`; axis rescales with `spatial` *only when* price exits the current range by >2% (no constant re-scaling jitter).
- Sparklines draw on first appear via trim 0→1 (`grand`, 0.6s), then update without redraw animation.
- P&L mood aurora: re-evaluates at most every 5s, cross-fades over 2s — ambient, subliminal.
- Connection states: streaming dot uses `.variableColor.iterative`; stale-data (>15s) desaturates all prices to 70% and shows a glass "delayed" chip — data honesty made visible.
- **Apple bar:** watch the workspace during a volatile minute — it reads calm; you can always find the number that changed, and nothing else demands attention.

---

# Act III — Structure & Adaptivity (Phases 12–16)

### Phase 12 — iPhone information architecture
**Goal:** the iPhone app is *designed*, not shrunk.
- Five-tab bar (glass, floating): **Markets** (watchlist+screener merged), **Trade** (chart + ticket), **Portfolio**, **Academy**, **Tars**. Agent Lab, alerts, journal, settings live one level in — reachable, not competing.
- One-hand law: every primary action in the bottom 60% of the screen. Order ticket is a detented sheet thumb-reachable from the chart; symbol search is a bottom-anchored palette (rises from the tab bar, like Maps search).
- The mode banner collapses to a compact PAPER capsule pinned in the nav bar — smaller, never absent (Law 9).
- Navigation depth audit: nothing important more than 2 taps from launch; back-swipe works everywhere.
- Deliverable: full iPhone flow map (every screen, every entry/exit) + north-star-quality frames for all five tabs.
- **Apple bar:** hand the iPhone build to someone standing on a train — they can check P&L, open a chart, and stage an order without repositioning their grip.

### Phase 13 — iPad information architecture
**Goal:** the iPad keeps its pro-terminal soul, rebuilt on the new system.
- Workspace = the flagship: a 12-column grid hosting panels (chart, tape, positions, ticket, Tars) with three named presets (Trade / Research / Monitor) that animate between arrangements via matched geometry (`spatial`).
- Panel chrome: glass headers, drag handles appearing on hover/long-press, snap-to-grid resize with haptic detents at column boundaries.
- Sidebar (leading, collapsible): watchlists, screener, academy, agents, journal — `NavigationSplitView`-style with glass, collapses to icon rail at narrow widths.
- Tars panel docks right, floats as a glass card when undocked; drag between states with spring hand-off.
- **Apple bar:** side-by-side with a pro terminal screenshot, Tars looks *calmer and more premium*; side-by-side with Stocks on iPad, it looks like its power-user sibling.

### Phase 14 — Size-class adaptive spec
**Goal:** one app, continuous across every window shape.
- Define the four layout modes and exact breakpoints: **Compact** (<500pt: iPhone, iPad Slide Over/⅓ split) = iPhone IA; **Medium** (500–800: ½ split, portrait iPad small) = single-panel + rail; **Regular** (800–1100) = two-panel workspace; **Expansive** (>1100: 13" full, Stage Manager large) = full grid.
- Transitions between modes animate (panels merge/split via matched geometry) when the user resizes a Stage Manager window — no snap-reflow.
- Every view's adaptive behavior specified in a table: what hides, what collapses into menus, what reflows. Rotation: iPhone landscape = full-screen chart mode (Phase 19), iPad rotation preserves workspace preset.
- **Apple bar:** drag a Stage Manager window slowly from ⅓ to full width — the app reflows through all four modes without a single layout pop.

### Phase 15 — Pointer, keyboard, Pencil
**Goal:** iPad inputs elevate the experience.
- Pointer: hover effects (`.hoverEffect(.highlight)`) on all rows/buttons; chart crosshair follows pointer with 0-latency; panel resize cursors; watchlist rows lift subtly on hover.
- Keyboard: full shortcut map (⌘K palette, ⌘T new order, ⌘1–4 workspace presets, arrows navigate watchlist, ⌥click chart adds drawing point); hold-⌘ HUD lists shortcuts; focus ring style = 2pt `tint.interactive` rounded to control's radius.
- Pencil: chart drawings get pressure-weighted line width, double-tap switches drawing/eraser, hover preview (M2+) shows drawing anchor point before touch.
- **Apple bar:** an iPad-with-Magic-Keyboard user can trade a full session without touching the screen; nothing feels like a ported touch UI.

### Phase 16 — Widgets & glanceables (design spec only)
**Goal:** design the out-of-app surface now so v2 code inherits it.
- Lock/Home widgets: portfolio equity (small), watchlist top-movers (medium), agent status (small) — all on the void surface with the P&L aurora, PAPER-badged (Law 9 extends outside the app).
- Live Activity / Dynamic Island: working-order progress (staged → routed → filled) with the Phase 10 fill choreography mapped to island expansion.
- App Shortcuts / Spotlight cards visual spec.
- **Apple bar:** widget mockups pass the same north-star test as Phase 1 frames.

---

# Act IV — Surface-by-Surface (Phases 17–26)

### Phase 17 — Launch & onboarding
- Launch: void → Tars mark irises open (`grand`) → equity number rolls up from 0 → workspace panels stagger in (6 max). Total < 1.8s, skippable by touch, plain fade under Reduce Motion.
- Onboarding rebuilt as 4 full-bleed scenes (what this is / paper-not-real / meet Tars / choose your track), typography-led, one idea per screen, progress via page dots that stretch (like iOS setup). PAPER disclosure is scene 2 — before anything else.
- First-run choreography: onboarding hands off to launch animation exactly once, seamlessly.
- **Apple bar:** the first 10 seconds feel like unboxing an Apple product.

### Phase 18 — Workspace & terminal (iPad flagship)
- Rebuild on Phases 4/5/13: glass panel headers with micro labels, top-light hairlines, void background with aurora, preset switcher as sliding-capsule segmented control in a floating glass toolbar.
- The tape (quotes strip) redesigned: condensed monospaced, quiet-tape flash rules, scrolls under glass chrome.
- Empty panel states designed (Phase 27 system) — a fresh workspace looks intentional, not broken.
- **Apple bar:** the north-star iPad frame from Phase 1 is now the live app, pixel-for-pixel.

### Phase 19 — Chart 2.0
- Axis system: labels in `caption` monospaced at `ink.tertiary`, gridlines at 4% white, no boxed borders — the chart floats in the panel.
- Crosshair: hairline + glass readout lozenge that follows finger/pointer, `Haptics.tick()` on candle detents; readout shows OHLC + delta from last close.
- Candles: 1pt gap minimum, wicks 1pt, gain/loss body colors at 90% with 100% wick; volume as 12%-opacity baseline bars.
- Interactions: pinch-zoom anchored at gesture centroid, two-finger pan, double-tap to auto-fit (`spatial`), long-press enters drawing mode.
- iPhone landscape = immersive full-screen chart (chrome fades out, rotates in via `spatial`).
- Timeframe switcher: sliding capsule; chart morphs between timeframes via `ticker` on shared price scale (no white-flash reload — skeleton only on cold load).
- **Apple bar:** side-by-side with Stocks' chart, ours is equally calm and strictly more capable.

### Phase 20 — Order ticket: the signature interaction
- The moment the app is judged by. Detented glass sheet (iPhone) / docked panel (iPad), identical anatomy: symbol header with live price, side toggle (sliding capsule, gain/loss tinted), qty stepper with acceleration, order-type selector, estimated cost line that rolls as qty changes.
- **Submit = press-and-hold ring**: hold the CTA 0.6s, a ring draws around it (`variableColor` progress), haptic ramps, release-before-complete cancels — deliberate, unmistakable, un-fat-fingerable. (Slide-to-confirm rejected: harder one-handed.)
- Fill choreography: CTA collapses into a progress capsule → double-tap haptic on fill → capsule flips to fill price with `numericText` roll → auto-dismisses after 1.2s to reveal the new position glowing briefly in the positions panel (matched geometry from capsule to position row).
- Rejection: capsule shakes 2×4pt, `failure` haptic, reason in plain language below — never a modal alert.
- **Apple bar:** filling an order feels as satisfying as Apple Pay's checkmark; nobody ever submits accidentally.

### Phase 21 — Portfolio & positions
- Equity hero: `display` numeral with day-change `PercentText` beneath; sparkline of the day behind at 8% opacity; time-range capsule (1D/1W/1M/1Y/All) morphs the curve via `ticker`.
- Positions list: 52pt rows, symbol + qty left, price + P&L right in tabular columns that align across rows; swipe left = close position (leads to Phase 20 flow), swipe right = add note (journal).
- Allocation view: a single elegant bar (not a pie), segments animate width on rebalance, tap a segment to filter the list below (matched highlight).
- Closed-position history grouped by day with subtle date headers (micro caps).
- **Apple bar:** the equity screen is screenshot-worthy — the frame users post.

### Phase 22 — Symbol detail
- Hero transition arrival (Phase 8). Header: symbol + name, `priceHero` with roll, day range as a thin position-indicator bar.
- Sections in cards on panel: chart (Phase 19 embedded), key stats grid (tabular, 2×4), news list, position-if-held card (glows on arrival if just traded), Tars insight card ("what moved this?" — explanatory, never directive).
- Sticky trade CTA: floating glass capsule bottom-trailing, hides on scroll-down/returns on scroll-up.
- **Apple bar:** feels like Stocks' detail page grew pro muscles without losing composure.

### Phase 23 — Tars panel & chat
- Tars mark idle animation: 4s breathing loop (aperture 2% scale), `.pulse` while thinking, saccade toward tapped panels (subtle — personality, not clippy).
- Chat: Tars messages on void (no bubble — text floats with the mark), user messages in `tint.interactive` 12% capsules trailing; streaming responses type via reveal mask, code/numbers in mono cards.
- Rich responses: inline mini-charts and payoff curves render as first-class cards with the chart system, not screenshots.
- The mentor tone visualized: critique cards ("here's the risk you're not seeing") use warning tint hairline — visually honest, never alarmist.
- **Apple bar:** talking to Tars feels like Siri's polish with a hedge-fund brain — and the mascot never gets annoying (test: 30 minutes of use, zero desire to disable it).

### Phase 24 — Academy
- Track home: cards with custom-symbol icons, progress rings (`grand` fill on appear), locked lessons at 40% with no lock icon (quiet hierarchy, not jail bars).
- Lesson reading: measure capped at 68 characters, `body` at 17pt with 1.4 line height, serif-free; section transitions scroll-driven; key terms tappable → glass definition popover.
- Interactive widgets (payoff builder, risk sliders) restyled on the control system — these are the "wow" screenshots; each gets a micro-interaction pass.
- Completion: checkmark draws (trim), ring closes, `success` haptic, confetti *rejected* — a single `grand` glow pulse instead (Law 10).
- **Apple bar:** reading a lesson is as pleasant as Apple News+; interacting with a widget feels like a Playground.

### Phase 25 — Agent Lab
- Agent cards: glass, agent-purple identity edge, live sparkline of paper P&L, status via symbol effect (running = pulse, stopped = static, killed = desaturated).
- Builder: strategy blocks as stackable cards with drag reordering (lift + shadow + haptic), parameter sliders with value rolls, validation inline (never modal).
- Backtest report: honesty-first design — equity curve with drawdown shading, the "backtest honesty line" (out-of-sample divider) as a labeled hairline, metrics in tabular grid, overfit warnings in warning tint. No green-washed hero numbers (hard rule: CAGR never larger type than max drawdown).
- Kill switch: red-ringed, requires Phase 20-style press-and-hold with wiggle symbol effect during arm — deliberately weighty.
- **Apple bar:** the backtest report reads like an Apple Health study card — data-dense, honest, beautiful.

### Phase 26 — Utility surfaces (screener, alerts, journal, options)
- Screener: filter chips (sliding capsules), results in tabular rows with inline sparklines; saving a screen names it inline (no alert dialog).
- Alerts: armed alerts as quiet rows with condition in mono; trigger history with the exact price/time; creating an alert from a chart = drag a hairline to the level (delightful, spatial).
- Journal: entry cards with trade context auto-attached (mini chart of entry/exit points), writing view is the Academy reading experience in reverse.
- Options chain: strike ladder with ATM auto-centered, ITM shading via 6% tint fields, greeks in mono `caption`; payoff sandbox graph animates strategy changes via `ticker`. PAPER-sandbox badge persistent.
- **Apple bar:** even the "boring" screens survive the north-star comparison — no surface was left behind.

---

# Act V — Polish & Proof (Phases 27–30)

### Phase 27 — Empty, loading, error: the states system
- One vocabulary: **skeletons** (shimmer blocks matching final layout, never spinners) for loading; **empty states** = one custom symbol + one sentence + one action, vertically centered at 40% height; **errors** = inline, human, actionable ("Massive is rate-limiting us — retrying in 20s"), never a bare alert.
- Offline mode: glass banner, cached data stays visible but desaturates per Phase 11 staleness rule.
- Every one of the 36 surfaces gets its three states designed in a states table; no default gray "No Data".
- **Apple bar:** kill the network mid-session — the app degrades so gracefully it almost looks intentional.

### Phase 28 — Accessibility as design
- Dynamic Type: full AX1–AX5 audit per Phase 3; layouts that break get bespoke large-type variants (ticket stacks vertically, tabs gain labels).
- VoiceOver: rotor-friendly ordering, custom actions on rows (trade/alert/journal), live-price announcements throttled to focus (never a firehose), charts get audio graph support (`AXChart`).
- Contrast: Increase Contrast variant of the token set (hairlines → 20%, tertiary ink promoted); Reduce Transparency swaps glass for opaque panel; Reduce Motion per Phase 7; color-blind-safe P&L (gain/loss differ in luminance 20%+, and every color signal has a shape/sign redundancy — ▲▼ already in `PercentText`).
- **Apple bar:** the app is fully tradeable eyes-free with VoiceOver; passes every Accessibility Inspector audit with zero issues.

### Phase 29 — App icon & brand assets
- Icon: the Tars mark aperture on the void with a single gain-green light edge — flat, geometric, no gradient bloat; drawn on the Apple icon grid. Variants: dark (system), tinted (system, monochrome mark), plus one alternate "terminal green" icon as a user reward for finishing an Academy track.
- In-app brand moments: About screen, launch mark, TestFlight/App Store screenshot frames (Phase 1 north-stars, re-shot on final build), 30s App Preview storyboard using only real UI motion (no motion graphics — the app *is* the motion graphic).
- **Apple bar:** the icon holds up at 29pt next to Apple's first-party row on a real home screen.

### Phase 30 — The gauntlet: design QA & sign-off
- Device matrix walkthrough: iPhone SE-class small, 16 Pro, 16 Pro Max, iPad mini, 11", 13", each in light/dark × default/AX3 type × Reduce Motion on/off — scripted 20-minute run-through per config, filed defects ranked by the Ten Laws.
- Performance as design: 120Hz sustained during chart streaming + ticker storm (Instruments: zero >8ms frames in a 5-minute session); launch-to-interactive < 1.5s cold.
- The **"Would Apple ship it?" checklist** — 100 binary questions distilled from Phases 1–29 (every law, every bar), self-scored; anything failing becomes the punch list.
- Freeze: tag `design-v2-complete`, re-shoot all marketing screenshots, update SHIP_CHECKLIST.
- **Apple bar:** the checklist scores 100/100, and the Phase 1 defect list is empty.

---

## Sequencing notes
- Acts are ordered by dependency: **I is load-bearing** (every later phase consumes its tokens), II before IV (surfaces are rebuilt *on* the motion system), III before IV (surfaces are rebuilt *into* the adaptive shells), V is last but Phase 27's states system should be designed early enough that Act IV surfaces adopt it (slot after Phase 16 if running strictly linearly).
- Each phase = one reviewable commit wave when coding begins; north-star frames (Phase 1) are the standing acceptance test for all of them.
- Nothing in this plan adds features, endpoints, or data — it is 100% presentation, motion, and structure. Hard rules from CLAUDE.md (PAPER badge, no directive advice, no performance claims) are treated as design constraints throughout.
