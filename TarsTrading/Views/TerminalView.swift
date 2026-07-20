import SwiftUI

/// The trading workspace. Act I ships it as account header + watchlist;
/// Act II grows it into the full multi-panel terminal.
struct TerminalView: View {
    @Environment(TradingStore.self) private var store

    var body: some View {
        ScrollView {
            VStack(spacing: TarsTheme.Space.l) {
                AccountHeader()
                WatchlistPanel()
            }
            .padding(TarsTheme.Space.l)
        }
        .background(TarsTheme.bg0)
    }
}

struct AccountHeader: View {
    @Environment(TradingStore.self) private var store

    var body: some View {
        VStack(alignment: .leading, spacing: TarsTheme.Space.s) {
            Text("Equity")
                .font(TarsTheme.Text.caption)
                .foregroundStyle(TarsTheme.inkTertiary)
            if store.isBootstrapping {
                SkeletonBlock(width: 220, height: 40)
            } else {
                TickerText(value: store.account.equity, font: TarsTheme.Text.priceHero)
                HStack(spacing: TarsTheme.Space.m) {
                    TickerText(value: store.account.dayPnL, font: TarsTheme.Text.price)
                    PercentText(value: store.account.dayPnLPercent, font: TarsTheme.Text.price)
                    Text("today")
                        .font(TarsTheme.Text.caption)
                        .foregroundStyle(TarsTheme.inkTertiary)
                    Spacer()
                    VStack(alignment: .trailing, spacing: 2) {
                        Text("Buying power")
                            .font(TarsTheme.Text.micro)
                            .foregroundStyle(TarsTheme.inkTertiary)
                        Text(store.account.buyingPower, format: .currency(code: "USD"))
                            .font(TarsTheme.Text.priceSmall)
                            .foregroundStyle(TarsTheme.inkSecondary)
                            .lineLimit(1)
                            .minimumScaleFactor(0.6)
                    }
                }
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(TarsTheme.Space.l)
        .tarsPanel()
        .accessibilityElement(children: .combine)
    }
}

struct WatchlistPanel: View {
    @Environment(TradingStore.self) private var store

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            HStack {
                Text("Watchlist")
                    .font(TarsTheme.Text.heading)
                    .foregroundStyle(TarsTheme.inkPrimary)
                Spacer()
            }
            .padding(TarsTheme.Space.l)

            if store.isBootstrapping {
                VStack(spacing: TarsTheme.Space.m) {
                    ForEach(0..<5, id: \.self) { _ in
                        HStack {
                            SkeletonBlock(width: 80)
                            Spacer()
                            SkeletonBlock(width: 100)
                        }
                    }
                }
                .padding(.horizontal, TarsTheme.Space.l)
                .padding(.bottom, TarsTheme.Space.l)
            } else if store.watchlist.isEmpty {
                VStack(spacing: TarsTheme.Space.s) {
                    Image(systemName: "chart.line.uptrend.xyaxis")
                        .font(TarsTheme.Text.title)
                        .foregroundStyle(TarsTheme.inkTertiary)
                    Text("Nothing on watch")
                        .font(TarsTheme.Text.body)
                        .foregroundStyle(TarsTheme.inkSecondary)
                    Text("Symbols you add to your watchlist appear here.")
                        .font(TarsTheme.Text.caption)
                        .foregroundStyle(TarsTheme.inkTertiary)
                        .multilineTextAlignment(.center)
                }
                .frame(maxWidth: .infinity)
                .padding(TarsTheme.Space.xl)
                .accessibilityElement(children: .combine)
            } else {
                ForEach(store.watchlist, id: \.self) { symbol in
                    WatchlistRow(symbol: symbol)
                    if symbol != store.watchlist.last {
                        Divider().overlay(TarsTheme.hairline).padding(.leading, TarsTheme.Space.l)
                    }
                }
            }
        }
        .tarsPanel()
    }
}

struct WatchlistRow: View {
    @Environment(TradingStore.self) private var store
    let symbol: String

    // Fixed-width trailing columns so every row's price and percent land on
    // the same vertical grid — tabular, terminal-grade. One uniform font for
    // the numeric columns; scale-to-fit only ever happens inside the fixed
    // frame as a last resort (TickerText's built-in floor).
    fileprivate static let priceColumnWidth: CGFloat = 96
    fileprivate static let percentColumnWidth: CGFloat = 64

    var body: some View {
        let quote = store.quote(for: symbol)
        HStack(spacing: TarsTheme.Space.m) {
            VStack(alignment: .leading, spacing: 2) {
                Text(symbol)
                    .font(TarsTheme.Text.price)
                    .foregroundStyle(TarsTheme.inkPrimary)
                    .lineLimit(1)
                    .truncationMode(.tail)
                if let quote, quote.age > 300 {
                    // Honest-data rule: show staleness, never fake liveness.
                    Text("as of \(quote.asOf, format: .relative(presentation: .named))")
                        .font(TarsTheme.Text.micro)
                        .foregroundStyle(TarsTheme.inkTertiary)
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            if let quote {
                TickerText(value: quote.price,
                           format: .currency(code: "USD").precision(.fractionLength(2)),
                           font: TarsTheme.Text.priceSmall)
                    .frame(width: Self.priceColumnWidth, alignment: .trailing)
                PercentText(value: quote.changePercent, font: TarsTheme.Text.priceSmall)
                    .frame(width: Self.percentColumnWidth, alignment: .trailing)
            } else {
                SkeletonBlock(width: 90)
                    .frame(width: Self.priceColumnWidth + TarsTheme.Space.m + Self.percentColumnWidth,
                           alignment: .trailing)
            }
        }
        .padding(.horizontal, TarsTheme.Space.l)
        .padding(.vertical, TarsTheme.Space.m)
        .contentShape(Rectangle())
        .contextMenu {
            Button(role: .destructive) {
                store.removeFromWatchlist(symbol)
            } label: {
                Label("Remove from watchlist", systemImage: "minus.circle")
            }
        }
        .accessibilityElement(children: .combine)
        .accessibilityAction(named: "Remove from watchlist") {
            store.removeFromWatchlist(symbol)
        }
    }
}
