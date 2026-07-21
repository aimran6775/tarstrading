import SwiftUI

/// Fund Mode: the user's personal paper fund. Every agent becomes a "sleeve"
/// of capital; this page shows total AUM, sleeve allocations, how correlated
/// the sleeves are (diversification is the only free lunch — so we chart it),
/// and an LP-style tear sheet stamped PAPER FUND, exportable as text.
public struct FundModeView: View {
    @Environment(AgentLab.self) private var lab

    private var totalAUM: Double {
        lab.agents.reduce(0) { $0 + $1.allocation }
    }

    /// Agents that have an out-of-sample curve worth correlating.
    private var backtested: [(agent: TradingAgent, returns: [Double])] {
        lab.agents.compactMap { agent in
            guard let result = lab.backtests[agent.id],
                  result.outOfSample.equity.count > 2 else { return nil }
            return (agent, fmDailyReturns(result.outOfSample.equity))
        }
    }

    public var body: some View {
        ScrollView {
            if lab.agents.isEmpty {
                FMEmptyState()
                    .frame(maxWidth: .infinity)
                    .padding(.top, TarsTheme.Space.xxl * 2)
            } else {
                VStack(alignment: .leading, spacing: TarsTheme.Space.l) {
                    header
                    aumHero
                    sleevesSection
                    correlationSection
                    tearSheetSection
                    Text("A paper fund with paper LPs and a paper GP. The dollars are simulated; the habits you build managing them are not. Nothing here is advice or a promise.")
                        .font(TarsTheme.Text.caption)
                        .foregroundStyle(TarsTheme.inkTertiary)
                        .multilineTextAlignment(.center)
                        .frame(maxWidth: .infinity)
                }
                .frame(maxWidth: 900)
                .frame(maxWidth: .infinity)
                .padding(TarsTheme.Space.l)
            }
        }
        .background(TarsTheme.bg0)
    }

    // MARK: Header

    private var header: some View {
        HStack(alignment: .top, spacing: TarsTheme.Space.m) {
            VStack(alignment: .leading, spacing: 2) {
                Text("Fund Mode")
                    .font(TarsTheme.Text.title)
                    .foregroundStyle(TarsTheme.inkPrimary)
                Text("You're the LP and the GP. The money is paper; the lessons aren't.")
                    .font(TarsTheme.Text.body)
                    .foregroundStyle(TarsTheme.inkSecondary)
            }
            Spacer()
            FMPaperStamp()
            ShareLink(item: tearSheetExport()) {
                Image(systemName: "square.and.arrow.up")
                    .font(TarsTheme.Text.heading)
                    .foregroundStyle(TarsTheme.accent)
                    .frame(width: 44, height: 44)
                    .background(
                        RoundedRectangle(cornerRadius: TarsTheme.Radius.s, style: .continuous)
                            .fill(TarsTheme.bg3)
                    )
            }
            .buttonStyle(PressableStyle())
            .accessibilityLabel("Share tear sheet")
        }
    }

    // MARK: AUM hero

    private var aumHero: some View {
        VStack(alignment: .leading, spacing: TarsTheme.Space.xs) {
            Text("TOTAL PAPER AUM")
                .font(TarsTheme.Text.micro)
                .tracking(1.2)
                .foregroundStyle(TarsTheme.inkTertiary)
            TickerText(
                value: totalAUM,
                format: .currency(code: "USD").precision(.fractionLength(0)),
                font: TarsTheme.Text.priceHero,
                colorsByDirection: false)
            Text("\(lab.agents.count) sleeve\(lab.agents.count == 1 ? "" : "s") · sum of agent allocations, not marked to market")
                .font(TarsTheme.Text.caption)
                .foregroundStyle(TarsTheme.inkTertiary)
                .monospacedDigit()
        }
        .padding(TarsTheme.Space.l)
        .frame(maxWidth: .infinity, alignment: .leading)
        .tarsPanel(elevation: 2)
    }

    // MARK: Sleeves

    private var sleevesSection: some View {
        VStack(alignment: .leading, spacing: TarsTheme.Space.m) {
            FMSectionHeader(text: "Sleeves")
            LazyVGrid(
                columns: [GridItem(.adaptive(minimum: 270), spacing: TarsTheme.Space.m)],
                spacing: TarsTheme.Space.m
            ) {
                ForEach(lab.agents) { agent in
                    FMSleeveCard(
                        agent: agent,
                        share: totalAUM > 0 ? agent.allocation / totalAUM : 0)
                }
            }
        }
    }

