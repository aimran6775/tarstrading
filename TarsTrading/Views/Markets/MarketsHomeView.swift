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
    @State private var model = MarketsModel()
    @Environment(\.scenePhase) private var scenePhase

    var body: some View {
        ScrollView {
            LazyVStack(spacing: TarsTheme.Space.l, pinnedViews: []) {
                if model.stale { staleBanner }
                pulseStrip
                venueRail
                boardList
            }
            .padding(.horizontal, TarsTheme.Space.l)
            .padding(.bottom, TarsTheme.Space.xl)
        }
        .background(TarsTheme.bg0)
        .navigationTitle("Markets")
        .refreshable { await model.refresh() }
        .task { model.activate() }
        .onDisappear { model.deactivate() }
        .onChange(of: scenePhase) { _, phase in
            // A hidden app polls nothing; a returning one reads immediately.
            if phase == .active { model.activate() } else { model.deactivate() }
        }
    }

    // MARK: - The pulse: four index proxies, the room's weather

    private var pulseStrip: some View {
        HStack(spacing: TarsTheme.Space.m) {
            ForEach(["SPY", "QQQ", "DIA", "IWM"], id: \.self) { sym in
                let row = model.row(sym)
                VStack(alignment: .leading, spacing: 3) {
                    Text(sym)
                        .font(TarsTheme.Text.micro)
                        .foregroundStyle(TarsTheme.inkTertiary)
                    if let price = row?.price {
                        Text(price, format: .currency(code: "USD").precision(.fractionLength(0)))
                            .font(TarsTheme.Text.caption.monospacedDigit().weight(.semibold))
                            .foregroundStyle(TarsTheme.inkPrimary)
                        ChangeText(row?.changePercent)
                    } else {
                        Text("—").font(TarsTheme.Text.caption)
                            .foregroundStyle(TarsTheme.inkQuaternary)
                    }
                }
                .frame(maxWidth: .infinity, alignment: .leading)
            }
        }
        .padding(TarsTheme.Space.l)
        .tarsPanel()
        .accessibilityElement(children: .combine)
        .accessibilityLabel("Market pulse")
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
            Text(label)
                .font(TarsTheme.Text.caption.weight(.medium))
                .foregroundStyle(selected ? TarsTheme.paperBadge : TarsTheme.inkSecondary)
                .padding(.horizontal, 14)
                .frame(minHeight: 38)
                .background(selected ? TarsTheme.paperBadge.opacity(0.14) : TarsTheme.bg2)
                .clipShape(Capsule())
                .overlay(Capsule().strokeBorder(
                    selected ? TarsTheme.paperBadge.opacity(0.45) : TarsTheme.hairline, lineWidth: 1))
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
                ForEach(model.rows) { row in
                    boardRow(row)
                    Divider().overlay(TarsTheme.hairline)
                }
            }
        }
        .tarsPanel()
    }

    private func boardRow(_ row: BoardRowPayload) -> some View {
        HStack(spacing: TarsTheme.Space.m) {
            VStack(alignment: .leading, spacing: 2) {
                Text(SymbolDisplay.pretty(row.symbol))
                    .font(TarsTheme.Text.body.weight(.semibold))
                    .foregroundStyle(TarsTheme.inkPrimary)
                if let source = row.source {
                    ProvenanceChip(source)
                }
            }
            Spacer()
            VStack(alignment: .trailing, spacing: 2) {
                if let price = row.price {
                    Text(SymbolDisplay.price(row.symbol, price))
                        .font(TarsTheme.Text.body.monospacedDigit())
                        .foregroundStyle(TarsTheme.inkPrimary)
                }
                ChangeText(row.changePercent)
            }
        }
        .padding(.horizontal, TarsTheme.Space.l)
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
        .padding(TarsTheme.Space.l)
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
        } else {
            Text("· ·").font(TarsTheme.Text.caption).foregroundStyle(TarsTheme.inkQuaternary)
        }
    }
}

/// The honesty chip: where this price came from, always visible.
private struct ProvenanceChip: View {
    let source: Provenance
    init(_ source: Provenance) { self.source = source }
    private var label: String {
        switch source {
        case .live: "LIVE"
        case .delayed: "DELAYED 15M"
        case .eod: "EOD"
        case .derived: "DERIVED"
        case .indicative: "INDICATIVE"
        case .unknown: "—"
        }
    }
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

    private(set) var rows: [BoardRowPayload] = []
    private(set) var venue: String?
    private(set) var loading = true
    private(set) var stale = false

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
            stale = false
        } catch {
            stale = true // last-good stands; the banner tells the truth
        }
        loading = false
    }
}
