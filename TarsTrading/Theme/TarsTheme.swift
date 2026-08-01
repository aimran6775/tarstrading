import SwiftUI

/// The single source of visual truth. Every color, type style, spacing, radius,
/// and material in the app comes from here — no raw literals in views.
///
/// Design laws this file enforces:
/// - One material system: void → panel → card/raised → glass. No orphan grays.
/// - Elevation by light: each step up adds luminance *and* a whisper of
///   blue-violet, so dark surfaces feel lit by the screen, not painted gray.
/// - Color is meaning: green/red = P&L, amber = mode, blue = interactive/Tars,
///   purple = agents. Everything else is ink.
/// - Wide gamut: all color is authored in Display P3.
enum TarsTheme {

    /// Every surface and ink token is a PAIR: the dark world we designed
    /// first, and a light one that keeps the same relationships. Built
    /// with UIColor's dynamic provider so a theme switch needs no view to
    /// know it happened.
    private static func dyn(dark: (Double, Double, Double),
                            light: (Double, Double, Double)) -> Color {
        Color(uiColor: UIColor { trait in
            let c = trait.userInterfaceStyle == .light ? light : dark
            return UIColor(displayP3Red: c.0, green: c.1, blue: c.2, alpha: 1)
        })
    }

    private static func dynA(darkWhite: Double, lightBlack: Double) -> Color {
        Color(uiColor: UIColor { trait in
            trait.userInterfaceStyle == .light
                ? UIColor(white: 0, alpha: lightBlack)
                : UIColor(white: 1, alpha: darkWhite)
        })
    }

    // MARK: Surfaces — 4 elevation steps. Dark rises toward light; light
    // sinks toward gray, so "elevated" still reads as nearer in both.
    static let bg0 = dyn(dark: (0.027, 0.031, 0.051), light: (0.988, 0.988, 0.992))
    static let bg1 = dyn(dark: (0.051, 0.059, 0.092), light: (1.0, 1.0, 1.0))
    static let bg2 = dyn(dark: (0.082, 0.094, 0.139), light: (0.957, 0.960, 0.972))
    static let bg3 = dyn(dark: (0.122, 0.137, 0.196), light: (0.918, 0.925, 0.945))

    // MARK: Ink
    static let inkPrimary = dyn(dark: (0.925, 0.937, 0.965), light: (0.075, 0.086, 0.125))
    static let inkSecondary = dyn(dark: (0.60, 0.63, 0.71), light: (0.32, 0.35, 0.42))
    static let inkTertiary = dyn(dark: (0.40, 0.43, 0.51), light: (0.47, 0.50, 0.57))
    static let inkQuaternary = dyn(dark: (0.27, 0.29, 0.36), light: (0.60, 0.63, 0.69))
    /// Text/glyphs sitting ON a meaning-colored fill. Dark ink on gold or
    /// green reads in both worlds; white would vanish on light gold.
    static let onFill = Color(.displayP3, red: 0.027, green: 0.031, blue: 0.051)
    static let hairline = dynA(darkWhite: 0.07, lightBlack: 0.09)
    static let hairlineStrong = dynA(darkWhite: 0.16, lightBlack: 0.20)

    // MARK: Meaning colors — color is reserved for meaning
    // Light variants are darker: the dark-tuned gold is illegible on white.
    static let gain = dyn(dark: (0.22, 0.82, 0.53), light: (0.05, 0.55, 0.33))
    static let loss = dyn(dark: (0.95, 0.39, 0.44), light: (0.78, 0.13, 0.20))
    /// THE accent. Brand = capital = action: interactive tint, selection,
    /// and the paper mark are all this gold — one saturated voice.
    static let accent = dyn(dark: (1.0, 0.72, 0.20), light: (0.70, 0.46, 0.02))
    static let paperBadge = accent // mode amber — same gold, one voice
    static let warning = dyn(dark: (1.0, 0.62, 0.26), light: (0.72, 0.38, 0.02))
    static let agentPurple = dyn(dark: (0.66, 0.50, 1.0), light: (0.42, 0.26, 0.78))

    /// Signed value → meaning color; zero stays neutral.
    static func pnl(_ value: Double) -> Color {
        if value > 0 { gain } else if value < 0 { loss } else { inkSecondary }
    }

