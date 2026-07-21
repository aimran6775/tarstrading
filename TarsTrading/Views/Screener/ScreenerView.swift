import SwiftUI
import UIKit

/// The Screener: a filter builder over the demo universe. Preset screens teach
/// what each screen assumes — and how it fails — because a screener that only
/// shows you matches is a machine for confirming your biases.
public struct ScreenerView: View {
    public init() {}

    @Environment(TradingStore.self) private var store
    @Environment(\.horizontalSizeClass) private var hSize
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    @State private var filters = ScreenFilters()
    @State private var localQuotes: [String: Quote] = [:]
    @State private var metrics: [String: SymbolMetrics] = [:]
    @State private var isSelecting = false
    @State private var selection: [String] = []
    @State private var toastText: String?
    @State private var showFiltersCompact = true

    public var body: some View {
        Group {
            if hSize == .regular { regularLayout } else { compactLayout }
        }
        .background(TarsTheme.bg0.ignoresSafeArea())
        .navigationTitle("Screener")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) { selectButton }
        }
        .safeAreaInset(edge: .bottom) { if isSelecting { selectionBar } }
        .overlay(alignment: .bottom) { toastOverlay }
        .task { await warmMetrics() }
        .task { await quoteLoop() }
    }

    // MARK: - Layouts

    private var regularLayout: some View {
        HStack(spacing: 0) {
            ScrollView {
                VStack(alignment: .leading, spacing: TarsTheme.Space.xl) {
                    presetsColumn
                    FilterPanel(filters: $filters)
                }
                .padding(TarsTheme.Space.xl)
            }
            .frame(width: 380)

            Rectangle()
                .fill(TarsTheme.hairline)
                .frame(width: 1)
                .ignoresSafeArea(edges: .vertical)

            resultsList
        }
    }

    private var compactLayout: some View {
        List {
            Section {
                presetsCarousel
                    .listRowBackground(Color.clear)
                    .listRowInsets(EdgeInsets())
                    .listRowSeparator(.hidden)
            }
            Section {
                compactFilterBlock
                    .listRowBackground(Color.clear)
                    .listRowInsets(EdgeInsets())
                    .listRowSeparator(.hidden)
            }
            resultsSection
        }
        .listStyle(.plain)
        .scrollContentBackground(.hidden)
        .animation(reduceMotion ? nil : Motion.spatial, value: results.map(\.symbol))
    }

    private enum ResultsMode: Hashable { case list, heatmap }
    @State private var resultsMode: ResultsMode = .list

    private var resultsList: some View {
        VStack(spacing: 0) {
            SlidingCapsulePicker(options: [ResultsMode.list, .heatmap],
                                 selection: $resultsMode) { mode, selected in
                Text(mode == .list ? "List" : "Heatmap")
                    .font(TarsTheme.Text.caption)
                    .foregroundStyle(selected ? TarsTheme.inkPrimary : TarsTheme.inkSecondary)
            }
            .accessibilityLabel("Results view")
            .padding(.horizontal, TarsTheme.Space.xl)
            .padding(.top, TarsTheme.Space.m)

            switch resultsMode {
            case .list:
                List { resultsSection }
                    .listStyle(.plain)
                    .scrollContentBackground(.hidden)
                    .animation(reduceMotion ? nil : Motion.spatial, value: results.map(\.symbol))
            case .heatmap:
                ScrollView {
                    MarketHeatmapView()
                        .padding(TarsTheme.Space.xl)
                }
            }
        }
    }

    // MARK: - Presets

    private var presetsColumn: some View {
        VStack(alignment: .leading, spacing: TarsTheme.Space.m) {
            Text("Preset screens")
                .font(TarsTheme.Text.heading)
                .foregroundStyle(TarsTheme.inkPrimary)
            ForEach(ScreenPreset.all) { preset in
                PresetCard(preset: preset,
                           isActive: filters == preset.filters,
                           apply: { apply(preset) })
            }
        }
    }

    private var presetsCarousel: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: TarsTheme.Space.m) {
                ForEach(ScreenPreset.all) { preset in
                    PresetCard(preset: preset,
                               isActive: filters == preset.filters,
                               apply: { apply(preset) })
                        .frame(width: 290)
                }
            }
            .padding(.horizontal, TarsTheme.Space.l)
            .padding(.vertical, TarsTheme.Space.s)
        }
    }

    private var compactFilterBlock: some View {
        VStack(alignment: .leading, spacing: 0) {
            Button {
                withAnimation(Motion.snappy) { showFiltersCompact.toggle() }
                Haptics.tap()
            } label: {
                HStack {
                    Text("Filters")
                        .font(TarsTheme.Text.heading)
                        .foregroundStyle(TarsTheme.inkPrimary)
                    Spacer()
                    Image(systemName: "chevron.down")
                        .font(TarsTheme.Text.caption)
                        .foregroundStyle(TarsTheme.inkSecondary)
                        .rotationEffect(.degrees(showFiltersCompact ? 0 : -90))
                }
                .contentShape(Rectangle())
            }
            .buttonStyle(PressableStyle())
            .accessibilityLabel("Filters")
            .accessibilityValue(showFiltersCompact ? "Expanded" : "Collapsed")
            .accessibilityHint("Shows or hides the filter controls.")
            .padding(.horizontal, TarsTheme.Space.l)
            .padding(.vertical, TarsTheme.Space.m)

            if showFiltersCompact {
                FilterPanel(filters: $filters)
                    .padding(.horizontal, TarsTheme.Space.l)
                    .padding(.bottom, TarsTheme.Space.l)
                    .transition(.opacity)
            }
        }
        .tarsPanel()
        .padding(.horizontal, TarsTheme.Space.l)
        .padding(.vertical, TarsTheme.Space.s)
    }

    private func apply(_ preset: ScreenPreset) {
        withAnimation(reduceMotion ? nil : Motion.spatial) { filters = preset.filters }
        Haptics.confirm()
    }

    // MARK: - Results

    private var results: [DemoMarket.DemoAsset] {
        DemoMarket.universe
            .filter { asset in
                guard filters.classes.contains(asset.assetClass) else { return false }
                guard let q = quote(asset.symbol) else { return false }
                guard q.price >= filters.minPrice, q.price <= filters.maxPrice else { return false }
                guard q.changePercent >= filters.change.lowerBound,
                      q.changePercent <= filters.change.upperBound else { return false }
                if filters.usesRSI || filters.usesSMA {
                    guard let m = metrics[asset.symbol] else { return false }
                    if filters.usesRSI {
                        guard let rsi = m.rsi,
                              rsi >= filters.rsi.lowerBound, rsi <= filters.rsi.upperBound
                        else { return false }
                    }
                    if filters.usesSMA {
                        guard let sma = m.sma50 else { return false }
                        switch filters.stance {
                        case .any: break
                        case .above: guard q.price > sma else { return false }
                        case .below: guard q.price < sma else { return false }
                        }
                    }
                }
                return true
            }
            .sorted { changePercent($0.symbol) > changePercent($1.symbol) }
    }

    @ViewBuilder
    private var resultsSection: some View {
        let rows = results
        Section {
            if isWarming {
                ForEach(0..<6, id: \.self) { _ in
                    SkeletonRow()
                        .listRowBackground(Color.clear)
                        .listRowSeparatorTint(TarsTheme.hairline)
                }
            } else if rows.isEmpty {
                EmptyResults { withAnimation(Motion.spatial) { filters = ScreenFilters() } }
                    .listRowBackground(Color.clear)
                    .listRowSeparator(.hidden)
            } else {
                ForEach(rows, id: \.symbol) { asset in
                    ScreenerRow(
                        asset: asset,
                        quote: quote(asset.symbol),
                        metrics: metrics[asset.symbol],
                        isSelecting: isSelecting,
                        isSelected: selection.contains(asset.symbol),
                        isWatched: store.watchlist.contains(asset.symbol),
                        toggleSelect: { toggleSelection(asset.symbol) },
                        addToWatchlist: {
                            store.addToWatchlist(asset.symbol)
                            Haptics.success()
                        },
                        loadMetrics: { await ensureMetrics(asset.symbol) }
                    )
                    .listRowBackground(Color.clear)
                    .listRowSeparatorTint(TarsTheme.hairline)
                }
            }
        } header: {
            resultsHeader(matchCount: rows.count)
        }
    }

    private func resultsHeader(matchCount: Int) -> some View {
        HStack(spacing: TarsTheme.Space.s) {
            Text("Matches")
                .font(TarsTheme.Text.caption)
                .foregroundStyle(TarsTheme.inkSecondary)
            Text("\(matchCount) of \(DemoMarket.universe.count)")
                .font(TarsTheme.Text.priceSmall)
                .foregroundStyle(TarsTheme.inkPrimary)
                .contentTransition(.numericText())
                .animation(Motion.ticker, value: matchCount)
            Spacer()
            Text("sorted by day move")
                .font(TarsTheme.Text.micro)
                .foregroundStyle(TarsTheme.inkTertiary)
        }
        .textCase(nil)
    }

    // MARK: - Selection & copy

    private var selectButton: some View {
        Button(isSelecting ? "Done" : "Select") {
            withAnimation(Motion.snappy) {
                isSelecting.toggle()
                if !isSelecting { selection.removeAll() }
            }
            Haptics.tap()
        }
        .font(TarsTheme.Text.caption)
        .tint(TarsTheme.accent)
    }

    private func toggleSelection(_ symbol: String) {
        withAnimation(Motion.snappy) {
            if let i = selection.firstIndex(of: symbol) {
                selection.remove(at: i)
            } else {
                selection.append(symbol)
            }
        }
        Haptics.tick()
    }

    private var selectionBar: some View {
        HStack(spacing: TarsTheme.Space.l) {
            Text("\(selection.count) selected")
                .font(TarsTheme.Text.priceSmall)
                .foregroundStyle(TarsTheme.inkSecondary)
                .contentTransition(.numericText())
                .animation(Motion.ticker, value: selection.count)
            Spacer()
            Button {
                copySelection()
            } label: {
                Label("Copy as agent universe", systemImage: "doc.on.doc")
                    .font(TarsTheme.Text.caption)
                    .foregroundStyle(selection.isEmpty ? TarsTheme.inkTertiary : TarsTheme.bg0)
                    .padding(.horizontal, TarsTheme.Space.l)
                    .padding(.vertical, TarsTheme.Space.m)
                    .background(
                        Capsule().fill(selection.isEmpty ? TarsTheme.bg3 : TarsTheme.accent))
            }
            .buttonStyle(PressableStyle())
            .disabled(selection.isEmpty)
        }
        .padding(.horizontal, TarsTheme.Space.xl)
        .padding(.vertical, TarsTheme.Space.m)
        .background(.ultraThinMaterial)
        .overlay(alignment: .top) { Rectangle().fill(TarsTheme.hairline).frame(height: 1) }
        .transition(.move(edge: .bottom).combined(with: .opacity))
    }

    private func copySelection() {
        UIPasteboard.general.string = selection.joined(separator: ", ")
        Haptics.success()
        let count = selection.count
        withAnimation(Motion.spatial) {
            toastText = "Copied \(count) symbol\(count == 1 ? "" : "s") — paste into an agent's universe"
        }
        Task {
            try? await Task.sleep(for: .seconds(2.4))
            withAnimation(Motion.spatial) { toastText = nil }
        }
    }

    @ViewBuilder
    private var toastOverlay: some View {
        if let toastText {
            HStack(spacing: TarsTheme.Space.s) {
                Image(systemName: "checkmark.circle.fill")
                    .foregroundStyle(TarsTheme.gain)
                Text(toastText)
                    .font(TarsTheme.Text.caption)
                    .foregroundStyle(TarsTheme.inkPrimary)
            }
            .padding(.horizontal, TarsTheme.Space.l)
            .padding(.vertical, TarsTheme.Space.m)
            .background(Capsule().fill(TarsTheme.bg3))
            .overlay(Capsule().strokeBorder(TarsTheme.hairline, lineWidth: 1))
            .padding(.bottom, isSelecting ? 74 : TarsTheme.Space.xl)
            .transition(.move(edge: .bottom).combined(with: .opacity))
            .accessibilityAddTraits(.updatesFrequently)
        }
    }

    // MARK: - Data plumbing

    private var isWarming: Bool { localQuotes.isEmpty && store.quotes.isEmpty }

    private func quote(_ symbol: String) -> Quote? {
        store.quote(for: symbol) ?? localQuotes[symbol]
    }

    private func changePercent(_ symbol: String) -> Double {
        quote(symbol)?.changePercent ?? 0
    }

    /// The filter needs indicators for every candidate, so we warm the cache
    /// for the whole (small) universe; rows also self-heal via their own task.
    private func warmMetrics() async {
        for asset in DemoMarket.universe {
            guard !Task.isCancelled else { return }
            await ensureMetrics(asset.symbol)
        }
    }

    private func ensureMetrics(_ symbol: String) async {
        guard metrics[symbol] == nil else { return }
        if let m = await ScreenerMetricsCache.metrics(for: symbol, provider: store.marketData) {
            withAnimation(reduceMotion ? nil : Motion.spatial) { metrics[symbol] = m }
        }
    }

    private func quoteLoop() async {
        let symbols = DemoMarket.universe.map(\.symbol)
        while !Task.isCancelled {
            if let fresh = try? await store.marketData.quotes(for: symbols) {
                for q in fresh { localQuotes[q.symbol] = q }
            }
            try? await Task.sleep(for: .seconds(2))
        }
    }
}

