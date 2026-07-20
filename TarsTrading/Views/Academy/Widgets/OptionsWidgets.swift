import SwiftUI
import Charts

// MARK: - Options teaching widgets
// PayoffBuilderWidget — multi-leg payoff diagram sandbox (the crown jewel).
// GreeksLabWidget — animated delta/theta/vega/gamma laboratory.
// All pricing is a deliberately simplified Black-Scholes (zero rates) — these
// are teaching toys, not a pricing desk, and the copy says so.

// MARK: - Simplified Black-Scholes (fileprivate)

fileprivate enum OWBlackScholes {

    struct Greeks {
        var price: Double
        var delta: Double
        var gamma: Double
        var thetaPerDay: Double   // $ per calendar day (negative for longs)
        var vegaPerPoint: Double  // $ per 1 vol point (e.g. 30% → 31%)
    }

    static func normPDF(_ x: Double) -> Double {
        exp(-x * x / 2) / (2 * Double.pi).squareRoot()
    }

    /// Abramowitz & Stegun 7.1.26 — plenty for a classroom.
    static func normCDF(_ x: Double) -> Double {
        let t = 1 / (1 + 0.2316419 * abs(x))
        let poly = t * (0.319381530 + t * (-0.356563782 + t * (1.781477937 + t * (-1.821255978 + t * 1.330274429))))
        let tail = normPDF(abs(x)) * poly
        return x >= 0 ? 1 - tail : tail
    }

    /// Zero-rate Black-Scholes premium.
    static func price(spot: Double, strike: Double, vol: Double, days: Double, isCall: Bool) -> Double {
        greeks(spot: spot, strike: strike, vol: vol, days: days, isCall: isCall).price
    }

    static func greeks(spot: Double, strike: Double, vol: Double, days: Double, isCall: Bool) -> Greeks {
        let t = max(days, 0.05) / 365
        let sigma = max(vol, 0.001)
        let sqrtT = t.squareRoot()
        let d1 = (log(spot / strike) + sigma * sigma / 2 * t) / (sigma * sqrtT)
        let d2 = d1 - sigma * sqrtT
        let callPrice = spot * normCDF(d1) - strike * normCDF(d2)
        let price = isCall ? callPrice : callPrice - spot + strike   // put-call parity, r = 0
        let delta = isCall ? normCDF(d1) : normCDF(d1) - 1
        let gamma = normPDF(d1) / (spot * sigma * sqrtT)
        let thetaYear = -spot * normPDF(d1) * sigma / (2 * sqrtT)   // same for call & put at r = 0
        let vega = spot * normPDF(d1) * sqrtT
        return Greeks(price: max(price, 0),
                      delta: delta,
                      gamma: gamma,
                      thetaPerDay: thetaYear / 365,
                      vegaPerPoint: vega / 100)
    }
}

// MARK: - Payoff builder model (fileprivate)

fileprivate struct OWLeg: Identifiable, Equatable {
    let id: UUID
    var isLong: Bool
    var isCall: Bool
    var strike: Double

    init(id: UUID = UUID(), isLong: Bool, isCall: Bool, strike: Double) {
        self.id = id
        self.isLong = isLong
        self.isCall = isCall
        self.strike = strike
    }

    /// Auto premium: fixed 30% vol, 30 days, zero rates, spot 100.
    var premium: Double {
        OWBlackScholes.price(spot: 100, strike: strike, vol: 0.30, days: 30, isCall: isCall)
    }

    func payoff(at s: Double) -> Double {
        let intrinsic = isCall ? max(0, s - strike) : max(0, strike - s)
        return isLong ? intrinsic - premium : premium - intrinsic
    }

    var label: String {
        "\(isLong ? "Long" : "Short") \(isCall ? "Call" : "Put")"
    }
}

fileprivate struct OWPayoffPoint: Identifiable {
    let x: Double
    let y: Double
    var id: Double { x }
}

fileprivate enum OWPreset: String, CaseIterable, Identifiable {
    case longCall = "Long Call"
    case coveredCall = "Covered Call"
    case straddle = "Straddle"
    case ironCondor = "Iron Condor"
    var id: String { rawValue }

    var icon: String {
        switch self {
        case .longCall: "arrow.up.right"
        case .coveredCall: "shield.lefthalf.filled"
        case .straddle: "arrow.up.and.down"
        case .ironCondor: "bird"
        }
    }

    var legs: [OWLeg] {
        switch self {
        case .longCall:
            [OWLeg(isLong: true, isCall: true, strike: 100)]
        case .coveredCall:
            [OWLeg(isLong: false, isCall: true, strike: 110)]
        case .straddle:
            [OWLeg(isLong: true, isCall: true, strike: 100),
             OWLeg(isLong: true, isCall: false, strike: 100)]
        case .ironCondor:
            [OWLeg(isLong: true, isCall: false, strike: 80),
             OWLeg(isLong: false, isCall: false, strike: 90),
             OWLeg(isLong: false, isCall: true, strike: 110),
             OWLeg(isLong: true, isCall: true, strike: 120)]
        }
    }

    var includesStock: Bool { self == .coveredCall }
}