    // MARK: State derivations — formulas, never hand-picked one-offs
    /// Pressed: the surface dims like a physical key taking travel.
    static func pressed(_ color: Color) -> Color { color.opacity(0.82) }
    /// Disabled ink/tint.
    static func disabled(_ color: Color) -> Color { color.opacity(0.38) }
    /// Selected wash behind a tinted control (rows, rail icons, chips).
    static func selectionWash(_ tint: Color) -> Color { tint.opacity(0.14) }

    // MARK: Gradients
    // Chart fills whisper at ~12% → 0 (the Robinhood/Copilot fade), never
    // flood. A chart that reads as a colored block is a chart shouting.
    static let chartGain = LinearGradient(
        colors: [gain.opacity(0.12), gain.opacity(0.0)],
        startPoint: .top, endPoint: .bottom)
    static let chartLoss = LinearGradient(
        colors: [loss.opacity(0.12), loss.opacity(0.0)],
        startPoint: .top, endPoint: .bottom)
    static let tarsAurora = LinearGradient(
        colors: [accent.opacity(0.25), agentPurple.opacity(0.12), .clear],
        startPoint: .topLeading, endPoint: .bottomTrailing)

    /// The top-light: raised surfaces catch light on their upper edge. This is
    /// how depth reads on near-black, where shadows barely work.
    static let topLight = LinearGradient(
        colors: [hairlineStrong, hairline],
        startPoint: .top, endPoint: .bottom)

    /// The whole-workspace mood light: a barely-there wash that leans gain or
    /// loss with the day's P&L. 2-3% opacity — felt, never seen. Lives on the
    /// void layer only, never on glass.
    static func aurora(for dayPnL: Double) -> RadialGradient {
        let tint: Color = dayPnL >= 0 ? gain : loss
        let strength = min(abs(dayPnL) / 2_000, 1.0) * 0.05 + 0.015
        return RadialGradient(
            colors: [tint.opacity(strength), .clear],
            center: .top, startRadius: 0, endRadius: 900)
    }

    // MARK: Type ramp
    // Three voices, strictly cast: SF Pro for UI, SF Rounded for Tars/Academy
    // warmth, monospaced digits for every number that can change.
    // Ramp is Dynamic-Type-native: UI styles track text styles; only display
    // numerals are fixed (they scale down via minimumScaleFactor at the view).
    enum Text {
        /// Display numerals — equity, hero prices. Big enough to feel.
        static let display = Font.system(size: 56, weight: .bold).width(.condensed).monospacedDigit()
        static let displayMedium = Font.system(size: 44, weight: .bold).width(.condensed).monospacedDigit()
        static let hero = Font.system(.largeTitle, design: .rounded, weight: .bold)
        static let title = Font.system(.title2, design: .rounded, weight: .bold)
        static let heading = Font.system(.headline, weight: .semibold)
        /// Data-dense UI text (rows, panels). Tracks Dynamic Type.
        static let body = Font.system(.subheadline)
        /// Long-form reading (Academy lessons, Tars prose).
        static let reading = Font.system(.body)
        static let caption = Font.system(.caption, weight: .medium)
        static let micro = Font.system(.caption2, weight: .semibold)
        static let priceHero = Font.system(size: 36, weight: .semibold).monospacedDigit()
        static let price = Font.system(.body, weight: .semibold).monospacedDigit()
        static let priceSmall = Font.system(.footnote, weight: .medium).monospacedDigit()
        static let mono = Font.system(.footnote, design: .monospaced)
        /// The Sunday Letter's editorial serif voice — the one serif in the app.
        static let letterMasthead = Font.system(.title, design: .serif, weight: .bold)
        static let letterSection = Font.system(.title3, design: .serif, weight: .semibold)
        /// Screen-owning titles ("Markets", "Desk") — condensed bold, the
        /// Kalshi display voice. Sits in content, not in a nav bar.
        static let screenTitle = Font.system(size: 28, weight: .bold).width(.condensed)
    }

    // MARK: Spacing grid & shape
    // 4pt base grid. Screen margins: iPhone 16, iPad 24. Panel padding 16,
    // card padding 12.
    enum Space {
        static let xs: CGFloat = 4
        static let s: CGFloat = 8
        static let m: CGFloat = 12
        static let l: CGFloat = 16
        static let xl: CGFloat = 24
        static let xxl: CGFloat = 32
        static let xxxl: CGFloat = 48
    }

