import SwiftUI

/// Academy home: rank + XP hero, adaptive path chooser on first visit, and the
/// track grid. Every road leads into `LessonView`.
struct AcademyHomeView: View {
    @Environment(AcademyProgress.self) private var progress
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var appeared = false

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: TarsTheme.Space.xl) {
                hero

                if progress.state.chosenAudience == nil, !Curriculum.tracks.isEmpty {
                    AudienceChooser()
                        .transition(.asymmetric(
                            insertion: .move(edge: .top).combined(with: .opacity),
                            removal: .scale(scale: 0.96).combined(with: .opacity)))
                }

                if Curriculum.tracks.isEmpty {
                    emptyState
                } else {
                    trackGrid
                }
            }
            .padding(TarsTheme.Space.xl)
            .frame(maxWidth: 1100)
            .frame(maxWidth: .infinity)
        }
        .background(TarsTheme.bg0)
        .animation(Motion.spatial, value: progress.state.chosenAudience)
        .onAppear {
            if reduceMotion {
                appeared = true
            } else {
                withAnimation(Motion.spatial.delay(0.1)) { appeared = true }
            }
        }
    }

    // MARK: Hero

    private var hero: some View {
        HStack(spacing: TarsTheme.Space.xl) {
            OverallRing(fraction: progress.totalProgress)
                .frame(width: 88, height: 88)

            VStack(alignment: .leading, spacing: TarsTheme.Space.xs) {
                Text(progress.rank)
                    .font(TarsTheme.Text.title)
                    .foregroundStyle(TarsTheme.inkPrimary)
                    .contentTransition(.opacity)

                HStack(spacing: TarsTheme.Space.l) {
                    HStack(spacing: TarsTheme.Space.xs) {
                        Text(progress.state.xp, format: .number)
                            .font(TarsTheme.Text.price)
                            .foregroundStyle(TarsTheme.accent)
                            .contentTransition(.numericText(value: Double(progress.state.xp)))
                            .animation(Motion.ticker, value: progress.state.xp)
                        Text("XP")
                            .font(TarsTheme.Text.micro)
                            .foregroundStyle(TarsTheme.inkTertiary)
                    }
                    .accessibilityElement(children: .ignore)
                    .accessibilityLabel("\(progress.state.xp) experience points")

                    HStack(spacing: TarsTheme.Space.xs) {
                        Image(systemName: "flame.fill")
                            .font(TarsTheme.Text.caption)
                            .foregroundStyle(progress.state.streakDays > 0
                                             ? TarsTheme.paperBadge : TarsTheme.inkTertiary)
                        Text("\(progress.state.streakDays)")
                            .font(TarsTheme.Text.priceSmall)
                            .foregroundStyle(TarsTheme.inkPrimary)
                            .contentTransition(.numericText(value: Double(progress.state.streakDays)))
                        Text("day streak")
                            .font(TarsTheme.Text.micro)
                            .foregroundStyle(TarsTheme.inkTertiary)
                    }
                    .accessibilityElement(children: .ignore)
                    .accessibilityLabel("\(progress.state.streakDays) day streak")
                }

                Text("Learn the mechanics. The market grades the exam.")
                    .font(TarsTheme.Text.caption)
                    .foregroundStyle(TarsTheme.inkSecondary)
            }
            Spacer(minLength: 0)
        }
        .padding(TarsTheme.Space.xl)
        .background(
            RoundedRectangle(cornerRadius: TarsTheme.Radius.l, style: .continuous)
                .fill(TarsTheme.bg1)
                .overlay(
                    RoundedRectangle(cornerRadius: TarsTheme.Radius.l, style: .continuous)
                        .fill(TarsTheme.tarsAurora))
                .overlay(
                    RoundedRectangle(cornerRadius: TarsTheme.Radius.l, style: .continuous)
                        .strokeBorder(TarsTheme.hairline, lineWidth: 1))
        )
        .opacity(appeared ? 1 : 0)
        .offset(y: appeared || reduceMotion ? 0 : 12)
    }

    // MARK: Track grid

    private var orderedTracks: [Track] {
        guard let chosen = progress.state.chosenAudience else { return Curriculum.tracks }
        func weight(_ t: Track) -> Int {
            if t.audience.rawValue == chosen { return 0 }
            if t.audience == .everyone { return 1 }
            return 2
        }
        return Curriculum.tracks.enumerated()
            .sorted { l, r in
                let lw = weight(l.element), rw = weight(r.element)
                return lw == rw ? l.offset < r.offset : lw < rw
            }
            .map(\.element)
    }

    private var trackGrid: some View {
        LazyVGrid(
            columns: [GridItem(.adaptive(minimum: 300, maximum: 480),
                               spacing: TarsTheme.Space.l)],
            spacing: TarsTheme.Space.l
        ) {
            ForEach(Array(orderedTracks.enumerated()), id: \.element.id) { index, track in
                NavigationLink {
                    TrackDetailView(track: track)
                } label: {
                    TrackCard(track: track, fraction: progress.progress(in: track))
                }
                .buttonStyle(PressableStyle())
                .opacity(appeared ? 1 : 0)
                .offset(y: appeared || reduceMotion ? 0 : 20)
                .animation(
                    reduceMotion ? Motion.spatial : Motion.spatial.delay(Double(index) * 0.06),
                    value: appeared)
            }
        }
    }

    // MARK: Empty state

    private var emptyState: some View {
        VStack(spacing: TarsTheme.Space.l) {
            Image(systemName: "graduationcap")
                .font(.system(size: 44))
                .foregroundStyle(TarsTheme.inkTertiary)
                .accessibilityHidden(true)
            Text("No lessons registered yet")
                .font(TarsTheme.Text.heading)
                .foregroundStyle(TarsTheme.inkPrimary)
            Text("The curriculum lands here. Check back after the next build —\nTars refuses to teach from an empty syllabus.")
                .font(TarsTheme.Text.body)
                .foregroundStyle(TarsTheme.inkSecondary)
                .multilineTextAlignment(.center)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, TarsTheme.Space.xxl * 2)
    }
}

