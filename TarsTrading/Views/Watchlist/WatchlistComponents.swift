import SwiftUI
import Charts

// MARK: - Symbol Search Sheet

/// Searchable sheet for adding symbols to the watchlist. Debounced querying of
/// `store.marketData.search(_:)`, recent searches persisted in UserDefaults,
/// designed empty / no-results / error states.
struct SymbolSearchSheet: View {
    @Environment(TradingStore.self) private var store
    @Environment(\.dismiss) private var dismiss

    @State private var query = ""
    @State private var phase: SearchPhase = .idle
    @State private var recents: [Asset] = RecentSearchStore.load()
    @FocusState private var searchFocused: Bool

    var body: some View {
        NavigationStack {
            VStack(spacing: 0) {
                searchField
                    .padding(.horizontal, TarsTheme.Space.l)
                    .padding(.top, TarsTheme.Space.m)
                    .padding(.bottom, TarsTheme.Space.m)

                Divider().overlay(TarsTheme.hairline)

                content
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
            }
            .background(TarsTheme.bg0)
            .navigationTitle("Add Symbol")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Done") { dismiss() }
                        .font(TarsTheme.Text.body)
                        .foregroundStyle(TarsTheme.accent)
                        .accessibilityLabel("Close symbol search")
                }
            }
            .toolbarBackground(TarsTheme.bg1, for: .navigationBar)
        }
        .task(id: query) {
            await runDebouncedSearch()
        }
        .onAppear { searchFocused = true }
    }

    // MARK: Search field

    private var searchField: some View {
        HStack(spacing: TarsTheme.Space.s) {
            Image(systemName: "magnifyingglass")
                .font(TarsTheme.Text.body)
                .foregroundStyle(TarsTheme.inkTertiary)

            TextField(
                "",
                text: $query,
                prompt: Text("Symbol or company name")
                    .font(TarsTheme.Text.body)
                    .foregroundStyle(TarsTheme.inkTertiary)
            )
            .font(TarsTheme.Text.body)
            .foregroundStyle(TarsTheme.inkPrimary)
            .textInputAutocapitalization(.characters)
            .autocorrectionDisabled()
            .focused($searchFocused)
            .submitLabel(.search)
            .accessibilityLabel("Search symbols")

            if !query.isEmpty {
                Button {
                    withAnimation(Motion.snappy) { query = "" }
                } label: {
                    Image(systemName: "xmark.circle.fill")
                        .font(TarsTheme.Text.body)
                        .foregroundStyle(TarsTheme.inkTertiary)
                }
                .buttonStyle(PressableStyle())
                .accessibilityLabel("Clear search")
                .transition(.scale.combined(with: .opacity))
            }
        }
        .padding(.horizontal, TarsTheme.Space.m)
        .padding(.vertical, TarsTheme.Space.m)
        .background(
            RoundedRectangle(cornerRadius: TarsTheme.Radius.m, style: .continuous)
                .fill(TarsTheme.bg2)
                .overlay(
                    RoundedRectangle(cornerRadius: TarsTheme.Radius.m, style: .continuous)
                        .strokeBorder(
                            searchFocused ? TarsTheme.accent.opacity(0.5) : TarsTheme.hairline,
                            lineWidth: 1)
                )
        )
        .animation(Motion.snappy, value: searchFocused)
        .animation(Motion.snappy, value: query.isEmpty)
    }

    // MARK: Content states

    @ViewBuilder
    private var content: some View {
        switch phase {
        case .idle:
            if recents.isEmpty {
                SearchStateView(
                    systemImage: "sparkle.magnifyingglass",
                    title: "Find anything tradable",
                    message: "Search by ticker or company name — stocks, crypto, and more.")
            } else {
                recentsList
            }
        case .searching:
            searchingSkeleton
        case .results(let assets):
            resultsList(assets)
        case .noResults(let q):
            SearchStateView(
                systemImage: "questionmark.circle",
                title: "No matches for \u{201C}\(q)\u{201D}",
                message: "Check the spelling, or try the ticker symbol directly.")
        case .error(let message):
            SearchStateView(
                systemImage: "wifi.exclamationmark",
                title: "Search hit a snag",
                message: message,
                tint: TarsTheme.warning
            ) {
                Button {
                    Haptics.tap()
                    Task { await performSearch(query) }
                } label: {
                    Text("Try Again")
                        .font(TarsTheme.Text.caption)
                        .foregroundStyle(TarsTheme.inkPrimary)
                        .padding(.horizontal, TarsTheme.Space.l)
                        .padding(.vertical, TarsTheme.Space.s)
                        .background(
                            Capsule().fill(TarsTheme.bg3)
                                .overlay(Capsule().strokeBorder(TarsTheme.hairline, lineWidth: 1))
                        )
                }
                .buttonStyle(PressableStyle())
                .accessibilityLabel("Retry search")
            }
        }
    }

    private var recentsList: some View {
        ScrollView {
            LazyVStack(alignment: .leading, spacing: TarsTheme.Space.xs) {
                HStack {
                    Text("RECENT")
                        .font(TarsTheme.Text.micro)
                        .foregroundStyle(TarsTheme.inkTertiary)
                        .kerning(1.2)
                        .accessibilityAddTraits(.isHeader)
                        .accessibilityLabel("Recent searches")
                    Spacer()
                    Button {
                        Haptics.tap()
                        withAnimation(Motion.fluid) {
                            recents = []
                            RecentSearchStore.clear()
                        }
                    } label: {
                        Text("Clear")
                            .font(TarsTheme.Text.caption)
                            .foregroundStyle(TarsTheme.inkSecondary)
                    }
                    .buttonStyle(PressableStyle())
                    .accessibilityLabel("Clear recent searches")
                }
                .padding(.horizontal, TarsTheme.Space.l)
                .padding(.top, TarsTheme.Space.l)
                .padding(.bottom, TarsTheme.Space.s)

                ForEach(recents) { asset in
                    SearchResultRow(asset: asset) { remember(asset) }
                }
            }
            .padding(.bottom, TarsTheme.Space.xl)
        }
        .scrollDismissesKeyboard(.immediately)
    }

    private func resultsList(_ assets: [Asset]) -> some View {
        ScrollView {
            LazyVStack(spacing: TarsTheme.Space.xs) {
                ForEach(assets) { asset in
                    SearchResultRow(asset: asset) { remember(asset) }
                        .transition(.opacity.combined(with: .move(edge: .top)))
                }
            }
            .padding(.top, TarsTheme.Space.m)
            .padding(.bottom, TarsTheme.Space.xl)
            .animation(Motion.fluid, value: assets)
        }
        .scrollDismissesKeyboard(.immediately)
    }

    private var searchingSkeleton: some View {
        VStack(spacing: TarsTheme.Space.m) {
            ForEach(0..<5, id: \.self) { _ in
                HStack(spacing: TarsTheme.Space.m) {
                    SkeletonBlock(width: 64, height: 16)
                    VStack(alignment: .leading, spacing: TarsTheme.Space.xs) {
                        SkeletonBlock(width: 160, height: 12)
                        SkeletonBlock(width: 80, height: 10)
                    }
                    Spacer()
                    SkeletonBlock(width: 32, height: 32)
                }
                .padding(.horizontal, TarsTheme.Space.l)
            }
            Spacer()
        }
        .padding(.top, TarsTheme.Space.l)
        .accessibilityLabel("Searching")
    }

    // MARK: Search plumbing

    private func runDebouncedSearch() async {
        let q = query.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !q.isEmpty else {
            withAnimation(Motion.fluid) { phase = .idle }
            return
        }
        try? await Task.sleep(for: .milliseconds(300))
        guard !Task.isCancelled else { return }
        await performSearch(q)
    }

    private func performSearch(_ q: String) async {
        guard !q.isEmpty else { return }
        withAnimation(Motion.snappy) { phase = .searching }
        do {
            let assets = try await store.marketData.search(q)
            guard !Task.isCancelled else { return }
            withAnimation(Motion.fluid) {
                phase = assets.isEmpty ? .noResults(q) : .results(assets)
            }
        } catch is CancellationError {
            // superseded by a newer keystroke — ignore
        } catch let error as TarsError {
            guard !Task.isCancelled else { return }
            withAnimation(Motion.fluid) {
                phase = .error(error.errorDescription ?? "Something went wrong.")
            }
        } catch {
            guard !Task.isCancelled else { return }
            withAnimation(Motion.fluid) { phase = .error(error.localizedDescription) }
        }
    }

    private func remember(_ asset: Asset) {
        recents = RecentSearchStore.remember(asset)
    }
}