    enum Radius {
        /// Sub-token for thin data marks (sparkline bars, legend chips).
        static let micro: CGFloat = 3
        static let s: CGFloat = 8
        // Terminal radii: 12 for cards, 16 for sheets/glass. The 14/22
        // bubble read consumer-neobank; the pro apps (Linear 6–12, Kalshi
        // 16 sheets) all sit tighter.
        static let m: CGFloat = 12
        static let l: CGFloat = 16
        static let capsule: CGFloat = 999
        /// Concentric radius law: inner radius = outer − inset (floored so
        /// nested corners never go sharp). The single biggest "built by Apple"
        /// tell in nested surfaces.
        static func inner(_ outer: CGFloat, inset: CGFloat) -> CGFloat {
            max(outer - inset, 4)
        }
    }

    // MARK: Control metrics — one set of heights everywhere
    enum Metrics {
        static let row: CGFloat = 44            // minimum list row
        static let rowPrimary: CGFloat = 52     // primary data rows (positions, watchlist)
        static let buttonPrimary: CGFloat = 50
        static let buttonSecondary: CGFloat = 44
        static let buttonCompact: CGFloat = 36
        static let minTarget: CGFloat = 44      // no tap target below this, ever
    }
}

// MARK: - Reusable chrome

/// Flat list rows dim like a physical key taking travel — the pressed
/// state cards used to provide for free.
struct RowPressStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .background(configuration.isPressed ? TarsTheme.bg1 : .clear)
            .animation(.easeOut(duration: 0.12), value: configuration.isPressed)
    }
}

/// Micro-label law: caps, tracked, tertiary. One helper so every section
/// header whispers identically.
struct TarsMicroLabel: View {
    let text: String
    var tone: Color
    init(_ text: String, tone: Color = TarsTheme.inkTertiary) {
        self.text = text; self.tone = tone
    }
    var body: some View {
        Text(text.uppercased())
            .font(TarsTheme.Text.micro)
            .kerning(0.8)
            .foregroundStyle(tone)
            .lineLimit(1)
    }
}

/// A sparkline as a pure renderer — values in, 1.5pt of history out, no
/// axes, no chrome, no fetching. (The legacy `Sparkline` in the watchlist
/// fetches for itself from the old direct-broker era; this one is fed by
/// the platform's vault-served /sparks payload.)
struct SparkPath: View {
    let values: [Double]
    var tone: Color = TarsTheme.inkSecondary
    var body: some View {
        Canvas { ctx, size in
            guard values.count > 1,
                  let lo = values.min(), let hi = values.max(), hi > lo else { return }
            var path = Path()
            for (i, v) in values.enumerated() {
                let x = size.width * CGFloat(i) / CGFloat(values.count - 1)
                let y = size.height * (1 - CGFloat((v - lo) / (hi - lo)))
                if i == 0 { path.move(to: CGPoint(x: x, y: y)) }
                else { path.addLine(to: CGPoint(x: x, y: y)) }
            }
            ctx.stroke(path, with: .color(tone),
                       style: StrokeStyle(lineWidth: 1.5, lineCap: .round, lineJoin: .round))
        }
    }
}

/// The apex — the brand mark, drawn rather than shipped as an asset so it
/// stays crisp at any size. A gold pyramid with its ridge shadowed, the
/// same silhouette as the web's TarsMark and the app icon's rising step.
struct TarsApexMark: View {
    var size: CGFloat = 20
    var body: some View {
        Canvas { ctx, sz in
            let w = sz.width, h = sz.height
            var pyramid = Path()
            pyramid.move(to: CGPoint(x: w * 0.5, y: 0))
            pyramid.addLine(to: CGPoint(x: w, y: h))
            pyramid.addLine(to: CGPoint(x: 0, y: h))
            pyramid.closeSubpath()
            ctx.fill(pyramid, with: .color(TarsTheme.accent))
            // The lit face: the ridge falls from the apex; the right face
            // sits a step darker so the mark reads dimensional while flat.
            var face = Path()
            face.move(to: CGPoint(x: w * 0.5, y: 0))
            face.addLine(to: CGPoint(x: w, y: h))
            face.addLine(to: CGPoint(x: w * 0.62, y: h))
            face.closeSubpath()
            ctx.fill(face, with: .color(TarsTheme.bg0.opacity(0.28)))
        }
        .frame(width: size, height: size)
        .accessibilityHidden(true)
    }
}