// MARK: - Filter model

fileprivate enum SMAStance: String, CaseIterable, Identifiable {
    case any, above, below
    var id: String { rawValue }
    var label: String {
        switch self {
        case .any: "Any"
        case .above: "Above"
        case .below: "Below"
        }
    }
}

fileprivate struct ScreenFilters: Equatable {
    var classes: Set<AssetClass> = [.usEquity, .crypto]
    /// Price bounds as positions on a log10 scale: 0 → $0.10, 1 → $100k.
    var pricePos: ClosedRange<Double> = 0...1
    var change: ClosedRange<Double> = ScreenFilters.changeBounds
    var stance: SMAStance = .any
    var rsi: ClosedRange<Double> = 0...100

    static let changeBounds: ClosedRange<Double> = -0.15...0.15

    static func price(atPos p: Double) -> Double { pow(10, -1 + p * 6) }
    var minPrice: Double { Self.price(atPos: pricePos.lowerBound) }
    var maxPrice: Double { Self.price(atPos: pricePos.upperBound) }

    var usesRSI: Bool { rsi != 0...100 }
    var usesSMA: Bool { stance != .any }
    var isDefault: Bool { self == ScreenFilters() }
}

// MARK: - Per-symbol indicator metrics (fileprivate cache)

fileprivate struct SymbolMetrics: Equatable {
    var rsi: Double?
    var sma50: Double?
}

