import SwiftUI

/// Renders one lesson: a scrolling column of content blocks (prose, key ideas,
/// Tars asides, interactive widgets, quizzes), an optional terminal mission,
/// and the complete-lesson CTA. Blocks reveal gently as they scroll in.
public struct LessonView: View {
    let track: Track
    let lesson: Lesson

    @Environment(AcademyProgress.self) private var progress
    @Environment(TradingStore.self) private var tradingStore
    @Environment(TarsStore.self) private var tarsStore
    @Environment(\.dismiss) private var dismiss
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    @State private var justCompleted = false

    init(track: Track, lesson: Lesson) {
        self.track = track
        self.lesson = lesson
    }

    public var body: some View {
        ScrollView {
            LazyVStack(alignment: .leading, spacing: TarsTheme.Space.xl) {
                header
                    .revealOnScroll(index: 0, reduceMotion: reduceMotion)

                ForEach(Array(lesson.blocks.enumerated()), id: \.element.id) { index, block in
                    blockView(block)
                        .revealOnScroll(index: index + 1, reduceMotion: reduceMotion)
                }

                if let mission = lesson.mission {
                    MissionCard(mission: mission, accent: track.accent)
                        .revealOnScroll(index: lesson.blocks.count + 1,
                                        reduceMotion: reduceMotion)
                }

                completeCTA
                    .revealOnScroll(index: lesson.blocks.count + 2,
                                    reduceMotion: reduceMotion)
            }
            .padding(TarsTheme.Space.xl)
            .frame(maxWidth: 720)
            .frame(maxWidth: .infinity)
        }
        .background(TarsTheme.bg0)
        .navigationTitle(lesson.title)
        .navigationBarTitleDisplayMode(.inline)
    }

    // MARK: Header

    private var header: some View {
        HStack(spacing: TarsTheme.Space.s) {
            metaChip(icon: "clock", text: "\(lesson.minutes) min", tint: TarsTheme.inkTertiary)
            metaChip(icon: "bolt.fill", text: "\(lesson.xp) XP", tint: track.accent)
            if lesson.mission != nil {
                metaChip(icon: "flag.fill", text: "Mission", tint: TarsTheme.paperBadge)
            }
            Spacer(minLength: 0)
        }
    }

    private func metaChip(icon: String, text: String, tint: Color) -> some View {
        HStack(spacing: 3) {
            Image(systemName: icon).font(.system(size: 9, weight: .semibold))
            Text(text).font(TarsTheme.Text.micro.monospacedDigit())
        }
        .foregroundStyle(tint)
        .padding(.horizontal, TarsTheme.Space.s)
        .padding(.vertical, TarsTheme.Space.xs)
        .background(Capsule().fill(tint.opacity(0.12)))
    }

    // MARK: Block rendering

    @ViewBuilder
    private func blockView(_ block: LessonBlock) -> some View {
        switch block {
        case .heading(let text):
            Text(text)
                .font(TarsTheme.Text.title)
                .foregroundStyle(TarsTheme.inkPrimary)
                .fixedSize(horizontal: false, vertical: true)
                .padding(.top, TarsTheme.Space.s)

        case .paragraph(let text):
            // Long-form prose reads in reading type (17pt, generous leading),
            // not data-density UI type — the Apple News rule.
            Text(text)
                .font(TarsTheme.Text.reading)
                .foregroundStyle(TarsTheme.inkSecondary)
                .lineSpacing(6)
                .fixedSize(horizontal: false, vertical: true)

        case .keyIdea(let text):
            KeyIdeaCard(text: text, accent: track.accent)

        case .tarsAside(let text):
            TarsAsideBubble(text: text)

        case .widget(let kind):
            widgetView(kind)

        case .quiz(let quiz):
            QuizCard(quiz: quiz, accent: track.accent)
        }
    }

