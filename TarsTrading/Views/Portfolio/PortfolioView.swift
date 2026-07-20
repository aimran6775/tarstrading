import SwiftUI
import Charts

// MARK: - Portfolio analytics theater

/// The portfolio tab: equity-curve hero, allocation donut, exposure bars,
/// plain-English risk stats, and a strip of recent journal entries.
struct PortfolioView: View {
    @Environment(TradingStore.self) private var store
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    @State private var drawProgress: CGFloat = 0
    @State private var selectedSliceID: String?
    @State private var angleSelection: Double?
    @State private var expandedStat: PortfolioStatKind?
    @State private var spyBars: [Bar] = []

    var body: some View {
        ScrollView {
            if store.isBootstrapping {
                loadingSkeleton
                    .padding(TarsTheme.Space.xl)
            } else {
                VStack(alignment: .leading, spacing: TarsTheme.Space.l) {
                    heroCard
                    ViewThatFits(in: .horizontal) {
                        HStack(alignment: .top, spacing: TarsTheme.Space.l) {
                            allocationCard.frame(maxWidth: .infinity)
                            exposureCard.frame(maxWidth: .infinity)
                        }
                        VStack(spacing: TarsTheme.Space.l) {
                            allocationCard
                            exposureCard
                        }
                    }
                    riskCard
                    journalCard
                }
                .padding(TarsTheme.Space.xl)
            }
        }
        .background(TarsTheme.bg0)
        .task {
            spyBars = (try? await store.marketData.bars(symbol: "SPY", timeframe: .month3)) ?? []
        }
        .onAppear {
            if reduceMotion {
                drawProgress = 1
            } else {
                withAnimation(Motion.molasses.delay(0.15)) { drawProgress = 1 }
            }
        }
    }

    // MARK: Derived data

    private var equityHistory: [TradingStore.EquityPoint] { store.equityHistory }

    private var trendIsUp: Bool {
        guard let first = equityHistory.first, let last = equityHistory.last else { return true }
        return last.equity >= first.equity
    }

    private var allocationSlices: [PortfolioAllocationSlice] {
        var slices: [PortfolioAllocationSlice] = []
        let held = store.positions
            .filter { abs($0.marketValue) > 0.005 }
            .sorted { abs($0.marketValue) > abs($1.marketValue) }
        for (index, position) in held.enumerated() {
            slices.append(PortfolioAllocationSlice(
                id: position.symbol,
                label: position.symbol,
                value: abs(position.marketValue),
                color: portfolioSliceColor(index),
                isCash: false))
        }
        if store.account.cash > 0.005 {
            slices.append(PortfolioAllocationSlice(
                id: "•cash",
                label: "Cash",
                value: store.account.cash,
                color: TarsTheme.inkTertiary.opacity(0.55),
                isCash: true))
        }
        return slices
    }

    private var allocationTotal: Double {
        allocationSlices.reduce(0) { $0 + $1.value }
    }

    private var selectedSlice: PortfolioAllocationSlice? {
        allocationSlices.first { $0.id == selectedSliceID }
    }

    private var isAllCash: Bool {
        allocationSlices.allSatisfy(\.isCash)
    }

    private var riskStats: PortfolioRiskStats {
        PortfolioRiskStats.compute(history: equityHistory, spyBars: spyBars)
    }

    // MARK: Hero — equity + curve

    private var heroCard: some View {
        VStack(alignment: .leading, spacing: TarsTheme.Space.l) {
            HStack(alignment: .top) {
                VStack(alignment: .leading, spacing: TarsTheme.Space.xs) {
                    Text("Portfolio equity")
                        .font(TarsTheme.Text.caption)
                        .foregroundStyle(TarsTheme.inkSecondary)
                    TickerText(value: store.account.equity, font: TarsTheme.Text.priceHero)
                    HStack(spacing: TarsTheme.Space.s) {
                        Text(store.account.dayPnL,
                             format: .currency(code: "USD").sign(strategy: .always()))
                            .font(TarsTheme.Text.price)
                            .foregroundStyle(TarsTheme.pnl(store.account.dayPnL))
                            .contentTransition(.numericText(value: store.account.dayPnL))
                            .animation(Motion.ticker, value: store.account.dayPnL)
                        PercentText(value: store.account.dayPnLPercent, font: TarsTheme.Text.price)
                        Text("today")
                            .font(TarsTheme.Text.caption)
                            .foregroundStyle(TarsTheme.inkTertiary)
                    }
                }
                Spacer()
                PortfolioModeStamp(text: store.mode.badgeText)
            }
            .accessibilityElement(children: .combine)
            .accessibilityLabel("Portfolio equity")
            .accessibilityValue(heroAccessibilityValue)

            equityChart

            if equityHistory.count < 10 {
                PortfolioBuildingNote(pointCount: equityHistory.count)
                    .transition(.opacity)
            }
        }
        .padding(TarsTheme.Space.xl)
        .tarsPanel(elevation: 2)
    }