/// Quiet session marker: prices look live at 3am unless we say otherwise.
/// Shown wherever equity prices headline while the US session is closed.
struct MarketClosedChip: View {
    var body: some View {
        Label("Market closed", systemImage: "moon.zzz.fill")
            .font(TarsTheme.Text.micro)
            .foregroundStyle(TarsTheme.inkTertiary)
            .padding(.horizontal, TarsTheme.Space.s)
            .padding(.vertical, TarsTheme.Space.xs)
            .background(
                Capsule(style: .continuous).fill(TarsTheme.bg2)
                    .overlay(Capsule(style: .continuous).strokeBorder(TarsTheme.hairline, lineWidth: 1)))
            .accessibilityLabel("US equity market is closed. Prices are from the last session.")
    }
}

/// THE paper-mode stamp. One treatment everywhere the honesty marker appears
/// (Law 9: restyle it endlessly, never dilute it — and never fork it).
struct PaperBadge: View {
    let text: String
    var body: some View {
        Text(text)
            .font(TarsTheme.Text.micro)
            .tracking(1.2)
            .foregroundStyle(TarsTheme.paperBadge)
            .padding(.horizontal, TarsTheme.Space.s)
            .padding(.vertical, TarsTheme.Space.xs)
            .background(
                Capsule(style: .continuous).fill(TarsTheme.paperBadge.opacity(0.12))
                    .overlay(Capsule(style: .continuous)
                        .strokeBorder(TarsTheme.paperBadge.opacity(0.4), lineWidth: 1))
            )
            .accessibilityLabel("\(text) trading mode. No real money.")
    }
}

/// Opaque panel — the workhorse surface. Elevation 1 = panel, 2 = card.
/// Raised surfaces catch a top-light on their upper edge instead of a uniform
/// border: hierarchy by light, not lines.
struct PanelBackground: ViewModifier {
    var elevation: Int = 1
    /// Optional state tint for the border (running agent, active preset) —
    /// replaces the default border instead of stacking a second stroke on it.
    var tint: Color? = nil
    func body(content: Content) -> some View {
        content
            .background(
                RoundedRectangle(cornerRadius: TarsTheme.Radius.m, style: .continuous)
                    .fill(elevation >= 2 ? TarsTheme.bg2 : TarsTheme.bg1)
                    .overlay(
                        RoundedRectangle(cornerRadius: TarsTheme.Radius.m, style: .continuous)
                            .strokeBorder(
                                tint.map(AnyShapeStyle.init)
                                    ?? (elevation >= 2 ? AnyShapeStyle(TarsTheme.topLight) : AnyShapeStyle(TarsTheme.hairline)),
                                lineWidth: 1)
                    )
            )
    }
}

/// Glass — for anything that floats over content: toolbars, the mode banner,
/// the command palette, sheets, docked Tars. Content scrolls *under* glass.
/// Respects Reduce Transparency by swapping to an opaque card.
struct GlassBackground: ViewModifier {
    var radius: CGFloat = TarsTheme.Radius.l
    /// Floating overlays get an ambient shadow; docked glass does not.
    var floating: Bool = false
    @Environment(\.accessibilityReduceTransparency) private var reduceTransparency

    func body(content: Content) -> some View {
        let shape = RoundedRectangle(cornerRadius: radius, style: .continuous)
        return content
            .background {
                if reduceTransparency {
                    shape.fill(TarsTheme.bg2)
                } else {
                    ZStack {
                        shape.fill(.ultraThinMaterial)
                        shape.fill(TarsTheme.bg1.opacity(0.55))
                    }
                }
            }
            .overlay(shape.strokeBorder(TarsTheme.topLight, lineWidth: 1))
            .clipShape(shape)
            .shadow(color: .black.opacity(floating ? 0.35 : 0),
                    radius: floating ? 30 : 0, y: floating ? 10 : 0)
    }
}

extension View {
    func tarsPanel(elevation: Int = 1, tint: Color? = nil) -> some View {
        modifier(PanelBackground(elevation: elevation, tint: tint))
    }
    /// Docked glass chrome (toolbars, banners, tab bars).
    func tarsGlass(radius: CGFloat = TarsTheme.Radius.l) -> some View {
        modifier(GlassBackground(radius: radius, floating: false))
    }
    /// Floating glass overlay (palette, toasts, floating CTAs) — adds ambient shadow.
    func tarsFloatingGlass(radius: CGFloat = TarsTheme.Radius.l) -> some View {
        modifier(GlassBackground(radius: radius, floating: true))
    }
}
