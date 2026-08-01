import Foundation

/*
  Typed mirrors of the platform API's JSON. The server is the source of
  truth; these types are deliberately dumb — no derived math on the client
  that the server already does (margin, P&L, financing all arrive computed,
  so phone and web can never disagree about money).

  Field names match the API's camelCase exactly: no CodingKeys ceremony,
  and a renamed server field becomes a loud decode failure instead of a
  silently-nil surprise.
*/

// MARK: - Auth

struct TokenResponse: Decodable {
    let ok: Bool
    let token: String?
    let error: String?
}

// MARK: - Bootstrap (one round trip → first paint)

struct BootstrapResponse: Decodable {
    let ok: Bool
    let user: APIUser
    let risk: AccountRiskPayload
    let rates: FinancingRatesPayload
    let watchlist: [String]
    let positions: [APIPosition]
    let unreadNotifications: Int
    let serverTime: Double
}

struct APIUser: Decodable, Equatable {
    let id: String
    let name: String
    let email: String
    let fundName: String?
}

struct APIPosition: Decodable, Identifiable, Equatable {
    let id: String
    let symbol: String
    let qty: Double
    let avgEntryPrice: Double
}

// MARK: - Risk (the margin desk's whole picture, server-computed)

struct AccountRiskPayload: Decodable, Equatable {
    let equity: Double
    let cash: Double
    let longValue: Double
    let shortValue: Double
    let gross: Double
    let net: Double
    let maintenance: Double
    let buyingPower: Double
    let marginUsedPct: Double
    let initialReq: Double
    let span: SpanPayload
}

struct SpanPayload: Decodable, Equatable {
    let im: Double
    let mm: Double
    let naiveIm: Double
    let naiveMm: Double
    let intraCredit: Double
    let interCredits: [SpanCredit]
}

struct SpanCredit: Decodable, Equatable {
    let group: String
    let credit: Double
}

struct FinancingRatesPayload: Decodable, Equatable {
    let fedFunds: Double
    let marginLoan: Double
    let cashSweep: Double
    let borrowGC: Double
}

// MARK: - Quotes

/// Where a price came from — the honesty chip. Unknown strings decode as
/// `.unknown` rather than failing the whole payload: a new provenance on the
/// server must never blank the app.
enum Provenance: String, Decodable {
    case live, delayed, eod, derived, indicative
    case unknown

    init(from decoder: Decoder) throws {
        let raw = try decoder.singleValueContainer().decode(String.self)
        self = Provenance(rawValue: raw) ?? .unknown
    }
}

struct APIQuote: Decodable, Identifiable, Equatable {
    var id: String { symbol }
    let symbol: String
    let price: Double
    let previousClose: Double
    let changePercent: Double
    let asOf: Double
    let provenance: Provenance?
}

struct WatchlistResponse: Decodable {
    let ok: Bool
    let watchlist: [String]
}

/// For endpoints whose only answer is "it worked".
struct EmptyOK: Decodable { let ok: Bool? }

struct SearchResponse: Decodable {
    let ok: Bool
    let rows: [BoardRowPayload]
    let total: Int
    let shown: Int
}

struct EquityPoint: Decodable, Equatable {
    let time: Double   // epoch ms
    let equity: Double
}

struct PortfolioHistoryResponse: Decodable {
    let ok: Bool
    let history: [EquityPoint]
}

struct SparksResponse: Decodable {
    let ok: Bool
    let sparks: [String: [Double]]
}

struct QuotesResponse: Decodable {
    let ok: Bool
    let quotes: [APIQuote]
}

// MARK: - Errors

/// Every failure the client can see, with the server's own sentence when it
/// offered one — the platform writes good rejection reasons; show them.
enum TarsAPIError: LocalizedError, Equatable {
    case unauthorized
    case rateLimited
    case server(String)
    case network
    case decoding

    var errorDescription: String? {
        switch self {
        case .unauthorized: "Signed out — please sign in again."
        case .rateLimited: "Too many attempts. Give it a moment."
        case .server(let message): message
        case .network: "No connection. Showing the last good data."
        case .decoding: "The server answered in a shape this build doesn't know."
        }
    }
}

// MARK: - The board (the curated universe, server-ranked)

struct BoardRowPayload: Decodable, Identifiable, Equatable {
    var id: String { symbol }
    let symbol: String
    let price: Double?
    let changePercent: Double?
    let category: String?
    let featured: Bool?
    let source: Provenance?
    let dayHigh: Double?
    let dayLow: Double?
}

struct VenueCount: Decodable, Equatable, Identifiable {
    var id: String { category }
    let category: String
    let count: Int
}

struct MoversPayload: Decodable, Equatable {
    let gainers: [BoardRowPayload]?
    let losers: [BoardRowPayload]?
    let breadth: BreadthPayload?
}

struct BreadthPayload: Decodable, Equatable {
    let advancing: Int
    let declining: Int
    let unchanged: Int
}

