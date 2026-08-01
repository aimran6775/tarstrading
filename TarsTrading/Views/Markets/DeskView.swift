import SwiftUI

/*
  The Desk — your money, as the platform states it.

  The equity number at the top is the SERVER's, from the last bootstrap;
  buying power and margin used come from the same accountRisk() the web's
  Margin Desk renders, so no two screens anywhere can disagree about a
  dollar. Positions mark against the live quote poll for display; orders
  are the record, each with its status and — when rejected — the exchange's
  own sentence, shown whole.
*/
struct DeskView: View {
    @Environment(SessionStore.self) private var session
    @State private var model = DeskModel()
    @Environment(\.scenePhase) private var scenePhase
    @State private var pushed: String?
    @State private var deskRoute: DeskRoute?
    enum DeskRoute: String, Identifiable { case margin, risk, journal; var id: String { rawValue } }

    var body: some View {
        ScrollView {
            LazyVStack(spacing: TarsTheme.Space.l) {
                equityHero
                deskLinks
                positionsCard
                ordersCard
            }
            .padding(TarsTheme.Space.l)
            // Clear the floating tab bar — the last card must be readable.
            .padding(.bottom, 72)
        }
        .background(TarsTheme.bg0)
        .navigationTitle("Desk")
        .navigationDestination(item: $pushed) { MarketSymbolView(symbol: $0) }
        .navigationDestination(item: $deskRoute) { route in
            switch route {
            case .margin: MarginDeskView()
            case .risk: RiskDeskView()
            case .journal: DeskJournalView()
            }
        }
        .refreshable {
            await session.refresh()
            await model.load(positions: session.positions)
        }
        .task {
            model.activate(positions: session.positions)
            #if DEBUG
            // Headless drives: -TarsOpenDesk margin|risk|journal
            if deskRoute == nil,
               let r = UserDefaults.standard.string(forKey: "TarsOpenDesk"),
               let route = DeskRoute(rawValue: r) {
                try? await Task.sleep(for: .seconds(1))
                deskRoute = route
            }
            #endif
        }
        .onDisappear { model.deactivate() }
        .onChange(of: scenePhase) { _, p in
            if p == .active { model.activate(positions: session.positions) }
            else { model.deactivate() }
        }
        .onChange(of: session.positions) { _, next in
            model.watch(positions: next)
        }
    }

    /// The machinery behind the number: how it's margined, what it risks,
    /// what it has already taught you.
    private var deskLinks: some View {
        HStack(spacing: TarsTheme.Space.m) {
            deskLink("Margin", "scalemass.fill", .margin)
            deskLink("Risk", "waveform.path.ecg", .risk)
            deskLink("Journal", "book.closed.fill", .journal)
        }
    }

    private func deskLink(_ label: String, _ icon: String, _ route: DeskRoute) -> some View {
        Button { Haptics.tap(); deskRoute = route } label: {
            VStack(spacing: 6) {
                Image(systemName: icon)
                    .font(.system(size: 17, weight: .medium))
                    .foregroundStyle(TarsTheme.paperBadge)
                Text(label)
                    .font(TarsTheme.Text.caption.weight(.medium))
                    .foregroundStyle(TarsTheme.inkPrimary)
            }
            .frame(maxWidth: .infinity, minHeight: 68)
            .background(TarsTheme.bg2)
            .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
            .overlay(RoundedRectangle(cornerRadius: 14, style: .continuous)
                .strokeBorder(TarsTheme.hairline, lineWidth: 1))
        }
        .buttonStyle(.plain)
    }

    // MARK: - Equity: the number big enough to feel

