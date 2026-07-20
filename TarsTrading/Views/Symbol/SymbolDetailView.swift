import SwiftUI

/// The symbol page: live price header, chart, trade actions, a teach-first
/// stats grid, and Academy lesson hooks. Every stat doubles as an education
/// touchpoint — tap it and Tars explains what the number actually means.
struct SymbolDetailView: View {
    let symbol: String

    @Environment(TradingStore.self) private var store
    @Environment(TarsStore.self) private var tars
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    @State private var ticketSide: OrderSide?
    @State private var dayBars: [Bar] = []
    @State private var yearBars: [Bar] = []
    @State private var isLoadingBars = true
    @State private var fallbackQuote: Quote?
    @State private var starBounce = 0

    private var quote: Quote? { store.quote(for: symbol) ?? fallbackQuote }
    private var companyName: String? {
        DemoMarket.universe.first { $0.symbol == symbol }?.name
    }
    private var isWatched: Bool { store.watchlist.contains(symbol) }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: TarsTheme.Space.xl) {
                header
                ChartView(symbol: symbol)
                    .onAppear { tars.visibleSymbol = symbol }
                tradeButtons
                if !isCrypto { optionsChainChip }
                statsSection
                learnSection
            }
            .padding(TarsTheme.Space.xl)
        }
        .background(TarsTheme.bg0.ignoresSafeArea())
        .navigationTitle(symbol)
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) { watchlistButton }
        }
        .sheet(item: $ticketSide) { side in
            OrderTicketView(symbol: symbol, side: side)
        }
        .task(id: symbol) { await loadData() }
    }

    // MARK: - Header

    private var header: some View {
        VStack(alignment: .leading, spacing: TarsTheme.Space.m) {
            VStack(alignment: .leading, spacing: TarsTheme.Space.xs) {
                Text(symbol)
                    .font(TarsTheme.Text.title)
                    .foregroundStyle(TarsTheme.inkPrimary)
                    .lineLimit(1)
                    .minimumScaleFactor(0.7)
                if let companyName {
                    Text(companyName)
                        .font(TarsTheme.Text.body)
                        .foregroundStyle(TarsTheme.inkSecondary)
                }
            }
            if let quote {
                HStack(alignment: .firstTextBaseline, spacing: TarsTheme.Space.m) {
                    TickerText(value: quote.price, font: TarsTheme.Text.priceHero)
                    PercentText(value: quote.changePercent, font: TarsTheme.Text.price)
                }
                .accessibilityElement(children: .combine)
                .accessibilityLabel("\(symbol) price \(quote.price.formatted(.currency(code: "USD"))), \(quote.changePercent.formatted(.percent.precision(.fractionLength(2)))) today")
                if quote.age > 300 {
                    Label {
                        Text("Data as of \(quote.asOf.formatted(.relative(presentation: .named)))")
                    } icon: {
                        Image(systemName: "clock")
                    }
                    .font(TarsTheme.Text.caption)
                    .foregroundStyle(TarsTheme.inkTertiary)
                }
            } else {
                SkeletonBlock(width: 200, height: 40)
            }
        }
    }

    // MARK: - Trade actions

    private var tradeButtons: some View {
        HStack(spacing: TarsTheme.Space.m) {
            tradeButton(side: .buy, tint: TarsTheme.gain)
            tradeButton(side: .sell, tint: TarsTheme.loss)
        }
    }

    private func tradeButton(side: OrderSide, tint: Color) -> some View {
        Button {
            Haptics.tap()
            ticketSide = side
        } label: {
            Text(side.label)
                .font(TarsTheme.Text.heading)
                .foregroundStyle(TarsTheme.bg0)
                .frame(maxWidth: .infinity)
                .padding(.vertical, TarsTheme.Space.m)
                .background(
                    RoundedRectangle(cornerRadius: TarsTheme.Radius.m, style: .continuous)
                        .fill(tint)
                )
        }
        .buttonStyle(PressableStyle())
        .accessibilityLabel("\(side.label) \(symbol)")
        .accessibilityHint("Opens the order ticket.")
    }

    // MARK: - Options sandbox entry (non-crypto only)

    private var isCrypto: Bool {
        symbol.contains("/") ||
        DemoMarket.universe.first { $0.symbol == symbol }?.assetClass == .crypto
    }

    private var optionsChainChip: some View {
        NavigationLink {
            OptionsChainView(symbol: symbol)
        } label: {
            HStack(spacing: TarsTheme.Space.s) {
                Image(systemName: "tablecells")
                    .font(TarsTheme.Text.caption)
                    .foregroundStyle(TarsTheme.accent)
                Text("Options chain")
                    .font(TarsTheme.Text.caption)
                    .foregroundStyle(TarsTheme.inkPrimary)
                Text("SANDBOX")
                    .font(TarsTheme.Text.micro)
                    .foregroundStyle(TarsTheme.paperBadge)
                Spacer()
                Image(systemName: "chevron.right")
                    .font(TarsTheme.Text.micro)
                    .foregroundStyle(TarsTheme.inkTertiary)
            }
            .padding(.horizontal, TarsTheme.Space.l)
            .padding(.vertical, TarsTheme.Space.m)
            .tarsPanel()
        }
        .buttonStyle(PressableStyle())
        .accessibilityLabel("Options chain for \(symbol)")
        .accessibilityHint("Opens the options sandbox, a practice book separate from your paper account.")
    }

    // MARK: - Watchlist star

    private var watchlistButton: some View {
        Button {
            if isWatched {
                store.removeFromWatchlist(symbol)
            } else {
                store.addToWatchlist(symbol)
                if !reduceMotion { starBounce += 1 }
            }
            Haptics.tap()
        } label: {
            Image(systemName: isWatched ? "star.fill" : "star")
                .foregroundStyle(isWatched ? TarsTheme.accent : TarsTheme.inkSecondary)
                .contentTransition(.symbolEffect(.replace))
                .symbolEffect(.bounce, value: starBounce)
        }
        .animation(Motion.snappy, value: isWatched)
        .accessibilityLabel(isWatched ? "Remove \(symbol) from watchlist" : "Add \(symbol) to watchlist")
    }

    // MARK: - Stats

    private var statsSection: some View {
        VStack(alignment: .leading, spacing: TarsTheme.Space.m) {
            Text("Key stats")
                .font(TarsTheme.Text.heading)
                .foregroundStyle(TarsTheme.inkPrimary)
            Text("Tap any stat to learn what it means.")
                .font(TarsTheme.Text.caption)
                .foregroundStyle(TarsTheme.inkTertiary)
            LazyVGrid(
                columns: [GridItem(.adaptive(minimum: 170), spacing: TarsTheme.Space.m)],
                spacing: TarsTheme.Space.m
            ) {
                ForEach(stats) { stat in
                    TarsSymbolStatCell(stat: stat)
                }
            }
        }
    }

    private var stats: [TarsSymbolStat] {
        let dayLow = dayBars.map(\.low).min()
        let dayHigh = dayBars.map(\.high).max()
        let yearLow = yearBars.map(\.low).min()
        let yearHigh = yearBars.map(\.high).max()
        let volume = dayBars.isEmpty ? nil : dayBars.map(\.volume).reduce(0, +)

        return [
            TarsSymbolStat(
                title: "Prev close",
                value: quote.map { $0.previousClose.formatted(.currency(code: "USD")) },
                isLoading: quote == nil,
                explanation: "The last traded price when the market closed yesterday. Today's change — the green or red number next to the price — is measured against it, which makes it the anchor for everything labeled \u{201C}today.\u{201D}"),
            TarsSymbolStat(
                title: "Day range",
                value: rangeText(low: dayLow, high: dayHigh),
                isLoading: isLoadingBars,
                explanation: "The lowest and highest prices traded so far today. A wide range signals an active, volatile session; a narrow one means a quiet day. Where the current price sits inside the range tells you how the day has unfolded."),
            TarsSymbolStat(
                title: "52-week range",
                value: rangeText(low: yearLow, high: yearHigh),
                isLoading: isLoadingBars,
                explanation: "Roughly the lowest and highest prices over the past year. It puts today's price in a longer context — near its yearly highs, near its lows, or somewhere in the middle. Context, not a signal."),
            TarsSymbolStat(
                title: "Volume",
                value: volume.map { $0.formatted(.number.notation(.compactName).precision(.fractionLength(0...1))) },
                isLoading: isLoadingBars,
                explanation: "How many shares or coins changed hands today. Heavy volume means many participants are active and prices reflect real agreement; thin volume means moves can happen on very little conviction."),
            TarsSymbolStat(
                title: "Market cap",
                value: nil,
                isLoading: false,
                explanation: "The total value of every share combined — share price multiplied by shares outstanding. It's how you compare the size of companies, since a high share price alone says nothing about size. Not available in this data feed yet."),
        ]
    }

    private func rangeText(low: Double?, high: Double?) -> String? {
        guard let low, let high else { return nil }
        let style = FloatingPointFormatStyle<Double>.number.precision(.fractionLength(2))
        return "\(low.formatted(style)) \u{2013} \(high.formatted(style))"
    }

    // MARK: - Learn chips

    private var learnSection: some View {
        VStack(alignment: .leading, spacing: TarsTheme.Space.m) {
            Text("Learn")
                .font(TarsTheme.Text.heading)
                .foregroundStyle(TarsTheme.inkPrimary)
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: TarsTheme.Space.s) {
                    ForEach(TarsLearnChip.all) { chip in
                        TarsLearnChipView(chip: chip)
                    }
                }
            }
        }
    }

    // MARK: - Data loading

    private func loadData() async {
        isLoadingBars = true
        dayBars = []
        yearBars = []
        if store.quote(for: symbol) == nil {
            fallbackQuote = try? await store.marketData.quotes(for: [symbol]).first
        }
        async let day = store.marketData.bars(symbol: symbol, timeframe: .day1)
        async let year = store.marketData.bars(symbol: symbol, timeframe: .year1)
        dayBars = (try? await day) ?? []
        yearBars = (try? await year) ?? []
        isLoadingBars = false
    }
}

