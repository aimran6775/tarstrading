import SwiftUI
import Charts

// MARK: - ChartView — the flagship price chart
//
// Candlestick / line chart with volume pane, crosshair inspection, indicator
// overlays (SMA/EMA/VWAP/Bollinger), an optional RSI subpane, a live last-price
// tag, and pencil tools (levels + trendlines, persisted per symbol — see
// ChartDrawings.swift). All indicator math lives at the bottom of this file as
// fileprivate helpers so nothing leaks into other modules.

struct ChartView: View {
    let symbol: String
    var height: CGFloat = 380

    @Environment(TradingStore.self) private var store
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    @State private var timeframe: Timeframe = .month3
    @State private var cache: [Timeframe: [Bar]] = [:]
    @State private var loadFailure: String?
    @State private var attempt = 0

    @State private var style: PriceStyle = .candles
    @State private var enabled: Set<ChartIndicator> = []
    @State private var fade: [ChartIndicator: Double] = [:]

    @State private var crossIndex: Int?
    @State private var crossX: CGFloat = 0
    @State private var crossPrice: Double?

    @State private var drawingMode = false
    @State private var drawingTool: ChartDrawingKind = .level
    @State private var drawings: [ChartDrawing] = []
    @State private var selectedDrawingID: UUID?
    @State private var draft: ChartDrawing?

    @Namespace private var timeframePill

    private enum Phase {
        case loading
        case failed(String)
        case empty
        case ready([Bar])
    }

    private var phase: Phase {
        if let bars = cache[timeframe] {
            return bars.count > 1 ? .ready(bars) : .empty
        }
        if let loadFailure { return .failed(loadFailure) }
        return .loading
    }

    private var loadKey: String { "\(symbol)|\(timeframe.rawValue)|\(attempt)" }
    private var priceHeight: CGFloat { height * 0.82 }
    private var volumeHeight: CGFloat { height * 0.18 - TarsTheme.Space.s }

    var body: some View {
        VStack(alignment: .leading, spacing: TarsTheme.Space.m) {
            controls
            if marketIsClosed {
                closedChip
                    .transition(.opacity)
            }
            switch phase {
            case .loading:
                skeleton
            case .failed(let message):
                errorCard(message)
            case .empty:
                emptyCard
            case .ready(let bars):
                chartStack(bars)
            }
        }
        .task(id: loadKey) { await load() }
        .onAppear { drawings = ChartDrawingStore.load(symbol: symbol) }
        .onChange(of: symbol) { _, newSymbol in
            cache = [:]
            loadFailure = nil
            crossIndex = nil
            crossPrice = nil
            drawings = ChartDrawingStore.load(symbol: newSymbol)
            selectedDrawingID = nil
            draft = nil
        }
    }

    // MARK: - Loading

    private func load() async {
        loadFailure = nil
        guard cache[timeframe] == nil else { return }
        do {
            let bars = try await store.marketData.bars(symbol: symbol, timeframe: timeframe)
            guard !Task.isCancelled else { return }
            withAnimation(reduceMotion ? nil : Motion.spatial) {
                cache[timeframe] = bars
            }
        } catch is CancellationError {
            // superseded by a newer request — nothing to surface
        } catch let error as TarsError {
            loadFailure = error.errorDescription ?? "Something went wrong."
        } catch {
            loadFailure = error.localizedDescription
        }
    }

    // MARK: - Controls row

    private var controls: some View {
        // On narrow widths (compact workspace column) the full row can't fit;
        // fall back to a horizontal scroll rather than clipping the pills.
        ViewThatFits(in: .horizontal) {
            controlsRow
            ScrollView(.horizontal, showsIndicators: false) {
                controlsRow
            }
        }
    }

    private var controlsRow: some View {
        HStack(spacing: TarsTheme.Space.m) {
            timeframeSwitcher
            Spacer(minLength: TarsTheme.Space.s)
            if selectedDrawingID != nil {
                deleteDrawingButton
            }
            if drawingMode {
                drawingToolPicker
            }
            pencilToggle
            styleToggle
            indicatorMenu
        }
    }

    // MARK: - Session honesty

    private var marketIsClosed: Bool {
        !symbol.contains("/") && !MarketClock.isOpen(.usEquity)
    }

    private var closedChip: some View {
        HStack(spacing: TarsTheme.Space.xs) {
            Image(systemName: "moon.zzz.fill")
                .font(TarsTheme.Text.micro)
                .foregroundStyle(TarsTheme.warning)
            Text(MarketClock.closedMessage())
                .font(TarsTheme.Text.micro)
                .foregroundStyle(TarsTheme.inkSecondary)
                .lineLimit(1)
                .minimumScaleFactor(0.8)
        }
        .padding(.horizontal, TarsTheme.Space.m)
        .padding(.vertical, TarsTheme.Space.xs + 1)
        .background(
            Capsule(style: .continuous)
                .fill(TarsTheme.bg1)
                .overlay(Capsule(style: .continuous).strokeBorder(TarsTheme.hairline, lineWidth: 1))
        )
        .accessibilityElement(children: .combine)
    }

    // MARK: - Drawing controls

    private var pencilToggle: some View {
        Button {
            Haptics.tap()
            withAnimation(reduceMotion ? nil : Motion.spatial) {
                drawingMode.toggle()
                if drawingMode {
                    crossIndex = nil
                    crossPrice = nil
                } else {
                    draft = nil
                    selectedDrawingID = nil
                }
            }
        } label: {
            Image(systemName: "pencil.line")
                .font(TarsTheme.Text.body)
                .foregroundStyle(drawingMode ? TarsTheme.accent : TarsTheme.inkSecondary)
                .frame(width: 34, height: 30)
                .background(
                    RoundedRectangle(cornerRadius: TarsTheme.Radius.s, style: .continuous)
                        .fill(drawingMode ? TarsTheme.accent.opacity(0.16) : TarsTheme.bg1)
                        .overlay(
                            RoundedRectangle(cornerRadius: TarsTheme.Radius.s, style: .continuous)
                                .strokeBorder(drawingMode ? TarsTheme.accent.opacity(0.5) : TarsTheme.hairline, lineWidth: 1)
                        )
                )
                .frame(minWidth: TarsTheme.Metrics.minTarget, minHeight: TarsTheme.Metrics.minTarget)
                .contentShape(Rectangle())
        }
        .hoverEffect(.highlight)
        .buttonStyle(PressableStyle())
        .accessibilityLabel(drawingMode ? "Exit drawing mode" : "Draw on chart")
        .accessibilityAddTraits(drawingMode ? .isSelected : [])
    }

