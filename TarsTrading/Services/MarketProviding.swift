import Foundation

/// Abstraction over market data. Real impl: Massive (Polygon). Offline/demo
/// impl: DemoMarket. The app never talks to a concrete provider directly.
protocol MarketProviding: Sendable {
    func quotes(for symbols: [String]) async throws -> [Quote]
    func bars(symbol: String, timeframe: Timeframe) async throws -> [Bar]
    func search(_ query: String) async throws -> [Asset]
}

/// Abstraction over the brokerage. Real impl: Alpaca Paper. Offline/demo impl:
/// DemoBroker (a full in-memory matching engine).
protocol TradingProviding: Sendable {
    func account() async throws -> Account
    func positions() async throws -> [Position]
    func orders(open: Bool) async throws -> [Order]
    func submit(_ draft: OrderDraft) async throws -> Order
    func cancel(orderID: String) async throws
    func closePosition(symbol: String) async throws -> Order
}

/// What the order ticket produces. Converted to Alpaca's wire format or fed to
/// the demo matching engine.
struct OrderDraft: Codable, Equatable {
    var symbol: String
    var assetClass: AssetClass = .usEquity
    var side: OrderSide = .buy
    var type: OrderType = .market
    var qty: Double = 1
    var limitPrice: Double?
    var stopPrice: Double?
    var trailPercent: Double?
    var timeInForce: TimeInForce = .day
    var bracket: BracketLevels?
    var agentID: UUID?
    var agentRationale: String?
}
