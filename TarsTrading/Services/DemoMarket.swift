import Foundation

/// The demo universe: a deterministic, seeded synthetic market that feels alive.
/// Powers the whole app (terminal, charts, agents, Academy missions) when no
/// API keys are configured — and it's what makes the app fully demo-able.
final class DemoMarket: MarketProviding, @unchecked Sendable {
    static let shared = DemoMarket()

    struct DemoAsset {
        let symbol: String
        let name: String
        let assetClass: AssetClass
        let basePrice: Double
        let annualVol: Double   // realistic volatility per asset
        let drift: Double
    }

    static let universe: [DemoAsset] = [
        .init(symbol: "AAPL", name: "Apple Inc.", assetClass: .usEquity, basePrice: 232, annualVol: 0.24, drift: 0.08),
        .init(symbol: "MSFT", name: "Microsoft Corp.", assetClass: .usEquity, basePrice: 428, annualVol: 0.22, drift: 0.10),
        .init(symbol: "NVDA", name: "NVIDIA Corp.", assetClass: .usEquity, basePrice: 131, annualVol: 0.45, drift: 0.18),
        .init(symbol: "AMZN", name: "Amazon.com Inc.", assetClass: .usEquity, basePrice: 186, annualVol: 0.30, drift: 0.09),
        .init(symbol: "GOOGL", name: "Alphabet Inc.", assetClass: .usEquity, basePrice: 175, annualVol: 0.27, drift: 0.08),
        .init(symbol: "META", name: "Meta Platforms", assetClass: .usEquity, basePrice: 585, annualVol: 0.34, drift: 0.12),
        .init(symbol: "TSLA", name: "Tesla Inc.", assetClass: .usEquity, basePrice: 251, annualVol: 0.55, drift: 0.05),
        .init(symbol: "BRK.B", name: "Berkshire Hathaway", assetClass: .usEquity, basePrice: 462, annualVol: 0.15, drift: 0.07),
        .init(symbol: "JPM", name: "JPMorgan Chase", assetClass: .usEquity, basePrice: 244, annualVol: 0.21, drift: 0.06),
        .init(symbol: "V", name: "Visa Inc.", assetClass: .usEquity, basePrice: 312, annualVol: 0.18, drift: 0.08),
        .init(symbol: "UNH", name: "UnitedHealth Group", assetClass: .usEquity, basePrice: 524, annualVol: 0.25, drift: 0.04),
        .init(symbol: "XOM", name: "Exxon Mobil", assetClass: .usEquity, basePrice: 118, annualVol: 0.26, drift: 0.03),
        .init(symbol: "KO", name: "Coca-Cola Co.", assetClass: .usEquity, basePrice: 63, annualVol: 0.13, drift: 0.04),
        .init(symbol: "DIS", name: "Walt Disney Co.", assetClass: .usEquity, basePrice: 96, annualVol: 0.29, drift: 0.02),
        .init(symbol: "PLTR", name: "Palantir Technologies", assetClass: .usEquity, basePrice: 78, annualVol: 0.60, drift: 0.15),
        .init(symbol: "SPY", name: "SPDR S&P 500 ETF", assetClass: .usEquity, basePrice: 596, annualVol: 0.15, drift: 0.08),
        .init(symbol: "QQQ", name: "Invesco QQQ Trust", assetClass: .usEquity, basePrice: 512, annualVol: 0.20, drift: 0.10),
        .init(symbol: "IWM", name: "iShares Russell 2000", assetClass: .usEquity, basePrice: 224, annualVol: 0.23, drift: 0.05),
        .init(symbol: "TLT", name: "iShares 20+ Yr Treasury", assetClass: .usEquity, basePrice: 92, annualVol: 0.16, drift: -0.01),
        .init(symbol: "GLD", name: "SPDR Gold Shares", assetClass: .usEquity, basePrice: 248, annualVol: 0.14, drift: 0.06),
        .init(symbol: "BTC/USD", name: "Bitcoin", assetClass: .crypto, basePrice: 97_400, annualVol: 0.65, drift: 0.20),
        .init(symbol: "ETH/USD", name: "Ethereum", assetClass: .crypto, basePrice: 3_420, annualVol: 0.80, drift: 0.12),
        .init(symbol: "SOL/USD", name: "Solana", assetClass: .crypto, basePrice: 198, annualVol: 1.00, drift: 0.10),
        .init(symbol: "DOGE/USD", name: "Dogecoin", assetClass: .crypto, basePrice: 0.31, annualVol: 1.30, drift: 0.0),
    ]

