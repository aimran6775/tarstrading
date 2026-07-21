import SwiftUI
import Charts
import Foundation

// MARK: - Risk & portfolio teaching widgets
// Four interactive sandboxes: position sizing, leverage, compounding, and
// correlation. All simulations are deterministically seeded — same inputs,
// same picture — because a lesson that changes its mind every render isn't
// a lesson. Everything except the four deliverable widgets is fileprivate.

// MARK: Deterministic RNG (SplitMix64)

fileprivate struct RiskRNG {
    private var state: UInt64
    init(seed: UInt64) { state = seed &+ 0x9E3779B97F4A7C15 }
    mutating func next() -> UInt64 {
        state &+= 0x9E3779B97F4A7C15
        var z = state
        z = (z ^ (z >> 30)) &* 0xBF58476D1CE4E5B9
        z = (z ^ (z >> 27)) &* 0x94D049BB133111EB
        return z ^ (z >> 31)
    }
    /// Uniform in [0, 1).
    mutating func unit() -> Double {
        Double(next() >> 11) * (1.0 / 9_007_199_254_740_992.0)
    }
    /// Standard normal via Box–Muller.
    mutating func gaussian() -> Double {
        let u1 = max(unit(), 1e-12)
        let u2 = unit()
        return (-2 * Foundation.log(u1)).squareRoot() * Foundation.cos(2 * .pi * u2)
    }
}

// MARK: Shared formatting

fileprivate func riskCompactUSD(_ v: Double) -> String {
    let a = abs(v)
    let sign = v < 0 ? "−" : ""
    if a >= 1_000_000 { return "\(sign)$\(String(format: "%.1f", a / 1_000_000))M" }
    if a >= 10_000 { return "\(sign)$\(String(format: "%.0f", a / 1_000))k" }
    if a >= 1_000 { return "\(sign)$\(String(format: "%.1f", a / 1_000))k" }
    return "\(sign)$\(String(format: "%.0f", a))"
}

// MARK: Shared chrome

