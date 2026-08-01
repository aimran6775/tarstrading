import SwiftUI

/*
  The interactive half of a lesson, native.

  Reading is not learning. The course knows this — of 337 blocks, 49 are
  flashcard decks, 28 are desk tasks and 13 are calculators. Those were the
  blocks the phone couldn't draw, so a beginner on iOS got the prose and
  missed the practice.

  Two of these are BETTER on a phone than on a desktop, which is the whole
  argument for building them rather than linking out: a deck of cards wants
  a thumb, and a calculator wants a slider you drag.
*/

// MARK: - Flashcards: the biggest interactive element in the course

/// A flip deck. Tap to turn a card over, swipe to move on, and the deck
/// counts down so you know how much is left.
struct FlashcardDeck: View {
    let title: String?
    let cards: [APIFlashcard]

    @State private var index = 0
    @State private var flipped = false

    var body: some View {
        VStack(alignment: .leading, spacing: TarsTheme.Space.m) {
            HStack {
                TarsMicroLabel(title ?? "Lock in the terms")
                Spacer()
                Text("\(index + 1) / \(cards.count)")
                    .font(TarsTheme.Text.micro.monospacedDigit())
                    .foregroundStyle(TarsTheme.inkQuaternary)
            }

            if let card = cards.indices.contains(index) ? cards[index] : nil {
                Button {
                    Haptics.tick()
                    withAnimation(.spring(duration: 0.45)) { flipped.toggle() }
                } label: {
                    VStack(alignment: .leading, spacing: TarsTheme.Space.s) {
                        TarsMicroLabel(flipped ? "Meaning" : "Term",
                                       tone: flipped ? TarsTheme.accent : TarsTheme.inkQuaternary)
                        Text(flipped ? card.back : card.front)
                            .font(flipped ? TarsTheme.Text.body : TarsTheme.Text.title)
                            .foregroundStyle(TarsTheme.inkPrimary)
                            .fixedSize(horizontal: false, vertical: true)
                            .frame(maxWidth: .infinity, alignment: .leading)
                        if !flipped {
                            Text("Tap to turn over")
                                .font(TarsTheme.Text.micro)
                                .foregroundStyle(TarsTheme.inkQuaternary)
                        }
                    }
                    .padding(TarsTheme.Space.l)
                    .frame(maxWidth: .infinity, minHeight: 132, alignment: .topLeading)
                    .background(flipped ? TarsTheme.bg2 : TarsTheme.bg1)
                    .clipShape(RoundedRectangle(cornerRadius: TarsTheme.Radius.m, style: .continuous))
                    .overlay(RoundedRectangle(cornerRadius: TarsTheme.Radius.m, style: .continuous)
                        .strokeBorder(flipped ? TarsTheme.accent.opacity(0.30) : TarsTheme.hairline,
                                      lineWidth: 1))
                    // The turn reads as a physical flip, not a crossfade.
                    .rotation3DEffect(.degrees(flipped ? 180 : 0), axis: (x: 0, y: 1, z: 0))
                    .scaleEffect(x: flipped ? -1 : 1, y: 1)
                }
                .buttonStyle(.plain)
                .accessibilityLabel(flipped ? "\(card.front). \(card.back)" : card.front)
                .accessibilityHint("Double tap to turn the card over")
            }

            HStack(spacing: TarsTheme.Space.m) {
                deckButton("chevron.left", disabled: index == 0) {
                    withAnimation(.snappy) { flipped = false; index -= 1 }
                }
                deckButton("chevron.right", disabled: index >= cards.count - 1) {
                    withAnimation(.snappy) { flipped = false; index += 1 }
                }
                Spacer()
                if index == cards.count - 1 {
                    Button {
                        Haptics.tap()
                        withAnimation(.snappy) { flipped = false; index = 0 }
                    } label: {
                        Text("Run the deck again")
                            .font(TarsTheme.Text.caption.weight(.medium))
                            .foregroundStyle(TarsTheme.accent)
                    }
                    .buttonStyle(.plain)
                }
            }
        }
        .padding(TarsTheme.Space.l)
        .frame(maxWidth: .infinity, alignment: .leading)
        .tarsPanel()
    }

