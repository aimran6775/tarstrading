import SwiftUI

/// First-launch orientation: three panes that say what this is, ask who you
/// are, and hand you to Tars with a first mission. The caller decides when it
/// appears and is responsible for setting "hasOnboarded" inside `onFinish`.
public struct OnboardingView: View {
    let onFinish: () -> Void

    public init(onFinish: @escaping () -> Void) {
        self.onFinish = onFinish
    }

    @State private var page = 0
    @State private var chosen: Track.Audience?
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    public var body: some View {
        ZStack {
            TarsTheme.bg0.ignoresSafeArea()
            TarsTheme.tarsAurora.opacity(0.7).ignoresSafeArea()

            TabView(selection: $page) {
                HeroPane().tag(0)
                PathPane(chosen: $chosen, onChoose: choose).tag(1)
                MissionPane(onBegin: finish).tag(2)
            }
            .tabViewStyle(.page(indexDisplayMode: .never))

            chrome
        }
        .preferredColorScheme(.dark)
    }

    // MARK: Skip + progress dots

    private var chrome: some View {
        VStack {
            HStack {
                Spacer()
                Button(action: finish) {
                    Text("Skip")
                        .font(TarsTheme.Text.caption)
                        .foregroundStyle(TarsTheme.inkTertiary)
                        .padding(.horizontal, TarsTheme.Space.l)
                        .padding(.vertical, TarsTheme.Space.s)
                        .background(
                            Capsule().fill(TarsTheme.bg2)
                                .overlay(Capsule().strokeBorder(TarsTheme.hairline, lineWidth: 1)))
                }
                .buttonStyle(PressableStyle())
                .accessibilityLabel("Skip introduction")
            }
            .padding(.horizontal, TarsTheme.Space.xl)
            .padding(.top, TarsTheme.Space.l)

            Spacer()

            HStack(spacing: TarsTheme.Space.s) {
                ForEach(0..<3, id: \.self) { index in
                    Capsule()
                        .fill(index == page ? TarsTheme.accent : TarsTheme.bg3)
                        .frame(width: index == page ? 22 : 7, height: 7)
                        .onTapGesture { go(to: index) }
                        .accessibilityLabel("Page \(index + 1) of 3")
                        .accessibilityAddTraits(index == page ? [.isSelected] : [])
                }
            }
            .animation(reduceMotion ? nil : Motion.snappy, value: page)
            .padding(.bottom, TarsTheme.Space.l)
        }
    }

    // MARK: Actions

    private func go(to index: Int) {
        if reduceMotion { page = index } else {
            withAnimation(Motion.fluid) { page = index }
        }
    }

    private func choose(_ audience: Track.Audience) {
        chosen = audience
        Haptics.tap()
        UserDefaults.standard.set(audience.rawValue, forKey: "chosenAudienceOnboarding")

        // Mirror into Academy persistence so the track picker skips the ask.
        let persistence = Persistence()
        var state = persistence.load(AcademyProgress.State.self, "academy") ?? .init()
        state.chosenAudience = audience.rawValue
        persistence.saveNow(state, "academy")

        Task {
            try? await Task.sleep(for: .milliseconds(420))
            go(to: 2)
        }
    }

    private func finish() {
        Haptics.confirm()
        onFinish()
    }
}

// MARK: - Pane 1 · The terminal that teaches

fileprivate struct HeroPane: View {
    var body: some View {
        ParallaxPane { parallax in
            VStack(spacing: TarsTheme.Space.xl) {
                Spacer()

                OrbitalMark(size: 80)
                    .offset(x: parallax * 0.30)

                VStack(spacing: TarsTheme.Space.m) {
                    Text("The terminal that teaches")
                        .font(TarsTheme.Text.hero)
                        .foregroundStyle(TarsTheme.inkPrimary)
                        .multilineTextAlignment(.center)
                        .offset(x: parallax * 0.18)

                    Text("A full trading desk wired to a market school — every order, chart, and mistake becomes a lesson.")
                        .font(TarsTheme.Text.body)
                        .foregroundStyle(TarsTheme.inkSecondary)
                        .multilineTextAlignment(.center)
                        .frame(maxWidth: 420)
                        .offset(x: parallax * 0.10)
                }

                HonestChip()
                    .offset(x: parallax * 0.06)

                Spacer()
                Spacer().frame(height: TarsTheme.Space.xxl)
            }
            .padding(.horizontal, TarsTheme.Space.xl)
        }
    }
}

