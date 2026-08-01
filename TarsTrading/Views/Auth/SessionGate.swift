import SwiftUI

/*
  The gate: which app you get depends on who you are.

  .checking      → the mark, briefly — a Keychain read racing a bootstrap
  .signedOut     → LoginView
  .signedIn      → the terminal (RootView), fed by the platform

  During the transition acts the terminal's inner surfaces still run on
  their existing stores; the gate is the seam where the platform identity
  takes over first, and the data follows surface by surface.
*/
struct SessionGate<Terminal: View>: View {
    @Environment(SessionStore.self) private var session
    @ViewBuilder var terminal: () -> Terminal

    var body: some View {
        ZStack {
            switch session.phase {
            case .checking:
                launchMark
            case .signedOut, .authenticating:
                LoginView()
                    .transition(.opacity)
            case .signedIn:
                terminal()
                    .transition(.opacity)
            }
        }
        .animation(.easeInOut(duration: 0.25), value: session.phase)
        .task { await session.restore() }
    }

    /// The instant before we know who you are: the mark on the void.
    /// No spinner — a spinner promises waiting; this promises arrival.
    private var launchMark: some View {
        ZStack {
            TarsTheme.bg0.ignoresSafeArea()
            Image(systemName: "triangle.fill")
                .font(.system(size: 44, weight: .bold))
                .foregroundStyle(TarsTheme.paperBadge)
                .accessibilityLabel("Tars Trading is starting")
        }
    }
}
