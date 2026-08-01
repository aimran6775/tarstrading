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

struct BoardResponse: Decodable {
    let ok: Bool
    let marketOpen: Bool?
    let count: Int?
    let rows: [BoardRowPayload]
    let asOf: Double?
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
