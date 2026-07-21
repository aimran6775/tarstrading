import SwiftUI

/// App shell v2: a slim icon rail (not a third of the screen), the P&L aurora
/// breathing behind everything, Tars docked at the rail's foot instead of
/// floating over content, a global error toast, onboarding on first launch,
/// and ⌘K search from anywhere.
struct RootView: View {
    @Environment(TradingStore.self) private var store
    @Environment(TarsStore.self) private var tars
    @Environment(AgentLab.self) private var agentLab
    @Environment(PreferencesStore.self) private var prefs

    enum Section: String, CaseIterable, Identifiable {
        case terminal = "Terminal"
        case portfolio = "Portfolio"
        case academy = "Academy"
        case agents = "Agents"
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
    @State private var showPalette = false
    @State private var paletteSymbol: PaletteSymbol?
    @State private var alertEngine = AlertEngine()
    @AppStorage("hasOnboarded") private var hasOnboarded = false

    private struct PaletteSymbol: Identifiable {
        let symbol: String
        var id: String { symbol }
    }

    var body: some View {
        @Bindable var store = store
        ZStack {
            TarsTheme.bg0.ignoresSafeArea()
            TarsTheme.aurora(for: store.account.dayPnL)
                .ignoresSafeArea()
                .animation(Motion.grand, value: store.account.dayPnL > 0)

            HStack(spacing: 0) {
                rail
                NavigationStack {
                    detail
                        .safeAreaInset(edge: .top) { ModeBanner() }
                        .background(Color.clear)
                        .navigationDestination(for: String.self) { symbol in
                            SymbolDetailView(symbol: symbol)
                                .background(TarsTheme.bg0)
                        }
                }
            }

            ErrorToast()

            LaunchOverlay(isPresented: $showLaunch)
        }
        .tint(TarsTheme.accent)
        .sheet(isPresented: $showTars) {
            TarsPanelView()
                .presentationDetents([.large, .medium])
                .presentationBackground(TarsTheme.bg1)
        }
        .sheet(isPresented: $showPalette) {
            CommandPalette { destination in
                showPalette = false
                switch destination {
                case .section(let s): section = s
                case .symbol(let symbol): paletteSymbol = PaletteSymbol(symbol: symbol)
                }
            }
            .presentationDetents([.medium, .large])
            .presentationBackground(TarsTheme.bg1)
        }
        .sheet(item: $paletteSymbol) { wrapped in
            NavigationStack {
                SymbolDetailView(symbol: wrapped.symbol)
                    .background(TarsTheme.bg0)
            }
            .presentationBackground(TarsTheme.bg0)
        }
        .sheet(item: $store.pendingThesisCapture) { entry in
            ThesisCaptureSheet(entry: entry)
                .presentationDetents([.medium])
                .presentationBackground(TarsTheme.bg1)
        }
        .fullScreenCover(isPresented: .init(get: { !hasOnboarded && !showLaunch },
                                            set: { _ in })) {
            OnboardingView { hasOnboarded = true }
        }
        .onAppear {
            agentLab.connect(trading: store)
            alertEngine.start(store: store)
            Sound.enabled = prefs.soundOn
        }
        .environment(\.alertEngine, alertEngine)
    }

    // MARK: - Icon rail

    private var rail: some View {
        VStack(spacing: TarsTheme.Space.s) {
            TarsAvatar(size: 30, thinking: false)
                .padding(.top, TarsTheme.Space.l)
                .padding(.bottom, TarsTheme.Space.s)
                .accessibilityHidden(true)

            ForEach(mainSections) { s in
                railButton(s)
            }

            // ⌘K search — the global way in.
            Button {
                Haptics.tap()
                showPalette = true
            } label: {
                railIcon("magnifyingglass", label: "Search", selected: false)
            }
            .buttonStyle(PressableStyle())
            .keyboardShortcut("k", modifiers: .command)
            .accessibilityLabel("Search symbols and sections")

            Spacer()

            // Tars, docked — never floating over content again.
            Button {
                Haptics.tap()
                showTars = true
            } label: {
                TarsAvatar(size: 40, thinking: tars.isStreaming)
                    .background(
                        Circle().fill(TarsTheme.bg2)
                            .shadow(color: TarsTheme.accent.opacity(0.30), radius: 10))
            }
            .buttonStyle(PressableStyle())
            .accessibilityLabel("Ask Tars, your trading mentor")

            railButton(.settings)
                .padding(.bottom, TarsTheme.Space.l)
        }
        .frame(width: 74)
        .background(TarsTheme.bg1.opacity(0.85))
        .overlay(alignment: .trailing) {
            Rectangle().fill(TarsTheme.hairline).frame(width: 1)
        }
    }