/// The amber honesty badge — same family as the paper-mode banner.
fileprivate struct HonestChip: View {
    var body: some View {
        HStack(spacing: TarsTheme.Space.s) {
            Image(systemName: "checkmark.seal")
                .font(TarsTheme.Text.caption)
            Text("Simulated money. Real lessons.")
                .font(TarsTheme.Text.caption)
        }
        .foregroundStyle(TarsTheme.paperBadge)
        .padding(.horizontal, TarsTheme.Space.l)
        .padding(.vertical, TarsTheme.Space.s)
        .background(
            Capsule().fill(TarsTheme.paperBadge.opacity(0.12))
                .overlay(Capsule().strokeBorder(TarsTheme.paperBadge.opacity(0.35), lineWidth: 1)))
    }
}

// MARK: - Pane 2 · Pick your path

fileprivate struct PathPane: View {
    @Binding var chosen: Track.Audience?
    let onChoose: (Track.Audience) -> Void

    var body: some View {
        ParallaxPane { parallax in
            VStack(spacing: TarsTheme.Space.xl) {
                Spacer()

                VStack(spacing: TarsTheme.Space.s) {
                    Text("Pick your path")
                        .font(TarsTheme.Text.title)
                        .foregroundStyle(TarsTheme.inkPrimary)
                        .offset(x: parallax * 0.18)
                    Text("The Academy leads with tracks that fit. Everything stays open — change your mind anytime.")
                        .font(TarsTheme.Text.body)
                        .foregroundStyle(TarsTheme.inkSecondary)
                        .multilineTextAlignment(.center)
                        .frame(maxWidth: 420)
                        .offset(x: parallax * 0.10)
                }

                VStack(spacing: TarsTheme.Space.m) {
                    ForEach(PathChoice.all) { choice in
                        PathCard(
                            choice: choice,
                            isSelected: chosen == choice.audience,
                            action: { onChoose(choice.audience) })
                    }
                }
                .frame(maxWidth: 480)

                Spacer()
                Spacer().frame(height: TarsTheme.Space.xxl)
            }
            .padding(.horizontal, TarsTheme.Space.xl)
        }
    }
}

fileprivate struct PathChoice: Identifiable {
    let audience: Track.Audience
    let icon: String
    let line: String
    var id: String { audience.rawValue }

    static let all: [PathChoice] = [
        PathChoice(
            audience: .beginner,
            icon: "leaf",
            line: "Start from zero — what a share is, how orders work, why prices move."),
        PathChoice(
            audience: .trader,
            icon: "chart.line.uptrend.xyaxis",
            line: "You've placed trades. Work on process — risk, journaling, order craft."),
        PathChoice(
            audience: .quant,
            icon: "function",
            line: "You like the math. Probability, options Greeks, and rule-based agents."),
    ]
}

fileprivate struct PathCard: View {
    let choice: PathChoice
    let isSelected: Bool
    let action: () -> Void
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    var body: some View {
        Button(action: action) {
            HStack(spacing: TarsTheme.Space.l) {
                Image(systemName: choice.icon)
                    .font(TarsTheme.Text.heading)
                    .foregroundStyle(TarsTheme.accent)
                    .frame(width: 44, height: 44)
                    .background(
                        RoundedRectangle(cornerRadius: TarsTheme.Radius.s, style: .continuous)
                            .fill(TarsTheme.accent.opacity(0.12)))

                VStack(alignment: .leading, spacing: TarsTheme.Space.xs) {
                    Text(choice.audience.rawValue)
                        .font(TarsTheme.Text.heading)
                        .foregroundStyle(TarsTheme.inkPrimary)
                    Text(choice.line)
                        .font(TarsTheme.Text.caption)
                        .foregroundStyle(TarsTheme.inkSecondary)
                        .multilineTextAlignment(.leading)
                }
                .frame(maxWidth: .infinity, alignment: .leading)

                Image(systemName: isSelected ? "checkmark.circle.fill" : "circle")
                    .font(TarsTheme.Text.heading)
                    .foregroundStyle(isSelected ? TarsTheme.accent : TarsTheme.inkTertiary)
                    .contentTransition(.symbolEffect(.replace))
            }
            .padding(TarsTheme.Space.l)
            .background(
                RoundedRectangle(cornerRadius: TarsTheme.Radius.m, style: .continuous)
                    .fill(TarsTheme.bg2)
                    .overlay(
                        RoundedRectangle(cornerRadius: TarsTheme.Radius.m, style: .continuous)
                            .strokeBorder(
                                isSelected ? TarsTheme.accent.opacity(0.6) : TarsTheme.hairline,
                                lineWidth: 1)))
        }
        .buttonStyle(PressableStyle())
        .animation(reduceMotion ? nil : Motion.snappy, value: isSelected)
        .accessibilityLabel("\(choice.audience.rawValue). \(choice.line)")
        .accessibilityAddTraits(isSelected ? [.isSelected] : [])
    }
}

