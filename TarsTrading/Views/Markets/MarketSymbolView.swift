import SwiftUI
import Charts

/*
  One market, up close — the platform's data, the house's feel.

  The chart is the centerpiece: a gradient-tinted line you can SCRUB, with a
  haptic detent per bar (the crosshair clicks like a jog wheel) and a price
  lens that reads out the day under your finger. Timeframes are the
  platform's own (1W → 5Y); the series is the same vault the web charts read,
  so the two can never tell different price histories.
*/
struct MarketSymbolView: View {
    let symbol: String
    @State private var model: SymbolModel
    @Environment(\.scenePhase) private var scenePhase

    init(symbol: String) {
        self.symbol = symbol
        _model = State(initialValue: SymbolModel(symbol: symbol))
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: TarsTheme.Space.l) {
                header
                chartCard
            }
            .padding(TarsTheme.Space.l)
        }
        .background(TarsTheme.bg0)
        .navigationTitle(SymbolDisplay.pretty(symbol))
        .navigationBarTitleDisplayMode(.inline)
        .task { model.activate() }
        .onDisappear { model.deactivate() }
        .onChange(of: scenePhase) { _, phase in
            if phase == .active { model.activate() } else { model.deactivate() }
        }
    }

    // MARK: - Header: the price, big enough to feel

    private var header: some View {
        VStack(alignment: .leading, spacing: 4) {
            if let q = model.quote {
                Text(SymbolDisplay.price(symbol, q.price))
                    .font(TarsTheme.Text.displayMedium)
                    .foregroundStyle(TarsTheme.inkPrimary)
                    .contentTransition(.numericText())
                    .animation(.snappy, value: q.price)
                HStack(spacing: TarsTheme.Space.m) {
                    let chg = q.changePercent
                    Text("\(chg >= 0 ? "+" : "")\(chg * 100, specifier: "%.2f")%")
                        .font(TarsTheme.Text.heading.monospacedDigit())
                        .foregroundStyle(chg > 0 ? TarsTheme.gain : chg < 0 ? TarsTheme.loss : TarsTheme.inkTertiary)
                    if let p = q.provenance {
                        Text(String(describing: p).uppercased())
                            .font(.system(size: 10, weight: .semibold, design: .monospaced))
                            .kerning(0.6)
                            .foregroundStyle(p == .live ? TarsTheme.gain : TarsTheme.inkTertiary)
                    }
                }
            } else {
                RoundedRectangle(cornerRadius: 6).fill(TarsTheme.bg3)
                    .frame(width: 180, height: 44)
            }
        }
        .accessibilityElement(children: .combine)
    }

    // MARK: - The chart

    private var chartCard: some View {
        VStack(alignment: .leading, spacing: TarsTheme.Space.m) {
            if model.bars.count > 1 {
                chart
                    .frame(height: 260)
            } else if model.loadingBars {
                RoundedRectangle(cornerRadius: 12).fill(TarsTheme.bg2)
                    .frame(height: 260)
                    .overlay(ProgressView().tint(TarsTheme.inkTertiary))
            } else {
                RoundedRectangle(cornerRadius: 12).fill(TarsTheme.bg2)
                    .frame(height: 260)
                    .overlay(Text("No history for this market yet.")
                        .font(TarsTheme.Text.caption)
                        .foregroundStyle(TarsTheme.inkTertiary))
            }
            timeframePicker
        }
        .padding(TarsTheme.Space.l)
        .tarsPanel()
    }

    private var up: Bool {
        guard let f = model.bars.first, let l = model.bars.last else { return true }
        return l.close >= f.close
    }

    private var chart: some View {
        let tone = up ? TarsTheme.gain : TarsTheme.loss
        let lens = model.scrubbed ?? model.bars.last
        return VStack(alignment: .leading, spacing: TarsTheme.Space.s) {
            // The lens: the day under your finger, or the latest close at rest.
            if let bar = lens {
                HStack(spacing: TarsTheme.Space.m) {
                    Text(bar.date, format: .dateTime.month(.abbreviated).day().year())
                        .font(TarsTheme.Text.micro)
                        .foregroundStyle(TarsTheme.inkTertiary)
                    Text(SymbolDisplay.price(symbol, bar.close))
                        .font(TarsTheme.Text.caption.monospacedDigit().weight(.semibold))
                        .foregroundStyle(TarsTheme.inkPrimary)
                    Spacer()
                }
                .accessibilityElement(children: .combine)
            }
            Chart(model.bars) { bar in
                LineMark(x: .value("Date", bar.date), y: .value("Close", bar.close))
                    .foregroundStyle(tone)
                    .lineStyle(StrokeStyle(lineWidth: 2, lineCap: .round, lineJoin: .round))
                    .interpolationMethod(.monotone)
                AreaMark(x: .value("Date", bar.date), y: .value("Close", bar.close))
                    .foregroundStyle(LinearGradient(
                        colors: [tone.opacity(0.25), tone.opacity(0.02)],
                        startPoint: .top, endPoint: .bottom))
                    .interpolationMethod(.monotone)
                if let s = model.scrubbed, s.id == bar.id {
                    RuleMark(x: .value("Date", bar.date))
                        .foregroundStyle(TarsTheme.inkTertiary.opacity(0.6))
                    PointMark(x: .value("Date", bar.date), y: .value("Close", bar.close))
                        .foregroundStyle(tone)
                        .symbolSize(60)
                }
            }
            .chartYScale(domain: model.yDomain)
            // The area fill reaches for y=0 far below the visible domain —
            // unclipped it floods the screen. The plot is a window, not a spill.
            .chartPlotStyle { $0.clipped() }
            .chartXAxis(.hidden)
            .chartYAxis {
                AxisMarks(position: .trailing) { _ in
                    AxisGridLine().foregroundStyle(TarsTheme.hairline)
                    AxisValueLabel().font(TarsTheme.Text.micro)
                        .foregroundStyle(TarsTheme.inkQuaternary)
                }
            }
            .chartOverlay { proxy in
                GeometryReader { _ in
                    Rectangle().fill(.clear).contentShape(Rectangle())
                        .gesture(DragGesture(minimumDistance: 0)
                            .onChanged { g in model.scrub(at: proxy.value(atX: g.location.x, as: Date.self)) }
                            .onEnded { _ in model.endScrub() })
                }
            }
            .accessibilityLabel(model.chartSummary(symbol: symbol))
        }
    }

    private var timeframePicker: some View {
        HStack(spacing: TarsTheme.Space.s) {
            ForEach(SymbolModel.timeframes, id: \.self) { tf in
                let selected = model.timeframe == tf
                Button {
                    Haptics.tick()
                    model.setTimeframe(tf)
                } label: {
                    Text(tf)
                        .font(TarsTheme.Text.caption.weight(.semibold))
                        .foregroundStyle(selected ? TarsTheme.onFill : TarsTheme.inkSecondary)
                        .frame(maxWidth: .infinity, minHeight: 36)
                        .background(selected ? TarsTheme.paperBadge : TarsTheme.bg2)
                        .clipShape(Capsule())
                }
                .buttonStyle(.plain)
                .accessibilityAddTraits(selected ? [.isSelected] : [])
            }
        }
    }
}