fileprivate enum SearchPhase: Equatable {
    case idle
    case searching
    case results([Asset])
    case noResults(String)
    case error(String)
}

// MARK: Result row

fileprivate struct SearchResultRow: View {
    @Environment(TradingStore.self) private var store
    let asset: Asset
    var onAdd: () -> Void

    private var isAdded: Bool { store.watchlist.contains(asset.symbol) }

    var body: some View {
        HStack(spacing: TarsTheme.Space.m) {
            Text(asset.symbol)
                .font(TarsTheme.Text.price)
                .foregroundStyle(TarsTheme.inkPrimary)
                .lineLimit(1)
                .minimumScaleFactor(0.7)
                .frame(minWidth: 64, alignment: .leading)

            VStack(alignment: .leading, spacing: TarsTheme.Space.xs) {
                Text(asset.name)
                    .font(TarsTheme.Text.body)
                    .foregroundStyle(TarsTheme.inkSecondary)
                    .lineLimit(1)
                AssetClassChip(assetClass: asset.assetClass)
            }

            Spacer(minLength: TarsTheme.Space.s)

            Button {
                guard !isAdded else { return }
                withAnimation(Motion.snappy) {
                    store.addToWatchlist(asset.symbol)
                }
                Haptics.success()
                onAdd()
            } label: {
                Image(systemName: isAdded ? "checkmark.circle.fill" : "plus.circle.fill")
                    .font(TarsTheme.Text.heading)
                    .foregroundStyle(isAdded ? TarsTheme.gain : TarsTheme.accent)
                    .contentTransition(.symbolEffect(.replace))
                    .scaleEffect(isAdded ? 1.08 : 1)
                    .animation(Motion.snappy, value: isAdded)
                    .frame(width: 44, height: 44)
            }
            .buttonStyle(PressableStyle())
            .disabled(isAdded)
            .accessibilityLabel(
                isAdded ? "\(asset.symbol) is on your watchlist"
                        : "Add \(asset.symbol) to watchlist")
        }
        .padding(.horizontal, TarsTheme.Space.l)
        .padding(.vertical, TarsTheme.Space.s)
        .contentShape(Rectangle())
    }
}