// MARK: - Pane 3 · Meet Tars + first mission

fileprivate struct MissionPane: View {
    let onBegin: () -> Void

    var body: some View {
        ParallaxPane { parallax in
            VStack(spacing: TarsTheme.Space.xl) {
                Spacer()

                OrbitalMark(size: 56)
                    .offset(x: parallax * 0.30)

                VStack(spacing: TarsTheme.Space.m) {
                    Text("Meet Tars")
                        .font(TarsTheme.Text.title)
                        .foregroundStyle(TarsTheme.inkPrimary)
                        .offset(x: parallax * 0.18)

                    Text("\u{201C}I explain what the market is doing and question what you're doing. Tips are not part of the arrangement.\u{201D}")
                        .font(TarsTheme.Text.body)
                        .foregroundStyle(TarsTheme.inkSecondary)
                        .multilineTextAlignment(.center)
                        .frame(maxWidth: 420)
                        .offset(x: parallax * 0.10)
                }

                VStack(alignment: .leading, spacing: TarsTheme.Space.m) {
                    Text("What to try first")
                        .font(TarsTheme.Text.caption)
                        .foregroundStyle(TarsTheme.inkTertiary)
                        .textCase(.uppercase)

                    ChecklistRow(icon: "arrow.up.arrow.down.circle",
                                 text: "Place a paper trade — any symbol, any size.")
                    ChecklistRow(icon: "square.and.pencil",
                                 text: "Write a one-line thesis for why you took it.")
                    ChecklistRow(icon: "graduationcap",
                                 text: "Open the Academy and finish your first lesson.")
                }
                .padding(TarsTheme.Space.l)
                .frame(maxWidth: 480, alignment: .leading)
                .tarsPanel(elevation: 2)
                .offset(x: parallax * 0.06)

                Button(action: onBegin) {
                    Text("Begin")
                        .font(TarsTheme.Text.heading)
                        .foregroundStyle(TarsTheme.bg0)
                        .frame(maxWidth: 480)
                        .padding(.vertical, TarsTheme.Space.l)
                        .background(Capsule().fill(TarsTheme.accent))
                }
                .buttonStyle(PressableStyle())
                .accessibilityLabel("Begin using Tars Trading")

                Spacer()
                Spacer().frame(height: TarsTheme.Space.xxl)
            }
            .padding(.horizontal, TarsTheme.Space.xl)
        }
    }
}

fileprivate struct ChecklistRow: View {
    let icon: String
    let text: String

    var body: some View {
        HStack(spacing: TarsTheme.Space.m) {
            Image(systemName: icon)
                .font(TarsTheme.Text.body)
                .foregroundStyle(TarsTheme.accent)
                .frame(width: 24)
            Text(text)
                .font(TarsTheme.Text.body)
                .foregroundStyle(TarsTheme.inkPrimary)
                .frame(maxWidth: .infinity, alignment: .leading)
        }
    }
}

// MARK: - Shared pieces

/// Wraps a pane and feeds it a horizontal parallax value derived from the
/// page's position while swiping. Zero when Reduce Motion is on.
fileprivate struct ParallaxPane<Content: View>: View {
    @ViewBuilder let content: (CGFloat) -> Content
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    var body: some View {
        GeometryReader { geo in
            content(reduceMotion ? 0 : -geo.frame(in: .global).minX)
                .frame(width: geo.size.width, height: geo.size.height)
        }
    }
}

/// The orbital-ring mark, drawn the same way as TarsAvatar (which is scoped to
/// the Tars panel) — an orbiting ellipse around a core, no monolith.
fileprivate struct OrbitalMark: View {
    var size: CGFloat
    @State private var spin = false
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    var body: some View {
        ZStack {
            Circle()
                .fill(TarsTheme.tarsAurora)
                .overlay(Circle().strokeBorder(TarsTheme.accent.opacity(0.4), lineWidth: 1))
            Ellipse()
                .strokeBorder(TarsTheme.accent.opacity(0.8), lineWidth: max(1, size / 30))
                .frame(width: size * 1.1, height: size * 0.42)
                .rotationEffect(.degrees(spin ? 360 : 0))
            Circle()
                .fill(TarsTheme.accent)
                .frame(width: size * 0.16, height: size * 0.16)
        }
        .frame(width: size, height: size)
        .onAppear {
            guard !reduceMotion else { return }
            withAnimation(.linear(duration: 9).repeatForever(autoreverses: false)) {
                spin = true
            }
        }
        .accessibilityHidden(true)
    }
}