/// Bars are deterministic in demo mode, so computed indicators are cached for
/// the app session and shared across screener visits.
@MainActor
fileprivate enum ScreenerMetricsCache {
    private static var cache: [String: SymbolMetrics] = [:]

    static func metrics(for symbol: String, provider: MarketProviding) async -> SymbolMetrics? {
        if let hit = cache[symbol] { return hit }
        guard let bars = try? await provider.bars(symbol: symbol, timeframe: .month3),
              !bars.isEmpty else { return nil }
        let rsiSeries = IndicatorMath.series(.rsi(14), bars: bars)
        let smaSeries = IndicatorMath.series(.sma(50), bars: bars)
        let rsi = rsiSeries.last.flatMap { $0.isNaN ? nil : $0 }
        let sma = smaSeries.last.flatMap { $0.isNaN ? nil : $0 }
        let m = SymbolMetrics(rsi: rsi, sma50: sma)
        cache[symbol] = m
        return m
    }
}

// MARK: - Presets

fileprivate struct ScreenPreset: Identifiable {
    let id: String
    let icon: String
    let tagline: String
    let assumes: String
    let failureMode: String
    let filters: ScreenFilters

    var name: String { id }

    static let all: [ScreenPreset] = [
        ScreenPreset(
            id: "Momentum",
            icon: "arrow.up.right",
            tagline: "Up today, above the 50-day, RSI strong.",
            assumes: "Names already moving up, trading above their 50-day average with RSI above 55. The bet underneath: what has been winning keeps winning — for a while.",
            failureMode: "Momentum reverses without sending a calendar invite. The same crowd that pushed the price up exits together, and \u{201C}strong\u{201D} becomes \u{201C}falling\u{201D} fast. Momentum screens look smartest right before they stop working.",
            filters: {
                var f = ScreenFilters()
                f.change = 0.0...ScreenFilters.changeBounds.upperBound
                f.stance = .above
                f.rsi = 55...100
                return f
            }()
        ),
        ScreenPreset(
            id: "Oversold bounce candidates",
            icon: "arrow.down.forward.and.arrow.up.backward",
            tagline: "RSI(14) under 35 — sold hard and fast.",
            assumes: "RSI below 35 flags names that fell quickly relative to their own recent range. The bet underneath: the selling was overdone and price snaps back toward normal — mean reversion.",
            failureMode: "Oversold can stay oversold. Sometimes the market is repricing something real, and a name down 30% goes down another 30%. RSI measures the speed of a decline, not whether the decline is wrong.",
            filters: {
                var f = ScreenFilters()
                f.rsi = 0...35
                return f
            }()
        ),
        ScreenPreset(
            id: "Steady large caps",
            icon: "tortoise",
            tagline: "Higher-priced stocks, small day moves, mid RSI.",
            assumes: "Stocks above roughly $50 moving less than \u{00B1}1.5% today with RSI in the middle of its range. The bet underneath: low recent drama means low future drama.",
            failureMode: "Calm is a mood, not a property. Volatility clusters — quiet names get loud around earnings, macro shocks, and headlines. Yesterday's steadiness tells you little about tomorrow's.",
            filters: {
                var f = ScreenFilters()
                f.classes = [.usEquity]
                f.pricePos = 0.45...1
                f.change = -0.015...0.015
                f.rsi = 35...65
                return f
            }()
        ),
    ]
}

