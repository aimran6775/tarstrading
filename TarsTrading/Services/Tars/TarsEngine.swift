import Foundation

/// The mentor's brain, behind a protocol so the model can be swapped
/// (demo rules → cloud open-weight → on-device MLX) without touching UI.
protocol TarsEngine: Sendable {
    /// Streams the reply token-by-token for the typing feel.
    func reply(to message: String, context: TarsContext) -> AsyncStream<String>
}

/// What Tars can see when answering: assembled fresh per message.
struct TarsContext {
    var mode: TradingMode = .demo
    var equity: Double = 0
    var dayPnL: Double = 0
    var positions: [Position] = []
    var watchlist: [String] = []
    var visibleSymbol: String?
    var recentJournal: [JournalEntry] = []
    // Academy awareness — nil/zero when the caller has no curriculum store.
    var academyRank: String?
    var academyXP: Int = 0
    var academyStreakDays: Int = 0
    var currentLessonTitle: String?
    var weakestQuizArea: String?

    var summaryPrompt: String {
        var lines: [String] = []
        lines.append("Mode: \(mode.badgeText) (simulated money).")
        lines.append("Equity $\(Int(equity)), day P&L $\(Int(dayPnL)).")
        if let visibleSymbol { lines.append("User is looking at \(visibleSymbol).") }
        if !positions.isEmpty {
            lines.append("Positions: " + positions.map {
                "\($0.symbol) \($0.qty.formatted()) @ \($0.avgEntryPrice.formatted(.number.precision(.fractionLength(2)))) (\($0.unrealizedPnL >= 0 ? "+" : "")\(Int($0.unrealizedPnL)))"
            }.joined(separator: "; "))
        }
        if !recentJournal.isEmpty {
            let thesisless = recentJournal.prefix(10).filter { $0.thesis.isEmpty }.count
            if thesisless > 2 { lines.append("Note: \(thesisless) recent trades have no journaled thesis.") }
        }
        if let academyRank {
            lines.append("Academy: \(academyRank) rank, \(academyXP) XP, \(academyStreakDays)-day study streak.")
        }
        if let currentLessonTitle { lines.append("User is currently in the lesson: \(currentLessonTitle).") }
        if let weakestQuizArea { lines.append("Weakest curriculum area (started, least finished): \(weakestQuizArea).") }
        return lines.joined(separator: "\n")
    }
}

/// Hard rule enforced at the OUTPUT boundary, regardless of engine: Tars
/// teaches and critiques but never gives directive advice or makes
/// performance promises. Belt-and-suspenders on top of the system prompt.
enum TarsGuardrail {
    private static let directivePatterns: [String] = [
        "you should buy", "you should sell", "i recommend buying", "i recommend selling",
        "definitely buy", "definitely sell", "buy it now", "sell it now",
        "guaranteed to", "can't lose", "will go up", "will go down",
        "sure thing", "easy money", "beat the market",
    ]

    static func violates(_ text: String) -> Bool {
        let lower = text.lowercased()
        return directivePatterns.contains { lower.contains($0) }
    }

    /// The mentor's stance, injected into every engine.
    static let systemPrompt = """
    You are Tars, the AI trading mentor inside Tars Trading, an educational \
    paper-trading app. Personality: dry wit, radically honest, warm underneath. \
    You EXPLAIN, TEACH, and CRITIQUE reasoning — you NEVER give directive advice \
    (no "buy X", "sell Y", no price predictions, no guarantees). If asked what to \
    buy, redirect to process: thesis, risk, position sizing. Everything here is \
    simulated money; remind users of that when stakes-talk comes up. Keep answers \
    tight (2-6 sentences unless teaching a concept step by step). Socratic when \
    critiquing: end with one sharp question.
    """

    static let refusal = "That crosses into telling you what to trade, which I don't do — not because I'm coy, but because outsourcing conviction is how accounts die. Let's build your thesis instead: what do you think happens, and what would prove you wrong?"
}
