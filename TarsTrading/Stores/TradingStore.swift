import SwiftUI

/// Single source of truth for market + brokerage state. Views read this;
/// mutations flow through its methods (optimistic UI, reconciled on refresh).
@Observable
final class TradingStore {
    // MARK: State
    var account: Account = .empty
    var positions: [Position] = []
    var openOrders: [Order] = []
    var orderHistory: [Order] = []
    var quotes: [String: Quote] = [:]
    var watchlist: [String] = []
    var journal: [JournalEntry] = []
    var equityHistory: [EquityPoint] = []
    var isBootstrapping = true
    var lastError: TarsError?
    /// Journal capture prompt shown right after a position-closing fill.
    var pendingThesisCapture: JournalEntry?

    let mode: TradingMode
    let broker: TradingProviding
    let marketData: MarketProviding

    struct EquityPoint: Identifiable, Codable, Equatable {
        var id: Date { time }
        let time: Date
        let equity: Double
    }

    @ObservationIgnored private var heartbeat: Task<Void, Never>?
    @ObservationIgnored private let persistence = Persistence()

    init() {
        if AppConfig.hasLiveKeys {
            mode = .paper
            broker = AlpacaClient()
            marketData = AppConfig.hasMarketDataKey ? MarketDataClient() : DemoMarket.shared
        } else {
            mode = .demo
            broker = DemoBroker.shared
            marketData = DemoMarket.shared
        }
    }

    // MARK: - Lifecycle

    func bootstrap() async {
        watchlist = persistence.load([String].self, "watchlist")
            ?? ["AAPL", "NVDA", "TSLA", "SPY", "BTC/USD", "ETH/USD"]
        journal = persistence.load([JournalEntry].self, "journal") ?? []
        equityHistory = persistence.load([EquityPoint].self, "equityHistory") ?? []
        await refreshAll()
        isBootstrapping = false
        startHeartbeat()
    }

    private func startHeartbeat() {
        heartbeat?.cancel()
        let demo = mode == .demo
        heartbeat = Task { [weak self] in
            var beat = 0
            while !Task.isCancelled {
                guard let self else { return }
                self.rollDayIfNeeded()
                if demo {
                    DemoMarket.shared.tick()
                    DemoBroker.shared.processOpenOrders()
                    await self.refreshQuotes()
                    if beat % 5 == 0 { await self.refreshAccountAndPositions() }
                } else {
                    // Live paper: Massive free tier is 5 req/min — quotes are
                    // cached; refresh cadence stays respectful.
                    if beat % 30 == 0 { await self.refreshAll() }
                }
                if beat % 60 == 0 { self.recordEquityPoint() }
                beat += 1
                try? await Task.sleep(for: .seconds(1))
            }
        }
    }

    /// Day P&L integrity: at the first heartbeat of a new ET trading day the
    /// demo broker rolls "previous close" forward. Without this, "today"
    /// slowly becomes fiction.
    private func rollDayIfNeeded() {
        let stamp = MarketClock.dayStamp()
        let key = "lastDayRollStamp"
        guard UserDefaults.standard.string(forKey: key) != stamp else { return }
        UserDefaults.standard.set(stamp, forKey: key)
        if mode == .demo { DemoBroker.shared.rollDay() }
    }

    // MARK: - Refresh

    func refreshAll() async {
        await refreshQuotes()
        await refreshAccountAndPositions()
        await refreshOrders()
    }

    func refreshQuotes() async {
        let symbols = Set(watchlist + positions.map(\.symbol))
        guard !symbols.isEmpty else { return }
        do {
            let fresh = try await marketData.quotes(for: Array(symbols))
            for q in fresh {
                // Materiality filter: skip sub-basis-point moves so hundreds
                // of observers aren't invalidated by noise every second.
                if let old = quotes[q.symbol],
                   old.price != 0,
                   abs(q.price - old.price) / old.price < 0.0001,
                   q.previousClose == old.previousClose {
                    continue
                }
                quotes[q.symbol] = q
            }
        } catch let error as TarsError {
            lastError = error
        } catch { lastError = .network(error.localizedDescription) }
    }

    func refreshAccountAndPositions() async {
        do {
            account = try await broker.account()
            positions = try await broker.positions()
        } catch let error as TarsError {
            lastError = error
        } catch { lastError = .network(error.localizedDescription) }
    }

    func refreshOrders() async {
        do {
            let open = try await broker.orders(open: true)
            let all = try await broker.orders(open: false)
            detectFills(previousOpen: openOrders, nowOpen: open, all: all)
            openOrders = open
            orderHistory = all
        } catch { /* non-fatal; next beat retries */ }
    }

    private func recordEquityPoint() {
        guard account.equity > 0 else { return }
        equityHistory.append(EquityPoint(time: .now, equity: account.equity))
        if equityHistory.count > 5_000 { equityHistory.removeFirst(equityHistory.count - 5_000) }
        persistence.save(equityHistory, "equityHistory")
    }

    // MARK: - Trading actions

    @discardableResult
    func submit(_ draft: OrderDraft) async throws -> Order {
        let order = try await broker.submit(draft)
        openOrders.insert(order, at: 0)
        if order.status == .filled { handleFill(order) }
        Haptics.confirm()
        await refreshAccountAndPositions()
        return order
    }

