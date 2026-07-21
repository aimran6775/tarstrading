import SwiftUI
import Charts

/// Backtest results for one agent: honest verdict, twin in/out-of-sample
/// panels, a 6-second playback of the equity curve, and the trade log.
/// Honesty is the design language — in-sample and out-of-sample are never
/// blended, and the split is drawn on the chart as "the honesty line".
public struct BacktestResultView: View {
    let agent: TradingAgent
    @Environment(AgentLab.self) private var lab

    /// Live copy of the agent so the CTA reacts to status changes.
    private var liveAgent: TradingAgent {
        lab.agents.first { $0.id == agent.id } ?? agent
    }

    public var body: some View {
        ScrollView {
            if let result = lab.backtests[agent.id] {
                VStack(alignment: .leading, spacing: TarsTheme.Space.l) {
                    header(result)
                    BTVerdictCard(result: result, agentName: liveAgent.name)
                    if result.overfitWarning {
                        BTOverfitBanner(result: result)
                    }
                    twinPanels(result)
                    BTPlaybackPanel(
                        curve: result.inSample.equity + result.outOfSample.equity,
                        splitIndex: result.inSample.equity.count,
                        trades: result.trades)
                    BTTradeSection(trades: result.trades)
                    footer
                }
                .frame(maxWidth: 900)
                .frame(maxWidth: .infinity)
                .padding(TarsTheme.Space.l)
            } else {
                BTEmptyState(agentName: liveAgent.name, emoji: liveAgent.emoji)
                    .frame(maxWidth: .infinity)
                    .padding(.top, TarsTheme.Space.xxl * 2)
            }
        }
        .background(TarsTheme.bg0)
    }

    // MARK: Header

    private func header(_ result: BacktestResult) -> some View {
        VStack(alignment: .leading, spacing: TarsTheme.Space.s) {
            HStack(spacing: TarsTheme.Space.m) {
                Text(liveAgent.emoji).font(TarsTheme.Text.title)
                VStack(alignment: .leading, spacing: 2) {
                    Text(liveAgent.name)
                        .font(TarsTheme.Text.title)
                        .foregroundStyle(TarsTheme.inkPrimary)
                    Text("Backtest · ran \(result.ranAt, format: .dateTime.month(.abbreviated).day().hour().minute())")
                        .font(TarsTheme.Text.caption)
                        .foregroundStyle(TarsTheme.inkTertiary)
                        .monospacedDigit()
                }
                Spacer()
            }
            Text(liveAgent.thesisText)
                .font(TarsTheme.Text.body)
                .foregroundStyle(TarsTheme.inkSecondary)
                .fixedSize(horizontal: false, vertical: true)
        }
    }

    // MARK: Twin segment panels

    private func twinPanels(_ result: BacktestResult) -> some View {
        VStack(alignment: .leading, spacing: TarsTheme.Space.m) {
            BTSectionHeader(text: "Two tests, reported separately")
            LazyVGrid(
                columns: [GridItem(.adaptive(minimum: 340), spacing: TarsTheme.Space.m)],
                spacing: TarsTheme.Space.m
            ) {
                BTSegmentPanel(segment: result.inSample, subtitle: "The rehearsal — rules were shaped on this data.", delay: 0)
                BTSegmentPanel(segment: result.outOfSample, subtitle: "The real exam — data the rules never saw.", delay: 0.25)
            }
        }
    }

    // MARK: Footer