    private var mainSections: [Section] {
        let all: [Section] = prefs.complexity == .simple
            ? [.terminal, .portfolio, .academy, .journal]
            : [.terminal, .portfolio, .academy, .agents, .journal, .screener, .alerts]
        return all
    }

    private func railButton(_ s: Section) -> some View {
        Button {
            guard section != s else { return }
            Haptics.tap()
            withAnimation(Motion.snappy) { section = s }
        } label: {
            railIcon(s.icon, label: s.rawValue, selected: section == s)
        }
        .buttonStyle(PressableStyle())
        .accessibilityLabel(s.rawValue)
        .accessibilityAddTraits(section == s ? .isSelected : [])
    }

    private func railIcon(_ systemImage: String, label: String, selected: Bool) -> some View {
        VStack(spacing: 3) {
            Image(systemName: systemImage)
                .font(.system(size: 19, weight: .medium))
                .symbolRenderingMode(.hierarchical)
            Text(label)
                .font(.system(size: 9, weight: .semibold))
                .lineLimit(1)
                .minimumScaleFactor(0.8)
        }
        .foregroundStyle(selected ? TarsTheme.accent : TarsTheme.inkTertiary)
        .frame(width: 62, height: 52)
        .background(
            RoundedRectangle(cornerRadius: TarsTheme.Radius.m, style: .continuous)
                .fill(selected ? TarsTheme.accent.opacity(0.14) : .clear)
        )
        .contentShape(Rectangle())
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
}

// MARK: - Global error toast (gap: errors died silently outside Positions)

private struct ErrorToast: View {
    @Environment(TradingStore.self) private var store
    @State private var dismissTask: Task<Void, Never>?

    var body: some View {
        VStack {
            if let error = store.lastError {
                HStack(spacing: TarsTheme.Space.s) {
                    Image(systemName: "exclamationmark.triangle.fill")
                        .foregroundStyle(TarsTheme.warning)
                    Text(error.errorDescription ?? "Something went sideways.")
                        .font(TarsTheme.Text.caption)
                        .foregroundStyle(TarsTheme.inkPrimary)
                        .lineLimit(2)
                    Button {
                        withAnimation(Motion.snappy) { store.lastError = nil }
                    } label: {
                        Image(systemName: "xmark.circle.fill")
                            .foregroundStyle(TarsTheme.inkTertiary)
                    }
                    .accessibilityLabel("Dismiss error")
                }
                .padding(.horizontal, TarsTheme.Space.l)
                .padding(.vertical, TarsTheme.Space.m)
                .background(
                    Capsule().fill(TarsTheme.bg3)
                        .overlay(Capsule().strokeBorder(TarsTheme.warning.opacity(0.4), lineWidth: 1))
                        .shadow(color: .black.opacity(0.4), radius: 12, y: 4))
                .padding(.top, 52)
                .transition(.move(edge: .top).combined(with: .opacity))
                .onAppear {
                    dismissTask?.cancel()
                    dismissTask = Task {
                        try? await Task.sleep(for: .seconds(6))
                        guard !Task.isCancelled else { return }
                        withAnimation(Motion.spatial) { store.lastError = nil }
                    }
                }
            }
            Spacer()
        }
        .animation(Motion.spatial, value: store.lastError == nil)
        .allowsHitTesting(store.lastError != nil)
    }
}

// MARK: - AlertEngine environment plumbing

private struct AlertEngineKey: EnvironmentKey {
    static let defaultValue: AlertEngine? = nil
}

extension EnvironmentValues {
    var alertEngine: AlertEngine? {
        get { self[AlertEngineKey.self] }
        set { self[AlertEngineKey.self] = newValue }
    }
}