    private var drawingToolPicker: some View {
        HStack(spacing: 2) {
            ForEach(ChartDrawingKind.allCases) { tool in
                Button {
                    guard tool != drawingTool else { return }
                    Haptics.tap()
                    withAnimation(reduceMotion ? nil : Motion.snappy) { drawingTool = tool }
                } label: {
                    Image(systemName: tool.symbolName)
                        .font(TarsTheme.Text.caption)
                        .foregroundStyle(tool == drawingTool ? TarsTheme.inkPrimary : TarsTheme.inkTertiary)
                        .frame(width: 30, height: 26)
                        .background {
                            if tool == drawingTool {
                                RoundedRectangle(cornerRadius: TarsTheme.Radius.inner(TarsTheme.Radius.s, inset: 2), style: .continuous)
                                    .fill(TarsTheme.bg3)
                            }
                        }
                        .frame(width: 34, height: TarsTheme.Metrics.minTarget)
                        .contentShape(Rectangle())
                }
                .buttonStyle(PressableStyle())
                .accessibilityLabel(tool.title)
                .accessibilityAddTraits(tool == drawingTool ? .isSelected : [])
            }
        }
        .padding(2)
        .background(
            RoundedRectangle(cornerRadius: TarsTheme.Radius.s, style: .continuous)
                .fill(TarsTheme.bg1)
                .overlay(
                    RoundedRectangle(cornerRadius: TarsTheme.Radius.s, style: .continuous)
                        .strokeBorder(TarsTheme.hairline, lineWidth: 1)
                )
        )
        .transition(.opacity.combined(with: .scale(scale: 0.9)))
    }

    private var deleteDrawingButton: some View {
        Button {
            deleteSelectedDrawing()
        } label: {
            Image(systemName: "trash")
                .font(TarsTheme.Text.body)
                .foregroundStyle(TarsTheme.loss)
                .frame(width: 34, height: 30)
                .background(
                    RoundedRectangle(cornerRadius: TarsTheme.Radius.s, style: .continuous)
                        .fill(TarsTheme.loss.opacity(0.12))
                        .overlay(
                            RoundedRectangle(cornerRadius: TarsTheme.Radius.s, style: .continuous)
                                .strokeBorder(TarsTheme.loss.opacity(0.4), lineWidth: 1)
                        )
                )
                .frame(minWidth: TarsTheme.Metrics.minTarget, minHeight: TarsTheme.Metrics.minTarget)
                .contentShape(Rectangle())
        }
        .hoverEffect(.highlight)
        .buttonStyle(PressableStyle())
        .accessibilityLabel("Delete selected drawing")
        .transition(.opacity.combined(with: .scale(scale: 0.9)))
    }

    private var timeframeSwitcher: some View {
        HStack(spacing: 2) {
            ForEach(Timeframe.allCases) { tf in
                Button {
                    guard tf != timeframe else { return }
                    Haptics.tap()
                    withAnimation(reduceMotion ? nil : Motion.spatial) {
                        timeframe = tf
                        crossIndex = nil
                        crossPrice = nil
                    }
                } label: {
                    Text(tf.rawValue)
                        .font(TarsTheme.Text.caption)
                        .foregroundStyle(tf == timeframe ? TarsTheme.inkPrimary : TarsTheme.inkTertiary)
                        .padding(.horizontal, TarsTheme.Space.m)
                        .padding(.vertical, TarsTheme.Space.xs)
                        .background {
                            if tf == timeframe {
                                Capsule(style: .continuous)
                                    .fill(TarsTheme.bg3)
                                    .matchedGeometryEffect(id: "tfPill", in: timeframePill)
                            }
                        }
                        .frame(minHeight: TarsTheme.Metrics.buttonCompact)
                        .contentShape(Rectangle())
                }
                .buttonStyle(PressableStyle())
                .accessibilityLabel("Timeframe \(tf.rawValue)")
                .accessibilityAddTraits(tf == timeframe ? .isSelected : [])
            }
        }
        .padding(2)
        .background(
            Capsule(style: .continuous)
                .fill(TarsTheme.bg1)
                .overlay(Capsule(style: .continuous).strokeBorder(TarsTheme.hairline, lineWidth: 1))
        )
    }

    private var styleToggle: some View {
        Button {
            Haptics.tap()
            withAnimation(reduceMotion ? nil : Motion.spatial) {
                style = style == .candles ? .line : .candles
            }
        } label: {
            Image(systemName: style == .candles ? "chart.xyaxis.line" : "chart.bar.fill")
                .font(TarsTheme.Text.body)
                .foregroundStyle(TarsTheme.inkSecondary)
                .frame(width: 34, height: 30)
                .background(
                    RoundedRectangle(cornerRadius: TarsTheme.Radius.s, style: .continuous)
                        .fill(TarsTheme.bg1)
                        .overlay(
                            RoundedRectangle(cornerRadius: TarsTheme.Radius.s, style: .continuous)
                                .strokeBorder(TarsTheme.hairline, lineWidth: 1)
                        )
                )
                .contentTransition(.symbolEffect(.replace))
                .frame(minWidth: TarsTheme.Metrics.minTarget, minHeight: TarsTheme.Metrics.minTarget)
                .contentShape(Rectangle())
        }
        .hoverEffect(.highlight)
        .buttonStyle(PressableStyle())
        .accessibilityLabel(style == .candles ? "Switch to line chart" : "Switch to candlestick chart")
    }

    private var indicatorMenu: some View {
        Menu {
            ForEach(ChartIndicator.allCases) { indicator in
                Toggle(isOn: binding(for: indicator)) {
                    Label(indicator.title, systemImage: indicator.symbolName)
                }
            }
        } label: {
            Image(systemName: "function")
                .font(TarsTheme.Text.body)
                .foregroundStyle(enabled.isEmpty ? TarsTheme.inkSecondary : TarsTheme.accent)
                .frame(width: 34, height: 30)
                .background(
                    RoundedRectangle(cornerRadius: TarsTheme.Radius.s, style: .continuous)
                        .fill(TarsTheme.bg1)
                        .overlay(
                            RoundedRectangle(cornerRadius: TarsTheme.Radius.s, style: .continuous)
                                .strokeBorder(TarsTheme.hairline, lineWidth: 1)
                        )
                )
                .frame(minWidth: TarsTheme.Metrics.minTarget, minHeight: TarsTheme.Metrics.minTarget)
                .contentShape(Rectangle())
        }
        .hoverEffect(.highlight)
        .accessibilityLabel("Indicators. \(enabled.isEmpty ? "None active" : "\(enabled.count) active")")
    }

