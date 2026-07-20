import SwiftUI
import Charts
import Foundation

// MARK: - Macro teaching widgets
// Two interactive sandboxes: a futures term-structure sculptor (contango /
// backwardation and the roll) and a yield-curve sculptor (normal / flat /
// inverted). Both are pure teaching toys — hand-tuned demo numbers, no live
// data, no predictions. Everything except the two deliverable widgets is
// fileprivate, prefixed MW to avoid colliding with sibling widget files.

// MARK: Shared chrome

fileprivate struct MWWidgetCard<Content: View>: View {
    let icon: String
    let title: String
    let subtitle: String
    @ViewBuilder var content: () -> Content

    var body: some View {
        VStack(alignment: .leading, spacing: TarsTheme.Space.l) {
            HStack(spacing: TarsTheme.Space.m) {
                Image(systemName: icon)
                    .font(TarsTheme.Text.heading)
                    .foregroundStyle(TarsTheme.accent)
                    .frame(width: 32, height: 32)
                    .background(
                        RoundedRectangle(cornerRadius: TarsTheme.Radius.s, style: .continuous)
                            .fill(TarsTheme.bg3)
                    )
                VStack(alignment: .leading, spacing: 2) {
                    Text(title)
                        .font(TarsTheme.Text.heading)
                        .foregroundStyle(TarsTheme.inkPrimary)
                    Text(subtitle)
                        .font(TarsTheme.Text.caption)
                        .foregroundStyle(TarsTheme.inkSecondary)
                }
            }
            content()
        }
        .padding(TarsTheme.Space.l)
        .tarsPanel(elevation: 2)
    }
}