fileprivate struct PresetCard: View {
    let preset: ScreenPreset
    let isActive: Bool
    let apply: () -> Void

    @State private var showInfo = false

    var body: some View {
        Button(action: apply) {
            VStack(alignment: .leading, spacing: TarsTheme.Space.s) {
                HStack(spacing: TarsTheme.Space.m) {
                    Image(systemName: preset.icon)
                        .font(TarsTheme.Text.caption)
                        .foregroundStyle(isActive ? TarsTheme.accent : TarsTheme.inkSecondary)
                        .frame(width: 30, height: 30)
                        .background(
                            RoundedRectangle(cornerRadius: TarsTheme.Radius.s, style: .continuous)
                                .fill(TarsTheme.bg3))
                    Text(preset.name)
                        .font(TarsTheme.Text.body.weight(.semibold))
                        .foregroundStyle(TarsTheme.inkPrimary)
                        .multilineTextAlignment(.leading)
                    Spacer(minLength: 30)
                }
                Text(preset.tagline)
                    .font(TarsTheme.Text.caption)
                    .foregroundStyle(TarsTheme.inkSecondary)
                    .multilineTextAlignment(.leading)
                if isActive {
                    Text("ACTIVE")
                        .font(TarsTheme.Text.micro)
                        .foregroundStyle(TarsTheme.accent)
                        .transition(.opacity)
                }
            }
            .padding(TarsTheme.Space.l)
            .frame(maxWidth: .infinity, alignment: .leading)
            .contentShape(Rectangle())
        }
        .buttonStyle(PressableStyle())
        .hoverEffect(.lift)
        .tarsPanel(elevation: 2, tint: isActive ? TarsTheme.accent.opacity(0.6) : nil)
        .overlay(alignment: .topTrailing) { infoButton }
        .animation(Motion.snappy, value: isActive)
        .accessibilityLabel("\(preset.name) preset screen. \(preset.tagline)")
    }

    private var infoButton: some View {
        Button {
            showInfo = true
            Haptics.tap()
        } label: {
            Image(systemName: "info.circle")
                .font(TarsTheme.Text.caption)
                .foregroundStyle(TarsTheme.inkTertiary)
                .padding(TarsTheme.Space.m)
                .contentShape(Rectangle())
        }
        .buttonStyle(PressableStyle())
        .accessibilityLabel("What \(preset.name) assumes, and how it fails")
        .popover(isPresented: $showInfo, arrowEdge: .top) {
            VStack(alignment: .leading, spacing: TarsTheme.Space.l) {
                Text(preset.name)
                    .font(TarsTheme.Text.heading)
                    .foregroundStyle(TarsTheme.inkPrimary)
                VStack(alignment: .leading, spacing: TarsTheme.Space.xs) {
                    Text("WHAT IT ASSUMES")
                        .font(TarsTheme.Text.micro)
                        .foregroundStyle(TarsTheme.inkTertiary)
                    Text(preset.assumes)
                        .font(TarsTheme.Text.body)
                        .foregroundStyle(TarsTheme.inkSecondary)
                }
                VStack(alignment: .leading, spacing: TarsTheme.Space.xs) {
                    Text("HOW IT FAILS")
                        .font(TarsTheme.Text.micro)
                        .foregroundStyle(TarsTheme.warning)
                    Text(preset.failureMode)
                        .font(TarsTheme.Text.body)
                        .foregroundStyle(TarsTheme.inkSecondary)
                }
                Text("A screen narrows the universe. It does not predict it.")
                    .font(TarsTheme.Text.caption)
                    .foregroundStyle(TarsTheme.inkTertiary)
            }
            .padding(TarsTheme.Space.xl)
            .frame(idealWidth: 340, maxWidth: 380)
            .presentationCompactAdaptation(.popover)
            .presentationBackground(TarsTheme.bg2)
        }
    }
}

