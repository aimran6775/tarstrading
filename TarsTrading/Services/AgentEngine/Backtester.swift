import Foundation

/// Event-driven backtester. Honesty is architectural: the data is split
/// 70/30 into in-sample and out-of-sample segments and reported separately —
/// the UI never shows a blended number.
struct Backtester {
    var slippageBps: Double = 4
    var commissionPerTrade: Double = 0

    func run(agent: TradingAgent, barsBySymbol: [String: [Bar]]) -> BacktestResult? {
        let symbols = agent.universe.filter { (barsBySymbol[$0]?.count ?? 0) > 60 }
        guard !symbols.isEmpty else { return nil }
        let length = symbols.compactMap { barsBySymbol[$0]?.count }.min() ?? 0
        guard length > 60 else { return nil }

        // Align all series to the shortest tail.
        var aligned: [String: [Bar]] = [:]
        for s in symbols { aligned[s] = Array(barsBySymbol[s]!.suffix(length)) }

        // Precompute indicators once per symbol.
        let needed = IndicatorMath.requiredIndicators(agent.entry + agent.exit)
        var seriesBySymbol: [String: [Indicator: [Double]]] = [:]
        for s in symbols {
            var dict: [Indicator: [Double]] = [:]
            for ind in needed { dict[ind] = IndicatorMath.series(ind, bars: aligned[s]!) }
            seriesBySymbol[s] = dict
        }

        // Simulate whole span once; segment stats are cut afterward at the split.
        let split = Int(Double(length) * 0.7)
        var cash = agent.allocation
        var equityCurve: [Double] = []
        var held: [String: (qty: Double, entry: Double, entryIndex: Int)] = [:]
        var trades: [BacktestResult.SimTrade] = []
        var peak = agent.allocation
        var killedAtIndex: Int? = nil
        var dayStartEquity = agent.allocation

        for i in 0..<length {
            let priceOf = { (s: String) in aligned[s]![i].close }
            let equity = cash + held.reduce(0) { $0 + $1.value.qty * priceOf($1.key) }
            dayStartEquity = equity

            if killedAtIndex == nil {
                // Exits first.
                for (symbol, lot) in held {
                    let price = priceOf(symbol)
                    var reason: String? = nil
                    if let stop = agent.stopLossPercent,
                       price <= lot.entry * (1 - stop / 100) { reason = "stop loss \(Int(stop))%" }
                    if let tp = agent.takeProfitPercent,
                       price >= lot.entry * (1 + tp / 100) { reason = "take profit \(Int(tp))%" }
                    if reason == nil {
                        for rule in agent.exit where IndicatorMath.evaluate(
                            rule, at: i, series: seriesBySymbol[symbol]!, bars: aligned[symbol]!) {
                            reason = rule.plainEnglish
                            break
                        }
                    }
                    if let reason {
                        let fillPrice = price * (1 - slippageBps / 10_000)
                        cash += lot.qty * fillPrice - commissionPerTrade
                        trades.append(.init(symbol: symbol, entryIndex: lot.entryIndex, exitIndex: i,
                                            entryPrice: lot.entry, exitPrice: fillPrice, reason: reason))
                        held[symbol] = nil
                    }
                }

                // Entries: all rules true, risk limits permitting.
                let currentEquity = cash + held.reduce(0) { $0 + $1.value.qty * priceOf($1.key) }
                let dailyLoss = (dayStartEquity - currentEquity) / agent.allocation
                if dailyLoss < agent.risk.maxDailyLossPercent / 100 {
                    for symbol in symbols where held[symbol] == nil && held.count < agent.risk.maxPositions {
                        let allEntry = agent.entry.allSatisfy {
                            IndicatorMath.evaluate($0, at: i, series: seriesBySymbol[symbol]!, bars: aligned[symbol]!)
                        }
                        guard allEntry, !agent.entry.isEmpty else { continue }
                        let price = priceOf(symbol) * (1 + slippageBps / 10_000)
                        let budget = min(agent.allocation * agent.risk.maxPositionPercent / 100, cash)
                        let qty = (budget / price).rounded(.down)
                        guard qty >= 1 || (budget / price) > 0.01 else { continue }
                        let useQty = qty >= 1 ? qty : (budget / price)
                        cash -= useQty * price + commissionPerTrade
                        held[symbol] = (useQty, price, i)
                    }
                }
            }

            let endEquity = cash + held.reduce(0) { $0 + $1.value.qty * priceOf($1.key) }
            equityCurve.append(endEquity)
            peak = max(peak, endEquity)

            // Kill switch applies in simulation too — it's part of the strategy.
            if killedAtIndex == nil, (peak - endEquity) / peak > agent.risk.maxDrawdownPercent / 100 {
                for (symbol, lot) in held {
                    let fillPrice = priceOf(symbol) * (1 - slippageBps / 10_000)
                    cash += lot.qty * fillPrice
                    trades.append(.init(symbol: symbol, entryIndex: lot.entryIndex, exitIndex: i,
                                        entryPrice: lot.entry, exitPrice: fillPrice,
                                        reason: "KILL SWITCH: max drawdown"))
                }
                held.removeAll()
                killedAtIndex = i
            }
        }

        // Benchmark: equal-weight buy & hold of the universe.
        let benchmark = symbols.reduce(0.0) { acc, s in
            let bars = aligned[s]!
            return acc + (bars.last!.close / bars.first!.close - 1) / Double(symbols.count)
        }

        let inSampleTrades = trades.filter { $0.exitIndex < split }
        let outTrades = trades.filter { $0.exitIndex >= split }
        return BacktestResult(
            inSample: segment(label: "In-sample", curve: Array(equityCurve[0..<split]),
                              start: agent.allocation, trades: inSampleTrades),
            outOfSample: segment(label: "Out-of-sample", curve: Array(equityCurve[split...]),
                                 start: equityCurve[max(0, split - 1)], trades: outTrades),
            trades: trades,
            benchmarkReturn: benchmark)
    }