    private func binding(for indicator: ChartIndicator) -> Binding<Bool> {
        Binding(
            get: { enabled.contains(indicator) },
            set: { isOn in
                Haptics.tap()
                if isOn {
                    withAnimation(reduceMotion ? nil : Motion.spatial) {
                        _ = enabled.insert(indicator)
                    }
                    fade[indicator] = 0
                    Task { @MainActor in
                        withAnimation(reduceMotion ? nil : Motion.grand) {
                            fade[indicator] = 1
                        }
                    }
                } else {
                    withAnimation(reduceMotion ? nil : Motion.spatial) {
                        enabled.remove(indicator)
                        fade[indicator] = 0
                    }
                }
            }
        )
    }

    // MARK: - Chart stack

    @ViewBuilder
    private func chartStack(_ bars: [Bar]) -> some View {
        let overlays = enabled.subtracting([.rsi])
        VStack(alignment: .leading, spacing: TarsTheme.Space.s) {
            priceChart(bars)
                .frame(height: priceHeight)
            volumeChart(bars)
                .frame(height: max(volumeHeight, 44))
            if enabled.contains(.rsi) {
                rsiChart(bars)
                    .frame(height: 64)
                    .transition(.opacity.combined(with: .move(edge: .top)))
            }
            if !overlays.isEmpty {
                legend(overlays)
                    .transition(.opacity)
            }
        }
    }

    // MARK: Price pane

    private func priceChart(_ bars: [Bar]) -> some View {
        let domain = yDomain(bars)
        let period = periodChange(bars)
        return Chart {
            if style == .candles {
                candleMarks(bars)
            } else {
                lineMarks(bars, gaining: period >= 0, baseline: domain.lowerBound)
            }
            overlayMarks(bars)
            lastPriceMarks(bars)
            drawingMarks
            crosshairMarks(bars)
        }
        .chartXScale(domain: xDomain(bars))
        .chartYScale(domain: domain)
        .chartXAxis(.hidden)
        .chartYAxis {
            AxisMarks(position: .trailing, values: .automatic(desiredCount: 4)) { value in
                AxisGridLine().foregroundStyle(TarsTheme.hairline)
                AxisValueLabel {
                    if let price = value.as(Double.self) {
                        Text(priceLabel(price))
                            .font(TarsTheme.Text.micro)
                            .monospacedDigit()
                            .foregroundStyle(TarsTheme.inkTertiary)
                            .frame(width: axisGutter, alignment: .trailing)
                    }
                }
            }
        }
        .chartOverlay { proxy in
            GeometryReader { geo in
                Rectangle()
                    .fill(Color.clear)
                    .contentShape(Rectangle())
                    .onTapGesture { location in
                        selectDrawing(at: location, proxy: proxy, geo: geo)
                    }
                    .gesture(chartDragGesture(proxy: proxy, geo: geo, bars: bars))
                if let index = crossIndex, bars.indices.contains(index) {
                    callout(bars: bars, index: index)
                        .position(
                            x: min(max(crossX, calloutWidth / 2 + 2), geo.size.width - calloutWidth / 2 - 2),
                            y: 74
                        )
                        .allowsHitTesting(false)
                        .transition(.opacity.combined(with: .scale(scale: 0.97)))
                }
            }
        }
        .accessibilityLabel("\(style == .candles ? "Candlestick" : "Line") chart for \(symbol), \(timeframe.rawValue) range\(dateRangeLabel(bars))")
        .accessibilityValue(accessibilitySummary(bars))
        .accessibilityHint(
            drawingMode
                ? "Drawing mode active. Drag to place a \(drawingTool.title.lowercased()). Tap a drawing to select it."
                : "Drag across the chart to inspect individual bars."
        )
    }

    @ChartContentBuilder
    private func candleMarks(_ bars: [Bar]) -> some ChartContent {
        let latestTime = bars.last?.time
        ForEach(bars) { bar in
            let tint = bar.isUp ? TarsTheme.gain : TarsTheme.loss
            let bodyTop = max(bar.open, bar.close)
            let bodyBottom = min(bar.open, bar.close)
            let epsilon = max(bar.close.magnitude, 1) * 0.0004
            // Wick
            RuleMark(
                x: .value("Time", bar.time),
                yStart: .value("Low", bar.low),
                yEnd: .value("High", bar.high)
            )
            .lineStyle(StrokeStyle(lineWidth: 1))
            .foregroundStyle(tint.opacity(0.7))
            // Body — ratio-based so candles stay ~70% of their slot at any density
            RectangleMark(
                x: .value("Time", bar.time),
                yStart: .value("Open", bodyBottom - (bodyTop == bodyBottom ? epsilon : 0)),
                yEnd: .value("Close", bodyTop + (bodyTop == bodyBottom ? epsilon : 0)),
                width: .ratio(0.7)
            )
            .foregroundStyle(candleBodyStyle(tint: tint, latest: bar.time == latestTime))
        }
    }

    /// The newest candle earns a 1pt rim light and a soft direction-tinted
    /// glow; every other candle stays flat so the eye lands on now.
    private func candleBodyStyle(tint: Color, latest: Bool) -> AnyShapeStyle {
        guard latest else { return AnyShapeStyle(tint) }
        return AnyShapeStyle(
            tint
                .shadow(.inner(color: TarsTheme.inkPrimary.opacity(0.55), radius: 1))
                .shadow(.drop(color: tint.opacity(0.45), radius: 6))
        )
    }

    @ChartContentBuilder
    private func lineMarks(_ bars: [Bar], gaining: Bool, baseline: Double) -> some ChartContent {
        ForEach(bars) { bar in
            AreaMark(
                x: .value("Time", bar.time),
                yStart: .value("Base", baseline),
                yEnd: .value("Close", bar.close)
            )
            .interpolationMethod(.monotone)
            .foregroundStyle(gaining ? TarsTheme.chartGain : TarsTheme.chartLoss)
        }
        let tint = gaining ? TarsTheme.gain : TarsTheme.loss
        ForEach(bars) { bar in
            LineMark(
                x: .value("Time", bar.time),
                y: .value("Close", bar.close),
                series: .value("Series", "close")
            )
            .interpolationMethod(.monotone)
            .lineStyle(StrokeStyle(lineWidth: 2, lineCap: .round))
            .foregroundStyle(tint.shadow(.drop(color: tint.opacity(0.35), radius: 4)))
        }
    }