// MARK: - Filter panel

fileprivate struct FilterPanel: View {
    @Binding var filters: ScreenFilters

    var body: some View {
        VStack(alignment: .leading, spacing: TarsTheme.Space.xl) {
            HStack {
                Text("Build your own")
                    .font(TarsTheme.Text.heading)
                    .foregroundStyle(TarsTheme.inkPrimary)
                Spacer()
                if !filters.isDefault {
                    Button("Reset") {
                        withAnimation(Motion.spatial) { filters = ScreenFilters() }
                        Haptics.tap()
                    }
                    .font(TarsTheme.Text.caption)
                    .tint(TarsTheme.accent)
                    .transition(.opacity)
                }
            }

            assetClassRow

            filterBlock("Price", readout: priceReadout) {
                RangeSlider(
                    lower: normLower($filters.pricePos, bounds: 0...1),
                    upper: normUpper($filters.pricePos, bounds: 0...1),
                    label: "Price range")
            }

            filterBlock("Day move", readout: changeReadout) {
                RangeSlider(
                    lower: normLower($filters.change, bounds: ScreenFilters.changeBounds),
                    upper: normUpper($filters.change, bounds: ScreenFilters.changeBounds),
                    label: "Day percent change range")
            }

            stanceRow

            filterBlock("RSI (14)", readout: rsiReadout) {
                RangeSlider(
                    lower: normLower($filters.rsi, bounds: 0...100),
                    upper: normUpper($filters.rsi, bounds: 0...100),
                    label: "RSI range")
            }
        }
        .animation(Motion.snappy, value: filters.isDefault)
    }

    // MARK: Rows

    private var assetClassRow: some View {
        VStack(alignment: .leading, spacing: TarsTheme.Space.s) {
            Text("ASSET CLASS")
                .font(TarsTheme.Text.micro)
                .foregroundStyle(TarsTheme.inkTertiary)
            HStack(spacing: TarsTheme.Space.s) {
                ForEach(availableClasses) { c in
                    chip(c.label, isOn: filters.classes.contains(c)) {
                        withAnimation(Motion.snappy) {
                            if filters.classes.contains(c) {
                                filters.classes.remove(c)
                            } else {
                                filters.classes.insert(c)
                            }
                        }
                        Haptics.tick()
                    }
                }
            }
        }
    }

    private var availableClasses: [AssetClass] {
        AssetClass.allCases.filter { c in DemoMarket.universe.contains { $0.assetClass == c } }
    }

    private var stanceRow: some View {
        VStack(alignment: .leading, spacing: TarsTheme.Space.s) {
            Text("VS 50-DAY AVERAGE")
                .font(TarsTheme.Text.micro)
                .foregroundStyle(TarsTheme.inkTertiary)
            HStack(spacing: TarsTheme.Space.s) {
                ForEach(SMAStance.allCases) { s in
                    chip(s.label, isOn: filters.stance == s) {
                        withAnimation(Motion.snappy) { filters.stance = s }
                        Haptics.tick()
                    }
                }
            }
        }
    }

    private func chip(_ label: String, isOn: Bool, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Text(label)
                .font(TarsTheme.Text.caption)
                .foregroundStyle(isOn ? TarsTheme.accent : TarsTheme.inkSecondary)
                .padding(.horizontal, TarsTheme.Space.m)
                .padding(.vertical, TarsTheme.Space.s)
                .background(
                    Capsule().fill(isOn ? TarsTheme.accent.opacity(0.16) : TarsTheme.bg3))
                .overlay(
                    Capsule().strokeBorder(
                        isOn ? TarsTheme.accent.opacity(0.5) : TarsTheme.hairline, lineWidth: 1))
        }
        .buttonStyle(PressableStyle())
        .accessibilityAddTraits(isOn ? [.isSelected] : [])
    }

    private func filterBlock(_ title: String, readout: String,
                             @ViewBuilder slider: () -> some View) -> some View {
        VStack(alignment: .leading, spacing: TarsTheme.Space.xs) {
            HStack {
                Text(title.uppercased())
                    .font(TarsTheme.Text.micro)
                    .foregroundStyle(TarsTheme.inkTertiary)
                Spacer()
                Text(readout)
                    .font(TarsTheme.Text.priceSmall)
                    .foregroundStyle(TarsTheme.inkSecondary)
            }
            slider()
        }
    }

    // MARK: Readouts

    private var priceReadout: String {
        if filters.pricePos == 0...1 { return "Any" }
        let hi = filters.pricePos.upperBound >= 0.999 ? "$100k+" : priceLabel(filters.maxPrice)
        return "\(priceLabel(filters.minPrice)) – \(hi)"
    }

    private var changeReadout: String {
        if filters.change == ScreenFilters.changeBounds { return "Any" }
        return "\(pctLabel(filters.change.lowerBound)) to \(pctLabel(filters.change.upperBound))"
    }

    private var rsiReadout: String {
        if filters.rsi == 0...100 { return "Any" }
        return "\(Int(filters.rsi.lowerBound)) – \(Int(filters.rsi.upperBound))"
    }

    private func priceLabel(_ v: Double) -> String {
        if v >= 1000 { return "$\((v / 1000).formatted(.number.precision(.fractionLength(0...1))))k" }
        if v >= 10 { return "$\(Int(v.rounded()))" }
        return v.formatted(.currency(code: "USD").precision(.fractionLength(2)))
    }

    private func pctLabel(_ v: Double) -> String {
        (v).formatted(.percent.precision(.fractionLength(0...1)).sign(strategy: .always(includingZero: false)))
    }

    // MARK: Normalized range bindings

    private func normLower(_ range: Binding<ClosedRange<Double>>,
                           bounds: ClosedRange<Double>) -> Binding<Double> {
        let span = bounds.upperBound - bounds.lowerBound
        return Binding(
            get: { (range.wrappedValue.lowerBound - bounds.lowerBound) / span },
            set: { p in
                let v = bounds.lowerBound + min(max(p, 0), 1) * span
                range.wrappedValue = min(v, range.wrappedValue.upperBound)...range.wrappedValue.upperBound
            })
    }

    private func normUpper(_ range: Binding<ClosedRange<Double>>,
                           bounds: ClosedRange<Double>) -> Binding<Double> {
        let span = bounds.upperBound - bounds.lowerBound
        return Binding(
            get: { (range.wrappedValue.upperBound - bounds.lowerBound) / span },
            set: { p in
                let v = bounds.lowerBound + min(max(p, 0), 1) * span
                range.wrappedValue = range.wrappedValue.lowerBound...max(v, range.wrappedValue.lowerBound)
            })
    }
}