    private var equityHero: some View {
        VStack(alignment: .leading, spacing: TarsTheme.Space.m) {
            if let risk = session.risk {
                Text(risk.equity, format: .currency(code: "USD").precision(.fractionLength(2)))
                    .font(TarsTheme.Text.display)
                    .foregroundStyle(TarsTheme.inkPrimary)
                    .minimumScaleFactor(0.6)
                    .lineLimit(1)
                    .contentTransition(.numericText())
                HStack(spacing: TarsTheme.Space.l) {
                    stat("Cash", risk.cash, tone: risk.cash < 0 ? TarsTheme.loss : nil)
                    stat("Buying power", risk.buyingPower)
                    VStack(alignment: .leading, spacing: 2) {
                        Text("MARGIN USED").font(TarsTheme.Text.micro)
                            .foregroundStyle(TarsTheme.inkQuaternary)
                        Text("\(risk.marginUsedPct * 100, specifier: "%.0f")%")
                            .font(TarsTheme.Text.caption.monospacedDigit().weight(.semibold))
                            .foregroundStyle(risk.marginUsedPct > 0.8 ? TarsTheme.loss
                                : risk.marginUsedPct > 0.5 ? TarsTheme.warning : TarsTheme.inkPrimary)
                    }
                }
            } else {
                RoundedRectangle(cornerRadius: 8).fill(TarsTheme.bg3).frame(height: 56)
            }
            if let sync = session.lastSyncAt {
                Text("Server-stated · synced \(sync.formatted(date: .omitted, time: .shortened))")
                    .font(TarsTheme.Text.micro)
                    .foregroundStyle(TarsTheme.inkQuaternary)
            }
        }
        .padding(TarsTheme.Space.l)
        .frame(maxWidth: .infinity, alignment: .leading)
        .tarsPanel()
        .accessibilityElement(children: .combine)
    }

    private func stat(_ label: String, _ value: Double, tone: Color? = nil) -> some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(label.uppercased()).font(TarsTheme.Text.micro)
                .foregroundStyle(TarsTheme.inkQuaternary)
            Text(value, format: .currency(code: "USD").precision(.fractionLength(0)))
                .font(TarsTheme.Text.caption.monospacedDigit().weight(.semibold))
                .foregroundStyle(tone ?? TarsTheme.inkPrimary)
        }
    }

    // MARK: - Positions

    private var positionsCard: some View {
        VStack(alignment: .leading, spacing: 0) {
            cardTitle("Positions")
            if session.positions.isEmpty {
                Text("No positions. Pick a market, size it modestly, hold the gold button.")
                    .font(TarsTheme.Text.caption)
                    .foregroundStyle(TarsTheme.inkTertiary)
                    .padding(TarsTheme.Space.l)
            } else {
                ForEach(session.positions) { p in
                    Button { pushed = p.symbol } label: { positionRow(p) }
                        .buttonStyle(.plain)
                    Divider().overlay(TarsTheme.hairline)
                }
            }
        }
        .tarsPanel()
    }

    private func positionRow(_ p: APIPosition) -> some View {
        let px = model.quotes[p.symbol]?.price
        let value = px.map { $0 * p.qty }
        let pnl = px.map { ($0 - p.avgEntryPrice) * p.qty }
        return HStack {
            VStack(alignment: .leading, spacing: 2) {
                HStack(spacing: 6) {
                    Text(SymbolDisplay.pretty(p.symbol))
                        .font(TarsTheme.Text.body.weight(.semibold))
                        .foregroundStyle(TarsTheme.inkPrimary)
                    if p.qty < 0 {
                        Text("SHORT")
                            .font(.system(size: 9, weight: .bold, design: .monospaced))
                            .foregroundStyle(TarsTheme.loss)
                    }
                }
                Text("\(p.qty > 0 ? "+" : "")\(p.qty.formatted()) @ \(SymbolDisplay.price(p.symbol, p.avgEntryPrice))")
                    .font(TarsTheme.Text.micro.monospacedDigit())
                    .foregroundStyle(TarsTheme.inkTertiary)
            }
            Spacer()
            VStack(alignment: .trailing, spacing: 2) {
                if let value {
                    Text(value, format: .currency(code: "USD"))
                        .font(TarsTheme.Text.body.monospacedDigit())
                        .foregroundStyle(TarsTheme.inkPrimary)
                }
                if let pnl {
                    Text("\(pnl >= 0 ? "+" : "")\(pnl, format: .currency(code: "USD"))")
                        .font(TarsTheme.Text.caption.monospacedDigit())
                        .foregroundStyle(pnl > 0 ? TarsTheme.gain : pnl < 0 ? TarsTheme.loss : TarsTheme.inkTertiary)
                }
            }
        }
        .padding(TarsTheme.Space.l)
        .frame(minHeight: 56)
        .contentShape(Rectangle())
        .accessibilityElement(children: .combine)
    }

    // MARK: - Orders

    private var ordersCard: some View {
        VStack(alignment: .leading, spacing: 0) {
            cardTitle("Orders")
            if model.orders.isEmpty {
                Text(model.loadedOrders
                     ? "Nothing yet. Every order — filled, working, or rejected — lands here."
                     : "Loading…")
                    .font(TarsTheme.Text.caption)
                    .foregroundStyle(TarsTheme.inkTertiary)
                    .padding(TarsTheme.Space.l)
            } else {
                ForEach(model.orders.prefix(20)) { o in
                    orderRow(o)
                    Divider().overlay(TarsTheme.hairline)
                }
            }
        }
        .tarsPanel()
    }

    private func orderRow(_ o: APIOrder) -> some View {
        VStack(alignment: .leading, spacing: 3) {
            HStack {
                Text("\(o.side.capitalized) \(o.qty.formatted()) \(SymbolDisplay.pretty(o.symbol))")
                    .font(TarsTheme.Text.body)
                    .foregroundStyle(TarsTheme.inkPrimary)
                Spacer()
                statusChip(o.status)
            }
            HStack(spacing: TarsTheme.Space.m) {
                if let f = o.filledPrice {
                    Text("at \(SymbolDisplay.price(o.symbol, f))")
                        .font(TarsTheme.Text.micro.monospacedDigit())
                        .foregroundStyle(TarsTheme.inkTertiary)
                }
                Text(Date(timeIntervalSince1970: o.createdAt / 1000),
                     format: .dateTime.month(.abbreviated).day().hour().minute())
                    .font(TarsTheme.Text.micro)
                    .foregroundStyle(TarsTheme.inkQuaternary)
            }
            // The exchange's sentence, whole — its rejections teach.
            if let reason = o.rejectReason, o.status == "rejected" {
                Text(reason)
                    .font(TarsTheme.Text.micro)
                    .foregroundStyle(TarsTheme.loss)
            }
        }
        .padding(TarsTheme.Space.l)
        .accessibilityElement(children: .combine)
    }

    private func statusChip(_ status: String) -> some View {
        let (label, tone): (String, Color) = switch status {
        case "filled": ("FILLED", TarsTheme.gain)
        case "accepted": ("WORKING", TarsTheme.paperBadge)
        case "rejected": ("REJECTED", TarsTheme.loss)
        default: (status.uppercased(), TarsTheme.inkTertiary)
        }
        return Text(label)
            .font(.system(size: 9, weight: .bold, design: .monospaced))
            .kerning(0.6)
            .foregroundStyle(tone)
    }

    private func cardTitle(_ t: String) -> some View {
        Text(t.uppercased())
            .font(TarsTheme.Text.micro)
            .kerning(1.5)
            .foregroundStyle(TarsTheme.inkQuaternary)
            .padding(.horizontal, TarsTheme.Space.l)
            .padding(.top, TarsTheme.Space.l)
            .padding(.bottom, TarsTheme.Space.s)
    }
}