    // MARK: Correlation

    private var correlationSection: some View {
        VStack(alignment: .leading, spacing: TarsTheme.Space.m) {
            FMSectionHeader(text: "Sleeve correlation")
            if backtested.count >= 2 {
                FMCorrelationGrid(entries: backtested)
            } else {
                FMCorrelationEmpty(backtestedCount: backtested.count)
            }
        }
    }

    // MARK: Tear sheet

    private var tearSheetSection: some View {
        VStack(alignment: .leading, spacing: TarsTheme.Space.m) {
            FMSectionHeader(text: "Tear sheet")
            VStack(alignment: .leading, spacing: TarsTheme.Space.m) {
                ScrollView(.horizontal, showsIndicators: false) {
                    Text(tearSheetTable())
                        .font(TarsTheme.Text.mono)
                        .foregroundStyle(TarsTheme.inkSecondary)
                        .lineSpacing(3)
                        .fixedSize(horizontal: true, vertical: false)
                }
                Divider().overlay(TarsTheme.hairline)
                Text(tearSheetSummary())
                    .font(TarsTheme.Text.mono)
                    .foregroundStyle(TarsTheme.inkSecondary)
                    .lineSpacing(3)
                Text("Figures marked ~ are approximations: simulated fills, aligned-tail curves, out-of-sample slices only. LP letters round up; this one doesn't.")
                    .font(TarsTheme.Text.caption)
                    .foregroundStyle(TarsTheme.inkTertiary)
                    .fixedSize(horizontal: false, vertical: true)
            }
            .padding(TarsTheme.Space.l)
            .frame(maxWidth: .infinity, alignment: .leading)
            .tarsPanel()
            .overlay(alignment: .topTrailing) {
                FMPaperStamp()
                    .padding(TarsTheme.Space.m)
                    .allowsHitTesting(false)
            }
        }
    }

    // MARK: Tear sheet text

    private func tearSheetTable() -> String {
        var lines: [String] = []
        lines.append(
            "AGENT".fmPad(18) + "ALLOC".fmPad(10) + "SHARE".fmPad(8) +
            "~OOS/YR".fmPad(9) + "~MAXDD".fmPad(8) + "~SHARPE".fmPad(9) + "STATUS")
        for agent in lab.agents {
            let result = lab.backtests[agent.id]
            let alloc = agent.allocation.formatted(.currency(code: "USD").precision(.fractionLength(0)))
            let share = totalAUM > 0
                ? String(format: "%.1f%%", agent.allocation / totalAUM * 100) : "—"
            let oos = result.map { String(format: "%+.1f%%", $0.outOfSample.annualizedReturn * 100) } ?? "—"
            let dd = result.map { String(format: "%.1f%%", $0.outOfSample.maxDrawdown * 100) } ?? "—"
            let sharpe = result.map { String(format: "%.2f", $0.outOfSample.sharpe) } ?? "—"
            lines.append(
                String(agent.name.prefix(16)).fmPad(18) + alloc.fmPad(10) + share.fmPad(8) +
                oos.fmPad(9) + dd.fmPad(8) + sharpe.fmPad(9) + agent.status.label.lowercased())
        }
        return lines.joined(separator: "\n")
    }

    private func tearSheetSummary() -> String {
        let entries = backtested
        var weighted = "—"
        let backtestedAlloc = entries.reduce(0) { $0 + $1.agent.allocation }
        if backtestedAlloc > 0 {
            let value = entries.reduce(0) {
                $0 + $1.agent.allocation / backtestedAlloc * (lab.backtests[$1.agent.id]?.outOfSample.annualizedReturn ?? 0)
            }
            weighted = String(format: "%+.1f%%", value * 100)
        }
        var avgCorr = "—"
        if entries.count >= 2 {
            var values: [Double] = []
            for i in 0..<entries.count {
                for j in (i + 1)..<entries.count {
                    values.append(fmPearson(entries[i].returns, entries[j].returns))
                }
            }
            if !values.isEmpty {
                avgCorr = String(format: "%.2f", values.reduce(0, +) / Double(values.count))
            }
        }
        return """
        TOTAL PAPER AUM      \(totalAUM.formatted(.currency(code: "USD").precision(.fractionLength(0))))
        SLEEVES              \(lab.agents.count)  (\(entries.count) backtested)
        ~WTD OOS RETURN/YR   \(weighted)  (allocation-weighted, simulated)
        ~AVG PAIR CORR       \(avgCorr)  (out-of-sample daily returns)
        """
    }

