import SwiftUI

/*
  Markets — the desk's front page, on a phone.

  Reads top-down the way the web terminal does: the pulse (the four index
  proxies), the venue rail (the whole-desk moment — eight venues, one thumb
  sweep), then the board itself. Every price wears its provenance chip; a
  stale poll shows an amber line instead of pretending.

  One poll drives it: the platform board every 20s while visible, nothing
  while backgrounded. All data is the server's — this screen computes no
  market math beyond coloring a sign.
*/
struct MarketsHomeView: View {
    /// Set when this view is a COLUMN in the iPad terminal: taps select
    /// into the neighboring pane instead of pushing a new screen.
    var onSelect: ((String) -> Void)? = nil
    @State private var model = MarketsModel()
    @State private var query = ""
    @State private var pushed: String?
    @Environment(\.scenePhase) private var scenePhase
    @Environment(\.dynamicTypeSize) private var typeSize

    /// GOOG and GOOGL are the same story wearing two tickers — keep the first.
    private func dedupeClasses(_ rows: [BoardRowPayload]) -> [BoardRowPayload] {
        var kept: [BoardRowPayload] = []
        for r in rows {
            let stem = r.symbol.count > 4 ? String(r.symbol.dropLast()) : r.symbol
            if kept.contains(where: { $0.symbol == stem || $0.symbol == r.symbol }) { continue }
            kept.append(r)
        }
        return kept
    }

    /// One door for both worlds: select in place on the terminal, push on the phone.
    private func open(_ symbol: String) {
        if let onSelect { onSelect(symbol) } else { pushed = symbol }
    }

    static let indexName = [ // short enough to never truncate in a quarter-column
        "SPY": "S&P 500", "QQQ": "NASDAQ", "DIA": "DOW 30", "IWM": "RUSSELL",
    ]

    /// The rows the search allows through — instant, over what's loaded.
    private var visibleRows: [BoardRowPayload] {
        let q = query.trimmingCharacters(in: .whitespaces).uppercased()
        guard !q.isEmpty else { return model.rows }
        return model.rows.filter {
            SymbolDisplay.pretty($0.symbol).uppercased().contains(q)
            || $0.symbol.uppercased().contains(q)
        }
    }

    var body: some View {
        ScrollView {
            LazyVStack(alignment: .leading, spacing: TarsTheme.Space.l, pinnedViews: []) {
                header
                searchField
                if model.stale { staleBanner }
                pulseStrip
                breadthBar
                venueMap
                venueRail
                if let note = MarketsModel.roomNote[model.venue ?? ""] { roomNote(note) }
                moversRail
                boardList
            }
            .padding(.horizontal, TarsTheme.Space.l)
            .padding(.bottom, 72)
        }
        .background(TarsTheme.bg0)
        // The screen owns its header. The system large-title + searchable
        // combination spent the top quarter of the screen saying nothing.
        .toolbar(.hidden, for: .navigationBar)
        .navigationDestination(item: $pushed) { MarketSymbolView(symbol: $0) }
        .refreshable { await model.refresh() }
        .task {
            model.activate()
            #if DEBUG
            // Headless drives: -TarsOpenSymbol AAPL opens a symbol page.
            if pushed == nil,
               let sym = UserDefaults.standard.string(forKey: "TarsOpenSymbol"), !sym.isEmpty {
                open(sym)
            }
            #endif
        }
        .onDisappear { model.deactivate() }
        .onChange(of: scenePhase) { _, phase in
            // A hidden app polls nothing; a returning one reads immediately.
            if phase == .active { model.activate() } else { model.deactivate() }
        }
    }

    // MARK: - Header: the screen title works for a living

    private var header: some View {
        HStack(alignment: .center, spacing: TarsTheme.Space.s) {
            TarsApexMark(size: 18)
            Text("Markets")
                .font(TarsTheme.Text.screenTitle)
                .foregroundStyle(TarsTheme.inkPrimary)
            Spacer()
            if model.marketOpen == false { marketClosedChip }
        }
        .padding(.top, TarsTheme.Space.s)
    }