// MARK: - PayoffBuilderWidget

/// Multi-leg option payoff diagram builder. Underlying pinned at $100 so every
/// number on screen is about the *structure*, not the ticker du jour.
struct PayoffBuilderWidget: View {
    @State private var legs: [OWLeg] = [OWLeg(isLong: true, isCall: true, strike: 100)]
    @State private var includeStock = false

    private let underlying: Double = 100

    var body: some View {
        VStack(alignment: .leading, spacing: TarsTheme.Space.l) {
            header
            presetRow
            chartSection
            statChips
            legList
            footerNote
        }
        .padding(TarsTheme.Space.l)
        .tarsPanel(elevation: 2)
    }

    // MARK: Sections

    private var header: some View {
        HStack(spacing: TarsTheme.Space.s) {
            Image(systemName: "point.topleft.down.to.point.bottomright.curvepath.fill")
                .font(TarsTheme.Text.heading)
                .foregroundStyle(TarsTheme.accent)
            VStack(alignment: .leading, spacing: 2) {
                Text("Payoff Builder")
                    .font(TarsTheme.Text.heading)
                    .foregroundStyle(TarsTheme.inkPrimary)
                Text("Underlying pinned at $100 · payoff at expiry")
                    .font(TarsTheme.Text.caption)
                    .foregroundStyle(TarsTheme.inkTertiary)
            }
            Spacer()
        }
    }

    private var presetRow: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: TarsTheme.Space.s) {
                ForEach(OWPreset.allCases) { preset in
                    OWPresetButton(preset: preset) { apply(preset) }
                }
            }
        }
    }

    private var chartSection: some View {
        OWPayoffChart(points: payoffPoints,
                      breakevens: breakevens,
                      underlying: underlying,
                      isFlat: legs.isEmpty && !includeStock)
            .frame(height: 240)
            .animation(Motion.fluid, value: legs)
            .animation(Motion.fluid, value: includeStock)
    }

    private var statChips: some View {
        HStack(spacing: TarsTheme.Space.s) {
            OWStatChip(title: "Max profit",
                       text: unlimitedProfit ? "∞ Unlimited" : maxProfit.owCurrency,
                       color: TarsTheme.gain)
            OWStatChip(title: "Max loss",
                       text: unlimitedLoss ? "∞ Unlimited" : maxLoss.owCurrency,
                       color: TarsTheme.loss)
            OWStatChip(title: netPremium <= 0 ? "Net debit" : "Net credit",
                       text: abs(netPremium).owCurrency,
                       color: TarsTheme.inkSecondary)
        }
    }

    private var legList: some View {
        VStack(spacing: TarsTheme.Space.s) {
            if includeStock {
                OWStockRow {
                    withAnimation(Motion.fluid) { includeStock = false }
                    Haptics.tap()
                }
                .transition(.opacity.combined(with: .move(edge: .top)))
            }
            ForEach($legs) { $leg in
                OWLegRow(leg: $leg) {
                    withAnimation(Motion.fluid) { legs.removeAll { $0.id == leg.id } }
                    Haptics.tap()
                }
                .transition(.opacity.combined(with: .move(edge: .top)))
            }
            if legs.isEmpty && !includeStock {
                Text("No legs. A payoff diagram with no legs is just a very confident flat line.")
                    .font(TarsTheme.Text.caption)
                    .foregroundStyle(TarsTheme.inkTertiary)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, TarsTheme.Space.m)
            }
            addLegButton
        }
    }

    private var addLegButton: some View {
        Button {
            guard legs.count < 4 else { return }
            withAnimation(Motion.fluid) {
                legs.append(OWLeg(isLong: true, isCall: legs.count.isMultiple(of: 2), strike: 100))
            }
            Haptics.confirm()
        } label: {
            Label(legs.count < 4 ? "Add leg" : "Four legs is plenty", systemImage: "plus")
                .font(TarsTheme.Text.caption)
                .foregroundStyle(legs.count < 4 ? TarsTheme.accent : TarsTheme.inkTertiary)
                .frame(maxWidth: .infinity)
                .padding(.vertical, TarsTheme.Space.m)
                .background(
                    RoundedRectangle(cornerRadius: TarsTheme.Radius.s, style: .continuous)
                        .strokeBorder(TarsTheme.hairline, style: StrokeStyle(lineWidth: 1, dash: [5, 4]))
                )
        }
        .buttonStyle(PressableStyle())
        .disabled(legs.count >= 4)
    }

    private var footerNote: some View {
        Text("Premiums here are toy Black-Scholes numbers — 30% vol, 30 days, zero rates. Real markets add slippage, spreads, and humility.")
            .font(TarsTheme.Text.micro)
            .foregroundStyle(TarsTheme.inkTertiary)
    }

    // MARK: Math

    private func combinedPayoff(at s: Double) -> Double {
        var total = legs.reduce(0) { $0 + $1.payoff(at: s) }
        if includeStock { total += s - underlying }
        return total
    }

    private var payoffPoints: [OWPayoffPoint] {
        stride(from: 60.0, through: 140.0, by: 0.5).map {
            OWPayoffPoint(x: $0, y: combinedPayoff(at: $0))
        }
    }

    private var breakevens: [Double] {
        var found: [Double] = []
        var prev = combinedPayoff(at: 50)
        var prevX = 50.0
        for x in stride(from: 50.25, through: 150.0, by: 0.25) {
            let y = combinedPayoff(at: x)
            if (prev < 0 && y >= 0) || (prev > 0 && y <= 0) {
                let frac = abs(prev) / max(abs(prev) + abs(y), 1e-9)
                let be = prevX + frac * (x - prevX)
                if found.last.map({ abs($0 - be) > 0.6 }) ?? true { found.append(be) }
            }
            prev = y; prevX = x
        }
        return found
    }

    private var extremes: (maxP: Double, maxL: Double) {
        var hi = -Double.infinity, lo = Double.infinity
        for x in stride(from: 0.01, through: 150.0, by: 0.5) {
            let y = combinedPayoff(at: x)
            hi = max(hi, y); lo = min(lo, y)
        }
        return (hi, lo)
    }

    /// Only the right side can run away — price has a floor at zero on the left.
    private var rightSlope: Double { combinedPayoff(at: 2000) - combinedPayoff(at: 1999) }
    private var unlimitedProfit: Bool { rightSlope > 1e-6 }
    private var unlimitedLoss: Bool { rightSlope < -1e-6 }
    private var maxProfit: Double { max(extremes.maxP, 0) }
    private var maxLoss: Double { min(extremes.maxL, 0) }

    private var netPremium: Double {
        legs.reduce(0) { $0 + ($1.isLong ? -$1.premium : $1.premium) }
    }

    private func apply(_ preset: OWPreset) {
        withAnimation(Motion.fluid) {
            legs = preset.legs
            includeStock = preset.includesStock
        }
        Haptics.confirm()
    }
}

