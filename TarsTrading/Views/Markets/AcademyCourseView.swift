import SwiftUI

/*
  The Academy — the platform's ONE course, on the phone.

  This replaces a six-track curriculum that shipped inside the app with its
  own lesson ids and its own device-local progress. Two academies meant
  finishing a lesson on the web moved nothing here, the XP numbers
  disagreed, and the phone couldn't see missions, placement or reviews at
  all. Now the server states the course and the progress; the phone is a
  window onto it, and a lesson finished on either surface is finished on
  both.

  Completion is EARNED, not asserted: answers go to the server, which
  re-grades them against keys it never sent us.
*/
struct AcademyCourseView: View {
    @State private var model = CourseModel()
    @State private var openLesson: String?

    var body: some View {
        ScrollView {
            LazyVStack(alignment: .leading, spacing: TarsTheme.Space.l) {
                header
                missionsLink
                if model.reviewsDue > 0 { reviewsCard }
                if let r = model.resume { resumeCard(r) }
                if !model.weakSpots.isEmpty { weakSpotsCard }
                ForEach(model.tracks) { track in
                    trackSection(track)
                }
                if model.tracks.isEmpty && model.loaded { empty }
            }
            .padding(TarsTheme.Space.l)
            .padding(.bottom, 72)
        }
        .background(TarsTheme.bg0)
        .toolbar(.hidden, for: .navigationBar)
        .refreshable { await model.load() }
        .task { if model.tracks.isEmpty { await model.load() } }
        .navigationDestination(item: $openLesson) { id in
            LessonReaderView(lessonId: id) { Task { await model.load() } }
        }
    }

    private var header: some View {
        VStack(alignment: .leading, spacing: TarsTheme.Space.m) {
            HStack(alignment: .center, spacing: TarsTheme.Space.s) {
                TarsApexMark(size: 18)
                Text("Academy")
                    .font(TarsTheme.Text.screenTitle)
                    .foregroundStyle(TarsTheme.inkPrimary)
                Spacer()
            }
            if model.lessonCount > 0 {
                VStack(alignment: .leading, spacing: 6) {
                    GeometryReader { geo in
                        ZStack(alignment: .leading) {
                            Capsule().fill(TarsTheme.bg3).frame(height: 4)
                            Capsule().fill(TarsTheme.accent)
                                .frame(width: geo.size.width * progressFraction, height: 4)
                        }
                        .frame(maxHeight: .infinity)
                    }
                    .frame(height: 6)
                    Text("\(model.completedCount) of \(model.lessonCount) lessons · \(model.xp) XP")
                        .font(TarsTheme.Text.micro.monospacedDigit())
                        .foregroundStyle(TarsTheme.inkTertiary)
                }
            }
        }
        .padding(.top, TarsTheme.Space.s)
    }

    private var progressFraction: Double {
        guard model.lessonCount > 0 else { return 0 }
        return Double(model.completedCount) / Double(model.lessonCount)
    }

