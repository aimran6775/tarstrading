import Foundation
import Observation

// MARK: - Options sandbox book (shared, persisted)

/// One practice options position, marked to model. Property names are the
/// persisted JSON keys — do not rename without a migration (saved books from
/// the pre-extraction `OCLeg` era decode straight into this type).
struct SandboxLeg: Identifiable, Codable, Equatable {
    var id = UUID()
    var symbol: String
    var isCall: Bool
    var isLong: Bool
    var strike: Double
    var contracts: Int
    var entryPremium: Double
    var entryUnderlying: Double
    var expiry: Date
    var openedAt: Date
}

/// On-disk shape of the sandbox book. Field names match the original
/// fileprivate `OCBookFile`, so existing saved books survive the extraction.
fileprivate struct SandboxBookFile: Codable {
    var legs: [SandboxLeg]
    var realized: Double
}

/// The options sandbox book: practice positions priced by a model, deliberately
/// NOT routed through TradingStore — this book never touches the paper account.
/// Shared between the options chain (where positions are opened and closed) and
/// the portfolio sleeve (which only reads).
@Observable
final class OptionsSandbox {
    static let shared = OptionsSandbox()

    var legs: [SandboxLeg] = []
    var realized: Double = 0

    @ObservationIgnored private let persistence = Persistence()

    /// Persistence key is unchanged from the pre-extraction implementation.
    private static let storageKey = "optionsSandboxBook"

    init() {
        if let file = persistence.load(SandboxBookFile.self, Self.storageKey) {
            legs = file.legs
            realized = file.realized
        }
    }

    var hasOpenPositions: Bool { !legs.isEmpty }

    func open(_ leg: SandboxLeg) {
        legs.insert(leg, at: 0)
        save()
    }

    func close(_ leg: SandboxLeg, mark: Double) {
        realized += Self.pnl(leg, mark: mark)
        legs.removeAll { $0.id == leg.id }
        save()
    }

    /// Signed P&L in dollars: (mark − entry) × 100 × contracts, flipped for shorts.
    static func pnl(_ leg: SandboxLeg, mark: Double) -> Double {
        (mark - leg.entryPremium) * 100 * Double(leg.contracts) * (leg.isLong ? 1 : -1)
    }

    private func save() {
        persistence.save(SandboxBookFile(legs: legs, realized: realized), Self.storageKey)
    }
}

// MARK: - Mark-to-model pricing

struct SandboxGreeks {
    var delta = 0.0
    var gamma = 0.0
    var thetaPerDay = 0.0
    var vegaPerPoint = 0.0
}

/// Simplified Black-Scholes pricer for the options sandbox. Model values, not
/// market quotes — good enough to teach moneyness, skew, and theta honestly.
/// (OptionsWidgets.swift keeps its own private copy; this one is the sandbox's.)
enum SandboxPricer {
    /// Sandbox risk-free rate: a flat 4%.
    static let r = 0.04

    static func pdf(_ x: Double) -> Double {
        exp(-x * x / 2) / (2 * Double.pi).squareRoot()
    }

    /// Standard normal CDF, Abramowitz–Stegun polynomial approximation.
    static func cdf(_ x: Double) -> Double {
        let k = 1 / (1 + 0.2316419 * abs(x))
        let poly = k * (0.319381530 + k * (-0.356563782 + k * (1.781477937 + k * (-1.821255978 + k * 1.330274429))))
        let c = 1 - pdf(x) * poly
        return x >= 0 ? c : 1 - c
    }

    static func price(isCall: Bool, S: Double, K: Double, T: Double, v: Double) -> Double {
        guard S > 0, K > 0 else { return 0 }
        guard T > 1e-6, v > 1e-6 else {
            return isCall ? max(0, S - K) : max(0, K - S)   // intrinsic at/after expiry
        }
        let sqrtT = T.squareRoot()
        let d1 = (Foundation.log(S / K) + (r + v * v / 2) * T) / (v * sqrtT)
        let d2 = d1 - v * sqrtT
        if isCall {
            return S * cdf(d1) - K * exp(-r * T) * cdf(d2)
        } else {
            return K * exp(-r * T) * cdf(-d2) - S * cdf(-d1)
        }
    }

    static func greeks(isCall: Bool, S: Double, K: Double, T: Double, v: Double) -> SandboxGreeks {
        guard S > 0, K > 0, T > 1e-6, v > 1e-6 else { return SandboxGreeks() }
        let sqrtT = T.squareRoot()
        let d1 = (Foundation.log(S / K) + (r + v * v / 2) * T) / (v * sqrtT)
        let d2 = d1 - v * sqrtT
        let delta = isCall ? cdf(d1) : cdf(d1) - 1
        let gamma = pdf(d1) / (S * v * sqrtT)
        let annualTheta: Double = isCall
            ? -S * pdf(d1) * v / (2 * sqrtT) - r * K * exp(-r * T) * cdf(d2)
            : -S * pdf(d1) * v / (2 * sqrtT) + r * K * exp(-r * T) * cdf(-d2)
        let vega = S * pdf(d1) * sqrtT / 100   // per 1 vol point
        return SandboxGreeks(delta: delta, gamma: gamma, thetaPerDay: annualTheta / 365, vegaPerPoint: vega)
    }

    // MARK: Chain math helpers

    /// Synthesized volatility smile: downside strikes charge more IV, with a mild
    /// smile at both wings. Deliberately simplified for teaching.
    static func smileIV(base: Double, spot: Double, strike: Double) -> Double {
        guard spot > 0 else { return base }
        let m = strike / spot - 1
        let iv = base * (1 - 0.35 * m + 1.9 * m * m)
        return min(max(iv, base * 0.55), base * 1.9)
    }

    /// Synthetic half-spread around the theoretical value.
    static func halfSpread(_ theo: Double) -> Double {
        max(0.01, theo * 0.02)
    }

    /// Sensible strike increments by underlying price.
    static func strikeStep(for spot: Double) -> Double {
        switch spot {
        case ..<25: 0.5
        case ..<50: 1
        case ..<100: 2.5
        case ..<250: 5
        case ..<500: 10
        case ..<1000: 25
        default: 50
        }
    }

    // MARK: Leg conveniences

    /// Base annualized vol for a symbol from the demo universe.
    static func baseVol(for symbol: String) -> Double {
        DemoMarket.universe.first { $0.symbol == symbol }?.annualVol ?? 0.30
    }

    /// Years left on a leg (0 at/after expiry — pricer returns intrinsic).
    static func yearsToExpiry(of leg: SandboxLeg) -> Double {
        max(0, leg.expiry.timeIntervalSinceNow) / (365 * 86_400)
    }

    /// Model mid for a leg given the current underlying price.
    static func markPremium(for leg: SandboxLeg, underlying: Double) -> Double {
        let iv = smileIV(base: baseVol(for: leg.symbol), spot: underlying, strike: leg.strike)
        return price(isCall: leg.isCall, S: underlying, K: leg.strike,
                     T: yearsToExpiry(of: leg), v: iv)
    }

    /// Per-share greeks for a leg given the current underlying price.
    static func greeks(for leg: SandboxLeg, underlying: Double) -> SandboxGreeks {
        let iv = smileIV(base: baseVol(for: leg.symbol), spot: underlying, strike: leg.strike)
        return greeks(isCall: leg.isCall, S: underlying, K: leg.strike,
                      T: yearsToExpiry(of: leg), v: iv)
    }
}