    private var footer: some View {
        VStack(spacing: TarsTheme.Space.m) {
            if liveAgent.status == .backtested {
                Button {
                    lab.setStatus(agent.id, .running)
                    Haptics.success()
                } label: {
                    HStack(spacing: TarsTheme.Space.s) {
                        Image(systemName: "play.fill")
                        Text("Run it on paper")
                    }
                    .font(TarsTheme.Text.heading)
                    .foregroundStyle(TarsTheme.bg0)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, TarsTheme.Space.l)
                    .background(
                        RoundedRectangle(cornerRadius: TarsTheme.Radius.m, style: .continuous)
                            .fill(TarsTheme.accent)
                    )
                }
                .buttonStyle(PressableStyle())
            } else if liveAgent.status == .running {
                HStack(spacing: TarsTheme.Space.s) {
                    Circle().fill(TarsTheme.gain).frame(width: 8, height: 8)
                    Text("Running on paper — the agent now trades its allocation live.")
                        .font(TarsTheme.Text.body)
                        .foregroundStyle(TarsTheme.inkSecondary)
                }
                .frame(maxWidth: .infinity)
                .padding(TarsTheme.Space.l)
                .tarsPanel()
            }
            Text("Simulated results describe one specific past with approximated fills. They never promise — or even hint at — future returns. Nothing here is advice.")
                .font(TarsTheme.Text.caption)
                .foregroundStyle(TarsTheme.inkTertiary)
                .multilineTextAlignment(.center)
                .frame(maxWidth: .infinity)
        }
        .padding(.top, TarsTheme.Space.s)
    }
}

// MARK: - Section header

fileprivate struct BTSectionHeader: View {
    let text: String
    var body: some View {
        Text(text.uppercased())
            .font(TarsTheme.Text.micro)
            .tracking(1.2)
            .foregroundStyle(TarsTheme.inkTertiary)
    }
}

// MARK: - Verdict card

fileprivate struct BTVerdictCard: View {
    let result: BacktestResult
    let agentName: String

    /// Benchmark stated on the same footing as the agent number, and labeled
    /// as derived so nobody mistakes it for a measured figure.
    private var benchmarkAnnualized: Double {
        let bars = Double(result.inSample.equity.count + result.outOfSample.equity.count)
        let years = max(bars / 252.0, 0.02)
        return pow(1 + result.benchmarkReturn, 1 / years) - 1
    }

    private var beatBenchmark: Bool {
        result.outOfSample.annualizedReturn > benchmarkAnnualized
    }

    private var verdictLine: String {
        beatBenchmark
        ? "Out-of-sample, \(agentName) outpaced buy-and-hold. One good backtest is evidence, not proof — the market grades on a rolling basis."
        : "Out-of-sample, buy-and-hold won. That is the usual result, and learning it on paper is the cheapest tuition available."
    }

    var body: some View {
        VStack(alignment: .leading, spacing: TarsTheme.Space.m) {
            BTSectionHeader(text: "The verdict")
            HStack(alignment: .top, spacing: TarsTheme.Space.xl) {
                VStack(alignment: .leading, spacing: TarsTheme.Space.xs) {
                    PercentText(value: result.outOfSample.annualizedReturn, font: TarsTheme.Text.priceHero)
                    Text("\(agentName) / yr, out-of-sample")
                        .font(TarsTheme.Text.caption)
                        .foregroundStyle(TarsTheme.inkSecondary)
                }
                VStack(alignment: .leading, spacing: TarsTheme.Space.xs) {
                    Text(benchmarkAnnualized, format: .percent.precision(.fractionLength(2)).sign(strategy: .always()))
                        .font(TarsTheme.Text.priceHero)
                        .foregroundStyle(TarsTheme.inkSecondary)
                        .lineLimit(1)
                        .minimumScaleFactor(0.6)
                    Text("buy & hold / yr, annualized equivalent")
                        .font(TarsTheme.Text.caption)
                        .foregroundStyle(TarsTheme.inkSecondary)
                }
                Spacer(minLength: 0)
            }
            Text(verdictLine)
                .font(TarsTheme.Text.body)
                .foregroundStyle(TarsTheme.inkPrimary)
                .fixedSize(horizontal: false, vertical: true)
            Text("Only the out-of-sample number gets an opinion. In-sample is practice with the answer key.")
                .font(TarsTheme.Text.caption)
                .foregroundStyle(TarsTheme.inkTertiary)
        }
        .padding(TarsTheme.Space.l)
        .frame(maxWidth: .infinity, alignment: .leading)
        .tarsPanel(elevation: 2)
    }
}

// MARK: - Overfit banner

