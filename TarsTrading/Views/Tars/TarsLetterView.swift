import SwiftUI

/// Tars's Sunday letter: a weekly debrief in the mentor's dry-honest voice —
/// trades, thesis discipline, agents, and one thing to practice. Composed
/// deterministically from store state by a pure function; no model calls, so
/// it can never invent a week that didn't happen.
public struct TarsLetterView: View {
    @Environment(TradingStore.self) private var trading
    @Environment(AcademyProgress.self) private var academy
    @Environment(AgentLab.self) private var agentLab
    @Environment(\.dismiss) private var dismiss

    /// Frozen at presentation so the letter doesn't re-compose mid-read.
    @State private var openedAt = Date.now

    public init() {}

    public var body: some View {
        let letter = LetterComposer.compose(
            journal: trading.journal,
            equityHistory: trading.equityHistory,
            positions: trading.positions,
            academy: academy.state,
            rank: academy.rank,
            agentActivity: agentLab.activity,
            now: openedAt)

        VStack(spacing: 0) {
            chrome(sharing: letter.plainText)
            Divider().overlay(TarsTheme.hairline)
            ScrollView {
                letterBody(letter)
                    .frame(maxWidth: 620, alignment: .leading)
                    .frame(maxWidth: .infinity)
                    .padding(.horizontal, TarsTheme.Space.xl)
                    .padding(.vertical, TarsTheme.Space.xxl)
            }
        }
        .background(
            ZStack {
                TarsTheme.bg1
                TarsTheme.tarsAurora.opacity(0.35)
            }
            .ignoresSafeArea()
        )
    }

    // MARK: Chrome

    private func chrome(sharing plainText: String) -> some View {
        HStack(spacing: TarsTheme.Space.m) {
            Button { dismiss() } label: {
                Image(systemName: "xmark.circle.fill")
                    .font(.system(size: 24))
                    .foregroundStyle(TarsTheme.inkTertiary)
            }
            .buttonStyle(PressableStyle())
            .accessibilityLabel("Close letter")

            Spacer()

            ShareLink(item: plainText,
                      subject: Text("The Sunday Letter — Tars"),
                      preview: SharePreview("The Sunday Letter")) {
                Image(systemName: "square.and.arrow.up")
                    .font(.system(size: 18, weight: .medium))
                    .foregroundStyle(TarsTheme.inkSecondary)
            }
            .accessibilityLabel("Share letter as text")
        }
        .padding(TarsTheme.Space.l)
    }

    // MARK: Letter

    private func letterBody(_ letter: LetterComposer.Letter) -> some View {
        VStack(alignment: .leading, spacing: TarsTheme.Space.xl) {
            masthead(letter)
            Divider().overlay(TarsTheme.hairline)
            ForEach(letter.sections) { section in
                VStack(alignment: .leading, spacing: TarsTheme.Space.m) {
                    Text(section.title)
                        .font(LetterType.section)
                        .foregroundStyle(TarsTheme.inkPrimary)
                    ForEach(Array(section.paragraphs.enumerated()), id: \.offset) { _, paragraph in
                        Text(paragraph)
                            .font(TarsTheme.Text.body)
                            .monospacedDigit()
                            .foregroundStyle(TarsTheme.inkSecondary)
                            .lineSpacing(5)
                            .fixedSize(horizontal: false, vertical: true)
                    }
                }
            }
            Divider().overlay(TarsTheme.hairline)
            signoff(letter)
        }
    }

    private func masthead(_ letter: LetterComposer.Letter) -> some View {
        HStack(alignment: .top, spacing: TarsTheme.Space.l) {
            VStack(alignment: .leading, spacing: TarsTheme.Space.xs) {
                Text("The Sunday Letter")
                    .font(LetterType.masthead)
                    .foregroundStyle(TarsTheme.inkPrimary)
                Text(letter.dateline.uppercased())
                    .font(TarsTheme.Text.micro)
                    .tracking(2)
                    .monospacedDigit()
                    .foregroundStyle(TarsTheme.inkTertiary)
            }
            Spacer()
            paperStamp
        }
    }

    /// The rubber stamp: a standing reminder that every number in this letter
    /// is simulated money.
    private var paperStamp: some View {
        Text("PAPER")
            .font(TarsTheme.Text.micro)
            .tracking(3)
            .foregroundStyle(TarsTheme.paperBadge)
            .padding(.horizontal, TarsTheme.Space.m)
            .padding(.vertical, TarsTheme.Space.s)
            .overlay(
                RoundedRectangle(cornerRadius: TarsTheme.Radius.s, style: .continuous)
                    .strokeBorder(TarsTheme.paperBadge.opacity(0.7), lineWidth: 1.5))
            .rotationEffect(.degrees(-7))
            .opacity(0.9)
            .accessibilityLabel("Paper trading — simulated money")
    }

