import SwiftUI

@main
struct TarsTradingApp: App {
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
            RootView()
                .environment(store)
                .environment(academy)
                .environment(agentLab)
                .environment(tars)
                .environment(prefs)
                .preferredColorScheme(prefs.colorScheme)
                .task { await store.bootstrap() }
        }
    }
}