fileprivate struct BTOverfitBanner: View {
    let result: BacktestResult

    var body: some View {
        HStack(alignment: .top, spacing: TarsTheme.Space.m) {
            Image(systemName: "exclamationmark.triangle.fill")
                .font(TarsTheme.Text.heading)
                .foregroundStyle(TarsTheme.warning)
            VStack(alignment: .leading, spacing: TarsTheme.Space.xs) {
                Text("Overfit alert")
                    .font(TarsTheme.Text.heading)
                    .foregroundStyle(TarsTheme.warning)
                Text("In-sample \(result.inSample.annualizedReturn, format: .percent.precision(.fractionLength(1)).sign(strategy: .always()))/yr collapsed to \(result.outOfSample.annualizedReturn, format: .percent.precision(.fractionLength(1)).sign(strategy: .always()))/yr on data the rules never saw. That gap means the strategy memorized history instead of learning from it. It is also why a single blended backtest number lies: it averages the rehearsed part with the real test and calls the mix a track record.")
                    .font(TarsTheme.Text.body)
                    .foregroundStyle(TarsTheme.inkPrimary)
                    .monospacedDigit()
                    .fixedSize(horizontal: false, vertical: true)
            }
        }
        .padding(TarsTheme.Space.l)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(
            RoundedRectangle(cornerRadius: TarsTheme.Radius.m, style: .continuous)
                .fill(TarsTheme.warning.opacity(0.10))
                .overlay(
                    RoundedRectangle(cornerRadius: TarsTheme.Radius.m, style: .continuous)
                        .strokeBorder(TarsTheme.warning.opacity(0.45), lineWidth: 1)
                )
        )
    }
}

// MARK: - Segment panel (equity curve + stats)

fileprivate struct BTSegmentPanel: View {
    let segment: BacktestResult.Segment
    let subtitle: String
    let delay: Double

    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var drawn: CGFloat = 0

    private var polarity: Color { TarsTheme.pnl(segment.totalReturn) }

    var body: some View {
        VStack(alignment: .leading, spacing: TarsTheme.Space.m) {
            VStack(alignment: .leading, spacing: 2) {
                Text(segment.label)
                    .font(TarsTheme.Text.heading)
                    .foregroundStyle(TarsTheme.inkPrimary)
                Text(subtitle)
                    .font(TarsTheme.Text.caption)
                    .foregroundStyle(TarsTheme.inkTertiary)
            }

            if segment.equity.count > 1 {
                chart
                    .frame(height: 140)
                    .accessibilityLabel(chartSummary)
                    .mask(
                        GeometryReader { geo in
                            Rectangle().frame(width: geo.size.width * drawn)
                        }
                    )
                    .onAppear {
                        if reduceMotion {
                            drawn = 1
                        } else {
                            withAnimation(Motion.grand.delay(delay)) { drawn = 1 }
                        }
                    }
            } else {
                Text("Not enough data in this slice to draw a curve.")
                    .font(TarsTheme.Text.caption)
                    .foregroundStyle(TarsTheme.inkTertiary)
                    .frame(height: 140)
            }

            statsGrid
        }
        .padding(TarsTheme.Space.l)
        .frame(maxWidth: .infinity, alignment: .leading)
        .tarsPanel()
    }

    private var chartSummary: String {
        let from = (segment.equity.first ?? 0)
            .formatted(.currency(code: "USD").precision(.fractionLength(0)))
        let to = (segment.equity.last ?? 0)
            .formatted(.currency(code: "USD").precision(.fractionLength(0)))
        return "\(segment.label) equity curve, from \(from) to \(to) over \(segment.equity.count) bars"
    }

    private var chart: some View {
        let lo = segment.equity.min() ?? 0
        let hi = segment.equity.max() ?? 1
        return Chart {
            ForEach(Array(segment.equity.enumerated()), id: \.offset) { i, value in
                AreaMark(
                    x: .value("Bar", i),
                    yStart: .value("Base", lo * 0.995),
                    yEnd: .value("Equity", value)
                )
                .foregroundStyle(segment.totalReturn >= 0 ? TarsTheme.chartGain : TarsTheme.chartLoss)
                LineMark(
                    x: .value("Bar", i),
                    y: .value("Equity", value)
                )
                .lineStyle(StrokeStyle(lineWidth: 2, lineCap: .round))
                .foregroundStyle(polarity)
            }
        }
        .chartXAxis(.hidden)
        .chartYScale(domain: (lo * 0.995)...(max(hi * 1.005, lo * 0.995 + 1)))
        .chartYAxis {
            AxisMarks(position: .trailing, values: .automatic(desiredCount: 3)) { _ in
                AxisGridLine().foregroundStyle(TarsTheme.hairline)
                AxisValueLabel(format: .currency(code: "USD").precision(.fractionLength(0)))
                    .foregroundStyle(TarsTheme.inkTertiary)
                    .font(TarsTheme.Text.micro.monospacedDigit())
            }
        }
    }

    private var statsGrid: some View {
        LazyVGrid(
            columns: Array(repeating: GridItem(.flexible(), alignment: .leading), count: 3),
            spacing: TarsTheme.Space.m
        ) {
            BTStat(label: "Ann. return",
                   text: Text(segment.annualizedReturn, format: .percent.precision(.fractionLength(1)).sign(strategy: .always())),
                   color: TarsTheme.pnl(segment.annualizedReturn))
            BTStat(label: "Max drawdown",
                   text: Text(segment.maxDrawdown, format: .percent.precision(.fractionLength(1))),
                   color: TarsTheme.inkPrimary)
            BTStat(label: "Sharpe",
                   text: Text(segment.sharpe, format: .number.precision(.fractionLength(2))),
                   color: TarsTheme.inkPrimary)
            BTStat(label: "Win rate",
                   text: Text(segment.winRate, format: .percent.precision(.fractionLength(0))),
                   color: TarsTheme.inkPrimary)
            BTStat(label: "Trades",
                   text: Text("\(segment.tradeCount)"),
                   color: TarsTheme.inkPrimary)
            BTStat(label: "Exposure",
                   text: Text(segment.exposure, format: .percent.precision(.fractionLength(0))),
                   color: TarsTheme.inkPrimary)
        }
    }
}

