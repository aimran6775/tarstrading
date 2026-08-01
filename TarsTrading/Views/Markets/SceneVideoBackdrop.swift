import SwiftUI
import AVKit

/*
  The scene backdrop — the SAME market-footage loop the web floor plays
  (web/public/main-search-video.mp4, bundled here as floor-hero.mp4), under
  the same legibility contract:

  - a fixed dark dim (never a theme token — the scene is a committed dark
    world even if a light theme ever ships),
  - a vertical gradient pulling the eye center,
  - a bottom blend into bg0 so the scene hands off to the page cleanly.

  Honest about motion: Reduce Motion holds the poster frame. Backgrounding
  pauses the player; returning resumes it. Muted, looped, no controls —
  it's weather, not media.
*/
struct SceneVideoBackdrop: View {
    var dim: Double = 0.55
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @Environment(\.scenePhase) private var scenePhase
    @State private var coordinator = LoopCoordinator()

    var body: some View {
        ZStack {
            PlayerLayerView(player: coordinator.player)
                .onAppear { coordinator.start(playing: !reduceMotion) }
                .onDisappear { coordinator.pause() }
                .onChange(of: scenePhase) { _, phase in
                    if phase == .active { coordinator.start(playing: !reduceMotion) }
                    else { coordinator.pause() }
                }
            // Fixed dark dim — identical scrim math to the web's VideoHero.
            Color(.displayP3, red: 0.045, green: 0.05, blue: 0.08).opacity(dim)
            LinearGradient(
                stops: [
                    .init(color: Color(.displayP3, red: 0.045, green: 0.05, blue: 0.08).opacity(0.35), location: 0),
                    .init(color: .clear, location: 0.45),
                    .init(color: Color(.displayP3, red: 0.045, green: 0.05, blue: 0.08).opacity(0.55), location: 1),
                ],
                startPoint: .top, endPoint: .bottom)
            // The vignette that pulls the eye to the centerpiece.
            RadialGradient(
                colors: [.clear, Color(.displayP3, red: 0.04, green: 0.045, blue: 0.075).opacity(0.42)],
                center: .init(x: 0.5, y: 0.45), startRadius: 60, endRadius: 420)
            /*
              The web's hero is full-bleed, so it fades into the page. Ours
              is a CONTAINED card with its own clipped corners — a handoff
              gradient here just hazes the footage, and in light mode it
              washed the bottom third white. The card's edge is the
              boundary; it needs no help.
            */
        }
        .accessibilityHidden(true)
    }
}

/// AVPlayerLayer wrapped for SwiftUI with aspect-fill — VideoPlayer ships
/// chrome and letterboxes; a raw layer does neither.
private struct PlayerLayerView: UIViewRepresentable {
    let player: AVQueuePlayer

    final class LayerHost: UIView {
        override static var layerClass: AnyClass { AVPlayerLayer.self }
        var playerLayer: AVPlayerLayer { layer as! AVPlayerLayer }
    }

    func makeUIView(context: Context) -> LayerHost {
        let v = LayerHost()
        v.playerLayer.player = player
        v.playerLayer.videoGravity = .resizeAspectFill
        return v
    }

    func updateUIView(_ uiView: LayerHost, context: Context) {}
}

/// Owns the queue player + looper. @Observable so SwiftUI keeps it alive
/// with the view's @State; the looper must be retained or the loop dies.
@Observable @MainActor
final class LoopCoordinator {
    let player = AVQueuePlayer()
    private var looper: AVPlayerLooper?

    func start(playing: Bool) {
        if looper == nil,
           let url = Bundle.main.url(forResource: "floor-hero", withExtension: "mp4") {
            let item = AVPlayerItem(url: url)
            looper = AVPlayerLooper(player: player, templateItem: item)
            player.isMuted = true
            player.preventsDisplaySleepDuringVideoPlayback = false
        }
        // Reduce Motion: the poster frame stands; the loop never runs.
        if playing { player.play() } else { player.pause() }
    }

    func pause() { player.pause() }
}
