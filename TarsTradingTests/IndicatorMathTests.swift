import XCTest
@testable import TarsTrading

/// Golden-value tests for the shared indicator math. These numbers are
/// hand-computed (or derived from the classic Wilder RSI worked example), so a
/// regression here means simulated and live agents both changed behavior.
final class IndicatorMathTests: XCTestCase {

    // MARK: - SMA

    func testSMAGoldenValuesAndLeadingNaN() {
        let bars = makeBars(closes: [1, 2, 3, 4, 5])
        let out = IndicatorMath.series(.sma(3), bars: bars)
        XCTAssertEqual(out.count, 5)
        XCTAssertTrue(out[0].isNaN)
        XCTAssertTrue(out[1].isNaN)
        XCTAssertEqual(out[2], 2, accuracy: 1e-12)
        XCTAssertEqual(out[3], 3, accuracy: 1e-12)
        XCTAssertEqual(out[4], 4, accuracy: 1e-12)
    }

    func testSMAWindowEqualsSeriesLength() {
        let bars = makeBars(closes: [2, 4, 6])
        let out = IndicatorMath.series(.sma(3), bars: bars)
        XCTAssertTrue(out[0].isNaN)
        XCTAssertTrue(out[1].isNaN)
        XCTAssertEqual(out[2], 4, accuracy: 1e-12)
    }

    func testSMAWindowLongerThanSeriesIsAllNaN() {
        let bars = makeBars(closes: [1, 2, 3])
        let out = IndicatorMath.series(.sma(5), bars: bars)
        XCTAssertEqual(out.count, 3)
        XCTAssertTrue(out.allSatisfy(\.isNaN))
    }

    // MARK: - EMA

    func testEMAGoldenValuesSeededWithSMA() {
        // EMA(3) over 1...5: k = 0.5, seed = mean(1,2,3) = 2 at index 2,
        // then 4*0.5 + 2*0.5 = 3, then 5*0.5 + 3*0.5 = 4.
        let bars = makeBars(closes: [1, 2, 3, 4, 5])
        let out = IndicatorMath.series(.ema(3), bars: bars)
        XCTAssertTrue(out[0].isNaN)
        XCTAssertTrue(out[1].isNaN)
        XCTAssertEqual(out[2], 2, accuracy: 1e-12)
        XCTAssertEqual(out[3], 3, accuracy: 1e-12)
        XCTAssertEqual(out[4], 4, accuracy: 1e-12)
    }

    func testEMAInsufficientHistoryIsAllNaN() {
        let bars = makeBars(closes: [1, 2])
        let out = IndicatorMath.series(.ema(3), bars: bars)
        XCTAssertEqual(out.count, 2)
        XCTAssertTrue(out.allSatisfy(\.isNaN))
    }

    // MARK: - RSI

    func testRSI3GoldenValuesHandComputed() {
        // Closes 10,11,12,11,12,13 → diffs +1,+1,-1,+1,+1.
        // Seed over first 3 diffs: avgGain 2/3, avgLoss 1/3 → RSI 66.667.
        // Wilder smoothing gives 77.778 then 85.185.
        let bars = makeBars(closes: [10, 11, 12, 11, 12, 13])
        let out = IndicatorMath.series(.rsi(3), bars: bars)
        XCTAssertTrue(out[0].isNaN)
        XCTAssertTrue(out[1].isNaN)
        XCTAssertTrue(out[2].isNaN)
        XCTAssertEqual(out[3], 66.6666666666, accuracy: 1e-9)
        XCTAssertEqual(out[4], 77.7777777777, accuracy: 1e-9)
        XCTAssertEqual(out[5], 85.1851851851, accuracy: 1e-9)
    }

    func testRSI14GoldenValuesWilderSeries() {
        // The classic StockCharts/Wilder worked example (20 closes).
        let closes: [Double] = [
            44.34, 44.09, 44.15, 43.61, 44.33, 44.83, 45.10, 45.42, 45.84, 46.08,
            45.89, 46.03, 45.61, 46.28, 46.28, 46.00, 46.03, 46.41, 46.22, 45.64,
        ]
        let out = IndicatorMath.series(.rsi(14), bars: makeBars(closes: closes))
        for i in 0..<14 { XCTAssertTrue(out[i].isNaN, "index \(i) should be NaN") }
        XCTAssertEqual(out[14], 70.46413502109705, accuracy: 1e-9)
        XCTAssertEqual(out[15], 66.24961855355505, accuracy: 1e-9)
        XCTAssertEqual(out[16], 66.48094183471265, accuracy: 1e-9)
        XCTAssertEqual(out[17], 69.34685316290866, accuracy: 1e-9)
        XCTAssertEqual(out[18], 66.29471265892624, accuracy: 1e-9)
        XCTAssertEqual(out[19], 57.91502067008556, accuracy: 1e-9)
    }