fileprivate struct BTStat: View {
    let label: String
    let text: Text
    let color: Color

    var body: some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(label.uppercased())
                .font(TarsTheme.Text.micro)
                .tracking(0.8)
                .foregroundStyle(TarsTheme.inkTertiary)
            text
                .font(TarsTheme.Text.priceSmall)
                .foregroundStyle(color)
        }
    }
}

// MARK: - Playback panel

/// Replays the full-span equity curve over ~6 seconds. The playhead sweeps the
/// timeline, trade markers pop in as it passes them, and the in/out-of-sample
/// boundary is drawn as "the honesty line".
fileprivate struct BTPlaybackPanel: View {
    let curve: [Double]
    let splitIndex: Int
    let trades: [BacktestResult.SimTrade]

    @State private var progress: Double = 0
    @State private var isPlaying = false
    @State private var playTask: Task<Void, Never>?

    private var playIndex: Int {
        guard curve.count > 1 else { return 0 }
        return min(curve.count - 1, Int(progress * Double(curve.count - 1)))
    }

    var body: some View {
        VStack(alignment: .leading, spacing: TarsTheme.Space.m) {
            BTSectionHeader(text: "Playback — watch it happen")

            VStack(alignment: .leading, spacing: TarsTheme.Space.m) {
                HStack(alignment: .firstTextBaseline) {
                    if !curve.isEmpty {
                        TickerText(
                            value: curve[playIndex],
                            format: .currency(code: "USD").precision(.fractionLength(0)),
                            font: TarsTheme.Text.priceHero)
                    }
                    Spacer()
                    Text("bar \(playIndex + 1) / \(max(curve.count, 1))")
                        .font(TarsTheme.Text.caption)
                        .foregroundStyle(TarsTheme.inkTertiary)
                        .monospacedDigit()
                }

                if curve.count > 1 {
                    playbackChart
                        .frame(height: 220)
                        .accessibilityLabel(playbackSummary)
                } else {
                    Text("Nothing to replay — the curve is a single point.")
                        .font(TarsTheme.Text.caption)
                        .foregroundStyle(TarsTheme.inkTertiary)
                        .frame(height: 220)
                }

                HStack(spacing: TarsTheme.Space.m) {
                    Button {
                        Haptics.tap()
                        togglePlayback()
                    } label: {
                        Image(systemName: isPlaying ? "pause.fill" : "play.fill")
                            .font(TarsTheme.Text.heading)
                            .foregroundStyle(TarsTheme.accent)
                            .frame(width: 44, height: 44)
                            .background(Circle().fill(TarsTheme.bg3))
                    }
                    .buttonStyle(PressableStyle())
                    .accessibilityLabel(isPlaying ? "Pause playback" : "Play backtest")

                    Slider(
                        value: Binding(
                            get: { progress },
                            set: { newValue in
                                stopPlayback()
                                progress = newValue
                            }),
                        in: 0...1)
                    .tint(TarsTheme.accent)
                    .accessibilityLabel("Playback position")
                    .accessibilityValue("Bar \(playIndex + 1) of \(max(curve.count, 1))")
                }

                Text("Amber zone is out-of-sample. Everything left of the honesty line was rehearsed; everything right of it was not.")
                    .font(TarsTheme.Text.caption)
                    .foregroundStyle(TarsTheme.inkTertiary)
            }
            .padding(TarsTheme.Space.l)
            .frame(maxWidth: .infinity, alignment: .leading)
            .tarsPanel()
        }
        .onDisappear { playTask?.cancel() }
    }

    private var playbackSummary: String {
        let from = (curve.first ?? 0).formatted(.currency(code: "USD").precision(.fractionLength(0)))
        let to = (curve.last ?? 0).formatted(.currency(code: "USD").precision(.fractionLength(0)))
        return "Equity curve playback, from \(from) to \(to) over \(curve.count) bars, with \(trades.count) trades marked"
    }

    private var playbackChart: some View {
        let lo = curve.min() ?? 0
        let hi = curve.max() ?? 1
        let played = TarsTheme.pnl(curve[playIndex] - curve[0])
        return Chart {
            // Out-of-sample zone tint.
            if splitIndex < curve.count {
                RectangleMark(
                    xStart: .value("Bar", splitIndex),
                    xEnd: .value("Bar", curve.count - 1)
                )
                .foregroundStyle(TarsTheme.paperBadge.opacity(0.05))
            }

            // Ghost of the full curve.
            ForEach(Array(curve.enumerated()), id: \.offset) { i, value in
                LineMark(
                    x: .value("Bar", i),
                    y: .value("Equity", value),
                    series: .value("Series", "full"))
                .lineStyle(StrokeStyle(lineWidth: 1))
                .foregroundStyle(TarsTheme.inkTertiary.opacity(0.30))
            }

            // The portion already played.
            ForEach(Array(curve.prefix(playIndex + 1).enumerated()), id: \.offset) { i, value in
                LineMark(
                    x: .value("Bar", i),
                    y: .value("Equity", value),
                    series: .value("Series", "played"))
                .lineStyle(StrokeStyle(lineWidth: 2, lineCap: .round))
                .foregroundStyle(played)
            }

            // Trade markers appear as the playhead passes them.
            ForEach(trades.filter { $0.entryIndex <= playIndex }) { trade in
                PointMark(
                    x: .value("Bar", trade.entryIndex),
                    y: .value("Equity", curve[min(trade.entryIndex, curve.count - 1)]))
                .symbol(.triangle)
                .symbolSize(46)
                .foregroundStyle(TarsTheme.accent)
            }
            ForEach(trades.filter { $0.exitIndex <= playIndex }) { trade in
                PointMark(
                    x: .value("Bar", trade.exitIndex),
                    y: .value("Equity", curve[min(trade.exitIndex, curve.count - 1)]))
                .symbol(.circle)
                .symbolSize(40)
                .foregroundStyle(TarsTheme.pnl(trade.pnlPercent))
            }

            // The honesty line: where rehearsal ends and the exam begins.
            if splitIndex < curve.count {
                RuleMark(x: .value("Bar", splitIndex))
                    .lineStyle(StrokeStyle(lineWidth: 1, dash: [4, 4]))
                    .foregroundStyle(TarsTheme.paperBadge.opacity(0.8))
                    .annotation(position: .top, alignment: .leading) {
                        Text("the honesty line")
                            .font(TarsTheme.Text.micro)
                            .foregroundStyle(TarsTheme.paperBadge)
                    }
            }

            // The playhead dot.
            PointMark(
                x: .value("Bar", playIndex),
                y: .value("Equity", curve[playIndex]))
            .symbolSize(140)
            .foregroundStyle(played)
        }
        .chartXAxis(.hidden)
        .chartYScale(domain: (lo * 0.995)...(max(hi * 1.005, lo * 0.995 + 1)))
        .chartYAxis {
            AxisMarks(position: .trailing, values: .automatic(desiredCount: 4)) { _ in
                AxisGridLine().foregroundStyle(TarsTheme.hairline)
                AxisValueLabel(format: .currency(code: "USD").precision(.fractionLength(0)))
                    .foregroundStyle(TarsTheme.inkTertiary)
                    .font(TarsTheme.Text.micro.monospacedDigit())
            }
        }
    }

    // MARK: Playback engine

    private func togglePlayback() {
        if isPlaying {
            stopPlayback()
        } else {
            startPlayback()
        }
    }

    private func startPlayback() {
        guard curve.count > 1 else { return }
        if progress >= 1 { progress = 0 }
        isPlaying = true
        playTask?.cancel()
        playTask = Task { @MainActor in
            let stepMs = 25.0
            let durationMs = 6000.0
            var crossedHonestyLine = playIndex >= splitIndex
            while !Task.isCancelled && progress < 1 {
                try? await Task.sleep(for: .milliseconds(Int(stepMs)))
                guard !Task.isCancelled else { return }
                progress = min(1, progress + stepMs / durationMs)
                if !crossedHonestyLine && playIndex >= splitIndex {
                    crossedHonestyLine = true
                    Haptics.tick()
                }
            }
            if !Task.isCancelled { isPlaying = false }
        }
    }

    private func stopPlayback() {
        playTask?.cancel()
        playTask = nil
        isPlaying = false
    }
}

