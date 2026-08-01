import SwiftUI

/*
  Missions — where the Academy meets your actual book.

  Every other assessment in the product reads your ANSWERS. This one reads
  your POSITIONS. A mission isn't finished when you pass a quiz; it's
  finished when the account shows the process the lessons teach: a position
  sized from a stop, risk capped, heat controlled.

  The grader checks BEHAVIOUR, never outcome. A trade that loses money can
  pass; a trade that made money by risking a quarter of the account fails.
  That distinction is the entire argument of the curriculum, so the screen
  says it out loud rather than leaving it implied.
*/
struct MissionsView: View {
    @State private var model = MissionsModel()
    @State private var openLesson: String?

    var body: some View {
        ScrollView {
            LazyVStack(alignment: .leading, spacing: TarsTheme.Space.l) {
                intro
                ForEach(model.missions) { m in missionCard(m) }
                if model.missions.isEmpty && model.loaded {
                    Text("Missions didn't load. Pull to try again.")
                        .font(TarsTheme.Text.caption)
                        .foregroundStyle(TarsTheme.inkTertiary)
                }
            }
            .padding(TarsTheme.Space.l)
            .padding(.bottom, 72)
        }
        .background(TarsTheme.bg0)
        .navigationTitle("Missions")
        .navigationBarTitleDisplayMode(.inline)
        .refreshable { await model.load() }
        .task { if model.missions.isEmpty { await model.load() } }
        .navigationDestination(item: $openLesson) { id in
            LessonReaderView(lessonId: id)
        }
    }

    private var intro: some View {
        VStack(alignment: .leading, spacing: TarsTheme.Space.s) {
            Text("Proved on your own book")
                .font(TarsTheme.Text.title)
                .foregroundStyle(TarsTheme.inkPrimary)
            Text("These aren't quizzes. The desk reads your real positions and stop orders and checks the PROCESS — sized from a stop, risk capped. A losing trade can pass. A lucky one that risked a quarter of the account cannot.")
                .font(TarsTheme.Text.body)
                .foregroundStyle(TarsTheme.inkSecondary)
                .fixedSize(horizontal: false, vertical: true)
        }
    }