// MARK: - Overall progress ring

fileprivate struct OverallRing: View {
    let fraction: Double
    @State private var shown: Double = 0

    var body: some View {
        ZStack {
            Circle()
                .stroke(TarsTheme.bg3, lineWidth: 7)
            Circle()
                .trim(from: 0, to: max(shown, 0.001))
                .stroke(TarsTheme.accent,
                        style: StrokeStyle(lineWidth: 7, lineCap: .round))
                .rotationEffect(.degrees(-90))
            Text(fraction, format: .percent.precision(.fractionLength(0)))
                .font(TarsTheme.Text.priceSmall)
                .foregroundStyle(TarsTheme.inkPrimary)
                .contentTransition(.numericText(value: fraction))
                .lineLimit(1)
                .minimumScaleFactor(0.6)
        }
        .onAppear {
            withAnimation(Motion.grand.delay(0.25)) { shown = fraction }
        }
        .onChange(of: fraction) { _, new in
            withAnimation(Motion.spatial) { shown = new }
        }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("Overall progress \(Int(fraction * 100)) percent")
    }
}

// MARK: - Adaptive path chooser

fileprivate struct AudienceChooser: View {
    @Environment(AcademyProgress.self) private var progress

    private let choices: [Track.Audience] = [.beginner, .trader, .quant]

    var body: some View {
        VStack(alignment: .leading, spacing: TarsTheme.Space.m) {
            Text("Chart your path")
                .font(TarsTheme.Text.heading)
                .foregroundStyle(TarsTheme.inkPrimary)
            Text("Where are you starting from? This reorders the tracks — it never skips the fundamentals, because markets don't either.")
                .font(TarsTheme.Text.body)
                .foregroundStyle(TarsTheme.inkSecondary)
                .fixedSize(horizontal: false, vertical: true)

            ViewThatFits(in: .horizontal) {
                HStack(spacing: TarsTheme.Space.m) { choiceButtons }
                VStack(spacing: TarsTheme.Space.s) { choiceButtons }
            }
        }
        .padding(TarsTheme.Space.xl)
        .frame(maxWidth: .infinity, alignment: .leading)
        .tarsPanel(elevation: 2)
    }

    @ViewBuilder
    private var choiceButtons: some View {
        ForEach(choices, id: \.rawValue) { audience in
            Button {
                Haptics.confirm()
                withAnimation(Motion.spatial) {
                    progress.state.chosenAudience = audience.rawValue
                }
            } label: {
                Text(audience.rawValue)
                    .font(TarsTheme.Text.caption)
                    .foregroundStyle(TarsTheme.accent)
                    .padding(.horizontal, TarsTheme.Space.l)
                    .padding(.vertical, TarsTheme.Space.m)
                    .frame(maxWidth: .infinity)
                    .background(
                        Capsule().fill(TarsTheme.accent.opacity(0.12))
                            .overlay(Capsule().strokeBorder(TarsTheme.accent.opacity(0.3),
                                                            lineWidth: 1)))
            }
            .buttonStyle(PressableStyle())
            .accessibilityLabel("Start as \(audience.rawValue)")
            .accessibilityHint("Reorders the tracks to fit where you're starting from")
        }
    }
}

