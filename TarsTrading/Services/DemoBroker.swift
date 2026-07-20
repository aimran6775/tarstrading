import Foundation

/// A full in-memory paper brokerage: cash accounting, order matching against
/// DemoMarket prices (market fills instantly with slippage; limit/stop orders
/// rest and trigger on price cross), bracket handling, and position tracking.
/// This is what runs when no Alpaca keys are configured — and what the Agent
/// Lab trains against offline.
final class DemoBroker: TradingProviding, @unchecked Sendable {
    static let shared = DemoBroker(market: DemoMarket.shared)

    private let market: DemoMarket
    private let lock = NSLock()

    private var cash: Double = 100_000
    private var lastEquity: Double = 100_000
    private var positionsBySymbol: [String: Position] = [:]
    private var allOrders: [Order] = []

    init(market: DemoMarket, startingCash: Double = 100_000) {
        self.market = market
        self.cash = startingCash
        self.lastEquity = startingCash
    }

    // MARK: - Matching (called from the store heartbeat, after market.tick())

    func processOpenOrders() {
        lock.lock(); defer { lock.unlock() }
        for i in allOrders.indices where allOrders[i].status.isOpen {
            let order = allOrders[i]
            let price = market.price(of: order.symbol)
            guard price > 0 else { continue }
            switch order.type {
            case .market:
                fill(&allOrders[i], at: slipped(price, side: order.side))
            case .limit:
                if let limit = order.limitPrice,
                   (order.side == .buy && price <= limit) || (order.side == .sell && price >= limit) {
                    fill(&allOrders[i], at: limit)
                }
            case .stop:
                if let stop = order.stopPrice,
                   (order.side == .buy && price >= stop) || (order.side == .sell && price <= stop) {
                    fill(&allOrders[i], at: slipped(price, side: order.side))
                }
            case .stopLimit:
                if let stop = order.stopPrice, let limit = order.limitPrice,
                   (order.side == .buy && price >= stop && price <= limit) ||
                   (order.side == .sell && price <= stop && price >= limit) {
                    fill(&allOrders[i], at: limit)
                }
            case .trailingStop:
                // Simplified: trail from entry using trailPercent against current price.
                if let trail = order.trailPercent, let stop = order.stopPrice {
                    let newStop = order.side == .sell
                        ? max(stop, price * (1 - trail / 100))
                        : min(stop, price * (1 + trail / 100))
                    allOrders[i].stopPrice = newStop
                    if (order.side == .sell && price <= newStop) || (order.side == .buy && price >= newStop) {
                        fill(&allOrders[i], at: slipped(price, side: order.side))
                    }
                }
            }
        }
    }

    private func slipped(_ price: Double, side: OrderSide) -> Double {
        let bps = Double.random(in: 0...4) / 10_000
        return side == .buy ? price * (1 + bps) : price * (1 - bps)
    }

    private func fill(_ order: inout Order, at price: Double) {
        order.status = .filled
        order.filledQty = order.qty
        order.filledAvgPrice = price
        order.filledAt = .now

        let signedQty = order.side == .buy ? order.qty : -order.qty
        cash -= signedQty * price

        var pos = positionsBySymbol[order.symbol]
            ?? Position(symbol: order.symbol, assetClass: order.assetClass,
                        qty: 0, avgEntryPrice: 0, currentPrice: price)
        let newQty = pos.qty + signedQty
        if newQty == 0 {
            positionsBySymbol[order.symbol] = nil
        } else {
            if pos.qty == 0 || (pos.qty > 0) == (signedQty > 0) {
                // Adding to (or opening) — blend cost basis.
                pos.avgEntryPrice = (pos.avgEntryPrice * abs(pos.qty) + price * abs(signedQty)) / abs(newQty)
            }
            pos.qty = newQty
            pos.currentPrice = price
            positionsBySymbol[order.symbol] = pos
        }

        // Spawn resting bracket legs once the parent fills.
        if let bracket = order.bracket {
            let exitSide: OrderSide = order.side == .buy ? .sell : .buy
            if let tp = bracket.takeProfit {
                allOrders.append(Order(id: UUID().uuidString, symbol: order.symbol,
                                       assetClass: order.assetClass, side: exitSide, type: .limit,
                                       qty: order.qty, limitPrice: tp, stopPrice: nil, trailPercent: nil,
                                       timeInForce: .gtc, bracket: nil, status: .accepted,
                                       submittedAt: .now, agentID: order.agentID))
            }
            if let sl = bracket.stopLoss {
                allOrders.append(Order(id: UUID().uuidString, symbol: order.symbol,
                                       assetClass: order.assetClass, side: exitSide, type: .stop,
                                       qty: order.qty, limitPrice: nil, stopPrice: sl, trailPercent: nil,
                                       timeInForce: .gtc, bracket: nil, status: .accepted,
                                       submittedAt: .now, agentID: order.agentID))
            }
        }
    }

