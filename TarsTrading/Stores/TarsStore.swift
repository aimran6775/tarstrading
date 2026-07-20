import SwiftUI

/// Tars conversation state: history, streaming, engine selection.
@Observable
final class TarsStore {
    struct Message: Identifiable, Codable, Equatable {
        var id = UUID()
        var role: Role
        var text: String
        var at: Date = .now
        enum Role: String, Codable { case user, tars }
    }

    var messages: [Message] = []
    var isStreaming = false
    var isPanelOpen = false
    /// Set by whatever screen is frontmost so Tars knows what's on screen.
    var visibleSymbol: String?
    /// Set by lesson screens while a lesson is frontmost so Tars can coach in
    /// context; left nil everywhere else.
    var currentLessonTitle: String?

    @ObservationIgnored private let persistence = Persistence()
    @ObservationIgnored private var engine: TarsEngine =
        CloudTarsEngine.isConfigured ? CloudTarsEngine() : DemoTarsEngine()

    init() {
        messages = persistence.load([Message].self, "tarsMessages") ?? []
    }

    static let openers = [
        "How am I doing?",
        "What should I learn next?",
        "What's a limit order?",
        "Explain the Greeks",
        "Critique my last trade",
    ]

    @MainActor
    func send(_ text: String, trading: TradingStore, academy: AcademyProgress?) async {
        let trimmed = text.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty, !isStreaming else { return }
        messages.append(Message(role: .user, text: trimmed))
        var reply = Message(role: .tars, text: "")
        messages.append(reply)
        isStreaming = true
        defer {
            isStreaming = false
            persistence.save(messages.suffix(200), "tarsMessages")
        }

        let context = TarsContext(
            mode: trading.mode,
            equity: trading.account.equity,
            dayPnL: trading.account.dayPnL,
            positions: trading.positions,
            watchlist: trading.watchlist,
            visibleSymbol: visibleSymbol,
            recentJournal: Array(trading.journal.prefix(10)),
            academyRank: academy?.rank,
            academyXP: academy?.state.xp ?? 0,
            academyStreakDays: academy?.state.streakDays ?? 0,
            currentLessonTitle: currentLessonTitle,
            weakestQuizArea: academy.flatMap(Self.weakestArea))

        for await chunk in engine.reply(to: trimmed, context: context) {
            reply.text += chunk
            if let i = messages.lastIndex(where: { $0.id == reply.id }) {
                messages[i] = reply
            }
        }
        // Final guardrail sweep on the assembled message.
        if TarsGuardrail.violates(reply.text) {
            if let i = messages.lastIndex(where: { $0.id == reply.id }) {
                messages[i].text = TarsGuardrail.refusal
            }
        }
    }

    /// Legacy entry point — kept so callers without an Academy store compile;
    /// Tars just answers without curriculum awareness.
    @available(*, deprecated, message: "Pass the AcademyProgress store so Tars can see the curriculum.")
    @MainActor
    func send(_ text: String, trading: TradingStore) async {
        await send(text, trading: trading, academy: nil)
    }

    /// The least-finished *started* track — the honest "needs work" pointer.
    /// Nil until at least one track is underway; ties broken alphabetically
    /// so the answer is deterministic.
    private static func weakestArea(_ academy: AcademyProgress) -> String? {
        Curriculum.tracks
            .map { (title: $0.title, done: academy.progress(in: $0)) }
            .filter { $0.done > 0 && $0.done < 1 }
            .min { ($0.done, $0.title) < ($1.done, $1.title) }?
            .title
    }

    func clearHistory() {
        messages.removeAll()
        persistence.save(messages, "tarsMessages")
    }
}