// MARK: - Model

@Observable @MainActor
final class SymbolModel {
    static let timeframes = ["1W", "1M", "3M", "1Y", "5Y"]

    let symbol: String
    private(set) var quote: APIQuote?
    private(set) var bars: [APIBar] = []
    private(set) var timeframe = "3M"
    private(set) var loadingBars = true
    private(set) var scrubbed: APIBar?

    private var loop: Task<Void, Never>?
    private let api = TarsAPIClient.shared

    init(symbol: String) { self.symbol = symbol }

    var yDomain: ClosedRange<Double> {
        let lo = bars.map(\.low).min() ?? 0
        let hi = bars.map(\.high).max() ?? 1
        let pad = (hi - lo) * 0.06
        return (lo - pad)...(hi + pad)
    }

    func setTimeframe(_ tf: String) {
        timeframe = tf
        loadingBars = true
        bars = []
        Task { await loadBars() }
    }

    /// The crosshair clicks bar to bar like a jog wheel — one haptic per detent.
    func scrub(at date: Date?) {
        guard let date, !bars.isEmpty else { return }
        let nearest = bars.min { abs($0.date.timeIntervalSince(date)) < abs($1.date.timeIntervalSince(date)) }
        if nearest?.id != scrubbed?.id {
            scrubbed = nearest
            Haptics.tick()
        }
    }

    func endScrub() { scrubbed = nil }

    func chartSummary(symbol: String) -> String {
        guard let f = bars.first, let l = bars.last, f.close > 0 else {
            return "Price chart, no data yet."
        }
        let move = (l.close / f.close - 1) * 100
        return "Price chart for \(SymbolDisplay.pretty(symbol)), \(bars.count) days, "
            + "\(move >= 0 ? "up" : "down") \(String(format: "%.1f", abs(move))) percent over \(timeframe)."
    }

    func activate() {
        guard loop == nil else { return }
        if bars.isEmpty { Task { await loadBars() } }
        loop = Task { [weak self] in
            while !Task.isCancelled {
                await self?.tickQuote()
                try? await Task.sleep(for: .seconds(20)) // the terminal's beat
            }
        }
    }

    func deactivate() {
        loop?.cancel()
        loop = nil
    }

    private func tickQuote() async {
        quote = (try? await api.quotes(symbols: [symbol]))?.first ?? quote
    }

    private func loadBars() async {
        bars = (try? await api.bars(symbol: symbol, timeframe: timeframe)) ?? []
        loadingBars = false
    }
}