    private var heroAccessibilityValue: String {
        let equity = store.account.equity.formatted(.currency(code: "USD"))
        let pnl = store.account.dayPnL.formatted(.currency(code: "USD").sign(strategy: .always()))
        return "\(equity), \(pnl) today"
    }

    @ViewBuilder
    private var equityChart: some View {
        if equityHistory.count >= 2 {
            Chart(equityHistory) { point in
                AreaMark(
                    x: .value("Time", point.time),
                    y: .value("Equity", point.equity))
                    .interpolationMethod(.catmullRom)
                    .foregroundStyle(trendIsUp ? TarsTheme.chartGain : TarsTheme.chartLoss)
                LineMark(
                    x: .value("Time", point.time),
                    y: .value("Equity", point.equity))
                    .interpolationMethod(.catmullRom)
                    .lineStyle(StrokeStyle(lineWidth: 2, lineCap: .round, lineJoin: .round))
                    .foregroundStyle(trendIsUp ? TarsTheme.gain : TarsTheme.loss)
            }
            .chartXAxis(.hidden)
            .chartYAxis {
                AxisMarks(position: .trailing, values: .automatic(desiredCount: 3)) { value in
                    AxisGridLine().foregroundStyle(TarsTheme.hairline)
                    AxisValueLabel {
                        if let v = value.as(Double.self) {
                            Text(v, format: .currency(code: "USD")
                                .precision(.fractionLength(0)))
                                .font(TarsTheme.Text.priceSmall)
                                .foregroundStyle(TarsTheme.inkTertiary)
                        }
                    }
                }
            }
            .chartYScale(domain: equityDomain)
            .frame(height: 220)
            .mask(alignment: .leading) {
                GeometryReader { geo in
                    Rectangle().frame(width: geo.size.width * drawProgress)
                }
            }
            .accessibilityLabel("Equity curve")
            .accessibilityValue("\(equityHistory.count) recorded points, trending \(trendIsUp ? "up" : "down")")
        } else {
            PortfolioEmptyChart()
        }
    }

    private var equityDomain: ClosedRange<Double> {
        let values = equityHistory.map(\.equity)
        guard let lo = values.min(), let hi = values.max() else { return 0...1 }
        let pad = max((hi - lo) * 0.18, max(hi * 0.0015, 1))
        return (lo - pad)...(hi + pad)
    }

    // MARK: Allocation donut

    private var allocationCard: some View {
        VStack(alignment: .leading, spacing: TarsTheme.Space.l) {
            PortfolioSectionHeader(
                title: "Allocation",
                subtitle: "By market value")

            if allocationSlices.isEmpty {
                PortfolioAllCashNote(text: "Nothing here yet — fund the account and your allocation appears.")
            } else {
                donut
                if isAllCash {
                    PortfolioAllCashNote(text: "All cash. Nothing deployed yet — your first fill draws the first slice.")
                } else {
                    legendGrid
                }
            }
        }
        .padding(TarsTheme.Space.xl)
        .tarsPanel()
    }

    private var donut: some View {
        Chart(allocationSlices) { slice in
            SectorMark(
                angle: .value("Value", slice.value),
                innerRadius: .ratio(0.64),
                outerRadius: selectedSliceID == slice.id ? .ratio(1.0) : .ratio(0.92),
                angularInset: 1.5)
                .cornerRadius(3)
                .foregroundStyle(slice.color)
                .opacity(selectedSliceID == nil || selectedSliceID == slice.id ? 1 : 0.35)
        }
        .chartLegend(.hidden)
        .chartAngleSelection(value: $angleSelection)
        .onChange(of: angleSelection) { _, raw in
            handleAngleSelection(raw)
        }
        .frame(height: 220)
        .overlay { donutCenter }
        .accessibilityLabel("Allocation donut chart")
        .accessibilityValue(isAllCash ? "All cash" : "\(allocationSlices.count) slices")
    }

