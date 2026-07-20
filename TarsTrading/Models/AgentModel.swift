import Foundation

// MARK: - The trading agent: a fully explainable, risk-bounded strategy.
// Everything an agent does must be readable by a beginner on its card —
// that's a product rule, so the strategy language is small and composable.

struct TradingAgent: Identifiable, Codable, Equatable {
    var id = UUID()
    var name: String
    var emoji: String = "🤖"
    var universe: [String]                  // symbols it may trade
    var entry: [SignalRule]                 // ALL must be true to enter
    var exit: [SignalRule]                  // ANY true → exit
    var stopLossPercent: Double? = 8        // hard exit below entry
    var takeProfitPercent: Double? = nil
    var risk: RiskLimits = RiskLimits()
    var allocation: Double = 10_000         // paper capital it manages
    var status: AgentStatus = .draft
    var createdAt = Date.now
    /// Set when the kill switch (manual or automatic) fired.
    var killedReason: String?

    /// Plain-English strategy card — the explainability rule.
    var thesisText: String {
        let entryText = entry.map(\.plainEnglish).joined(separator: " AND ")
        let exitText = exit.isEmpty ? "" : " Exits when \(exit.map(\.plainEnglish).joined(separator: " OR "))."
        let stopText = stopLossPercent.map { " Hard stop \(Int($0))% below entry." } ?? ""
        return "Buys when \(entryText).\(exitText)\(stopText)"
    }
}

enum AgentStatus: String, Codable {
    case draft, backtested, running, paused, killed
    var label: String { rawValue.capitalized }
}

// MARK: - Signal language

enum Indicator: Codable, Equatable, Hashable {
    case price
    case sma(Int)
    case ema(Int)
    case rsi(Int)
    case highestHigh(Int)
    case lowestLow(Int)

    var plainEnglish: String {
        switch self {
        case .price: "price"
        case .sma(let n): "\(n)-day average"
        case .ema(let n): "\(n)-day EMA"
        case .rsi(let n): "RSI(\(n))"
        case .highestHigh(let n): "\(n)-day high"
        case .lowestLow(let n): "\(n)-day low"
        }
    }
}

enum Comparator: String, Codable, CaseIterable {
    case crossesAbove, crossesBelow, isAbove, isBelow
    var plainEnglish: String {
        switch self {
        case .crossesAbove: "crosses above"
        case .crossesBelow: "crosses below"
        case .isAbove: "is above"
        case .isBelow: "is below"
        }
    }
}

enum SignalOperand: Codable, Equatable, Hashable {
    case indicator(Indicator)
    case constant(Double)
    var plainEnglish: String {
        switch self {
        case .indicator(let i): i.plainEnglish
        case .constant(let v): v.formatted(.number.precision(.fractionLength(0...2)))
        }
    }
}

struct SignalRule: Codable, Equatable, Hashable, Identifiable {
    var id = UUID()
    var lhs: Indicator
    var comparator: Comparator
    var rhs: SignalOperand

    var plainEnglish: String {
        "\(lhs.plainEnglish) \(comparator.plainEnglish) \(rhs.plainEnglish)"
    }
}

// MARK: - Risk limits: mandatory, not optional. The backtester AND the live
// runner both enforce these; there is no code path around them.

struct RiskLimits: Codable, Equatable {
    /// Max % of the agent's allocation in one position.
    var maxPositionPercent: Double = 25
    /// Trading halts for the day past this daily loss (% of allocation).
    var maxDailyLossPercent: Double = 3
    /// KILL SWITCH: agent is stopped permanently past this drawdown.
    var maxDrawdownPercent: Double = 15
    /// Max simultaneous positions.
    var maxPositions: Int = 4
}

// MARK: - Backtest results

struct BacktestResult: Codable, Equatable {
    struct Segment: Codable, Equatable {
        var label: String                   // "In-sample" / "Out-of-sample"
        var equity: [Double]                // curve, daily
        var totalReturn: Double
        var annualizedReturn: Double
        var maxDrawdown: Double
        var sharpe: Double
        var winRate: Double
        var tradeCount: Int
        var exposure: Double                // fraction of days holding
    }
    struct SimTrade: Codable, Equatable, Identifiable {
        var id = UUID()
        var symbol: String
        var entryIndex: Int
        var exitIndex: Int
        var entryPrice: Double
        var exitPrice: Double
        var reason: String
        var pnlPercent: Double { entryPrice == 0 ? 0 : (exitPrice - entryPrice) / entryPrice }
    }

    var inSample: Segment
    var outOfSample: Segment
    var trades: [SimTrade]
    var benchmarkReturn: Double             // buy & hold over same span
    var ranAt = Date.now

    /// The honesty flag: great in-sample + poor out-of-sample = overfit.
    var overfitWarning: Bool {
        inSample.annualizedReturn > 0.10 &&
        outOfSample.annualizedReturn < inSample.annualizedReturn * 0.35
    }
}