fileprivate struct MWCaption: View {
    let text: String
    var tone: Color = TarsTheme.accent

    var body: some View {
        HStack(alignment: .top, spacing: TarsTheme.Space.m) {
            RoundedRectangle(cornerRadius: 1, style: .continuous)
                .fill(tone.opacity(0.8))
                .frame(width: 2)
            Text(text)
                .font(TarsTheme.Text.caption)
                .foregroundStyle(TarsTheme.inkSecondary)
                .fixedSize(horizontal: false, vertical: true)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }
}

fileprivate struct MWChip: View {
    let title: String
    var active: Bool = false
    var tint: Color = TarsTheme.accent
    let action: () -> Void

    var body: some View {
        Button {
            Haptics.tap()
            action()
        } label: {
            Text(title)
                .font(TarsTheme.Text.caption)
                .foregroundStyle(active ? TarsTheme.bg0 : TarsTheme.inkPrimary)
                .padding(.horizontal, TarsTheme.Space.m)
                .padding(.vertical, TarsTheme.Space.s)
                .background(
                    Capsule(style: .continuous)
                        .fill(active ? tint : TarsTheme.bg3)
                )
                .overlay(
                    Capsule(style: .continuous)
                        .strokeBorder(TarsTheme.hairline, lineWidth: active ? 0 : 1)
                )
        }
        .buttonStyle(PressableStyle())
    }
}

fileprivate struct MWHintText: View {
    let text: String
    var body: some View {
        Label(text, systemImage: "hand.draw")
            .font(TarsTheme.Text.micro)
            .foregroundStyle(TarsTheme.inkTertiary)
    }
}

/// Status badge that can pulse its stroke when `pulses` is true.
/// Reduce Motion turns the pulse into a steady highlight.
fileprivate struct MWPulsingBadge: View {
    let text: String
    let color: Color
    var pulses: Bool = false
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var on = false

    var body: some View {
        Text(text)
            .font(TarsTheme.Text.micro)
            .foregroundStyle(color)
            .padding(.horizontal, TarsTheme.Space.m)
            .padding(.vertical, TarsTheme.Space.xs + 2)
            .background(
                Capsule(style: .continuous)
                    .fill(color.opacity(on ? 0.24 : 0.12))
            )
            .overlay(
                Capsule(style: .continuous)
                    .strokeBorder(color.opacity(on ? 0.9 : 0.35), lineWidth: 1)
            )
            .scaleEffect(on ? 1.04 : 1.0)
            .onChange(of: pulses, initial: true) { _, nowPulsing in
                if nowPulsing {
                    if reduceMotion {
                        on = true  // steady emphasis, no repeatForever
                    } else {
                        withAnimation(.easeInOut(duration: 0.7).repeatForever(autoreverses: true)) {
                            on = true
                        }
                    }
                } else {
                    withAnimation(Motion.snappy) { on = false }
                }
            }
    }
}

// MARK: - Term structure widget

fileprivate enum MWTermPreset: String, CaseIterable, Identifiable {
    case contango = "Contango"
    case backwardation = "Backwardation"
    var id: String { rawValue }

    var prices: [Double] {
        switch self {
        case .contango:
            [76.4, 77.9, 79.2, 80.3, 81.2, 82.0, 82.7, 83.3]
        case .backwardation:
            [82.6, 80.7, 79.2, 78.1, 77.2, 76.5, 76.0, 75.6]
        }
    }
}

/// Animated "roll" strip between contract month 1 and 2: a dot travels
/// M1 → M2 while the readout shows what that roll costs (or pays).
fileprivate struct MWRollArrow: View {
    let m1: Double
    let m2: Double
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    private var rollPnL: Double { m1 - m2 }   // sell M1, buy M2
    private var rollPct: Double { m2 == 0 ? 0 : (m1 - m2) / m2 }
    private var tone: Color { TarsTheme.pnl(rollPnL) }

    var body: some View {
        VStack(alignment: .leading, spacing: TarsTheme.Space.s) {
            HStack(spacing: TarsTheme.Space.m) {
                monthChip(label: "M1 · sell", price: m1)
                track
                monthChip(label: "M2 · buy", price: m2)
            }
            HStack(spacing: TarsTheme.Space.s) {
                Text("Roll:")
                    .font(TarsTheme.Text.caption)
                    .foregroundStyle(TarsTheme.inkSecondary)
                Text(rollPnL, format: .currency(code: "USD").precision(.fractionLength(2)).sign(strategy: .always(showZero: false)))
                    .font(TarsTheme.Text.priceSmall)
                    .foregroundStyle(tone)
                    .contentTransition(.numericText(value: rollPnL))
                    .animation(Motion.ticker, value: rollPnL)
                Text("/ bbl")
                    .font(TarsTheme.Text.micro)
                    .foregroundStyle(TarsTheme.inkTertiary)
                PercentText(value: rollPct, font: TarsTheme.Text.priceSmall)
                Spacer()
                Text(rollPnL >= 0 ? "the roll pays you" : "you pay the roll")
                    .font(TarsTheme.Text.micro)
                    .foregroundStyle(tone)
            }
        }
        .padding(TarsTheme.Space.m)
        .background(
            RoundedRectangle(cornerRadius: TarsTheme.Radius.s, style: .continuous)
                .fill(TarsTheme.bg3.opacity(0.6))
        )
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("Roll from month one to month two")
        .accessibilityValue("Sell month one at \(String(format: "%.2f", m1)) dollars, buy month two at \(String(format: "%.2f", m2)) dollars. Roll of \(String(format: "%+.2f", rollPnL)) dollars per barrel.")
    }

    private func monthChip(label: String, price: Double) -> some View {
        VStack(spacing: 2) {
            Text(label)
                .font(TarsTheme.Text.micro)
                .foregroundStyle(TarsTheme.inkTertiary)
                .textCase(.uppercase)
            Text(price, format: .currency(code: "USD").precision(.fractionLength(2)))
                .font(TarsTheme.Text.priceSmall)
                .foregroundStyle(TarsTheme.inkPrimary)
                .contentTransition(.numericText(value: price))
                .animation(Motion.ticker, value: price)
        }
        .padding(.horizontal, TarsTheme.Space.s)
        .padding(.vertical, TarsTheme.Space.xs)
        .background(
            RoundedRectangle(cornerRadius: TarsTheme.Radius.s, style: .continuous)
                .fill(TarsTheme.bg2)
        )
    }

    /// The animated conveyor: dot travels left → right, fading in and out.
    private var track: some View {
        TimelineView(.animation(minimumInterval: 1.0 / 30.0, paused: reduceMotion)) { ctx in
            let period = 1.8
            let t = ctx.date.timeIntervalSinceReferenceDate
                .truncatingRemainder(dividingBy: period) / period
            GeometryReader { geo in
                let w = geo.size.width
                let y = geo.size.height / 2
                ZStack(alignment: .leading) {
                    Capsule(style: .continuous)
                        .fill(TarsTheme.hairline)
                        .frame(height: 2)
                        .position(x: w / 2, y: y)
                    Image(systemName: "chevron.right")
                        .font(TarsTheme.Text.micro)
                        .foregroundStyle(tone.opacity(0.7))
                        .position(x: w - 4, y: y)
                    Circle()
                        .fill(tone)
                        .frame(width: 7, height: 7)
                        .position(x: reduceMotion ? w / 2 : 4 + (w - 14) * t, y: y)
                        .opacity(reduceMotion ? 0.9 : Foundation.sin(.pi * t))
                }
            }
        }
        .frame(height: 20)
        .frame(maxWidth: .infinity)
        .accessibilityHidden(true)
    }
}

/// Futures curve sandbox: eight contract months you can drag, with presets
/// that morph the curve into contango or backwardation, and a live readout
/// of what rolling the front month would cost.
struct TermStructureWidget: View {
    @State private var prices: [Double] = MWTermPreset.contango.prices
    @State private var preset: MWTermPreset? = .contango
    @State private var dragIndex: Int? = nil

    private let monthCount = 8
    private let priceFloor = 62.0
    private let priceCeiling = 95.0

    private var isContango: Bool { prices[1] >= prices[0] }

    var body: some View {
        MWWidgetCard(
            icon: "chart.xyaxis.line",
            title: "Term Structure",
            subtitle: "Demo crude futures — eight contract months, zero real barrels"
        ) {
            HStack {
                ForEach(MWTermPreset.allCases) { p in
                    MWChip(title: p.rawValue, active: preset == p) {
                        withAnimation(Motion.fluid) {
                            prices = p.prices
                            preset = p
                        }
                    }
                }
                Spacer()
                MWHintText(text: "drag any point")
            }

            chart
                .frame(height: 220)

            MWRollArrow(m1: prices[0], m2: prices[1])

            MWCaption(text: rollStory, tone: TarsTheme.pnl(prices[0] - prices[1]))
            MWCaption(
                text: "Roll yield is the quiet tax (or rebate) of holding futures: every month a long position sells the expiring contract and buys the next one out. The shape of this curve decides whether that swap costs money or pays it. It says nothing about where spot goes next — it never did.",
                tone: TarsTheme.inkTertiary
            )
        }
    }

    private var rollStory: String {
        if isContango {
            "Upward slope — contango. Storage, insurance, and financing all cost money, and the curve knows it. Rolling a long here means selling the cheap month and buying the dearer one, again and again. Nobody sends an invoice; the curve just collects."
        } else {
            "Downward slope — backwardation. The market is paying a premium for barrels right now, so rolling a long actually earns the swap. One of the few polite gestures futures markets make — and they retract it without notice."
        }
    }

    private var chart: some View {
        Chart {
            ForEach(0..<monthCount, id: \.self) { i in
                LineMark(
                    x: .value("Month", Double(i)),
                    y: .value("Price", prices[i])
                )
                .interpolationMethod(.catmullRom)
                .foregroundStyle(TarsTheme.accent)
                .lineStyle(StrokeStyle(lineWidth: 2.5, lineCap: .round))

                AreaMark(
                    x: .value("Month", Double(i)),
                    y: .value("Price", prices[i])
                )
                .interpolationMethod(.catmullRom)
                .foregroundStyle(
                    LinearGradient(
                        colors: [TarsTheme.accent.opacity(0.20), TarsTheme.accent.opacity(0.0)],
                        startPoint: .top, endPoint: .bottom)
                )

                PointMark(
                    x: .value("Month", Double(i)),
                    y: .value("Price", prices[i])
                )
                .symbolSize(dragIndex == i ? 220 : 110)
                .foregroundStyle(dragIndex == i ? TarsTheme.inkPrimary : TarsTheme.accent)
            }
        }
        .chartXScale(domain: -0.4...(Double(monthCount) - 0.6))
        .chartYScale(domain: (priceFloor - 2)...(priceCeiling + 2))
        .chartXAxis {
            AxisMarks(values: (0..<monthCount).map(Double.init)) { value in
                AxisValueLabel {
                    if let v = value.as(Double.self) {
                        Text("M\(Int(v) + 1)")
                            .font(TarsTheme.Text.micro)
                            .foregroundStyle(TarsTheme.inkTertiary)
                    }
                }
            }
        }
        .chartYAxis {
            AxisMarks(position: .trailing) { value in
                AxisGridLine().foregroundStyle(TarsTheme.hairline)
                AxisValueLabel {
                    if let v = value.as(Double.self) {
                        Text("$\(Int(v))")
                            .font(TarsTheme.Text.micro)
                            .foregroundStyle(TarsTheme.inkTertiary)
                    }
                }
            }
        }
        .chartOverlay { proxy in
            GeometryReader { geo in
                Rectangle()
                    .fill(Color.clear)
                    .contentShape(Rectangle())
                    .gesture(dragGesture(proxy: proxy, geo: geo))
            }
        }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("Futures curve, eight contract months")
        .accessibilityValue(
            (0..<monthCount)
                .map { "M\($0 + 1) \(String(format: "%.0f", prices[$0])) dollars" }
                .joined(separator: ", ")
        )
    }

    private func dragGesture(proxy: ChartProxy, geo: GeometryProxy) -> some Gesture {
        DragGesture(minimumDistance: 0)
            .onChanged { g in
                guard let anchor = proxy.plotFrame else { return }
                let frame = geo[anchor]
                let px = g.location.x - frame.minX
                let py = g.location.y - frame.minY
                let idx: Int
                if let held = dragIndex {
                    idx = held
                } else {
                    guard let xVal: Double = proxy.value(atX: px) else { return }
                    idx = min(max(Int(xVal.rounded()), 0), monthCount - 1)
                    dragIndex = idx
                    Haptics.tap()
                }
                guard let yVal: Double = proxy.value(atY: py) else { return }
                let clamped = min(max(yVal, priceFloor), priceCeiling)
                if abs(prices[idx] - clamped) > 0.001 {
                    let wasContango = isContango
                    prices[idx] = clamped
                    preset = nil
                    if wasContango != isContango { Haptics.tick() }
                }
            }
            .onEnded { _ in
                dragIndex = nil
            }
    }
}

// MARK: - Yield curve sculptor

fileprivate enum MWCurvePreset: String, CaseIterable, Identifiable {
    case y2019 = "2019"
    case y2021 = "2021"
    case y2023 = "2023"
    case today = "Today-ish"
    var id: String { rawValue }

    /// Yields in percent for 3M, 2Y, 5Y, 10Y, 20Y, 30Y.
    var yields: [Double] {
        switch self {
        case .y2019: [2.40, 2.50, 2.50, 2.60, 2.85, 3.00]
        case .y2021: [0.05, 0.20, 0.80, 1.50, 2.00, 2.10]
        case .y2023: [5.40, 4.90, 4.20, 4.00, 4.35, 4.20]
        case .today: [4.30, 4.00, 4.10, 4.40, 4.80, 4.90]
        }
    }
}

fileprivate enum MWCurveShape {
    case normal, flat, inverted

    var label: String {
        switch self {
        case .normal: "NORMAL"
        case .flat: "FLAT"
        case .inverted: "INVERTED"
        }
    }
    var color: Color {
        switch self {
        case .normal: TarsTheme.gain
        case .flat: TarsTheme.inkSecondary
        case .inverted: TarsTheme.warning
        }
    }
    var story: String {
        switch self {
        case .normal:
            "Upward slope — the textbook resting state. Lenders demand extra yield to lock money up longer, and the market expects growth it can live with. Historically the least newsworthy shape, which is exactly its charm."
        case .flat:
            "Flat — the market shrugging. Short and long money pay about the same, which usually reads as late-cycle indecision. 2019 looked like this. What followed had nothing to do with the curve, which is its own lesson about signals."
        case .inverted:
            "Inverted — short money out-earns long money. This shape has preceded most modern U.S. recessions, with lead times from about six months to two years, plus the occasional false alarm. A signal, not a schedule. Nobody rings a bell."
        }
    }
}

/// The star: sculpt the Treasury curve with six draggable nodes, watch the
/// Normal / Flat / INVERTED badge react, and snap to famous historical shapes.
struct YieldCurveSculptorWidget: View {
    @State private var yields: [Double] = MWCurvePreset.today.yields
    @State private var preset: MWCurvePreset? = .today
    @State private var dragIndex: Int? = nil

    private let tenors = ["3M", "2Y", "5Y", "10Y", "20Y", "30Y"]
    private let yieldFloor = 0.0
    private let yieldCeiling = 6.5

    /// 10Y minus 2Y, in percentage points.
    private var spread: Double { yields[3] - yields[1] }

    private var shape: MWCurveShape {
        if spread < -0.02 { .inverted }
        else if spread < 0.25 { .flat }
        else { .normal }
    }

    var body: some View {
        MWWidgetCard(
            icon: "percent",
            title: "Yield Curve Sculptor",
            subtitle: "Six Treasury tenors, 3M to 30Y — bend history with a finger"
        ) {
            HStack(alignment: .center) {
                MWPulsingBadge(
                    text: shape.label,
                    color: shape.color,
                    pulses: shape == .inverted
                )
                Spacer()
                spreadReadout
            }

            chart
                .frame(height: 250)

            HStack {
                ForEach(MWCurvePreset.allCases) { p in
                    MWChip(title: p.rawValue, active: preset == p) {
                        withAnimation(Motion.fluid) {
                            yields = p.yields
                            preset = p
                        }
                    }
                }
                Spacer()
                MWHintText(text: "drag the nodes")
            }

            MWCaption(text: shape.story, tone: shape.color)
            MWCaption(
                text: "The 10Y−2Y spread is the market's most-watched recession tea leaf. It has a real track record and a real habit of being early, late, or occasionally just wrong. Treat curve shapes as context, not countdowns.",
                tone: TarsTheme.inkTertiary
            )
        }
        .onChange(of: shape) { old, new in
            if new == .inverted { Haptics.warning() } else if old == .inverted { Haptics.tick() }
        }
    }

    private var spreadReadout: some View {
        VStack(alignment: .trailing, spacing: 2) {
            Text("10Y − 2Y SPREAD")
                .font(TarsTheme.Text.micro)
                .foregroundStyle(TarsTheme.inkTertiary)
            HStack(spacing: TarsTheme.Space.xs) {
                PercentText(value: spread / 100, font: TarsTheme.Text.price)
                Text("(\(Int((spread * 100).rounded())) bps)")
                    .font(TarsTheme.Text.priceSmall)
                    .foregroundStyle(TarsTheme.inkTertiary)
                    .contentTransition(.numericText(value: spread))
                    .animation(Motion.ticker, value: spread)
            }
        }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("Ten year minus two year spread")
        .accessibilityValue("\(String(format: "%+.2f", spread)) percentage points, curve \(shape.label.lowercased())")
    }

    private var chart: some View {
        Chart {
            ForEach(0..<tenors.count, id: \.self) { i in
                LineMark(
                    x: .value("Tenor", Double(i)),
                    y: .value("Yield", yields[i])
                )
                .interpolationMethod(.catmullRom)
                .foregroundStyle(shape.color)
                .lineStyle(StrokeStyle(lineWidth: 2.5, lineCap: .round))

                AreaMark(
                    x: .value("Tenor", Double(i)),
                    y: .value("Yield", yields[i])
                )
                .interpolationMethod(.catmullRom)
                .foregroundStyle(
                    LinearGradient(
                        colors: [shape.color.opacity(0.18), shape.color.opacity(0.0)],
                        startPoint: .top, endPoint: .bottom)
                )

                PointMark(
                    x: .value("Tenor", Double(i)),
                    y: .value("Yield", yields[i])
                )
                .symbolSize(dragIndex == i ? 220 : 110)
                .foregroundStyle(dragIndex == i ? TarsTheme.inkPrimary : shape.color)
                .annotation(position: .top, spacing: TarsTheme.Space.s) {
                    if dragIndex == i {
                        Text(yields[i], format: .percent.scale(1).precision(.fractionLength(2)))
                            .font(TarsTheme.Text.priceSmall)
                            .foregroundStyle(TarsTheme.inkPrimary)
                            .padding(.horizontal, TarsTheme.Space.s)
                            .padding(.vertical, TarsTheme.Space.xs)
                            .background(
                                Capsule(style: .continuous).fill(TarsTheme.bg3)
                            )
                    }
                }
            }
            // Reference markers for the two tenors the spread reads from.
            RuleMark(x: .value("Tenor", 1.0))
                .foregroundStyle(TarsTheme.hairline)
                .lineStyle(StrokeStyle(lineWidth: 1, dash: [3, 4]))
            RuleMark(x: .value("Tenor", 3.0))
                .foregroundStyle(TarsTheme.hairline)
                .lineStyle(StrokeStyle(lineWidth: 1, dash: [3, 4]))
        }
        .chartXScale(domain: -0.35...(Double(tenors.count) - 0.65))
        .chartYScale(domain: yieldFloor...yieldCeiling)
        .chartXAxis {
            AxisMarks(values: (0..<tenors.count).map(Double.init)) { value in
                AxisValueLabel {
                    if let v = value.as(Double.self) {
                        let i = Int(v)
                        if tenors.indices.contains(i) {
                            Text(tenors[i])
                                .font(TarsTheme.Text.micro)
                                .foregroundStyle(
                                    (i == 1 || i == 3) ? TarsTheme.inkSecondary : TarsTheme.inkTertiary
                                )
                        }
                    }
                }
            }
        }
        .chartYAxis {
            AxisMarks(position: .trailing, values: [0, 1, 2, 3, 4, 5, 6]) { value in
                AxisGridLine().foregroundStyle(TarsTheme.hairline)
                AxisValueLabel {
                    if let v = value.as(Double.self) {
                        Text("\(Int(v))%")
                            .font(TarsTheme.Text.micro)
                            .foregroundStyle(TarsTheme.inkTertiary)
                    }
                }
            }
        }
        .chartOverlay { proxy in
            GeometryReader { geo in
                Rectangle()
                    .fill(Color.clear)
                    .contentShape(Rectangle())
                    .gesture(dragGesture(proxy: proxy, geo: geo))
            }
        }
        .animation(Motion.snappy, value: dragIndex)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("Yield curve, six tenors from three months to thirty years")
        .accessibilityValue(
            (0..<tenors.count)
                .map { "\(tenors[$0]) \(String(format: "%.2f", yields[$0])) percent" }
                .joined(separator: ", ")
        )
    }

    private func dragGesture(proxy: ChartProxy, geo: GeometryProxy) -> some Gesture {
        DragGesture(minimumDistance: 0)
            .onChanged { g in
                guard let anchor = proxy.plotFrame else { return }
                let frame = geo[anchor]
                let px = g.location.x - frame.minX
                let py = g.location.y - frame.minY
                let idx: Int
                if let held = dragIndex {
                    idx = held
                } else {
                    guard let xVal: Double = proxy.value(atX: px) else { return }
                    idx = min(max(Int(xVal.rounded()), 0), tenors.count - 1)
                    dragIndex = idx
                    Haptics.tap()
                }
                guard let yVal: Double = proxy.value(atY: py) else { return }
                let clamped = min(max(yVal, yieldFloor + 0.05), yieldCeiling - 0.1)
                if abs(yields[idx] - clamped) > 0.001 {
                    yields[idx] = clamped
                    preset = nil
                }
            }
            .onEnded { _ in
                dragIndex = nil
            }
    }
}

// MARK: - Previews

#Preview("Macro widgets") {
    ScrollView {
        VStack(spacing: TarsTheme.Space.xl) {
            TermStructureWidget()
            YieldCurveSculptorWidget()
        }
        .padding(TarsTheme.Space.xl)
    }
    .background(TarsTheme.bg0)
    .preferredColorScheme(.dark)
}
