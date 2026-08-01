import SwiftUI

/*
  The floor — the analysts working your capital.

  Each card states what it IS (its rules, in English), what it PROMISED
  (the out-of-sample backtest, never the in-sample flatter), and what it
  has actually DONE. Floor P&L counts the live book; retired analysts are
  reported separately, because folding a closed history into a running
  number is how a floor lies about itself.
*/
struct AnalystFloorView: View {
    @State private var model = AnalystFloorModel()

    var body: some View {
        ScrollView {
            LazyVStack(alignment: .leading, spacing: TarsTheme.Space.l) {
                summary
                ForEach(model.working) { a in card(a) }
                if !model.retired.isEmpty {
                    TarsMicroLabel("Retired")
                        .padding(.top, TarsTheme.Space.s)
                    ForEach(model.retired) { a in card(a).opacity(0.72) }
                }
                if model.analysts.isEmpty && model.loaded { empty }
                Text("Analysts trade stocks, ETFs and crypto. FX and futures are deliberately out of reach — the rule engine can't roll a contract or reason about a pair's quote currency, and an analyst that mis-sizes those is worse than one that declines them.")
                    .font(TarsTheme.Text.micro)
                    .foregroundStyle(TarsTheme.inkQuaternary)
            }
            .padding(TarsTheme.Space.l)
            .padding(.bottom, 72)
        }
        .background(TarsTheme.bg0)
        .navigationTitle("The Floor")
        .navigationBarTitleDisplayMode(.inline)
        .refreshable { await model.load() }
        .task { if model.analysts.isEmpty { await model.load() } }
    }

    private var summary: some View {
        HStack(spacing: TarsTheme.Space.xl) {
            stat("Running", "\(model.running)")
            stat("Allocated", model.allocated.formatted(.currency(code: "USD").precision(.fractionLength(0))))
            VStack(alignment: .leading, spacing: 2) {
                Text("FLOOR P&L").font(TarsTheme.Text.micro)
                    .foregroundStyle(TarsTheme.inkQuaternary)
                Text("\(model.livePnl > 0 ? "+" : "")\(model.livePnl, format: .currency(code: "USD"))")
                    .font(TarsTheme.Text.heading.monospacedDigit())
                    .foregroundStyle(TarsTheme.pnl(model.livePnl))
                if model.retiredCount > 0 {
                    Text("\(model.retiredPnl >= 0 ? "+" : "")\(model.retiredPnl, format: .currency(code: "USD")) from \(model.retiredCount) retired")
                        .font(TarsTheme.Text.micro)
                        .foregroundStyle(TarsTheme.inkQuaternary)
                }
            }
        }
        .padding(TarsTheme.Space.l)
        .frame(maxWidth: .infinity, alignment: .leading)
        .tarsPanel()
    }