    @ViewBuilder
    private var donutCenter: some View {
        Group {
            if let slice = selectedSlice {
                VStack(spacing: TarsTheme.Space.xs) {
                    Text(slice.label)
                        .font(TarsTheme.Text.heading)
                        .foregroundStyle(TarsTheme.inkPrimary)
                    Text(slice.value, format: .currency(code: "USD"))
                        .font(TarsTheme.Text.priceSmall)
                        .foregroundStyle(TarsTheme.inkSecondary)
                    if allocationTotal > 0 {
                        Text(slice.value / allocationTotal,
                             format: .percent.precision(.fractionLength(1)))
                            .font(TarsTheme.Text.caption.monospacedDigit())
                            .foregroundStyle(TarsTheme.inkTertiary)
                    }
                }
                .id(slice.id)
                .transition(.opacity.combined(with: .scale(scale: 0.9)))
            } else {
                VStack(spacing: TarsTheme.Space.xs) {
                    Text(isAllCash ? "All cash" : "Total")
                        .font(TarsTheme.Text.caption)
                        .foregroundStyle(TarsTheme.inkTertiary)
                    Text(allocationTotal, format: .currency(code: "USD"))
                        .font(TarsTheme.Text.price)
                        .foregroundStyle(TarsTheme.inkPrimary)
                }
                .transition(.opacity)
            }
        }
        .animation(Motion.snappy, value: selectedSliceID)
        .allowsHitTesting(false)
    }

    private var legendGrid: some View {
        LazyVGrid(columns: [GridItem(.adaptive(minimum: 130), spacing: TarsTheme.Space.s)],
                  alignment: .leading, spacing: TarsTheme.Space.s) {
            ForEach(allocationSlices) { slice in
                Button {
                    withAnimation(Motion.snappy) {
                        selectedSliceID = selectedSliceID == slice.id ? nil : slice.id
                    }
                    Haptics.tick()
                } label: {
                    HStack(spacing: TarsTheme.Space.s) {
                        Circle().fill(slice.color).frame(width: 8, height: 8)
                        Text(slice.label)
                            .font(TarsTheme.Text.caption)
                            .foregroundStyle(TarsTheme.inkPrimary)
                            .lineLimit(1)
                        Spacer(minLength: 0)
                        if allocationTotal > 0 {
                            Text(slice.value / allocationTotal,
                                 format: .percent.precision(.fractionLength(0)))
                                .font(TarsTheme.Text.caption.monospacedDigit())
                                .foregroundStyle(TarsTheme.inkSecondary)
                        }
                    }
                    .padding(.horizontal, TarsTheme.Space.m)
                    .padding(.vertical, TarsTheme.Space.s)
                    .background(
                        Capsule().fill(selectedSliceID == slice.id ? TarsTheme.bg3 : TarsTheme.bg2))
                }
                .buttonStyle(PressableStyle())
                .accessibilityLabel("\(slice.label) allocation")
                .accessibilityValue(slice.value.formatted(.currency(code: "USD")))
                .accessibilityHint("Highlights this slice")
            }
        }
    }

    private func handleAngleSelection(_ raw: Double?) {
        guard let raw else { return }
        var cumulative = 0.0
        for slice in allocationSlices {
            cumulative += slice.value
            if raw <= cumulative {
                withAnimation(Motion.snappy) {
                    selectedSliceID = selectedSliceID == slice.id ? nil : slice.id
                }
                Haptics.tick()
                break
            }
        }
    }

    // MARK: Exposure by asset class

    private var exposureCard: some View {
        VStack(alignment: .leading, spacing: TarsTheme.Space.l) {
            PortfolioSectionHeader(
                title: "Exposure",
                subtitle: "By asset class")

            let rows = exposureRows
            if rows.isEmpty {
                PortfolioAllCashNote(text: "No open positions. Exposure shows up as soon as something fills.")
            } else {
                VStack(spacing: TarsTheme.Space.l) {
                    ForEach(rows) { row in
                        VStack(alignment: .leading, spacing: TarsTheme.Space.s) {
                            HStack {
                                Text(row.label)
                                    .font(TarsTheme.Text.body)
                                    .foregroundStyle(TarsTheme.inkPrimary)
                                Spacer()
                                Text(row.fraction, format: .percent.precision(.fractionLength(1)))
                                    .font(TarsTheme.Text.priceSmall)
                                    .foregroundStyle(TarsTheme.inkSecondary)
                                Text(row.value, format: .currency(code: "USD"))
                                    .font(TarsTheme.Text.priceSmall)
                                    .foregroundStyle(TarsTheme.inkTertiary)
                            }
                            PortfolioProportionBar(fraction: row.fraction, tint: row.tint)
                        }
                        .accessibilityElement(children: .combine)
                        .accessibilityLabel("\(row.label) exposure")
                        .accessibilityValue(row.fraction.formatted(.percent.precision(.fractionLength(1))))
                    }
                }
            }
            Spacer(minLength: 0)
        }
        .padding(TarsTheme.Space.xl)
        .tarsPanel()
    }