// MARK: - Payoff chart (fileprivate)

fileprivate struct OWPayoffChart: View {
    let points: [OWPayoffPoint]
    let breakevens: [Double]
    let underlying: Double
    let isFlat: Bool

    private var yDomain: ClosedRange<Double> {
        let ys = points.map(\.y)
        let hi = max(ys.max() ?? 0, 3)
        let lo = min(ys.min() ?? 0, -3)
        let pad = max((hi - lo) * 0.15, 2)
        return (lo - pad)...(hi + pad)
    }

    var body: some View {
        Chart {
            // Shaded profit / loss regions
            ForEach(points) { p in
                AreaMark(x: .value("Price", p.x),
                         yStart: .value("Zero", 0),
                         yEnd: .value("Gain", max(0, p.y)),
                         series: .value("Region", "gain"))
                    .foregroundStyle(TarsTheme.chartGain)
                AreaMark(x: .value("Price", p.x),
                         yStart: .value("Zero", 0),
                         yEnd: .value("Loss", min(0, p.y)),
                         series: .value("Region", "loss"))
                    .foregroundStyle(TarsTheme.chartLoss)
            }
            // Zero line
            RuleMark(y: .value("Zero", 0))
                .foregroundStyle(TarsTheme.hairline)
                .lineStyle(StrokeStyle(lineWidth: 1))
            // Current spot
            RuleMark(x: .value("Spot", underlying))
                .foregroundStyle(TarsTheme.inkTertiary.opacity(0.5))
                .lineStyle(StrokeStyle(lineWidth: 1, dash: [2, 3]))
                .annotation(position: .bottom, alignment: .center) {
                    Text("spot")
                        .font(TarsTheme.Text.micro)
                        .foregroundStyle(TarsTheme.inkTertiary)
                }
            // Breakevens
            ForEach(breakevens, id: \.self) { be in
                RuleMark(x: .value("BE", be))
                    .foregroundStyle(TarsTheme.accent.opacity(0.7))
                    .lineStyle(StrokeStyle(lineWidth: 1, dash: [4, 3]))
                    .annotation(position: .top, alignment: .center) {
                        Text("BE \(be, format: .number.precision(.fractionLength(1)))")
                            .font(TarsTheme.Text.micro.monospacedDigit())
                            .foregroundStyle(TarsTheme.accent)
                            .padding(.horizontal, TarsTheme.Space.xs)
                            .padding(.vertical, 2)
                            .background(Capsule().fill(TarsTheme.bg3))
                    }
            }
            // The payoff line itself
            ForEach(points) { p in
                LineMark(x: .value("Price", p.x),
                         y: .value("P&L", p.y),
                         series: .value("Region", "payoff"))
                    .foregroundStyle(TarsTheme.inkPrimary)
                    .lineStyle(StrokeStyle(lineWidth: 2.5, lineCap: .round, lineJoin: .round))
                    .interpolationMethod(.linear)
            }
        }
        .chartXScale(domain: 60...140)
        .chartYScale(domain: yDomain)
        .chartXAxis {
            AxisMarks(values: [70, 85, 100, 115, 130]) { _ in
                AxisGridLine().foregroundStyle(TarsTheme.hairline)
                AxisValueLabel()
                    .font(TarsTheme.Text.micro.monospacedDigit())
                    .foregroundStyle(TarsTheme.inkTertiary)
            }
        }
        .chartYAxis {
            AxisMarks(position: .trailing) { _ in
                AxisGridLine().foregroundStyle(TarsTheme.hairline)
                AxisValueLabel()
                    .font(TarsTheme.Text.micro.monospacedDigit())
                    .foregroundStyle(TarsTheme.inkTertiary)
            }
        }
        .overlay {
            if isFlat {
                VStack(spacing: TarsTheme.Space.s) {
                    Image(systemName: "minus")
                        .font(TarsTheme.Text.title)
                        .foregroundStyle(TarsTheme.inkTertiary)
                    Text("Flat. Zero legs, zero payoff, zero drama.\nAdd a leg or borrow a preset.")
                        .font(TarsTheme.Text.caption)
                        .foregroundStyle(TarsTheme.inkTertiary)
                        .multilineTextAlignment(.center)
                }
            }
        }
    }
}

