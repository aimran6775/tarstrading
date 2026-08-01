import SwiftUI

/*
  The ticket — committing simulated money should feel like a decision.

  One sheet: size it, see what it costs at the live quote, then HOLD the
  gold button while the ring fills. Release early and it springs back;
  nothing about this can be fat-fingered. The server owns every judgment —
  margin, costs, fills — and when it rejects, its sentence is shown whole,
  because the platform's rejections are teaching copy.
*/
struct TradeTicketSheet: View {
    let symbol: String
    let side: String              // "buy" | "sell"
    let quote: APIQuote?
    @Environment(\.dismiss) private var dismiss

    @State private var qty: Double = 1
    @State private var preview: MarginPreview?
    @State private var bracket = false
    @State private var takeProfit = ""
    @State private var stopLoss = ""
    @State private var phase: Phase = .compose
    enum Phase: Equatable {
        case compose, submitting
        case done(PlacedOrderPayloadLite)
        case failed(String)
    }
    struct PlacedOrderPayloadLite: Equatable { let status: String; let fill: Double?; let reason: String? }

    private var estCost: Double? { quote.map { $0.price * qty } }
    private var isBuy: Bool { side == "buy" }
    private var isFutures: Bool { symbol.uppercased().hasPrefix("FUT:") }

    var body: some View {
        VStack(spacing: TarsTheme.Space.l) {
            Capsule().fill(TarsTheme.bg3).frame(width: 36, height: 5).padding(.top, 10)

            Text("\(isBuy ? "Buy" : "Sell") \(SymbolDisplay.pretty(symbol))")
                .font(TarsTheme.Text.title)
                .foregroundStyle(TarsTheme.inkPrimary)

            switch phase {
            case .compose, .submitting:
                composeBody
            case .done(let o):
                resultBody(o)
            case .failed(let message):
                failedBody(message)
            }
            Spacer(minLength: 0)
        }
        .padding(.horizontal, TarsTheme.Space.xl)
        .presentationDetents([.height(isFutures || bracket ? 520 : 400)])
        .presentationDragIndicator(.hidden)
        .presentationBackground(TarsTheme.bg1)
    }

    /*
      The award moment: what this contract ACTUALLY requires, before you
      commit — and when it hedges the book, how much the exchange forgives
      for it. Priced by the same function as the order gate, so this can
      never promise something the gate then refuses.
    */
    private var futuresMarginBlock: some View {
        VStack(spacing: TarsTheme.Space.s) {
            HStack {
                Text("Initial margin")
                    .font(TarsTheme.Text.body).foregroundStyle(TarsTheme.inkSecondary)
                Spacer()
                if let p = preview {
                    Text(p.delta, format: .currency(code: "USD").precision(.fractionLength(0)))
                        .font(TarsTheme.Text.heading.monospacedDigit())
                        .foregroundStyle(p.affordable ? TarsTheme.inkPrimary : TarsTheme.loss)
                } else {
                    ProgressView().tint(TarsTheme.inkTertiary)
                }
            }
            if let p = preview, p.creditVsNaive > 0.5 {
                Text("\(p.creditVsNaive, format: .currency(code: "USD").precision(.fractionLength(0))) cheaper than margining it alone — it hedges your book.")
                    .font(TarsTheme.Text.micro)
                    .foregroundStyle(TarsTheme.gain)
                    .frame(maxWidth: .infinity, alignment: .leading)
            }
            if let p = preview, !p.affordable {
                Text("Exceeds your equity — the desk would reject this.")
                    .font(TarsTheme.Text.micro)
                    .foregroundStyle(TarsTheme.loss)
                    .frame(maxWidth: .infinity, alignment: .leading)
            }
        }
        .padding(.horizontal, TarsTheme.Space.l)
        .task(id: qty) { await loadPreview() }
    }