    private var searchField: some View {
        HStack(spacing: TarsTheme.Space.s) {
            Image(systemName: "magnifyingglass")
                .font(.system(size: 14, weight: .medium))
                .foregroundStyle(TarsTheme.inkTertiary)
            TextField("Ticker or pair", text: $query)
                .font(TarsTheme.Text.body)
                .foregroundStyle(TarsTheme.inkPrimary)
                .autocorrectionDisabled()
                .textInputAutocapitalization(.characters)
            if !query.isEmpty {
                Button { query = "" } label: {
                    Image(systemName: "xmark.circle.fill")
                        .font(.system(size: 14))
                        .foregroundStyle(TarsTheme.inkTertiary)
                        .frame(width: 32, height: 32)
                }
                .buttonStyle(.plain)
                .accessibilityLabel("Clear search")
            }
        }
        .padding(.horizontal, TarsTheme.Space.m)
        .frame(height: 42)
        .background(TarsTheme.bg1)
        .clipShape(RoundedRectangle(cornerRadius: TarsTheme.Radius.m, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: TarsTheme.Radius.m, style: .continuous)
            .strokeBorder(TarsTheme.hairline, lineWidth: 1))
    }

    // MARK: - The pulse: four index proxies, the room's weather

    private var pulseStrip: some View {
        /*
          Four proxies across is right at normal type and unreadable at
          accessibility sizes — verified at XXXL, where "$747" wrapped to
          "$7 / 47". A price that wraps is worse than a price that shrinks,
          so the row reflows to two columns and every number holds one line.
        */
        let columns = typeSize.isAccessibilitySize
            ? [GridItem(.flexible(), alignment: .leading), GridItem(.flexible(), alignment: .leading)]
            : Array(repeating: GridItem(.flexible(), alignment: .leading), count: 4)
        return LazyVGrid(columns: columns, spacing: TarsTheme.Space.m) {
            ForEach(["SPY", "QQQ", "DIA", "IWM"], id: \.self) { sym in
                let row = model.row(sym)
                VStack(alignment: .leading, spacing: 3) {
                    HStack(spacing: 4) {
                        Text(sym)
                            .font(TarsTheme.Text.micro.weight(.semibold))
                            .foregroundStyle(TarsTheme.inkSecondary)
                        Text(Self.indexName[sym] ?? "")
                            .font(TarsTheme.Text.micro)
                            .foregroundStyle(TarsTheme.inkQuaternary)
                    }
                    .lineLimit(1)
                    if let price = row?.price {
                        Text(price, format: .currency(code: "USD").precision(.fractionLength(2)))
                            .font(TarsTheme.Text.caption.monospacedDigit().weight(.semibold))
                            .foregroundStyle(TarsTheme.inkPrimary)
                            .lineLimit(1).minimumScaleFactor(0.6)
                            .contentTransition(.numericText())
                            .animation(.snappy, value: price)
                        ChangeText(row?.changePercent)
                    } else {
                        Text("—").font(TarsTheme.Text.caption)
                            .foregroundStyle(TarsTheme.inkQuaternary)
                    }
                }
                .frame(maxWidth: .infinity, alignment: .leading)
            }
        }
        .padding(.vertical, TarsTheme.Space.xs)
        .accessibilityElement(children: .combine)
        .accessibilityLabel("Market pulse")
    }