struct BoardResponse: Decodable {
    let ok: Bool
    let marketOpen: Bool?
    let count: Int?
    let rows: [BoardRowPayload]
    let movers: MoversPayload?
    let venues: [VenueCount]?
    let total: Int?
    let asOf: Double?
}

/*
  Provenance in words — ONE definition, so no two screens in the app can
  describe the same price differently. Mirrors the web's provenanceLabel():
  a delayed print outside the cash session is AFTER HOURS, not "delayed",
  and 24/7 venues (crypto, FX) are never mislabelled as being outside a
  session they don't have.
*/
enum ProvenanceLabel {
    static func text(_ source: Provenance, symbol: String? = nil) -> String {
        if source == .delayed, !isRegularSession(),
           !(symbol.map { $0.contains("/") || $0.uppercased().hasPrefix("FX:") } ?? false) {
            return "AFTER HOURS"
        }
        return switch source {
        case .live: "LIVE"
        case .delayed: "DELAYED 15M"
        case .eod: "EOD"
        case .derived: "DERIVED"
        case .indicative: "INDICATIVE"
        case .unknown: "—"
        }
    }

    /// 09:30–16:00 New York, weekdays.
    static func isRegularSession(_ now: Date = Date()) -> Bool {
        var cal = Calendar(identifier: .gregorian)
        guard let tz = TimeZone(identifier: "America/New_York") else { return true }
        cal.timeZone = tz
        let c = cal.dateComponents([.weekday, .hour, .minute], from: now)
        guard let wd = c.weekday, wd != 1, wd != 7,
              let h = c.hour, let m = c.minute else { return false }
        let mins = h * 60 + m
        return mins >= 9 * 60 + 30 && mins < 16 * 60
    }
}

// MARK: - Display helpers (the client's copy of the platform's naming rules)

enum SymbolDisplay {
    /// FX:EURUSD → EUR/USD, IDX:SPX → SPX, FUT:ESU6 → ES U6. Users never see plumbing.
    static func pretty(_ symbol: String) -> String {
        let u = symbol.uppercased()
        if u.hasPrefix("FX:") {
            let p = String(u.dropFirst(3))
            return p.count == 6 ? "\(p.prefix(3))/\(p.suffix(3))" : p
        }
        if u.hasPrefix("IDX:") { return String(u.dropFirst(4)) }
        if u.hasPrefix("FUT:") {
            let c = String(u.dropFirst(4))
            return c.count >= 3 ? "\(c.dropLast(2)) \(c.suffix(2))" : c
        }
        return symbol
    }

    /// FX pairs quote in pips; everything else in cents.
    static func price(_ symbol: String, _ value: Double) -> String {
        if symbol.uppercased().hasPrefix("FX:") {
            let wide = ["JPY", "HUF", "KRW"].contains(String(symbol.uppercased().suffix(3)))
            return value.formatted(.number.precision(.fractionLength(wide ? 4 : 5)))
        }
        // Sub-dollar prints keep their information: SHIB at two decimals
        // is "$0.00", which is a rounding error wearing a price's clothes.
        if value != 0, abs(value) < 1 {
            return value.formatted(.currency(code: "USD").precision(.significantDigits(4)))
        }
        return value.formatted(.currency(code: "USD").precision(.fractionLength(2)))
    }
}

// MARK: - Bars (the chart's fuel — epoch seconds, lightweight-charts convention)

struct APIBar: Decodable, Identifiable, Equatable {
    var id: Double { time }
    let time: Double
    let open: Double
    let high: Double
    let low: Double
    let close: Double
    let volume: Double

    var date: Date { Date(timeIntervalSince1970: time) }
}

struct BarsResponse: Decodable {
    let ok: Bool
    let bars: [APIBar]
    let source: String?
}

// MARK: - Orders

struct PlacedOrderPayload: Decodable {
    let id: String
    let symbol: String
    let side: String
    let qty: Double
    let status: String        // filled | accepted | rejected
    let filledPrice: Double?
    let rejectReason: String?
}

struct PlaceOrderResponse: Decodable {
    let ok: Bool
    let order: PlacedOrderPayload?
    let error: String?
}

// MARK: - Order history

struct APIOrder: Decodable, Identifiable, Equatable {
    let id: String
    let symbol: String
    let side: String
    let type: String
    let qty: Double
    let status: String
    let filledPrice: Double?
    let filledQty: Double?
    let rejectReason: String?
    let createdAt: Double
}

struct OrdersResponse: Decodable {
    let ok: Bool
    let orders: [APIOrder]
}

// MARK: - Margin what-if (the server prices the contemplated leg)

struct MarginPreview: Decodable, Equatable {
    let symbol: String
    let qty: Double
    let imBefore: Double
    let imAfter: Double
    let delta: Double
    let naiveDelta: Double
    /// How much cheaper than margining this contract alone — the hedge credit.
    let creditVsNaive: Double
    let affordable: Bool
}