    private var exposureRows: [PortfolioExposureRow] {
        let gross = store.positions.reduce(0) { $0 + abs($1.marketValue) }
        guard gross > 0 else { return [] }
        return AssetClass.allCases.compactMap { assetClass -> PortfolioExposureRow? in
            let value = store.positions
                .filter { $0.assetClass == assetClass }
                .reduce(0) { $0 + abs($1.marketValue) }
            guard value > 0.005 else { return nil }
            return PortfolioExposureRow(
                id: assetClass.rawValue,
                label: assetClass.label,
                value: value,
                fraction: value / gross,
                tint: portfolioExposureTint(assetClass))
        }
    }

    // MARK: Risk stats grid

    private var riskCard: some View {
        VStack(alignment: .leading, spacing: TarsTheme.Space.l) {
            PortfolioSectionHeader(
                title: "Risk",
                subtitle: "Tap any stat for a plain-English read")

            let stats = riskStats
            LazyVGrid(columns: [GridItem(.adaptive(minimum: 170), spacing: TarsTheme.Space.m)],
                      spacing: TarsTheme.Space.m) {
                ForEach(PortfolioStatKind.allCases) { kind in
                    statCell(kind, stats: stats)
                }
            }
        }
        .padding(TarsTheme.Space.xl)
        .tarsPanel()
    }