    private func tearSheetExport() -> String {
        """
        TARS TRADING — PAPER FUND TEAR SHEET
        \(Date.now.formatted(date: .abbreviated, time: .shortened))
        ════════════════════════════════════════════

        \(tearSheetTable())

        \(tearSheetSummary())

        All figures are simulated paper results with approximations
        (slippage, fills, aligned data tails, out-of-sample slices).
        They describe one past and promise nothing about any future.
        Not investment advice. PAPER FUND.
        """
    }
}

// MARK: - String padding for the monospaced tables

fileprivate extension String {
    func fmPad(_ width: Int) -> String {
        count >= width ? self + " " : self + String(repeating: " ", count: width - count)
    }
}

// MARK: - Math

fileprivate func fmDailyReturns(_ equity: [Double]) -> [Double] {
    guard equity.count > 1 else { return [] }
    var returns: [Double] = []
    returns.reserveCapacity(equity.count - 1)
    for i in 1..<equity.count where equity[i - 1] > 0 {
        returns.append(equity[i] / equity[i - 1] - 1)
    }
    return returns
}

fileprivate func fmPearson(_ a: [Double], _ b: [Double]) -> Double {
    let n = min(a.count, b.count)
    guard n > 1 else { return 0 }
    let x = Array(a.suffix(n))
    let y = Array(b.suffix(n))
    let meanX = x.reduce(0, +) / Double(n)
    let meanY = y.reduce(0, +) / Double(n)
    var cov = 0.0, varX = 0.0, varY = 0.0
    for i in 0..<n {
        let dx = x[i] - meanX
        let dy = y[i] - meanY
        cov += dx * dy
        varX += dx * dx
        varY += dy * dy
    }
    let denom = (varX * varY).squareRoot()
    guard denom > 0 else { return 0 }
    return max(-1, min(1, cov / denom))
}

// MARK: - Section header

fileprivate struct FMSectionHeader: View {
    let text: String
    var body: some View {
        Text(text.uppercased())
            .font(TarsTheme.Text.micro)
            .tracking(1.2)
            .foregroundStyle(TarsTheme.inkTertiary)
    }
}

// MARK: - PAPER FUND stamp

fileprivate struct FMPaperStamp: View {
    var body: some View {
        Text("PAPER FUND")
            .font(TarsTheme.Text.caption)
            .tracking(2)
            .foregroundStyle(TarsTheme.paperBadge.opacity(0.85))
            .padding(.horizontal, TarsTheme.Space.m)
            .padding(.vertical, TarsTheme.Space.xs)
            .overlay(
                RoundedRectangle(cornerRadius: TarsTheme.Radius.s, style: .continuous)
                    .strokeBorder(TarsTheme.paperBadge.opacity(0.55), lineWidth: 1.5)
            )
            .rotationEffect(.degrees(-6))
            .accessibilityLabel("Paper fund — simulated capital")
    }
}

// MARK: - Sleeve card