fileprivate struct RiskWidgetCard<Content: View>: View {
    let icon: String
    let title: String
    let subtitle: String
    @ViewBuilder var content: () -> Content

    var body: some View {
        VStack(alignment: .leading, spacing: TarsTheme.Space.l) {
            HStack(spacing: TarsTheme.Space.m) {
                Image(systemName: icon)
                    .font(.system(size: 15, weight: .semibold))
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

fileprivate struct RiskCaption: View {
    let text: String
    var tone: Color = TarsTheme.inkSecondary

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

fileprivate struct RiskSliderRow: View {
    let label: String
    let valueText: String
    @Binding var value: Double
    let range: ClosedRange<Double>
    let step: Double
    var tint: Color = TarsTheme.accent
    /// Optional labeled tick drawn on the track (fraction 0...1 of the range).
    var marker: (fraction: Double, label: String)? = nil

    var body: some View {
        VStack(alignment: .leading, spacing: TarsTheme.Space.xs) {
            HStack {
                Text(label)
                    .font(TarsTheme.Text.caption)
                    .foregroundStyle(TarsTheme.inkSecondary)
                Spacer()
                Text(valueText)
                    .font(TarsTheme.Text.priceSmall)
                    .foregroundStyle(TarsTheme.inkPrimary)
            }
            Slider(value: $value, in: range, step: step)
                .tint(tint)
                .accessibilityLabel(label)
                .accessibilityValue(valueText)
                .overlay(alignment: .topLeading) {
                    if let marker {
                        GeometryReader { geo in
                            // Slider track is inset by roughly the thumb radius.
                            let inset: CGFloat = 14
                            let x = inset + (geo.size.width - inset * 2) * marker.fraction
                            VStack(spacing: 1) {
                                RoundedRectangle(cornerRadius: 1)
                                    .fill(TarsTheme.paperBadge)
                                    .frame(width: 2, height: 8)
                                Text(marker.label)
                                    .font(TarsTheme.Text.micro)
                                    .foregroundStyle(TarsTheme.paperBadge)
                                    .fixedSize()
                            }
                            .position(x: x, y: geo.size.height + 6)
                        }
                        .allowsHitTesting(false)
                    }
                }
                .padding(.bottom, marker == nil ? 0 : TarsTheme.Space.l)
        }
    }
}

fileprivate struct RiskChip: View {
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
        .accessibilityAddTraits(active ? [.isSelected] : [])
    }
}

fileprivate struct RiskStat: View {
    let label: String
    let value: String
    var color: Color = TarsTheme.inkPrimary

    var body: some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(label)
                .font(TarsTheme.Text.micro)
                .foregroundStyle(TarsTheme.inkTertiary)
                .textCase(.uppercase)
            Text(value)
                .font(TarsTheme.Text.price)
                .foregroundStyle(color)
                .contentTransition(.numericText())
                .lineLimit(1)
                .minimumScaleFactor(0.6)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .accessibilityElement(children: .combine)
    }
}

/// Horizontal shake used by the margin-call slam. One unit of `shakes`
/// sweeps a few damped oscillations, then rests at identity.
fileprivate struct RiskShakeEffect: GeometryEffect {
    var shakes: CGFloat
    var animatableData: CGFloat {
        get { shakes }
        set { shakes = newValue }
    }
    func effectValue(size: CGSize) -> ProjectionTransform {
        let phase = shakes.truncatingRemainder(dividingBy: 1)
        let translation = -9 * Foundation.sin(phase * .pi * 7) * (1 - phase)
        return ProjectionTransform(CGAffineTransform(translationX: translation, y: 0))
    }
}

// MARK: - 1. Position Sizer

/// Kelly / fixed-fraction sandbox. Same strategy, different bet size,
/// very different lives.
struct PositionSizerWidget: View {
    @State private var winRate: Double = 0.45        // 30–70 %
    @State private var winLossRatio: Double = 1.5    // 0.5–3
    @State private var riskPct: Double = 2.0         // 0.5–10 %
    @State private var drawProgress: CGFloat = 0

    private let startingEquity = 10_000.0
    private let tradeCount = 100
    private let ruinLine = 2_000.0

    var body: some View {
        RiskWidgetCard(
            icon: "scalemass",
            title: "Position Sizer",
            subtitle: "Same edge, different bet size — 100 trades, $10,000, no mercy."
        ) {
            chart
            controls
            RiskCaption(text: ruinCaption, tone: ruinCount > 20 ? TarsTheme.loss : TarsTheme.inkSecondary)
            RiskCaption(
                text: "Deterministic sandbox: same settings always replay the same 100 trades. Ghost lines are five alternate histories with the same odds. Half-Kelly is a math landmark, not advice.",
                tone: TarsTheme.inkTertiary
            )
        }
        .onAppear { replayDraw() }
    }

    // MARK: Simulation

    private func run(seed: UInt64) -> [Double] {
        var rng = RiskRNG(seed: seed)
        var equity = startingEquity
        var out = [equity]
        out.reserveCapacity(tradeCount + 1)
        let risk = riskPct / 100
        for _ in 0..<tradeCount {
            let win = rng.unit() < winRate
            equity += win ? equity * risk * winLossRatio : -(equity * risk)
            equity = max(equity, 1)
            out.append(equity)
        }
        return out
    }

    private var mainRun: [Double] { run(seed: 7) }
    private var ghostRuns: [[Double]] { [11, 22, 33, 44, 55].map { run(seed: $0) } }

    /// Across 100 seeded traders with these settings, how many dipped below
    /// the ruin line at any point.
    private var ruinCount: Int {
        (0..<100).reduce(into: 0) { count, seed in
            if run(seed: UInt64(seed) &+ 1_000).contains(where: { $0 < ruinLine }) {
                count += 1
            }
        }
    }

    private var halfKelly: Double? {
        let f = winRate - (1 - winRate) / winLossRatio
        guard f > 0 else { return nil }
        return f / 2
    }

    private var ruinCaption: String {
        guard halfKelly != nil else {
            return "With a \(Int(winRate * 100))% win rate and \(String(format: "%.1f", winLossRatio))-to-1 payoff, you have no edge. Kelly says the correct size is zero. So does arithmetic."
        }
        if ruinCount == 0 {
            return "At \(String(format: "%.1f", riskPct))% risk per trade, none of 100 simulated traders fell below $2,000. Small bets are boring. Boring survives."
        }
        return "At \(String(format: "%.1f", riskPct))% risk per trade, \(ruinCount) of 100 simulated traders with the exact same edge dipped below $2,000. The edge was fine. The size was not."
    }

    // MARK: Views

    private var chart: some View {
        let main = mainRun
        let ghosts = ghostRuns
        let allValues = ghosts.flatMap { $0 } + main
        let lo = max(1, min(allValues.min() ?? 1, 1_500) * 0.8)
        let hi = (allValues.max() ?? startingEquity) * 1.2

        return Chart {
            ForEach(Array(ghosts.enumerated()), id: \.offset) { g, series in
                ForEach(Array(series.enumerated()), id: \.offset) { i, v in
                    LineMark(
                        x: .value("Trade", i),
                        y: .value("Equity", v),
                        series: .value("Run", "ghost-\(g)")
                    )
                    .foregroundStyle(TarsTheme.inkTertiary.opacity(0.30))
                    .lineStyle(StrokeStyle(lineWidth: 1))
                }
            }
            ForEach(Array(main.enumerated()), id: \.offset) { i, v in
                LineMark(
                    x: .value("Trade", i),
                    y: .value("Equity", v),
                    series: .value("Run", "main")
                )
                .foregroundStyle(TarsTheme.pnl((main.last ?? startingEquity) - startingEquity))
                .lineStyle(StrokeStyle(lineWidth: 2, lineCap: .round))
            }
            RuleMark(y: .value("Ruin", ruinLine))
                .foregroundStyle(TarsTheme.loss.opacity(0.5))
                .lineStyle(StrokeStyle(lineWidth: 1, dash: [4, 4]))
                .annotation(position: .bottom, alignment: .leading) {
                    Text("ruin line")
                        .font(TarsTheme.Text.micro)
                        .foregroundStyle(TarsTheme.loss.opacity(0.8))
                }
            RuleMark(y: .value("Start", startingEquity))
                .foregroundStyle(TarsTheme.hairline)
                .lineStyle(StrokeStyle(lineWidth: 1, dash: [2, 4]))
        }
        .chartYScale(domain: lo...hi, type: .log)
        .chartXAxis {
            AxisMarks(values: [0, 25, 50, 75, 100]) { v in
                AxisGridLine().foregroundStyle(TarsTheme.hairline)
                AxisValueLabel {
                    if let t = v.as(Int.self) {
                        Text("\(t)")
                            .font(TarsTheme.Text.micro)
                            .foregroundStyle(TarsTheme.inkTertiary)
                    }
                }
            }
        }
        .chartYAxis {
            AxisMarks(position: .trailing) { v in
                AxisGridLine().foregroundStyle(TarsTheme.hairline)
                AxisValueLabel {
                    if let d = v.as(Double.self) {
                        Text(riskCompactUSD(d))
                            .font(TarsTheme.Text.micro)
                            .foregroundStyle(TarsTheme.inkTertiary)
                    }
                }
            }
        }
        .frame(height: 190)
        .mask(alignment: .leading) {
            GeometryReader { geo in
                Rectangle().frame(width: geo.size.width * drawProgress)
            }
        }
        .animation(Motion.ticker, value: winRate)
        .animation(Motion.ticker, value: winLossRatio)
        .animation(Motion.ticker, value: riskPct)
        .accessibilityLabel("Equity curve over 100 simulated trades, starting at $10,000 and ending at \(riskCompactUSD(main.last ?? startingEquity)), with five fainter alternate runs and a ruin line at $2,000")
    }

    private var controls: some View {
        VStack(spacing: TarsTheme.Space.m) {
            RiskSliderRow(
                label: "Win rate",
                valueText: "\(Int(winRate * 100))%",
                value: $winRate, range: 0.30...0.70, step: 0.01
            )
            RiskSliderRow(
                label: "Win / loss ratio",
                valueText: String(format: "%.1f : 1", winLossRatio),
                value: $winLossRatio, range: 0.5...3.0, step: 0.1
            )
            RiskSliderRow(
                label: "Risk per trade",
                valueText: String(format: "%.1f%%", riskPct),
                value: $riskPct, range: 0.5...10.0, step: 0.5,
                tint: riskPct > 5 ? TarsTheme.warning : TarsTheme.accent,
                marker: halfKellyMarker
            )
        }
    }

    private var halfKellyMarker: (fraction: Double, label: String)? {
        guard let hk = halfKelly else { return nil }
        let pct = hk * 100
        guard pct >= 0.5, pct <= 10 else { return nil }
        return (fraction: (pct - 0.5) / 9.5, label: "½ Kelly")
    }

    private func replayDraw() {
        drawProgress = 0
        Task { @MainActor in
            try? await Task.sleep(for: .milliseconds(80))
            withAnimation(Motion.grand) { drawProgress = 1 }
        }
    }
}

// MARK: - 2. Leverage Simulator

/// Blow up an account, safely. The tuition is fake; the arithmetic is not.
struct LeverageSimulatorWidget: View {
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    @State private var seed: UInt64 = 4242
    @State private var leverage: Double = 3
    @State private var cursor: Double = 0     // 0...steps scrub position
    @State private var playing = false
    @State private var playTask: Task<Void, Never>? = nil
    @State private var marginCalled = false
    @State private var shakes: CGFloat = 0

    private let startingEquity = 10_000.0
    private let steps = 160

    var body: some View {
        RiskWidgetCard(
            icon: "bolt.trianglebadge.exclamationmark",
            title: "Leverage Simulator",
            subtitle: "Blow up an account, safely. Tuition: $0."
        ) {
            statRow
            ZStack {
                chart
                if marginCalled { marginCallOverlay }
            }
            .modifier(RiskShakeEffect(shakes: shakes))
            transport
            RiskSliderRow(
                label: "Leverage",
                valueText: "\(Int(leverage))×",
                value: $leverage, range: 1...10, step: 1,
                tint: leverage >= 5 ? TarsTheme.loss : (leverage >= 3 ? TarsTheme.warning : TarsTheme.accent)
            )
            RiskCaption(
                text: "Leverage multiplies both directions, but losses compound against you: −50% needs +100% just to get back to even, and −100% has no next trade. That is the whole reason professionals size small — not caution, arithmetic.",
                tone: TarsTheme.inkTertiary
            )
        }
        .onChange(of: leverage) { _, _ in resetRun(newSeed: false) }
        .onDisappear { playTask?.cancel() }
    }

    // MARK: Simulation

    /// Seeded volatile daily returns — same seed, same market.
    private var returns: [Double] {
        var rng = RiskRNG(seed: seed)
        return (0..<steps).map { _ in
            var r = rng.gaussian() * 0.021 + 0.0004
            if rng.unit() < 0.05 { r *= 2.6 }   // occasional fat tail
            return r
        }
    }

    /// Underlying price as cumulative % change.
    private var pricePath: [Double] {
        var acc = 1.0
        return [0.0] + returns.map { r in
            acc *= (1 + r)
            return acc - 1
        }
    }

    /// Equity as % change at the chosen leverage; clamped at −100%.
    private var equityPath: [Double] {
        var equity = startingEquity
        var out = [0.0]
        out.reserveCapacity(steps + 1)
        for r in returns {
            if equity <= 0 { out.append(-1); continue }
            equity *= (1 + leverage * r)
            equity = max(equity, 0)
            out.append(equity / startingEquity - 1)
        }
        return out
    }

    private var wipeIndex: Int? {
        equityPath.firstIndex(where: { $0 <= -1 })
    }

    private var shownIndex: Int { min(Int(cursor), steps) }
    private var equityNow: Double { startingEquity * (1 + equityPath[shownIndex]) }

    // MARK: Views

    private var statRow: some View {
        HStack(alignment: .top) {
            RiskStat(
                label: "Equity",
                value: "",
                color: TarsTheme.inkPrimary
            )
            .overlay(alignment: .bottomLeading) {
                TickerText(value: equityNow)
            }
            VStack(alignment: .leading, spacing: 2) {
                Text("RETURN")
                    .font(TarsTheme.Text.micro)
                    .foregroundStyle(TarsTheme.inkTertiary)
                PercentText(value: equityPath[shownIndex], font: TarsTheme.Text.price)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            RiskStat(
                label: "Day",
                value: "\(shownIndex) / \(steps)",
                color: TarsTheme.inkSecondary
            )
        }
    }

    private var chart: some View {
        let price = pricePath
        let equity = equityPath
        let upper = max(0.4, (equity.max() ?? 0) * 1.15)

        return Chart {
            ForEach(0...shownIndex, id: \.self) { i in
                LineMark(
                    x: .value("Day", i),
                    y: .value("Change", price[i]),
                    series: .value("Series", "price")
                )
                .foregroundStyle(TarsTheme.inkTertiary.opacity(0.6))
                .lineStyle(StrokeStyle(lineWidth: 1))
            }
            ForEach(0...shownIndex, id: \.self) { i in
                LineMark(
                    x: .value("Day", i),
                    y: .value("Change", equity[i]),
                    series: .value("Series", "equity")
                )
                .foregroundStyle(TarsTheme.pnl(equity[shownIndex]))
                .lineStyle(StrokeStyle(lineWidth: 2, lineCap: .round))
            }
            RuleMark(y: .value("Wipeout", -1.0))
                .foregroundStyle(TarsTheme.loss.opacity(0.55))
                .lineStyle(StrokeStyle(lineWidth: 1, dash: [4, 4]))
                .annotation(position: .top, alignment: .leading) {
                    Text("−100% · margin call")
                        .font(TarsTheme.Text.micro)
                        .foregroundStyle(TarsTheme.loss.opacity(0.8))
                }
            RuleMark(y: .value("Flat", 0.0))
                .foregroundStyle(TarsTheme.hairline)
        }
        .chartXScale(domain: 0...steps)
        .chartYScale(domain: -1.1...upper)
        .chartXAxis {
            AxisMarks(values: [0, 40, 80, 120, 160]) { v in
                AxisGridLine().foregroundStyle(TarsTheme.hairline)
                AxisValueLabel {
                    if let d = v.as(Int.self) {
                        Text("\(d)")
                            .font(TarsTheme.Text.micro)
                            .foregroundStyle(TarsTheme.inkTertiary)
                    }
                }
            }
        }
        .chartYAxis {
            AxisMarks(position: .trailing) { v in
                AxisGridLine().foregroundStyle(TarsTheme.hairline)
                AxisValueLabel {
                    if let d = v.as(Double.self) {
                        Text(d, format: .percent.precision(.fractionLength(0)))
                            .font(TarsTheme.Text.micro)
                            .foregroundStyle(TarsTheme.inkTertiary)
                    }
                }
            }
        }
        .frame(height: 190)
        .accessibilityLabel("Equity versus underlying price at \(Int(leverage))x leverage")
    }

    private var marginCallOverlay: some View {
        VStack(spacing: TarsTheme.Space.m) {
            Image(systemName: "exclamationmark.octagon.fill")
                .font(.system(size: 30, weight: .bold))
                .foregroundStyle(TarsTheme.loss)
            Text("MARGIN CALL")
                .font(TarsTheme.Text.title)
                .foregroundStyle(TarsTheme.inkPrimary)
                .tracking(3)
            Text("At \(Int(leverage))× the same move that was a rough day at 1× took the whole account. −100% is the only return you can't recover from.")
                .font(TarsTheme.Text.caption)
                .foregroundStyle(TarsTheme.inkSecondary)
                .multilineTextAlignment(.center)
                .fixedSize(horizontal: false, vertical: true)
            HStack(spacing: TarsTheme.Space.s) {
                RiskChip(title: "Replay this market") { resetRun(newSeed: false) }
                RiskChip(title: "Try again", active: true, tint: TarsTheme.loss) {
                    resetRun(newSeed: true)
                }
            }
        }
        .padding(TarsTheme.Space.xl)
        .background(
            RoundedRectangle(cornerRadius: TarsTheme.Radius.m, style: .continuous)
                .fill(TarsTheme.bg0.opacity(0.94))
                .overlay(
                    RoundedRectangle(cornerRadius: TarsTheme.Radius.m, style: .continuous)
                        .strokeBorder(TarsTheme.loss.opacity(0.6), lineWidth: 1)
                )
        )
        .transition(.scale(scale: 0.85).combined(with: .opacity))
        .zIndex(1)
    }

    private var transport: some View {
        HStack(spacing: TarsTheme.Space.m) {
            Button {
                playing ? stopPlayback() : startPlayback()
            } label: {
                Image(systemName: playing ? "pause.fill" : "play.fill")
                    .font(.system(size: 15, weight: .semibold))
                    .foregroundStyle(TarsTheme.bg0)
                    .frame(width: 36, height: 36)
                    .background(Circle().fill(TarsTheme.accent))
            }
            .buttonStyle(PressableStyle())
            .disabled(marginCalled)
            .opacity(marginCalled ? 0.4 : 1)
            .accessibilityLabel(playing ? "Pause" : "Play")

            Slider(
                value: $cursor,
                in: 0...Double(steps),
                onEditingChanged: { editing in
                    if editing { stopPlayback() }
                    checkMarginCall()
                }
            )
            .tint(TarsTheme.accent)
            .disabled(marginCalled)
            .accessibilityLabel("Scrub timeline")
            .accessibilityValue("Day \(shownIndex) of \(steps)")

            Button {
                resetRun(newSeed: false)
            } label: {
                Image(systemName: "arrow.counterclockwise")
                    .font(.system(size: 14, weight: .semibold))
                    .foregroundStyle(TarsTheme.inkSecondary)
                    .frame(width: 36, height: 36)
                    .background(Circle().fill(TarsTheme.bg3))
            }
            .buttonStyle(PressableStyle())
            .accessibilityLabel("Reset")
        }
        .onChange(of: cursor) { _, _ in checkMarginCall() }
    }

    // MARK: Control flow

    private func startPlayback() {
        guard !marginCalled else { return }
        if Int(cursor) >= steps { cursor = 0 }
        playing = true
        Haptics.tap()
        playTask?.cancel()
        playTask = Task { @MainActor in
            while !Task.isCancelled, Int(cursor) < steps, !marginCalled {
                try? await Task.sleep(for: .milliseconds(45))
                guard !Task.isCancelled else { break }
                withAnimation(Motion.ticker) { cursor += 1 }
                checkMarginCall()
            }
            playing = false
        }
    }

    private func stopPlayback() {
        playTask?.cancel()
        playTask = nil
        playing = false
    }

    private func checkMarginCall() {
        guard !marginCalled, let w = wipeIndex, shownIndex >= w else { return }
        stopPlayback()
        cursor = Double(w)
        withAnimation(Motion.snappy) { marginCalled = true }
        Haptics.failure()
        if !reduceMotion {
            withAnimation(.linear(duration: 0.45)) { shakes += 1 }
        }
    }

    private func resetRun(newSeed: Bool) {
        stopPlayback()
        if newSeed { seed = seed &* 6_364_136_223_846_793_005 &+ 1 }
        withAnimation(Motion.spatial) {
            marginCalled = false
            cursor = 0
        }
    }
}

// MARK: - 3. Compounding Curve

/// Time-in-market visualizer: 30 years of contributions, and the price of
/// missing the ten best months.
struct CompoundingCurveWidget: View {
    @State private var monthlyContribution: Double = 300   // $50–$1,000
    @State private var annualReturnPct: Double = 7         // 1–12 %
    @State private var missBestMonths = false
    @State private var drawProgress: CGFloat = 0

    private let months = 360
    private let missedCount = 10

    var body: some View {
        RiskWidgetCard(
            icon: "chart.line.uptrend.xyaxis",
            title: "Compounding Curve",
            subtitle: "Thirty years, one habit, and the ten months that matter most."
        ) {
            statRow
            chart
            VStack(spacing: TarsTheme.Space.m) {
                RiskSliderRow(
                    label: "Monthly contribution",
                    valueText: "$\(Int(monthlyContribution))",
                    value: $monthlyContribution, range: 50...1_000, step: 50
                )
                RiskSliderRow(
                    label: "Average annual return",
                    valueText: String(format: "%.1f%%", annualReturnPct),
                    value: $annualReturnPct, range: 1...12, step: 0.5
                )
            }
            Toggle(isOn: $missBestMonths.animation(Motion.spatial)) {
                VStack(alignment: .leading, spacing: 2) {
                    Text("Miss the 10 best months")
                        .font(TarsTheme.Text.body)
                        .foregroundStyle(TarsTheme.inkPrimary)
                    Text("Sit in cash for just the ten strongest months out of 360.")
                        .font(TarsTheme.Text.micro)
                        .foregroundStyle(TarsTheme.inkTertiary)
                }
            }
            .tint(TarsTheme.warning)
            .onChange(of: missBestMonths) { _, _ in Haptics.tick() }
            RiskCaption(text: caption, tone: missBestMonths ? TarsTheme.warning : TarsTheme.inkTertiary)
        }
        .onAppear { replayDraw() }
    }

    // MARK: Simulation

    /// Fixed standardized shocks — the "market" is the same for every slider
    /// setting, so only your choices move the curve.
    private var shocks: [Double] {
        var rng = RiskRNG(seed: 77)
        return (0..<months).map { _ in rng.gaussian() }
    }

    private var monthlyReturns: [Double] {
        let mean = annualReturnPct / 100 / 12
        return shocks.map { mean + 0.032 * $0 }
    }

    private var bestMonthIndices: Set<Int> {
        Set(
            monthlyReturns.enumerated()
                .sorted { $0.element > $1.element }
                .prefix(missedCount)
                .map(\.offset)
        )
    }

    private func balancePath(skipping skipped: Set<Int>) -> [Double] {
        var balance = 0.0
        var out = [0.0]
        out.reserveCapacity(months + 1)
        for (i, r) in monthlyReturns.enumerated() {
            balance += monthlyContribution
            balance *= 1 + (skipped.contains(i) ? 0 : r)
            balance = max(balance, 0)
            out.append(balance)
        }
        return out
    }

    private var fullyInvested: [Double] { balancePath(skipping: []) }
    private var missedBest: [Double] { balancePath(skipping: bestMonthIndices) }

    private var caption: String {
        let full = fullyInvested.last ?? 0
        let missed = missedBest.last ?? 0
        let cost = full - missed
        let pct = full > 0 ? cost / full : 0
        if missBestMonths {
            return "Skipping only the 10 best months out of 360 costs \(riskCompactUSD(cost)) — about \(Int(pct * 100))% of the ending balance. The best months don't send invitations; they tend to arrive right next to the worst ones. That's the case for time in market, not timing it."
        }
        return "Contributions do the early work; compounding does the late work. Most of the curve's height shows up in the last decade — which is exactly the part you forfeit by starting later."
    }

    // MARK: Views

    private var statRow: some View {
        HStack(alignment: .top) {
            VStack(alignment: .leading, spacing: 2) {
                Text("AFTER 30 YEARS")
                    .font(TarsTheme.Text.micro)
                    .foregroundStyle(TarsTheme.inkTertiary)
                TickerText(
                    value: (missBestMonths ? missedBest : fullyInvested).last ?? 0,
                    format: .currency(code: "USD").precision(.fractionLength(0))
                )
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            RiskStat(
                label: "Contributed",
                value: riskCompactUSD(monthlyContribution * Double(months)),
                color: TarsTheme.inkSecondary
            )
            if missBestMonths {
                RiskStat(
                    label: "Cost of missing",
                    value: "−" + riskCompactUSD((fullyInvested.last ?? 0) - (missedBest.last ?? 0)),
                    color: TarsTheme.loss
                )
            }
        }
        .animation(Motion.snappy, value: missBestMonths)
    }

    private var chart: some View {
        // Downsample to quarters — 121 points reads the same, renders lighter.
        let stride = 3
        let active = missBestMonths ? missedBest : fullyInvested
        let ghost = fullyInvested
        let activePoints = activePointsSampled(active, stride: stride)
        let ghostPoints = activePointsSampled(ghost, stride: stride)

        return Chart {
            if missBestMonths {
                ForEach(ghostPoints, id: \.0) { yr, v in
                    LineMark(
                        x: .value("Year", yr),
                        y: .value("Balance", v),
                        series: .value("Series", "full")
                    )
                    .foregroundStyle(TarsTheme.inkTertiary.opacity(0.5))
                    .lineStyle(StrokeStyle(lineWidth: 1, dash: [3, 3]))
                }
            }
            ForEach(activePoints, id: \.0) { yr, v in
                AreaMark(
                    x: .value("Year", yr),
                    y: .value("Balance", v)
                )
                .foregroundStyle(missBestMonths ? TarsTheme.chartLoss : TarsTheme.chartGain)
                LineMark(
                    x: .value("Year", yr),
                    y: .value("Balance", v),
                    series: .value("Series", "active")
                )
                .foregroundStyle(missBestMonths ? TarsTheme.warning : TarsTheme.gain)
                .lineStyle(StrokeStyle(lineWidth: 2, lineCap: .round))
            }
        }
        .chartXAxis {
            AxisMarks(values: [0, 10, 20, 30]) { v in
                AxisGridLine().foregroundStyle(TarsTheme.hairline)
                AxisValueLabel {
                    if let yr = v.as(Int.self) {
                        Text("yr \(yr)")
                            .font(TarsTheme.Text.micro)
                            .foregroundStyle(TarsTheme.inkTertiary)
                    }
                }
            }
        }
        .chartYAxis {
            AxisMarks(position: .trailing) { v in
                AxisGridLine().foregroundStyle(TarsTheme.hairline)
                AxisValueLabel {
                    if let d = v.as(Double.self) {
                        Text(riskCompactUSD(d))
                            .font(TarsTheme.Text.micro)
                            .foregroundStyle(TarsTheme.inkTertiary)
                    }
                }
            }
        }
        .frame(height: 180)
        .mask(alignment: .leading) {
            GeometryReader { geo in
                Rectangle().frame(width: geo.size.width * drawProgress)
            }
        }
        .animation(Motion.spatial, value: missBestMonths)
        .animation(Motion.ticker, value: monthlyContribution)
        .animation(Motion.ticker, value: annualReturnPct)
        .accessibilityLabel("Thirty-year balance chart, ending at \(riskCompactUSD(active.last ?? 0))\(missBestMonths ? ", with a dashed fully-invested line ending at \(riskCompactUSD(ghost.last ?? 0))" : "")")
    }

    private func activePointsSampled(_ series: [Double], stride: Int) -> [(Double, Double)] {
        Swift.stride(from: 0, through: months, by: stride).map { i in
            (Double(i) / 12.0, series[i])
        }
    }

    private func replayDraw() {
        drawProgress = 0
        Task { @MainActor in
            try? await Task.sleep(for: .milliseconds(80))
            withAnimation(Motion.grand) { drawProgress = 1 }
        }
    }
}

// MARK: - 4. Correlation Matrix

fileprivate enum RiskAsset: Int, CaseIterable, Identifiable {
    case stocks, bonds, gold, crypto
    var id: Int { rawValue }
    var name: String {
        switch self {
        case .stocks: "Stocks"
        case .bonds: "Bonds"
        case .gold: "Gold"
        case .crypto: "Crypto"
        }
    }
    var icon: String {
        switch self {
        case .stocks: "chart.line.uptrend.xyaxis"
        case .bonds: "building.columns"
        case .gold: "circle.hexagongrid.fill"
        case .crypto: "bitcoinsign.circle"
        }
    }
    /// Annualized volatility, order-of-magnitude honest.
    var vol: Double {
        switch self {
        case .stocks: 0.16
        case .bonds: 0.06
        case .gold: 0.14
        case .crypto: 0.72
        }
    }
}

/// Pairwise correlations in calm markets…
fileprivate let riskCalmCorrelation: [[Double]] = [
    // stocks bonds  gold  crypto
    [1.00, -0.20, 0.10, 0.50],
    [-0.20, 1.00, 0.20, 0.00],
    [0.10, 0.20, 1.00, 0.10],
    [0.50, 0.00, 0.10, 1.00],
]

/// …and in a crisis, when everything decides to be the same trade.
fileprivate let riskCrisisCorrelation: [[Double]] = [
    [1.00, 0.60, 0.85, 0.95],
    [0.60, 1.00, 0.65, 0.55],
    [0.85, 0.65, 1.00, 0.90],
    [0.95, 0.55, 0.90, 1.00],
]

/// Diversification interactive: allocation sliders, a volatility gauge, and
/// the crisis toggle that shows where the free lunch runs out.
struct CorrelationMatrixWidget: View {
    @State private var rawWeights: [Double] = [40, 30, 20, 10]
    @State private var crisis = false

    var body: some View {
        RiskWidgetCard(
            icon: "square.grid.2x2",
            title: "Correlation Matrix",
            subtitle: "Diversification: the only free lunch — served with limits."
        ) {
            HStack(alignment: .top, spacing: TarsTheme.Space.xl) {
                gauge
                    .frame(width: 150)
                heatGrid
            }
            .frame(maxWidth: .infinity)
            presets
            tiles
            crisisToggle
            RiskCaption(text: caption, tone: crisis ? TarsTheme.loss : TarsTheme.inkTertiary)
        }
    }

    // MARK: Math

    private var weights: [Double] {
        let sum = rawWeights.reduce(0, +)
        guard sum > 0 else { return [0.25, 0.25, 0.25, 0.25] }
        return rawWeights.map { $0 / sum }
    }

    private var correlation: [[Double]] {
        crisis ? riskCrisisCorrelation : riskCalmCorrelation
    }

    private var portfolioVol: Double {
        let w = weights
        let assets = RiskAsset.allCases
        var variance = 0.0
        for i in assets.indices {
            for j in assets.indices {
                variance += w[i] * w[j] * assets[i].vol * assets[j].vol * correlation[i][j]
            }
        }
        return max(variance, 0).squareRoot()
    }

    private var gaugeColor: Color {
        let v = portfolioVol
        if v < 0.12 { return TarsTheme.gain }
        if v < 0.30 { return TarsTheme.warning }
        return TarsTheme.loss
    }

    private var caption: String {
        if crisis {
            return "In a crisis, correlations lurch toward 1 and assets that spent years ignoring each other fall together. Diversification still helped on the way in — it just helps least on the exact day you want it most. A limit, not a lie."
        }
        let allInOne = rawWeights.contains(where: { $0 >= rawWeights.reduce(0, +) * 0.99 })
        if allInOne {
            return "Everything in one asset means the portfolio's ride is that asset's ride, undiluted. Spreading across things that don't move together lowers the bumps without requiring a crystal ball."
        }
        return "Mixing assets that don't move in lockstep lowers portfolio volatility below the weighted average of the parts. That's the entire trick — and it's math, not magic."
    }

    // MARK: Views

    private var gauge: some View {
        let fraction = min(portfolioVol / 0.8, 1)
        return VStack(spacing: TarsTheme.Space.s) {
            ZStack {
                Circle()
                    .trim(from: 0, to: 0.75)
                    .stroke(TarsTheme.bg3, style: StrokeStyle(lineWidth: 10, lineCap: .round))
                    .rotationEffect(.degrees(135))
                Circle()
                    .trim(from: 0, to: 0.75 * fraction)
                    .stroke(gaugeColor, style: StrokeStyle(lineWidth: 10, lineCap: .round))
                    .rotationEffect(.degrees(135))
                    .animation(Motion.spatial, value: fraction)
                    .animation(Motion.spatial, value: crisis)
                VStack(spacing: 0) {
                    Text(portfolioVol, format: .percent.precision(.fractionLength(1)))
                        .font(TarsTheme.Text.price)
                        .foregroundStyle(TarsTheme.inkPrimary)
                        .contentTransition(.numericText())
                        .animation(Motion.ticker, value: portfolioVol)
                    Text("VOLATILITY")
                        .font(TarsTheme.Text.micro)
                        .foregroundStyle(TarsTheme.inkTertiary)
                }
            }
            .frame(width: 120, height: 120)
            .accessibilityLabel("Portfolio volatility")
            .accessibilityValue("\(Int(portfolioVol * 100)) percent annualized")
            Text("annualized, estimated")
                .font(TarsTheme.Text.micro)
                .foregroundStyle(TarsTheme.inkTertiary)
        }
    }

    private var heatGrid: some View {
        let assets = RiskAsset.allCases
        return Grid(horizontalSpacing: 3, verticalSpacing: 3) {
            GridRow {
                Color.clear.frame(width: 34, height: 16)
                ForEach(assets) { a in
                    Text(String(a.name.prefix(3)).uppercased())
                        .font(TarsTheme.Text.micro)
                        .foregroundStyle(TarsTheme.inkTertiary)
                        .frame(maxWidth: .infinity)
                }
            }
            ForEach(assets) { row in
                GridRow {
                    Text(String(row.name.prefix(3)).uppercased())
                        .font(TarsTheme.Text.micro)
                        .foregroundStyle(TarsTheme.inkTertiary)
                        .frame(width: 34, alignment: .trailing)
                    ForEach(assets) { col in
                        cell(correlation[row.rawValue][col.rawValue], isDiagonal: row == col)
                    }
                }
            }
        }
        .frame(maxWidth: .infinity)
        .animation(Motion.spatial, value: crisis)
        .accessibilityLabel("Correlation matrix, \(crisis ? "crisis" : "calm") regime")
    }

    private func cell(_ rho: Double, isDiagonal: Bool) -> some View {
        // High positive correlation is what hurts a diversifier; negative helps.
        let tint: Color = isDiagonal
            ? TarsTheme.bg3
            : (rho >= 0
                ? TarsTheme.loss.opacity(0.12 + 0.45 * rho)
                : TarsTheme.gain.opacity(0.12 + 0.45 * (-rho)))
        return RoundedRectangle(cornerRadius: 4, style: .continuous)
            .fill(tint)
            .frame(height: 26)
            .overlay(
                Text(isDiagonal ? "—" : String(format: "%+.1f", rho))
                    .font(TarsTheme.Text.micro.monospacedDigit())
                    .foregroundStyle(isDiagonal ? TarsTheme.inkTertiary : TarsTheme.inkPrimary)
                    .contentTransition(.numericText())
            )
    }

    private var presets: some View {
        HStack(spacing: TarsTheme.Space.s) {
            RiskChip(title: "All in one") {
                withAnimation(Motion.spatial) { rawWeights = [100, 0, 0, 0] }
            }
            RiskChip(title: "Spread out") {
                withAnimation(Motion.spatial) { rawWeights = [25, 25, 25, 25] }
            }
            Spacer()
        }
    }

    private var tiles: some View {
        let grid = [GridItem(.flexible(), spacing: TarsTheme.Space.m),
                    GridItem(.flexible(), spacing: TarsTheme.Space.m)]
        return LazyVGrid(columns: grid, spacing: TarsTheme.Space.m) {
            ForEach(RiskAsset.allCases) { asset in
                assetTile(asset)
            }
        }
    }

    private func assetTile(_ asset: RiskAsset) -> some View {
        VStack(alignment: .leading, spacing: TarsTheme.Space.s) {
            HStack {
                Image(systemName: asset.icon)
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundStyle(TarsTheme.accent)
                Text(asset.name)
                    .font(TarsTheme.Text.caption)
                    .foregroundStyle(TarsTheme.inkPrimary)
                Spacer()
                Text(weights[asset.rawValue], format: .percent.precision(.fractionLength(0)))
                    .font(TarsTheme.Text.priceSmall)
                    .foregroundStyle(TarsTheme.inkSecondary)
                    .contentTransition(.numericText())
                    .animation(Motion.ticker, value: weights[asset.rawValue])
            }
            Slider(
                value: Binding(
                    get: { rawWeights[asset.rawValue] },
                    set: { rawWeights[asset.rawValue] = $0 }
                ),
                in: 0...100
            )
            .tint(TarsTheme.accent)
            .accessibilityLabel("\(asset.name) allocation")
            .accessibilityValue("\(Int(weights[asset.rawValue] * 100)) percent")
            Text("vol \(Int(asset.vol * 100))%")
                .font(TarsTheme.Text.micro.monospacedDigit())
                .foregroundStyle(TarsTheme.inkTertiary)
        }
        .padding(TarsTheme.Space.m)
        .background(
            RoundedRectangle(cornerRadius: TarsTheme.Radius.s, style: .continuous)
                .fill(TarsTheme.bg3.opacity(0.6))
                .overlay(
                    RoundedRectangle(cornerRadius: TarsTheme.Radius.s, style: .continuous)
                        .strokeBorder(TarsTheme.hairline, lineWidth: 1)
                )
        )
    }

    private var crisisToggle: some View {
        Toggle(isOn: $crisis.animation(Motion.spatial)) {
            VStack(alignment: .leading, spacing: 2) {
                Text("Crisis mode")
                    .font(TarsTheme.Text.body)
                    .foregroundStyle(TarsTheme.inkPrimary)
                Text("Watch correlations lurch toward 1 when everyone sells everything.")
                    .font(TarsTheme.Text.micro)
                    .foregroundStyle(TarsTheme.inkTertiary)
            }
        }
        .tint(TarsTheme.loss)
        .onChange(of: crisis) { _, on in
            on ? Haptics.warning() : Haptics.tick()
        }
    }
}

// MARK: - Preview

#Preview("Risk widgets") {
    ScrollView {
        VStack(spacing: TarsTheme.Space.xl) {
            PositionSizerWidget()
            LeverageSimulatorWidget()
            CompoundingCurveWidget()
            CorrelationMatrixWidget()
        }
        .padding(TarsTheme.Space.xl)
    }
    .background(TarsTheme.bg0)
    .preferredColorScheme(.dark)
}
