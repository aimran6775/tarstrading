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
    @State private var heroDocked = false
    /// Set by the scroll reader so the docked number can fly you home.
    @State private var scrollTop: (() -> Void)?
    @Environment(\.dynamicTypeSize) private var typeSize
    enum DeskRoute: String, Identifiable {
        case margin, risk, journal, alerts, notifications, floor
        var id: String { rawValue }
    }

    var body: some View {
        VStack(spacing: 0) {
        // The header is PINNED — it cannot scroll away, because it is the
        // landing pad for the docked equity number.
        header
            .padding(.horizontal, TarsTheme.Space.l)
            .background(TarsTheme.bg0)
            .overlay(alignment: .bottom) {
                if heroDocked { Divider().overlay(TarsTheme.hairline) }
            }
        ScrollViewReader { proxy in
        ScrollView {
            VStack(spacing: 0) {
            Color.clear.frame(height: 0).id("top")
            /*
              The dock sentinel lives OUTSIDE the lazy container: a lazy
              stack recycles far-offscreen children, and a recycled
              publisher resets the preference to its default — the docked
              number vanished exactly when it was needed. A zero-height
              plain-VStack child is never recycled.
            */
            GeometryReader { g in
                Color.clear.preference(key: HeroOffsetKey.self,
                                       value: g.frame(in: .named("deskScroll")).minY)
            }
            .frame(height: 0)
            LazyVStack(alignment: .leading, spacing: TarsTheme.Space.l) {
                equityHero
                syncLine
                deskLinks
                positionsCard
                ordersCard
            }
            .padding(TarsTheme.Space.l)
            // Clear the floating tab bar — the last card must be readable.
            .padding(.bottom, 72)
            }
        }
        .onAppear {
            scrollTop = { proxy.scrollTo("top", anchor: .top) }
        }
        }
        .coordinateSpace(name: "deskScroll")
        .onPreferenceChange(HeroOffsetKey.self) { minY in
            // Scrolled past the hero's height → the big number is gone;
            // its small self reports to the pinned header.
            withAnimation(.snappy) { heroDocked = minY < -120 }
        }
        }
        .background(TarsTheme.bg0)
        // The equity number is the header; a nav bar saying "Desk" above
        // it would just be the same fact, smaller and further away.
        .toolbar(.hidden, for: .navigationBar)
        .navigationDestination(item: $pushed) { MarketSymbolView(symbol: $0) }
        .navigationDestination(item: $deskRoute) { route in
            switch route {
            case .margin: MarginDeskView()
            case .risk: RiskDeskView()
            case .journal: DeskJournalView()
            case .alerts: DeskAlertsView()
            case .notifications: NotificationsView()
            case .floor: AnalystFloorView()
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

    private var header: some View {
        HStack(alignment: .firstTextBaseline) {
            Text("Desk")
                .font(TarsTheme.Text.screenTitle)
                .foregroundStyle(TarsTheme.inkPrimary)
            // The docked hero: scrolled past the big number, it reappears
            // here small — your equity is never off screen (Robinhood's
            // collapse-into-the-bar, without renting Apple's nav bar).
            if heroDocked, let risk = session.risk {
                Button {
                    Haptics.tap()
                    withAnimation(.snappy) { scrollTop?() }
                } label: {
                    Text(risk.equity, format: .currency(code: "USD").precision(.fractionLength(0)))
                        .font(TarsTheme.Text.body.monospacedDigit().weight(.semibold))
                        .foregroundStyle(TarsTheme.inkSecondary)
                }
                .buttonStyle(.plain)
                .transition(.opacity.combined(with: .move(edge: .top)))
                .padding(.leading, TarsTheme.Space.s)
                .accessibilityLabel("Back to top")
            }
            Spacer()
            Button { Haptics.tap(); deskRoute = .notifications } label: {
                ZStack(alignment: .topTrailing) {
                    Image(systemName: "bell")
                        .font(.system(size: 17, weight: .medium))
                        .foregroundStyle(TarsTheme.inkSecondary)
                    if session.unreadNotifications > 0 {
                        Text(session.unreadNotifications > 9 ? "9+" : "\(session.unreadNotifications)")
                            .font(.system(size: 9, weight: .bold))
                            .foregroundStyle(TarsTheme.onFill)
                            .padding(.horizontal, 4).padding(.vertical, 1)
                            .background(Capsule().fill(TarsTheme.accent))
                            .offset(x: 9, y: -6)
                    }
                }
                .frame(width: 44, height: 44)
            }
            .buttonStyle(.plain)
            .accessibilityLabel(session.unreadNotifications > 0
                ? "Notifications, \(session.unreadNotifications) unread" : "Notifications")
        }
        .padding(.top, TarsTheme.Space.s)
    }

    /// The machinery behind the number: how it's margined, what it risks,
    /// what it has already taught you.
    private var deskLinks: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: TarsTheme.Space.m) {
            deskLink("Margin", "scalemass", .margin)
            deskLink("Risk", "waveform.path.ecg", .risk)
            deskLink("Journal", "book.closed", .journal)
            deskLink("Alerts", "bell", .alerts)
            deskLink("Floor", "person.3", .floor)
            deskLink("Alerts feed", "bell.badge", .notifications)
            }
        }
    }

    private func deskLink(_ label: String, _ icon: String, _ route: DeskRoute) -> some View {
        Button { Haptics.tap(); deskRoute = route } label: {
            VStack(spacing: 6) {
                Image(systemName: icon)
                    .font(.system(size: 17, weight: .medium))
                    .foregroundStyle(TarsTheme.inkSecondary)
                Text(label)
                    .font(TarsTheme.Text.caption.weight(.medium))
                    .foregroundStyle(TarsTheme.inkSecondary)
            }
            .frame(width: 96, height: 64)
            .background(TarsTheme.bg1)
            .clipShape(RoundedRectangle(cornerRadius: TarsTheme.Radius.m, style: .continuous))
            .overlay(RoundedRectangle(cornerRadius: TarsTheme.Radius.m, style: .continuous)
                .strokeBorder(TarsTheme.hairline, lineWidth: 1))
        }
        .buttonStyle(.plain)
    }

    // MARK: - Equity: the number big enough to feel

    private var equityHero: some View {
        sceneHero
    }

    /// The web floor's signature, translated: the market-footage loop under
    /// the same scrims, a ghosted EQUITY monument, the count-up number, the
    /// day pill, and the live curve in a scene panel. One place to be bold.
    private var sceneHero: some View {
        ZStack(alignment: .top) {
            SceneVideoBackdrop()
            VStack(spacing: 0) {
                // Masthead: the room's state. (PAPER stays in the chrome —
                // one honesty mark, one place.)
                HStack {
                    Text(session.user.map { "\($0.name)'s fund" } ?? "Your fund")
                        .font(TarsTheme.Text.caption.weight(.semibold))
                        .foregroundStyle(.white.opacity(0.72))
                    Spacer()
                    HStack(spacing: 5) {
                        Circle().fill(TarsTheme.gain).frame(width: 5, height: 5)
                        Text("LIVE BOOK")
                            .font(.system(size: 9, weight: .semibold, design: .monospaced))
                            .kerning(1.0)
                            .foregroundStyle(.white.opacity(0.55))
                            .lineLimit(1)
                    }
                }
                .padding(.horizontal, TarsTheme.Space.l)
                .padding(.top, TarsTheme.Space.l)

                Spacer(minLength: 0)

                // The monument: ghosted EQUITY behind the count-up.
                ZStack {
                    Text("EQUITY")
                        .font(Font.system(size: 76, weight: .black).width(.condensed))
                        .kerning(4)
                        .foregroundStyle(.white.opacity(0.06))
                        .lineLimit(1).minimumScaleFactor(0.5)
                        .accessibilityHidden(true)
                    VStack(spacing: TarsTheme.Space.s) {
                        Text("TOTAL EQUITY")
                            .font(.system(size: 10, weight: .semibold, design: .monospaced))
                            .kerning(2.8)
                            .foregroundStyle(.white.opacity(0.55))
                        if let risk = session.risk {
                            Text(risk.equity, format: .currency(code: "USD").precision(.fractionLength(2)))
                                .font(TarsTheme.Text.display)
                                .foregroundStyle(.white)
                                .lineLimit(1).minimumScaleFactor(0.5)
                                .contentTransition(.numericText())
                                .animation(.snappy, value: risk.equity)
                                .shadow(color: .black.opacity(0.5), radius: 14, y: 2)
                                .shadow(color: TarsTheme.accent.opacity(0.30), radius: 22)
                        }
                        if let day = model.dayPnl {
                            HStack(spacing: 6) {
                                Text(day > 0 ? "▲" : day < 0 ? "▼" : "—")
                                Text("\(day > 0 ? "+" : "")\(day, format: .currency(code: "USD"))")
                                    .contentTransition(.numericText())
                                    .animation(.snappy, value: day)
                                Text("today").foregroundStyle(.white.opacity(0.5))
                            }
                            .font(TarsTheme.Text.caption.monospacedDigit().weight(.medium))
                            .foregroundStyle(day > 0 ? TarsTheme.gain : day < 0 ? TarsTheme.loss : .white.opacity(0.7))
                            .padding(.horizontal, 12).padding(.vertical, 6)
                            .background(Capsule().fill(Color.black.opacity(0.35)))
                            .overlay(Capsule().strokeBorder(
                                (day > 0 ? TarsTheme.gain : day < 0 ? TarsTheme.loss : Color.white)
                                    .opacity(0.30), lineWidth: 1))
                        }
                        if let risk = session.risk {
                            Text("\(risk.cash.formatted(.currency(code: "USD").precision(.fractionLength(0)))) cash · \(risk.buyingPower.formatted(.currency(code: "USD").precision(.fractionLength(0)))) buying power")
                                .font(TarsTheme.Text.micro.monospacedDigit())
                                .foregroundStyle(.white.opacity(0.55))
                        }
                    }
                }
                .padding(.vertical, TarsTheme.Space.l)

                Spacer(minLength: 0)

                // The curve, live, in a scene panel — it draws as you trade.
                VStack(alignment: .leading, spacing: 6) {
                    HStack {
                        Text("EQUITY CURVE")
                            .font(.system(size: 9, weight: .semibold, design: .monospaced))
                            .kerning(1.6)
                            .foregroundStyle(.white.opacity(0.55))
                        Spacer()
                        HStack(spacing: 5) {
                            Circle().fill(TarsTheme.accent).frame(width: 4, height: 4)
                            Text("LIVE")
                                .font(.system(size: 9, weight: .semibold, design: .monospaced))
                                .kerning(1.4)
                                .foregroundStyle(.white.opacity(0.55))
                        }
                    }
                    if model.curve.count > 1 {
                        SparkPath(values: model.curve.map(\.equity), tone: TarsTheme.accent)
                            .frame(height: 32)
                    } else {
                        Text("Your equity curve draws itself as you trade.")
                            .font(TarsTheme.Text.micro)
                            .foregroundStyle(.white.opacity(0.5))
                            .frame(maxWidth: .infinity, minHeight: 44, alignment: .leading)
                    }
                }
                .padding(TarsTheme.Space.m)
                .background(Color.black.opacity(0.30))
                .clipShape(RoundedRectangle(cornerRadius: TarsTheme.Radius.m, style: .continuous))
                .overlay(RoundedRectangle(cornerRadius: TarsTheme.Radius.m, style: .continuous)
                    .strokeBorder(.white.opacity(0.10), lineWidth: 1))
                .padding(.horizontal, TarsTheme.Space.l)
                .padding(.bottom, TarsTheme.Space.l)
            }
        }
        // The scene is the room's mood, not the whole room — capped so
        // positions (the reason you opened this tab) clear the fold.
        .frame(height: 300)
        .clipShape(RoundedRectangle(cornerRadius: TarsTheme.Radius.l, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: TarsTheme.Radius.l, style: .continuous)
            .strokeBorder(TarsTheme.hairline, lineWidth: 1))
        .accessibilityElement(children: .combine)
        .accessibilityLabel(session.risk.map {
            "Total equity \($0.equity.formatted(.currency(code: "USD")))"
        } ?? "Total equity loading")
    }

    /// The honesty stamp rides under the scene — server-stated, timestamped.
    @ViewBuilder private var syncLine: some View {
        if let sync = session.lastSyncAt {
            HStack(spacing: TarsTheme.Space.m) {
                Text("Server-stated · synced \(sync.formatted(date: .omitted, time: .shortened))")
                if let risk = session.risk, risk.marginUsedPct > 0 {
                    Text("· margin \(risk.marginUsedPct * 100, specifier: "%.0f")% used")
                        .foregroundStyle(risk.marginUsedPct > 0.8 ? TarsTheme.loss
                            : risk.marginUsedPct > 0.5 ? TarsTheme.warning : TarsTheme.inkQuaternary)
                }
            }
            .font(TarsTheme.Text.micro)
            .foregroundStyle(TarsTheme.inkTertiary)
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
                    .padding(.vertical, TarsTheme.Space.m)
            } else {
                ForEach(session.positions) { p in
                    Button { pushed = p.symbol } label: { positionRow(p) }
                        .buttonStyle(.plain)
                    Divider().overlay(TarsTheme.hairline)
                }
            }
        }
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
                        .contentTransition(.numericText())
                        .animation(.snappy, value: value)
                }
                if let pnl {
                    HStack(spacing: 5) {
                        Text("\(pnl >= 0 ? "+" : "")\(pnl, format: .currency(code: "USD"))")
                            .contentTransition(.numericText())
                            .animation(.snappy, value: pnl)
                        // Against cost, not against yesterday — this is the
                        // return on YOUR entry, which is what you feel.
                        if p.avgEntryPrice > 0, let px {
                            let ret = (px / p.avgEntryPrice - 1) * (p.qty < 0 ? -1 : 1)
                            Text("(\(ret > 0 ? "+" : "")\(ret * 100, specifier: "%.2f")%)")
                                .foregroundStyle(TarsTheme.inkTertiary)
                        }
                    }
                    .font(TarsTheme.Text.caption.monospacedDigit())
                    .foregroundStyle(pnl > 0 ? TarsTheme.gain : pnl < 0 ? TarsTheme.loss : TarsTheme.inkTertiary)
                }
            }
        }
        .padding(.vertical, TarsTheme.Space.m)
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
                    .padding(.vertical, TarsTheme.Space.m)
            } else {
                ForEach(model.orders.prefix(20)) { o in
                    orderRow(o)
                    Divider().overlay(TarsTheme.hairline)
                }
            }
        }
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
                Text(o.filledPrice.map { "at \(SymbolDisplay.price(o.symbol, $0))" } ?? "never filled")
                    .font(TarsTheme.Text.micro.monospacedDigit())
                    .foregroundStyle(o.filledPrice == nil ? TarsTheme.inkQuaternary : TarsTheme.inkTertiary)
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
        .padding(.vertical, TarsTheme.Space.m)
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
            .padding(.top, TarsTheme.Space.m)
            .padding(.bottom, TarsTheme.Space.s)
    }
}