// MARK: - Dual-thumb range slider (normalized 0…1)

fileprivate struct RangeSlider: View {
    @Binding var lower: Double
    @Binding var upper: Double
    var label: String = "Range"

    private let thumbSize: CGFloat = 22

    var body: some View {
        GeometryReader { geo in
            let w = max(geo.size.width - thumbSize, 1)
            ZStack(alignment: .leading) {
                Capsule()
                    .fill(TarsTheme.bg3)
                    .frame(height: 4)
                    .padding(.horizontal, thumbSize / 2)
                Capsule()
                    .fill(TarsTheme.accent)
                    .frame(width: max((upper - lower) * w, 0) + 4, height: 4)
                    .offset(x: lower * w + thumbSize / 2 - 2)
                thumb
                    .offset(x: lower * w)
                    .gesture(drag(isLower: true, width: w))
                    .accessibilityLabel("\(label), minimum")
                    .accessibilityValue(lower.formatted(.percent.precision(.fractionLength(0))))
                    .accessibilityAdjustableAction { direction in
                        let step = 0.05
                        switch direction {
                        case .increment: lower = min(lower + step, upper)
                        case .decrement: lower = max(lower - step, 0)
                        @unknown default: break
                        }
                    }
                thumb
                    .offset(x: upper * w)
                    .gesture(drag(isLower: false, width: w))
                    .accessibilityLabel("\(label), maximum")
                    .accessibilityValue(upper.formatted(.percent.precision(.fractionLength(0))))
                    .accessibilityAdjustableAction { direction in
                        let step = 0.05
                        switch direction {
                        case .increment: upper = min(upper + step, 1)
                        case .decrement: upper = max(upper - step, lower)
                        @unknown default: break
                        }
                    }
            }
            .frame(height: geo.size.height)
        }
        .frame(height: 34)
    }

    private var thumb: some View {
        Circle()
            .fill(TarsTheme.inkPrimary)
            .frame(width: thumbSize, height: thumbSize)
            .overlay(Circle().strokeBorder(TarsTheme.bg0.opacity(0.4), lineWidth: 1))
            .shadow(color: TarsTheme.bg0.opacity(0.5), radius: 3, y: 1)
    }

    private func drag(isLower: Bool, width: CGFloat) -> some Gesture {
        DragGesture(minimumDistance: 0)
            .onChanged { g in
                let p = min(max((g.location.x - thumbSize / 2) / width, 0), 1)
                if isLower {
                    lower = min(p, upper)
                } else {
                    upper = max(p, lower)
                }
            }
            .onEnded { _ in Haptics.tick() }
    }
}