// MARK: - Track card

fileprivate struct TrackCard: View {
    let track: Track
    let fraction: Double

    var body: some View {
        VStack(alignment: .leading, spacing: TarsTheme.Space.l) {
            HStack(spacing: TarsTheme.Space.m) {
                ZStack {
                    Circle().fill(track.accent.opacity(0.14))
                    Image(systemName: track.icon)
                        .font(.system(size: 19, weight: .semibold))
                        .foregroundStyle(track.accent)
                }
                .frame(width: 44, height: 44)

                VStack(alignment: .leading, spacing: 2) {
                    Text(track.title)
                        .font(TarsTheme.Text.heading)
                        .foregroundStyle(TarsTheme.inkPrimary)
                        .lineLimit(1)
                    Text(track.tagline)
                        .font(TarsTheme.Text.caption)
                        .foregroundStyle(TarsTheme.inkSecondary)
                        .lineLimit(2)
                }
                Spacer(minLength: 0)
            }

            VStack(alignment: .leading, spacing: TarsTheme.Space.s) {
                GeometryReader { geo in
                    ZStack(alignment: .leading) {
                        Capsule().fill(TarsTheme.bg3)
                        Capsule()
                            .fill(track.accent)
                            .frame(width: max(geo.size.width * fraction, fraction > 0 ? 6 : 0))
                            .animation(Motion.spatial, value: fraction)
                    }
                }
                .frame(height: 5)
                .accessibilityHidden(true)

                HStack {
                    Text("\(track.lessons.count) \(track.lessons.count == 1 ? "lesson" : "lessons")")
                        .font(TarsTheme.Text.micro)
                        .foregroundStyle(TarsTheme.inkTertiary)
                    Spacer()
                    Text(fraction, format: .percent.precision(.fractionLength(0)))
                        .font(TarsTheme.Text.micro.monospacedDigit())
                        .foregroundStyle(fraction >= 1 ? TarsTheme.gain : TarsTheme.inkTertiary)
                        .contentTransition(.numericText(value: fraction))
                }
            }
        }
        .padding(TarsTheme.Space.l)
        .frame(maxWidth: .infinity, alignment: .leading)
        .tarsPanel(elevation: 2)
        .accessibilityElement(children: .combine)
        .accessibilityLabel("\(track.title). \(track.tagline). \(track.lessons.count) \(track.lessons.count == 1 ? "lesson" : "lessons"), \(Int(fraction * 100)) percent complete")
    }
}

// MARK: - Track detail

