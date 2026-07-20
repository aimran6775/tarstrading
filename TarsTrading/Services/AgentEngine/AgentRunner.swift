import Foundation

/// The paper autopilot: evaluates running agents against fresh bars and places
/// orders through the SAME broker the human uses — every order tagged with the
/// agent's ID and a plain-English rationale. Risk limits are enforced here
/// again (belt and suspenders with the backtester); breaches trip the kill
/// switch and flatten the agent's positions.
@MainActor
final class AgentRunner {
    private weak var trading: TradingStore?
    private weak var lab: AgentLab?

    /// Live per-agent accounting, rebuilt from tagged orders.
    struct AgentBook {
        var openLots: [String: (qty: Double, entry: Double)] = [:]
        var realizedPnL: Double = 0
        var dayRealizedPnL: Double = 0
        var peakValue: Double = 0
    }
    private var books: [UUID: AgentBook] = [:]
    private var booksRebuilt = false

    init(trading: TradingStore, lab: AgentLab) {
        self.trading = trading
        self.lab = lab
    }

    /// One evaluation pass. Called by AgentLab's scheduler; a no-op for
    /// symbols whose market is closed (the entry/exit logic sees frozen bars).
    func evaluateAll() async {
        guard let trading, let lab else { return }
        rebuildBooksIfNeeded(trading: trading, lab: lab)
        for agent in lab.agents where agent.status == .running {
            await evaluate(agent: agent, trading: trading, lab: lab)
        }
    }

    /// Relaunch amnesia fix: an agent's open lots and realized P&L are fully
    /// derivable from its tagged fills, so rebuild the books from order
    /// history instead of trusting in-memory state that died with the process.
    private func rebuildBooksIfNeeded(trading: TradingStore, lab: AgentLab) {
        guard !booksRebuilt else { return }
        booksRebuilt = true
        let fills = trading.orderHistory
            .filter { $0.status == .filled && $0.agentID != nil }
            .sorted { ($0.filledAt ?? $0.submittedAt) < ($1.filledAt ?? $1.submittedAt) }
        guard !fills.isEmpty else { return }

        for agent in lab.agents {
            var book = AgentBook()
            for order in fills where order.agentID == agent.id {
                let price = order.filledAvgPrice ?? 0
                if order.side == .buy {
                    if let lot = book.openLots[order.symbol] {
                        let totalQty = lot.qty + order.filledQty
                        let blended = (lot.entry * lot.qty + price * order.filledQty) / totalQty
                        book.openLots[order.symbol] = (totalQty, blended)
                    } else {
                        book.openLots[order.symbol] = (order.filledQty, price)
                    }
                } else if let lot = book.openLots[order.symbol] {
                    let closedQty = min(lot.qty, order.filledQty)
                    book.realizedPnL += (price - lot.entry) * closedQty
                    let remaining = lot.qty - closedQty
                    book.openLots[order.symbol] = remaining > 0.0001 ? (remaining, lot.entry) : nil
                }
            }
            book.peakValue = max(agent.allocation, agent.allocation + book.realizedPnL)
            if !book.openLots.isEmpty || book.realizedPnL != 0 {
                books[agent.id] = book
            }
        }
    }