fileprivate struct FMSleeveCard: View {
    let agent: TradingAgent
    let share: Double

    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var barShown = false

    private var statusColor: Color {
        switch agent.status {
        case .draft: TarsTheme.inkTertiary
        case .backtested: TarsTheme.accent
        case .running: TarsTheme.gain
        case .paused: TarsTheme.paperBadge
        case .killed: TarsTheme.loss
        }
    }

    var body: some View {
        VStack(alignment: .leading, spacing: TarsTheme.Space.m) {
            HStack(spacing: TarsTheme.Space.s) {
                Text(agent.emoji).font(TarsTheme.Text.heading)
                Text(agent.name)
                    .font(TarsTheme.Text.heading)
                    .foregroundStyle(TarsTheme.inkPrimary)
                    .lineLimit(1)
                Spacer(minLength: TarsTheme.Space.s)
                HStack(spacing: TarsTheme.Space.xs) {
                    Circle().fill(statusColor).frame(width: 6, height: 6)
                    Text(agent.status.label)
                        .font(TarsTheme.Text.micro)
                        .foregroundStyle(statusColor)
                }
                .padding(.horizontal, TarsTheme.Space.s)
                .padding(.vertical, TarsTheme.Space.xs)
                .background(Capsule().fill(TarsTheme.bg3))
            }

            HStack(alignment: .firstTextBaseline) {
                Text(agent.allocation, format: .currency(code: "USD").precision(.fractionLength(0)))
                    .font(TarsTheme.Text.price)
                    .foregroundStyle(TarsTheme.inkPrimary)
                    .lineLimit(1)
                    .minimumScaleFactor(0.6)
                Spacer()
                Text(share, format: .percent.precision(.fractionLength(1)))
                    .font(TarsTheme.Text.priceSmall)
                    .foregroundStyle(TarsTheme.inkSecondary)
                    .lineLimit(1)
            }

            GeometryReader { geo in
                ZStack(alignment: .leading) {
                    Capsule().fill(TarsTheme.bg3)
                    Capsule()
                        .fill(TarsTheme.accent)
                        .frame(width: geo.size.width * share * (barShown ? 1 : 0))
                }
            }
            .frame(height: 6)
            .onAppear {
                if reduceMotion {
                    barShown = true
                } else {
                    withAnimation(Motion.spatial.delay(0.1)) { barShown = true }
                }
            }
            .accessibilityLabel("Allocation share \(Int(share * 100)) percent")
        }
        .padding(TarsTheme.Space.l)
        .frame(maxWidth: .infinity, alignment: .leading)
        .tarsPanel()
    }
}

// MARK: - Correlation grid

/// Pairwise Pearson correlation of out-of-sample daily returns, drawn as a
/// heat grid. Diverging scale: green at −1 (sleeves that zig when others zag),
/// red at +1 (sleeves that are secretly the same trade), neutral near zero.
fileprivate struct FMCorrelationGrid: View {
    let entries: [(agent: TradingAgent, returns: [Double])]

    private var cellSize: CGFloat {
        max(34, min(52, 320 / CGFloat(entries.count)))
    }

    private func correlation(_ i: Int, _ j: Int) -> Double {
        fmPearson(entries[i].returns, entries[j].returns)
    }

    private func cellColor(_ value: Double) -> Color {
        let base = value >= 0 ? TarsTheme.loss : TarsTheme.gain
        return base.opacity(0.10 + 0.55 * min(1, abs(value)))
    }

    var body: some View {
        VStack(alignment: .leading, spacing: TarsTheme.Space.m) {
            ScrollView(.horizontal, showsIndicators: false) {
                Grid(horizontalSpacing: TarsTheme.Space.xs, verticalSpacing: TarsTheme.Space.xs) {
                    GridRow {
                        Color.clear.frame(width: cellSize, height: cellSize / 2)
                        ForEach(entries.indices, id: \.self) { j in
                            Text(entries[j].agent.emoji)
                                .font(TarsTheme.Text.body)
                                .frame(width: cellSize, height: cellSize / 2)
                                .accessibilityLabel(entries[j].agent.name)
                        }
                    }
                    ForEach(entries.indices, id: \.self) { i in
                        GridRow {
                            Text(entries[i].agent.emoji)
                                .font(TarsTheme.Text.body)
                                .frame(width: cellSize, height: cellSize)
                                .accessibilityLabel(entries[i].agent.name)
                            ForEach(entries.indices, id: \.self) { j in
                                cell(i, j)
                            }
                        }
                    }
                }
            }

            legend

            HStack(spacing: TarsTheme.Space.xs) {
                ForEach(entries.indices, id: \.self) { i in
                    Text("\(entries[i].agent.emoji) \(entries[i].agent.name)")
                        .font(TarsTheme.Text.micro)
                        .foregroundStyle(TarsTheme.inkTertiary)
                        .lineLimit(1)
                    if i < entries.count - 1 {
                        Text("·").font(TarsTheme.Text.micro).foregroundStyle(TarsTheme.inkTertiary)
                    }
                }
            }

            Text("Computed from out-of-sample daily returns — an approximation, not a law. Low correlation means the sleeves fail at different times, which is the whole point of holding more than one.")
                .font(TarsTheme.Text.caption)
                .foregroundStyle(TarsTheme.inkTertiary)
                .fixedSize(horizontal: false, vertical: true)
        }
        .padding(TarsTheme.Space.l)
        .frame(maxWidth: .infinity, alignment: .leading)
        .tarsPanel()
    }

    @ViewBuilder
    private func cell(_ i: Int, _ j: Int) -> some View {
        if i == j {
            RoundedRectangle(cornerRadius: TarsTheme.Radius.s / 2, style: .continuous)
                .fill(TarsTheme.bg3)
                .frame(width: cellSize, height: cellSize)
                .overlay(
                    Text("—")
                        .font(TarsTheme.Text.micro)
                        .foregroundStyle(TarsTheme.inkTertiary)
                )
        } else {
            let value = correlation(i, j)
            RoundedRectangle(cornerRadius: TarsTheme.Radius.s / 2, style: .continuous)
                .fill(cellColor(value))
                .frame(width: cellSize, height: cellSize)
                .overlay(
                    Text(value, format: .number.precision(.fractionLength(2)))
                        .font(TarsTheme.Text.micro.monospacedDigit())
                        .foregroundStyle(TarsTheme.inkPrimary)
                )
                .accessibilityLabel(
                    "\(entries[i].agent.name) and \(entries[j].agent.name): correlation " + String(format: "%.2f", value))
        }
    }

    private var legend: some View {
        HStack(spacing: TarsTheme.Space.s) {
            Text("−1 diversifying")
                .font(TarsTheme.Text.micro)
                .monospacedDigit()
                .foregroundStyle(TarsTheme.gain)
            Capsule()
                .fill(
                    LinearGradient(
                        colors: [TarsTheme.gain.opacity(0.65), TarsTheme.bg3, TarsTheme.loss.opacity(0.65)],
                        startPoint: .leading, endPoint: .trailing)
                )
                .frame(width: 120, height: 6)
            Text("+1 herding")
                .font(TarsTheme.Text.micro)
                .monospacedDigit()
                .foregroundStyle(TarsTheme.loss)
        }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("Color scale from minus one, diversifying, to plus one, herding")
    }
}