// MARK: - Result row

fileprivate struct ScreenerRow: View {
    let asset: DemoMarket.DemoAsset
    let quote: Quote?
    let metrics: SymbolMetrics?
    let isSelecting: Bool
    let isSelected: Bool
    let isWatched: Bool
    let toggleSelect: () -> Void
    let addToWatchlist: () -> Void
    let loadMetrics: () async -> Void

    var body: some View {
        Group {
            if isSelecting {
                Button(action: toggleSelect) { content }
                    .buttonStyle(PressableStyle())
        .hoverEffect(.highlight)
            } else {
                NavigationLink(value: asset.symbol) { content }
            }
        }
        .task { await loadMetrics() }
        .swipeActions(edge: .trailing, allowsFullSwipe: true) {
            Button(action: addToWatchlist) {
                Label(isWatched ? "Watching" : "Watch", systemImage: isWatched ? "star.fill" : "star")
            }
            .tint(TarsTheme.accent)
            .disabled(isWatched)
        }
        .contextMenu {
            Button(action: addToWatchlist) {
                Label(isWatched ? "Already in watchlist" : "Add to watchlist",
                      systemImage: isWatched ? "star.fill" : "star")
            }
            .disabled(isWatched)
        }
        .accessibilityElement(children: .combine)
    }

    private var content: some View {
        HStack(spacing: TarsTheme.Space.m) {
            if isSelecting {
                Image(systemName: isSelected ? "checkmark.circle.fill" : "circle")
                    .font(TarsTheme.Text.heading)
                    .foregroundStyle(isSelected ? TarsTheme.accent : TarsTheme.inkTertiary)
                    .transition(.scale.combined(with: .opacity))
            }

            VStack(alignment: .leading, spacing: 2) {
                HStack(spacing: TarsTheme.Space.xs) {
                    Text(asset.symbol)
                        .font(TarsTheme.Text.body.weight(.semibold))
                        .foregroundStyle(TarsTheme.inkPrimary)
                        .lineLimit(1)
                        .minimumScaleFactor(0.7)
                        .layoutPriority(1)
                    if isWatched {
                        Image(systemName: "star.fill")
                            .font(TarsTheme.Text.micro)
                            .foregroundStyle(TarsTheme.accent.opacity(0.8))
                            .accessibilityLabel("In watchlist")
                    }
                }
                Text(asset.name)
                    .font(TarsTheme.Text.caption)
                    .foregroundStyle(TarsTheme.inkSecondary)
                    .lineLimit(1)
            }

            Spacer(minLength: TarsTheme.Space.m)

            rsiBadge

            VStack(alignment: .trailing, spacing: 2) {
                if let quote {
                    TickerText(value: quote.price, font: TarsTheme.Text.price)
                    PercentText(value: quote.changePercent)
                } else {
                    SkeletonBlock(width: 72, height: 16)
                    SkeletonBlock(width: 48, height: 11)
                }
            }
        }
        .padding(.vertical, TarsTheme.Space.xs)
        .contentShape(Rectangle())
    }

    @ViewBuilder
    private var rsiBadge: some View {
        if let rsi = metrics?.rsi {
            Text("RSI \(Int(rsi.rounded()))")
                .font(TarsTheme.Text.priceSmall)
                .foregroundStyle(rsi >= 70 || rsi <= 30 ? TarsTheme.warning : TarsTheme.inkSecondary)
                .padding(.horizontal, TarsTheme.Space.s)
                .padding(.vertical, 3)
                .background(Capsule().fill(TarsTheme.bg3))
                .accessibilityLabel("RSI 14, \(Int(rsi.rounded()))")
        } else {
            SkeletonBlock(width: 52, height: 20)
        }
    }
}