    func testRSIExtremes() {
        // Straight up → no losses → RSI 100. Straight down → no gains → RSI 0.
        let up = IndicatorMath.series(.rsi(3), bars: makeBars(closes: [1, 2, 3, 4, 5]))
        XCTAssertEqual(up[3], 100, accuracy: 1e-12)
        XCTAssertEqual(up[4], 100, accuracy: 1e-12)
        let down = IndicatorMath.series(.rsi(3), bars: makeBars(closes: [5, 4, 3, 2, 1]))
        XCTAssertEqual(down[3], 0, accuracy: 1e-12)
        XCTAssertEqual(down[4], 0, accuracy: 1e-12)
    }

    func testRSINeedsMoreThanNBars() {
        // Exactly n bars → no value; n+1 bars → first value lands at index n.
        let short = IndicatorMath.series(.rsi(3), bars: makeBars(closes: [1, 2, 3]))
        XCTAssertTrue(short.allSatisfy(\.isNaN))
        let exact = IndicatorMath.series(.rsi(3), bars: makeBars(closes: [1, 2, 3, 4]))
        XCTAssertTrue(exact[2].isNaN)
        XCTAssertFalse(exact[3].isNaN)
    }

    // MARK: - Highest high / lowest low

    func testHighestHighAndLowestLowWindows() {
        let bars = [
            makeBar(high: 10, low: 1, close: 5, index: 0),
            makeBar(high: 12, low: 3, close: 6, index: 1),
            makeBar(high: 8, low: 2, close: 4, index: 2),
            makeBar(high: 15, low: 5, close: 9, index: 3),
        ]
        let hh = IndicatorMath.series(.highestHigh(2), bars: bars)
        XCTAssertTrue(hh[0].isNaN)
        XCTAssertEqual(hh[1], 12, accuracy: 1e-12)
        XCTAssertEqual(hh[2], 12, accuracy: 1e-12)
        XCTAssertEqual(hh[3], 15, accuracy: 1e-12)
        let ll = IndicatorMath.series(.lowestLow(3), bars: bars)
        XCTAssertTrue(ll[0].isNaN)
        XCTAssertTrue(ll[1].isNaN)
        XCTAssertEqual(ll[2], 1, accuracy: 1e-12)
        XCTAssertEqual(ll[3], 2, accuracy: 1e-12)
    }

    func testPriceSeriesIsCloses() {
        let bars = makeBars(closes: [7, 8, 9])
        XCTAssertEqual(IndicatorMath.series(.price, bars: bars), [7, 8, 9])
    }

    // MARK: - Rule evaluation truth table

    func testCrossesAboveTruthTable() {
        // (prev, now) against constant 2 → expected crossesAbove result.
        let cases: [(prev: Double, now: Double, expected: Bool)] = [
            (1, 3, true),    // below → above: cross
            (2, 3, true),    // at → above: cross (prev <= rhs)
            (3, 4, false),   // already above: no cross
            (1, 2, false),   // below → at: not strictly above
            (2, 2, false),   // flat at the line
            (3, 1, false),   // wrong direction
        ]
        for c in cases {
            let result = evaluatePriceRule(prev: c.prev, now: c.now, comparator: .crossesAbove, constant: 2)
            XCTAssertEqual(result, c.expected, "crossesAbove prev=\(c.prev) now=\(c.now)")
        }
    }

    func testCrossesBelowTruthTable() {
        let cases: [(prev: Double, now: Double, expected: Bool)] = [
            (3, 1, true),    // above → below: cross
            (2, 1, true),    // at → below: cross (prev >= rhs)
            (1, 0.5, false), // already below: no cross
            (3, 2, false),   // above → at: not strictly below
            (2, 2, false),   // flat at the line
            (1, 3, false),   // wrong direction
        ]
        for c in cases {
            let result = evaluatePriceRule(prev: c.prev, now: c.now, comparator: .crossesBelow, constant: 2)
            XCTAssertEqual(result, c.expected, "crossesBelow prev=\(c.prev) now=\(c.now)")
        }
    }