    private func deckButton(_ icon: String, disabled: Bool,
                            action: @escaping () -> Void) -> some View {
        Button(action: { Haptics.tick(); action() }) {
            Image(systemName: icon)
                .font(.system(size: 14, weight: .bold))
                .foregroundStyle(disabled ? TarsTheme.disabled(TarsTheme.inkPrimary) : TarsTheme.inkPrimary)
                .frame(width: 44, height: 40)
                .background(TarsTheme.bg3.opacity(disabled ? 0.4 : 1))
                .clipShape(RoundedRectangle(cornerRadius: TarsTheme.Radius.s, style: .continuous))
        }
        .buttonStyle(.plain)
        .disabled(disabled)
    }
}

// MARK: - Calculators: the formula, with your hands on it

/// The lesson states a formula; this lets you FEEL it. Drag the inputs and
/// watch the answer move — the fastest way to internalise position sizing.
struct LessonCalculator: View {
    let tool: String
    let title: String?

    @State private var equity: Double = 100_000
    @State private var riskPct: Double = 1
    @State private var entry: Double = 100
    @State private var stop: Double = 95
    @State private var target: Double = 115
    @State private var winRate: Double = 45
    @State private var years: Double = 10
    @State private var annual: Double = 8

    var body: some View {
        VStack(alignment: .leading, spacing: TarsTheme.Space.l) {
            TarsMicroLabel(title ?? defaultTitle)
            switch tool {
            case "position-size": positionSize
            case "risk-reward": riskReward
            case "expectancy": expectancy
            case "compounding": compounding
            default: Text("This calculator isn't available in this build yet.")
                .font(TarsTheme.Text.caption)
                .foregroundStyle(TarsTheme.inkTertiary)
            }
        }
        .padding(TarsTheme.Space.l)
        .frame(maxWidth: .infinity, alignment: .leading)
        .tarsPanel()
    }

    private var defaultTitle: String {
        switch tool {
        case "position-size": "Size it yourself"
        case "risk-reward": "Risk and reward"
        case "expectancy": "What the edge is worth"
        case "compounding": "Time doing the work"
        default: "Calculator"
        }
    }

    // MARK: The four tools

    private var positionSize: some View {
        let risk = equity * riskPct / 100
        let perShare = max(entry - stop, 0.01)
        let shares = (risk / perShare).rounded(.down)
        return VStack(alignment: .leading, spacing: TarsTheme.Space.l) {
            slider("Account", value: $equity, range: 10_000...500_000, step: 5_000,
                   display: equity.formatted(.currency(code: "USD").precision(.fractionLength(0))))
            slider("Risk per trade", value: $riskPct, range: 0.25...5, step: 0.25,
                   display: String(format: "%.2f%%", riskPct))
            slider("Entry", value: $entry, range: 5...500, step: 1,
                   display: entry.formatted(.currency(code: "USD").precision(.fractionLength(0))))
            slider("Stop", value: $stop, range: 1...499, step: 1,
                   display: stop.formatted(.currency(code: "USD").precision(.fractionLength(0))))
            answer("Buy at most", "\(Int(shares)) shares",
                   note: "Risking \(risk.formatted(.currency(code: "USD").precision(.fractionLength(0)))) — "
                       + "\(String(format: "%.2f", perShare)) per share to your stop. "
                       + "The size falls out of the stop; it is never a guess.")
        }
    }

    private var riskReward: some View {
        let risk = max(entry - stop, 0.01)
        let reward = max(target - entry, 0)
        let r = reward / risk
        return VStack(alignment: .leading, spacing: TarsTheme.Space.l) {
            slider("Entry", value: $entry, range: 5...500, step: 1,
                   display: entry.formatted(.currency(code: "USD").precision(.fractionLength(0))))
            slider("Stop", value: $stop, range: 1...499, step: 1,
                   display: stop.formatted(.currency(code: "USD").precision(.fractionLength(0))))
            slider("Target", value: $target, range: 5...800, step: 1,
                   display: target.formatted(.currency(code: "USD").precision(.fractionLength(0))))
            answer("Reward to risk", String(format: "%.2f R", r),
                   tone: r >= 2 ? TarsTheme.gain : r >= 1 ? TarsTheme.inkPrimary : TarsTheme.loss,
                   note: r >= 2
                     ? "At this ratio you can be wrong more often than right and still make money."
                     : "Below 2R you need a high hit rate to survive costs. That is a harder way to live.")
        }
    }

