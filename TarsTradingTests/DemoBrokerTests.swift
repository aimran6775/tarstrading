import XCTest
@testable import TarsTrading

/// Tests for the in-memory matching engine. All orders use crypto symbols
/// (BTC/USD) because crypto trades around the clock — MarketClock gates fills
/// by real wall-clock time, and equity fills would make these tests flaky at
/// night and on weekends. DemoMarket prices only move on tick(), which these
/// tests never call, so the quote is stable within each test.
final class DemoBrokerTests: XCTestCase {

    fileprivate func makeBroker(cash: Double = 500_000) -> (DemoMarket, DemoBroker) {
        let market = DemoMarket()
        return (market, DemoBroker(market: market, startingCash: cash))
    }

    // MARK: - Market orders

    func testMarketBuyFillsWithinSlippageBoundsAndDebitsCash() async throws {
        let (market, broker) = makeBroker(cash: 500_000)
        let quote = market.price(of: "BTC/USD")
        XCTAssertGreaterThan(quote, 0)

        let order = try await broker.submit(OrderDraft(
            symbol: "BTC/USD", assetClass: .crypto, side: .buy, type: .market, qty: 2))

        XCTAssertEqual(order.status, .filled)
        XCTAssertEqual(order.filledQty, 2)
        let fillPrice = try XCTUnwrap(order.filledAvgPrice)
        // Buy slippage is 0–4 bps against you, never in your favor.
        XCTAssertGreaterThanOrEqual(fillPrice, quote)
        XCTAssertLessThanOrEqual(fillPrice, quote * 1.00041)

        let account = try await broker.account()
        XCTAssertEqual(account.cash, 500_000 - 2 * fillPrice, accuracy: 1e-6)

        let positions = try await broker.positions()
        XCTAssertEqual(positions.count, 1)
        XCTAssertEqual(positions[0].symbol, "BTC/USD")
        XCTAssertEqual(positions[0].qty, 2)
        XCTAssertEqual(positions[0].avgEntryPrice, fillPrice, accuracy: 1e-9)
    }

    func testMarketSellCreditsCashAndClearsPosition() async throws {
        let (_, broker) = makeBroker(cash: 500_000)
        let buy = try await broker.submit(OrderDraft(
            symbol: "BTC/USD", assetClass: .crypto, side: .buy, type: .market, qty: 1))
        let cashAfterBuy = try await broker.account().cash

        let sell = try await broker.submit(OrderDraft(
            symbol: "BTC/USD", assetClass: .crypto, side: .sell, type: .market, qty: 1))
        XCTAssertEqual(sell.status, .filled)
        let sellPrice = try XCTUnwrap(sell.filledAvgPrice)
        // Sell slippage is 0–4 bps below the quote, and the quote hasn't moved.
        let buyPrice = try XCTUnwrap(buy.filledAvgPrice)
        XCTAssertLessThanOrEqual(sellPrice, buyPrice * 1.00041)

        let account = try await broker.account()
        XCTAssertEqual(account.cash, cashAfterBuy + sellPrice, accuracy: 1e-6)
        let positions = try await broker.positions()
        XCTAssertTrue(positions.isEmpty, "flat position should be removed entirely")
    }

    // MARK: - Limit orders

    func testLimitBuyRestsThenFillsAtLimitWhenPriceIsThrough() async throws {
        let (market, broker) = makeBroker()
        let quote = market.price(of: "BTC/USD")
        // Buy limit above the market: price <= limit is already satisfied, but
        // limit orders never fill at submit — they rest until the matcher runs.
        let limit = quote * 1.02
        let order = try await broker.submit(OrderDraft(
            symbol: "BTC/USD", assetClass: .crypto, side: .buy, type: .limit,
            qty: 1, limitPrice: limit))
        XCTAssertTrue(order.status.isOpen, "limit order should rest at submit")

        broker.processOpenOrders()

        let all = try await broker.orders(open: false)
        let filled = try XCTUnwrap(all.first { $0.id == order.id })
        XCTAssertEqual(filled.status, .filled)
        XCTAssertEqual(try XCTUnwrap(filled.filledAvgPrice), limit, accuracy: 1e-9)
    }

    func testLimitBuyBelowMarketKeepsResting() async throws {
        let (market, broker) = makeBroker()
        let quote = market.price(of: "BTC/USD")
        let order = try await broker.submit(OrderDraft(
            symbol: "BTC/USD", assetClass: .crypto, side: .buy, type: .limit,
            qty: 1, limitPrice: quote * 0.5))
        broker.processOpenOrders()
        let open = try await broker.orders(open: true)
        XCTAssertTrue(open.contains { $0.id == order.id }, "deep limit should still be resting")
    }

    // MARK: - Rejections

    func testInsufficientBuyingPowerRejectsBuy() async throws {
        let (_, broker) = makeBroker(cash: 1_000)   // BTC costs ~5 figures
        do {
            _ = try await broker.submit(OrderDraft(
                symbol: "BTC/USD", assetClass: .crypto, side: .buy, type: .market, qty: 1))
            XCTFail("expected orderRejected")
        } catch let error as TarsError {
            guard case .orderRejected = error else {
                return XCTFail("wrong error: \(error)")
            }
        }
        let account = try await broker.account()
        XCTAssertEqual(account.cash, 1_000, accuracy: 1e-9, "rejected order must not touch cash")
    }

