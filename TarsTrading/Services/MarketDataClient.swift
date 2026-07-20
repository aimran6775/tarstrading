import Foundation

/// Massive (formerly Polygon.io) market data client. Free tier: 5 req/min,
/// EOD data — so we cache hard and surface data age honestly in the UI.
final class MarketDataClient: MarketProviding, Sendable {
    private let http = HTTPClient(cacheTTL: 300,
                                  requestsPerMinute: AppConfig.marketDataRequestsPerMinute)

    private func url(_ path: String, query: [String: String] = [:]) -> URL {
        var comps = URLComponents(url: AppConfig.marketDataBase.appending(path: path),
                                  resolvingAgainstBaseURL: false)!
        var items = query.map { URLQueryItem(name: $0, value: $1) }
        items.append(URLQueryItem(name: "apiKey", value: Secrets.massiveKey))
        comps.queryItems = items
        return comps.url!
    }

    func quotes(for symbols: [String]) async throws -> [Quote] {
        // Free tier: previous-close endpoint per symbol. Cached 5 min.
        var results: [Quote] = []
        for symbol in symbols {
            let reply = try await http.get(PrevCloseReply.self,
                                           url: url("/v2/aggs/ticker/\(symbol)/prev"))
            if let bar = reply.results?.first {
                results.append(Quote(symbol: symbol,
                                     price: bar.c,
                                     previousClose: bar.o,
                                     asOf: Date(timeIntervalSince1970: bar.t / 1000)))
            }
        }
        return results
    }

    func bars(symbol: String, timeframe: Timeframe) async throws -> [Bar] {
        let (multiplier, span, days): (Int, String, Int) = {
            switch timeframe {
            case .day1: (5, "minute", 1)
            case .week1: (30, "minute", 7)
            case .month1: (1, "day", 31)
            case .month3: (1, "day", 92)
            case .year1: (1, "day", 366)
            case .year5: (1, "week", 1830)
            }
        }()
        let to = Date.now
        let from = to.addingTimeInterval(-Double(days) * 86_400)
        let fmt = { (d: Date) in d.formatted(.iso8601.year().month().day().dateSeparator(.dash)) }
        let reply = try await http.get(
            AggsReply.self,
            url: url("/v2/aggs/ticker/\(symbol)/range/\(multiplier)/\(span)/\(fmt(from))/\(fmt(to))",
                     query: ["adjusted": "true", "sort": "asc", "limit": "5000"]))
        return (reply.results ?? []).map {
            Bar(time: Date(timeIntervalSince1970: $0.t / 1000),
                open: $0.o, high: $0.h, low: $0.l, close: $0.c, volume: $0.v)
        }
    }

    func search(_ query: String) async throws -> [Asset] {
        let reply = try await http.get(TickerSearchReply.self,
                                       url: url("/v3/reference/tickers",
                                                query: ["search": query, "active": "true", "limit": "20"]))
        return (reply.results ?? []).map {
            Asset(symbol: $0.ticker,
                  name: $0.name,
                  assetClass: $0.market == "crypto" ? .crypto : .usEquity,
                  exchange: $0.primaryExchange ?? "")
        }
    }

    // MARK: - Wire DTOs (Polygon aggregate schema)

    private struct AggBar: Decodable {
        let o: Double, h: Double, l: Double, c: Double, v: Double, t: Double
    }
    private struct PrevCloseReply: Decodable { let results: [AggBar]? }
    private struct AggsReply: Decodable { let results: [AggBar]? }
    private struct TickerRef: Decodable {
        let ticker: String
        let name: String
        let market: String
        let primaryExchange: String?
    }
    private struct TickerSearchReply: Decodable { let results: [TickerRef]? }
}