struct MarginResponse: Decodable {
    let ok: Bool
    let risk: AccountRiskPayload
    let rates: FinancingRatesPayload
    let preview: MarginPreview?
}

// MARK: - Margin desk

struct MarginPositionRow: Decodable, Identifiable, Equatable {
    var id: String { symbol }
    let symbol: String
    let qty: Double
    let regime: String     // Reg-T | SPAN | Cash | Cash-secured
    let detail: String
}

struct MarginCallState: Decodable, Equatable {
    let at: Double
    let cureBy: Double
}

struct MarginDeskResponse: Decodable {
    let ok: Bool
    let risk: AccountRiskPayload
    let rates: FinancingRatesPayload
    let positions: [MarginPositionRow]
    let marginCall: MarginCallState?
}

// MARK: - Risk analytics

struct RiskCorrelation: Decodable, Identifiable, Equatable {
    var id: String { symbol }
    let symbol: String
    let toBench: Double?
    let weight: Double
}

struct RiskBenchmark: Decodable, Equatable {
    let yours: Double?
    let bench: Double?
    let excess: Double?
    let days: Int
}

struct RiskReportPayload: Decodable, Equatable {
    let beta: Double?
    let annualVol: Double?
    let benchVol: Double?
    let maxDrawdown: Double?
    let concentration: Double?
    let effectivePositions: Double?
    let correlations: [RiskCorrelation]
    let benchmark: RiskBenchmark
}

struct RiskResponse: Decodable {
    let ok: Bool
    let report: RiskReportPayload
}

// MARK: - Journal

struct JournalEntryPayload: Decodable, Identifiable, Equatable {
    let id: String
    let symbol: String
    let side: String
    let qty: Double
    let entryPrice: Double
    let exitPrice: Double?
    let pnl: Double?
    let thesis: String?
    let createdAt: Double
}

struct JournalSummary: Decodable, Equatable {
    let trades: Int
    let realized: Double
    let winRate: Double?
    let events: Int
}

struct JournalResponse: Decodable {
    let ok: Bool
    let entries: [JournalEntryPayload]
    let summary: JournalSummary
}

// MARK: - Notifications & alerts (the living layer)

struct APINotification: Decodable, Identifiable, Equatable {
    let id: String
    let kind: String          // fill | margin | analyst | alert | system
    let title: String
    let body: String?
    let href: String?
    let readAt: Double?
    let createdAt: Double
}

struct SinceYouLeft: Decodable, Equatable {
    let since: Double
    let fills: Int
}

struct NotificationsResponse: Decodable {
    let ok: Bool
    let notifications: [APINotification]
    let unread: Int
    let digest: SinceYouLeft?
}

struct APIAlert: Decodable, Identifiable, Equatable {
    let id: String
    let symbol: String
    let price: Double
    let direction: String     // above | below
    let triggeredAt: Double?
    let createdAt: Double

    /// The reserved symbol for a margin-usage alert; price is the fraction.
    var isMargin: Bool { symbol.uppercased() == "$MARGIN" }
}

struct AlertsResponse: Decodable {
    let ok: Bool
    let alerts: [APIAlert]
}

// MARK: - Analysts (the floor) & the assistant

struct AnalystBacktestSide: Decodable, Equatable {
    /*
      The server names this field "return" — a Swift keyword, so it needs an
      explicit mapping. Worth stating plainly: I guessed "totalReturn" first
      and it decoded to nil in SILENCE, because an optional swallows a name
      it doesn't recognise. The screenshot is what caught it. Any field this
      file gets wrong should be assumed missing on screen, not throwing.
    */
    let totalReturn: Double?
    let maxDrawdown: Double?
    let trades: Int?
    let winRate: Double?

    enum CodingKeys: String, CodingKey {
        case totalReturn = "return"
        case maxDrawdown, trades, winRate
    }
}

struct AnalystBacktest: Decodable, Equatable {
    let verdict: String?
    let inSample: AnalystBacktestSide?
    let outOfSample: AnalystBacktestSide?
}

struct APIAnalyst: Decodable, Identifiable, Equatable {
    let id: String
    let name: String
    let emoji: String
    let status: String        // draft | backtested | running | paused | killed
    let allocation: Double
    let maxDrawdown: Double
    let pnl: Double?
    let thesis: String?
    let backtest: AnalystBacktest?
    let createdAt: Double
}

struct AnalystsResponse: Decodable {
    let ok: Bool
    let agents: [APIAnalyst]
}

struct AssistantMessage: Decodable, Identifiable, Equatable {
    let id: String
    let role: String          // user | assistant
    let text: String
    let createdAt: Double?
}

struct AssistantHistoryResponse: Decodable {
    let ok: Bool
    let messages: [AssistantMessage]
}

struct AssistantTurnResponse: Decodable {
    let ok: Bool
    let reply: String?
    let acted: Bool?
    let error: String?
}