    private func statCell(_ kind: PortfolioStatKind, stats: PortfolioRiskStats) -> some View {
        Button {
            Haptics.tap()
            expandedStat = kind
        } label: {
            VStack(alignment: .leading, spacing: TarsTheme.Space.s) {
                HStack(spacing: TarsTheme.Space.xs) {
                    Text(kind.title)
                        .font(TarsTheme.Text.caption)
                        .foregroundStyle(TarsTheme.inkSecondary)
                    Image(systemName: "info.circle")
                        .font(TarsTheme.Text.micro)
                        .foregroundStyle(TarsTheme.inkTertiary)
                }
                statValue(kind, stats: stats)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(TarsTheme.Space.l)
            .background(
                RoundedRectangle(cornerRadius: TarsTheme.Radius.s, style: .continuous)
                    .fill(TarsTheme.bg2))
        }
        .buttonStyle(PressableStyle())
        .popover(isPresented: statPopoverBinding(kind), arrowEdge: .top) {
            PortfolioStatExplainer(kind: kind)
                .presentationCompactAdaptation(.popover)
        }
        .accessibilityLabel(kind.title)
        .accessibilityValue(statAccessibilityValue(kind, stats: stats))
        .accessibilityHint("Explains this statistic")
    }

    @ViewBuilder
    private func statValue(_ kind: PortfolioStatKind, stats: PortfolioRiskStats) -> some View {
        switch kind {
        case .maxDrawdown:
            if let dd = stats.maxDrawdown {
                PercentText(value: dd, font: TarsTheme.Text.price)
            } else {
                PortfolioStatDash()
            }
        case .volatility:
            if let vol = stats.annualizedVolatility {
                Text(vol, format: .percent.precision(.fractionLength(1)))
                    .font(TarsTheme.Text.price)
                    .foregroundStyle(TarsTheme.inkPrimary)
            } else {
                PortfolioStatDash()
            }
        case .sharpeish:
            if let sharpe = stats.sharpeish {
                Text(sharpe, format: .number.precision(.fractionLength(2)))
                    .font(TarsTheme.Text.price)
                    .foregroundStyle(TarsTheme.inkPrimary)
            } else {
                PortfolioStatDash()
            }
        case .beta:
            if let beta = stats.beta {
                Text(beta, format: .number.precision(.fractionLength(2)))
                    .font(TarsTheme.Text.price)
                    .foregroundStyle(TarsTheme.inkPrimary)
            } else {
                PortfolioStatDash()
            }
        }
    }

    private func statAccessibilityValue(_ kind: PortfolioStatKind, stats: PortfolioRiskStats) -> String {
        switch kind {
        case .maxDrawdown:
            stats.maxDrawdown.map { $0.formatted(.percent.precision(.fractionLength(1))) } ?? "Not enough history"
        case .volatility:
            stats.annualizedVolatility.map { $0.formatted(.percent.precision(.fractionLength(1))) } ?? "Not enough history"
        case .sharpeish:
            stats.sharpeish.map { $0.formatted(.number.precision(.fractionLength(2))) } ?? "Not enough history"
        case .beta:
            stats.beta.map { $0.formatted(.number.precision(.fractionLength(2))) } ?? "Not enough history"
        }
    }

    private func statPopoverBinding(_ kind: PortfolioStatKind) -> Binding<Bool> {
        Binding(
            get: { expandedStat == kind },
            set: { shown in
                if shown { expandedStat = kind }
                else if expandedStat == kind { expandedStat = nil }
            })
    }

    // MARK: Journal strip

    private var journalCard: some View {
        VStack(alignment: .leading, spacing: TarsTheme.Space.l) {
            PortfolioSectionHeader(
                title: "Journal",
                subtitle: "Latest entries")

            let recent = Array(store.journal.prefix(3))
            if recent.isEmpty {
                PortfolioAllCashNote(text: "No entries yet. Close a trade and you'll be prompted to capture the thesis.")
            } else {
                VStack(spacing: 0) {
                    ForEach(Array(recent.enumerated()), id: \.element.id) { index, entry in
                        PortfolioJournalRow(entry: entry)
                        if index < recent.count - 1 {
                            Rectangle()
                                .fill(TarsTheme.hairline)
                                .frame(height: 1)
                        }
                    }
                }
            }
        }
        .padding(TarsTheme.Space.xl)
        .tarsPanel()
    }

    // MARK: Loading skeleton

    private var loadingSkeleton: some View {
        VStack(alignment: .leading, spacing: TarsTheme.Space.l) {
            VStack(alignment: .leading, spacing: TarsTheme.Space.l) {
                PortfolioSkeleton(width: 140, height: 12, reduceMotion: reduceMotion)
                PortfolioSkeleton(width: 240, height: 36, reduceMotion: reduceMotion)
                PortfolioSkeleton(height: 200, reduceMotion: reduceMotion)
            }
            .padding(TarsTheme.Space.xl)
            .tarsPanel(elevation: 2)

            HStack(spacing: TarsTheme.Space.l) {
                PortfolioSkeleton(height: 240, reduceMotion: reduceMotion)
                    .padding(TarsTheme.Space.xl)
                    .tarsPanel()
                PortfolioSkeleton(height: 240, reduceMotion: reduceMotion)
                    .padding(TarsTheme.Space.xl)
                    .tarsPanel()
            }
        }
        .accessibilityLabel("Loading portfolio")
    }
}

// MARK: - Slice / row models

fileprivate struct PortfolioAllocationSlice: Identifiable, Equatable {
    let id: String
    let label: String
    let value: Double
    let color: Color
    let isCash: Bool
}

fileprivate struct PortfolioExposureRow: Identifiable {
    let id: String
    let label: String
    let value: Double
    let fraction: Double
    let tint: Color
}

// MARK: - Palette (meaning-neutral, fixed order, derived from TarsTheme)

fileprivate let portfolioPalette: [Color] = [
    TarsTheme.accent,
    TarsTheme.agentPurple,
    TarsTheme.accent.opacity(0.55),
    TarsTheme.agentPurple.opacity(0.55),
    TarsTheme.inkSecondary,
    TarsTheme.accent.opacity(0.30),
    TarsTheme.agentPurple.opacity(0.30),
    TarsTheme.inkTertiary,
]

fileprivate func portfolioSliceColor(_ index: Int) -> Color {
    portfolioPalette[index % portfolioPalette.count]
}

fileprivate func portfolioExposureTint(_ assetClass: AssetClass) -> Color {
    switch assetClass {
    case .usEquity: TarsTheme.accent
    case .crypto: TarsTheme.agentPurple
    case .usOption: TarsTheme.accent.opacity(0.55)
    }
}

// MARK: - Risk math (fileprivate, honest about short samples)

fileprivate struct PortfolioRiskStats {
    var maxDrawdown: Double?
    var annualizedVolatility: Double?
    var sharpeish: Double?
    var beta: Double?

    static func compute(history: [TradingStore.EquityPoint], spyBars: [Bar]) -> PortfolioRiskStats {
        var stats = PortfolioRiskStats()
        let equities = history.map(\.equity).filter { $0 > 0 }

        // Max drawdown: deepest peak-to-trough fall.
        if equities.count >= 2, let first = equities.first {
            var peak = first
            var worst = 0.0
            for equity in equities {
                peak = max(peak, equity)
                worst = min(worst, equity / peak - 1)
            }
            stats.maxDrawdown = worst
        }

        // Point-to-point returns.
        var returns: [Double] = []
        if equities.count >= 2 {
            for i in 1..<equities.count where equities[i - 1] > 0 {
                returns.append(equities[i] / equities[i - 1] - 1)
            }
        }

        // Annualize off the observed cadence (points arrive ~once a minute in
        // demo mode) instead of pretending they are daily closes.
        if returns.count >= 5, let periodsPerYear = periodsPerYear(history) {
            let mean = returns.reduce(0, +) / Double(returns.count)
            let variance = returns.reduce(0) { $0 + ($1 - mean) * ($1 - mean) } / Double(returns.count)
            let std = variance.squareRoot()
            if std > 0 {
                stats.annualizedVolatility = std * periodsPerYear.squareRoot()
                stats.sharpeish = mean / std * periodsPerYear.squareRoot()
            }
        }

        // Beta vs SPY on matched daily closes only — mixing cadences would lie.
        let portfolioDaily = dailyReturns(from: dailyCloses(history))
        let spyDaily = dailyReturns(from: spyBars.map(\.close))
        stats.beta = beta(portfolio: portfolioDaily, market: spyDaily)
        return stats
    }

    private static func periodsPerYear(_ history: [TradingStore.EquityPoint]) -> Double? {
        guard history.count >= 3 else { return nil }
        let times = history.map(\.time)
        var intervals: [TimeInterval] = []
        for i in 1..<times.count {
            let dt = times[i].timeIntervalSince(times[i - 1])
            if dt > 0 { intervals.append(dt) }
        }
        guard !intervals.isEmpty else { return nil }
        let median = intervals.sorted()[intervals.count / 2]
        guard median > 0 else { return nil }
        return 31_557_600 / median   // seconds per year / median cadence
    }

    private static func dailyCloses(_ history: [TradingStore.EquityPoint]) -> [Double] {
        let calendar = Calendar.current
        var lastPerDay: [Date: Double] = [:]
        for point in history where point.equity > 0 {
            lastPerDay[calendar.startOfDay(for: point.time)] = point.equity
        }
        return lastPerDay.keys.sorted().compactMap { lastPerDay[$0] }
    }

    private static func dailyReturns(from closes: [Double]) -> [Double] {
        guard closes.count >= 2 else { return [] }
        var returns: [Double] = []
        for i in 1..<closes.count where closes[i - 1] > 0 {
            returns.append(closes[i] / closes[i - 1] - 1)
        }
        return returns
    }

    private static func beta(portfolio: [Double], market: [Double]) -> Double? {
        let n = min(portfolio.count, market.count)
        guard n >= 6 else { return nil }
        let p = Array(portfolio.suffix(n))
        let m = Array(market.suffix(n))
        let meanP = p.reduce(0, +) / Double(n)
        let meanM = m.reduce(0, +) / Double(n)
        var covariance = 0.0
        var marketVariance = 0.0
        for i in 0..<n {
            covariance += (p[i] - meanP) * (m[i] - meanM)
            marketVariance += (m[i] - meanM) * (m[i] - meanM)
        }
        guard marketVariance > 0 else { return nil }
        return covariance / marketVariance
    }
}

// MARK: - Stat kinds & explainers

fileprivate enum PortfolioStatKind: String, CaseIterable, Identifiable {
    case maxDrawdown, volatility, sharpeish, beta
    var id: String { rawValue }

    var title: String {
        switch self {
        case .maxDrawdown: "Max drawdown"
        case .volatility: "Volatility (ann.)"
        case .sharpeish: "Sharpe-ish"
        case .beta: "Beta vs SPY"
        }
    }

    var plainEnglish: String {
        switch self {
        case .maxDrawdown:
            "The deepest fall from a peak in your equity so far. If the account touched $10,000 and later dipped to $9,000, that's a \u{2212}10% drawdown. It measures pain, not skill."
        case .volatility:
            "How much your equity value swings, scaled to a yearly rate so different accounts can be compared. Higher means a bumpier ride — it says nothing about direction."
        case .sharpeish:
            "Average return per unit of swing — a rough quality-of-ride score. Ours skips the risk-free rate, hence the \u{201C}-ish.\u{201D} It describes the past, not the future."
        case .beta:
            "How much your portfolio has tended to move when SPY moves 1%. Above 1 means it amplified the market's moves; below 1 means it damped them; near 0 means it marched to its own drum."
        }
    }
}

fileprivate struct PortfolioStatExplainer: View {
    let kind: PortfolioStatKind

    var body: some View {
        VStack(alignment: .leading, spacing: TarsTheme.Space.m) {
            Text(kind.title)
                .font(TarsTheme.Text.heading)
                .foregroundStyle(TarsTheme.inkPrimary)
            Text(kind.plainEnglish)
                .font(TarsTheme.Text.body)
                .foregroundStyle(TarsTheme.inkSecondary)
                .fixedSize(horizontal: false, vertical: true)
            HStack(alignment: .top, spacing: TarsTheme.Space.s) {
                Image(systemName: "exclamationmark.triangle")
                    .font(TarsTheme.Text.caption)
                    .foregroundStyle(TarsTheme.warning)
                Text("Computed from a short paper-trading history. Small samples mislead — treat these as rough sketches, not measurements.")
                    .font(TarsTheme.Text.caption)
                    .foregroundStyle(TarsTheme.inkTertiary)
                    .fixedSize(horizontal: false, vertical: true)
            }
        }
        .padding(TarsTheme.Space.xl)
        .frame(width: 320, alignment: .leading)
        .background(TarsTheme.bg2)
    }
}

fileprivate struct PortfolioStatDash: View {
    var body: some View {
        Text("\u{2014}")
            .font(TarsTheme.Text.price)
            .foregroundStyle(TarsTheme.inkTertiary)
    }
}

// MARK: - Small chrome pieces

fileprivate struct PortfolioSectionHeader: View {
    let title: String
    var subtitle: String? = nil

    var body: some View {
        VStack(alignment: .leading, spacing: TarsTheme.Space.xs) {
            Text(title)
                .font(TarsTheme.Text.heading)
                .foregroundStyle(TarsTheme.inkPrimary)
            if let subtitle {
                Text(subtitle)
                    .font(TarsTheme.Text.caption)
                    .foregroundStyle(TarsTheme.inkTertiary)
            }
        }
        .accessibilityElement(children: .combine)
        .accessibilityAddTraits(.isHeader)
    }
}

fileprivate struct PortfolioModeStamp: View {
    let text: String

    var body: some View {
        Text(text)
            .font(TarsTheme.Text.micro)
            .foregroundStyle(TarsTheme.paperBadge)
            .padding(.horizontal, TarsTheme.Space.s)
            .padding(.vertical, TarsTheme.Space.xs)
            .background(
                Capsule().strokeBorder(TarsTheme.paperBadge.opacity(0.5), lineWidth: 1))
            .accessibilityLabel("\(text) trading mode — simulated money")
    }
}

fileprivate struct PortfolioProportionBar: View {
    let fraction: Double
    let tint: Color

    var body: some View {
        GeometryReader { geo in
            ZStack(alignment: .leading) {
                Capsule().fill(TarsTheme.bg3)
                Capsule()
                    .fill(tint)
                    .frame(width: max(6, geo.size.width * min(max(fraction, 0), 1)))
            }
        }
        .frame(height: 8)
        .animation(Motion.fluid, value: fraction)
        .accessibilityHidden(true)   // the parent row carries the value
    }
}

fileprivate struct PortfolioBuildingNote: View {
    let pointCount: Int

    var body: some View {
        HStack(spacing: TarsTheme.Space.s) {
            Image(systemName: "hourglass")
                .font(TarsTheme.Text.caption)
                .foregroundStyle(TarsTheme.accent)
            Text("Building your history — a new equity point lands about once a minute. \(pointCount) of 10 so far.")
                .font(TarsTheme.Text.caption)
                .foregroundStyle(TarsTheme.inkSecondary)
        }
        .padding(.horizontal, TarsTheme.Space.m)
        .padding(.vertical, TarsTheme.Space.s)
        .background(
            Capsule().fill(TarsTheme.bg3))
        .accessibilityElement(children: .combine)
    }
}

fileprivate struct PortfolioEmptyChart: View {
    var body: some View {
        VStack(spacing: TarsTheme.Space.m) {
            Image(systemName: "chart.xyaxis.line")
                .font(TarsTheme.Text.title)
                .foregroundStyle(TarsTheme.inkTertiary)
            Text("Your equity curve starts here")
                .font(TarsTheme.Text.body)
                .foregroundStyle(TarsTheme.inkSecondary)
            Text("Keep the app open and points accrue automatically.")
                .font(TarsTheme.Text.caption)
                .foregroundStyle(TarsTheme.inkTertiary)
        }
        .frame(maxWidth: .infinity)
        .frame(height: 220)
        .background(
            RoundedRectangle(cornerRadius: TarsTheme.Radius.s, style: .continuous)
                .strokeBorder(TarsTheme.hairline, style: StrokeStyle(lineWidth: 1, dash: [5, 5])))
        .accessibilityElement(children: .combine)
    }
}

fileprivate struct PortfolioAllCashNote: View {
    let text: String

    var body: some View {
        Text(text)
            .font(TarsTheme.Text.body)
            .foregroundStyle(TarsTheme.inkSecondary)
            .fixedSize(horizontal: false, vertical: true)
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(TarsTheme.Space.l)
            .background(
                RoundedRectangle(cornerRadius: TarsTheme.Radius.s, style: .continuous)
                    .fill(TarsTheme.bg2))
    }
}

fileprivate struct PortfolioJournalRow: View {
    let entry: JournalEntry

    var body: some View {
        HStack(spacing: TarsTheme.Space.m) {
            VStack(alignment: .leading, spacing: TarsTheme.Space.xs) {
                HStack(spacing: TarsTheme.Space.s) {
                    Text(entry.symbol)
                        .font(TarsTheme.Text.body.weight(.semibold))
                        .foregroundStyle(TarsTheme.inkPrimary)
                    Text(entry.side.label)
                        .font(TarsTheme.Text.micro)
                        .foregroundStyle(TarsTheme.inkSecondary)
                        .padding(.horizontal, TarsTheme.Space.s)
                        .padding(.vertical, 2)
                        .background(Capsule().fill(TarsTheme.bg3))
                }
                Text(entry.thesis.isEmpty ? "No thesis captured" : entry.thesis)
                    .font(TarsTheme.Text.caption)
                    .foregroundStyle(entry.thesis.isEmpty ? TarsTheme.inkTertiary : TarsTheme.inkSecondary)
                    .lineLimit(1)
            }
            Spacer()
            Text(entry.openedAt, format: .dateTime.month(.abbreviated).day())
                .font(TarsTheme.Text.caption.monospacedDigit())
                .foregroundStyle(TarsTheme.inkTertiary)
            PortfolioPnLChip(pnl: entry.realizedPnL)
        }
        .padding(.vertical, TarsTheme.Space.m)
        .accessibilityElement(children: .combine)
        .accessibilityLabel("Journal entry, \(entry.symbol), \(entry.side.label)")
        .accessibilityValue(
            entry.realizedPnL.map { $0.formatted(.currency(code: "USD").sign(strategy: .always())) }
            ?? "Position open")
    }
}

fileprivate struct PortfolioPnLChip: View {
    let pnl: Double?

    var body: some View {
        Group {
            if let pnl {
                Text(pnl, format: .currency(code: "USD").sign(strategy: .always()))
                    .font(TarsTheme.Text.priceSmall)
                    .foregroundStyle(TarsTheme.pnl(pnl))
            } else {
                Text("Open")
                    .font(TarsTheme.Text.caption)
                    .foregroundStyle(TarsTheme.inkSecondary)
            }
        }
        .padding(.horizontal, TarsTheme.Space.s)
        .padding(.vertical, TarsTheme.Space.xs)
        .background(Capsule().fill(TarsTheme.bg3))
    }
}

/// Skeleton that degrades to a static block under Reduce Motion (the shared
/// SkeletonBlock shimmer loops forever).
fileprivate struct PortfolioSkeleton: View {
    var width: CGFloat? = nil
    var height: CGFloat = 14
    let reduceMotion: Bool

    var body: some View {
        if reduceMotion {
            RoundedRectangle(cornerRadius: 6, style: .continuous)
                .fill(TarsTheme.bg3)
                .frame(width: width, height: height)
        } else {
            SkeletonBlock(width: width, height: height)
        }
    }
}