// MARK: - Trade list

fileprivate enum BTTradeFilter: String, CaseIterable, Identifiable {
    case all = "All"
    case wins = "Wins"
    case losses = "Losses"
    var id: String { rawValue }
}

fileprivate struct BTTradeSection: View {
    let trades: [BacktestResult.SimTrade]
    @State private var filter: BTTradeFilter = .all

    private var filtered: [BacktestResult.SimTrade] {
        switch filter {
        case .all: trades
        case .wins: trades.filter { $0.pnlPercent > 0 }
        case .losses: trades.filter { $0.pnlPercent <= 0 }
        }
    }

    private func count(_ f: BTTradeFilter) -> Int {
        switch f {
        case .all: trades.count
        case .wins: trades.filter { $0.pnlPercent > 0 }.count
        case .losses: trades.filter { $0.pnlPercent <= 0 }.count
        }
    }

    private var emptyCopy: String {
        switch filter {
        case .all: "Zero trades. The rules never fired. A strategy that never trades can't lose — or teach."
        case .wins: "No wins in this run. At least the report is honest about it."
        case .losses: "No losses. Usually that means lucky, not brilliant."
        }
    }

    var body: some View {
        VStack(alignment: .leading, spacing: TarsTheme.Space.m) {
            BTSectionHeader(text: "Trade log")

            HStack(spacing: TarsTheme.Space.s) {
                ForEach(BTTradeFilter.allCases) { f in
                    Button {
                        Haptics.tick()
                        withAnimation(Motion.snappy) { filter = f }
                    } label: {
                        Text("\(f.rawValue) · \(count(f))")
                            .font(TarsTheme.Text.caption)
                            .monospacedDigit()
                            .foregroundStyle(filter == f ? TarsTheme.inkPrimary : TarsTheme.inkSecondary)
                            .padding(.horizontal, TarsTheme.Space.m)
                            .padding(.vertical, TarsTheme.Space.s)
                            .background(
                                Capsule().fill(filter == f ? TarsTheme.accent.opacity(0.18) : TarsTheme.bg3)
                                    .overlay(
                                        Capsule().strokeBorder(
                                            filter == f ? TarsTheme.accent.opacity(0.6) : TarsTheme.hairline,
                                            lineWidth: 1)
                                    )
                            )
                    }
                    .buttonStyle(PressableStyle())
                }
                Spacer()
            }

            if filtered.isEmpty {
                Text(emptyCopy)
                    .font(TarsTheme.Text.body)
                    .foregroundStyle(TarsTheme.inkTertiary)
                    .frame(maxWidth: .infinity, alignment: .center)
                    .padding(.vertical, TarsTheme.Space.xl)
                    .tarsPanel()
            } else {
                LazyVStack(spacing: TarsTheme.Space.s) {
                    ForEach(filtered) { trade in
                        BTTradeRow(trade: trade)
                    }
                }
            }
        }
    }
}