fileprivate struct AssetClassChip: View {
    let assetClass: AssetClass
    var body: some View {
        Text(assetClass.label.uppercased())
            .font(TarsTheme.Text.micro)
            .kerning(0.8)
            .foregroundStyle(assetClass == .crypto ? TarsTheme.agentPurple : TarsTheme.inkSecondary)
            .padding(.horizontal, TarsTheme.Space.s)
            .padding(.vertical, 3)
            .background(
                Capsule().fill(TarsTheme.bg3)
                    .overlay(Capsule().strokeBorder(TarsTheme.hairline, lineWidth: 1))
            )
            .accessibilityHidden(true)
    }
}

// MARK: State view (empty / no-results / error)

fileprivate struct SearchStateView<Extra: View>: View {
    let systemImage: String
    let title: String
    let message: String
    var tint: Color = TarsTheme.inkTertiary
    @ViewBuilder var extra: () -> Extra

    init(systemImage: String, title: String, message: String,
         tint: Color = TarsTheme.inkTertiary,
         @ViewBuilder extra: @escaping () -> Extra = { EmptyView() }) {
        self.systemImage = systemImage
        self.title = title
        self.message = message
        self.tint = tint
        self.extra = extra
    }

    var body: some View {
        VStack(spacing: TarsTheme.Space.m) {
            Image(systemName: systemImage)
                .font(TarsTheme.Text.hero)
                .foregroundStyle(tint)
                .padding(.bottom, TarsTheme.Space.xs)
            Text(title)
                .font(TarsTheme.Text.heading)
                .foregroundStyle(TarsTheme.inkPrimary)
            Text(message)
                .font(TarsTheme.Text.body)
                .foregroundStyle(TarsTheme.inkSecondary)
                .multilineTextAlignment(.center)
                .frame(maxWidth: 340)
            extra()
                .padding(.top, TarsTheme.Space.s)
        }
        .padding(TarsTheme.Space.xl)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .transition(.opacity)
    }
}

// MARK: Recent searches (UserDefaults)