fileprivate struct FMCorrelationEmpty: View {
    let backtestedCount: Int

    var body: some View {
        VStack(spacing: TarsTheme.Space.m) {
            Image(systemName: "square.grid.3x3")
                .font(TarsTheme.Text.title)
                .foregroundStyle(TarsTheme.inkTertiary)
            Text("Correlation needs at least two backtested agents.")
                .font(TarsTheme.Text.body)
                .foregroundStyle(TarsTheme.inkSecondary)
            Text(backtestedCount == 1
                 ? "One agent is a strategy. Two is a portfolio question — backtest another sleeve and this grid wakes up."
                 : "Backtest a couple of sleeves and this grid will show whether they're actually different bets or the same bet in costumes.")
                .font(TarsTheme.Text.caption)
                .foregroundStyle(TarsTheme.inkTertiary)
                .multilineTextAlignment(.center)
                .frame(maxWidth: 420)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, TarsTheme.Space.xl)
        .tarsPanel()
    }
}

// MARK: - Empty state (no agents at all)

fileprivate struct FMEmptyState: View {
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var appeared = false

    var body: some View {
        VStack(spacing: TarsTheme.Space.l) {
            ZStack {
                Circle()
                    .fill(TarsTheme.agentPurple.opacity(0.10))
                    .frame(width: 96, height: 96)
                Image(systemName: "building.columns")
                    .font(TarsTheme.Text.hero)
                    .foregroundStyle(TarsTheme.agentPurple)
            }
            .scaleEffect(appeared ? 1 : 0.85)
            .opacity(appeared ? 1 : 0)
            .accessibilityHidden(true)

            VStack(spacing: TarsTheme.Space.s) {
                Text("No fund yet")
                    .font(TarsTheme.Text.title)
                    .foregroundStyle(TarsTheme.inkPrimary)
                Text("Build an agent, backtest it, and this page becomes your personal paper fund — sleeves, correlations, tear sheet, the works. Right now it's a very calm dashboard.")
                    .font(TarsTheme.Text.body)
                    .foregroundStyle(TarsTheme.inkSecondary)
                    .multilineTextAlignment(.center)
                    .frame(maxWidth: 440)
            }
            .opacity(appeared ? 1 : 0)
        }
        .onAppear {
            if reduceMotion {
                appeared = true
            } else {
                withAnimation(Motion.spatial) { appeared = true }
            }
        }
    }
}