    private func signoff(_ letter: LetterComposer.Letter) -> some View {
        VStack(alignment: .leading, spacing: TarsTheme.Space.s) {
            Text("— Tars")
                .font(LetterType.section)
                .foregroundStyle(TarsTheme.inkPrimary)
            Text(letter.standing)
                .font(TarsTheme.Text.caption)
                .monospacedDigit()
                .foregroundStyle(TarsTheme.inkTertiary)
            Text("Simulated money, real habits. Same time next Sunday.")
                .font(TarsTheme.Text.caption)
                .foregroundStyle(TarsTheme.inkTertiary)
        }
    }
}

// MARK: - Letter typography

/// The ONE sanctioned deviation from TarsTheme type: the letter speaks in
/// serif so it reads as correspondence, not another dashboard.
fileprivate enum LetterType {
    static let masthead = Font.system(size: 30, weight: .bold, design: .serif)
    static let section = Font.system(size: 19, weight: .semibold, design: .serif)
}

// MARK: - Composition

/// Pure, deterministic letter assembly — same inputs, same letter. Lives
/// outside the view so it never touches live stores and stays testable.
fileprivate enum LetterComposer {
    struct Section: Identifiable {
        var id: String { title }
        let title: String
        let paragraphs: [String]
    }

    struct Letter {
        let dateline: String
        let sections: [Section]
        let standing: String
        let plainText: String
    }

    static func compose(journal: [JournalEntry],
                        equityHistory: [TradingStore.EquityPoint],
                        positions: [Position],
                        academy: AcademyProgress.State,
                        rank: String,
                        agentActivity: [AgentLab.AgentActivity],
                        now: Date) -> Letter {
        let weekAgo = now.addingTimeInterval(-7 * 86_400)
        let week = journal.filter { ($0.closedAt ?? $0.openedAt) >= weekAgo }
        let closed = week.filter { $0.closedAt != nil && $0.realizedPnL != nil }
        let wins = closed.filter { ($0.realizedPnL ?? 0) > 0 }.count
        let journaled = week.filter { !$0.thesis.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty }
        let weekPoints = equityHistory.filter { $0.time >= weekAgo }
        let weekChange: Double? = {
            guard weekPoints.count >= 2,
                  let first = weekPoints.first, let last = weekPoints.last else { return nil }
            return last.equity - first.equity
        }()
        let weekAgents = agentActivity.filter { $0.at >= weekAgo }

        var sections: [Section] = [
            Section(title: "The week in one line",
                    paragraphs: [oneLine(trades: week.count, closed: closed.count, weekChange: weekChange)]),
            Section(title: "What you traded",
                    paragraphs: traded(week: week, closed: closed, wins: wins, positions: positions)),
            Section(title: "The thesis discipline report",
                    paragraphs: thesisReport(week: week, journaled: journaled)),
        ]
        if !agentActivity.isEmpty {
            sections.append(Section(title: "Your agents", paragraphs: agents(weekAgents)))
        }
        sections.append(Section(title: "One thing to practice next week",
                                paragraphs: [practice(week: week, journaled: journaled,
                                                      closed: closed, academy: academy)]))

        let dateline = now.formatted(date: .complete, time: .omitted)
        let standing = "Standing: \(rank) · \(academy.xp) XP · "
            + "\(academy.completedLessonIDs.count) lesson\(academy.completedLessonIDs.count == 1 ? "" : "s") done · "
            + "study streak \(academy.streakDays) day\(academy.streakDays == 1 ? "" : "s")"

        let body = sections
            .map { "\($0.title.uppercased())\n\($0.paragraphs.joined(separator: "\n"))" }
            .joined(separator: "\n\n")
        let plainText = """
        THE SUNDAY LETTER — TARS
        \(dateline) · PAPER (simulated money)

        \(body)

        — Tars
        \(standing)
        Educational reflection, not investment advice.
        """

        return Letter(dateline: dateline, sections: sections, standing: standing, plainText: plainText)
    }

    // MARK: Sections

    private static func oneLine(trades: Int, closed: Int, weekChange: Double?) -> String {
        let money = weekChange.map { change -> String in
            let amount = abs(change).formatted(.currency(code: "USD").precision(.fractionLength(0)))
            return change >= 0 ? "the account added \(amount)" : "the account gave back \(amount)"
        }
        switch (trades, money) {
        case (0, nil):
            return "No trades this week. Sometimes that's discipline, sometimes it's avoidance — only you know which."
        case (0, let money?):
            return "No trades, yet \(money) — that's your existing positions doing the talking, not you."
        case (let n, nil):
            return "\(n) trade\(n == 1 ? "" : "s") this week, \(closed) closed. The tape will judge eventually; the journal judges now."
        case (let n, let money?):
            return "\(n) trade\(n == 1 ? "" : "s"), \(closed) closed, and \(money) on the week. That's weather — the theses below are the climate."
        }
    }

    private static func traded(week: [JournalEntry], closed: [JournalEntry],
                               wins: Int, positions: [Position]) -> [String] {
        guard !week.isEmpty else {
            return ["An empty blotter. Nothing to critique, which is either restraint or absence — next week, give me material."]
        }
        var lines: [String] = week.prefix(8).map { entry in
            let qty = entry.qty.formatted()
            if let pnl = entry.realizedPnL {
                let amount = abs(pnl).formatted(.currency(code: "USD").precision(.fractionLength(0)))
                return "\(entry.symbol) — \(entry.side.label.lowercased()) \(qty), closed \(pnl >= 0 ? "up" : "down") \(amount)."
            }
            return "\(entry.symbol) — \(entry.side.label.lowercased()) \(qty), still open."
        }
        if week.count > 8 {
            lines.append("…and \(week.count - 8) more. A busy week is not automatically a productive one.")
        }
        if !closed.isEmpty {
            let rate = Int((Double(wins) / Double(closed.count) * 100).rounded())
            lines.append("Closed win rate: \(rate)%. Interesting number, wrong scoreboard — the one that matters is below.")
        }
        if !positions.isEmpty {
            lines.append("You carry \(positions.count) position\(positions.count == 1 ? "" : "s") into next week.")
        }
        return lines
    }

    private static func thesisReport(week: [JournalEntry], journaled: [JournalEntry]) -> [String] {
        guard !week.isEmpty else {
            return ["Nothing to audit — the journal survives another week untested."]
        }
        let rate = Int((Double(journaled.count) / Double(week.count) * 100).rounded())
        var out = ["\(journaled.count) of \(week.count) trade\(week.count == 1 ? "" : "s") had a written thesis — \(rate)%."]
        let bare = week.filter { $0.thesis.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty }
        if bare.isEmpty {
            out.append("Every trade journaled. That's the discipline a win rate can't fake — keep it boring, keep it total.")
        } else {
            let symbols = bare.prefix(5).map(\.symbol).joined(separator: ", ")
            let extra = bare.count > 5 ? " and \(bare.count - 5) more" : ""
            out.append("Unjournaled: \(symbols)\(extra). A trade without a thesis is a decision you've pre-forgiven yourself for. I don't, and next-Sunday-you won't either.")
        }
        return out
    }

    private static func agents(_ weekAgents: [AgentLab.AgentActivity]) -> [String] {
        guard !weekAgents.isEmpty else {
            return ["Your agents sat on their hands this week. For rule-followers, doing nothing is often the rules working."]
        }
        // Deterministic order: busiest first, name breaks ties.
        let counts = Dictionary(grouping: weekAgents, by: \.agentName)
            .map { (name: $0.key, count: $0.value.count) }
            .sorted { ($1.count, $0.name) < ($0.count, $1.name) }
        var lines = counts.prefix(3).map { "\($0.name): \($0.count) event\($0.count == 1 ? "" : "s") this week." }
        if let latest = weekAgents.first {
            lines.append("Most recent: \(latest.agentName) — \"\(latest.text)\" Read your agents' reasoning the way you'd want yours read: skeptically.")
        }
        return lines
    }

    /// One process assignment, chosen by deterministic priority: thesis gaps
    /// first, honest tagging second, the study habit third, exit criteria last.
    private static func practice(week: [JournalEntry], journaled: [JournalEntry],
                                 closed: [JournalEntry], academy: AcademyProgress.State) -> String {
        if week.isEmpty {
            return "One complete trade cycle: thesis written before entry, exit criteria named, outcome tagged honestly. Small size — the point is the paperwork, not the P&L."
        }
        if journaled.count < week.count {
            return "Write the thesis before the entry, not after the fill. Next week I want the unjournaled count at zero — not because I'm counting, but because you should be."
        }
        if closed.contains(where: { $0.outcomeTag == nil }) {
            return "Tag your closed trades honestly. 'Right for wrong reasons' is the tag that teaches the most and gets used the least."
        }
        if academy.streakDays == 0 {
            return "The blotter is disciplined; the studying lapsed. One Academy lesson, any track — the streak counter is a blunt instrument, but it works on humans."
        }
        return "Pick your biggest position and write down what would make you exit it — before the market asks. If you can't name where the thesis is dead, that's the homework."
    }
}