    /// Exits attached at entry: whichever fills first cancels the other.
    private var bracketBlock: some View {
        VStack(spacing: TarsTheme.Space.s) {
            Toggle(isOn: $bracket) {
                Text("Attach exits")
                    .font(TarsTheme.Text.body).foregroundStyle(TarsTheme.inkSecondary)
            }
            .tint(TarsTheme.paperBadge)
            if bracket {
                HStack(spacing: TarsTheme.Space.m) {
                    legField("Take profit", text: $takeProfit, tone: TarsTheme.gain)
                    legField("Stop loss", text: $stopLoss, tone: TarsTheme.loss)
                }
                Text("Both go live only if this entry fills; the first to trigger cancels the other.")
                    .font(TarsTheme.Text.micro)
                    .foregroundStyle(TarsTheme.inkQuaternary)
                    .frame(maxWidth: .infinity, alignment: .leading)
            }
        }
        .padding(.horizontal, TarsTheme.Space.l)
    }

    private func legField(_ label: String, text: Binding<String>, tone: Color) -> some View {
        HStack(spacing: 6) {
            Text(label).font(TarsTheme.Text.micro).foregroundStyle(tone)
            TextField("—", text: text)
                .keyboardType(.decimalPad)
                .multilineTextAlignment(.trailing)
                .font(TarsTheme.Text.caption.monospacedDigit())
                .foregroundStyle(TarsTheme.inkPrimary)
        }
        .padding(.horizontal, 12)
        .frame(height: 44)
        .background(TarsTheme.bg2)
        .clipShape(RoundedRectangle(cornerRadius: TarsTheme.Radius.m, style: .continuous))
    }

    private func loadPreview() async {
        guard isFutures else { return }
        preview = try? await TarsAPIClient.shared
            .marginPreview(symbol: symbol, qty: isBuy ? qty : -qty).preview
    }

    private var composeBody: some View {
        VStack(spacing: TarsTheme.Space.l) {
            // Size — whole shares; the server enforces, this just steps.
            HStack {
                Text("Quantity").font(TarsTheme.Text.body).foregroundStyle(TarsTheme.inkSecondary)
                Spacer()
                HStack(spacing: TarsTheme.Space.l) {
                    stepper("minus") { if qty > 1 { qty -= 1; Haptics.tick() } }
                    Text(qty, format: .number.precision(.fractionLength(0)))
                        .font(TarsTheme.Text.heading.monospacedDigit())
                        .foregroundStyle(TarsTheme.inkPrimary)
                        .frame(minWidth: 44)
                        .contentTransition(.numericText())
                        .animation(.snappy, value: qty)
                    stepper("plus") { qty += 1; Haptics.tick() }
                }
            }
            .padding(TarsTheme.Space.l)
            .background(TarsTheme.bg2)
            .clipShape(RoundedRectangle(cornerRadius: TarsTheme.Radius.m, style: .continuous))

            if isFutures {
                futuresMarginBlock
            } else {
                // The cost, at the quote the user can see.
                HStack {
                    Text("Est. \(isBuy ? "cost" : "credit")")
                        .font(TarsTheme.Text.body).foregroundStyle(TarsTheme.inkSecondary)
                    Spacer()
                    if let est = estCost {
                        Text(est, format: .currency(code: "USD"))
                            .font(TarsTheme.Text.heading.monospacedDigit())
                            .foregroundStyle(TarsTheme.inkPrimary)
                    } else {
                        Text("—").foregroundStyle(TarsTheme.inkTertiary)
                    }
                }
                .padding(.horizontal, TarsTheme.Space.l)
                bracketBlock
            }

            HoldRitual(
                label: "Hold to \(isBuy ? "buy" : "sell")",
                tone: isBuy ? TarsTheme.paperBadge : TarsTheme.loss,
                enabled: phase == .compose && quote != nil
            ) { submit() }

            Text(isFutures
                 ? "Market order · no principal moves · margin is a requirement, not a debit"
                 : "Market order · simulated money · costs included by the exchange")
                .font(TarsTheme.Text.micro)
                .foregroundStyle(TarsTheme.inkQuaternary)
        }
    }