    // MARK: Last price

    @ChartContentBuilder
    private func lastPriceMarks(_ bars: [Bar]) -> some ChartContent {
        if let last = bars.last {
            // Day direction: intraday compares to the session open; longer
            // ranges compare the newest close to the bar before it.
            let reference = timeframe == .day1
                ? (bars.first?.open ?? last.open)
                : (bars.count > 1 ? bars[bars.count - 2].close : last.open)
            let tint = last.close >= reference ? TarsTheme.gain : TarsTheme.loss
            RuleMark(y: .value("Last price", last.close))
                .lineStyle(StrokeStyle(lineWidth: 1, dash: [2, 3]))
                .foregroundStyle(tint.opacity(0.45))
                .annotation(
                    position: .trailing,
                    spacing: TarsTheme.Space.xs,
                    overflowResolution: .init(x: .fit(to: .chart), y: .fit(to: .chart))
                ) {
                    LastPricePill(text: priceLabel(last.close), tint: tint, animated: !reduceMotion)
                }
        }
    }

    // MARK: Drawings

    @ChartContentBuilder
    private var drawingMarks: some ChartContent {
        ForEach(drawings) { drawing in
            drawingMark(
                drawing,
                tint: drawing.id == selectedDrawingID ? TarsTheme.warning : TarsTheme.accent,
                emphasized: drawing.id == selectedDrawingID,
                faded: false
            )
        }
        if let draft {
            drawingMark(draft, tint: TarsTheme.accent, emphasized: false, faded: true)
        }
    }

    @ChartContentBuilder
    private func drawingMark(_ drawing: ChartDrawing, tint: Color, emphasized: Bool, faded: Bool) -> some ChartContent {
        let opacity = faded ? 0.55 : 0.9
        if drawing.kind == .level {
            RuleMark(y: .value("Level", drawing.priceA))
                .lineStyle(StrokeStyle(lineWidth: emphasized ? 2 : 1, dash: [6, 4]))
                .foregroundStyle(tint.opacity(opacity))
        } else {
            LineMark(
                x: .value("Time", drawing.timeA),
                y: .value("Price", drawing.priceA),
                series: .value("Series", "drawing-\(drawing.id.uuidString)")
            )
            .lineStyle(StrokeStyle(lineWidth: emphasized ? 2.5 : 1.5, lineCap: .round))
            .foregroundStyle(tint.opacity(opacity))
            LineMark(
                x: .value("Time", drawing.timeB),
                y: .value("Price", drawing.priceB),
                series: .value("Series", "drawing-\(drawing.id.uuidString)")
            )
            .lineStyle(StrokeStyle(lineWidth: emphasized ? 2.5 : 1.5, lineCap: .round))
            .foregroundStyle(tint.opacity(opacity))
        }
    }

    @ChartContentBuilder
    private func overlayMarks(_ bars: [Bar]) -> some ChartContent {
        if enabled.contains(.bollinger) {
            let band = TarsChartMath.bollinger(bars, period: 20, multiplier: 2)
            ForEach(band) { point in
                AreaMark(
                    x: .value("Time", point.time),
                    yStart: .value("Lower", point.lower),
                    yEnd: .value("Upper", point.upper)
                )
                .foregroundStyle(TarsTheme.accent.opacity(0.08))
            }
            .opacity(fade[.bollinger] ?? 0)
            ForEach(band) { point in
                LineMark(
                    x: .value("Time", point.time),
                    y: .value("Upper", point.upper),
                    series: .value("Series", "bbU")
                )
                .lineStyle(StrokeStyle(lineWidth: 1))
                .foregroundStyle(TarsTheme.accent.opacity(0.5))
            }
            .opacity(fade[.bollinger] ?? 0)
            ForEach(band) { point in
                LineMark(
                    x: .value("Time", point.time),
                    y: .value("Lower", point.lower),
                    series: .value("Series", "bbL")
                )
                .lineStyle(StrokeStyle(lineWidth: 1))
                .foregroundStyle(TarsTheme.accent.opacity(0.5))
            }
            .opacity(fade[.bollinger] ?? 0)
        }
        if enabled.contains(.sma20) {
            singleLine(TarsChartMath.sma(bars, period: 20), key: "sma20",
                       color: ChartIndicator.sma20.color, fade: fade[.sma20] ?? 0)
        }
        if enabled.contains(.sma50) {
            singleLine(TarsChartMath.sma(bars, period: 50), key: "sma50",
                       color: ChartIndicator.sma50.color, fade: fade[.sma50] ?? 0)
        }
        if enabled.contains(.ema20) {
            singleLine(TarsChartMath.ema(bars, period: 20), key: "ema20",
                       color: ChartIndicator.ema20.color, fade: fade[.ema20] ?? 0)
        }
        if enabled.contains(.vwap) {
            singleLine(TarsChartMath.vwap(bars), key: "vwap",
                       color: ChartIndicator.vwap.color, fade: fade[.vwap] ?? 0)
        }
    }

    @ChartContentBuilder
    private func singleLine(_ points: [TarsSeriesPoint], key: String, color: Color, fade: Double) -> some ChartContent {
        ForEach(points) { point in
            LineMark(
                x: .value("Time", point.time),
                y: .value(key, point.value),
                series: .value("Series", key)
            )
            .lineStyle(StrokeStyle(lineWidth: 1.5))
            .foregroundStyle(color)
        }
        .opacity(fade)
    }

    @ChartContentBuilder
    private func crosshairMarks(_ bars: [Bar]) -> some ChartContent {
        if let index = crossIndex, bars.indices.contains(index) {
            let bar = bars[index]
            RuleMark(x: .value("Time", bar.time))
                .lineStyle(StrokeStyle(lineWidth: 1))
                .foregroundStyle(TarsTheme.inkSecondary.opacity(0.55))
            if let price = crossPrice {
                RuleMark(y: .value("Price", price))
                    .lineStyle(StrokeStyle(lineWidth: 1, dash: [3, 4]))
                    .foregroundStyle(TarsTheme.inkSecondary.opacity(0.35))
            }
            PointMark(
                x: .value("Time", bar.time),
                y: .value("Close", bar.close)
            )
            .symbolSize(46)
            .foregroundStyle(TarsTheme.accent)
        }
    }