    func cancel(_ order: Order) async {
        do {
            try await broker.cancel(orderID: order.id)
            openOrders.removeAll { $0.id == order.id }
        } catch let error as TarsError { lastError = error }
        catch { lastError = .network(error.localizedDescription) }
    }

    func closePosition(_ position: Position) async {
        do {
            let order = try await broker.closePosition(symbol: position.symbol)
            if order.status == .filled { handleFill(order, closing: position) }
            await refreshAccountAndPositions()
        } catch let error as TarsError { lastError = error }
        catch { lastError = .network(error.localizedDescription) }
    }

    // MARK: - Journal (auto-capture on fills)

    private func detectFills(previousOpen: [Order], nowOpen: [Order], all: [Order]) {
        let stillOpen = Set(nowOpen.map(\.id))
        for was in previousOpen where !stillOpen.contains(was.id) {
            if let done = all.first(where: { $0.id == was.id }), done.status == .filled {
                handleFill(done)
            }
        }
    }

    /// When to interrupt with the thesis-capture sheet. Modal on every fill
    /// gets old by trade five; closes are where the lesson lives.
    enum ThesisPromptMode: String, CaseIterable, Identifiable {
        case always = "Every fill"
        case closesOnly = "Closes only"
        case never = "Never"
        var id: String { rawValue }
        static var current: ThesisPromptMode {
            ThesisPromptMode(rawValue: UserDefaults.standard.string(forKey: "thesisPromptMode") ?? "")
                ?? .closesOnly
        }
    }

    private func handleFill(_ order: Order, closing: Position? = nil) {
        // Haptic law: fills answer the user's own orders. Agent fills are
        // incoming data — they log and glow, but never buzz the wrist.
        if order.agentID == nil { Haptics.fill() }
        let price = order.filledAvgPrice ?? 0
        let promptMode = ThesisPromptMode.current
        if let closing {
            var entry = JournalEntry(symbol: order.symbol, side: closing.side,
                                     qty: abs(closing.qty), entryPrice: closing.avgEntryPrice,
                                     exitPrice: price, openedAt: .now, closedAt: .now,
                                     agentID: order.agentID)
            entry.thesis = order.agentRationale ?? ""
            journal.insert(entry, at: 0)
            if order.agentID == nil, promptMode != .never { pendingThesisCapture = entry }
        } else {
            let entry = JournalEntry(symbol: order.symbol, side: order.side,
                                     qty: order.qty, entryPrice: price, exitPrice: nil,
                                     openedAt: order.filledAt ?? .now, closedAt: nil,
                                     thesis: order.agentRationale ?? "", agentID: order.agentID)
            journal.insert(entry, at: 0)
            if order.agentID == nil, promptMode == .always { pendingThesisCapture = entry }
        }
        persistence.save(journal, "journal")
    }

    func updateJournal(_ entry: JournalEntry) {
        if let i = journal.firstIndex(where: { $0.id == entry.id }) {
            journal[i] = entry
            persistence.save(journal, "journal")
        }
    }

    // MARK: - Watchlist

    func addToWatchlist(_ symbol: String) {
        guard !watchlist.contains(symbol) else { return }
        withAnimation(Motion.spatial) { watchlist.append(symbol) }
        persistence.save(watchlist, "watchlist")
        Task { await refreshQuotes() }
    }

    func removeFromWatchlist(_ symbol: String) {
        withAnimation(Motion.spatial) { watchlist.removeAll { $0 == symbol } }
        persistence.save(watchlist, "watchlist")
    }

    func quote(for symbol: String) -> Quote? { quotes[symbol] }
}

// MARK: - Disk persistence (JSON in Application Support)
// Writes are debounced per key and encoded off the main thread — a burst of
// journal events costs one disk write, not ten synchronous ones.

struct Persistence {
    static let directory: URL = {
        let base = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0]
        let dir = base.appending(path: "TarsTrading", directoryHint: .isDirectory)
        try? FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
        return dir
    }()

    func save<T: Encodable & Sendable>(_ value: T, _ key: String) {
        Task { await PersistenceWriter.shared.schedule(value, key: key) }
    }

    /// Immediate synchronous write — use only for small values or at teardown.
    func saveNow<T: Encodable>(_ value: T, _ key: String) {
        let url = Self.directory.appending(path: "\(key).json")
        if let data = try? JSONEncoder.tars.encode(value) {
            try? data.write(to: url, options: .atomic)
        }
    }

    func load<T: Decodable>(_ type: T.Type, _ key: String) -> T? {
        let url = Self.directory.appending(path: "\(key).json")
        guard let data = try? Data(contentsOf: url) else { return nil }
        return try? JSONDecoder.tars.decode(type, from: data)
    }
}

private actor PersistenceWriter {
    static let shared = PersistenceWriter()
    private var pending: [String: Task<Void, Never>] = [:]

    func schedule<T: Encodable & Sendable>(_ value: T, key: String) {
        pending[key]?.cancel()
        pending[key] = Task {
            try? await Task.sleep(for: .milliseconds(600))
            guard !Task.isCancelled else { return }
            let url = Persistence.directory.appending(path: "\(key).json")
            if let data = try? JSONEncoder.tars.encode(value) {
                try? data.write(to: url, options: .atomic)
            }
        }
    }
}
