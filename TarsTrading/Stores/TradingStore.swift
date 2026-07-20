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
            for q in fresh { quotes[q.symbol] = q }
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

    private func handleFill(_ order: Order, closing: Position? = nil) {
        Haptics.fill()
        let price = order.filledAvgPrice ?? 0
        if let closing {
            var entry = JournalEntry(symbol: order.symbol, side: closing.side,
                                     qty: abs(closing.qty), entryPrice: closing.avgEntryPrice,
                                     exitPrice: price, openedAt: .now, closedAt: .now,
                                     agentID: order.agentID)
            entry.thesis = order.agentRationale ?? ""
            journal.insert(entry, at: 0)
            if order.agentID == nil { pendingThesisCapture = entry }
        } else {
            let entry = JournalEntry(symbol: order.symbol, side: order.side,
                                     qty: order.qty, entryPrice: price, exitPrice: nil,
                                     openedAt: order.filledAt ?? .now, closedAt: nil,
                                     thesis: order.agentRationale ?? "", agentID: order.agentID)
            journal.insert(entry, at: 0)
            if order.agentID == nil { pendingThesisCapture = entry }
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
        withAnimation(Motion.fluid) { watchlist.append(symbol) }
        persistence.save(watchlist, "watchlist")
        Task { await refreshQuotes() }
    }

    func removeFromWatchlist(_ symbol: String) {
        withAnimation(Motion.fluid) { watchlist.removeAll { $0 == symbol } }
        persistence.save(watchlist, "watchlist")
    }

    func quote(for symbol: String) -> Quote? { quotes[symbol] }
}

// MARK: - Disk persistence (JSON in Application Support)

struct Persistence {
    private let dir: URL = {
        let base = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0]
        let dir = base.appending(path: "TarsTrading", directoryHint: .isDirectory)
        try? FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
        return dir
    }()

    func save<T: Encodable>(_ value: T, _ key: String) {
        let url = dir.appending(path: "\(key).json")
        if let data = try? JSONEncoder.tars.encode(value) {
            try? data.write(to: url, options: .atomic)
        }
    }

    func load<T: Decodable>(_ type: T.Type, _ key: String) -> T? {
        let url = dir.appending(path: "\(key).json")
        guard let data = try? Data(contentsOf: url) else { return nil }
        return try? JSONDecoder.tars.decode(type, from: data)
    }
}