fileprivate struct BTTradeRow: View {
    let trade: BacktestResult.SimTrade

    var body: some View {
        HStack(spacing: TarsTheme.Space.m) {
            RoundedRectangle(cornerRadius: 2, style: .continuous)
                .fill(TarsTheme.pnl(trade.pnlPercent))
                .frame(width: 3, height: 34)

            VStack(alignment: .leading, spacing: 2) {
                Text(trade.symbol)
                    .font(TarsTheme.Text.price)
                    .foregroundStyle(TarsTheme.inkPrimary)
                    .lineLimit(1)
                    .minimumScaleFactor(0.7)
                Text(trade.reason)
                    .font(TarsTheme.Text.caption)
                    .foregroundStyle(TarsTheme.inkTertiary)
                    .lineLimit(1)
            }

            Spacer(minLength: TarsTheme.Space.m)

            VStack(alignment: .trailing, spacing: 2) {
                HStack(spacing: TarsTheme.Space.xs) {
                    Text(trade.entryPrice, format: .currency(code: "USD").precision(.fractionLength(2)))
                    Image(systemName: "arrow.right")
                        .font(TarsTheme.Text.micro)
                        .foregroundStyle(TarsTheme.inkTertiary)
                    Text(trade.exitPrice, format: .currency(code: "USD").precision(.fractionLength(2)))
                }
                .font(TarsTheme.Text.priceSmall)
                .foregroundStyle(TarsTheme.inkSecondary)

                HStack(spacing: TarsTheme.Space.s) {
                    Text("\(trade.exitIndex - trade.entryIndex) bars")
                        .font(TarsTheme.Text.micro)
                        .monospacedDigit()
                        .foregroundStyle(TarsTheme.inkTertiary)
                    PercentText(value: trade.pnlPercent)
                }
            }
        }
        .padding(.horizontal, TarsTheme.Space.m)
        .padding(.vertical, TarsTheme.Space.s)
        .tarsPanel()
    }
}