    func testSellWithoutInventoryIsRejected() async throws {
        let (_, broker) = makeBroker()
        do {
            _ = try await broker.submit(OrderDraft(
                symbol: "BTC/USD", assetClass: .crypto, side: .sell, type: .market, qty: 1))
            XCTFail("expected orderRejected — demo has no shorting")
        } catch let error as TarsError {
            guard case .orderRejected = error else {
                return XCTFail("wrong error: \(error)")
            }
        }
    }

    func testUnknownSymbolIsRejected() async throws {
        let (_, broker) = makeBroker()
        do {
            _ = try await broker.submit(OrderDraft(
                symbol: "NOPE/USD", assetClass: .crypto, side: .buy, type: .market, qty: 1))
            XCTFail("expected orderRejected for unknown symbol")
        } catch let error as TarsError {
            guard case .orderRejected = error else {
                return XCTFail("wrong error: \(error)")
            }
        }
    }

    // MARK: - Brackets

    func testBracketLegsSpawnAfterParentFill() async throws {
        let (market, broker) = makeBroker()
        let quote = market.price(of: "BTC/USD")
        let tp = quote * 1.20
        let sl = quote * 0.80
        let parent = try await broker.submit(OrderDraft(
            symbol: "BTC/USD", assetClass: .crypto, side: .buy, type: .market, qty: 1,
            bracket: BracketLevels(takeProfit: tp, stopLoss: sl)))
        XCTAssertEqual(parent.status, .filled, "crypto market order fills immediately")

        let open = try await broker.orders(open: true)
        let legs = open.filter { $0.symbol == "BTC/USD" }
        XCTAssertEqual(legs.count, 2, "one take-profit leg and one stop-loss leg")

        let tpLeg = try XCTUnwrap(legs.first { $0.type == .limit })
        XCTAssertEqual(tpLeg.side, .sell)
        XCTAssertEqual(try XCTUnwrap(tpLeg.limitPrice), tp, accuracy: 1e-9)
        XCTAssertEqual(tpLeg.qty, 1)

        let slLeg = try XCTUnwrap(legs.first { $0.type == .stop })
        XCTAssertEqual(slLeg.side, .sell)
        XCTAssertEqual(try XCTUnwrap(slLeg.stopPrice), sl, accuracy: 1e-9)
        XCTAssertEqual(slLeg.qty, 1)
    }

    // MARK: - Cancel / close

    func testCancelOpenOrder() async throws {
        let (market, broker) = makeBroker()
        let quote = market.price(of: "BTC/USD")
        let order = try await broker.submit(OrderDraft(
            symbol: "BTC/USD", assetClass: .crypto, side: .buy, type: .limit,
            qty: 1, limitPrice: quote * 0.5))
        try await broker.cancel(orderID: order.id)
        let all = try await broker.orders(open: false)
        XCTAssertEqual(all.first { $0.id == order.id }?.status, .canceled)
        let open = try await broker.orders(open: true)
        XCTAssertFalse(open.contains { $0.id == order.id })
    }

    func testClosePositionSubmitsOppositeMarketOrder() async throws {
        let (_, broker) = makeBroker()
        _ = try await broker.submit(OrderDraft(
            symbol: "ETH/USD", assetClass: .crypto, side: .buy, type: .market, qty: 3))
        let close = try await broker.closePosition(symbol: "ETH/USD")
        XCTAssertEqual(close.side, .sell)
        XCTAssertEqual(close.qty, 3)
        XCTAssertEqual(close.status, .filled)
        let positions = try await broker.positions()
        XCTAssertTrue(positions.isEmpty)
    }

    func testClosePositionWithoutPositionThrows() async throws {
        let (_, broker) = makeBroker()
        do {
            _ = try await broker.closePosition(symbol: "BTC/USD")
            XCTFail("expected orderRejected")
        } catch let error as TarsError {
            guard case .orderRejected = error else {
                return XCTFail("wrong error: \(error)")
            }
        }
    }

    // MARK: - Cost-basis blending

    func testAddingToPositionBlendsCostBasis() async throws {
        let (_, broker) = makeBroker()
        let first = try await broker.submit(OrderDraft(
            symbol: "BTC/USD", assetClass: .crypto, side: .buy, type: .market, qty: 1))
        let second = try await broker.submit(OrderDraft(
            symbol: "BTC/USD", assetClass: .crypto, side: .buy, type: .market, qty: 3))
        let p1 = try XCTUnwrap(first.filledAvgPrice)
        let p2 = try XCTUnwrap(second.filledAvgPrice)
        let positions = try await broker.positions()
        let pos = try XCTUnwrap(positions.first { $0.symbol == "BTC/USD" })
        XCTAssertEqual(pos.qty, 4)
        XCTAssertEqual(pos.avgEntryPrice, (p1 * 1 + p2 * 3) / 4, accuracy: 1e-6)
    }
}