// MARK: - Payoff builder rows & chrome (fileprivate)

fileprivate struct OWLegRow: View {
    @Binding var leg: OWLeg
    let onDelete: () -> Void

    var body: some View {
        VStack(spacing: TarsTheme.Space.s) {
            HStack(spacing: TarsTheme.Space.s) {
                OWPillToggle(options: ["Long", "Short"],
                             colors: [TarsTheme.gain, TarsTheme.loss],
                             selection: Binding(get: { leg.isLong ? 0 : 1 },
                                                set: { leg.isLong = $0 == 0 }))
                OWPillToggle(options: ["Call", "Put"],
                             colors: [TarsTheme.accent, TarsTheme.accent],
                             selection: Binding(get: { leg.isCall ? 0 : 1 },
                                                set: { leg.isCall = $0 == 0 }))
                Spacer(minLength: TarsTheme.Space.s)
                VStack(alignment: .trailing, spacing: 0) {
                    Text(leg.premium, format: .currency(code: "USD"))
                        .font(TarsTheme.Text.priceSmall)
                        .foregroundStyle(TarsTheme.inkPrimary)
                        .contentTransition(.numericText(value: leg.premium))
                        .animation(Motion.ticker, value: leg.premium)
                    Text("premium")
                        .font(TarsTheme.Text.micro)
                        .foregroundStyle(TarsTheme.inkTertiary)
                }
                Button(action: onDelete) {
                    Image(systemName: "xmark.circle.fill")
                        .font(TarsTheme.Text.body)
                        .foregroundStyle(TarsTheme.inkTertiary)
                }
                .buttonStyle(PressableStyle())
            }
            HStack(spacing: TarsTheme.Space.m) {
                Text("K \(leg.strike, format: .number.precision(.fractionLength(0)))")
                    .font(TarsTheme.Text.priceSmall)
                    .foregroundStyle(TarsTheme.inkSecondary)
                    .frame(width: 52, alignment: .leading)
                    .contentTransition(.numericText(value: leg.strike))
                    .animation(Motion.ticker, value: leg.strike)
                Slider(value: $leg.strike, in: 70...130, step: 1)
                    .tint(TarsTheme.accent)
                    .onChange(of: leg.strike) { _, _ in Haptics.tick() }
            }
        }
        .padding(TarsTheme.Space.m)
        .background(
            RoundedRectangle(cornerRadius: TarsTheme.Radius.s, style: .continuous)
                .fill(TarsTheme.bg3.opacity(0.6))
        )
    }
}

fileprivate struct OWStockRow: View {
    let onDelete: () -> Void
    var body: some View {
        HStack(spacing: TarsTheme.Space.s) {
            Image(systemName: "chart.line.uptrend.xyaxis")
                .font(TarsTheme.Text.caption)
                .foregroundStyle(TarsTheme.paperBadge)
            Text("Underlying stock · bought at $100.00")
                .font(TarsTheme.Text.caption)
                .foregroundStyle(TarsTheme.inkSecondary)
            Spacer()
            Text("covers the call")
                .font(TarsTheme.Text.micro)
                .foregroundStyle(TarsTheme.inkTertiary)
            Button(action: onDelete) {
                Image(systemName: "xmark.circle.fill")
                    .font(TarsTheme.Text.body)
                    .foregroundStyle(TarsTheme.inkTertiary)
            }
            .buttonStyle(PressableStyle())
        }
        .padding(TarsTheme.Space.m)
        .background(
            RoundedRectangle(cornerRadius: TarsTheme.Radius.s, style: .continuous)
                .fill(TarsTheme.bg3.opacity(0.6))
                .overlay(
                    RoundedRectangle(cornerRadius: TarsTheme.Radius.s, style: .continuous)
                        .strokeBorder(TarsTheme.paperBadge.opacity(0.25), lineWidth: 1)
                )
        )
    }
}

