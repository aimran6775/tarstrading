import Foundation

// MARK: - Assets

enum AssetClass: String, Codable, CaseIterable, Identifiable {
    case usEquity = "us_equity"
    case crypto = "crypto"
    case usOption = "us_option"
    var id: String { rawValue }
    var label: String {
        switch self {
        case .usEquity: "Stocks"
        case .crypto: "Crypto"
        case .usOption: "Options"
        }
    }
    /// Crypto trades 24/7; equities/options keep exchange hours.
    var tradesAroundTheClock: Bool { self == .crypto }
}

struct Asset: Identifiable, Codable, Hashable {
    var id: String { symbol }
    let symbol: String
    let name: String
    let assetClass: AssetClass
    var exchange: String = ""
    var isTradable: Bool = true
}

// MARK: - Market data

struct Quote: Identifiable, Codable, Equatable {
    var id: String { symbol }
    let symbol: String
    var price: Double
    var previousClose: Double
    var asOf: Date
    var change: Double { price - previousClose }
    var changePercent: Double { previousClose == 0 ? 0 : change / previousClose }
    /// Honest-data rule: surfaces show how stale a quote is, never fake liveness.
    var age: TimeInterval { Date.now.timeIntervalSince(asOf) }
}

struct Bar: Identifiable, Codable, Equatable {
    var id: Date { time }
    let time: Date
    let open: Double
    let high: Double
    let low: Double
    let close: Double
    let volume: Double
    var isUp: Bool { close >= open }
}

enum Timeframe: String, CaseIterable, Identifiable {
    case day1 = "1D", week1 = "1W", month1 = "1M", month3 = "3M",
         year1 = "1Y", year5 = "5Y"
    var id: String { rawValue }
    var barCount: Int {
        switch self {
        case .day1: 78       // 5-min bars
        case .week1: 65      // 30-min bars
        case .month1: 22     // daily
        case .month3: 66     // daily
        case .year1: 252     // daily
        case .year5: 260     // weekly
        }
    }
    var barInterval: TimeInterval {
        switch self {
        case .day1: 300
        case .week1: 1800
        case .month1, .month3, .year1: 86_400
        case .year5: 604_800
        }
    }
}

// MARK: - Account & positions

struct Account: Codable, Equatable {
    var equity: Double
    var cash: Double
    var buyingPower: Double
    var lastEquity: Double     // previous close equity, for day P&L
    var currency: String = "USD"
    var dayPnL: Double { equity - lastEquity }
    var dayPnLPercent: Double { lastEquity == 0 ? 0 : dayPnL / lastEquity }

    static let empty = Account(equity: 0, cash: 0, buyingPower: 0, lastEquity: 0)
}

struct Position: Identifiable, Codable, Equatable {
    var id: String { symbol }
    let symbol: String
    let assetClass: AssetClass
    var qty: Double
    var avgEntryPrice: Double
    var currentPrice: Double
    var marketValue: Double { qty * currentPrice }
    var costBasis: Double { qty * avgEntryPrice }
    var unrealizedPnL: Double { marketValue - costBasis }
    var unrealizedPnLPercent: Double { costBasis == 0 ? 0 : unrealizedPnL / costBasis }
    var side: OrderSide { qty >= 0 ? .buy : .sell }
}

// MARK: - Orders

enum OrderSide: String, Codable, CaseIterable, Identifiable {
    case buy, sell
    var id: String { rawValue }
    var label: String { rawValue.capitalized }
}

enum OrderType: String, Codable, CaseIterable, Identifiable {
    case market, limit, stop
    case stopLimit = "stop_limit"
    case trailingStop = "trailing_stop"
    var id: String { rawValue }
    var label: String {
        switch self {
        case .market: "Market"
        case .limit: "Limit"
        case .stop: "Stop"
        case .stopLimit: "Stop Limit"
        case .trailingStop: "Trailing Stop"
        }
    }
}

enum TimeInForce: String, Codable, CaseIterable, Identifiable {
    case day, gtc
    var id: String { rawValue }
    var label: String { self == .day ? "Day" : "GTC" }
}

enum OrderStatus: String, Codable {
    case staged            // local only, not yet submitted
    case pendingNew = "pending_new"
    case accepted, new
    case partiallyFilled = "partially_filled"
    case filled, canceled, rejected, expired

    var isTerminal: Bool {
        switch self {
        case .filled, .canceled, .rejected, .expired: true
        default: false
        }
    }
    var isOpen: Bool { !isTerminal && self != .staged }
}

struct BracketLevels: Codable, Equatable {
    var takeProfit: Double?
    var stopLoss: Double?
}

struct Order: Identifiable, Codable, Equatable {
    var id: String
    let symbol: String
    let assetClass: AssetClass
    var side: OrderSide
    var type: OrderType
    var qty: Double
    var limitPrice: Double?
    var stopPrice: Double?
    var trailPercent: Double?
    var timeInForce: TimeInForce
    var bracket: BracketLevels?
    var status: OrderStatus
    var filledQty: Double = 0
    var filledAvgPrice: Double?
    var submittedAt: Date
    var filledAt: Date?
    /// Set when an AI agent (not the human) placed this order.
    var agentID: UUID?
    /// The agent's reasoning snapshot at placement time — explainability rule.
    var agentRationale: String?
}

// MARK: - Journal

struct JournalEntry: Identifiable, Codable, Equatable {
    var id = UUID()
    var symbol: String
    var side: OrderSide
    var qty: Double
    var entryPrice: Double
    var exitPrice: Double?
    var openedAt: Date
    var closedAt: Date?
    var thesis: String = ""
    var outcomeTag: OutcomeTag?
    var agentID: UUID?
    var realizedPnL: Double? {
        guard let exitPrice else { return nil }
        let sign: Double = side == .buy ? 1 : -1
        return (exitPrice - entryPrice) * qty * sign
    }
}

enum OutcomeTag: String, Codable, CaseIterable, Identifiable {
    case thesisPlayedOut = "Thesis played out"
    case luckyWin = "Right for wrong reasons"
    case goodLoss = "Good process, bad outcome"
    case mistake = "Mistake — learn from it"
    var id: String { rawValue }
}

// MARK: - Errors

enum TarsError: LocalizedError, Equatable {
    case network(String)
    case rateLimited(retryAfter: TimeInterval?)
    case decoding(String)
    case unauthorized
    case orderRejected(String)
    case riskLimitBreached(String)

    var errorDescription: String? {
        switch self {
        case .network(let m): "Network issue: \(m)"
        case .rateLimited: "Data provider is rate-limiting us — retrying shortly."
        case .decoding(let m): "Unexpected data from server: \(m)"
        case .unauthorized: "API keys missing or invalid. Check Secrets.swift."
        case .orderRejected(let m): "Order rejected: \(m)"
        case .riskLimitBreached(let m): "Risk limit stopped this action: \(m)"
        }
    }
}