    @ViewBuilder
    private func widgetView(_ kind: WidgetKind) -> some View {
        switch kind {
        case .orderBookSim: OrderBookSimWidget()
        case .candleAnatomy: CandleAnatomyWidget()
        case .orderTypePlayground: OrderTypePlaygroundWidget()
        case .dividendTimeline: DividendTimelineWidget()
        case .payoffBuilder: PayoffBuilderWidget()
        case .greeksLab: GreeksLabWidget()
        case .termStructure: TermStructureWidget()
        case .yieldCurveSculptor: YieldCurveSculptorWidget()
        case .positionSizer: PositionSizerWidget()
        case .leverageSimulator: LeverageSimulatorWidget()
        case .compoundingCurve: CompoundingCurveWidget()
        case .correlationMatrix: CorrelationMatrixWidget()
        }
    }

    // MARK: Complete CTA

    private var completeCTA: some View {
        VStack(spacing: TarsTheme.Space.m) {
            if progress.isCompleted(lesson) {
                HStack(spacing: TarsTheme.Space.s) {
                    Image(systemName: "checkmark.seal.fill")
                        .font(.system(size: 18, weight: .semibold))
                        .foregroundStyle(TarsTheme.gain)
                    Text(justCompleted ? "Lesson complete. +\(lesson.xp) XP banked."
                                       : "Already complete. The XP is long since banked.")
                        .font(TarsTheme.Text.body.weight(.semibold))
                        .foregroundStyle(TarsTheme.inkPrimary)
                        .contentTransition(.opacity)
                    Spacer(minLength: 0)
                    if justCompleted {
                        XPChip(amount: lesson.xp)
                            .transition(.scale(scale: 0.6).combined(with: .opacity))
                    }
                }
                .padding(TarsTheme.Space.l)
                .frame(maxWidth: .infinity, alignment: .leading)
                .tarsPanel(elevation: 2)
            } else {
                Button {
                    withAnimation(Motion.spatial) {
                        progress.complete(lesson)
                        justCompleted = true
                    }
                    Task {
                        try? await Task.sleep(for: .milliseconds(reduceMotion ? 400 : 1200))
                        dismiss()
                    }
                } label: {
                    HStack(spacing: TarsTheme.Space.s) {
                        Image(systemName: "checkmark.circle.fill")
                            .font(.system(size: 15, weight: .semibold))
                        Text("Complete lesson")
                            .font(TarsTheme.Text.body.weight(.semibold))
                        Text("+\(lesson.xp) XP")
                            .font(TarsTheme.Text.priceSmall)
                            .opacity(0.85)
                    }
                    .foregroundStyle(TarsTheme.bg0)
                    .padding(.horizontal, TarsTheme.Space.xl)
                    .padding(.vertical, TarsTheme.Space.m)
                    .frame(maxWidth: .infinity)
                    .background(
                        Capsule().fill(track.accent))
                }
                .buttonStyle(PressableStyle())
                .accessibilityHint("Marks this lesson complete and awards \(lesson.xp) experience points")
            }
        }
        .padding(.top, TarsTheme.Space.l)
        .padding(.bottom, TarsTheme.Space.xxl)
    }
}

// MARK: - Scroll-in reveal

fileprivate struct BlockReveal: ViewModifier {
    let index: Int
    let reduceMotion: Bool
    @State private var shown = false

    func body(content: Content) -> some View {
        content
            .opacity(shown ? 1 : 0)
            .offset(y: shown || reduceMotion ? 0 : 14)
            .onAppear {
                if reduceMotion {
                    shown = true
                } else {
                    // Small, capped stagger: the first screenful cascades,
                    // everything after reveals promptly as it scrolls in.
                    let delay = Double(min(index, 6)) * 0.05
                    withAnimation(Motion.spatial.delay(delay)) { shown = true }
                }
            }
    }
}

fileprivate extension View {
    func revealOnScroll(index: Int, reduceMotion: Bool) -> some View {
        modifier(BlockReveal(index: index, reduceMotion: reduceMotion))
    }
}

// MARK: - Key idea card