    /// The desk is closed — say so rather than letting stale prices imply life.
    private var marketClosedChip: some View {
        HStack(spacing: 6) {
            Circle().fill(TarsTheme.inkTertiary).frame(width: 6, height: 6)
            Text("US market closed")
                .font(TarsTheme.Text.micro)
                .foregroundStyle(TarsTheme.inkTertiary)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    /// Breadth — the tape's conviction. A wide advance with a thin decline is
    /// a different market from a narrow one, and the bar says which.
    @ViewBuilder private var breadthBar: some View {
        if let b = model.movers?.breadth {
            let total = max(1, b.advancing + b.declining + b.unchanged)
            VStack(alignment: .leading, spacing: 6) {
                HStack {
                    Text("BREADTH").font(TarsTheme.Text.micro).kerning(1.2)
                        .foregroundStyle(TarsTheme.inkQuaternary)
                    Spacer()
                    Text("\(total) markets").font(TarsTheme.Text.micro)
                        .foregroundStyle(TarsTheme.inkQuaternary)
                }
                GeometryReader { geo in
                    HStack(spacing: 2) {
                        Capsule().fill(TarsTheme.gain)
                            .frame(width: geo.size.width * CGFloat(b.advancing) / CGFloat(total))
                        Capsule().fill(TarsTheme.bg3)
                            .frame(width: geo.size.width * CGFloat(b.unchanged) / CGFloat(total))
                        Capsule().fill(TarsTheme.loss)
                            .frame(width: geo.size.width * CGFloat(b.declining) / CGFloat(total))
                    }
                }
                .frame(height: 6)
                // The BAR carries the color; the counts just report.
                HStack {
                    Text("\(b.advancing) adv").foregroundStyle(TarsTheme.inkSecondary)
                    Spacer()
                    Text("\(b.unchanged) flat").foregroundStyle(TarsTheme.inkTertiary)
                    Spacer()
                    Text("\(b.declining) dec").foregroundStyle(TarsTheme.inkSecondary)
                }
                .font(TarsTheme.Text.micro.monospacedDigit())
            }
            .accessibilityElement(children: .combine)
            .accessibilityLabel("Breadth: \(b.advancing) advancing, \(b.declining) declining")
        }
    }

    /*
      The whole desk. A pill row communicates navigation; this communicates
      BREADTH — eight venues with their true listing counts, so "1,742
      markets" stops being a claim and becomes a fact you can count.
    */
    @ViewBuilder private var venueMap: some View {
        if !model.venues.isEmpty {
            VStack(alignment: .leading, spacing: TarsTheme.Space.s) {
                HStack {
                    Text("THE WHOLE DESK").font(TarsTheme.Text.micro).kerning(1.5)
                        .foregroundStyle(TarsTheme.inkQuaternary)
                    Spacer()
                    Text("\(model.totalMarkets) listed markets")
                        .font(TarsTheme.Text.micro.monospacedDigit())
                        .foregroundStyle(TarsTheme.inkQuaternary)
                }
                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(spacing: TarsTheme.Space.s) {
                        ForEach(model.venues) { v in
                            Button {
                                Haptics.tick()
                                model.select(v.category)
                            } label: {
                                VStack(alignment: .leading, spacing: 4) {
                                    Image(systemName: MarketsModel.venueIcon[v.category] ?? "square.grid.2x2")
                                        .font(.system(size: 16, weight: .medium))
                                        .foregroundStyle(TarsTheme.inkSecondary)
                                    Text(v.category)
                                        .font(TarsTheme.Text.caption.weight(.semibold))
                                        .foregroundStyle(TarsTheme.inkPrimary)
                                    Text("\(v.count)")
                                        .font(TarsTheme.Text.micro.monospacedDigit())
                                        .foregroundStyle(TarsTheme.inkTertiary)
                                }
                                .frame(width: 96, alignment: .topLeading)
                                .padding(TarsTheme.Space.m)
                                .background(TarsTheme.bg1)
                                .clipShape(RoundedRectangle(cornerRadius: TarsTheme.Radius.m, style: .continuous))
                                .overlay(RoundedRectangle(cornerRadius: TarsTheme.Radius.m, style: .continuous)
                                    .strokeBorder(TarsTheme.hairline, lineWidth: 1))
                            }
                            .buttonStyle(.plain)
                            .accessibilityLabel("\(v.category), \(v.count) markets")
                        }
                    }
                }
            }
        }
    }

    private func roomNote(_ text: String) -> some View {
        Text(text)
            .font(TarsTheme.Text.micro)
            .foregroundStyle(TarsTheme.inkTertiary)
            .frame(maxWidth: .infinity, alignment: .leading)
    }

    /// What moved — the two rails that answer "anything happening?" first.
    @ViewBuilder private var moversRail: some View {
        // Share classes tell one story once: GOOGL yields to GOOG.
        if let m = model.movers, let gainers = m.gainers, !gainers.isEmpty {
            VStack(alignment: .leading, spacing: TarsTheme.Space.s) {
                Text("WHAT MOVED").font(TarsTheme.Text.micro).kerning(1.5)
                    .foregroundStyle(TarsTheme.inkQuaternary)
                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(spacing: TarsTheme.Space.s) {
                        let rail = Array(gainers.prefix(4)) + Array((m.losers ?? []).prefix(4))
                        ForEach(dedupeClasses(rail)) { r in
                            Button { open(r.symbol) } label: {
                                VStack(alignment: .leading, spacing: 3) {
                                    Text(SymbolDisplay.pretty(r.symbol))
                                        .font(TarsTheme.Text.caption.weight(.semibold))
                                        .foregroundStyle(TarsTheme.inkPrimary)
                                        .lineLimit(1)
                                    if let p = r.price {
                                        Text(SymbolDisplay.price(r.symbol, p))
                                            .font(TarsTheme.Text.micro.monospacedDigit())
                                            .foregroundStyle(TarsTheme.inkSecondary)
                                    }
                                    ChangeText(r.changePercent)
                                }
                                .frame(width: 104, alignment: .leading)
                                .padding(TarsTheme.Space.m)
                                .background(TarsTheme.bg1)
                                .clipShape(RoundedRectangle(cornerRadius: TarsTheme.Radius.m, style: .continuous))
                                .overlay(RoundedRectangle(cornerRadius: TarsTheme.Radius.m, style: .continuous)
                                    .strokeBorder(TarsTheme.hairline, lineWidth: 1))
                            }
                            .buttonStyle(.plain)
                        }
                    }
                }
            }
        }
    }