    private func evaluate(agent: TradingAgent, trading: TradingStore, lab: AgentLab) async {
        var book = books[agent.id] ?? AgentBook()
        defer { books[agent.id] = book }

        // Fetch recent daily bars for the universe (cached hard upstream).
        var barsBySymbol: [String: [Bar]] = [:]
        for symbol in agent.universe {
            if let bars = try? await trading.marketData.bars(symbol: symbol, timeframe: .year1),
               bars.count > 60 {
                barsBySymbol[symbol] = bars
            }
        }
        guard !barsBySymbol.isEmpty else { return }

        let needed = IndicatorMath.requiredIndicators(agent.entry + agent.exit)

        // Mark the agent's book to market for risk checks.
        let markValue = book.openLots.reduce(agent.allocation + book.realizedPnL) { acc, lot in
            let last = barsBySymbol[lot.key]?.last?.close ?? lot.value.entry
            return acc + (last - lot.value.entry) * lot.value.qty
        }
        book.peakValue = max(book.peakValue, markValue)

        // KILL SWITCH: max drawdown breached → flatten and stop, permanently.
        if book.peakValue > 0,
           (book.peakValue - markValue) / book.peakValue > agent.risk.maxDrawdownPercent / 100 {
            await flatten(agent: agent, book: &book, trading: trading,
                          reason: "Max drawdown \(Int(agent.risk.maxDrawdownPercent))% breached")
            lab.kill(agent.id, reason: "Automatic kill switch: max drawdown limit hit. All positions closed.")
            return
        }
        // Daily loss halt (soft stop — resumes next session).
        if book.dayRealizedPnL < -(agent.allocation * agent.risk.maxDailyLossPercent / 100) {
            return
        }

        for (symbol, bars) in barsBySymbol {
            var series: [Indicator: [Double]] = [:]
            for ind in needed { series[ind] = IndicatorMath.series(ind, bars: bars) }
            let i = bars.count - 1
            let price = bars[i].close

            if let lot = book.openLots[symbol] {
                // Exit checks: stop, target, rules.
                var reason: String?
                if let stop = agent.stopLossPercent, price <= lot.entry * (1 - stop / 100) {
                    reason = "Stop loss: price \(price.formatted(.number.precision(.fractionLength(2)))) fell \(Int(stop))% below entry"
                } else if let tp = agent.takeProfitPercent, price >= lot.entry * (1 + tp / 100) {
                    reason = "Take profit: +\(Int(tp))% target reached"
                } else if let rule = agent.exit.first(where: {
                    IndicatorMath.evaluate($0, at: i, series: series, bars: bars) }) {
                    reason = "Exit rule: \(rule.plainEnglish)"
                }
                if let reason {
                    let draft = OrderDraft(symbol: symbol,
                                           assetClass: symbol.contains("/") ? .crypto : .usEquity,
                                           side: .sell, type: .market, qty: lot.qty,
                                           agentID: agent.id, agentRationale: reason)
                    if let order = try? await trading.submit(draft), order.status == .filled {
                        let pnl = ((order.filledAvgPrice ?? price) - lot.entry) * lot.qty
                        book.realizedPnL += pnl
                        book.dayRealizedPnL += pnl
                        book.openLots[symbol] = nil
                        lab.recordActivity(agent: agent, text: "Sold \(lot.qty.formatted()) \(symbol) — \(reason)")
                    }
                }
            } else if book.openLots.count < agent.risk.maxPositions {
                // Entry: ALL rules must fire.
                guard !agent.entry.isEmpty, agent.entry.allSatisfy({
                    IndicatorMath.evaluate($0, at: i, series: series, bars: bars) }) else { continue }
                let budget = agent.allocation * agent.risk.maxPositionPercent / 100
                let qty = max((budget / price).rounded(.down), symbol.contains("/") ? 0.001 : 1)
                let rationale = "Entry: " + agent.entry.map(\.plainEnglish).joined(separator: " AND ")
                let draft = OrderDraft(symbol: symbol,
                                       assetClass: symbol.contains("/") ? .crypto : .usEquity,
                                       side: .buy, type: .market, qty: qty,
                                       agentID: agent.id, agentRationale: rationale)
                if let order = try? await trading.submit(draft), order.status == .filled {
                    book.openLots[symbol] = (qty, order.filledAvgPrice ?? price)
                    lab.recordActivity(agent: agent, text: "Bought \(qty.formatted()) \(symbol) — \(rationale)")
                }
            }
        }
    }

    private func flatten(agent: TradingAgent, book: inout AgentBook,
                         trading: TradingStore, reason: String) async {
        for (symbol, lot) in book.openLots {
            let draft = OrderDraft(symbol: symbol,
                                   assetClass: symbol.contains("/") ? .crypto : .usEquity,
                                   side: .sell, type: .market, qty: lot.qty,
                                   agentID: agent.id, agentRationale: reason)
            _ = try? await trading.submit(draft)
        }
        book.openLots.removeAll()
    }

    /// Manual kill from the big red button: flatten + stop.
    func killNow(_ agentID: UUID) async {
        guard let trading, let lab,
              let agent = lab.agents.first(where: { $0.id == agentID }) else { return }
        var book = books[agentID] ?? AgentBook()
        await flatten(agent: agent, book: &book, trading: trading, reason: "Manual kill switch")
        books[agentID] = book
        lab.kill(agentID, reason: "Manual kill switch. All positions closed.")
    }

    func resetDailyCounters() {
        for key in books.keys { books[key]?.dayRealizedPnL = 0 }
    }

    func book(for agentID: UUID) -> AgentBook? { books[agentID] }
}