fileprivate struct KeyIdeaCard: View {
    let text: String
    let accent: Color

    var body: some View {
        HStack(alignment: .top, spacing: TarsTheme.Space.m) {
            RoundedRectangle(cornerRadius: 2, style: .continuous)
                .fill(accent)
                .frame(width: 3)

            VStack(alignment: .leading, spacing: TarsTheme.Space.xs) {
                Text("Key idea")
                    .font(TarsTheme.Text.micro)
                    .foregroundStyle(accent)
                    .textCase(.uppercase)
                    .kerning(0.8)
                Text(text)
                    .font(TarsTheme.Text.body.weight(.semibold))
                    .foregroundStyle(TarsTheme.inkPrimary)
                    .lineSpacing(4)
                    .fixedSize(horizontal: false, vertical: true)
            }
            Spacer(minLength: 0)
        }
        .padding(TarsTheme.Space.l)
        .background(
            RoundedRectangle(cornerRadius: TarsTheme.Radius.m, style: .continuous)
                .fill(accent.opacity(0.08))
                .overlay(
                    RoundedRectangle(cornerRadius: TarsTheme.Radius.m, style: .continuous)
                        .strokeBorder(accent.opacity(0.18), lineWidth: 1)))
        .accessibilityElement(children: .combine)
        .accessibilityLabel("Key idea: \(text)")
    }
}

// MARK: - Tars aside

fileprivate struct TarsAsideBubble: View {
    let text: String

    var body: some View {
        HStack(alignment: .top, spacing: TarsTheme.Space.m) {
            TarsAvatar(size: 24, thinking: false)
                .padding(.top, 2)

            Text(text)
                .font(TarsTheme.Text.body.italic())
                .foregroundStyle(TarsTheme.inkSecondary)
                .lineSpacing(4)
                .fixedSize(horizontal: false, vertical: true)
                .padding(TarsTheme.Space.m)
                .background(
                    UnevenRoundedRectangle(
                        topLeadingRadius: TarsTheme.Radius.s / 2,
                        bottomLeadingRadius: TarsTheme.Radius.m,
                        bottomTrailingRadius: TarsTheme.Radius.m,
                        topTrailingRadius: TarsTheme.Radius.m,
                        style: .continuous)
                    .fill(TarsTheme.bg2)
                    .overlay(
                        UnevenRoundedRectangle(
                            topLeadingRadius: TarsTheme.Radius.s / 2,
                            bottomLeadingRadius: TarsTheme.Radius.m,
                            bottomTrailingRadius: TarsTheme.Radius.m,
                            topTrailingRadius: TarsTheme.Radius.m,
                            style: .continuous)
                        .strokeBorder(TarsTheme.accent.opacity(0.15), lineWidth: 1)))
            Spacer(minLength: 0)
        }
        .accessibilityElement(children: .combine)
        .accessibilityLabel("Tars says: \(text)")
    }
}

// MARK: - Quiz