    // MARK: Volume pane

    private func volumeChart(_ bars: [Bar]) -> some View {
        let maxVolume = bars.map(\.volume).max() ?? 0
        return Chart {
            ForEach(bars) { bar in
                BarMark(
                    x: .value("Time", bar.time),
                    y: .value("Volume", bar.volume),
                    width: .ratio(0.6)
                )
                .foregroundStyle((bar.isUp ? TarsTheme.gain : TarsTheme.loss).opacity(0.35))
            }
            // Hairline baseline anchoring the pane.
            RuleMark(y: .value("Baseline", 0))
                .lineStyle(StrokeStyle(lineWidth: 1))
                .foregroundStyle(TarsTheme.hairline)
            if let index = crossIndex, bars.indices.contains(index) {
                RuleMark(x: .value("Time", bars[index].time))
                    .lineStyle(StrokeStyle(lineWidth: 1))
                    .foregroundStyle(TarsTheme.inkSecondary.opacity(0.55))
            }
        }
        .chartXScale(domain: xDomain(bars))
        .chartYScale(domain: 0...(max(maxVolume, 1) * 1.05))
        .chartYAxis {
            // A single max label — the pane reads as texture, not a second chart.
            AxisMarks(position: .trailing, values: [maxVolume]) { value in
                AxisValueLabel {
                    if let volume = value.as(Double.self) {
                        Text(volumeLabel(volume))
                            .font(TarsTheme.Text.micro)
                            .monospacedDigit()
                            .foregroundStyle(TarsTheme.inkTertiary)
                            .frame(width: axisGutter, alignment: .trailing)
                    }
                }
            }
        }
        .chartXAxis {
            AxisMarks(values: .automatic(desiredCount: 5)) { _ in
                AxisValueLabel(format: xLabelFormat)
                    .font(TarsTheme.Text.micro)
                    .foregroundStyle(TarsTheme.inkTertiary)
            }
        }
        .accessibilityLabel("Volume for \(symbol)")
    }

    // MARK: RSI pane

    private func rsiChart(_ bars: [Bar]) -> some View {
        let points = TarsChartMath.rsi(bars, period: 14)
        return Chart {
            RuleMark(y: .value("Overbought", 70))
                .lineStyle(StrokeStyle(lineWidth: 1, dash: [2, 4]))
                .foregroundStyle(TarsTheme.hairline)
            RuleMark(y: .value("Oversold", 30))
                .lineStyle(StrokeStyle(lineWidth: 1, dash: [2, 4]))
                .foregroundStyle(TarsTheme.hairline)
            ForEach(points) { point in
                LineMark(
                    x: .value("Time", point.time),
                    y: .value("RSI", point.value),
                    series: .value("Series", "rsi")
                )
                .lineStyle(StrokeStyle(lineWidth: 1.5))
                .foregroundStyle(ChartIndicator.rsi.color)
            }
            if let index = crossIndex, bars.indices.contains(index) {
                RuleMark(x: .value("Time", bars[index].time))
                    .lineStyle(StrokeStyle(lineWidth: 1))
                    .foregroundStyle(TarsTheme.inkSecondary.opacity(0.55))
            }
        }
        .chartXScale(domain: xDomain(bars))
        .chartYScale(domain: 0...100)
        .chartXAxis(.hidden)
        .chartYAxis {
            AxisMarks(position: .trailing, values: [30, 70]) { value in
                AxisValueLabel {
                    if let level = value.as(Double.self) {
                        Text(level.formatted(.number.precision(.fractionLength(0))))
                            .font(TarsTheme.Text.micro)
                            .monospacedDigit()
                            .foregroundStyle(TarsTheme.inkTertiary)
                            .frame(width: axisGutter, alignment: .trailing)
                    }
                }
            }
        }
        .accessibilityLabel("Relative strength index, 14 period, for \(symbol)")
    }

    // MARK: Legend

