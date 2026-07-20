import SwiftUI

/// App shell: launch sequence → adaptive split layout with the mode banner
/// pinned everywhere, Tars one tap away, and the thesis-capture loop armed.
struct RootView: View {
    @Environment(TradingStore.self) private var store
    @Environment(TarsStore.self) private var tars
    @Environment(AgentLab.self) private var agentLab
    @Environment(PreferencesStore.self) private var prefs

    enum Section: String, CaseIterable, Identifiable {
        case terminal = "Terminal"
        case portfolio = "Portfolio"
        case academy = "Academy"
        case agents = "Agent Lab"
        case journal = "Journal"
        case screener = "Screener"
        case alerts = "Alerts"
        case settings = "Settings"
        var id: String { rawValue }
        var icon: String {
            switch self {
            case .terminal: "chart.xyaxis.line"
            case .portfolio: "briefcase.fill"
            case .academy: "graduationcap.fill"
            case .agents: "brain.head.profile"
            case .journal: "book.closed.fill"
            case .screener: "line.3.horizontal.decrease.circle.fill"
            case .alerts: "bell.badge.fill"
            case .settings: "gearshape.fill"
            }
        }
    }

    @State private var section: Section = .terminal
    @State private var showLaunch = true
    @State private var showTars = false
    @State private var alertEngine = AlertEngine()

    var body: some View {
        @Bindable var store = store
        ZStack {
            NavigationSplitView {
                sidebar
            } detail: {
                NavigationStack {
                    ZStack(alignment: .top) {
                        TarsTheme.bg0.ignoresSafeArea()
                        detail
                            .safeAreaInset(edge: .top) { ModeBanner() }
                    }
                    .navigationDestination(for: String.self) { symbol in
                        SymbolDetailView(symbol: symbol)
                            .background(TarsTheme.bg0)
                    }
                }
            }
            .tint(TarsTheme.accent)

            tarsButton

            LaunchOverlay(isPresented: $showLaunch)
        }
        .sheet(isPresented: $showTars) {
            TarsPanelView()
                .presentationDetents([.large, .medium])
                .presentationBackground(TarsTheme.bg1)
        }
        .sheet(item: $store.pendingThesisCapture) { entry in
            ThesisCaptureSheet(entry: entry)
                .presentationDetents([.medium])
                .presentationBackground(TarsTheme.bg1)
        }
        .onAppear {
            agentLab.connect(trading: store)
            alertEngine.start(store: store)
            Sound.enabled = prefs.soundOn
        }
    }

    private var sidebar: some View {
        List(visibleSections, selection: Binding(get: { section },
                                                 set: { section = $0 ?? .terminal })) { s in
            Label(s.rawValue, systemImage: s.icon).tag(s)
        }
        .navigationTitle("Tars Trading")
        .listStyle(.sidebar)
    }

    /// Simple mode hides the pro surfaces until the user grows into them.
    private var visibleSections: [Section] {
        prefs.complexity == .simple
            ? [.terminal, .portfolio, .academy, .journal, .settings]
            : Section.allCases
    }

    @ViewBuilder
    private var detail: some View {
        switch section {
        case .terminal: WorkspaceView()
        case .portfolio: PortfolioView()
        case .academy: AcademyHomeView()
        case .agents: AgentLabView()
        case .journal: JournalView()
        case .screener: ScreenerView()
        case .alerts: AlertsView(engine: alertEngine)
        case .settings: SettingsView()
        }
    }

    /// Tars is everywhere: floating orb, bottom trailing.
    private var tarsButton: some View {
        VStack {
            Spacer()
            HStack {
                Spacer()
                Button {
                    showTars = true
                    Haptics.tap()
                } label: {
                    TarsAvatar(size: 54, thinking: tars.isStreaming)
                        .background(
                            Circle().fill(TarsTheme.bg2)
                                .shadow(color: TarsTheme.accent.opacity(0.35), radius: 14))
                }
                .buttonStyle(PressableStyle())
                .accessibilityLabel("Ask Tars, your trading mentor")
                .padding(TarsTheme.Space.xl)
            }
        }
    }
}
