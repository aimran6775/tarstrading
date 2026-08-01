import SwiftUI

/*
  The Margin Desk — the page a prime broker never gives you.

  Every input your requirement is built from: what each position needs and
  under which regime, the SPAN credits by name, the live rates financing
  runs on, and the cure clock when there is one. You should be able to
  recompute your own margin by hand; this screen is the proof, and it reads
  from the same endpoint the web renders so the two can never disagree.
*/
struct MarginDeskView: View {
    @State private var model = MarginDeskModel()
    @Environment(\.scenePhase) private var scenePhase

    var body: some View {
        ScrollView {
            LazyVStack(alignment: .leading, spacing: TarsTheme.Space.l) {
                if let call = model.marginCall { MarginCallBanner(cureBy: call.cureBy) }
                headline
                spanCard
                financingCard
                regimesCard
                Text("Simulated desk. Margin modeled on CME SPAN and Reg-T; no real clearing membership, no real money.")
                    .font(TarsTheme.Text.micro)
                    .foregroundStyle(TarsTheme.inkQuaternary)
            }
            .padding(TarsTheme.Space.l)
            // Clear the floating tab bar — the last card must be readable.
            .padding(.bottom, 72)
        }
        .background(TarsTheme.bg0)
        .navigationTitle("Margin Desk")
        .navigationBarTitleDisplayMode(.inline)
        .refreshable { await model.load() }
        .task { model.activate() }
        .onDisappear { model.deactivate() }
        .onChange(of: scenePhase) { _, p in
            if p == .active { model.activate() } else { model.deactivate() }
        }
    }

