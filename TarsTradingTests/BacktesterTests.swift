import XCTest
@testable import TarsTrading

/// The backtester is the honesty engine of the Agent Lab — these tests pin its
/// segmentation, risk enforcement, and kill switch to deterministic synthetic
/// series constructed inline (no market data, no randomness, no Date.now math).
final class BacktesterTests: XCTestCase {

    // MARK: - Guards

    func testTooFewBarsReturnsNil() {
        let agent = trendAgent()
        let bars = makeBars(closes: (0..<50).map { 100 + Double($0) })
        XCTAssertNil(Backtester().run(agent: agent, barsBySymbol: ["TEST": bars]))
    }

    func testMissingUniverseDataReturnsNil() {
        let agent = trendAgent()
        XCTAssertNil(Backtester().run(agent: agent, barsBySymbol: [:]))
    }

    // MARK: - Clean uptrend with an SMA agent

    func testUptrendAgentTradesAndSegmentsSeventyThirty() throws {
        // 100 bars, close = 100 + i: price sits above its 5-bar SMA the whole
        // way, so the agent enters as soon as the SMA exists and take-profit
        // exits recycle the position repeatedly.
        let closes = (0..<100).map { 100.0 + Double($0) }
        let agent = trendAgent()
        let result = try XCTUnwrap(
            Backtester().run(agent: agent, barsBySymbol: ["TEST": makeBars(closes: closes)]))

        XCTAssertFalse(result.trades.isEmpty, "an uptrend must produce trades")
        for trade in result.trades {
            XCTAssertGreaterThan(trade.exitIndex, trade.entryIndex)
            XCTAssertGreaterThan(trade.pnlPercent, 0, "every take-profit exit in a clean uptrend wins")
        }

        // 70/30 split is architectural, not cosmetic.
        XCTAssertEqual(result.inSample.equity.count, 70)
        XCTAssertEqual(result.outOfSample.equity.count, 30)
        XCTAssertEqual(result.inSample.label, "In-sample")
        XCTAssertEqual(result.outOfSample.label, "Out-of-sample")

        for segment in [result.inSample, result.outOfSample] {
            XCTAssertGreaterThanOrEqual(segment.maxDrawdown, 0)
            XCTAssertLessThanOrEqual(segment.maxDrawdown, 1)
            XCTAssertGreaterThanOrEqual(segment.winRate, 0)
            XCTAssertLessThanOrEqual(segment.winRate, 1)
            XCTAssertGreaterThanOrEqual(segment.exposure, 0)
            XCTAssertLessThanOrEqual(segment.exposure, 1)
        }
        XCTAssertGreaterThan(result.inSample.totalReturn, 0)
        XCTAssertEqual(result.inSample.tradeCount + result.outOfSample.tradeCount,
                       result.trades.count)

        // Equal-weight buy & hold of the universe: 100 → 199.
        XCTAssertEqual(result.benchmarkReturn, 0.99, accuracy: 1e-9)
    }

    func testAgentThatNeverSignalsStaysFlat() throws {
        let closes = (0..<100).map { 100.0 + Double($0) }
        var agent = trendAgent()
        agent.entry = [SignalRule(lhs: .price, comparator: .isAbove, rhs: .constant(1e12))]
        let result = try XCTUnwrap(
            Backtester().run(agent: agent, barsBySymbol: ["TEST": makeBars(closes: closes)]))
        XCTAssertTrue(result.trades.isEmpty)
        XCTAssertEqual(result.inSample.totalReturn, 0, accuracy: 1e-12)
        XCTAssertEqual(result.inSample.maxDrawdown, 0, accuracy: 1e-12)
        XCTAssertEqual(result.inSample.exposure, 0, accuracy: 1e-12)
        XCTAssertTrue(result.inSample.equity.allSatisfy { $0 == agent.allocation })
    }

    // MARK: - Kill switch

    func testKillSwitchTriggersOnCrashAndHaltsForever() throws {
        // Flat at 100 for 20 bars, then a relentless -2%/bar slide. The agent
        // goes all-in on bar 1 with no stop and no exit rules, so the only
        // thing standing between it and the abyss is the max-drawdown kill
        // switch (15% default) — which must fire and liquidate.
        var closes = [Double](repeating: 100, count: 20)
        for i in 20..<80 { closes.append(100 * pow(0.98, Double(i - 19))) }

        var agent = trendAgent()
        agent.entry = [SignalRule(lhs: .price, comparator: .isAbove, rhs: .constant(0))]
        agent.exit = []
        agent.stopLossPercent = nil
        agent.takeProfitPercent = nil
        agent.risk = RiskLimits(maxPositionPercent: 100, maxDailyLossPercent: 100,
                                maxDrawdownPercent: 15, maxPositions: 1)

        let result = try XCTUnwrap(
            Backtester().run(agent: agent, barsBySymbol: ["TEST": makeBars(closes: closes)]))

        let killTrades = result.trades.filter { $0.reason.contains("KILL SWITCH") }
        XCTAssertEqual(killTrades.count, 1, "the forced liquidation is recorded as a trade")
        let kill = try XCTUnwrap(killTrades.first)
        XCTAssertEqual(kill.entryIndex, 1)
        XCTAssertGreaterThanOrEqual(kill.exitIndex, 20, "can't be killed before the crash starts")
        XCTAssertLessThan(kill.exitIndex, 56, "kill lands in-sample for this series")

        // Once killed, the agent never trades again: equity is cash, frozen.
        let out = result.outOfSample.equity
        XCTAssertTrue(out.allSatisfy { $0 == out[0] }, "post-kill equity curve must be flat")

        // Drawdown breached the 15% line (that's why it fired) but is a sane fraction.
        XCTAssertGreaterThan(result.inSample.maxDrawdown, 0.15)
        XCTAssertLessThanOrEqual(result.inSample.maxDrawdown, 1)
    }

    // MARK: - Determinism

    func testBacktestIsDeterministic() throws {
        let closes = (0..<100).map { 100.0 + Double($0) }
        let bars = makeBars(closes: closes)
        let agent = trendAgent()
        let a = try XCTUnwrap(Backtester().run(agent: agent, barsBySymbol: ["TEST": bars]))
        let b = try XCTUnwrap(Backtester().run(agent: agent, barsBySymbol: ["TEST": bars]))
        XCTAssertEqual(a.inSample.equity, b.inSample.equity)
        XCTAssertEqual(a.outOfSample.equity, b.outOfSample.equity)
        XCTAssertEqual(a.trades.map(\.exitIndex), b.trades.map(\.exitIndex))
        XCTAssertEqual(a.benchmarkReturn, b.benchmarkReturn)
    }
}

// MARK: - Fixtures

fileprivate let epoch = Date(timeIntervalSince1970: 1_700_000_000)

fileprivate func makeBars(closes: [Double]) -> [Bar] {
    closes.enumerated().map { i, close in
        Bar(time: epoch.addingTimeInterval(Double(i) * 86_400),
            open: close, high: close, low: close, close: close, volume: 1_000)
    }
}

/// A simple trend follower: hold while price is above its 5-bar SMA, bank 5%.
fileprivate func trendAgent() -> TradingAgent {
    TradingAgent(
        name: "Test Trend",
        universe: ["TEST"],
        entry: [SignalRule(lhs: .price, comparator: .isAbove, rhs: .indicator(.sma(5)))],
        exit: [SignalRule(lhs: .price, comparator: .crossesBelow, rhs: .indicator(.sma(5)))],
        stopLossPercent: nil,
        takeProfitPercent: 5)
}