// MARK: - Empty state

fileprivate struct BTEmptyState: View {
    let agentName: String
    let emoji: String
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var appeared = false

    var body: some View {
        VStack(spacing: TarsTheme.Space.l) {
            ZStack {
                Circle()
                    .fill(TarsTheme.agentPurple.opacity(0.10))
                    .frame(width: 96, height: 96)
                Image(systemName: "clock.arrow.circlepath")
                    .font(TarsTheme.Text.hero)
                    .foregroundStyle(TarsTheme.agentPurple)
            }
            .scaleEffect(appeared ? 1 : 0.85)
            .opacity(appeared ? 1 : 0)
            .accessibilityHidden(true)

            VStack(spacing: TarsTheme.Space.s) {
                Text("No backtest yet")
                    .font(TarsTheme.Text.title)
                    .foregroundStyle(TarsTheme.inkPrimary)
                Text("\(emoji) \(agentName) hasn't faced the past yet. Run a backtest from the builder — history grades harder than hope, which is exactly why it's worth asking.")
                    .font(TarsTheme.Text.body)
                    .foregroundStyle(TarsTheme.inkSecondary)
                    .multilineTextAlignment(.center)
                    .frame(maxWidth: 420)
            }
            .opacity(appeared ? 1 : 0)
        }
        .onAppear {
            if reduceMotion {
                appeared = true
            } else {
                withAnimation(Motion.spatial) { appeared = true }
            }
        }
    }
}