    private func legend(_ overlays: Set<ChartIndicator>) -> some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: TarsTheme.Space.s) {
                ForEach(ChartIndicator.allCases.filter { overlays.contains($0) }) { indicator in
                    HStack(spacing: TarsTheme.Space.xs) {
                        Circle()
                            .fill(indicator.color)
                            .frame(width: 6, height: 6)
                        Text(indicator.title)
                            .font(TarsTheme.Text.micro)
                            .foregroundStyle(TarsTheme.inkSecondary)
                            .lineLimit(1)
                    }
                    .padding(.horizontal, TarsTheme.Space.s)
                    .padding(.vertical, TarsTheme.Space.xs)
                    .background(Capsule(style: .continuous).fill(TarsTheme.bg2))
                }
            }
        }
        .accessibilityElement(children: .combine)
        .accessibilityLabel("Active indicators: \(overlays.map(\.title).joined(separator: ", "))")
    }

    // MARK: - Gestures (crosshair + drawing share one drag)

    /// Pencil mode routes the drag to drawing creation; otherwise it drives
    /// the crosshair. One gesture, so the two never fight over touches.
    private func chartDragGesture(proxy: ChartProxy, geo: GeometryProxy, bars: [Bar]) -> some Gesture {
        DragGesture(minimumDistance: drawingMode ? 2 : 4)
            .onChanged { drag in
                if drawingMode {
                    updateDraft(with: drag, proxy: proxy, geo: geo, bars: bars)
                } else {
                    updateCrosshair(at: drag.location, proxy: proxy, geo: geo, bars: bars)
                }
            }
            .onEnded { _ in
                if drawingMode {
                    commitDraft()
                } else {
                    withAnimation(reduceMotion ? nil : Motion.snappy) {
                        crossIndex = nil
                        crossPrice = nil
                    }
                }
            }
    }

    // MARK: - Drawing interaction

    private func updateDraft(with drag: DragGesture.Value, proxy: ChartProxy, geo: GeometryProxy, bars: [Bar]) {
        guard let plotAnchor = proxy.plotFrame else { return }
        let plot = geo[plotAnchor]
        let current = CGPoint(x: drag.location.x - plot.minX, y: drag.location.y - plot.minY)
        let id = draft?.id ?? UUID()
        switch drawingTool {
        case .level:
            guard let price: Double = proxy.value(atY: current.y) else { return }
            let time: Date = proxy.value(atX: current.x) ?? bars.last?.time ?? .now
            draft = ChartDrawing(id: id, kind: .level, timeA: time, priceA: price, timeB: time, priceB: price)
        case .trendline:
            let start = CGPoint(x: drag.startLocation.x - plot.minX, y: drag.startLocation.y - plot.minY)
            guard let a = drawingAnchor(at: start, proxy: proxy, bars: bars),
                  let b = drawingAnchor(at: current, proxy: proxy, bars: bars) else { return }
            draft = ChartDrawing(id: id, kind: .trendline, timeA: a.time, priceA: a.price, timeB: b.time, priceB: b.price)
        }
    }

    /// Chart-space anchor for a plot point, with a slight snap to the nearest
    /// bar's close when within 8pt vertically.
    private func drawingAnchor(at point: CGPoint, proxy: ChartProxy, bars: [Bar]) -> (time: Date, price: Double)? {
        guard let date: Date = proxy.value(atX: point.x),
              let price: Double = proxy.value(atY: point.y) else { return nil }
        if let nearest = bars.min(by: {
            abs($0.time.timeIntervalSince(date)) < abs($1.time.timeIntervalSince(date))
        }),
           let closeY = proxy.position(forY: nearest.close),
           abs(point.y - closeY) <= 8 {
            return (nearest.time, nearest.close)
        }
        return (date, price)
    }

    private func commitDraft() {
        guard let committed = draft else { return }
        draft = nil
        withAnimation(reduceMotion ? nil : Motion.snappy) {
            drawings.append(committed)
        }
        ChartDrawingStore.save(drawings, symbol: symbol)
        Haptics.confirm()
    }

    private func selectDrawing(at location: CGPoint, proxy: ChartProxy, geo: GeometryProxy) {
        guard !drawings.isEmpty || selectedDrawingID != nil,
              let plotAnchor = proxy.plotFrame else { return }
        let plot = geo[plotAnchor]
        let point = CGPoint(x: location.x - plot.minX, y: location.y - plot.minY)
        let hit = drawings.last { drawing in
            switch drawing.kind {
            case .level:
                guard let y = proxy.position(forY: drawing.priceA) else { return false }
                return abs(point.y - y) <= 12
            case .trendline:
                guard let ax = proxy.position(forX: drawing.timeA),
                      let ay = proxy.position(forY: drawing.priceA),
                      let bx = proxy.position(forX: drawing.timeB),
                      let by = proxy.position(forY: drawing.priceB) else { return false }
                return ChartDrawingGeometry.distance(
                    from: point,
                    toSegment: CGPoint(x: ax, y: ay), CGPoint(x: bx, y: by)
                ) <= 12
            }
        }
        guard hit != nil || selectedDrawingID != nil else { return }
        if hit != nil { Haptics.tick() }
        withAnimation(reduceMotion ? nil : Motion.snappy) {
            selectedDrawingID = hit?.id == selectedDrawingID ? nil : hit?.id
        }
    }

    private func deleteSelectedDrawing() {
        guard let id = selectedDrawingID else { return }
        Haptics.tap()
        withAnimation(reduceMotion ? nil : Motion.snappy) {
            drawings.removeAll { $0.id == id }
            selectedDrawingID = nil
        }
        ChartDrawingStore.save(drawings, symbol: symbol)
    }

    // MARK: - Crosshair

    private func updateCrosshair(at location: CGPoint, proxy: ChartProxy, geo: GeometryProxy, bars: [Bar]) {
        guard let plotAnchor = proxy.plotFrame else { return }
        let plot = geo[plotAnchor]
        let xInPlot = location.x - plot.minX
        guard let date: Date = proxy.value(atX: xInPlot) else { return }
        guard let nearest = bars.enumerated().min(by: {
            abs($0.element.time.timeIntervalSince(date)) < abs($1.element.time.timeIntervalSince(date))
        }) else { return }
        if nearest.offset != crossIndex {
            Haptics.tick()
            withAnimation(reduceMotion ? nil : Motion.snappy) {
                crossIndex = nearest.offset
            }
        }
        if let snappedX = proxy.position(forX: nearest.element.time) {
            crossX = snappedX + plot.minX
        }
        if let price: Double = proxy.value(atY: location.y - plot.minY) {
            crossPrice = price
        }
    }

    private let calloutWidth: CGFloat = 178

    private func callout(bars: [Bar], index: Int) -> some View {
        let bar = bars[index]
        let previousClose = index > 0 ? bars[index - 1].close : bar.open
        let change = previousClose == 0 ? 0 : (bar.close - previousClose) / previousClose
        return VStack(alignment: .leading, spacing: TarsTheme.Space.xs) {
            HStack {
                Text(timestampLabel(bar.time))
                    .font(TarsTheme.Text.micro)
                    .foregroundStyle(TarsTheme.inkTertiary)
                Spacer(minLength: TarsTheme.Space.s)
                PercentText(value: change, font: TarsTheme.Text.priceSmall)
            }
            calloutRow("O", priceLabel(bar.open))
            calloutRow("H", priceLabel(bar.high))
            calloutRow("L", priceLabel(bar.low))
            calloutRow("C", priceLabel(bar.close))
            calloutRow("Vol", volumeLabel(bar.volume))
        }
        .padding(TarsTheme.Space.m)
        .frame(width: calloutWidth, alignment: .leading)
        .tarsPanel(elevation: 2)
        .accessibilityElement(children: .combine)
        .accessibilityLabel(
            "\(timestampLabel(bar.time)). Open \(priceLabel(bar.open)), high \(priceLabel(bar.high)), low \(priceLabel(bar.low)), close \(priceLabel(bar.close)), volume \(volumeLabel(bar.volume))"
        )
    }

    private func calloutRow(_ label: String, _ value: String) -> some View {
        HStack {
            Text(label)
                .font(TarsTheme.Text.micro)
                .foregroundStyle(TarsTheme.inkTertiary)
            Spacer(minLength: TarsTheme.Space.s)
            Text(value)
                .font(TarsTheme.Text.priceSmall)
                .foregroundStyle(TarsTheme.inkPrimary)
                .lineLimit(1)
                .minimumScaleFactor(0.6)
        }
    }

    // MARK: - Loading / error / empty states

    private var skeleton: some View {
        HStack(alignment: .bottom, spacing: TarsTheme.Space.xs) {
            ForEach(0..<28, id: \.self) { i in
                let wave = (sin(Double(i) * 0.7) + 1) / 2
                RoundedRectangle(cornerRadius: TarsTheme.Radius.micro, style: .continuous)
                    .fill(TarsTheme.bg3)
                    .frame(height: 40 + wave * (priceHeight * 0.5))
                    .frame(maxWidth: .infinity)
            }
            VStack(alignment: .trailing, spacing: TarsTheme.Space.xl) {
                ForEach(0..<4, id: \.self) { _ in
                    RoundedRectangle(cornerRadius: TarsTheme.Radius.micro, style: .continuous)
                        .fill(TarsTheme.bg3)
                        .frame(width: 40, height: 8)
                }
            }
            .frame(width: axisGutter)
        }
        .frame(height: height, alignment: .bottom)
        .modifier(TarsConditionalShimmer(active: !reduceMotion))
        .accessibilityLabel("Loading chart for \(symbol)")
    }

    private func errorCard(_ message: String) -> some View {
        VStack(spacing: TarsTheme.Space.m) {
            Image(systemName: "wifi.exclamationmark")
                .font(TarsTheme.Text.title)
                .foregroundStyle(TarsTheme.warning)
            Text("Chart unavailable")
                .font(TarsTheme.Text.heading)
                .foregroundStyle(TarsTheme.inkPrimary)
            Text(message)
                .font(TarsTheme.Text.body)
                .foregroundStyle(TarsTheme.inkSecondary)
                .multilineTextAlignment(.center)
                .lineLimit(3)
            Button {
                Haptics.tap()
                attempt += 1
            } label: {
                Text("Retry")
                    .font(TarsTheme.Text.caption)
                    .foregroundStyle(TarsTheme.bg0)
                    .padding(.horizontal, TarsTheme.Space.xl)
                    .padding(.vertical, TarsTheme.Space.s)
                    .background(Capsule(style: .continuous).fill(TarsTheme.accent))
            }
            .buttonStyle(PressableStyle())
            .accessibilityLabel("Retry loading chart for \(symbol)")
        }
        .padding(TarsTheme.Space.xl)
        .frame(maxWidth: .infinity)
        .frame(height: height)
        .tarsPanel()
    }

    private var emptyCard: some View {
        VStack(spacing: TarsTheme.Space.m) {
            Image(systemName: "chart.xyaxis.line")
                .font(TarsTheme.Text.title)
                .foregroundStyle(TarsTheme.inkTertiary)
            Text("No data for \(symbol)")
                .font(TarsTheme.Text.heading)
                .foregroundStyle(TarsTheme.inkPrimary)
            Text("This range hasn't produced any bars yet. Try a different timeframe.")
                .font(TarsTheme.Text.body)
                .foregroundStyle(TarsTheme.inkSecondary)
                .multilineTextAlignment(.center)
        }
        .padding(TarsTheme.Space.xl)
        .frame(maxWidth: .infinity)
        .frame(height: height)
        .tarsPanel()
        .accessibilityElement(children: .combine)
    }

    // MARK: - Scales & formatting

    private let axisGutter: CGFloat = 52

    private func xDomain(_ bars: [Bar]) -> ClosedRange<Date> {
        guard let first = bars.first?.time, let last = bars.last?.time, first < last else {
            return Date.now.addingTimeInterval(-86_400)...Date.now
        }
        return first...last
    }

    private func yDomain(_ bars: [Bar]) -> ClosedRange<Double> {
        var low = bars.map(\.low).min() ?? 0
        var high = bars.map(\.high).max() ?? 1
        if enabled.contains(.bollinger) {
            let band = TarsChartMath.bollinger(bars, period: 20, multiplier: 2)
            low = min(low, band.map(\.lower).min() ?? low)
            high = max(high, band.map(\.upper).max() ?? high)
        }
        if enabled.contains(.vwap) {
            let points = TarsChartMath.vwap(bars)
            low = min(low, points.map(\.value).min() ?? low)
            high = max(high, points.map(\.value).max() ?? high)
        }
        let pad = max((high - low) * 0.05, high * 0.001, 0.0001)
        return (low - pad)...(high + pad)
    }

    private func periodChange(_ bars: [Bar]) -> Double {
        guard let first = bars.first?.close, let last = bars.last?.close, first != 0 else { return 0 }
        return (last - first) / first
    }

    private func priceLabel(_ value: Double) -> String {
        let digits = abs(value) < 1 ? 4 : 2
        return value.formatted(.number.precision(.fractionLength(digits)).grouping(.automatic))
    }

    private func volumeLabel(_ value: Double) -> String {
        value.formatted(.number.notation(.compactName).precision(.fractionLength(0...1)))
    }

    private func timestampLabel(_ date: Date) -> String {
        switch timeframe {
        case .day1:
            return date.formatted(date: .omitted, time: .shortened)
        case .week1:
            return date.formatted(.dateTime.month(.abbreviated).day().hour().minute())
        default:
            return date.formatted(date: .abbreviated, time: .omitted)
        }
    }

    private var xLabelFormat: Date.FormatStyle {
        switch timeframe {
        case .day1: .dateTime.hour()
        case .week1: .dateTime.weekday(.abbreviated).day()
        case .month1, .month3: .dateTime.month(.abbreviated).day()
        case .year1: .dateTime.month(.abbreviated)
        case .year5: .dateTime.year()
        }
    }

    /// ", from Jan 2 to Apr 2, 2026" — appended to the chart's accessibility label.
    private func dateRangeLabel(_ bars: [Bar]) -> String {
        guard let first = bars.first?.time, let last = bars.last?.time else { return "" }
        let from = first.formatted(date: .abbreviated, time: .omitted)
        let to = last.formatted(date: .abbreviated, time: .omitted)
        guard from != to else { return "" }
        return ", from \(from) to \(to)"
    }

    private func accessibilitySummary(_ bars: [Bar]) -> String {
        guard let last = bars.last else { return "No data" }
        let change = periodChange(bars)
        let direction = change >= 0 ? "up" : "down"
        let pct = abs(change).formatted(.percent.precision(.fractionLength(2)))
        return "Last \(priceLabel(last.close)), \(direction) \(pct) over \(timeframe.rawValue)"
    }
}