fileprivate struct QuizCard: View {
    let quiz: Quiz
    let accent: Color

    @Environment(AcademyProgress.self) private var progress
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    @State private var selection: Int?
    @State private var correctScale: CGFloat = 1
    @State private var shakePhase: CGFloat = 0

    private var answered: Bool { selection != nil }
    private var answeredCorrectly: Bool { selection == quiz.correctIndex }

    var body: some View {
        VStack(alignment: .leading, spacing: TarsTheme.Space.m) {
            HStack(spacing: TarsTheme.Space.s) {
                Image(systemName: "questionmark.circle.fill")
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundStyle(accent)
                Text("Check yourself")
                    .font(TarsTheme.Text.micro)
                    .foregroundStyle(TarsTheme.inkTertiary)
                    .textCase(.uppercase)
                    .kerning(0.8)
            }

            Text(quiz.question)
                .font(TarsTheme.Text.body.weight(.semibold))
                .foregroundStyle(TarsTheme.inkPrimary)
                .lineSpacing(4)
                .fixedSize(horizontal: false, vertical: true)

            VStack(spacing: TarsTheme.Space.s) {
                ForEach(quiz.options.indices, id: \.self) { index in
                    optionRow(index)
                }
            }

            if answered {
                explanationCard
                    .transition(.asymmetric(
                        insertion: .move(edge: .top).combined(with: .opacity),
                        removal: .opacity))
            }
        }
        .padding(TarsTheme.Space.l)
        .frame(maxWidth: .infinity, alignment: .leading)
        .tarsPanel(elevation: 2)
    }

    private func optionRow(_ index: Int) -> some View {
        Button {
            answer(index)
        } label: {
            HStack(alignment: .top, spacing: TarsTheme.Space.m) {
                Image(systemName: rowIcon(index))
                    .font(.system(size: 15, weight: .semibold))
                    .foregroundStyle(rowIconColor(index))
                    .contentTransition(.symbolEffect(.replace))
                    .padding(.top, 1)

                Text(quiz.options[index])
                    .font(TarsTheme.Text.body)
                    .foregroundStyle(rowTextColor(index))
                    .multilineTextAlignment(.leading)
                    .lineSpacing(3)
                    .fixedSize(horizontal: false, vertical: true)
                Spacer(minLength: 0)
            }
            .padding(TarsTheme.Space.m)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(
                RoundedRectangle(cornerRadius: TarsTheme.Radius.s, style: .continuous)
                    .fill(rowFill(index))
                    .overlay(
                        RoundedRectangle(cornerRadius: TarsTheme.Radius.s, style: .continuous)
                            .strokeBorder(rowBorder(index), lineWidth: 1)))
        }
        .buttonStyle(PressableStyle())
        .disabled(answered)
        .opacity(rowOpacity(index))
        .scaleEffect(answered && index == quiz.correctIndex ? correctScale : 1)
        .modifier(ShakeEffect(animatableData:
            answered && !answeredCorrectly && index == selection ? shakePhase : 0))
        .animation(Motion.snappy, value: selection)
        .accessibilityHint(answered ? "" : "Selects this answer")
        .accessibilityValue(answerA11yValue(index))
    }

    private func answerA11yValue(_ index: Int) -> String {
        guard answered else { return "" }
        if index == quiz.correctIndex {
            return index == selection ? "Your answer, correct" : "Correct answer"
        }
        if index == selection { return "Your answer, incorrect" }
        return ""
    }

    private func answer(_ index: Int) {
        guard !answered else { return }
        let correct = index == quiz.correctIndex
        progress.recordQuiz(correct: correct)

        withAnimation(Motion.spatial) { selection = index }

        if correct {
            Haptics.success()
            guard !reduceMotion else { return }
            withAnimation(Motion.snappy) { correctScale = 1.04 }
            Task {
                try? await Task.sleep(for: .milliseconds(180))
                withAnimation(Motion.grand) { correctScale = 1 }
            }
        } else {
            Haptics.failure()
            guard !reduceMotion else { return }
            withAnimation(.linear(duration: 0.45)) { shakePhase = 1 }
        }
    }

    // MARK: Row styling

    private func rowIcon(_ index: Int) -> String {
        guard answered else { return "circle" }
        if index == quiz.correctIndex { return "checkmark.circle.fill" }
        if index == selection { return "xmark.circle.fill" }
        return "circle"
    }

    private func rowIconColor(_ index: Int) -> Color {
        guard answered else { return TarsTheme.inkTertiary }
        if index == quiz.correctIndex { return TarsTheme.gain }
        if index == selection { return TarsTheme.loss }
        return TarsTheme.inkTertiary
    }

    private func rowTextColor(_ index: Int) -> Color {
        guard answered else { return TarsTheme.inkPrimary }
        if index == quiz.correctIndex || index == selection { return TarsTheme.inkPrimary }
        return TarsTheme.inkTertiary
    }

    private func rowFill(_ index: Int) -> Color {
        guard answered else { return TarsTheme.bg3 }
        if index == quiz.correctIndex { return TarsTheme.gain.opacity(0.12) }
        if index == selection { return TarsTheme.loss.opacity(0.10) }
        return TarsTheme.bg3.opacity(0.5)
    }

    private func rowBorder(_ index: Int) -> Color {
        guard answered else { return TarsTheme.hairline }
        if index == quiz.correctIndex { return TarsTheme.gain.opacity(0.4) }
        if index == selection { return TarsTheme.loss.opacity(0.35) }
        return TarsTheme.hairline
    }

    private func rowOpacity(_ index: Int) -> Double {
        guard answered else { return 1 }
        return (index == quiz.correctIndex || index == selection) ? 1 : 0.55
    }

    private var explanationCard: some View {
        HStack(alignment: .top, spacing: TarsTheme.Space.m) {
            Image(systemName: answeredCorrectly ? "lightbulb.fill" : "lightbulb")
                .font(.system(size: 13, weight: .semibold))
                .foregroundStyle(answeredCorrectly ? TarsTheme.gain : TarsTheme.paperBadge)
                .padding(.top, 2)

            VStack(alignment: .leading, spacing: TarsTheme.Space.xs) {
                Text(answeredCorrectly ? "Correct" : "Not quite")
                    .font(TarsTheme.Text.caption)
                    .foregroundStyle(answeredCorrectly ? TarsTheme.gain : TarsTheme.paperBadge)
                Text(quiz.explanation)
                    .font(TarsTheme.Text.body)
                    .foregroundStyle(TarsTheme.inkSecondary)
                    .lineSpacing(4)
                    .fixedSize(horizontal: false, vertical: true)
            }
            Spacer(minLength: 0)
        }
        .padding(TarsTheme.Space.m)
        .background(
            RoundedRectangle(cornerRadius: TarsTheme.Radius.s, style: .continuous)
                .fill(TarsTheme.bg1)
                .overlay(
                    RoundedRectangle(cornerRadius: TarsTheme.Radius.s, style: .continuous)
                        .strokeBorder(TarsTheme.hairline, lineWidth: 1)))
        .accessibilityElement(children: .combine)
    }
}

