import Foundation

/// The market's heartbeat: US equity session hours in Eastern Time.
/// Crypto never sleeps; equities and options keep exchange hours. The demo
/// market honors this too — a terminal that fills AAPL at 3am is lying to you.
enum MarketClock {
    static var eastern: TimeZone { TimeZone(identifier: "America/New_York")! }

    private static var calendar: Calendar {
        var cal = Calendar(identifier: .gregorian)
        cal.timeZone = eastern
        return cal
    }

    /// Is this asset class tradable right now?
    static func isOpen(_ assetClass: AssetClass, at date: Date = .now) -> Bool {
        guard !assetClass.tradesAroundTheClock else { return true }
        let comps = calendar.dateComponents([.weekday, .hour, .minute], from: date)
        guard let weekday = comps.weekday, (2...6).contains(weekday) else { return false }
        let minutes = (comps.hour ?? 0) * 60 + (comps.minute ?? 0)
        return minutes >= (9 * 60 + 30) && minutes < (16 * 60)
    }

    /// Next regular-session open for closed asset classes (nil for crypto).
    static func nextOpen(after date: Date = .now) -> Date? {
        var probe = date
        for _ in 0..<10 {
            let comps = calendar.dateComponents([.year, .month, .day, .weekday], from: probe)
            if let weekday = comps.weekday, (2...6).contains(weekday) {
                var openComps = comps
                openComps.hour = 9; openComps.minute = 30; openComps.second = 0
                if let open = calendar.date(from: openComps), open > date {
                    return open
                }
            }
            probe = calendar.date(byAdding: .day, value: 1, to: calendar.startOfDay(for: probe)) ?? probe
        }
        return nil
    }

    /// Trading-day stamp (ET) used for day-P&L rollover.
    static func dayStamp(_ date: Date = .now) -> String {
        let comps = calendar.dateComponents([.year, .month, .day], from: date)
        return "\(comps.year ?? 0)-\(comps.month ?? 0)-\(comps.day ?? 0)"
    }

    /// Human line for closed-market UI.
    static func closedMessage(at date: Date = .now) -> String {
        guard let next = MarketClock.nextOpen(after: date) else {
            return "US market closed."
        }
        let fmt = Date.RelativeFormatStyle(presentation: .named)
        return "US market closed — opens \(next.formatted(fmt)). Orders queue until the bell."
    }
}
