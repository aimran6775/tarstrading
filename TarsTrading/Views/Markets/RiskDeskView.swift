import SwiftUI

/*
  Risk — the desk's read on your book, including the comparison nobody
  volunteers: what simply buying the index would have done over the same
  days. For most traders most of the time the index wins, and a platform
  whose brand is honesty has to say so.
*/
struct RiskDeskView: View {
    @State private var model = RiskDeskModel()
    @Environment(\.dynamicTypeSize) private var typeSize

    var body: some View {
        ScrollView {
            LazyVStack(alignment: .leading, spacing: TarsTheme.Space.l) {
                windowPicker
                benchmarkCard
                metricsCard
                concentrationCard
                correlationsCard
            }
            .padding(TarsTheme.Space.l)
            // Clear the floating tab bar — the last card must be readable.
            .padding(.bottom, 72)
        }
        .background(TarsTheme.bg0)
        .navigationTitle("Risk")
        .navigationBarTitleDisplayMode(.inline)
        .refreshable { await model.load() }
        .task { if model.report == nil { await model.load() } }
    }

    private var windowPicker: some View {
        HStack(spacing: TarsTheme.Space.s) {
            ForEach([30, 90, 180, 365], id: \.self) { d in
                let on = model.days == d
                Button {
                    Haptics.tick()
                    model.setDays(d)
                } label: {
                    Text("\(d)d")
                        .font(TarsTheme.Text.caption.weight(on ? .bold : .medium))
                        .foregroundStyle(on ? TarsTheme.inkPrimary : TarsTheme.inkTertiary)
                        .frame(maxWidth: .infinity, minHeight: 44)
                        .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
            }
        }
    }

    /// The honest headline.
    private var benchmarkCard: some View {
        VStack(alignment: .leading, spacing: TarsTheme.Space.m) {
            title("You vs. buying the index")
            if let b = model.report?.benchmark, let yours = b.yours, let bench = b.bench {
                let beat = (b.excess ?? 0) > 0
                LazyVGrid(columns: typeSize.isAccessibilitySize
                            ? [GridItem(.flexible(), alignment: .leading)]
                            : Array(repeating: GridItem(.flexible(), alignment: .leading), count: 3),
                          alignment: .leading, spacing: TarsTheme.Space.m) {
                    pct("Your return", yours)
                    pct("SPY, same days", bench)
                    pct("Difference", b.excess ?? 0, forceTone: beat ? TarsTheme.gain : TarsTheme.loss)
                }
                Text(beat
                     ? "You're ahead of the index over this window. Worth knowing whether that came from skill or from carrying more risk — check beta and volatility below."
                     : "The index is ahead of you over this window. That is the ordinary result, not a failing — most professional managers don't beat it either. The question worth asking is whether your trades are earning their risk.")
                    .font(TarsTheme.Text.micro)
                    .foregroundStyle(TarsTheme.inkTertiary)
            } else {
                Text("Not enough history yet — this needs a few days of equity curve. Keep trading; it fills in.")
                    .font(TarsTheme.Text.caption)
                    .foregroundStyle(TarsTheme.inkTertiary)
            }
        }
        .padding(TarsTheme.Space.l)
        .frame(maxWidth: .infinity, alignment: .leading)
        .tarsPanel()
    }

    private var metricsCard: some View {
        LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())],
                  alignment: .leading, spacing: TarsTheme.Space.l) {
            metric("Beta to SPY", model.report?.beta.map { String(format: "%.2f", $0) } ?? "—",
                   sub: model.report?.beta.map { $0 > 1.1 ? "amplifies the market" : $0 < 0.5 ? "moves on its own" : "tracks the market" })
            metric("Your volatility", model.report?.annualVol.map { pctString($0) } ?? "—", sub: "annualised")
            metric("SPY volatility", model.report?.benchVol.map { pctString($0) } ?? "—", sub: "annualised")
            metric("Max drawdown", model.report?.maxDrawdown.map { pctString($0) } ?? "—",
                   sub: "peak to trough",
                   tone: (model.report?.maxDrawdown ?? 0) > 0.2 ? TarsTheme.loss : nil)
        }
        .padding(TarsTheme.Space.l)
        .tarsPanel()
    }

    private var concentrationCard: some View {
        VStack(alignment: .leading, spacing: TarsTheme.Space.s) {
            title("Concentration")
            if let eff = model.report?.effectivePositions {
                Text(String(format: "%.1f", eff))
                    .font(TarsTheme.Text.displayMedium)
                    .foregroundStyle(eff < 2 && (model.report?.correlations.count ?? 0) >= 3
                        ? TarsTheme.warning : TarsTheme.inkPrimary)
                Text("effective positions — you hold \(model.report?.correlations.count ?? 0), but weighted by size the book behaves like this many. Diversification is about weight, not count.")
                    .font(TarsTheme.Text.micro)
                    .foregroundStyle(TarsTheme.inkTertiary)
            } else {
                Text("No positions to measure.")
                    .font(TarsTheme.Text.caption).foregroundStyle(TarsTheme.inkTertiary)
            }
        }
        .padding(TarsTheme.Space.l)
        .frame(maxWidth: .infinity, alignment: .leading)
        .tarsPanel()
    }

    @ViewBuilder private var correlationsCard: some View {
        if let corrs = model.report?.correlations, !corrs.isEmpty {
            VStack(alignment: .leading, spacing: TarsTheme.Space.s) {
                title("How each position moves with the market")
                ForEach(corrs) { c in
                    HStack(spacing: TarsTheme.Space.m) {
                        Text(SymbolDisplay.pretty(c.symbol))
                            .font(TarsTheme.Text.caption.weight(.semibold))
                            .foregroundStyle(TarsTheme.inkPrimary)
                            .frame(width: 76, alignment: .leading)
                        if let r = c.toBench {
                            CorrBar(r: r)
                            Text(String(format: "%.2f", r))
                                .font(TarsTheme.Text.micro.monospacedDigit())
                                .foregroundStyle(TarsTheme.inkSecondary)
                                .frame(width: 40, alignment: .trailing)
                        } else {
                            Text("no overlapping history")
                                .font(TarsTheme.Text.micro)
                                .foregroundStyle(TarsTheme.inkQuaternary)
                            Spacer()
                        }
                    }
                }
                Text("Correlation to SPY. Near 1.0 means it rises and falls with the market — several of those together is one bet wearing different names.")
                    .font(TarsTheme.Text.micro)
                    .foregroundStyle(TarsTheme.inkQuaternary)
            }
            .padding(TarsTheme.Space.l)
            .frame(maxWidth: .infinity, alignment: .leading)
            .tarsPanel()
        }
    }

    // MARK: - Bits

    private func title(_ t: String) -> some View {
        Text(t.uppercased()).font(TarsTheme.Text.micro).kerning(1.4)
            .foregroundStyle(TarsTheme.inkQuaternary)
    }
    private func pctString(_ v: Double) -> String { String(format: "%.1f%%", v * 100) }
    private func pct(_ label: String, _ v: Double, forceTone: Color? = nil) -> some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(label.uppercased()).font(TarsTheme.Text.micro)
                .foregroundStyle(TarsTheme.inkQuaternary)
            Text("\(v >= 0 ? "+" : "")\(v * 100, specifier: "%.2f")%")
                .font(TarsTheme.Text.title.monospacedDigit())
                .lineLimit(1).minimumScaleFactor(0.6)
                .foregroundStyle(forceTone ?? (v > 0 ? TarsTheme.gain : v < 0 ? TarsTheme.loss : TarsTheme.inkPrimary))
        }
    }
    private func metric(_ label: String, _ value: String, sub: String? = nil, tone: Color? = nil) -> some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(label.uppercased()).font(TarsTheme.Text.micro)
                .foregroundStyle(TarsTheme.inkQuaternary)
                .lineLimit(1).minimumScaleFactor(0.7)
            Text(value).font(TarsTheme.Text.heading.monospacedDigit())
                .foregroundStyle(tone ?? TarsTheme.inkPrimary)
            if let sub { Text(sub).font(TarsTheme.Text.micro).foregroundStyle(TarsTheme.inkQuaternary) }
        }
    }
}

/// Signed correlation: right of centre is positive, left is negative.
private struct CorrBar: View {
    let r: Double
    var body: some View {
        GeometryReader { geo in
            ZStack(alignment: .center) {
                Capsule().fill(TarsTheme.bg3).frame(height: 6)
                HStack(spacing: 0) {
                    if r < 0 { Spacer(minLength: 0) }
                    Capsule()
                        .fill(r >= 0 ? TarsTheme.gain.opacity(0.7) : TarsTheme.loss.opacity(0.7))
                        .frame(width: geo.size.width / 2 * CGFloat(abs(r)), height: 6)
                    if r >= 0 { Spacer(minLength: 0) }
                }
                .padding(r >= 0 ? .leading : .trailing, geo.size.width / 2)
            }
        }
        .frame(height: 10)
        .accessibilityLabel("Correlation \(String(format: "%.2f", r))")
    }
}

@Observable @MainActor
final class RiskDeskModel {
    private(set) var report: RiskReportPayload?
    private(set) var days = 90
    private let api = TarsAPIClient.shared

    func setDays(_ d: Int) { days = d; Task { await load() } }
    func load() async { report = try? await api.risk(days: days) }
}