/// Horizontal shake for a wrong answer. Animates 0 → 1.
fileprivate struct ShakeEffect: GeometryEffect {
    var travel: CGFloat = 7
    var animatableData: CGFloat

    func effectValue(size: CGSize) -> ProjectionTransform {
        let x = travel * sin(animatableData * .pi * 6) * (1 - animatableData)
        return ProjectionTransform(CGAffineTransform(translationX: x, y: 0))
    }
}

// MARK: - Mission footer

fileprivate struct MissionCard: View {
    let mission: Mission
    let accent: Color

    @Environment(AcademyProgress.self) private var progress
    @Environment(TradingStore.self) private var tradingStore
    @Environment(TarsStore.self) private var tarsStore
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    @State private var justVerified = false
    @State private var showEncouragement = false
    @State private var burstID = 0

    private var done: Bool { progress.isMissionDone(mission) }

    var body: some View {
        VStack(alignment: .leading, spacing: TarsTheme.Space.m) {
            HStack(spacing: TarsTheme.Space.s) {
                Image(systemName: "flag.fill")
                    .font(.system(size: 12, weight: .semibold))
                    .foregroundStyle(TarsTheme.paperBadge)
                Text("Mission")
                    .font(TarsTheme.Text.micro)
                    .foregroundStyle(TarsTheme.paperBadge)
                    .textCase(.uppercase)
                    .kerning(0.8)
                Spacer(minLength: 0)
                if done {
                    XPChip(amount: 100)
                        .transition(.scale(scale: 0.6).combined(with: .opacity))
                }
            }

            Text(mission.title)
                .font(TarsTheme.Text.heading)
                .foregroundStyle(TarsTheme.inkPrimary)
                .fixedSize(horizontal: false, vertical: true)

            Text(mission.detail)
                .font(TarsTheme.Text.body)
                .foregroundStyle(TarsTheme.inkSecondary)
                .lineSpacing(4)
                .fixedSize(horizontal: false, vertical: true)

            if done {
                HStack(spacing: TarsTheme.Space.s) {
                    Image(systemName: "checkmark.seal.fill")
                        .font(.system(size: 15, weight: .semibold))
                        .foregroundStyle(TarsTheme.gain)
                    Text("Verified against your account. It actually happened.")
                        .font(TarsTheme.Text.caption)
                        .foregroundStyle(TarsTheme.gain)
                }
                .overlay(alignment: .leading) {
                    if justVerified {
                        SparkleBurst()
                            .id(burstID)
                            .offset(x: 8)
                    }
                }
            } else {
                VStack(alignment: .leading, spacing: TarsTheme.Space.s) {
                    Button {
                        verify()
                    } label: {
                        HStack(spacing: TarsTheme.Space.s) {
                            Image(systemName: "checkmark.shield")
                                .font(.system(size: 13, weight: .semibold))
                            Text("Verify")
                                .font(TarsTheme.Text.body.weight(.semibold))
                        }
                        .foregroundStyle(accent)
                        .padding(.horizontal, TarsTheme.Space.xl)
                        .padding(.vertical, TarsTheme.Space.m)
                        .background(
                            Capsule().fill(accent.opacity(0.12))
                                .overlay(Capsule().strokeBorder(accent.opacity(0.3),
                                                                lineWidth: 1)))
                    }
                    .buttonStyle(PressableStyle())
                    .accessibilityHint("Checks your paper account for this mission's activity")

                    if showEncouragement {
                        Text("Not yet — go do it in the terminal. Missions verify against what actually happened, not what was intended. Tars respects the distinction.")
                            .font(TarsTheme.Text.caption)
                            .foregroundStyle(TarsTheme.paperBadge)
                            .fixedSize(horizontal: false, vertical: true)
                            .transition(.move(edge: .top).combined(with: .opacity))
                    }
                }
            }
        }
        .padding(TarsTheme.Space.l)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(
            RoundedRectangle(cornerRadius: TarsTheme.Radius.m, style: .continuous)
                .fill(TarsTheme.bg2)
                .overlay(
                    RoundedRectangle(cornerRadius: TarsTheme.Radius.m, style: .continuous)
                        .strokeBorder(TarsTheme.paperBadge.opacity(done ? 0.12 : 0.25),
                                      lineWidth: 1)))
        .animation(Motion.spatial, value: done)
        .animation(Motion.spatial, value: showEncouragement)
    }

    private func verify() {
        let passed = progress.verify(mission, trading: tradingStore, tars: tarsStore)
        if passed {
            burstID += 1
            withAnimation(Motion.grand) {
                justVerified = true
                showEncouragement = false
            }
        } else {
            Haptics.warning()
            withAnimation(Motion.spatial) { showEncouragement = true }
        }
    }
}