fileprivate struct TrackDetailView: View {
    let track: Track
    @Environment(AcademyProgress.self) private var progress

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: TarsTheme.Space.l) {
                header
                VStack(spacing: TarsTheme.Space.m) {
                    ForEach(track.lessons) { lesson in
                        NavigationLink {
                            LessonView(track: track, lesson: lesson)
                        } label: {
                            LessonRow(lesson: lesson,
                                      done: progress.isCompleted(lesson),
                                      accent: track.accent)
                        }
                        .buttonStyle(PressableStyle())
                    }
                }
            }
            .padding(TarsTheme.Space.xl)
            .frame(maxWidth: 760)
            .frame(maxWidth: .infinity)
        }
        .background(TarsTheme.bg0)
        .navigationTitle(track.title)
        .navigationBarTitleDisplayMode(.inline)
    }

    private var header: some View {
        HStack(spacing: TarsTheme.Space.l) {
            ZStack {
                Circle().fill(track.accent.opacity(0.14))
                Image(systemName: track.icon)
                    .font(.system(size: 24, weight: .semibold))
                    .foregroundStyle(track.accent)
            }
            .frame(width: 56, height: 56)

            VStack(alignment: .leading, spacing: TarsTheme.Space.xs) {
                Text(track.tagline)
                    .font(TarsTheme.Text.body)
                    .foregroundStyle(TarsTheme.inkSecondary)
                Text("\(completedCount)/\(track.lessons.count) complete")
                    .font(TarsTheme.Text.priceSmall)
                    .foregroundStyle(TarsTheme.inkTertiary)
            }
            Spacer(minLength: 0)
        }
        .padding(TarsTheme.Space.l)
        .frame(maxWidth: .infinity, alignment: .leading)
        .tarsPanel()
    }

    private var completedCount: Int {
        track.lessons.filter { progress.isCompleted($0) }.count
    }
}

fileprivate struct LessonRow: View {
    let lesson: Lesson
    let done: Bool
    let accent: Color

    var body: some View {
        HStack(spacing: TarsTheme.Space.m) {
            Image(systemName: done ? "checkmark.circle.fill" : "circle")
                .font(.system(size: 20))
                .foregroundStyle(done ? TarsTheme.gain : TarsTheme.inkTertiary)
                .contentTransition(.symbolEffect(.replace))

            VStack(alignment: .leading, spacing: TarsTheme.Space.xs) {
                Text(lesson.title)
                    .font(TarsTheme.Text.body.weight(.semibold))
                    .foregroundStyle(TarsTheme.inkPrimary)
                    .multilineTextAlignment(.leading)

                HStack(spacing: TarsTheme.Space.s) {
                    chip(icon: "clock", text: "\(lesson.minutes) min", tint: TarsTheme.inkTertiary)
                    chip(icon: "bolt.fill", text: "\(lesson.xp) XP", tint: accent)
                    if lesson.mission != nil {
                        chip(icon: "flag.fill", text: "Mission", tint: TarsTheme.paperBadge)
                    }
                }
            }
            Spacer(minLength: 0)
            Image(systemName: "chevron.right")
                .font(TarsTheme.Text.caption)
                .foregroundStyle(TarsTheme.inkTertiary)
        }
        .padding(TarsTheme.Space.l)
        .frame(maxWidth: .infinity, alignment: .leading)
        .tarsPanel(elevation: 2)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("\(lesson.title), \(lesson.minutes) minutes, \(lesson.xp) XP\(lesson.mission != nil ? ", includes a mission" : "")\(done ? ", completed" : "")")
    }

    private func chip(icon: String, text: String, tint: Color) -> some View {
        HStack(spacing: 3) {
            Image(systemName: icon).font(.system(size: 9, weight: .semibold))
            Text(text).font(TarsTheme.Text.micro.monospacedDigit())
        }
        .foregroundStyle(tint)
        .padding(.horizontal, TarsTheme.Space.s)
        .padding(.vertical, 3)
        .background(Capsule().fill(tint.opacity(0.12)))
    }
}
