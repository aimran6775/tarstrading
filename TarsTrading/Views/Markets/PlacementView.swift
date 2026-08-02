import SwiftUI

/*
  Placement — the escape hatch for people who already know this.

  Six questions, one per foundational track. You are placed at the FIRST
  one you miss, and everything before it is marked "tested out": unlocked,
  but banked at zero XP, because you did not earn it — you demonstrated
  you did not need it. That distinction matters. A product that hands out
  XP for skipping work teaches the wrong lesson on the first screen.

  The server grades it. It holds the keys, so placement cannot be forged,
  and it writes the completions itself.
*/
struct PlacementView: View {
    var onPlaced: () -> Void = {}

    @State private var model = PlacementModel()
    @State private var index = 0
    @State private var picked: [Int: Int] = [:]
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: TarsTheme.Space.l) {
                if let result = model.result {
                    resultView(result)
                } else if model.questions.isEmpty {
                    ProgressView().tint(TarsTheme.inkTertiary)
                        .frame(maxWidth: .infinity, minHeight: 200)
                } else {
                    intro
                    ForEach(Array(model.questions.enumerated()), id: \.offset) { i, q in
                        questionCard(q, index: i)
                    }
                    submitButton
                }
            }
            .padding(TarsTheme.Space.l)
            .padding(.bottom, 72)
        }
        .background(TarsTheme.bg0)
        .navigationTitle("Placement")
        .navigationBarTitleDisplayMode(.inline)
        .toolbarBackground(TarsTheme.bg0, for: .navigationBar)
        .toolbarBackground(.visible, for: .navigationBar)
        .task { await model.load() }
    }

    private var intro: some View {
        VStack(alignment: .leading, spacing: TarsTheme.Space.s) {
            Text("Already know some of this?")
                .font(TarsTheme.Text.title)
                .foregroundStyle(TarsTheme.inkPrimary)
            Text("Six questions, one per foundational track. You'll be placed at the first one you miss — everything before it unlocks as \"tested out\", at zero XP. You didn't earn it; you showed you didn't need it.")
                .font(TarsTheme.Text.body)
                .foregroundStyle(TarsTheme.inkSecondary)
                .fixedSize(horizontal: false, vertical: true)
        }
    }

    private func questionCard(_ q: APIPlacementQuestion, index i: Int) -> some View {
        VStack(alignment: .leading, spacing: TarsTheme.Space.m) {
            TarsMicroLabel(q.stage)
            Text(q.prompt)
                .font(TarsTheme.Text.body.weight(.semibold))
                .foregroundStyle(TarsTheme.inkPrimary)
                .fixedSize(horizontal: false, vertical: true)
            ForEach(Array(q.choices.enumerated()), id: \.offset) { j, choice in
                let chosen = picked[i] == j
                Button {
                    Haptics.tick(); picked[i] = j
                } label: {
                    HStack(spacing: TarsTheme.Space.m) {
                        Image(systemName: chosen ? "largecircle.fill.circle" : "circle")
                            .foregroundStyle(chosen ? TarsTheme.accent : TarsTheme.inkQuaternary)
                        Text(choice)
                            .font(TarsTheme.Text.body)
                            .foregroundStyle(TarsTheme.inkPrimary)
                            .fixedSize(horizontal: false, vertical: true)
                        Spacer(minLength: 0)
                    }
                    .padding(TarsTheme.Space.m)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .background(chosen ? TarsTheme.accent.opacity(0.10) : TarsTheme.bg2)
                    .clipShape(RoundedRectangle(cornerRadius: TarsTheme.Radius.m, style: .continuous))
                    .overlay(RoundedRectangle(cornerRadius: TarsTheme.Radius.m, style: .continuous)
                        .strokeBorder(chosen ? TarsTheme.accent.opacity(0.35) : TarsTheme.hairline,
                                      lineWidth: 1))
                }
                .buttonStyle(.plain)
            }
        }
        .padding(TarsTheme.Space.l)
        .frame(maxWidth: .infinity, alignment: .leading)
        .tarsPanel()
    }

    private var submitButton: some View {
        VStack(spacing: TarsTheme.Space.s) {
            Button {
                Haptics.tap()
                Task {
                    await model.submit(answers: (0..<model.questions.count).map { picked[$0] ?? -1 })
                    if model.result != nil { Haptics.success(); onPlaced() }
                }
            } label: {
                Text(model.submitting ? "Placing you…" : "Place me")
                    .font(TarsTheme.Text.heading)
                    .foregroundStyle(TarsTheme.onFill)
                    .frame(maxWidth: .infinity, minHeight: 50)
                    .background(allAnswered ? TarsTheme.accent : TarsTheme.bg3)
                    .clipShape(RoundedRectangle(cornerRadius: TarsTheme.Radius.m, style: .continuous))
            }
            .buttonStyle(.plain)
            .disabled(!allAnswered || model.submitting)

            Text("Answer all six. A wrong answer isn't a penalty — it's where your course starts.")
                .font(TarsTheme.Text.micro)
                .foregroundStyle(TarsTheme.inkQuaternary)
                .fixedSize(horizontal: false, vertical: true)
        }
    }

    private var allAnswered: Bool {
        !model.questions.isEmpty && picked.count == model.questions.count
    }

    private func resultView(_ r: APIPlacementResult) -> some View {
        VStack(alignment: .leading, spacing: TarsTheme.Space.l) {
            Image(systemName: "flag.checkered")
                .font(.system(size: 36))
                .foregroundStyle(TarsTheme.accent)
            Text(r.skipped > 0 ? "You start at \(r.startStageTitle)" : "You start at the beginning")
                .font(TarsTheme.Text.title)
                .foregroundStyle(TarsTheme.inkPrimary)
                .fixedSize(horizontal: false, vertical: true)
            Text(r.skipped > 0
                 ? "\(r.skipped) lesson\(r.skipped == 1 ? "" : "s") marked as tested out — unlocked, at zero XP, because you showed you already had them. Everything from here you earn."
                 : "Nothing skipped, and that's the right answer for most people. The fundamentals are where the money is protected.")
                .font(TarsTheme.Text.body)
                .foregroundStyle(TarsTheme.inkSecondary)
                .fixedSize(horizontal: false, vertical: true)
            Button {
                Haptics.tap(); dismiss()
            } label: {
                Text("Start the course")
                    .font(TarsTheme.Text.heading)
                    .foregroundStyle(TarsTheme.onFill)
                    .frame(maxWidth: .infinity, minHeight: 50)
                    .background(TarsTheme.accent)
                    .clipShape(RoundedRectangle(cornerRadius: TarsTheme.Radius.m, style: .continuous))
            }
            .buttonStyle(.plain)
        }
        .padding(.top, TarsTheme.Space.xl)
    }
}

@Observable @MainActor
final class PlacementModel {
    private(set) var questions: [APIPlacementQuestion] = []
    private(set) var result: APIPlacementResult?
    private(set) var submitting = false
    private let api = TarsAPIClient.shared

    func load() async {
        guard questions.isEmpty else { return }
        questions = (try? await api.placementQuestions()) ?? []
    }

    func submit(answers: [Int]) async {
        submitting = true
        defer { submitting = false }
        result = try? await api.submitPlacement(answers: answers)
    }
}