    // MARK: - The venue rail: the whole desk in one thumb sweep

    private var venueRail: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: TarsTheme.Space.s) {
                venueChip(nil, label: "Trending")
                ForEach(MarketsModel.venues, id: \.self) { venue in
                    venueChip(venue, label: venue)
                }
            }
        }
        .accessibilityLabel("Venues")
    }

    private func venueChip(_ venue: String?, label: String) -> some View {
        let selected = model.venue == venue
        return Button {
            Haptics.tick()
            model.select(venue)
        } label: {
            Text(label.uppercased())
                .font(TarsTheme.Text.caption.weight(selected ? Font.Weight.bold : Font.Weight.medium))
                .kerning(0.6)
                .foregroundStyle(selected ? TarsTheme.inkPrimary : TarsTheme.inkTertiary)
                .padding(.horizontal, TarsTheme.Space.xs)
                .frame(minHeight: 44)
                .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityAddTraits(selected ? [.isSelected] : [])
    }

    // MARK: - The board

    private var boardList: some View {
        VStack(spacing: 0) {
            if model.rows.isEmpty && model.loading {
                ForEach(0..<8, id: \.self) { _ in skeletonRow }
            } else {
                ForEach(visibleRows) { row in
                    Button { open(row.symbol) } label: { boardRow(row) }
                        .buttonStyle(.plain)
                    Divider().overlay(TarsTheme.hairline)
                }
                if visibleRows.isEmpty && !query.isEmpty {
                    Text("Nothing here matches \"\(query)\".")
                        .font(TarsTheme.Text.caption)
                        .foregroundStyle(TarsTheme.inkTertiary)
                        .padding(TarsTheme.Space.xl)
                }
            }
        }
    }

    private func boardRow(_ row: BoardRowPayload) -> some View {
        HStack(spacing: TarsTheme.Space.m) {
            VStack(alignment: .leading, spacing: 2) {
                Text(SymbolDisplay.pretty(row.symbol))
                    .font(TarsTheme.Text.body.weight(.semibold))
                    .foregroundStyle(TarsTheme.inkPrimary)
                if let source = row.source {
                    ProvenanceChip(source, symbol: row.symbol)
                }
            }
            Spacer()
            // The slot is reserved either way — a ragged price column costs
            // more than an empty sparkline cell.
            Group {
                if let series = model.sparks[row.symbol], series.count > 1 {
                    SparkPath(values: series,
                              tone: (row.changePercent ?? 0) >= 0 ? TarsTheme.gain : TarsTheme.loss)
                } else {
                    Color.clear
                }
            }
            .frame(width: 56, height: 20)
            .accessibilityHidden(true)
            VStack(alignment: .trailing, spacing: 2) {
                if let price = row.price {
                    Text(SymbolDisplay.price(row.symbol, price))
                        .font(TarsTheme.Text.body.monospacedDigit())
                        .foregroundStyle(TarsTheme.inkPrimary)
                        .contentTransition(.numericText())
                        .animation(.snappy, value: price)
                }
                ChangeText(row.changePercent)
            }
        }
        .frame(minHeight: 56)
        .contentShape(Rectangle())
        .accessibilityElement(children: .combine)
    }

    private var skeletonRow: some View {
        HStack {
            RoundedRectangle(cornerRadius: 4).fill(TarsTheme.bg3).frame(width: 72, height: 14)
            Spacer()
            RoundedRectangle(cornerRadius: 4).fill(TarsTheme.bg3).frame(width: 88, height: 14)
        }
        .padding(.vertical, TarsTheme.Space.l)
        .frame(minHeight: 56)
    }

    private var staleBanner: some View {
        Text("Prices paused — reconnecting. These are the last good reads.")
            .font(TarsTheme.Text.caption)
            .foregroundStyle(TarsTheme.warning)
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(.horizontal, TarsTheme.Space.l)
            .padding(.vertical, TarsTheme.Space.s)
            .background(TarsTheme.warning.opacity(0.1))
            .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
            .accessibilityAddTraits(.updatesFrequently)
    }
}