    private func missionCard(_ m: APIMission) -> some View {
        VStack(alignment: .leading, spacing: TarsTheme.Space.m) {
            HStack(alignment: .top) {
                VStack(alignment: .leading, spacing: 3) {
                    Text(m.title)
                        .font(TarsTheme.Text.heading)
                        .foregroundStyle(TarsTheme.inkPrimary)
                        .fixedSize(horizontal: false, vertical: true)
                    Text("\(m.xp) XP")
                        .font(TarsTheme.Text.micro.monospacedDigit())
                        .foregroundStyle(TarsTheme.inkQuaternary)
                }
                Spacer(minLength: TarsTheme.Space.s)
                if m.complete {
                    Label("Banked", systemImage: "checkmark.seal.fill")
                        .font(.system(size: 10, weight: .bold, design: .monospaced))
                        .foregroundStyle(TarsTheme.gain)
                }
            }

            Text(m.brief)
                .font(TarsTheme.Text.body)
                .foregroundStyle(TarsTheme.inkSecondary)
                .fixedSize(horizontal: false, vertical: true)

            // What the grader is actually looking at, live.
            VStack(alignment: .leading, spacing: TarsTheme.Space.s) {
                ForEach(m.checks) { c in
                    HStack(alignment: .top, spacing: TarsTheme.Space.s) {
                        Image(systemName: c.ok ? "checkmark.circle.fill" : "circle")
                            .font(.system(size: 14))
                            .foregroundStyle(c.ok ? TarsTheme.gain : TarsTheme.inkQuaternary)
                        VStack(alignment: .leading, spacing: 1) {
                            Text(c.label)
                                .font(TarsTheme.Text.caption)
                                .foregroundStyle(c.ok ? TarsTheme.inkPrimary : TarsTheme.inkSecondary)
                                .fixedSize(horizontal: false, vertical: true)
                            if let d = c.detail, !d.isEmpty {
                                Text(d)
                                    .font(TarsTheme.Text.micro.monospacedDigit())
                                    .foregroundStyle(TarsTheme.inkTertiary)
                                    .fixedSize(horizontal: false, vertical: true)
                            }
                        }
                        Spacer(minLength: 0)
                    }
                }
            }
            .padding(TarsTheme.Space.m)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(TarsTheme.bg2)
            .clipShape(RoundedRectangle(cornerRadius: TarsTheme.Radius.s, style: .continuous))

            if !m.complete {
                Text(m.hint)
                    .font(TarsTheme.Text.micro)
                    .foregroundStyle(TarsTheme.inkTertiary)
                    .fixedSize(horizontal: false, vertical: true)

                HStack(spacing: TarsTheme.Space.m) {
                    Button {
                        Haptics.tap()
                        Task { await model.check(m.missionId) }
                    } label: {
                        Text(model.checking == m.missionId ? "Reading your book…" : "Check my trade")
                            .font(TarsTheme.Text.caption.weight(.semibold))
                            .foregroundStyle(TarsTheme.onFill)
                            .frame(maxWidth: .infinity, minHeight: 44)
                            .background(TarsTheme.accent)
                            .clipShape(RoundedRectangle(cornerRadius: TarsTheme.Radius.m, style: .continuous))
                    }
                    .buttonStyle(.plain)
                    .disabled(model.checking != nil)

                    if let lesson = m.lesson {
                        Button {
                            Haptics.tap()
                            openLesson = lesson
                        } label: {
                            Text("Refresher")
                                .font(TarsTheme.Text.caption.weight(.medium))
                                .foregroundStyle(TarsTheme.inkSecondary)
                                .frame(minWidth: 96, minHeight: 44)
                                .background(TarsTheme.bg2)
                                .clipShape(RoundedRectangle(cornerRadius: TarsTheme.Radius.m, style: .continuous))
                        }
                        .buttonStyle(.plain)
                    }
                }
            }

            if let note = model.notes[m.missionId] {
                Text(note)
                    .font(TarsTheme.Text.caption)
                    .foregroundStyle(note.hasPrefix("Passed") ? TarsTheme.gain : TarsTheme.inkTertiary)
                    .fixedSize(horizontal: false, vertical: true)
            }
        }
        .padding(TarsTheme.Space.l)
        .frame(maxWidth: .infinity, alignment: .leading)
        .tarsPanel()
        .overlay(RoundedRectangle(cornerRadius: TarsTheme.Radius.m, style: .continuous)
            .strokeBorder(m.complete ? TarsTheme.gain.opacity(0.30) : .clear, lineWidth: 1))
    }
}

@Observable @MainActor
final class MissionsModel {
    private(set) var missions: [APIMission] = []
    private(set) var loaded = false
    private(set) var checking: String?
    private(set) var notes: [String: String] = [:]
    private let api = TarsAPIClient.shared

    func load() async {
        missions = (try? await api.missions()) ?? missions
        loaded = true
    }

    /// Re-grades against FRESH marked equity — the point is that it reads
    /// the book as it stands this second, not a cached snapshot.
    func check(_ id: String) async {
        checking = id
        defer { checking = nil }
        guard let res = try? await api.checkMission(id: id) else {
            notes[id] = "Couldn't reach the desk. Try again in a moment."
            return
        }
        if res.justCompleted == true {
            notes[id] = "Passed — XP banked."
            Haptics.success()
        } else if res.passed {
            notes[id] = "Passed."
        } else {
            let missing = res.checks.filter { !$0.ok }.count
            notes[id] = "Not yet — \(missing) check\(missing == 1 ? "" : "s") still open. Nothing is wrong with your account; the process just isn't shown yet."
            Haptics.warning()
        }
        await load()
    }
}