// MARK: - Model: quotes for held symbols + the order record

@Observable @MainActor
final class DeskModel {
    private(set) var quotes: [String: APIQuote] = [:]
    private(set) var orders: [APIOrder] = []
    private(set) var loadedOrders = false
    /// The equity curve, server-stated — the same series the web floor draws.
    private(set) var curve: [EquityPoint] = []

    /// Day P&L from the curve: latest equity minus the last print BEFORE
    /// today (New York's today — the desk's clock, not the phone's).
    var dayPnl: Double? {
        guard let last = curve.last else { return nil }
        var cal = Calendar(identifier: .gregorian)
        cal.timeZone = TimeZone(identifier: "America/New_York") ?? .current
        let startOfToday = cal.startOfDay(for: Date())
        let anchor = curve.last(where: {
            Date(timeIntervalSince1970: $0.time / 1000) < startOfToday
        }) ?? curve.first
        guard let anchor, anchor.time != last.time else { return 0 }
        return last.equity - anchor.equity
    }

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
        async let c: () = tickCurve()
        _ = await (q, o, c)
    }

    private func tickCurve() async {
        if let fresh = try? await api.portfolioHistory(), !fresh.isEmpty { curve = fresh }
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

/// Tracks the hero's bottom edge in the desk scroll space.
private struct HeroOffsetKey: PreferenceKey {
    static var defaultValue: CGFloat = .greatestFiniteMagnitude
    static func reduce(value: inout CGFloat, nextValue: () -> CGFloat) {
        value = min(value, nextValue())
    }
}