    /// Mark positions to market and report equity.
    private func markToMarket() {
        for (symbol, var pos) in positionsBySymbol {
            let price = market.price(of: symbol)
            if price > 0 { pos.currentPrice = price; positionsBySymbol[symbol] = pos }
        }
    }

    /// Called once per demo "day" boundary by the store if it wants day-P&L to
    /// roll over; harmless if never called.
    func rollDay() {
        lock.lock(); defer { lock.unlock() }
        markToMarket()
        lastEquity = cash + positionsBySymbol.values.reduce(0) { $0 + $1.marketValue }
    }

    // MARK: - TradingProviding

    func account() async throws -> Account {
        lock.lock(); defer { lock.unlock() }
        markToMarket()
        let equity = cash + positionsBySymbol.values.reduce(0) { $0 + $1.marketValue }
        return Account(equity: equity, cash: cash,
                       buyingPower: max(0, cash) * 2, lastEquity: lastEquity)
    }

    func positions() async throws -> [Position] {
        lock.lock(); defer { lock.unlock() }
        markToMarket()
        return positionsBySymbol.values.sorted { $0.marketValue > $1.marketValue }
    }

    func orders(open: Bool) async throws -> [Order] {
        lock.lock(); defer { lock.unlock() }
        let list = open ? allOrders.filter { $0.status.isOpen } : allOrders
        return list.sorted { $0.submittedAt > $1.submittedAt }
    }

    func submit(_ draft: OrderDraft) async throws -> Order {
        lock.lock(); defer { lock.unlock() }
        let price = market.price(of: draft.symbol)
        guard price > 0 else { throw TarsError.orderRejected("Unknown symbol \(draft.symbol)") }
        if draft.side == .buy {
            let estCost = draft.qty * (draft.limitPrice ?? price)
            guard estCost <= max(0, cash) * 2 else {
                throw TarsError.orderRejected("Insufficient buying power for \(draft.symbol)")
            }
        } else {
            let held = positionsBySymbol[draft.symbol]?.qty ?? 0
            guard held >= draft.qty else {
                throw TarsError.orderRejected("No shortable inventory in demo — you hold \(held.formatted()) \(draft.symbol)")
            }
        }
        var order = Order(id: UUID().uuidString, symbol: draft.symbol,
                          assetClass: draft.assetClass, side: draft.side, type: draft.type,
                          qty: draft.qty, limitPrice: draft.limitPrice, stopPrice: draft.stopPrice,
                          trailPercent: draft.trailPercent, timeInForce: draft.timeInForce,
                          bracket: draft.bracket, status: .accepted,
                          submittedAt: .now, agentID: draft.agentID,
                          agentRationale: draft.agentRationale)
        if draft.type == .market {
            fill(&order, at: slipped(price, side: draft.side))
        }
        allOrders.append(order)
        return order
    }

    func cancel(orderID: String) async throws {
        lock.lock(); defer { lock.unlock() }
        guard let i = allOrders.firstIndex(where: { $0.id == orderID }) else { return }
        if allOrders[i].status.isOpen { allOrders[i].status = .canceled }
    }

    func closePosition(symbol: String) async throws -> Order {
        let pos: Position? = {
            lock.lock(); defer { lock.unlock() }
            return positionsBySymbol[symbol]
        }()
        guard let pos else { throw TarsError.orderRejected("No position in \(symbol)") }
        return try await submit(OrderDraft(symbol: symbol, assetClass: pos.assetClass,
                                           side: pos.qty > 0 ? .sell : .buy,
                                           type: .market, qty: abs(pos.qty)))
    }
}
