import SwiftUI

/*
  A lesson, read natively.

  The server sends blocks; this renders the kinds a phone can carry —
  prose, key ideas, analogies, formulas, quizzes, desk tasks — and skips
  the rest with an honest note rather than failing the lesson because one
  interactive widget is newer than this build.

  The quiz is the point. Answers are checked by the SERVER against keys it
  never sent, so a wrong answer can't be talked past and a bare tap can't
  bank XP. You see right/wrong immediately, and the lesson only completes
  when every question is right.
*/
struct LessonReaderView: View {
    let lessonId: String
    var onComplete: () -> Void = {}

    @State private var model = LessonModel()
    @State private var picked: [Int: Int] = [:]     // quiz index → choice
    @State private var revealed: Set<Int> = []
    @Environment(\.dismiss) private var dismiss
    @State private var openSymbol: String?

    /// Quiz blocks in order, with their position among quizzes.
    private var quizzes: [(quizIndex: Int, block: APIBlock)] {
        var out: [(Int, APIBlock)] = []
        var q = 0
        for b in model.lesson?.sections ?? [] where b.kind == "quiz" {
            out.append((q, b)); q += 1
        }
        return out
    }

    private var allAnswered: Bool {
        !quizzes.isEmpty && quizzes.allSatisfy { picked[$0.quizIndex] != nil }
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: TarsTheme.Space.l) {
                if let l = model.lesson {
                    header(l)
                    let sections = l.sections
                    var quizSeen = 0
                    ForEach(Array(sections.enumerated()), id: \.offset) { _, block in
                        // Quizzes need their own index to track answers.
                        let qi = block.kind == "quiz" ? quizSeen : -1
                        blockView(block, quizIndex: qi)
                            .onAppear { }
                        let _ = { if block.kind == "quiz" { quizSeen += 1 } }()
                    }
                    footer(l)
                } else if model.failed {
                    Text("This lesson didn't load. Check your connection and try again.")
                        .font(TarsTheme.Text.body)
                        .foregroundStyle(TarsTheme.inkSecondary)
                } else {
                    ProgressView().tint(TarsTheme.inkTertiary)
                        .frame(maxWidth: .infinity, minHeight: 200)
                }
            }
            .padding(TarsTheme.Space.l)
            .padding(.bottom, 72)
        }
        .background(TarsTheme.bg0)
        .navigationTitle(model.lesson?.trackTitle ?? "Lesson")
        .navigationBarTitleDisplayMode(.inline)
        .toolbarBackground(TarsTheme.bg0, for: .navigationBar)
        .toolbarBackground(.visible, for: .navigationBar)
        .task { await model.load(lessonId) }
        // A lesson that says "go look at SPY" should be able to show you SPY.
        .navigationDestination(item: $openSymbol) { MarketSymbolView(symbol: $0) }
    }

    private func header(_ l: APILesson) -> some View {
        VStack(alignment: .leading, spacing: TarsTheme.Space.s) {
            Text(l.title)
                .font(TarsTheme.Text.title)
                .foregroundStyle(TarsTheme.inkPrimary)
                .fixedSize(horizontal: false, vertical: true)
            Text(l.hook)
                .font(TarsTheme.Text.body)
                .foregroundStyle(TarsTheme.inkSecondary)
                .fixedSize(horizontal: false, vertical: true)
            Text("\(l.minutes) min · \(l.xp) XP")
                .font(TarsTheme.Text.micro.monospacedDigit())
                .foregroundStyle(TarsTheme.inkQuaternary)
        }
    }

    @ViewBuilder
    private func blockView(_ b: APIBlock, quizIndex: Int) -> some View {
        switch b.kind {
        case "prose":
            Text(b.text ?? "")
                .font(TarsTheme.Text.reading)
                .foregroundStyle(TarsTheme.inkPrimary)
                .fixedSize(horizontal: false, vertical: true)

        case "keyIdea":
            DossierSection(title: b.title ?? "Key idea") {
                Text(b.text ?? "")
                    .font(TarsTheme.Text.body)
                    .foregroundStyle(TarsTheme.inkPrimary)
                    .fixedSize(horizontal: false, vertical: true)
            }

        case "analogy":
            DossierSection(title: b.title ?? "Think of it this way") {
                Text(b.text ?? "")
                    .font(TarsTheme.Text.body)
                    .foregroundStyle(TarsTheme.inkSecondary)
                    .fixedSize(horizontal: false, vertical: true)
            }

        case "formula":
            DossierSection(title: b.label ?? "Formula", note: b.legend) {
                Text(b.expression ?? "")
                    .font(TarsTheme.Text.mono)
                    .foregroundStyle(TarsTheme.accent)
                    .fixedSize(horizontal: false, vertical: true)
            }

        case "desk":
            DeskTaskBlock(instruction: b.instruction ?? "", symbol: b.symbol) { sym in
                openSymbol = sym
            }

        case "flashcards":
            FlashcardDeck(title: b.title, cards: b.cards ?? [])

        case "calc":
            LessonCalculator(tool: b.tool ?? "", title: b.title)

        case "quiz":
            quizView(b, index: quizIndex)

        default:
            // A block this build can't draw. Say so plainly instead of
            // rendering nothing and leaving a hole in the argument.
            DossierSection(title: b.kind == "game" ? "Drill" : b.kind == "chart" ? "Diagram" : "Interactive") {
                Text(b.caption ?? "This part of the lesson is interactive and lives on the web for now — open it at tarstrading.com to try it.")
                    .font(TarsTheme.Text.caption)
                    .foregroundStyle(TarsTheme.inkTertiary)
                    .fixedSize(horizontal: false, vertical: true)
            }
        }
    }

    private func quizView(_ b: APIBlock, index: Int) -> some View {
        VStack(alignment: .leading, spacing: TarsTheme.Space.m) {
            TarsMicroLabel("Check yourself")
            Text(b.question ?? "")
                .font(TarsTheme.Text.body.weight(.semibold))
                .foregroundStyle(TarsTheme.inkPrimary)
                .fixedSize(horizontal: false, vertical: true)
            ForEach(Array((b.choices ?? []).enumerated()), id: \.offset) { i, choice in
                let chosen = picked[index] == i
                Button {
                    Haptics.tick()
                    picked[index] = i
                    revealed.insert(index)
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
            if revealed.contains(index), let explain = b.explain {
                Text(explain)
                    .font(TarsTheme.Text.caption)
                    .foregroundStyle(TarsTheme.inkSecondary)
                    .fixedSize(horizontal: false, vertical: true)
            }
        }
        .padding(TarsTheme.Space.l)
        .frame(maxWidth: .infinity, alignment: .leading)
        .tarsPanel()
    }

    private func footer(_ l: APILesson) -> some View {
        VStack(spacing: TarsTheme.Space.m) {
            if let msg = model.result {
                Text(msg)
                    .font(TarsTheme.Text.caption)
                    .foregroundStyle(model.passed ? TarsTheme.gain : TarsTheme.loss)
                    .fixedSize(horizontal: false, vertical: true)
            }
            Button {
                Haptics.tap()
                Task {
                    await model.submit(lessonId: l.id, picks: picked, quizCount: quizzes.count)
                    if model.passed { onComplete(); Haptics.success() } else { Haptics.warning() }
                }
            } label: {
                Text(quizzes.isEmpty ? "Mark as read" : "Check my answers")
                    .font(TarsTheme.Text.heading)
                    .foregroundStyle(TarsTheme.onFill)
                    .frame(maxWidth: .infinity, minHeight: 50)
                    .background(canSubmit ? TarsTheme.accent : TarsTheme.bg3)
                    .clipShape(RoundedRectangle(cornerRadius: TarsTheme.Radius.m, style: .continuous))
            }
            .buttonStyle(.plain)
            .disabled(!canSubmit || model.submitting)

            Text("The server grades this — it holds the answer key, so a lesson is passed, never claimed.")
                .font(TarsTheme.Text.micro)
                .foregroundStyle(TarsTheme.inkQuaternary)
                .fixedSize(horizontal: false, vertical: true)
        }
        .padding(.top, TarsTheme.Space.m)
    }

    private var canSubmit: Bool { quizzes.isEmpty || allAnswered }
}

@Observable @MainActor
final class LessonModel {
    private(set) var lesson: APILesson?
    private(set) var failed = false
    private(set) var submitting = false
    private(set) var passed = false
    private(set) var result: String?
    private let api = TarsAPIClient.shared

    func load(_ id: String) async {
        guard lesson == nil else { return }
        if let res = try? await api.lesson(id: id) { lesson = res.lesson }
        else { failed = true }
    }

    func submit(lessonId: String, picks: [Int: Int], quizCount: Int) async {
        submitting = true
        defer { submitting = false }
        let answers = (0..<max(quizCount, 0)).map { ["choice": picks[$0] ?? -1, "tries": 1] }
        do {
            passed = try await api.completeLesson(id: lessonId, answers: answers)
            result = passed
                ? "Passed — XP banked."
                : "Not yet. Look again at the ones you're unsure of; the explanation is under each."
        } catch {
            passed = false
            result = error.localizedDescription
        }
    }
}