    private func stat(_ l: String, _ v: String) -> some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(l.uppercased()).font(TarsTheme.Text.micro)
                .foregroundStyle(TarsTheme.inkQuaternary)
            Text(v).font(TarsTheme.Text.heading.monospacedDigit())
                .foregroundStyle(TarsTheme.inkPrimary)
        }
    }

    private var empty: some View {
        VStack(alignment: .leading, spacing: TarsTheme.Space.s) {
            Text("No analysts yet.")
                .font(TarsTheme.Text.heading)
                .foregroundStyle(TarsTheme.inkPrimary)
            Text("Describe a strategy to the assistant in plain English and it hires one — backtested before it ever trades.")
                .font(TarsTheme.Text.caption)
                .foregroundStyle(TarsTheme.inkTertiary)
        }
        .padding(TarsTheme.Space.l)
        .frame(maxWidth: .infinity, alignment: .leading)
        .tarsPanel()
    }

    private func card(_ a: APIAnalyst) -> some View {
        VStack(alignment: .leading, spacing: TarsTheme.Space.s) {
            HStack(spacing: TarsTheme.Space.m) {
                Image(systemName: sigil(a.emoji))
                    .font(.system(size: 18, weight: .medium))
                    .foregroundStyle(TarsTheme.agentPurple)
                    .frame(width: 28)
                VStack(alignment: .leading, spacing: 2) {
                    Text(a.name)
                        .font(TarsTheme.Text.heading)
                        .foregroundStyle(TarsTheme.inkPrimary)
                    Text(a.allocation.formatted(.currency(code: "USD").precision(.fractionLength(0)))
                         + " sleeve · \(Int(a.maxDrawdown * 100))% max drawdown")
                        .font(TarsTheme.Text.micro.monospacedDigit())
                        .foregroundStyle(TarsTheme.inkTertiary)
                        .lineLimit(1).minimumScaleFactor(0.8)
                }
                Spacer()
                statusChip(a.status)
            }

            if let thesis = a.thesis, !thesis.isEmpty {
                Text(thesis)
                    .font(TarsTheme.Text.micro)
                    .foregroundStyle(TarsTheme.inkSecondary)
                    .fixedSize(horizontal: false, vertical: true)
            }

            // The honest half of the resume: what it did on data it never saw.
            if let out = a.backtest?.outOfSample {
                HStack(spacing: TarsTheme.Space.l) {
                    if let r = out.totalReturn { miniStat("Out-of-sample", pct(r), tone: r >= 0 ? TarsTheme.gain : TarsTheme.loss) }
                    if let d = out.maxDrawdown { miniStat("Worst fall", pct(-abs(d)), tone: TarsTheme.loss) }
                    if let t = out.trades { miniStat("Trades", "\(t)") }
                }
            }
            if let pnl = a.pnl, a.status == "running" || a.status == "paused" {
                Text("Live: \(pnl >= 0 ? "+" : "")\(pnl, format: .currency(code: "USD"))")
                    .font(TarsTheme.Text.caption.monospacedDigit())
                    .foregroundStyle(pnl > 0 ? TarsTheme.gain : pnl < 0 ? TarsTheme.loss : TarsTheme.inkTertiary)
            }
        }
        .padding(TarsTheme.Space.l)
        .frame(maxWidth: .infinity, alignment: .leading)
        .tarsPanel()
        .accessibilityElement(children: .combine)
    }

    private func miniStat(_ l: String, _ v: String, tone: Color? = nil) -> some View {
        VStack(alignment: .leading, spacing: 1) {
            Text(l.uppercased()).font(.system(size: 8, weight: .semibold, design: .monospaced))
                .foregroundStyle(TarsTheme.inkQuaternary)
            Text(v).font(TarsTheme.Text.caption.monospacedDigit())
                .foregroundStyle(tone ?? TarsTheme.inkPrimary)
        }
    }

    private func pct(_ v: Double) -> String { String(format: "%+.1f%%", v * 100) }

    private func statusChip(_ s: String) -> some View {
        let tone: Color = switch s {
        case "running": TarsTheme.gain
        case "paused": TarsTheme.warning
        case "killed": TarsTheme.inkQuaternary
        case "backtested": TarsTheme.accent
        default: TarsTheme.inkTertiary
        }
        return Text(s == "killed" ? "RETIRED" : s.uppercased())
            .font(.system(size: 9, weight: .bold, design: .monospaced))
            .kerning(0.5)
            .foregroundStyle(tone)
            .padding(.horizontal, 7).padding(.vertical, 3)
            .background(Capsule().fill(tone.opacity(0.12)))
    }

    /// The bench's sigils are names, not emoji — map them to SF Symbols.
    private func sigil(_ key: String) -> String {
        switch key {
        case "breakout": "arrow.up.forward.circle.fill"
        case "meanrevert", "mean": "arrow.left.arrow.right.circle.fill"
        case "trend": "chart.line.uptrend.xyaxis.circle.fill"
        case "momentum": "bolt.circle.fill"
        case "value": "magnifyingglass.circle.fill"
        default: "brain.head.profile"
        }
    }
}

@Observable @MainActor
final class AnalystFloorModel {
    private(set) var analysts: [APIAnalyst] = []
    private(set) var loaded = false
    private let api = TarsAPIClient.shared

    var running: Int { analysts.filter { $0.status == "running" }.count }
    var allocated: Double { analysts.filter { $0.status == "running" }.reduce(0) { $0 + $1.allocation } }
    /// The LIVE book only — retired P&L is real but belongs in its own line.
    var livePnl: Double {
        analysts.filter { $0.status == "running" || $0.status == "paused" }
            .reduce(0) { $0 + ($1.pnl ?? 0) }
    }
    /// The live floor, and the graveyard — separated, because a retired
    /// analyst's record is history, not a running position.
    var working: [APIAnalyst] { analysts.filter { $0.status != "killed" } }
    var retired: [APIAnalyst] { analysts.filter { $0.status == "killed" } }
    var retiredPnl: Double { retired.reduce(0) { $0 + ($1.pnl ?? 0) } }
    var retiredCount: Int { retired.count }

    func load() async {
        analysts = (try? await api.analysts()) ?? analysts
        loaded = true
    }
}