// MARK: - Stat model & cell (fileprivate — module-local chrome)

fileprivate struct TarsSymbolStat: Identifiable {
    var id: String { title }
    let title: String
    let value: String?
    let isLoading: Bool
    let explanation: String
}

fileprivate struct TarsSymbolStatCell: View {
    let stat: TarsSymbolStat
    @State private var showInfo = false

    var body: some View {
        Button {
            Haptics.tap()
            showInfo = true
        } label: {
            VStack(alignment: .leading, spacing: TarsTheme.Space.s) {
                HStack(spacing: TarsTheme.Space.xs) {
                    Text(stat.title)
                        .font(TarsTheme.Text.caption)
                        .foregroundStyle(TarsTheme.inkSecondary)
                    Image(systemName: "info.circle")
                        .font(TarsTheme.Text.micro)
                        .foregroundStyle(TarsTheme.inkTertiary)
                }
                if stat.isLoading {
                    SkeletonBlock(width: 90, height: 17)
                } else if let value = stat.value {
                    Text(value)
                        .font(TarsTheme.Text.price)
                        .foregroundStyle(TarsTheme.inkPrimary)
                        .lineLimit(1)
                        .minimumScaleFactor(0.7)
                } else {
                    Text("\u{2014}")
                        .font(TarsTheme.Text.price)
                        .foregroundStyle(TarsTheme.inkTertiary)
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(TarsTheme.Space.l)
            .tarsPanel(elevation: 2)
        }
        .buttonStyle(PressableStyle())
        .popover(isPresented: $showInfo, arrowEdge: .bottom) {
            VStack(alignment: .leading, spacing: TarsTheme.Space.s) {
                Text(stat.title)
                    .font(TarsTheme.Text.heading)
                    .foregroundStyle(TarsTheme.inkPrimary)
                Text(stat.explanation)
                    .font(TarsTheme.Text.body)
                    .foregroundStyle(TarsTheme.inkSecondary)
                    .fixedSize(horizontal: false, vertical: true)
            }
            .padding(TarsTheme.Space.l)
            .frame(idealWidth: 320, maxWidth: 340)
            .presentationBackground(TarsTheme.bg2)
            .presentationCompactAdaptation(.popover)
        }
        .accessibilityLabel("\(stat.title): \(stat.value ?? "not available")")
        .accessibilityHint("Explains what this stat means.")
    }
}

// MARK: - Learn chips (fileprivate)

fileprivate struct TarsLearnChip: Identifiable {
    var id: String { title }
    let title: String
    let systemImage: String

    static let all: [TarsLearnChip] = [
        .init(title: "What moves a stock?", systemImage: "waveform.path.ecg"),
        .init(title: "Reading candles", systemImage: "chart.bar.xaxis"),
        .init(title: "Order types", systemImage: "list.bullet.rectangle"),
    ]
}

fileprivate struct TarsLearnChipView: View {
    let chip: TarsLearnChip
    @State private var showPreview = false

    var body: some View {
        Button {
            Haptics.tap()
            showPreview = true
        } label: {
            HStack(spacing: TarsTheme.Space.s) {
                Image(systemName: chip.systemImage)
                    .font(TarsTheme.Text.caption)
                    .foregroundStyle(TarsTheme.accent)
                Text(chip.title)
                    .font(TarsTheme.Text.caption)
                    .foregroundStyle(TarsTheme.inkPrimary)
            }
            .padding(.horizontal, TarsTheme.Space.l)
            .padding(.vertical, TarsTheme.Space.s)
            .background(
                Capsule(style: .continuous)
                    .fill(TarsTheme.bg3)
                    .overlay(Capsule(style: .continuous).strokeBorder(TarsTheme.hairline, lineWidth: 1))
            )
        }
        .buttonStyle(PressableStyle())
        .popover(isPresented: $showPreview, arrowEdge: .bottom) {
            VStack(alignment: .leading, spacing: TarsTheme.Space.s) {
                Label(chip.title, systemImage: chip.systemImage)
                    .font(TarsTheme.Text.heading)
                    .foregroundStyle(TarsTheme.inkPrimary)
                Text("The Academy lesson \u{201C}\(chip.title)\u{201D} opens right here — a short, hands-on explainer from Tars. It's on the way.")
                    .font(TarsTheme.Text.body)
                    .foregroundStyle(TarsTheme.inkSecondary)
                    .fixedSize(horizontal: false, vertical: true)
            }
            .padding(TarsTheme.Space.l)
            .frame(idealWidth: 300, maxWidth: 320)
            .presentationBackground(TarsTheme.bg2)
            .presentationCompactAdaptation(.popover)
        }
        .accessibilityLabel("Academy lesson: \(chip.title)")
        .accessibilityHint("Opens a preview.")
    }
}
