import SwiftUI

/// The signature open: a starfield condenses into the apex mark, the
/// wordmark breathes in, then the whole thing dissolves into the workspace.
/// Runs once per cold launch; skipped entirely under Reduce Motion.
struct LaunchOverlay: View {
    @Binding var isPresented: Bool
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    @State private var stage: Stage = .scattered
    private enum Stage { case scattered, formed, branded, gone }

    /// Deterministic constellation: 26 stars whose "home" positions trace the
    /// orbital mark (ellipse + core), scattered by a seeded offset at start.
    private let stars: [StarSpec] = StarSpec.constellation

    var body: some View {
        if isPresented {
            ZStack {
                TarsTheme.bg0.ignoresSafeArea()
                GeometryReader { geo in
                    let center = CGPoint(x: geo.size.width / 2, y: geo.size.height / 2 - 40)
                    ForEach(stars) { star in
                        Circle()
                            .fill(TarsTheme.accent.opacity(star.brightness))
                            .frame(width: star.size, height: star.size)
                            .position(stage == .scattered ? star.scattered(in: geo.size) : star.formed(around: center))
                            .opacity(stage == .gone ? 0 : 1)
                            .shadow(color: TarsTheme.accent.opacity(0.6), radius: stage == .scattered ? 0 : 4)
                    }
                    VStack(spacing: TarsTheme.Space.m) {
                        Spacer()
                        Text("TARS TRADING")
                            .font(Font.system(size: 24, weight: .bold).width(.condensed))
                            .kerning(4)
                            .foregroundStyle(TarsTheme.inkPrimary)
                        Text("Learn. Practice. Then let your agents practice.")
                            .font(TarsTheme.Text.caption)
                            .foregroundStyle(TarsTheme.inkSecondary)
                        Spacer().frame(height: geo.size.height * 0.22)
                    }
                    .frame(maxWidth: .infinity)
                    .opacity(stage == .branded ? 1 : 0)
                    .offset(y: stage == .branded ? 0 : 12)
                }
            }
            .opacity(stage == .gone ? 0 : 1)
            .onAppear(perform: run)
            // The open is a gift, never a gate: any touch skips straight in.
            .onTapGesture(perform: dismiss)
            .accessibilityHidden(true)
            .allowsHitTesting(stage != .gone)
        }
    }

    private func run() {
        guard !reduceMotion else {
            isPresented = false
            return
        }
        Task { @MainActor in
            try? await Task.sleep(for: .milliseconds(120))
            guard stage == .scattered else { return }
            withAnimation(Motion.grand) { stage = .formed }
            try? await Task.sleep(for: .milliseconds(650))
            guard stage == .formed else { return }
            withAnimation(Motion.spatial) { stage = .branded }
            Haptics.tap()
            try? await Task.sleep(for: .milliseconds(800))
            dismiss()
        }
    }

    private func dismiss() {
        guard stage != .gone else { return }
        withAnimation(Motion.spatial) { stage = .gone }
        Task { @MainActor in
            try? await Task.sleep(for: .milliseconds(420))
            isPresented = false
        }
    }
}

private struct StarSpec: Identifiable {
    let id: Int
    let angle: Double        // position on the orbital ellipse
    let size: CGFloat
    let brightness: Double
    let scatterSeed: (Double, Double)

    func formed(around center: CGPoint) -> CGPoint {
        // Stars settle onto the APEX: the triangle perimeter of the brand
        // mark — the same silhouette as the app icon the user just tapped.
        if id == 0 { return CGPoint(x: center.x, y: center.y + 8) } // the ember under the peak
        let w: CGFloat = 220, h: CGFloat = 150
        let t = angle / (2 * Double.pi)          // 0..1 around the perimeter
        let a = CGPoint(x: center.x, y: center.y - h / 2)            // peak
        let b = CGPoint(x: center.x + w / 2, y: center.y + h / 2)    // right foot
        let c = CGPoint(x: center.x - w / 2, y: center.y + h / 2)    // left foot
        func lerp(_ p: CGPoint, _ q: CGPoint, _ f: CGFloat) -> CGPoint {
            CGPoint(x: p.x + (q.x - p.x) * f, y: p.y + (q.y - p.y) * f)
        }
        let f = CGFloat(t * 3)
        if f < 1 { return lerp(a, b, f) }
        if f < 2 { return lerp(b, c, f - 1) }
        return lerp(c, a, f - 2)
    }

    func scattered(in size: CGSize) -> CGPoint {
        CGPoint(x: scatterSeed.0 * size.width, y: scatterSeed.1 * size.height)
    }

    static let constellation: [StarSpec] = {
        var rng = SeededRNG(seed: 42)
        let sizes: [CGFloat] = [3, 4, 5]
        let brightnesses: [Double] = [0.5, 0.75, 0.95]
        var stars: [StarSpec] = []
        for i in 0..<26 {
            let angle: Double = Double(i) / 25.0 * 2.0 * Double.pi
            let size: CGFloat = i == 0 ? 10 : sizes[i % 3]
            let brightness: Double = i == 0 ? 1.0 : brightnesses[i % 3]
            let sx: Double = Double(rng.next() % 1000) / 1000.0
            let sy: Double = Double(rng.next() % 1000) / 1000.0
            stars.append(StarSpec(id: i, angle: angle, size: size,
                                  brightness: brightness, scatterSeed: (sx, sy)))
        }
        return stars
    }()
}
