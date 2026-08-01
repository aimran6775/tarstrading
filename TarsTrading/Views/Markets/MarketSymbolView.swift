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
    @Environment(SessionStore.self) private var session
    @State private var model: SymbolModel
    @State private var ticketSide: String?
    @Environment(\.scenePhase) private var scenePhase

    init(symbol: String) {
        self.symbol = symbol
        _model = State(initialValue: SymbolModel(symbol: symbol))
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: TarsTheme.Space.l) {
                header
                    .padding(.horizontal, TarsTheme.Space.l)
                // The chart runs edge-to-edge, chromeless — the canvas is
                // the room, not a picture on the wall (Robinhood/Kalshi).
                chartSection
                tradeBar
                    .padding(.horizontal, TarsTheme.Space.l)
                context
                    .padding(.horizontal, TarsTheme.Space.l)
            }
            .padding(.vertical, TarsTheme.Space.l)
            .padding(.bottom, 64)
        }
        .background(TarsTheme.bg0)
        .navigationTitle(SymbolDisplay.pretty(symbol))
        .navigationBarTitleDisplayMode(.inline)
        .task {
            model.activate()
            #if DEBUG
            if ticketSide == nil,
               let t = UserDefaults.standard.string(forKey: "TarsOpenTicket"), !t.isEmpty {
                try? await Task.sleep(for: .seconds(2))
                ticketSide = t
            }
            #endif
        }
        .onDisappear { model.deactivate() }
        .onChange(of: scenePhase) { _, phase in
            if phase == .active { model.activate() } else { model.deactivate() }
        }
    }

    /// Two doors into the same ticket. Solid fill is a privilege and this
    /// is where it's earned — a washed-out CTA reads as a disabled one.
    private var tradeBar: some View {
        HStack(spacing: TarsTheme.Space.m) {
            tradeButton("Buy", side: "buy", tone: TarsTheme.gain)
            tradeButton("Sell", side: "sell", tone: TarsTheme.loss)
        }
        .sheet(item: Binding(
            get: { ticketSide.map { TicketRoute(side: $0) } },
            set: { ticketSide = $0?.side })) { route in
            TradeTicketSheet(symbol: symbol, side: route.side, quote: model.quote)
        }
    }
    private struct TicketRoute: Identifiable { let side: String; var id: String { side } }
    private func tradeButton(_ label: String, side: String, tone: Color) -> some View {
        Button {
            Haptics.tap()
            ticketSide = side
        } label: {
            Text(label)
                .font(TarsTheme.Text.heading)
                .foregroundStyle(TarsTheme.onFill)
                .frame(maxWidth: .infinity, minHeight: 52)
                .background(tone)
                .clipShape(RoundedRectangle(cornerRadius: TarsTheme.Radius.m, style: .continuous))
        }
        .buttonStyle(.plain)
    }

    // MARK: - Context: what you hold, and where the price sits

    @ViewBuilder private var context: some View {
        VStack(alignment: .leading, spacing: TarsTheme.Space.l) {
            if let p = session.positions.first(where: { $0.symbol == symbol }) {
                positionCard(p)
            }
            rangeSection
            factsRow
        }
        .padding(.top, TarsTheme.Space.s)
    }

    /// Your stake in this market — the number that makes the chart personal.
    private func positionCard(_ p: APIPosition) -> some View {
        let px = model.quote?.price
        let value = px.map { $0 * p.qty }
        let pnl = px.map { ($0 - p.avgEntryPrice) * p.qty }
        return VStack(alignment: .leading, spacing: TarsTheme.Space.s) {
            TarsMicroLabel("Your position")
            HStack(alignment: .firstTextBaseline) {
                VStack(alignment: .leading, spacing: 2) {
                    Text("\(p.qty > 0 ? "+" : "")\(p.qty.formatted()) @ \(SymbolDisplay.price(symbol, p.avgEntryPrice))")
                        .font(TarsTheme.Text.body.monospacedDigit().weight(.semibold))
                        .foregroundStyle(TarsTheme.inkPrimary)
                    if p.qty < 0 {
                        Text("SHORT")
                            .font(.system(size: 9, weight: .bold, design: .monospaced))
                            .foregroundStyle(TarsTheme.loss)
                    }
                }
                Spacer()
                VStack(alignment: .trailing, spacing: 2) {
                    if let value {
                        Text(value, format: .currency(code: "USD"))
                            .font(TarsTheme.Text.body.monospacedDigit())
                            .foregroundStyle(TarsTheme.inkPrimary)
                            .contentTransition(.numericText())
                            .animation(.snappy, value: value)
                    }
                    if let pnl {
                        Text("\(pnl >= 0 ? "+" : "")\(pnl, format: .currency(code: "USD"))")
                            .font(TarsTheme.Text.caption.monospacedDigit())
                            .foregroundStyle(TarsTheme.pnl(pnl))
                            .contentTransition(.numericText())
                            .animation(.snappy, value: pnl)
                    }
                }
            }
        }
        .padding(TarsTheme.Space.l)
        .tarsPanel()
        .accessibilityElement(children: .combine)
    }

    /// Where today sits inside the window you're looking at.
    @ViewBuilder private var rangeSection: some View {
        if let lo = model.bars.map(\.low).min(),
           let hi = model.bars.map(\.high).max(), hi > lo,
           let px = model.quote?.price {
            let t = min(max((px - lo) / (hi - lo), 0), 1)
            VStack(alignment: .leading, spacing: TarsTheme.Space.s) {
                TarsMicroLabel("\(model.timeframe) range")
                GeometryReader { geo in
                    ZStack(alignment: .leading) {
                        Capsule().fill(TarsTheme.bg3).frame(height: 4)
                        Circle().fill(TarsTheme.inkPrimary)
                            .frame(width: 9, height: 9)
                            .offset(x: (geo.size.width - 9) * CGFloat(t))
                    }
                    .frame(maxHeight: .infinity)
                }
                .frame(height: 12)
                HStack {
                    Text(SymbolDisplay.price(symbol, lo))
                    Spacer()
                    Text(SymbolDisplay.price(symbol, hi))
                }
                .font(TarsTheme.Text.micro.monospacedDigit())
                .foregroundStyle(TarsTheme.inkTertiary)
            }
            .accessibilityElement(children: .combine)
            .accessibilityLabel("Price sits \(Int(t * 100)) percent up the \(model.timeframe) range")
        }
    }

    @ViewBuilder private var factsRow: some View {
        if let q = model.quote {
            HStack(spacing: TarsTheme.Space.xl) {
                VStack(alignment: .leading, spacing: 2) {
                    TarsMicroLabel("Prev close")
                    Text(SymbolDisplay.price(symbol, q.previousClose))
                        .font(TarsTheme.Text.caption.monospacedDigit().weight(.semibold))
                        .foregroundStyle(TarsTheme.inkPrimary)
                }
                VStack(alignment: .leading, spacing: 2) {
                    TarsMicroLabel("Today")
                    Text("\(q.changePercent >= 0 ? "+" : "")\(q.changePercent * 100, specifier: "%.2f")%")
                        .font(TarsTheme.Text.caption.monospacedDigit().weight(.semibold))
                        .foregroundStyle(TarsTheme.pnl(q.changePercent))
                }
                Spacer()
            }
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
                        // One definition of provenance across the app: a delayed
                        // print at 2am reads AFTER HOURS here exactly as it does
                        // on the board and on the web.
                        Text(ProvenanceLabel.text(p, symbol: symbol))
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

    private var chartSection: some View {
        VStack(alignment: .leading, spacing: TarsTheme.Space.m) {
            if model.bars.count > 1 {
                chart
                    .frame(height: 280)
            } else if model.loadingBars {
                Rectangle().fill(TarsTheme.bg1)
                    .frame(height: 280)
                    .overlay(ProgressView().tint(TarsTheme.inkTertiary))
            } else {
                Rectangle().fill(TarsTheme.bg1)
                    .frame(height: 280)
                    .overlay(Text("No history for this market yet.")
                        .font(TarsTheme.Text.caption)
                        .foregroundStyle(TarsTheme.inkTertiary))
            }
            timeframePicker
                .padding(.horizontal, TarsTheme.Space.l)
        }
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
                .padding(.horizontal, TarsTheme.Space.l)
            }
            Chart(model.bars) { bar in
                LineMark(x: .value("Date", bar.date), y: .value("Close", bar.close))
                    .foregroundStyle(tone)
                    .lineStyle(StrokeStyle(lineWidth: 2, lineCap: .round, lineJoin: .round))
                    .interpolationMethod(.monotone)
                AreaMark(x: .value("Date", bar.date),
                         yStart: .value("Floor", model.yDomain.lowerBound),
                         yEnd: .value("Close", bar.close))
                    .foregroundStyle(LinearGradient(
                        colors: [tone.opacity(0.12), tone.opacity(0.0)],
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
            // No grid. Price levels whisper from the trailing edge; the
            // line is the only thing allowed to speak at full volume.
            .chartYAxis {
                AxisMarks(position: .trailing) { _ in
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
                        .font(TarsTheme.Text.caption.weight(selected ? Font.Weight.bold : Font.Weight.medium))
                        .foregroundStyle(selected ? TarsTheme.inkPrimary : TarsTheme.inkTertiary)
                        .frame(maxWidth: .infinity, minHeight: 44)
                        .contentShape(Rectangle())
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
