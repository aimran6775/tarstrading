import Foundation

/// Shared indicator math for the backtester and the live runner — one
/// implementation so simulated and live behavior can never diverge.
enum IndicatorMath {

    /// Computes the full series for an indicator over closes/highs/lows.
    /// Result is aligned with input; leading values without enough history are NaN.
    static func series(_ indicator: Indicator, bars: [Bar]) -> [Double] {
        let closes = bars.map(\.close)
        switch indicator {
        case .price:
            return closes
        case .sma(let n):
            return rolling(closes, window: n) { $0.reduce(0, +) / Double($0.count) }
        case .ema(let n):
            var out = [Double](repeating: .nan, count: closes.count)
            guard closes.count >= n, n > 0 else { return out }
            let k = 2.0 / Double(n + 1)
            var ema = closes[0..<n].reduce(0, +) / Double(n)
            out[n - 1] = ema
            for i in n..<closes.count {
                ema = closes[i] * k + ema * (1 - k)
                out[i] = ema
            }
            return out
        case .rsi(let n):
            var out = [Double](repeating: .nan, count: closes.count)
            guard closes.count > n, n > 0 else { return out }
            var gain = 0.0, loss = 0.0
            for i in 1...n {
                let d = closes[i] - closes[i - 1]
                if d > 0 { gain += d } else { loss -= d }
            }
            var avgGain = gain / Double(n), avgLoss = loss / Double(n)
            out[n] = rsiValue(avgGain, avgLoss)
            for i in (n + 1)..<closes.count {
                let d = closes[i] - closes[i - 1]
                avgGain = (avgGain * Double(n - 1) + max(d, 0)) / Double(n)
                avgLoss = (avgLoss * Double(n - 1) + max(-d, 0)) / Double(n)
                out[i] = rsiValue(avgGain, avgLoss)
            }
            return out
        case .highestHigh(let n):
            return rolling(bars.map(\.high), window: n) { $0.max() ?? .nan }
        case .lowestLow(let n):
            return rolling(bars.map(\.low), window: n) { $0.min() ?? .nan }
        }
    }

    private static func rsiValue(_ avgGain: Double, _ avgLoss: Double) -> Double {
        avgLoss == 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss)
    }

    private static func rolling(_ values: [Double], window: Int,
                                _ f: (ArraySlice<Double>) -> Double) -> [Double] {
        var out = [Double](repeating: .nan, count: values.count)
        guard window > 0, values.count >= window else { return out }
        for i in (window - 1)..<values.count {
            out[i] = f(values[(i - window + 1)...i])
        }
        return out
    }

    /// Evaluates one rule at bar index i, given precomputed series.
    static func evaluate(_ rule: SignalRule, at i: Int,
                         series: [Indicator: [Double]],
                         bars: [Bar]) -> Bool {
        guard i > 0 else { return false }
        func value(_ operand: SignalOperand, _ idx: Int) -> Double {
            switch operand {
            case .constant(let c): c
            case .indicator(let ind): series[ind]?[safe: idx] ?? .nan
            }
        }
        let lhsNow = series[rule.lhs]?[safe: i] ?? .nan
        let lhsPrev = series[rule.lhs]?[safe: i - 1] ?? .nan
        let rhsNow = value(rule.rhs, i)
        let rhsPrev = value(rule.rhs, i - 1)
        guard !lhsNow.isNaN, !rhsNow.isNaN else { return false }

        switch rule.comparator {
        case .isAbove: return lhsNow > rhsNow
        case .isBelow: return lhsNow < rhsNow
        case .crossesAbove:
            guard !lhsPrev.isNaN, !rhsPrev.isNaN else { return false }
            return lhsPrev <= rhsPrev && lhsNow > rhsNow
        case .crossesBelow:
            guard !lhsPrev.isNaN, !rhsPrev.isNaN else { return false }
            return lhsPrev >= rhsPrev && lhsNow < rhsNow
        }
    }

    /// All indicators a rule set needs (both sides).
    static func requiredIndicators(_ rules: [SignalRule]) -> Set<Indicator> {
        var set = Set<Indicator>()
        for rule in rules {
            set.insert(rule.lhs)
            if case .indicator(let ind) = rule.rhs { set.insert(ind) }
        }
        return set
    }
}

extension Array where Element == Double {
    subscript(safe index: Int) -> Double? {
        indices.contains(index) ? self[index] : nil
    }
}