    func testIsAboveIsBelowUseOnlyCurrentBar() {
        XCTAssertTrue(evaluatePriceRule(prev: 1, now: 3, comparator: .isAbove, constant: 2))
        XCTAssertFalse(evaluatePriceRule(prev: 3, now: 2, comparator: .isAbove, constant: 2))
        XCTAssertTrue(evaluatePriceRule(prev: 3, now: 1, comparator: .isBelow, constant: 2))
        XCTAssertFalse(evaluatePriceRule(prev: 1, now: 2, comparator: .isBelow, constant: 2))
    }

    func testEvaluateAtIndexZeroIsAlwaysFalse() {
        let bars = makeBars(closes: [5, 6])
        let rule = SignalRule(lhs: .price, comparator: .isAbove, rhs: .constant(0))
        let series: [Indicator: [Double]] = [.price: bars.map(\.close)]
        XCTAssertFalse(IndicatorMath.evaluate(rule, at: 0, series: series, bars: bars))
        XCTAssertTrue(IndicatorMath.evaluate(rule, at: 1, series: series, bars: bars))
    }

    func testCrossWithNaNPreviousValueIsFalse() {
        // sma(2) over [1, 5] is [NaN, 3]: at i=1 the previous value is NaN, so
        // a cross can't be claimed — but a plain isAbove still can.
        let bars = makeBars(closes: [1, 5])
        let sma = IndicatorMath.series(.sma(2), bars: bars)
        let series: [Indicator: [Double]] = [.sma(2): sma, .price: bars.map(\.close)]
        let cross = SignalRule(lhs: .sma(2), comparator: .crossesAbove, rhs: .constant(2))
        XCTAssertFalse(IndicatorMath.evaluate(cross, at: 1, series: series, bars: bars))
        let above = SignalRule(lhs: .sma(2), comparator: .isAbove, rhs: .constant(2))
        XCTAssertTrue(IndicatorMath.evaluate(above, at: 1, series: series, bars: bars))
    }

    func testIndicatorVersusIndicatorCross() {
        // Price crosses above sma(2): closes [4, 2, 5] → sma [NaN, 3, 3.5].
        // At i=2: prev price 2 <= prev sma 3, now 5 > 3.5 → cross.
        let bars = makeBars(closes: [4, 2, 5])
        let series: [Indicator: [Double]] = [
            .price: bars.map(\.close),
            .sma(2): IndicatorMath.series(.sma(2), bars: bars),
        ]
        let rule = SignalRule(lhs: .price, comparator: .crossesAbove, rhs: .indicator(.sma(2)))
        XCTAssertFalse(IndicatorMath.evaluate(rule, at: 1, series: series, bars: bars))
        XCTAssertTrue(IndicatorMath.evaluate(rule, at: 2, series: series, bars: bars))
    }

    func testRequiredIndicatorsCollectsBothSides() {
        let rules = [
            SignalRule(lhs: .price, comparator: .crossesAbove, rhs: .indicator(.sma(50))),
            SignalRule(lhs: .rsi(14), comparator: .isBelow, rhs: .constant(30)),
        ]
        XCTAssertEqual(IndicatorMath.requiredIndicators(rules),
                       [.price, .sma(50), .rsi(14)])
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

fileprivate func makeBar(high: Double, low: Double, close: Double, index: Int) -> Bar {
    Bar(time: epoch.addingTimeInterval(Double(index) * 86_400),
        open: close, high: high, low: low, close: close, volume: 1_000)
}

/// Evaluates `price <comparator> constant` at index 1 of a two-bar series.
fileprivate func evaluatePriceRule(prev: Double, now: Double,
                                   comparator: TarsTrading.Comparator, constant: Double) -> Bool {
    let bars = makeBars(closes: [prev, now])
    let rule = SignalRule(lhs: .price, comparator: comparator, rhs: .constant(constant))
    return IndicatorMath.evaluate(rule, at: 1, series: [.price: bars.map(\.close)], bars: bars)
}