    private var headline: some View {
        VStack(alignment: .leading, spacing: TarsTheme.Space.m) {
            if let r = model.risk {
                LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible()), GridItem(.flexible())],
                          alignment: .leading, spacing: TarsTheme.Space.l) {
                    stat("Equity", r.equity)
                    stat("Cash", r.cash, tone: r.cash < 0 ? TarsTheme.loss : nil,
                         sub: r.cash < 0 ? "borrowing" : nil)
                    stat("Initial req.", r.initialReq)
                    stat("Maintenance", r.maintenance)
                    stat("Buying power", r.buyingPower)
                    VStack(alignment: .leading, spacing: 2) {
                        Text("MARGIN USED").font(TarsTheme.Text.micro)
                            .foregroundStyle(TarsTheme.inkQuaternary)
                        Text("\(r.marginUsedPct * 100, specifier: "%.0f")%")
                            .font(TarsTheme.Text.heading.monospacedDigit())
                            .foregroundStyle(r.marginUsedPct > 0.8 ? TarsTheme.loss
                                : r.marginUsedPct > 0.5 ? TarsTheme.warning : TarsTheme.inkPrimary)
                    }
                }
            } else {
                RoundedRectangle(cornerRadius: 8).fill(TarsTheme.bg3).frame(height: 90)
            }
        }
        .padding(TarsTheme.Space.l)
        .frame(maxWidth: .infinity, alignment: .leading)
        .tarsPanel()
    }

    /// What the portfolio saved by BEING a portfolio.
    @ViewBuilder private var spanCard: some View {
        if let span = model.risk?.span, span.naiveIm > 0 {
            let saved = span.naiveIm - span.im
            VStack(alignment: .leading, spacing: TarsTheme.Space.m) {
                sectionTitle("Futures — portfolio margin (SPAN)")
                HStack(spacing: TarsTheme.Space.xl) {
                    stat("Contract-by-contract", span.naiveIm)
                    stat("As a portfolio", span.im)
                    if saved > 0.5 { stat("Credits", -saved, tone: TarsTheme.gain) }
                }
                if span.intraCredit > 0.5 {
                    creditLine("Calendar / micro-vs-full offsets", span.intraCredit,
                               "opposing legs of the same product margin as a spread, not two outrights.")
                }
                ForEach(span.interCredits, id: \.group) { c in
                    creditLine("\(c.group.capitalized) inter-commodity credit", c.credit,
                               "correlated products in opposite directions.")
                }
                if saved <= 0.5 {
                    Text("No credits right now — every futures position points the same way. Hedge one against another and the requirement falls.")
                        .font(TarsTheme.Text.micro)
                        .foregroundStyle(TarsTheme.inkTertiary)
                }
            }
            .padding(TarsTheme.Space.l)
            .frame(maxWidth: .infinity, alignment: .leading)
            .tarsPanel()
        }
    }

    private func creditLine(_ label: String, _ amount: Double, _ why: String) -> some View {
        VStack(alignment: .leading, spacing: 2) {
            HStack {
                Text(label).font(TarsTheme.Text.caption).foregroundStyle(TarsTheme.inkSecondary)
                Spacer()
                Text("−\(amount, format: .currency(code: "USD").precision(.fractionLength(0)))")
                    .font(TarsTheme.Text.caption.monospacedDigit())
                    .foregroundStyle(TarsTheme.gain)
            }
            Text(why).font(TarsTheme.Text.micro).foregroundStyle(TarsTheme.inkQuaternary)
        }
    }

    /// The price of money, live from the Fed's own series.
    @ViewBuilder private var financingCard: some View {
        if let rates = model.rates {
            VStack(alignment: .leading, spacing: TarsTheme.Space.m) {
                sectionTitle("Financing — accrued daily, actual/360")
                LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())],
                          alignment: .leading, spacing: TarsTheme.Space.m) {
                    rate("Fed funds (live)", rates.fedFunds, sub: "FRED, daily")
                    rate("Margin loan", rates.marginLoan, sub: "fed funds + 1.50%")
                    rate("Idle cash earns", rates.cashSweep, sub: "fed funds − 0.50%", tone: TarsTheme.gain)
                    rate("Stock borrow", rates.borrowGC, sub: "general collateral")
                }
                Text("A leveraged position has to outrun its financing. That cost posts to your journal daily — and idle cash earns a real rate here, which is one habit of the big houses not worth simulating.")
                    .font(TarsTheme.Text.micro)
                    .foregroundStyle(TarsTheme.inkQuaternary)
            }
            .padding(TarsTheme.Space.l)
            .frame(maxWidth: .infinity, alignment: .leading)
            .tarsPanel()
        }
    }

    private func rate(_ label: String, _ value: Double, sub: String, tone: Color? = nil) -> some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(label.uppercased()).font(TarsTheme.Text.micro)
                .foregroundStyle(TarsTheme.inkQuaternary)
            Text("\(value * 100, specifier: "%.2f")%")
                .font(TarsTheme.Text.heading.monospacedDigit())
                .foregroundStyle(tone ?? TarsTheme.inkPrimary)
            Text(sub).font(TarsTheme.Text.micro).foregroundStyle(TarsTheme.inkQuaternary)
        }
    }

    /// Each position, and the rule it lives under.
    private var regimesCard: some View {
        VStack(alignment: .leading, spacing: 0) {
            sectionTitle("Position requirements")
                .padding(.bottom, TarsTheme.Space.s)
            if model.positions.isEmpty {
                Text("No positions. Open one and its requirement appears here, itemised.")
                    .font(TarsTheme.Text.caption)
                    .foregroundStyle(TarsTheme.inkTertiary)
            } else {
                ForEach(model.positions) { p in
                    VStack(alignment: .leading, spacing: 3) {
                        HStack {
                            Text(SymbolDisplay.pretty(p.symbol))
                                .font(TarsTheme.Text.body.weight(.semibold))
                                .foregroundStyle(TarsTheme.inkPrimary)
                            Text(p.qty > 0 ? "+\(p.qty.formatted())" : p.qty.formatted())
                                .font(TarsTheme.Text.micro.monospacedDigit())
                                .foregroundStyle(TarsTheme.inkTertiary)
                            Spacer()
                            Text(p.regime.uppercased())
                                .font(.system(size: 9, weight: .bold, design: .monospaced))
                                .foregroundStyle(TarsTheme.paperBadge)
                        }
                        Text(p.detail).font(TarsTheme.Text.micro)
                            .foregroundStyle(TarsTheme.inkQuaternary)
                    }
                    .padding(.vertical, TarsTheme.Space.s)
                    Divider().overlay(TarsTheme.hairline)
                }
            }
        }
        .padding(TarsTheme.Space.l)
        .frame(maxWidth: .infinity, alignment: .leading)
        .tarsPanel()
    }

    private func sectionTitle(_ t: String) -> some View {
        Text(t.uppercased()).font(TarsTheme.Text.micro).kerning(1.4)
            .foregroundStyle(TarsTheme.inkQuaternary)
    }

    private func stat(_ label: String, _ value: Double, tone: Color? = nil, sub: String? = nil) -> some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(label.uppercased()).font(TarsTheme.Text.micro)
                .foregroundStyle(TarsTheme.inkQuaternary)
            Text(value, format: .currency(code: "USD").precision(.fractionLength(0)))
                .font(TarsTheme.Text.heading.monospacedDigit())
                .foregroundStyle(tone ?? TarsTheme.inkPrimary)
                .minimumScaleFactor(0.7).lineLimit(1)
            if let sub { Text(sub).font(TarsTheme.Text.micro).foregroundStyle(TarsTheme.inkQuaternary) }
        }
    }
}

