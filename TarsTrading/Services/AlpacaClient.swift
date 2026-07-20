import Foundation

/// Alpaca Paper API client. Auth via APCA headers; base URL from AppConfig.
/// Wire DTOs are private — the app only sees domain models.
final class AlpacaClient: TradingProviding, Sendable {
    private let http = HTTPClient(cacheTTL: 5)

    private var headers: [String: String] {
        ["APCA-API-KEY-ID": Secrets.alpacaKeyID,
         "APCA-API-SECRET-KEY": Secrets.alpacaSecret]
    }

    private func url(_ path: String, query: [String: String] = [:]) -> URL {
        var comps = URLComponents(url: AppConfig.alpacaBase.appending(path: path),
                                  resolvingAgainstBaseURL: false)!
        if !query.isEmpty {
            comps.queryItems = query.map { URLQueryItem(name: $0, value: $1) }
        }
        return comps.url!
    }

    // MARK: - TradingProviding

    func account() async throws -> Account {
        let dto = try await http.get(AccountDTO.self, url: url("account"),
                                     headers: headers, cacheable: false)
        return Account(equity: dto.equity.asDouble,
                       cash: dto.cash.asDouble,
                       buyingPower: dto.buyingPower.asDouble,
                       lastEquity: dto.lastEquity.asDouble)
    }

    func positions() async throws -> [Position] {
        let dtos = try await http.get([PositionDTO].self, url: url("positions"),
                                      headers: headers, cacheable: false)
        return dtos.map { dto in
            Position(symbol: dto.symbol,
                     assetClass: AssetClass(rawValue: dto.assetClass) ?? .usEquity,
                     qty: dto.qty.asDouble,
                     avgEntryPrice: dto.avgEntryPrice.asDouble,
                     currentPrice: dto.currentPrice?.asDouble ?? dto.avgEntryPrice.asDouble)
        }
    }

    func orders(open: Bool) async throws -> [Order] {
        let dtos = try await http.get([OrderDTO].self,
                                      url: url("orders", query: ["status": open ? "open" : "all", "limit": "100"]),
                                      headers: headers, cacheable: false)
        return dtos.map(Self.order(from:))
    }

    func submit(_ draft: OrderDraft) async throws -> Order {
        var body: [String: AnyEncodable] = [
            "symbol": .init(draft.symbol),
            "side": .init(draft.side.rawValue),
            "type": .init(draft.type.rawValue),
            "qty": .init(String(draft.qty)),
            "time_in_force": .init(draft.timeInForce.rawValue),
        ]
        if let p = draft.limitPrice { body["limit_price"] = .init(String(p)) }
        if let p = draft.stopPrice { body["stop_price"] = .init(String(p)) }
        if let p = draft.trailPercent { body["trail_percent"] = .init(String(p)) }
        if let b = draft.bracket {
            body["order_class"] = .init("bracket")
            if let tp = b.takeProfit { body["take_profit"] = .init(["limit_price": String(tp)]) }
            if let sl = b.stopLoss { body["stop_loss"] = .init(["stop_price": String(sl)]) }
        }
        let dto = try await http.send(OrderDTO.self, url: url("orders"),
                                      method: "POST", body: body, headers: headers)
        var order = Self.order(from: dto)
        order.agentID = draft.agentID
        order.agentRationale = draft.agentRationale
        return order
    }

    func cancel(orderID: String) async throws {
        _ = try await http.send(EmptyReply.self, url: url("orders/\(orderID)"),
                                method: "DELETE", body: Optional<Int>.none, headers: headers)
    }

    func closePosition(symbol: String) async throws -> Order {
        let dto = try await http.send(OrderDTO.self, url: url("positions/\(symbol)"),
                                      method: "DELETE", body: Optional<Int>.none, headers: headers)
        return Self.order(from: dto)
    }

    // MARK: - DTOs

    private static func order(from dto: OrderDTO) -> Order {
        Order(id: dto.id,
              symbol: dto.symbol,
              assetClass: AssetClass(rawValue: dto.assetClass ?? "us_equity") ?? .usEquity,
              side: OrderSide(rawValue: dto.side) ?? .buy,
              type: OrderType(rawValue: dto.type) ?? .market,
              qty: dto.qty?.asDouble ?? 0,
              limitPrice: dto.limitPrice?.asDouble,
              stopPrice: dto.stopPrice?.asDouble,
              trailPercent: dto.trailPercent?.asDouble,
              timeInForce: TimeInForce(rawValue: dto.timeInForce) ?? .day,
              bracket: nil,
              status: OrderStatus(rawValue: dto.status) ?? .accepted,
              filledQty: dto.filledQty?.asDouble ?? 0,
              filledAvgPrice: dto.filledAvgPrice?.asDouble,
              submittedAt: dto.submittedAt ?? .now,
              filledAt: dto.filledAt)
    }

    private struct AccountDTO: Decodable {
        let equity: String
        let cash: String
        let buyingPower: String
        let lastEquity: String
    }
    private struct PositionDTO: Decodable {
        let symbol: String
        let assetClass: String
        let qty: String
        let avgEntryPrice: String
        let currentPrice: String?
    }
    private struct OrderDTO: Decodable {
        let id: String
        let symbol: String
        let assetClass: String?
        let side: String
        let type: String
        let qty: String?
        let limitPrice: String?
        let stopPrice: String?
        let trailPercent: String?
        let timeInForce: String
        let status: String
        let filledQty: String?
        let filledAvgPrice: String?
        let submittedAt: Date?
        let filledAt: Date?
    }
    private struct EmptyReply: Decodable {}
}

/// Alpaca sends numbers as strings.
extension String {
    var asDouble: Double { Double(self) ?? 0 }
}

/// Minimal type-erased Encodable for heterogeneous JSON bodies.
struct AnyEncodable: Encodable {
    private let encodeFn: (Encoder) throws -> Void
    init<T: Encodable>(_ value: T) { encodeFn = { try value.encode(to: $0) } }
    func encode(to encoder: Encoder) throws { try encodeFn(encoder) }
}
