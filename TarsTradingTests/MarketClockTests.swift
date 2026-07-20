import XCTest
@testable import TarsTrading

/// Session-hour truth for known instants. Every date is constructed explicitly
/// in America/New_York via DateComponents — the only Date.now dependence in the
/// app's clock is bypassed by passing `at:` everywhere.
final class MarketClockTests: XCTestCase {

    // MARK: - Equities keep exchange hours

    func testTuesdayMidMorningIsOpen() {
        let date = eastern(2026, 7, 14, 10, 0)   // Tuesday
        XCTAssertTrue(MarketClock.isOpen(.usEquity, at: date))
        XCTAssertTrue(MarketClock.isOpen(.usOption, at: date))
    }

    func testOpeningBellBoundary() {
        XCTAssertFalse(MarketClock.isOpen(.usEquity, at: eastern(2026, 7, 14, 9, 29)))
        XCTAssertTrue(MarketClock.isOpen(.usEquity, at: eastern(2026, 7, 14, 9, 30)))
    }

    func testClosingBellBoundary() {
        XCTAssertTrue(MarketClock.isOpen(.usEquity, at: eastern(2026, 7, 14, 15, 59)))
        XCTAssertFalse(MarketClock.isOpen(.usEquity, at: eastern(2026, 7, 14, 16, 0)))
        XCTAssertFalse(MarketClock.isOpen(.usEquity, at: eastern(2026, 7, 14, 16, 1)))
    }

    func testWeekendIsClosed() {
        XCTAssertFalse(MarketClock.isOpen(.usEquity, at: eastern(2026, 7, 18, 12, 0)))  // Saturday
        XCTAssertFalse(MarketClock.isOpen(.usEquity, at: eastern(2026, 7, 19, 12, 0)))  // Sunday
        XCTAssertFalse(MarketClock.isOpen(.usOption, at: eastern(2026, 7, 18, 12, 0)))
    }

    func testOvernightIsClosed() {
        XCTAssertFalse(MarketClock.isOpen(.usEquity, at: eastern(2026, 7, 14, 3, 0)))
    }

    func testWinterSessionHoursHoldUnderStandardTime() {
        // January (EST, not EDT): the ET wall clock still governs.
        XCTAssertTrue(MarketClock.isOpen(.usEquity, at: eastern(2026, 1, 13, 10, 0)))   // Tuesday
        XCTAssertFalse(MarketClock.isOpen(.usEquity, at: eastern(2026, 1, 13, 16, 0)))
    }

    // MARK: - Crypto never sleeps

    func testCryptoIsAlwaysOpen() {
        XCTAssertTrue(MarketClock.isOpen(.crypto, at: eastern(2026, 7, 18, 3, 0)))    // Saturday 3am
        XCTAssertTrue(MarketClock.isOpen(.crypto, at: eastern(2026, 7, 14, 10, 0)))   // Tuesday session
        XCTAssertTrue(MarketClock.isOpen(.crypto, at: eastern(2026, 7, 19, 23, 59)))  // Sunday night
    }

    // MARK: - nextOpen

    func testNextOpenFromSaturdayIsMondayBell() throws {
        let next = try XCTUnwrap(MarketClock.nextOpen(after: eastern(2026, 7, 18, 12, 0)))
        assertSameInstant(next, eastern(2026, 7, 20, 9, 30))   // Monday 09:30 ET
    }

    func testNextOpenPreMarketIsSameDayBell() throws {
        let next = try XCTUnwrap(MarketClock.nextOpen(after: eastern(2026, 7, 14, 8, 0)))
        assertSameInstant(next, eastern(2026, 7, 14, 9, 30))
    }

    func testNextOpenDuringSessionIsTomorrowBell() throws {
        // Once today's bell has rung, the next open is tomorrow's.
        let next = try XCTUnwrap(MarketClock.nextOpen(after: eastern(2026, 7, 14, 10, 0)))
        assertSameInstant(next, eastern(2026, 7, 15, 9, 30))   // Wednesday 09:30 ET
    }

    // MARK: - dayStamp

    func testDayStampIsStableAcrossOneTradingDay() {
        let morning = MarketClock.dayStamp(eastern(2026, 7, 14, 0, 5))
        let evening = MarketClock.dayStamp(eastern(2026, 7, 14, 23, 30))
        XCTAssertEqual(morning, evening)
        XCTAssertEqual(morning, "2026-7-14")
    }

    func testDayStampUsesEasternDayNotUTC() {
        // 2026-07-15 03:30 UTC is still 2026-07-14 23:30 in New York (EDT).
        var utc = Calendar(identifier: .gregorian)
        utc.timeZone = TimeZone(identifier: "UTC")!
        let date = utc.date(from: DateComponents(year: 2026, month: 7, day: 15, hour: 3, minute: 30))!
        XCTAssertEqual(MarketClock.dayStamp(date), "2026-7-14")
    }

    func testDayStampChangesAtEasternMidnight() {
        XCTAssertNotEqual(MarketClock.dayStamp(eastern(2026, 7, 14, 23, 59)),
                          MarketClock.dayStamp(eastern(2026, 7, 15, 0, 1)))
    }
}

// MARK: - Fixtures

fileprivate func assertSameInstant(_ a: Date, _ b: Date,
                                   file: StaticString = #filePath, line: UInt = #line) {
    XCTAssertEqual(a.timeIntervalSince1970, b.timeIntervalSince1970,
                   accuracy: 1, file: file, line: line)
}

/// Builds an exact instant on the America/New_York wall clock.
fileprivate func eastern(_ year: Int, _ month: Int, _ day: Int,
                         _ hour: Int, _ minute: Int) -> Date {
    var cal = Calendar(identifier: .gregorian)
    cal.timeZone = TimeZone(identifier: "America/New_York")!
    return cal.date(from: DateComponents(year: year, month: month, day: day,
                                         hour: hour, minute: minute))!
}