/*
  The cure clock — the two hours that matter most on any margin desk. It
  counts down in your pocket, which is exactly where a margin call should
  find you.
*/
private struct MarginCallBanner: View {
    let cureBy: Double
    @State private var now = Date()
    private let tick = Timer.publish(every: 1, on: .main, in: .common).autoconnect()

    var body: some View {
        let left = max(0, cureBy / 1000 - now.timeIntervalSince1970)
        VStack(alignment: .leading, spacing: 6) {
            HStack(spacing: 8) {
                Image(systemName: "exclamationmark.triangle.fill")
                    .foregroundStyle(TarsTheme.loss)
                Text(left > 0
                     ? "Margin call — \(Int(left) / 60):\(String(format: "%02d", Int(left) % 60)) to cure"
                     : "Margin call — the desk is reducing your positions")
                    .font(TarsTheme.Text.heading)
                    .foregroundStyle(TarsTheme.loss)
                    .monospacedDigit()
            }
            Text("Close positions to bring equity back above maintenance and the call clears on the next mark. If the clock runs out, the desk liquidates — futures first, then the largest equity position.")
                .font(TarsTheme.Text.micro)
                .foregroundStyle(TarsTheme.inkSecondary)
        }
        .padding(TarsTheme.Space.l)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(TarsTheme.loss.opacity(0.12))
        .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: 14, style: .continuous)
            .strokeBorder(TarsTheme.loss.opacity(0.4), lineWidth: 1))
        .onReceive(tick) { now = $0 }
        .accessibilityAddTraits(.updatesFrequently)
    }
}

@Observable @MainActor
final class MarginDeskModel {
    private(set) var risk: AccountRiskPayload?
    private(set) var rates: FinancingRatesPayload?
    private(set) var positions: [MarginPositionRow] = []
    private(set) var marginCall: MarginCallState?

    private var loop: Task<Void, Never>?
    private let api = TarsAPIClient.shared

    func activate() {
        guard loop == nil else { return }
        loop = Task { [weak self] in
            while !Task.isCancelled {
                await self?.load()
                try? await Task.sleep(for: .seconds(30))
            }
        }
    }
    func deactivate() { loop?.cancel(); loop = nil }

    func load() async {
        guard let res = try? await api.marginDesk() else { return }
        risk = res.risk; rates = res.rates
        positions = res.positions; marginCall = res.marginCall
    }
}