fileprivate struct OWPillToggle: View {
    let options: [String]
    let colors: [Color]
    @Binding var selection: Int

    var body: some View {
        HStack(spacing: 2) {
            ForEach(options.indices, id: \.self) { i in
                Button {
                    withAnimation(Motion.snappy) { selection = i }
                    Haptics.tap()
                } label: {
                    Text(options[i])
                        .font(TarsTheme.Text.micro)
                        .foregroundStyle(selection == i ? colors[i] : TarsTheme.inkTertiary)
                        .padding(.horizontal, TarsTheme.Space.m)
                        .padding(.vertical, 6)
                        .background(
                            Capsule().fill(selection == i ? colors[i].opacity(0.16) : Color.clear)
                        )
                }
                .buttonStyle(PressableStyle())
            }
        }
        .background(Capsule().fill(TarsTheme.bg2))
        .overlay(Capsule().strokeBorder(TarsTheme.hairline, lineWidth: 1))
    }
}

fileprivate struct OWPresetButton: View {
    let preset: OWPreset
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            Label(preset.rawValue, systemImage: preset.icon)
                .font(TarsTheme.Text.caption)
                .foregroundStyle(TarsTheme.accent)
                .padding(.horizontal, TarsTheme.Space.m)
                .padding(.vertical, TarsTheme.Space.s)
                .background(
                    Capsule().fill(TarsTheme.accent.opacity(0.10))
                        .overlay(Capsule().strokeBorder(TarsTheme.accent.opacity(0.25), lineWidth: 1))
                )
        }
        .buttonStyle(PressableStyle())
    }
}

fileprivate struct OWStatChip: View {
    let title: String
    let text: String
    let color: Color

    var body: some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(title)
                .font(TarsTheme.Text.micro)
                .foregroundStyle(TarsTheme.inkTertiary)
            Text(text)
                .font(TarsTheme.Text.priceSmall)
                .foregroundStyle(color)
                .contentTransition(.opacity)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(TarsTheme.Space.m)
        .background(
            RoundedRectangle(cornerRadius: TarsTheme.Radius.s, style: .continuous)
                .fill(TarsTheme.bg3.opacity(0.5))
        )
        .animation(Motion.snappy, value: text)
    }
}

fileprivate extension Double {
    var owCurrency: String {
        let sign = self < 0 ? "−" : (self > 0 ? "+" : "")
        return sign + "$" + String(format: "%.2f", abs(self))
    }
}

// MARK: - GreeksLabWidget

/// Pick a call or put, drag spot / time / vol, and watch the greeks explain
/// themselves — slope tilts, time value melts, distributions widen.
struct GreeksLabWidget: View {
    @State private var isCall = true
    @State private var spot: Double = 100
    @State private var days: Double = 30
    @State private var vol: Double = 0.30       // 0.10 ... 0.90
    @State private var lastChanged: OWLabParam = .none

    private let strike: Double = 100

    private var greeks: OWBlackScholes.Greeks {
        OWBlackScholes.greeks(spot: spot, strike: strike, vol: vol, days: days, isCall: isCall)
    }

    var body: some View {
        VStack(alignment: .leading, spacing: TarsTheme.Space.l) {
            header
            heroRow
            greekTiles
            vizRow
            sliders
            OWTarsCaption(text: caption, param: lastChanged)
        }
        .padding(TarsTheme.Space.l)
        .tarsPanel(elevation: 2)
    }

    // MARK: Sections

    private var header: some View {
        HStack(spacing: TarsTheme.Space.s) {
            Image(systemName: "atom")
                .font(TarsTheme.Text.heading)
                .foregroundStyle(TarsTheme.agentPurple)
            VStack(alignment: .leading, spacing: 2) {
                Text("Greeks Lab")
                    .font(TarsTheme.Text.heading)
                    .foregroundStyle(TarsTheme.inkPrimary)
                Text("Strike $100 · zero rates · simplified Black-Scholes")
                    .font(TarsTheme.Text.caption)
                    .foregroundStyle(TarsTheme.inkTertiary)
            }
            Spacer()
            OWPillToggle(options: ["Call", "Put"],
                         colors: [TarsTheme.gain, TarsTheme.loss],
                         selection: Binding(get: { isCall ? 0 : 1 },
                                            set: { newValue in
                                                isCall = newValue == 0
                                                bump(.type)
                                            }))
        }
    }

    private var heroRow: some View {
        HStack(alignment: .firstTextBaseline, spacing: TarsTheme.Space.m) {
            TickerText(value: greeks.price,
                       font: TarsTheme.Text.priceHero,
                       colorsByDirection: true)
            Text("theoretical premium")
                .font(TarsTheme.Text.caption)
                .foregroundStyle(TarsTheme.inkTertiary)
            Spacer()
        }
    }