/// A signed percentage in P&L color — green up, red down, quiet gray flat.
private struct ChangeText: View {
    let value: Double?
    init(_ value: Double?) { self.value = value }
    var body: some View {
        if let v = value {
            Text("\(v >= 0 ? "+" : "")\(v * 100, specifier: "%.2f")%")
                .font(TarsTheme.Text.caption.monospacedDigit())
                .foregroundStyle(abs(v) < 0.00005 ? TarsTheme.inkTertiary
                    : v > 0 ? TarsTheme.gain : TarsTheme.loss)
                .lineLimit(1).minimumScaleFactor(0.6)
        } else {
            Text("· ·").font(TarsTheme.Text.caption).foregroundStyle(TarsTheme.inkQuaternary)
        }
    }
}

/// The honesty chip: where this price came from, always visible.
private struct ProvenanceChip: View {
    let source: Provenance
    let symbol: String?
    init(_ source: Provenance, symbol: String? = nil) {
        self.source = source; self.symbol = symbol
    }
    private var label: String { ProvenanceLabel.text(source, symbol: symbol) }
    var body: some View {
        Text(label)
            .font(.system(size: 9, weight: .semibold, design: .monospaced))
            .kerning(0.6)
            .foregroundStyle(source == .live ? TarsTheme.gain : TarsTheme.inkTertiary)
            .accessibilityLabel("Price source: \(label)")
    }
}

// MARK: - The model

@Observable @MainActor
final class MarketsModel {
    static let venues = ["Stocks", "ETFs", "Crypto", "Global", "FX", "Income", "Indices", "Futures"]
    static let venueIcon: [String: String] = [
        "Stocks": "building.2.fill", "ETFs": "square.stack.3d.up.fill",
        "Crypto": "bitcoinsign.circle.fill", "Global": "globe",
        "FX": "arrow.left.arrow.right", "Income": "banknote.fill",
        "Indices": "chart.xyaxis.line", "Futures": "calendar.badge.clock",
    ]

    private(set) var rows: [BoardRowPayload] = []
    private(set) var sparks: [String: [Double]] = [:]
    private(set) var venues: [VenueCount] = []
    private(set) var movers: MoversPayload?
    private(set) var totalMarkets = 0
    private(set) var marketOpen: Bool?
    private(set) var venue: String?
    private(set) var loading = true
    private(set) var stale = false

    /// One operational line per room — what actually happens when you trade
    /// here. The same sentences the web states, because the desk is one desk.
    static let roomNote: [String: String] = [
        "Stocks": "Cash equities — market, limit, stop and trailing orders, long or short.",
        "ETFs": "Trade like stocks. Leveraged funds decay; visit the Academy before sizing.",
        "Crypto": "Around the clock. Fills carry a 25bps commission, priced into the math.",
        "Global": "Foreign companies and country funds listed in the US — dollar-priced.",
        "FX": "Spot pairs marked at daily ECB rates; P&L converts to dollars at the same rates.",
        "Income": "Built for dividends — payouts land in cash automatically on pay dates.",
        "Indices": "Quote-only benchmarks. To trade the level, use its future or its ETF.",
        "Futures": "Post initial margin, settle variation daily. Each ticket lists what it requires.",
    ]

    private var loop: Task<Void, Never>?
    private let api = TarsAPIClient.shared

    func row(_ symbol: String) -> BoardRowPayload? {
        rows.first { $0.symbol == symbol }
    }

    func select(_ v: String?) {
        venue = v
        loading = true
        rows = []
        Task { await refresh() }
    }

    func activate() {
        guard loop == nil else { return }
        loop = Task { [weak self] in
            while !Task.isCancelled {
                await self?.refresh()
                try? await Task.sleep(for: .seconds(20))
            }
        }
    }

    func deactivate() {
        loop?.cancel()
        loop = nil
    }

    func refresh() async {
        do {
            let res = try await api.board(category: venue, limit: 250)
            rows = res.rows
            movers = res.movers
            marketOpen = res.marketOpen
            if let v = res.venues, !v.isEmpty { venues = v }
            if let t = res.total, t > 0 { totalMarkets = t }
            stale = false
            // The first screenful gets lines; scrolling further stays cheap.
            let want = Array(res.rows.prefix(32).map(\.symbol))
            if let fresh = try? await api.sparks(symbols: want) {
                sparks.merge(fresh) { _, new in new }
            }
        } catch {
            stale = true // last-good stands; the banner tells the truth
        }
        loading = false
    }
}
