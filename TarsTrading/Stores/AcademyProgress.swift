import SwiftUI

/// Progression: lesson completion, XP, streaks, quiz stats, mission
/// verification against real (paper) account activity.
@Observable
final class AcademyProgress {
    struct State: Codable {
        var completedLessonIDs: Set<String> = []
        var completedMissionIDs: Set<String> = []
        var xp: Int = 0
        var lastStudyDay: Date?
        var streakDays: Int = 0
        var quizRight: Int = 0
        var quizWrong: Int = 0
        var chosenAudience: String?
    }

    var state = State()
    @ObservationIgnored private let persistence = Persistence()

    init() {
        state = persistence.load(State.self, "academy") ?? State()
    }

    private func save() { persistence.save(state, "academy") }

    // MARK: Progress

    func isCompleted(_ lesson: Lesson) -> Bool { state.completedLessonIDs.contains(lesson.id) }

    func complete(_ lesson: Lesson) {
        guard !isCompleted(lesson) else { return }
        state.completedLessonIDs.insert(lesson.id)
        state.xp += lesson.xp
        touchStreak()
        Haptics.success()
        save()
    }

    func recordQuiz(correct: Bool) {
        if correct { state.quizRight += 1 } else { state.quizWrong += 1 }
        save()
    }

    func progress(in track: Track) -> Double {
        guard !track.lessons.isEmpty else { return 0 }
        let done = track.lessons.filter { state.completedLessonIDs.contains($0.id) }.count
        return Double(done) / Double(track.lessons.count)
    }

    var totalProgress: Double {
        let all = Curriculum.tracks.flatMap(\.lessons)
        guard !all.isEmpty else { return 0 }
        return Double(all.filter { state.completedLessonIDs.contains($0.id) }.count) / Double(all.count)
    }

    private func touchStreak() {
        let cal = Calendar.current
        if let last = state.lastStudyDay {
            if cal.isDateInToday(last) { return }
            state.streakDays = cal.isDateInYesterday(last) ? state.streakDays + 1 : 1
        } else {
            state.streakDays = 1
        }
        state.lastStudyDay = .now
    }

    // MARK: Missions

    func isMissionDone(_ mission: Mission) -> Bool { state.completedMissionIDs.contains(mission.id) }

    /// Checks a mission against live account state; marks + rewards if passed.
    @discardableResult
    func verify(_ mission: Mission, trading: TradingStore, tars: TarsStore) -> Bool {
        guard !isMissionDone(mission) else { return true }
        let passed: Bool
        switch mission.verify {
        case .placeOrder(let type):
            passed = trading.orderHistory.contains {
                $0.status == .filled && (type == nil || $0.type == type)
            }
        case .journalThesis:
            passed = trading.journal.contains { $0.closedAt != nil && !$0.thesis.isEmpty }
        case .addWatchlist(let count):
            passed = trading.watchlist.count >= count
        case .holdPositions(let count):
            passed = trading.positions.count >= count
        case .useBracket:
            passed = trading.orderHistory.contains { $0.bracket != nil }
                  || trading.openOrders.contains { $0.bracket != nil }
        case .askTars:
            passed = tars.messages.contains { $0.role == .user }
        }
        if passed {
            state.completedMissionIDs.insert(mission.id)
            state.xp += 100
            Haptics.success()
            save()
        }
        return passed
    }

    // MARK: Rank (tasteful, not casino)

    var rank: String {
        switch state.xp {
        case ..<300: "Observer"
        case ..<1000: "Apprentice"
        case ..<2500: "Practitioner"
        case ..<5000: "Strategist"
        default: "Allocator"
        }
    }
}
