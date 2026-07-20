import Foundation

/// Real bundled market history. Each CSV in Resources/HistoricalBars is
/// genuine daily OHLCV (Date,Open,High,Low,Close,Volume) — roughly ten years
/// per symbol — so backtests replay what actually happened instead of a
/// synthetic random walk. Honest-data rule: if a symbol has no bundled
/// history, callers get nil and must say so, never invent bars.
enum HistoricalData {

    /// Parsed bars for an app symbol (e.g. "AAPL", "BRK.B", "BTC/USD"),
    /// oldest first. Returns nil when no history is bundled for the symbol.
    static func bars(for symbol: String) -> [Bar]? {
        let key = sanitized(symbol)
        lock.lock()
        defer { lock.unlock() }
        if let cached = cache[key] { return cached.isEmpty ? nil : cached }
        let parsed = parseResource(named: key)
        cache[key] = parsed ?? []   // negative results cached as empty
        return parsed
    }

    /// App symbols with bundled history, sorted. Computed once.
    static var availableSymbols: [String] {
        lock.lock()
        defer { lock.unlock() }
        if let listed = symbolList { return listed }
        let urls = (Bundle.main.urls(forResourcesWithExtension: "csv",
                                     subdirectory: "HistoricalBars") ?? [])
            + (Bundle.main.urls(forResourcesWithExtension: "csv", subdirectory: nil) ?? [])
        let symbols = Set(urls.map { desanitized($0.deletingPathExtension().lastPathComponent) })
            .sorted()
        symbolList = symbols
        return symbols
    }

    // MARK: - Internals

    private static let lock = NSLock()
    private static var cache: [String: [Bar]] = [:]
    private static var symbolList: [String]? = nil

    /// yyyy-MM-dd, fixed locale, market-eastern midnight. DateFormatter is not
    /// thread-safe; only touched while `lock` is held.
    private static let dateFormatter: DateFormatter = {
        let f = DateFormatter()
        f.locale = Locale(identifier: "en_US_POSIX")
        f.timeZone = MarketClock.eastern
        f.dateFormat = "yyyy-MM-dd"
        return f
    }()

    private static func parseResource(named key: String) -> [Bar]? {
        // xcodegen may fold resources flat into the bundle or keep the
        // HistoricalBars subdirectory — try both.
        let url = Bundle.main.url(forResource: key, withExtension: "csv",
                                  subdirectory: "HistoricalBars")
            ?? Bundle.main.url(forResource: key, withExtension: "csv")
        guard let url, let text = try? String(contentsOf: url, encoding: .utf8) else {
            return nil
        }
        var bars: [Bar] = []
        for line in text.split(separator: "\n").dropFirst() {   // skip header
            let cols = line.split(separator: ",", omittingEmptySubsequences: false)
            guard cols.count >= 5,
                  let time = dateFormatter.date(from: String(cols[0])),
                  let open = Double(cols[1]),
                  let high = Double(cols[2]),
                  let low = Double(cols[3]),
                  let close = Double(cols[4])
            else { continue }   // malformed row — skip, don't guess
            let volume = cols.count > 5 ? (Double(cols[5]) ?? 0) : 0
            bars.append(Bar(time: time, open: open, high: high, low: low,
                            close: close, volume: volume))
        }
        return bars.isEmpty ? nil : bars
    }
}

/// Filename mapping: "/" and "." are unsafe in resource names, so
/// BTC/USD ↔ BTC-USD.csv and BRK.B ↔ BRK_B.csv.
fileprivate func sanitized(_ symbol: String) -> String {
    symbol.replacingOccurrences(of: "/", with: "-")
          .replacingOccurrences(of: ".", with: "_")
}

fileprivate func desanitized(_ name: String) -> String {
    name.replacingOccurrences(of: "-", with: "/")
        .replacingOccurrences(of: "_", with: ".")
}