// MARK: - Model: quotes for held symbols + the order record

@Observable @MainActor
final class DeskModel {
    private(set) var quotes: [String: APIQuote] = [:]
    private(set) var orders: [APIOrder] = []
    private(set) var loadedOrders = false

    private var symbols: [String] = []
    private var loop: Task<Void, Never>?
    private let api = TarsAPIClient.shared

    func watch(positions: [APIPosition]) {
        symbols = positions.map(\.symbol)
        Task { await tickQuotes() }
    }

    func activate(positions: [APIPosition]) {
        symbols = positions.map(\.symbol)
        guard loop == nil else { return }
        loop = Task { [weak self] in
            while !Task.isCancelled {
                await self?.load(positions: nil)
                try? await Task.sleep(for: .seconds(20))
            }
        }
    }

    func deactivate() { loop?.cancel(); loop = nil }

    func load(positions: [APIPosition]?) async {
        if let positions { symbols = positions.map(\.symbol) }
        async let q: () = tickQuotes()
        async let o: () = tickOrders()
        _ = await (q, o)
    }

    private func tickQuotes() async {
        guard !symbols.isEmpty else { return }
        for q in (try? await api.quotes(symbols: symbols)) ?? [] { quotes[q.symbol] = q }
    }

    private func tickOrders() async {
        if let fresh = try? await api.orders() { orders = fresh }
        loadedOrders = true
    }
}