    private var currentPrices: [String: Double] = [:]
    private var previousCloses: [String: Double] = [:]
    private let lock = NSLock()

    init() {
        for asset in Self.universe {
            // Deterministic per-symbol previous close, slightly off base.
            var rng = SeededRNG(seed: UInt64(bitPattern: Int64(asset.symbol.hashValue)))
            let prev = asset.basePrice * (1 + rng.nextGaussian() * 0.01)
            previousCloses[asset.symbol] = prev
            currentPrices[asset.symbol] = prev * (1 + rng.nextGaussian() * 0.008)
        }
    }

    /// Advance every price one step of geometric Brownian motion. Called by the
    /// store's heartbeat (~1s in demo mode) so the terminal feels live.
    func tick() {
        lock.lock(); defer { lock.unlock() }
        for asset in Self.universe {
            guard var price = currentPrices[asset.symbol] else { continue }
            let dt = 1.0 / (252 * 6.5 * 3600)   // one second of trading year
            let vol = asset.annualVol * (dt).squareRoot()
            let shock = Double.random(in: -1...1) + Double.random(in: -1...1) + Double.random(in: -1...1)
            price *= exp((asset.drift - 0.5 * asset.annualVol * asset.annualVol) * dt + vol * shock * 0.577)
            currentPrices[asset.symbol] = price
        }
    }

    func price(of symbol: String) -> Double {
        lock.lock(); defer { lock.unlock() }
        return currentPrices[symbol] ?? 0
    }

    // MARK: - MarketProviding

    func quotes(for symbols: [String]) async throws -> [Quote] {
        lock.lock(); defer { lock.unlock() }
        return symbols.compactMap { symbol in
            guard let price = currentPrices[symbol], let prev = previousCloses[symbol] else { return nil }
            return Quote(symbol: symbol, price: price, previousClose: prev, asOf: .now)
        }
    }

    func bars(symbol: String, timeframe: Timeframe) async throws -> [Bar] {
        guard let asset = Self.universe.first(where: { $0.symbol == symbol }) else { return [] }
        let endPrice = price(of: symbol)
        // Deterministic history per (symbol, timeframe), anchored to today's price.
        var rng = SeededRNG(seed: UInt64(bitPattern: Int64(symbol.hashValue &+ timeframe.rawValue.hashValue)))
        let n = timeframe.barCount
        let dt = timeframe.barInterval / (252 * 6.5 * 3600)
        var closes: [Double] = [endPrice]
        for _ in 1..<n {
            let shock = rng.nextGaussian()
            let prev = closes.last! / exp((asset.drift - 0.5 * asset.annualVol * asset.annualVol) * dt
                                          + asset.annualVol * dt.squareRoot() * shock)
            closes.append(prev)
        }
        closes.reverse()
        var bars: [Bar] = []
        let end = Date.now
        for i in 0..<n {
            let close = closes[i]
            let open = i == 0 ? close * (1 + rng.nextGaussian() * 0.002) : closes[i - 1]
            let hi = max(open, close) * (1 + abs(rng.nextGaussian()) * 0.004)
            let lo = min(open, close) * (1 - abs(rng.nextGaussian()) * 0.004)
            let vol = abs(rng.nextGaussian()) * 8_000_000 + 2_000_000
            bars.append(Bar(time: end.addingTimeInterval(-Double(n - 1 - i) * timeframe.barInterval),
                            open: open, high: hi, low: lo, close: close, volume: vol))
        }
        return bars
    }

    func search(_ query: String) async throws -> [Asset] {
        let q = query.uppercased()
        return Self.universe
            .filter { $0.symbol.uppercased().contains(q) || $0.name.uppercased().contains(q) }
            .map { Asset(symbol: $0.symbol, name: $0.name, assetClass: $0.assetClass) }
    }
}

// MARK: - Deterministic RNG (so demo charts are stable across launches)

struct SeededRNG: RandomNumberGenerator {
    private var state: UInt64
    init(seed: UInt64) { state = seed == 0 ? 0x9E3779B97F4A7C15 : seed }
    mutating func next() -> UInt64 {
        state ^= state << 13
        state ^= state >> 7
        state ^= state << 17
        return state
    }
    /// Box–Muller-ish standard normal.
    mutating func nextGaussian() -> Double {
        let u1 = Double(next() % 1_000_000) / 1_000_000 + 1e-9
        let u2 = Double(next() % 1_000_000) / 1_000_000
        return (-2 * Foundation.log(u1)).squareRoot() * Foundation.cos(2 * .pi * u2)
    }
}