    /// Where you left off — the single most useful control on the screen.
    private func resumeCard(_ r: APIResume) -> some View {
        Button {
            Haptics.tap()
            openLesson = r.lessonId
        } label: {
            VStack(alignment: .leading, spacing: 6) {
                TarsMicroLabel(model.completedCount == 0 ? "Start here" : "Pick up where you left off",
                               tone: TarsTheme.accent)
                Text(r.title)
                    .font(TarsTheme.Text.heading)
                    .foregroundStyle(TarsTheme.inkPrimary)
                    .fixedSize(horizontal: false, vertical: true)
                if let t = r.newTrack {
                    Text("Begins a new track — \(t)")
                        .font(TarsTheme.Text.micro)
                        .foregroundStyle(TarsTheme.inkTertiary)
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(TarsTheme.Space.l)
            .background(TarsTheme.accent.opacity(0.10))
            .clipShape(RoundedRectangle(cornerRadius: TarsTheme.Radius.m, style: .continuous))
            .overlay(RoundedRectangle(cornerRadius: TarsTheme.Radius.m, style: .continuous)
                .strokeBorder(TarsTheme.accent.opacity(0.30), lineWidth: 1))
        }
        .buttonStyle(.plain)
    }

    /// The habit the whole method depends on. Leitner intervals were
    /// invisible outside the web's Practice page, so nothing ever asked a
    /// learner to come back — and spaced repetition without the spacing is
    /// just a pile of cards.
    /// The learn-to-do loop. Everything else grades your answers; this
    /// grades your book.
    private var missionsLink: some View {
        NavigationLink { MissionsView() } label: {
            HStack(spacing: TarsTheme.Space.m) {
                Image(systemName: "target")
                    .font(.system(size: 18, weight: .medium))
                    .foregroundStyle(TarsTheme.accent)
                VStack(alignment: .leading, spacing: 2) {
                    Text("Missions")
                        .font(TarsTheme.Text.body.weight(.semibold))
                        .foregroundStyle(TarsTheme.inkPrimary)
                    Text("Prove it on your own book — the desk reads your real positions.")
                        .font(TarsTheme.Text.micro)
                        .foregroundStyle(TarsTheme.inkTertiary)
                        .fixedSize(horizontal: false, vertical: true)
                }
                Spacer(minLength: 0)
                Image(systemName: "chevron.right")
                    .font(TarsTheme.Text.caption)
                    .foregroundStyle(TarsTheme.inkQuaternary)
            }
            .padding(TarsTheme.Space.l)
            .frame(maxWidth: .infinity, alignment: .leading)
            .tarsPanel()
        }
        .buttonStyle(RowPressStyle())
    }

    private var reviewsCard: some View {
        NavigationLink { ReviewSessionView { Task { await model.load() } } } label: {
        HStack(spacing: TarsTheme.Space.m) {
            Image(systemName: "arrow.trianglehead.2.clockwise.rotate.90")
                .font(.system(size: 18, weight: .medium))
                .foregroundStyle(TarsTheme.gain)
            VStack(alignment: .leading, spacing: 2) {
                Text("\(model.reviewsDue) term\(model.reviewsDue == 1 ? "" : "s") due for review")
                    .font(TarsTheme.Text.body.weight(.semibold))
                    .foregroundStyle(TarsTheme.inkPrimary)
                Text("Five minutes now beats an hour next week — that's the whole trick.")
                    .font(TarsTheme.Text.micro)
                    .foregroundStyle(TarsTheme.inkTertiary)
                    .fixedSize(horizontal: false, vertical: true)
            }
            Spacer(minLength: 0)
        }
        .padding(TarsTheme.Space.l)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(TarsTheme.gain.opacity(0.10))
        .clipShape(RoundedRectangle(cornerRadius: TarsTheme.Radius.m, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: TarsTheme.Radius.m, style: .continuous)
            .strokeBorder(TarsTheme.gain.opacity(0.28), lineWidth: 1))
        }
        .buttonStyle(RowPressStyle())
    }

    /// What hasn't stuck. Every quiz answer has been logged since the
    /// beginning and never read back — so a learner could miss position
    /// sizing in three lessons and be marched on to options regardless.
    private var weakSpotsCard: some View {
        VStack(alignment: .leading, spacing: TarsTheme.Space.m) {
            TarsMicroLabel("Worth another look", tone: TarsTheme.warning)
            ForEach(model.weakSpots) { w in
                Button {
                    Haptics.tap()
                    openLesson = w.lessonId
                } label: {
                    HStack(spacing: TarsTheme.Space.m) {
                        VStack(alignment: .leading, spacing: 2) {
                            Text(w.lessonTitle)
                                .font(TarsTheme.Text.body.weight(.semibold))
                                .foregroundStyle(TarsTheme.inkPrimary)
                                .fixedSize(horizontal: false, vertical: true)
                            Text("\(w.trackTitle) · missed \(w.misses) of \(w.attempts) checks")
                                .font(TarsTheme.Text.micro)
                                .foregroundStyle(TarsTheme.inkTertiary)
                        }
                        Spacer(minLength: 0)
                        Image(systemName: "arrow.counterclockwise")
                            .font(.system(size: 13, weight: .medium))
                            .foregroundStyle(TarsTheme.warning)
                    }
                    .padding(.vertical, TarsTheme.Space.s)
                    .contentShape(Rectangle())
                }
                .buttonStyle(RowPressStyle())
            }
        }
        .padding(TarsTheme.Space.l)
        .frame(maxWidth: .infinity, alignment: .leading)
        .tarsPanel()
    }

    private func trackSection(_ t: APITrack) -> some View {
        VStack(alignment: .leading, spacing: TarsTheme.Space.s) {
            HStack(alignment: .firstTextBaseline) {
                Text(t.title)
                    .font(TarsTheme.Text.title)
                    .foregroundStyle(t.unlocked ? TarsTheme.inkPrimary : TarsTheme.inkTertiary)
                Spacer()
                if !t.unlocked {
                    Label("Locked", systemImage: "lock")
                        .font(TarsTheme.Text.micro)
                        .foregroundStyle(TarsTheme.inkQuaternary)
                }
            }
            Text(t.tagline)
                .font(TarsTheme.Text.caption)
                .foregroundStyle(TarsTheme.inkSecondary)
                .fixedSize(horizontal: false, vertical: true)
            Text(t.covers.uppercased())
                .font(.system(size: 9, weight: .semibold, design: .monospaced))
                .kerning(0.8)
                .foregroundStyle(TarsTheme.inkQuaternary)
                .padding(.bottom, TarsTheme.Space.xs)

            VStack(spacing: 0) {
                ForEach(t.lessons) { l in
                    Button {
                        guard l.unlocked else { Haptics.warning(); return }
                        Haptics.tap()
                        openLesson = l.id
                    } label: { lessonRow(l) }
                        .buttonStyle(RowPressStyle())
                        .disabled(!l.unlocked)
                    Divider().overlay(TarsTheme.hairline)
                }
            }
        }
        .padding(.top, TarsTheme.Space.s)
    }

    private func lessonRow(_ l: APILessonSummary) -> some View {
        HStack(spacing: TarsTheme.Space.m) {
            Image(systemName: l.completed ? "checkmark.circle.fill"
                  : l.unlocked ? "circle" : "lock.fill")
                .font(.system(size: 16))
                .foregroundStyle(l.completed ? TarsTheme.gain
                                 : l.unlocked ? TarsTheme.inkTertiary : TarsTheme.inkQuaternary)
                .frame(width: 22)
            VStack(alignment: .leading, spacing: 2) {
                Text(l.title)
                    .font(TarsTheme.Text.body.weight(.semibold))
                    .foregroundStyle(l.unlocked ? TarsTheme.inkPrimary : TarsTheme.inkTertiary)
                    .fixedSize(horizontal: false, vertical: true)
                Text(l.hook)
                    .font(TarsTheme.Text.micro)
                    .foregroundStyle(TarsTheme.inkTertiary)
                    .lineLimit(2)
                    .fixedSize(horizontal: false, vertical: true)
            }
            Spacer(minLength: TarsTheme.Space.s)
            VStack(alignment: .trailing, spacing: 2) {
                if let m = l.mastery, l.completed {
                    // Finished and known are different facts.
                    Text(m == "solid" ? "SOLID" : "SHAKY")
                        .font(.system(size: 9, weight: .bold, design: .monospaced))
                        .kerning(0.5)
                        .foregroundStyle(m == "solid" ? TarsTheme.gain : TarsTheme.warning)
                }
                Text("\(l.minutes) min")
                    .font(TarsTheme.Text.micro.monospacedDigit())
                    .foregroundStyle(TarsTheme.inkQuaternary)
                Text("\(l.xp) XP")
                    .font(TarsTheme.Text.micro.monospacedDigit())
                    .foregroundStyle(l.completed ? TarsTheme.gain : TarsTheme.inkQuaternary)
            }
        }
        .padding(.vertical, TarsTheme.Space.m)
        .contentShape(Rectangle())
        .opacity(l.unlocked ? 1 : 0.6)
        .accessibilityElement(children: .combine)
    }

    private var empty: some View {
        Text("The course didn't load. Pull to try again.")
            .font(TarsTheme.Text.caption)
            .foregroundStyle(TarsTheme.inkTertiary)
            .padding(TarsTheme.Space.xl)
    }
}

@Observable @MainActor
final class CourseModel {
    private(set) var tracks: [APITrack] = []
    private(set) var resume: APIResume?
    private(set) var xp = 0
    private(set) var completedCount = 0
    private(set) var lessonCount = 0
    private(set) var reviewsDue = 0
    private(set) var weakSpots: [APIWeakSpot] = []
    private(set) var loaded = false
    private let api = TarsAPIClient.shared

    func load() async {
        if let res = try? await api.curriculum() {
            tracks = res.tracks
            resume = res.resume
            xp = res.xp
            completedCount = res.completedCount
            lessonCount = res.lessonCount
            reviewsDue = res.reviewsDue ?? 0
            weakSpots = res.weakSpots ?? []
        }
        loaded = true
    }
}