// MARK: - fileprivate support types

fileprivate enum PriceStyle {
    case candles, line
}

fileprivate enum ChartIndicator: String, CaseIterable, Identifiable {
    case sma20, sma50, ema20, vwap, bollinger, rsi

    var id: String { rawValue }

    var title: String {
        switch self {
        case .sma20: "SMA 20"
        case .sma50: "SMA 50"
        case .ema20: "EMA 20"
        case .vwap: "VWAP"
        case .bollinger: "Bollinger (20, 2)"
        case .rsi: "RSI 14"
        }
    }

    var symbolName: String {
        switch self {
        case .sma20, .sma50: "chart.line.uptrend.xyaxis"
        case .ema20: "chart.line.flattrend.xyaxis"
        case .vwap: "scalemass"
        case .bollinger: "arrow.up.and.down"
        case .rsi: "gauge.with.needle"
        }
    }

    var color: Color {
        switch self {
        case .sma20: TarsTheme.accent
        case .sma50: TarsTheme.agentPurple
        case .ema20: TarsTheme.warning
        case .vwap: TarsTheme.inkSecondary
        case .bollinger: TarsTheme.accent.opacity(0.5)
        case .rsi: TarsTheme.agentPurple
        }
    }
}

fileprivate struct TarsSeriesPoint: Identifiable {
    let time: Date
    let value: Double
    var id: Date { time }
}

