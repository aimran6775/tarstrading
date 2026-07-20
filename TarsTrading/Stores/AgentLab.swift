import SwiftUI

/// Agent Lab state: the user's stable of trading agents, their backtests,
/// activity feed, and the autopilot scheduler.
@Observable
final class AgentLab {
    var agents: [TradingAgent] = []
    var backtests: [UUID: BacktestResult] = [:]
    var activity: [AgentActivity] = []
    var isEvaluating = false

    struct AgentActivity: Identifiable, Codable, Equatable {
        var id = UUID()
        var agentID: UUID
        var agentName: String
        var text: String
        var at = Date.now
    }

    @ObservationIgnored private let persistence = Persistence()
    @ObservationIgnored private var runner: AgentRunner?
    @ObservationIgnored private var scheduler: Task<Void, Never>?

    init() {
        agents = persistence.load([TradingAgent].self, "agents") ?? []
        backtests = persistence.load([UUID: BacktestResult].self, "backtests") ?? [:]
        activity = persistence.load([AgentActivity].self, "agentActivity") ?? []
    }

    /// Called once from RootView with live stores; starts the autopilot loop.
    @MainActor
    func connect(trading: TradingStore) {
        guard runner == nil else { return }
        let runner = AgentRunner(trading: trading, lab: self)
        self.runner = runner
        scheduler?.cancel()
        scheduler = Task { [weak self] in
            var lastDayStamp = MarketClock.dayStamp()
            while !Task.isCancelled {
                guard let self else { return }
                let stamp = MarketClock.dayStamp()
                if stamp != lastDayStamp {
                    lastDayStamp = stamp
                    runner.resetDailyCounters()
                }
                // Evaluate only when a market the running agents trade is
                // actually open — closed markets mean frozen bars, so a pass
                // would be a no-op that still burns data budget.
                let running = self.agents.filter { $0.status == .running }
                let anyOpen = running.contains { agent in
                    agent.universe.contains { symbol in
                        MarketClock.isOpen(symbol.contains("/") ? .crypto : .usEquity)
                    }
                }
                if !running.isEmpty && anyOpen {
                    self.isEvaluating = true
                    await runner.evaluateAll()
                    self.isEvaluating = false
                }
                try? await Task.sleep(for: .seconds(120))
            }
        }
    }

    // MARK: - CRUD

    func upsert(_ agent: TradingAgent) {
        if let i = agents.firstIndex(where: { $0.id == agent.id }) {
            agents[i] = agent
        } else {
            agents.append(agent)
        }
        save()
    }

    func delete(_ agentID: UUID) {
        agents.removeAll { $0.id == agentID }
        backtests[agentID] = nil
        save()
    }

    func setStatus(_ agentID: UUID, _ status: AgentStatus) {
        guard let i = agents.firstIndex(where: { $0.id == agentID }) else { return }
        agents[i].status = status
        if status != .killed { agents[i].killedReason = nil }
        save()
    }

    func kill(_ agentID: UUID, reason: String) {
        guard let i = agents.firstIndex(where: { $0.id == agentID }) else { return }
        agents[i].status = .killed
        agents[i].killedReason = reason
        recordActivity(agent: agents[i], text: reason)
        Haptics.failure()
        save()
    }

    @MainActor
    func manualKill(_ agentID: UUID) async {
        await runner?.killNow(agentID)
    }

    func recordActivity(agent: TradingAgent, text: String) {
        activity.insert(AgentActivity(agentID: agent.id, agentName: agent.name, text: text), at: 0)
        if activity.count > 300 { activity.removeLast(activity.count - 300) }
        persistence.save(activity, "agentActivity")
    }

    // MARK: - Backtesting

    @MainActor
    func backtest(_ agent: TradingAgent, marketData: MarketProviding) async -> BacktestResult? {
        // Backtests run on real bundled daily history (Resources/HistoricalBars)
        // whenever a symbol ships with it — actual market past, not synthetic
        // physics. The provider is only a fallback for unbundled symbols.
        var barsBySymbol: [String: [Bar]] = [:]
        for symbol in agent.universe {
            if let real = HistoricalData.bars(for: symbol) {
                barsBySymbol[symbol] = Array(real.suffix(1260))   // ~5y of trading days
            } else if let bars = try? await marketData.bars(symbol: symbol, timeframe: .year5) {
                barsBySymbol[symbol] = bars
            }
        }
        guard let result = Backtester().run(agent: agent, barsBySymbol: barsBySymbol) else {
            return nil
        }
        backtests[agent.id] = result
        if let i = agents.firstIndex(where: { $0.id == agent.id }), agents[i].status == .draft {
            agents[i].status = .backtested
        }
        save()
        return result
    }

    private func save() {
        persistence.save(agents, "agents")
        persistence.save(backtests, "backtests")
    }

    // MARK: - Starter agents (so the Lab never opens empty)

    static func starterAgents() -> [TradingAgent] {
        [
            TradingAgent(
                name: "Trend Follower",
                emoji: "🏄",
                universe: ["AAPL", "MSFT", "NVDA", "SPY"],
                entry: [SignalRule(lhs: .sma(20), comparator: .crossesAbove, rhs: .indicator(.sma(50)))],
                exit: [SignalRule(lhs: .sma(20), comparator: .crossesBelow, rhs: .indicator(.sma(50)))],
                stopLossPercent: 10),
            TradingAgent(
                name: "Dip Buyer",
                emoji: "🎣",
                universe: ["SPY", "QQQ"],
                entry: [SignalRule(lhs: .rsi(14), comparator: .crossesBelow, rhs: .constant(30))],
                exit: [SignalRule(lhs: .rsi(14), comparator: .crossesAbove, rhs: .constant(55))],
                stopLossPercent: 7),
            TradingAgent(
                name: "Breakout Hunter",
                emoji: "🚀",
                universe: ["NVDA", "TSLA", "PLTR"],
                entry: [SignalRule(lhs: .price, comparator: .crossesAbove, rhs: .indicator(.highestHigh(50)))],
                exit: [SignalRule(lhs: .price, comparator: .crossesBelow, rhs: .indicator(.sma(20)))],
                stopLossPercent: 8,
                risk: RiskLimits(maxPositionPercent: 20, maxDailyLossPercent: 3,
                                 maxDrawdownPercent: 12, maxPositions: 3)),
        ]
    }
}