    private var greekTiles: some View {
        HStack(spacing: TarsTheme.Space.s) {
            OWGreekTile(name: "Delta", symbol: "Δ",
                        value: greeks.delta, fractionDigits: 2,
                        color: TarsTheme.pnl(greeks.delta),
                        blurb: "$ move per $1 of stock")
            OWGreekTile(name: "Gamma", symbol: "Γ",
                        value: greeks.gamma, fractionDigits: 3,
                        color: TarsTheme.agentPurple,
                        blurb: "how fast delta changes")
            OWGreekTile(name: "Theta", symbol: "Θ",
                        value: greeks.thetaPerDay, fractionDigits: 3,
                        color: TarsTheme.loss,
                        blurb: "$ lost per day, all else equal")
            OWGreekTile(name: "Vega", symbol: "ν",
                        value: greeks.vegaPerPoint, fractionDigits: 3,
                        color: TarsTheme.accent,
                        blurb: "$ per vol point")
        }
    }

    private var vizRow: some View {
        HStack(spacing: TarsTheme.Space.s) {
            OWVizCard(title: "Delta — the slope") {
                OWDeltaSlopeViz(isCall: isCall, spot: spot, strike: strike, vol: vol, days: days,
                                delta: greeks.delta)
            }
            OWVizCard(title: "Theta — the melt") {
                OWThetaMeltViz(days: days,
                               timeValueFraction: timeValueFraction)
            }
            OWVizCard(title: "Vega — the spread of outcomes") {
                OWVegaWidthViz(spot: spot, vol: vol, days: days)
            }
        }
        .frame(height: 130)
    }

    private var sliders: some View {
        VStack(spacing: TarsTheme.Space.m) {
            OWLabSlider(label: "Spot",
                        valueText: "$" + String(format: "%.0f", spot),
                        value: $spot, range: 70...130, step: 1) { bump(.spot) }
            OWLabSlider(label: "Expiry",
                        valueText: String(format: "%.0f", days) + "d",
                        value: $days, range: 1...90, step: 1) { bump(.days) }
            OWLabSlider(label: "Vol",
                        valueText: String(format: "%.0f", vol * 100) + "%",
                        value: $vol, range: 0.10...0.90, step: 0.01) { bump(.vol) }
        }
    }

    // MARK: Derived

    /// Time value now vs. time value with the full 90 days on the clock.
    private var timeValueFraction: Double {
        let intrinsic = isCall ? max(0, spot - strike) : max(0, strike - spot)
        let now = max(greeks.price - intrinsic, 0)
        let full = max(OWBlackScholes.price(spot: spot, strike: strike, vol: vol, days: 90, isCall: isCall) - intrinsic, 0.0001)
        return min(max(now / full, 0), 1)
    }

    private func bump(_ param: OWLabParam) {
        withAnimation(Motion.snappy) { lastChanged = param }
        Haptics.tick()
    }

    private var caption: String {
        let g = greeks
        switch lastChanged {
        case .none:
            return "Drag something. The greeks are just the option's sensitivities — how much the premium cares about price, time, and chaos. Nothing mystical, despite the alphabet."
        case .spot:
            let d = String(format: "%.2f", abs(g.delta))
            let depth = isCall
                ? (spot > strike + 10 ? "Deep in the money, delta approaches 1 — the option is basically the stock with extra paperwork." :
                   spot < strike - 10 ? "Far out of the money, delta fades toward 0 — the market doubts you." :
                   "Near the strike, delta hovers around 0.5 and gamma is at its most dramatic.")
                : (spot < strike - 10 ? "Deep in the money, delta approaches −1 — the put moves almost dollar-for-dollar against the stock." :
                   spot > strike + 10 ? "Far out of the money, delta fades toward 0 — the market doubts you." :
                   "Near the strike, delta hovers around −0.5 and gamma is at its most dramatic.")
            return "You moved the stock. Delta is \(isCall ? "" : "−")\(d): roughly how many cents the premium moves per dollar of stock. \(depth)"
        case .days:
            let t = String(format: "%.3f", abs(g.thetaPerDay))
            return days < 10
                ? "\(Int(days)) days left. Theta is now charging about $\(t) a day and accelerating — time decay is a curve, not a line, and the last week is where it gets expensive to wait."
                : "\(Int(days)) days on the clock. Time value melts at about $\(t) a day right now. Slide toward expiry and watch the melt bar drain faster. Time is not on your side. It's on the seller's."
        case .vol:
            let v = String(format: "%.3f", g.vegaPerPoint)
            return "Vol is \(Int(vol * 100))%. Each vol point is worth about $\(v) of premium — that's vega. More expected chaos, wider range of outcomes, pricier option. Sellers call it income. Buyers call it hope."
        case .type:
            return isCall
                ? "A call: the right to buy at $100. Positive delta, so it cheers when the stock rises. Same theta bill either way — the clock does not care which side you picked."
                : "A put: the right to sell at $100. Negative delta, so it profits when the stock falls. Same theta bill either way — the clock does not care which side you picked."
        }
    }
}

// MARK: - Greeks Lab pieces (fileprivate)

