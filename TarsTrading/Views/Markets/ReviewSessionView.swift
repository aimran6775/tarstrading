import SwiftUI

/*
  The review session — the habit the whole method depends on.

  This is deliberately NOT a quiz. You are shown the term, you try to
  recall the meaning in your head, and only then turn the card. Then you
  say honestly whether you had it. That self-report is what drives the
  Leitner schedule: "got it" widens the interval, "missed it" sends the
  card back to today.

  Self-grading looks like a loophole and isn't. Lying only costs you the
  thing you came for, and forcing a multiple-choice would test recognition
  where the whole point is RECALL — the harder operation, and the one that
  actually builds memory.
*/
struct ReviewSessionView: View {
    var onFinish: () -> Void = {}

    @State private var model = ReviewModel()
    @State private var flipped = false
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        VStack(spacing: 0) {
            if let card = model.current {
                progressBar
                Spacer(minLength: 0)
                cardFace(card)
                Spacer(minLength: 0)
                controls(card)
            } else if model.finished {
                summary
            } else {
                ProgressView().tint(TarsTheme.inkTertiary)
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
            }
        }
        .padding(TarsTheme.Space.l)
        .background(TarsTheme.bg0)
        .navigationTitle("Review")
        .navigationBarTitleDisplayMode(.inline)
        .toolbarBackground(TarsTheme.bg0, for: .navigationBar)
        .toolbarBackground(.visible, for: .navigationBar)
        .task { await model.load() }
    }

    private var progressBar: some View {
        VStack(alignment: .leading, spacing: 6) {
            GeometryReader { geo in
                ZStack(alignment: .leading) {
                    Capsule().fill(TarsTheme.bg3).frame(height: 4)
                    Capsule().fill(TarsTheme.gain)
                        .frame(width: geo.size.width * model.fraction, height: 4)
                        .animation(.snappy, value: model.fraction)
                }
                .frame(maxHeight: .infinity)
            }
            .frame(height: 6)
            Text("\(model.index + 1) of \(model.cards.count)")
                .font(TarsTheme.Text.micro.monospacedDigit())
                .foregroundStyle(TarsTheme.inkQuaternary)
        }
    }

    private func cardFace(_ card: APIReviewCard) -> some View {
        VStack(alignment: .leading, spacing: TarsTheme.Space.l) {
            TarsMicroLabel(flipped ? "The meaning" : "Do you remember this?",
                           tone: flipped ? TarsTheme.accent : TarsTheme.inkQuaternary)
            Text(flipped ? card.back : card.front)
                .font(flipped ? TarsTheme.Text.reading : TarsTheme.Text.hero)
                .foregroundStyle(TarsTheme.inkPrimary)
                .fixedSize(horizontal: false, vertical: true)
                .frame(maxWidth: .infinity, alignment: .leading)
            if flipped {
                Text("From \(card.lessonTitle)")
                    .font(TarsTheme.Text.micro)
                    .foregroundStyle(TarsTheme.inkTertiary)
            }
        }
        .padding(TarsTheme.Space.xl)
        .frame(maxWidth: .infinity, minHeight: 240, alignment: .topLeading)
        .background(TarsTheme.bg1)
        .clipShape(RoundedRectangle(cornerRadius: TarsTheme.Radius.l, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: TarsTheme.Radius.l, style: .continuous)
            .strokeBorder(TarsTheme.hairline, lineWidth: 1))
        .contentShape(Rectangle())
        .onTapGesture {
            guard !flipped else { return }
            Haptics.tick()
            withAnimation(.spring(duration: 0.4)) { flipped = true }
        }
    }

    @ViewBuilder
    private func controls(_ card: APIReviewCard) -> some View {
        if flipped {
            // Answer BEFORE grading yourself — recall first, verdict second.
            HStack(spacing: TarsTheme.Space.m) {
                gradeButton("Missed it", tone: TarsTheme.loss) {
                    await model.answer(card, got: false); flipped = false
                }
                gradeButton("Had it", tone: TarsTheme.gain) {
                    await model.answer(card, got: true); flipped = false
                }
            }
        } else {
            Button {
                Haptics.tick()
                withAnimation(.spring(duration: 0.4)) { flipped = true }
            } label: {
                Text("Show me")
                    .font(TarsTheme.Text.heading)
                    .foregroundStyle(TarsTheme.inkPrimary)
                    .frame(maxWidth: .infinity, minHeight: 52)
                    .background(TarsTheme.bg2)
                    .clipShape(RoundedRectangle(cornerRadius: TarsTheme.Radius.m, style: .continuous))
            }
            .buttonStyle(.plain)
        }
    }

    private func gradeButton(_ title: String, tone: Color,
                             action: @escaping () async -> Void) -> some View {
        Button {
            Haptics.tap()
            Task { await action() }
        } label: {
            Text(title)
                .font(TarsTheme.Text.heading)
                .foregroundStyle(TarsTheme.onFill)
                .frame(maxWidth: .infinity, minHeight: 52)
                .background(tone)
                .clipShape(RoundedRectangle(cornerRadius: TarsTheme.Radius.m, style: .continuous))
        }
        .buttonStyle(.plain)
    }

    private var summary: some View {
        VStack(spacing: TarsTheme.Space.l) {
            Spacer()
            Image(systemName: "checkmark.seal.fill")
                .font(.system(size: 44))
                .foregroundStyle(TarsTheme.gain)
            Text("Session done")
                .font(TarsTheme.Text.title)
                .foregroundStyle(TarsTheme.inkPrimary)
            Text("\(model.got) recalled · \(model.missed) sent back to today"
                 + (model.remaining > 0 ? " · \(model.remaining) still waiting" : ""))
                .font(TarsTheme.Text.caption)
                .foregroundStyle(TarsTheme.inkSecondary)
                .multilineTextAlignment(.center)
                .fixedSize(horizontal: false, vertical: true)
            Text(model.missed == 0
                 ? "Everything stuck. The ones you knew move further out — you'll see them again when they're closer to slipping."
                 : "The ones you missed come back today. That's the point: forgetting is where the learning happens.")
                .font(TarsTheme.Text.micro)
                .foregroundStyle(TarsTheme.inkTertiary)
                .multilineTextAlignment(.center)
                .fixedSize(horizontal: false, vertical: true)
            Button {
                Haptics.tap(); onFinish(); dismiss()
            } label: {
                Text("Done")
                    .font(TarsTheme.Text.heading)
                    .foregroundStyle(TarsTheme.onFill)
                    .frame(maxWidth: .infinity, minHeight: 50)
                    .background(TarsTheme.accent)
                    .clipShape(RoundedRectangle(cornerRadius: TarsTheme.Radius.m, style: .continuous))
            }
            .buttonStyle(.plain)
            Spacer()
        }
    }
}

@Observable @MainActor
final class ReviewModel {
    private(set) var cards: [APIReviewCard] = []
    private(set) var index = 0
    private(set) var got = 0
    private(set) var missed = 0
    private(set) var remaining = 0
    private(set) var finished = false
    private let api = TarsAPIClient.shared

    var current: APIReviewCard? { cards.indices.contains(index) ? cards[index] : nil }
    var fraction: Double {
        cards.isEmpty ? 0 : Double(index) / Double(cards.count)
    }

    func load() async {
        guard cards.isEmpty else { return }
        if let res = try? await api.reviewSession() {
            cards = res.cards
            remaining = res.remaining
        }
        finished = cards.isEmpty
    }

    /// The verdict goes to the server, which owns the Leitner arithmetic —
    /// the phone never decides when a card is due again.
    func answer(_ card: APIReviewCard, got hadIt: Bool) async {
        if hadIt { got += 1; Haptics.success() } else { missed += 1; Haptics.warning() }
        try? await api.gradeReview(cardKey: card.cardKey, got: hadIt)
        if index + 1 < cards.count { index += 1 } else { finished = true }
    }
}
