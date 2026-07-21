import SwiftUI
import UIKit
import CoreHaptics

/// The motion engine. All animation in the app flows through these presets and
/// primitives so the whole product moves like one organism.
///
/// Laws:
/// - No `.linear` outside progress indicators; no `.easeInOut` anywhere.
/// - Every moving thing is interruptible — springs preserve velocity.
/// - Nothing decorative moves: motion communicates state change, spatial
///   origin, or live data, or it doesn't exist.
/// - Reduce Motion is honored: spatial movement becomes crossfade; numeric
///   rolls stay (they're informative, not decorative).
enum Motion {
    /// Touch feedback — the first frame of contact.
    static let instant = Animation.spring(response: 0.20, dampingFraction: 0.90)
    /// Fast, confident — buttons, toggles, selection.
    static let snappy = Animation.spring(response: 0.30, dampingFraction: 0.85)
    /// Default spatial movement — panels, sheets, navigation.
    static let spatial = Animation.spring(response: 0.45, dampingFraction: 0.82)
    /// Slow, luxurious — hero moments, launch, celebrations, color decays.
    static let grand = Animation.spring(response: 0.70, dampingFraction: 0.88)
    /// Continuous value changes — prices, P&L, chart morphs. Critically damped:
    /// numbers glide, never bounce.
    static let ticker = Animation.spring(response: 0.35, dampingFraction: 1.0)

    // Back-compat aliases (pre-charter names); prefer the canonical set above.
    static let fluid = spatial
    static let molasses = grand

    /// Sanctioned breathing loop for the few always-on status glows (mode
    /// banner, live pips). The ONLY place an eased curve is allowed — views
    /// must use this, never ad-hoc .easeInOut. Callers pair it with
    /// repeatForever and a Reduce Motion guard.
    static func breathe(_ duration: Double = 2.2) -> Animation {
        .easeInOut(duration: duration)
    }

    /// Sanctioned continuous rotation for the Tars orbital identity marks.
    /// Constant angular velocity is the point (an orbit, not a movement), so
    /// linear is correct here — and only here.
    static func orbit(_ duration: Double) -> Animation {
        .linear(duration: duration)
    }

    /// Stagger step for choreographed entrances. Max 6 staggered items —
    /// beyond that, animate as a block.
    static let stagger: Double = 0.025

    @MainActor static var reduceMotion: Bool { UIAccessibility.isReduceMotionEnabled }

    /// Spatial presets collapse to a quick fade under Reduce Motion.
    @MainActor static func spatialOrFade(_ preset: Animation = spatial) -> Animation {
        reduceMotion ? .easeOut(duration: 0.2) : preset
    }
}

// MARK: - Haptics

/// The haptic score. Semantic API; signature moments get composed CoreHaptics
/// patterns so staged / filled / rejected are distinguishable by feel alone.
/// Law: no haptic answers *incoming* data — haptics respond to the user's own
/// actions, plus fills and alerts they explicitly armed.
enum Haptics {
    private static let light = UIImpactFeedbackGenerator(style: .light)
    private static let medium = UIImpactFeedbackGenerator(style: .medium)
    private static let heavy = UIImpactFeedbackGenerator(style: .heavy)
    private static let notify = UINotificationFeedbackGenerator()
    private static let select = UISelectionFeedbackGenerator()

    static func tick() { select.selectionChanged() }          // crosshair detents, steppers
    static func tap() { light.impactOccurred() }              // generic touch response
    static func confirm() { medium.impactOccurred() }         // order staged
    static func success() { notify.notificationOccurred(.success) }
    static func warning() { notify.notificationOccurred(.warning) }
    static func failure() { notify.notificationOccurred(.error) }

    // MARK: Signature patterns

    /// Order filled: a heartbeat — strong tap then an echo, 80ms apart.
    static func fill() {
        guard let engine = engine else { heavy.impactOccurred(); return }
        play(engine: engine, events: [
            transient(at: 0, intensity: 0.9, sharpness: 0.55),
            transient(at: 0.08, intensity: 0.45, sharpness: 0.35),
        ]) { heavy.impactOccurred() }
    }

    /// Stop-loss / protective trigger: three descending transients — a falling feeling.
    static func stopTriggered() {
        guard let engine = engine else { notify.notificationOccurred(.warning); return }
        play(engine: engine, events: [
            transient(at: 0, intensity: 0.8, sharpness: 0.6),
            transient(at: 0.10, intensity: 0.55, sharpness: 0.4),
            transient(at: 0.20, intensity: 0.35, sharpness: 0.25),
        ]) { notify.notificationOccurred(.warning) }
    }