fileprivate enum OWLabParam: Equatable {
    case none, spot, days, vol, type
}

fileprivate struct OWGreekTile: View {
    let name: String
    let symbol: String
    let value: Double
    let fractionDigits: Int
    let color: Color
    let blurb: String

    var body: some View {
        VStack(alignment: .leading, spacing: TarsTheme.Space.xs) {
            HStack(spacing: TarsTheme.Space.xs) {
                Text(symbol)
                    .font(TarsTheme.Text.caption)
                    .foregroundStyle(color)
                Text(name)
                    .font(TarsTheme.Text.micro)
                    .foregroundStyle(TarsTheme.inkTertiary)
            }
            Text(value, format: .number.precision(.fractionLength(fractionDigits)).sign(strategy: .always(includingZero: false)))
                .font(TarsTheme.Text.price)
                .foregroundStyle(TarsTheme.inkPrimary)
                .contentTransition(.numericText(value: value))
                .animation(Motion.ticker, value: value)
            Text(blurb)
                .font(TarsTheme.Text.micro)
                .foregroundStyle(TarsTheme.inkTertiary)
                .lineLimit(2, reservesSpace: true)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(TarsTheme.Space.m)
        .background(
            RoundedRectangle(cornerRadius: TarsTheme.Radius.s, style: .continuous)
                .fill(TarsTheme.bg3.opacity(0.5))
        )
    }
}

fileprivate struct OWVizCard<Content: View>: View {
    let title: String
    @ViewBuilder let content: Content

    var body: some View {
        VStack(alignment: .leading, spacing: TarsTheme.Space.s) {
            Text(title)
                .font(TarsTheme.Text.micro)
                .foregroundStyle(TarsTheme.inkTertiary)
            content
                .frame(maxWidth: .infinity, maxHeight: .infinity)
        }
        .padding(TarsTheme.Space.m)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(
            RoundedRectangle(cornerRadius: TarsTheme.Radius.s, style: .continuous)
                .fill(TarsTheme.bg3.opacity(0.5))
        )
    }
}

/// Option price curve vs spot, with a tangent line whose tilt IS delta.
fileprivate struct OWDeltaSlopeViz: View {
    let isCall: Bool
    let spot: Double
    let strike: Double
    let vol: Double
    let days: Double
    let delta: Double

    private var curve: [OWPayoffPoint] {
        stride(from: 70.0, through: 130.0, by: 2.0).map {
            OWPayoffPoint(x: $0, y: OWBlackScholes.price(spot: $0, strike: strike, vol: vol, days: days, isCall: isCall))
        }
    }

    private var priceHere: Double {
        OWBlackScholes.price(spot: spot, strike: strike, vol: vol, days: days, isCall: isCall)
    }

    var body: some View {
        Chart {
            ForEach(curve) { p in
                LineMark(x: .value("S", p.x), y: .value("V", p.y),
                         series: .value("s", "curve"))
                    .foregroundStyle(TarsTheme.inkTertiary)
                    .lineStyle(StrokeStyle(lineWidth: 1.5))
                    .interpolationMethod(.catmullRom)
            }
            // Tangent — slope is exactly delta
            LineMark(x: .value("S", spot - 12), y: .value("V", priceHere - 12 * delta),
                     series: .value("s", "tangent"))
                .foregroundStyle(TarsTheme.accent)
                .lineStyle(StrokeStyle(lineWidth: 2.5, lineCap: .round))
            LineMark(x: .value("S", spot + 12), y: .value("V", priceHere + 12 * delta),
                     series: .value("s", "tangent"))
                .foregroundStyle(TarsTheme.accent)
                .lineStyle(StrokeStyle(lineWidth: 2.5, lineCap: .round))
            PointMark(x: .value("S", spot), y: .value("V", priceHere))
                .foregroundStyle(TarsTheme.accent)
                .symbolSize(60)
        }
        .chartXAxis(.hidden)
        .chartYAxis(.hidden)
        .chartXScale(domain: 68...132)
        .animation(Motion.fluid, value: spot)
        .animation(Motion.fluid, value: vol)
        .animation(Motion.fluid, value: days)
        .animation(Motion.fluid, value: isCall)
    }
}

/// Time value as a bar that drains as expiry approaches.
fileprivate struct OWThetaMeltViz: View {
    let days: Double
    let timeValueFraction: Double

    var body: some View {
        HStack(alignment: .bottom, spacing: TarsTheme.Space.m) {
            GeometryReader { geo in
                ZStack(alignment: .bottom) {
                    RoundedRectangle(cornerRadius: TarsTheme.Radius.s, style: .continuous)
                        .fill(TarsTheme.bg2)
                    RoundedRectangle(cornerRadius: TarsTheme.Radius.s, style: .continuous)
                        .fill(
                            LinearGradient(colors: [TarsTheme.warning, TarsTheme.loss.opacity(0.8)],
                                           startPoint: .top, endPoint: .bottom)
                        )
                        .frame(height: max(geo.size.height * timeValueFraction, 3))
                        .animation(Motion.fluid, value: timeValueFraction)
                }
            }
            .frame(width: 34)
            VStack(alignment: .leading, spacing: TarsTheme.Space.xs) {
                Text(days, format: .number.precision(.fractionLength(0)))
                    .font(TarsTheme.Text.price)
                    .foregroundStyle(TarsTheme.inkPrimary)
                    .contentTransition(.numericText(value: days))
                    .animation(Motion.ticker, value: days)
                Text("days left")
                    .font(TarsTheme.Text.micro)
                    .foregroundStyle(TarsTheme.inkTertiary)
                Text("time value\nremaining")
                    .font(TarsTheme.Text.micro)
                    .foregroundStyle(TarsTheme.warning)
            }
            Spacer(minLength: 0)
        }
    }
}

/// Distribution of expiry outcomes — the bell widens as vol (or time) rises.
fileprivate struct OWVegaWidthViz: View {
    let spot: Double
    let vol: Double
    let days: Double

    private var points: [OWPayoffPoint] {
        let sd = max(spot * vol * (max(days, 1) / 365).squareRoot(), 1.5)
        return stride(from: -40.0, through: 40.0, by: 2.0).map { offset in
            OWPayoffPoint(x: offset, y: exp(-(offset * offset) / (2 * sd * sd)))
        }
    }

    var body: some View {
        Chart {
            ForEach(points) { p in
                AreaMark(x: .value("S", p.x), y: .value("p", p.y))
                    .foregroundStyle(
                        LinearGradient(colors: [TarsTheme.accent.opacity(0.35), TarsTheme.accent.opacity(0.02)],
                                       startPoint: .top, endPoint: .bottom)
                    )
                    .interpolationMethod(.catmullRom)
                LineMark(x: .value("S", p.x), y: .value("p", p.y))
                    .foregroundStyle(TarsTheme.accent)
                    .lineStyle(StrokeStyle(lineWidth: 1.5))
                    .interpolationMethod(.catmullRom)
            }
            RuleMark(x: .value("now", 0))
                .foregroundStyle(TarsTheme.inkTertiary.opacity(0.4))
                .lineStyle(StrokeStyle(lineWidth: 1, dash: [2, 3]))
        }
        .chartXAxis(.hidden)
        .chartYAxis(.hidden)
        .chartXScale(domain: -40...40)
        .chartYScale(domain: 0...1.05)
        .animation(Motion.fluid, value: vol)
        .animation(Motion.fluid, value: days)
        .animation(Motion.fluid, value: spot)
    }
}

fileprivate struct OWLabSlider: View {
    let label: String
    let valueText: String
    @Binding var value: Double
    let range: ClosedRange<Double>
    let step: Double
    let onChanged: () -> Void

    var body: some View {
        HStack(spacing: TarsTheme.Space.m) {
            Text(label)
                .font(TarsTheme.Text.caption)
                .foregroundStyle(TarsTheme.inkSecondary)
                .frame(width: 48, alignment: .leading)
            Slider(value: $value, in: range, step: step)
                .tint(TarsTheme.accent)
                .onChange(of: value) { _, _ in onChanged() }
            Text(valueText)
                .font(TarsTheme.Text.priceSmall)
                .foregroundStyle(TarsTheme.inkPrimary)
                .frame(width: 52, alignment: .trailing)
                .contentTransition(.numericText())
                .animation(Motion.ticker, value: valueText)
        }
    }
}

fileprivate struct OWTarsCaption: View {
    let text: String
    let param: OWLabParam

    var body: some View {
        HStack(alignment: .top, spacing: TarsTheme.Space.m) {
            Image(systemName: "sparkle")
                .font(TarsTheme.Text.caption)
                .foregroundStyle(TarsTheme.accent)
                .padding(.top, 2)
            Text(text)
                .font(TarsTheme.Text.caption)
                .foregroundStyle(TarsTheme.inkSecondary)
                .frame(maxWidth: .infinity, alignment: .leading)
                .id(text)
                .transition(.opacity.combined(with: .move(edge: .bottom)))
        }
        .padding(TarsTheme.Space.m)
        .background(
            RoundedRectangle(cornerRadius: TarsTheme.Radius.s, style: .continuous)
                .fill(TarsTheme.accent.opacity(0.06))
                .overlay(
                    RoundedRectangle(cornerRadius: TarsTheme.Radius.s, style: .continuous)
                        .strokeBorder(TarsTheme.accent.opacity(0.15), lineWidth: 1)
                )
        )
        .animation(Motion.fluid, value: text)
    }
}

// MARK: - Previews

#Preview("Payoff Builder", traits: .fixedLayout(width: 700, height: 900)) {
    ScrollView {
        PayoffBuilderWidget()
            .padding()
    }
    .background(TarsTheme.bg0)
}

#Preview("Greeks Lab", traits: .fixedLayout(width: 700, height: 900)) {
    ScrollView {
        GreeksLabWidget()
            .padding()
    }
    .background(TarsTheme.bg0)
}