// MARK: - Loading & empty states

fileprivate struct SkeletonRow: View {
    var body: some View {
        HStack(spacing: TarsTheme.Space.m) {
            VStack(alignment: .leading, spacing: 6) {
                SkeletonBlock(width: 64, height: 14)
                SkeletonBlock(width: 130, height: 10)
            }
            Spacer()
            SkeletonBlock(width: 52, height: 20)
            VStack(alignment: .trailing, spacing: 6) {
                SkeletonBlock(width: 72, height: 14)
                SkeletonBlock(width: 48, height: 10)
            }
        }
        .padding(.vertical, TarsTheme.Space.s)
        .accessibilityLabel("Loading market data")
    }
}

fileprivate struct EmptyResults: View {
    let reset: () -> Void

    var body: some View {
        VStack(spacing: TarsTheme.Space.l) {
            Image(systemName: "line.3.horizontal.decrease.circle")
                .font(TarsTheme.Text.hero)
                .foregroundStyle(TarsTheme.inkTertiary)
            Text("Zero matches")
                .font(TarsTheme.Text.heading)
                .foregroundStyle(TarsTheme.inkPrimary)
            Text("The universe has \(DemoMarket.universe.count) symbols and your filters rejected every one. Either the market is failing your standards, or one slider went too far.")
                .font(TarsTheme.Text.body)
                .foregroundStyle(TarsTheme.inkSecondary)
                .multilineTextAlignment(.center)
                .frame(maxWidth: 420)
            Button(action: {
                reset()
                Haptics.tap()
            }) {
                Text("Reset filters")
                    .font(TarsTheme.Text.caption)
                    .foregroundStyle(TarsTheme.accent)
                    .padding(.horizontal, TarsTheme.Space.l)
                    .padding(.vertical, TarsTheme.Space.s)
                    .background(Capsule().fill(TarsTheme.accent.opacity(0.14)))
            }
            .buttonStyle(PressableStyle())
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, TarsTheme.Space.xxl)
    }
}