    private func segment(label: String, curve: [Double], start: Double,
                         trades: [BacktestResult.SimTrade]) -> BacktestResult.Segment {
        guard let last = curve.last, start > 0, curve.count > 1 else {
            return .init(label: label, equity: curve, totalReturn: 0, annualizedReturn: 0,
                         maxDrawdown: 0, sharpe: 0, winRate: 0, tradeCount: 0, exposure: 0)
        }
        let total = last / start - 1
        let years = Double(curve.count) / 252
        let annualized = years > 0 ? pow(1 + total, 1 / years) - 1 : 0

        var peak = curve[0], maxDD = 0.0
        var dailyReturns: [Double] = []
        for i in 1..<curve.count {
            peak = max(peak, curve[i])
            maxDD = max(maxDD, (peak - curve[i]) / peak)
            if curve[i - 1] > 0 { dailyReturns.append(curve[i] / curve[i - 1] - 1) }
        }
        let mean = dailyReturns.reduce(0, +) / Double(max(1, dailyReturns.count))
        let variance = dailyReturns.reduce(0) { $0 + pow($1 - mean, 2) } / Double(max(1, dailyReturns.count))
        let sharpe = variance > 0 ? mean / variance.squareRoot() * (252.0).squareRoot() : 0

        let wins = trades.filter { $0.pnlPercent > 0 }.count
        let holdingDays = trades.reduce(0) { $0 + ($1.exitIndex - $1.entryIndex) }
        return .init(label: label, equity: curve, totalReturn: total,
                     annualizedReturn: annualized, maxDrawdown: maxDD, sharpe: sharpe,
                     winRate: trades.isEmpty ? 0 : Double(wins) / Double(trades.count),
                     tradeCount: trades.count,
                     exposure: min(1, Double(holdingDays) / Double(max(1, curve.count))))
    }
}
