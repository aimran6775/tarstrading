import SwiftUI

@main
struct TarsTradingApp: App {
    /*
      Platform identity first: the session gate decides between the door and
      the terminal. One account across web and iOS — signing in here is the
      same desk as tarstrading.com.
    */
    @State private var session = SessionStore()
    @State private var store = TradingStore()
    @State private var academy = AcademyProgress()
    @State private var agentLab = AgentLab()
    @State private var tars = TarsStore()
    @State private var prefs = PreferencesStore()

    init() {
        CurriculumRegistry.install()
    }

    var body: some Scene {
        WindowGroup {
            SessionGate {
                RootView()
                    .task { await store.bootstrap() }
            }
            .environment(session)
            .environment(store)
            .environment(academy)
            .environment(agentLab)
            .environment(tars)
            .environment(prefs)
            .preferredColorScheme(prefs.colorScheme)
        }
    }
}