// MARK: - Celebration bits

fileprivate struct XPChip: View {
    let amount: Int

    var body: some View {
        HStack(spacing: 3) {
            Image(systemName: "bolt.fill")
                .font(.system(size: 9, weight: .semibold))
            Text("+\(amount) XP")
                .font(TarsTheme.Text.micro.monospacedDigit())
        }
        .foregroundStyle(TarsTheme.gain)
        .padding(.horizontal, TarsTheme.Space.s)
        .padding(.vertical, TarsTheme.Space.xs)
        .background(Capsule().fill(TarsTheme.gain.opacity(0.12)))
        .accessibilityLabel("\(amount) experience points earned")
    }
}

/// One-shot sparkle burst — fires on appear, radiates out on Motion.grand,
/// fades. Reduce-motion collapses it to a simple fade.
fileprivate struct SparkleBurst: View {
    @State private var fired = false
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    var body: some View {
        ZStack {
            ForEach(0..<8, id: \.self) { i in
                let angle = Double(i) / 8 * 2 * .pi
                Image(systemName: "sparkle")
                    .font(.system(size: i.isMultiple(of: 2) ? 11 : 7))
                    .foregroundStyle(i.isMultiple(of: 3) ? TarsTheme.paperBadge : TarsTheme.gain)
                    .opacity(fired ? 0 : 0.9)
                    .scaleEffect(fired ? 1.1 : 0.3)
                    .offset(x: fired && !reduceMotion ? cos(angle) * 34 : 0,
                            y: fired && !reduceMotion ? sin(angle) * 34 : 0)
            }
        }
        .allowsHitTesting(false)
        .accessibilityHidden(true)
        .onAppear {
            withAnimation(reduceMotion ? Motion.spatial : Motion.grand) { fired = true }
        }
    }
}