    /// Agent kill switch: a continuous rumble ramping down — powering off.
    static func killSwitch() {
        guard let engine = engine else { heavy.impactOccurred(); return }
        let curve = CHHapticParameterCurve(
            parameterID: .hapticIntensityControl,
            controlPoints: [
                .init(relativeTime: 0, value: 1.0),
                .init(relativeTime: 0.3, value: 0.0),
            ],
            relativeTime: 0)
        let event = CHHapticEvent(
            eventType: .hapticContinuous,
            parameters: [
                CHHapticEventParameter(parameterID: .hapticIntensity, value: 0.8),
                CHHapticEventParameter(parameterID: .hapticSharpness, value: 0.3),
            ],
            relativeTime: 0, duration: 0.3)
        do {
            let pattern = try CHHapticPattern(events: [event], parameterCurves: [curve])
            try engine.makePlayer(with: pattern).start(atTime: CHHapticTimeImmediate)
        } catch { heavy.impactOccurred() }
    }

    // MARK: CoreHaptics plumbing

    private static var _engine: CHHapticEngine?
    private static var engineFailed = false
    private static var engine: CHHapticEngine? {
        guard !engineFailed else { return nil }
        if let e = _engine { return e }
        guard CHHapticEngine.capabilitiesForHardware().supportsHaptics else {
            engineFailed = true; return nil
        }
        do {
            let e = try CHHapticEngine()
            e.resetHandler = { try? e.start() }
            e.stoppedHandler = { _ in }
            try e.start()
            _engine = e
            return e
        } catch {
            engineFailed = true
            return nil
        }
    }

    private static func transient(at time: TimeInterval, intensity: Float, sharpness: Float) -> CHHapticEvent {
        CHHapticEvent(eventType: .hapticTransient, parameters: [
            CHHapticEventParameter(parameterID: .hapticIntensity, value: intensity),
            CHHapticEventParameter(parameterID: .hapticSharpness, value: sharpness),
        ], relativeTime: time)
    }

    private static func play(engine: CHHapticEngine, events: [CHHapticEvent], fallback: () -> Void) {
        do {
            let pattern = try CHHapticPattern(events: events, parameters: [])
            try engine.makePlayer(with: pattern).start(atTime: CHHapticTimeImmediate)
        } catch { fallback() }
    }
}

// MARK: - Quiet tape

/// Flash budget: when the whole tape updates in one beat, only a few rows may
/// flash color — the rest roll silently. Keeps a volatile minute feeling calm.
@MainActor
enum FlashBudget {
    private static var windowStart: TimeInterval = 0
    private static var count = 0
    /// Returns true if this update may flash (max 4 per 100ms window).
    static func allowFlash() -> Bool {
        let now = CACurrentMediaTime()
        if now - windowStart > 0.1 { windowStart = now; count = 0 }
        count += 1
        return count <= 4
    }
}

// MARK: - Rolling number ticker

/// Odometer-style price display: digits roll vertically on change, colored by
/// direction, then the color decays back to neutral ink.
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
                guard colorsByDirection, old != new, FlashBudget.allowFlash() else { return }
                withAnimation(Motion.snappy) {
                    flash = new > old ? TarsTheme.gain : TarsTheme.loss
                }
                Task {
                    try? await Task.sleep(for: .milliseconds(900))
                    withAnimation(Motion.grand) { flash = nil }
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
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
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
                guard !reduceMotion else { phase = 0; return }
                withAnimation(.linear(duration: 1.4).repeatForever(autoreverses: false)) {
                    phase = 1
                }
            }
    }
}

extension View {
    func shimmering() -> some View { modifier(Shimmer()) }
}

/// Skeleton block for loading states. Skeletons, never spinners.
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

/// Universal press response: scale + dim within one frame of touch-down —
/// physical key travel, interruptible, velocity-preserving.
struct PressableStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .scaleEffect(configuration.isPressed ? 0.97 : 1)
            .brightness(configuration.isPressed ? -0.06 : 0)
            .animation(Motion.instant, value: configuration.isPressed)
    }
}

// MARK: - Sliding capsule selector

/// Segmented control done the Apple way: the selection is a matched-geometry
/// capsule that *slides* between options — never fades, never jumps.
struct SlidingCapsulePicker<T: Hashable, Label: View>: View {
    let options: [T]
    @Binding var selection: T
    var tint: Color = TarsTheme.accent
    @ViewBuilder var label: (T, Bool) -> Label

    @Namespace private var ns

    var body: some View {
        HStack(spacing: 2) {
            ForEach(options, id: \.self) { option in
                let selected = option == selection
                Button {
                    guard !selected else { return }
                    Haptics.tick()
                    withAnimation(Motion.snappy) { selection = option }
                } label: {
                    label(option, selected)
                        .padding(.horizontal, TarsTheme.Space.m)
                        .frame(minHeight: 30)
                        .background {
                            if selected {
                                Capsule()
                                    .fill(TarsTheme.selectionWash(tint))
                                    .overlay(Capsule().strokeBorder(tint.opacity(0.35), lineWidth: 1))
                                    .matchedGeometryEffect(id: "thumb", in: ns)
                            }
                        }
                        .contentShape(Capsule())
                }
                .buttonStyle(PressableStyle())
                .accessibilityAddTraits(selected ? .isSelected : [])
            }
        }
        .padding(2)
        .background(Capsule().fill(TarsTheme.bg2))
        .overlay(Capsule().strokeBorder(TarsTheme.hairline, lineWidth: 1))
    }
}