fileprivate enum RecentSearchStore {
    private static let key = "tars.watchlist.recentSearches"
    private static let cap = 8

    static func load() -> [Asset] {
        guard let data = UserDefaults.standard.data(forKey: key),
              let assets = try? JSONDecoder().decode([Asset].self, from: data)
        else { return [] }
        return assets
    }

    @discardableResult
    static func remember(_ asset: Asset) -> [Asset] {
        var assets = load().filter { $0.symbol != asset.symbol }
        assets.insert(asset, at: 0)
        if assets.count > cap { assets = Array(assets.prefix(cap)) }
        if let data = try? JSONEncoder().encode(assets) {
            UserDefaults.standard.set(data, forKey: key)
        }
        return assets
    }

    static func clear() {
        UserDefaults.standard.removeObject(forKey: key)
    }
}

// MARK: - Sparkline

/// Tiny month-trend line for a symbol. Fetches `.month1` bars once (shared
/// actor-backed cache — 30 sparklines cost one fetch each, ever), tinted by
/// whether the month was a gain or a loss. No axes, no chrome.
struct Sparkline: View {
    let symbol: String
    var width: CGFloat = 72
    var height: CGFloat = 28

    @Environment(TradingStore.self) private var store
    @State private var state: SparkState = .loading

    var body: some View {
        Group {
            switch state {
            case .loading:
                SkeletonBlock(width: width, height: height)
            case .failed:
                RoundedRectangle(cornerRadius: TarsTheme.Radius.s, style: .continuous)
                    .fill(TarsTheme.bg2)
                    .frame(width: width, height: height)
                    .overlay(
                        Image(systemName: "minus")
                            .font(TarsTheme.Text.caption)
                            .foregroundStyle(TarsTheme.inkTertiary)
                    )
            case .loaded(let bars):
                sparkChart(bars)
                    .frame(width: width, height: height)
                    .transition(.opacity)
            }
        }
        .animation(Motion.fluid, value: state)
        .task(id: symbol) {
            await load()
        }
        .accessibilityLabel(accessibilityText)
    }

    @ViewBuilder
    private func sparkChart(_ bars: [Bar]) -> some View {
        let trendUp = (bars.last?.close ?? 0) >= (bars.first?.close ?? 0)
        let tint = trendUp ? TarsTheme.gain : TarsTheme.loss
        let closes = bars.map(\.close)
        let lo = closes.min() ?? 0
        let hi = closes.max() ?? 1
        let pad = max((hi - lo) * 0.08, 0.0001)

        Chart(bars) { bar in
            LineMark(
                x: .value("Time", bar.time),
                y: .value("Close", bar.close)
            )
            .lineStyle(StrokeStyle(lineWidth: 1.5, lineCap: .round, lineJoin: .round))
            .foregroundStyle(tint)
            .interpolationMethod(.catmullRom)
        }
        .chartXAxis(.hidden)
        .chartYAxis(.hidden)
        .chartYScale(domain: (lo - pad)...(hi + pad))
        .chartLegend(.hidden)
        .allowsHitTesting(false)
    }

    private var accessibilityText: String {
        switch state {
        case .loaded(let bars):
            if let first = bars.first?.close, let last = bars.last?.close, first != 0 {
                let pct = (last - first) / first * 100
                let dir = pct >= 0 ? "up" : "down"
                return "\(symbol) one month trend, \(dir) \(String(format: "%.1f", abs(pct))) percent"
            }
            return "\(symbol) one month trend"
        case .failed:
            return "\(symbol) one month trend unavailable"
        case .loading:
            return "\(symbol) one month trend, loading"
        }
    }

    private func load() async {
        do {
            let bars = try await SparklineBarCache.shared.bars(
                for: symbol, using: store.marketData)
            guard !Task.isCancelled else { return }
            state = bars.isEmpty ? .failed : .loaded(bars)
        } catch {
            guard !Task.isCancelled else { return }
            state = .failed
        }
    }
}

fileprivate enum SparkState: Equatable {
    case loading
    case loaded([Bar])
    case failed
}

/// Shared bar cache with in-flight de-duplication: N sparklines for the same
/// symbol resolve from a single provider request.
fileprivate actor SparklineBarCache {
    static let shared = SparklineBarCache()

    private var cache: [String: [Bar]] = [:]
    private var inFlight: [String: Task<[Bar], Error>] = [:]

    func bars(for symbol: String, using market: any MarketProviding) async throws -> [Bar] {
        if let hit = cache[symbol] { return hit }
        if let pending = inFlight[symbol] { return try await pending.value }

        let task = Task { try await market.bars(symbol: symbol, timeframe: .month1) }
        inFlight[symbol] = task
        defer { inFlight[symbol] = nil }

        let bars = try await task.value
        cache[symbol] = bars
        return bars
    }
}