    private func resultBody(_ o: PlacedOrderPayloadLite) -> some View {
        VStack(spacing: TarsTheme.Space.m) {
            Image(systemName: o.status == "filled" ? "checkmark.circle.fill" : "clock.fill")
                .font(.system(size: 44))
                .foregroundStyle(o.status == "filled" ? TarsTheme.gain : TarsTheme.paperBadge)
            Text(o.status == "filled" ? "Filled" : "Working")
                .font(TarsTheme.Text.title).foregroundStyle(TarsTheme.inkPrimary)
            if let fill = o.fill {
                Text("at \(SymbolDisplay.price(symbol, fill))")
                    .font(TarsTheme.Text.heading.monospacedDigit())
                    .foregroundStyle(TarsTheme.inkSecondary)
            }
            Button("Done") { dismiss() }
                .font(TarsTheme.Text.heading)
                .frame(maxWidth: .infinity, minHeight: 50)
                .background(TarsTheme.bg3)
                .foregroundStyle(TarsTheme.inkPrimary)
                .clipShape(RoundedRectangle(cornerRadius: TarsTheme.Radius.m, style: .continuous))
        }
    }

    private func failedBody(_ message: String) -> some View {
        VStack(spacing: TarsTheme.Space.m) {
            Image(systemName: "xmark.octagon.fill")
                .font(.system(size: 40)).foregroundStyle(TarsTheme.loss)
            // The server's sentence, whole — its rejections teach.
            Text(message)
                .font(TarsTheme.Text.body)
                .foregroundStyle(TarsTheme.inkSecondary)
                .multilineTextAlignment(.center)
            Button("Adjust") { phase = .compose }
                .font(TarsTheme.Text.heading)
                .frame(maxWidth: .infinity, minHeight: 50)
                .background(TarsTheme.bg3)
                .foregroundStyle(TarsTheme.inkPrimary)
                .clipShape(RoundedRectangle(cornerRadius: TarsTheme.Radius.m, style: .continuous))
        }
    }

    private func stepper(_ icon: String, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Image(systemName: icon)
                .font(.system(size: 15, weight: .bold))
                .foregroundStyle(TarsTheme.inkPrimary)
                .frame(width: 44, height: 44)
                .background(TarsTheme.bg3)
                .clipShape(Circle())
        }
        .buttonStyle(.plain)
    }

    private func submit() {
        phase = .submitting
        Haptics.confirm()
        Task {
            do {
                let o = try await TarsAPIClient.shared.placeOrder(
                    symbol: symbol, side: side, qty: qty,
                    takeProfit: bracket ? Double(takeProfit) : nil,
                    stopLoss: bracket ? Double(stopLoss) : nil)
                if o.status == "rejected" {
                    phase = .failed(o.rejectReason ?? "The exchange declined this order.")
                    Haptics.warning()
                } else {
                    phase = .done(.init(status: o.status, fill: o.filledPrice, reason: nil))
                    Haptics.success()
                }
            } catch {
                phase = .failed(error.localizedDescription)
                Haptics.warning()
            }
        }
    }
}

/*
  The ritual: hold ~0.7s while the ring traces the capsule. Releasing early
  cancels — deliberately impossible to trigger by a stray tap, and the
  progress is FELT (ticks accelerate) as much as seen.
*/
private struct HoldRitual: View {
    let label: String
    let tone: Color
    let enabled: Bool
    let onCommit: () -> Void

    @State private var progress: CGFloat = 0
    @State private var holding = false
    private let duration: Double = 0.7

    var body: some View {
        ZStack {
            RoundedRectangle(cornerRadius: 16, style: .continuous)
                .fill(enabled ? tone.opacity(0.16) : TarsTheme.bg3)
            GeometryReader { geo in
                RoundedRectangle(cornerRadius: 16, style: .continuous)
                    .fill(tone.opacity(0.35))
                    .frame(width: geo.size.width * progress)
                    .animation(holding ? .linear(duration: duration) : .spring(duration: 0.3), value: progress)
            }
            .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
            Text(holding ? "Keep holding…" : label)
                .font(TarsTheme.Text.heading)
                .foregroundStyle(enabled ? tone : TarsTheme.inkTertiary)
        }
        .frame(height: 56)
        .opacity(enabled ? 1 : 0.6)
        .onLongPressGesture(minimumDuration: duration, perform: {
            guard enabled else { return }
            progress = 1
            holding = false
            Haptics.confirm()
            onCommit()
        }, onPressingChanged: { pressing in
            guard enabled else { return }
            holding = pressing
            if pressing { Haptics.tap(); progress = 1 } else if progress < 1 { progress = 0 }
        })
        .accessibilityLabel("\(label). Press and hold to confirm; release early to cancel.")
    }
}
