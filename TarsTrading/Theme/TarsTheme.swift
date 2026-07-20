import SwiftUI

/// The single source of visual truth. Every color, type style, spacing, and
/// radius in the app comes from here — no raw Color/Font literals in views.
enum TarsTheme {

    // MARK: Surfaces (dark-first, 4 elevation levels)
    static let bg0 = Color(red: 0.031, green: 0.035, blue: 0.055)   // void — app background
    static let bg1 = Color(red: 0.055, green: 0.063, blue: 0.094)   // panel
    static let bg2 = Color(red: 0.086, green: 0.098, blue: 0.141)   // card
    static let bg3 = Color(red: 0.125, green: 0.141, blue: 0.196)   // raised control

    // MARK: Ink
    static let inkPrimary = Color(red: 0.925, green: 0.937, blue: 0.965)
    static let inkSecondary = Color(red: 0.60, green: 0.63, blue: 0.71)
    static let inkTertiary = Color(red: 0.40, green: 0.43, blue: 0.51)
    static let hairline = Color.white.opacity(0.07)

    // MARK: Meaning colors — color is reserved for meaning
    // Luminance-tuned so red/green don't vibrate against the near-black field.
    static let gain = Color(red: 0.24, green: 0.80, blue: 0.52)      // P&L up
    static let loss = Color(red: 0.94, green: 0.40, blue: 0.44)      // P&L down
    static let accent = Color(red: 0.42, green: 0.62, blue: 1.0)     // interactive / Tars
    static let paperBadge = Color(red: 1.0, green: 0.72, blue: 0.20) // mode amber
    static let warning = Color(red: 1.0, green: 0.62, blue: 0.26)
    static let agentPurple = Color(red: 0.66, green: 0.50, blue: 1.0) // agent activity

    /// Signed value → meaning color; zero stays neutral.
    static func pnl(_ value: Double) -> Color {
        if value > 0 { gain } else if value < 0 { loss } else { inkSecondary }
    }

    // MARK: Gradients
    static let chartGain = LinearGradient(
        colors: [gain.opacity(0.35), gain.opacity(0.0)],
        startPoint: .top, endPoint: .bottom)
    static let chartLoss = LinearGradient(
        colors: [loss.opacity(0.35), loss.opacity(0.0)],
        startPoint: .top, endPoint: .bottom)
    static let tarsAurora = LinearGradient(
        colors: [accent.opacity(0.25), agentPurple.opacity(0.12), .clear],
        startPoint: .topLeading, endPoint: .bottomTrailing)

    /// The whole-workspace mood light: a barely-there wash that leans gain or
    /// loss with the day's P&L. 2-3% opacity — felt, never seen.
    static func aurora(for dayPnL: Double) -> RadialGradient {
        let tint: Color = dayPnL >= 0 ? gain : loss
        let strength = min(abs(dayPnL) / 2_000, 1.0) * 0.05 + 0.015
        return RadialGradient(
            colors: [tint.opacity(strength), .clear],
            center: .top, startRadius: 0, endRadius: 900)
    }

    // MARK: Type scale (monospaced digits for anything numeric)
    enum Text {
        /// Display numerals — equity, hero prices. Big enough to feel.
        static let display = Font.system(size: 56, weight: .bold).width(.condensed).monospacedDigit()
        static let displayMedium = Font.system(size: 44, weight: .bold).width(.condensed).monospacedDigit()
        static let hero = Font.system(size: 40, weight: .bold, design: .rounded)
        static let title = Font.system(size: 26, weight: .bold, design: .rounded)
        static let heading = Font.system(size: 19, weight: .semibold)
        static let body = Font.system(size: 15)
        static let caption = Font.system(size: 12, weight: .medium)
        static let micro = Font.system(size: 10, weight: .semibold)
        static let priceHero = Font.system(size: 36, weight: .semibold).monospacedDigit()
        static let price = Font.system(size: 17, weight: .semibold).monospacedDigit()
        static let priceSmall = Font.system(size: 13, weight: .medium).monospacedDigit()
        static let mono = Font.system(size: 13, design: .monospaced)
    }

    // MARK: Spacing grid & shape
    enum Space {
        static let xs: CGFloat = 4
        static let s: CGFloat = 8
        static let m: CGFloat = 12
        static let l: CGFloat = 16
        static let xl: CGFloat = 24
        static let xxl: CGFloat = 40
    }
    enum Radius {
        static let s: CGFloat = 8
        static let m: CGFloat = 14
        static let l: CGFloat = 22
        static let capsule: CGFloat = 999
    }
}

// MARK: - Reusable chrome

struct PanelBackground: ViewModifier {
    var elevation: Int = 1
    func body(content: Content) -> some View {
        content
            .background(
                RoundedRectangle(cornerRadius: TarsTheme.Radius.m, style: .continuous)
                    .fill(elevation >= 2 ? TarsTheme.bg2 : TarsTheme.bg1)
                    .overlay(
                        RoundedRectangle(cornerRadius: TarsTheme.Radius.m, style: .continuous)
                            .strokeBorder(TarsTheme.hairline, lineWidth: 1)
                    )
            )
    }
}

extension View {
    func tarsPanel(elevation: Int = 1) -> some View {
        modifier(PanelBackground(elevation: elevation))
    }
}
