import SwiftUI
import UIKit

/// The motion engine. All animation in the app flows through these presets and
/// primitives so the whole product moves like one organism.
enum Motion {
    /// Fast, confident — buttons, toggles, selection.
    static let snappy = Animation.spring(response: 0.28, dampingFraction: 0.86)
    /// Default spatial movement — panels, sheets, navigation.
    static let fluid = Animation.spring(response: 0.45, dampingFraction: 0.82)
    /// Slow, luxurious — hero moments, launch, celebrations.
    static let molasses = Animation.spring(response: 0.8, dampingFraction: 0.9)
    /// Continuous value changes — prices, P&L, chart morphs.
    static let ticker = Animation.spring(response: 0.35, dampingFraction: 1.0)
}

// MARK: - Haptics

enum Haptics {
    private static let light = UIImpactFeedbackGenerator(style: .light)
    private static let medium = UIImpactFeedbackGenerator(style: .medium)
    private static let heavy = UIImpactFeedbackGenerator(style: .heavy)
    private static let notify = UINotificationFeedbackGenerator()
    private static let select = UISelectionFeedbackGenerator()

    static func tick() { select.selectionChanged() }          // crosshair detents, steppers
    static func tap() { light.impactOccurred() }              // generic touch response
    static func confirm() { medium.impactOccurred() }         // order staged
    static func fill() { heavy.impactOccurred() }             // order filled
    static func success() { notify.notificationOccurred(.success) }
    static func warning() { notify.notificationOccurred(.warning) }
    static func failure() { notify.notificationOccurred(.error) }
}

// MARK: - Rolling number ticker

/// Odometer-style price display: digits roll vertically on change, colored by
/// direction, then settle back to neutral ink.
struct TickerText: View {
    let value: Double
    var format: FloatingPointFormatStyle<Double>.Currency = .currency(code: "USD")
    var font: Font = TarsTheme.Text.price
    var colorsByDirection = true

    @State private var flash: Color? = nil
    @State private var previous: Double? = nil

    var body: some View {
        Text(value, format: format)
            .font(font)
            .lineLimit(1)
            .minimumScaleFactor(0.55)
            .foregroundStyle(flash ?? TarsTheme.inkPrimary)
            .contentTransition(.numericText(value: value))
            .animation(Motion.ticker, value: value)
            .onChange(of: value) { old, new in
                previous = old
                guard colorsByDirection, old != new else { return }
                withAnimation(Motion.snappy) {
                    flash = new > old ? TarsTheme.gain : TarsTheme.loss
                }
                Task {
                    try? await Task.sleep(for: .milliseconds(900))
                    withAnimation(Motion.molasses) { flash = nil }
                }
            }
    }
}

/// Percent variant with sign and meaning color always on.
struct PercentText: View {
    let value: Double  // 0.0132 = +1.32%
    var font: Font = TarsTheme.Text.priceSmall

    var body: some View {
        Text(value, format: .percent.precision(.fractionLength(2)).sign(strategy: .always()))
            .font(font)
            .lineLimit(1)
            .minimumScaleFactor(0.55)
            .foregroundStyle(TarsTheme.pnl(value))
            .contentTransition(.numericText(value: value))
            .animation(Motion.ticker, value: value)
    }
}

// MARK: - Shimmer skeleton

struct Shimmer: ViewModifier {
    @State private var phase: CGFloat = -1
    func body(content: Content) -> some View {
        content
            .overlay(
                GeometryReader { geo in
                    LinearGradient(
                        colors: [.clear, .white.opacity(0.10), .clear],
                        startPoint: .leading, endPoint: .trailing)
                    .frame(width: geo.size.width * 0.6)
                    .offset(x: phase * geo.size.width * 1.6)
                }
                .allowsHitTesting(false)
            )
            .clipShape(RoundedRectangle(cornerRadius: TarsTheme.Radius.s, style: .continuous))
            .onAppear {
                withAnimation(.linear(duration: 1.4).repeatForever(autoreverses: false)) {
                    phase = 1
                }
            }
    }
}

extension View {
    func shimmering() -> some View { modifier(Shimmer()) }
}

/// Skeleton block for loading states.
struct SkeletonBlock: View {
    var width: CGFloat? = nil
    var height: CGFloat = 14
    var body: some View {
        RoundedRectangle(cornerRadius: 6, style: .continuous)
            .fill(TarsTheme.bg3)
            .frame(width: width, height: height)
            .shimmering()
    }
}

// MARK: - Press feedback

struct PressableStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .scaleEffect(configuration.isPressed ? 0.965 : 1)
            .opacity(configuration.isPressed ? 0.85 : 1)
            .animation(Motion.snappy, value: configuration.isPressed)
    }
}