// MARK: - Market Heatmap

/// The watchlist as a field of temperature tiles: equal-size rounded cells whose
/// fill intensity encodes today's move (clamped at ±3%). Tap a tile to open the
/// symbol. Tiles breathe in on entrance, staggered by index.
struct MarketHeatmapView: View {
    @Environment(TradingStore.self) private var store
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    private let columns = [
        GridItem(.adaptive(minimum: 108, maximum: 180), spacing: TarsTheme.Space.s)
    ]

    var body: some View {
        if store.watchlist.isEmpty {
            emptyState
        } else {
            LazyVGrid(columns: columns, spacing: TarsTheme.Space.s) {
                ForEach(Array(store.watchlist.enumerated()), id: \.element) { index, symbol in
                    NavigationLink {
                        SymbolDetailView(symbol: symbol)
                    } label: {
                        HeatTile(
                            symbol: symbol,
                            quote: store.quote(for: symbol),
                            index: index,
                            reduceMotion: reduceMotion)
                    }
                    .buttonStyle(PressableStyle())
                    .accessibilityLabel(tileLabel(symbol))
                }
            }
            .animation(Motion.fluid, value: store.watchlist)
        }
    }

    private func tileLabel(_ symbol: String) -> String {
        guard let q = store.quote(for: symbol) else { return "\(symbol), loading quote" }
        let pct = q.changePercent * 100
        let dir = pct >= 0 ? "up" : "down"
        return "\(symbol), \(dir) \(String(format: "%.2f", abs(pct))) percent today. Opens detail."
    }

    private var emptyState: some View {
        VStack(spacing: TarsTheme.Space.m) {
            Image(systemName: "square.grid.3x3.square")
                .font(TarsTheme.Text.hero)
                .foregroundStyle(TarsTheme.inkTertiary)
            Text("Nothing to map yet")
                .font(TarsTheme.Text.heading)
                .foregroundStyle(TarsTheme.inkPrimary)
            Text("Add symbols to your watchlist and this becomes a live temperature map of your market.")
                .font(TarsTheme.Text.body)
                .foregroundStyle(TarsTheme.inkSecondary)
                .multilineTextAlignment(.center)
                .frame(maxWidth: 340)
        }
        .padding(TarsTheme.Space.xxl)
        .frame(maxWidth: .infinity)
        .tarsPanel()
    }
}

fileprivate struct HeatTile: View {
    let symbol: String
    let quote: Quote?
    let index: Int
    let reduceMotion: Bool

    @State private var entered = false

    /// Fill intensity: |changePercent| mapped onto 0…1, saturating at ±3%.
    private var intensity: Double {
        guard let quote else { return 0 }
        return min(abs(quote.changePercent) / 0.03, 1.0)
    }

    private var meaning: Color {
        TarsTheme.pnl(quote?.changePercent ?? 0)
    }

    var body: some View {
        VStack(alignment: .leading, spacing: TarsTheme.Space.xs) {
            Text(symbol)
                .font(TarsTheme.Text.priceSmall)
                .foregroundStyle(TarsTheme.inkPrimary)
                .lineLimit(1)
                .minimumScaleFactor(0.7)
            Spacer(minLength: 0)
            if let quote {
                PercentText(value: quote.changePercent)
            } else {
                SkeletonBlock(width: 44, height: 12)
            }
        }
        .padding(TarsTheme.Space.m)
        .frame(maxWidth: .infinity, minHeight: 76, alignment: .leading)
        .background(
            RoundedRectangle(cornerRadius: TarsTheme.Radius.m, style: .continuous)
                .fill(TarsTheme.bg2)
                .overlay(
                    RoundedRectangle(cornerRadius: TarsTheme.Radius.m, style: .continuous)
                        .fill(meaning.opacity(0.06 + 0.30 * intensity))
                )
                .overlay(
                    RoundedRectangle(cornerRadius: TarsTheme.Radius.m, style: .continuous)
                        .strokeBorder(
                            meaning.opacity(0.15 + 0.35 * intensity),
                            lineWidth: 1)
                )
        )
        .animation(Motion.ticker, value: intensity)
        .scaleEffect(entered ? 1 : 0.86)
        .opacity(entered ? 1 : 0)
        .onAppear {
            if reduceMotion {
                entered = true
            } else {
                withAnimation(Motion.fluid.delay(Double(index) * 0.045)) {
                    entered = true
                }
            }
        }
    }
}