fileprivate struct TarsBandPoint: Identifiable {
    let time: Date
    let mid: Double
    let upper: Double
    let lower: Double
    var id: Date { time }
}

/// Right-edge price tag riding the last-price rule. Gently breathes so the
/// live price reads as alive; stands still under Reduce Motion.
fileprivate struct LastPricePill: View {
    let text: String
    let tint: Color
    let animated: Bool

    @State private var pulsing = false

    var body: some View {
        Text(text)
            .font(TarsTheme.Text.micro)
            .monospacedDigit()
            .foregroundStyle(TarsTheme.bg0)
            .padding(.horizontal, TarsTheme.Space.s)
            .padding(.vertical, TarsTheme.Space.xs)
            .background(Capsule(style: .continuous).fill(tint))
            .shadow(color: tint.opacity(pulsing ? 0.55 : 0.18), radius: pulsing ? 7 : 3)
            .scaleEffect(pulsing ? 1.02 : 1)
            .onAppear {
                guard animated else { return }
                withAnimation(Motion.breathe(1.6).repeatForever(autoreverses: true)) {
                    pulsing = true
                }
            }
            .accessibilityLabel("Last price \(text)")
    }
}

/// Shimmer that can be switched off for Reduce Motion — the stock `Shimmer`
/// modifier animates forever unconditionally.
fileprivate struct TarsConditionalShimmer: ViewModifier {
    let active: Bool
    func body(content: Content) -> some View {
        if active {
            content.shimmering()
        } else {
            content
        }
    }
}

// MARK: - Indicator math

fileprivate enum TarsChartMath {

    static func sma(_ bars: [Bar], period: Int) -> [TarsSeriesPoint] {
        guard period > 0, bars.count >= period else { return [] }
        var window = 0.0
        var out: [TarsSeriesPoint] = []
        out.reserveCapacity(bars.count - period + 1)
        for (i, bar) in bars.enumerated() {
            window += bar.close
            if i >= period { window -= bars[i - period].close }
            if i >= period - 1 {
                out.append(TarsSeriesPoint(time: bar.time, value: window / Double(period)))
            }
        }
        return out
    }

    static func ema(_ bars: [Bar], period: Int) -> [TarsSeriesPoint] {
        guard period > 0, bars.count >= period else { return [] }
        let k = 2.0 / (Double(period) + 1.0)
        // Seed with SMA of the first `period` closes.
        var value = bars.prefix(period).reduce(0.0) { $0 + $1.close } / Double(period)
        var out: [TarsSeriesPoint] = [TarsSeriesPoint(time: bars[period - 1].time, value: value)]
        for i in period..<bars.count {
            value = (bars[i].close - value) * k + value
            out.append(TarsSeriesPoint(time: bars[i].time, value: value))
        }
        return out
    }

    /// Cumulative volume-weighted average price over the visible range,
    /// using typical price (H+L+C)/3.
    static func vwap(_ bars: [Bar]) -> [TarsSeriesPoint] {
        var cumulativePV = 0.0
        var cumulativeVolume = 0.0
        var out: [TarsSeriesPoint] = []
        out.reserveCapacity(bars.count)
        for bar in bars {
            let typical = (bar.high + bar.low + bar.close) / 3
            cumulativePV += typical * bar.volume
            cumulativeVolume += bar.volume
            guard cumulativeVolume > 0 else { continue }
            out.append(TarsSeriesPoint(time: bar.time, value: cumulativePV / cumulativeVolume))
        }
        return out
    }

    static func bollinger(_ bars: [Bar], period: Int, multiplier: Double) -> [TarsBandPoint] {
        guard period > 1, bars.count >= period else { return [] }
        var out: [TarsBandPoint] = []
        out.reserveCapacity(bars.count - period + 1)
        for i in (period - 1)..<bars.count {
            let slice = bars[(i - period + 1)...i].map(\.close)
            let mean = slice.reduce(0, +) / Double(period)
            let variance = slice.reduce(0.0) { $0 + ($1 - mean) * ($1 - mean) } / Double(period)
            let deviation = variance.squareRoot() * multiplier
            out.append(TarsBandPoint(
                time: bars[i].time,
                mid: mean,
                upper: mean + deviation,
                lower: mean - deviation
            ))
        }
        return out
    }

    /// Wilder-smoothed RSI.
    static func rsi(_ bars: [Bar], period: Int) -> [TarsSeriesPoint] {
        guard period > 0, bars.count > period else { return [] }
        var gains = 0.0
        var losses = 0.0
        for i in 1...period {
            let delta = bars[i].close - bars[i - 1].close
            if delta >= 0 { gains += delta } else { losses -= delta }
        }
        var avgGain = gains / Double(period)
        var avgLoss = losses / Double(period)
        func rsiValue() -> Double {
            avgLoss == 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss)
        }
        var out: [TarsSeriesPoint] = [TarsSeriesPoint(time: bars[period].time, value: rsiValue())]
        out.reserveCapacity(bars.count - period)
        for i in (period + 1)..<bars.count {
            let delta = bars[i].close - bars[i - 1].close
            avgGain = (avgGain * Double(period - 1) + max(delta, 0)) / Double(period)
            avgLoss = (avgLoss * Double(period - 1) + max(-delta, 0)) / Double(period)
            out.append(TarsSeriesPoint(time: bars[i].time, value: rsiValue()))
        }
        return out
    }
}