    private var expectancy: some View {
        let risk = max(entry - stop, 0.01)
        let reward = max(target - entry, 0)
        let r = reward / risk
        let p = winRate / 100
        let ev = p * r - (1 - p)
        return VStack(alignment: .leading, spacing: TarsTheme.Space.l) {
            slider("Win rate", value: $winRate, range: 10...90, step: 1,
                   display: String(format: "%.0f%%", winRate))
            slider("Reward per 1 risked", value: $target, range: entry...(entry * 4), step: 1,
                   display: String(format: "%.2f R", r))
            answer("Expected value", String(format: "%+.2f R per trade", ev),
                   tone: TarsTheme.pnl(ev),
                   note: ev > 0
                     ? "Positive expectancy: repeated enough times, with sizing that survives the losing runs, this makes money."
                     : "Negative expectancy. No amount of discipline fixes a strategy whose arithmetic loses.")
        }
    }

    private var compounding: some View {
        let end = equity * pow(1 + annual / 100, years)
        return VStack(alignment: .leading, spacing: TarsTheme.Space.l) {
            slider("Starting amount", value: $equity, range: 1_000...250_000, step: 1_000,
                   display: equity.formatted(.currency(code: "USD").precision(.fractionLength(0))))
            slider("Annual return", value: $annual, range: -10...30, step: 0.5,
                   display: String(format: "%.1f%%", annual))
            slider("Years", value: $years, range: 1...40, step: 1,
                   display: String(format: "%.0f", years))
            answer("Ends at", end.formatted(.currency(code: "USD").precision(.fractionLength(0))),
                   tone: end >= equity ? TarsTheme.gain : TarsTheme.loss,
                   note: "Compounding is not a strategy — it is what a strategy is FOR. Small edges, repeated, without a blow-up.")
        }
    }

    // MARK: Parts

    private func slider(_ label: String, value: Binding<Double>,
                        range: ClosedRange<Double>, step: Double,
                        display: String) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            HStack {
                Text(label)
                    .font(TarsTheme.Text.caption)
                    .foregroundStyle(TarsTheme.inkSecondary)
                Spacer()
                Text(display)
                    .font(TarsTheme.Text.body.monospacedDigit().weight(.semibold))
                    .foregroundStyle(TarsTheme.inkPrimary)
                    .contentTransition(.numericText())
            }
            Slider(value: value, in: range, step: step)
                .tint(TarsTheme.accent)
        }
    }

    private func answer(_ label: String, _ value: String,
                        tone: Color = TarsTheme.accent, note: String) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            Divider().overlay(TarsTheme.hairline)
            TarsMicroLabel(label, tone: TarsTheme.inkQuaternary)
            Text(value)
                .font(TarsTheme.Text.title.monospacedDigit())
                .foregroundStyle(tone)
                .contentTransition(.numericText())
                .animation(.snappy, value: value)
            Text(note)
                .font(TarsTheme.Text.caption)
                .foregroundStyle(TarsTheme.inkSecondary)
                .fixedSize(horizontal: false, vertical: true)
        }
    }
}

// MARK: - Desk task: the link from learning to doing

/// 28 lessons end with "go do this on the desk". On the phone the desk is
/// two taps away, so the instruction becomes a door instead of a suggestion.
struct DeskTaskBlock: View {
    let instruction: String
    let symbol: String?
    var onOpen: (String) -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: TarsTheme.Space.m) {
            TarsMicroLabel("Now do it on the desk", tone: TarsTheme.accent)
            Text(instruction)
                .font(TarsTheme.Text.body)
                .foregroundStyle(TarsTheme.inkPrimary)
                .fixedSize(horizontal: false, vertical: true)
            if let s = symbol, !s.isEmpty {
                Button {
                    Haptics.tap()
                    onOpen(s)
                } label: {
                    HStack(spacing: TarsTheme.Space.s) {
                        Image(systemName: "chart.xyaxis.line")
                        Text("Open \(SymbolDisplay.pretty(s))")
                    }
                    .font(TarsTheme.Text.caption.weight(.semibold))
                    .foregroundStyle(TarsTheme.onFill)
                    .frame(maxWidth: .infinity, minHeight: 44)
                    .background(TarsTheme.accent)
                    .clipShape(RoundedRectangle(cornerRadius: TarsTheme.Radius.m, style: .continuous))
                }
                .buttonStyle(.plain)
            }
        }
        .padding(TarsTheme.Space.l)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(TarsTheme.accent.opacity(0.08))
        .clipShape(RoundedRectangle(cornerRadius: TarsTheme.Radius.m, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: TarsTheme.Radius.m, style: .continuous)
            .strokeBorder(TarsTheme.accent.opacity(0.26), lineWidth: 1))
    }
}
