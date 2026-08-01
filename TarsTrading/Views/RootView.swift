import SwiftUI

/// App shell v3, adaptive by size class:
/// - Regular (iPad): slim icon rail + full workspace, Tars docked at the
///   rail's foot, ⌘K palette, the P&L aurora breathing behind everything.
/// - Compact (iPhone): a designed five-tab experience (Trade, Portfolio,
///   Academy, Tars, More) — one-hand reachable, PAPER capsule always pinned.
/// The iPhone app is designed, not shrunk.
struct RootView: View {
    @Environment(TradingStore.self) private var store
    @Environment(TarsStore.self) private var tars
    @Environment(AgentLab.self) private var agentLab
    @Environment(PreferencesStore.self) private var prefs
    @Environment(\.horizontalSizeClass) private var hSizeClass

    enum Section: String, CaseIterable, Identifiable {
        case markets = "Markets"
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
            case .markets: "globe"
            case .terminal: "chart.xyaxis.line"
            case .portfolio: "briefcase"
            case .academy: "graduationcap"
            case .agents: "brain.head.profile"
            case .journal: "book.closed"
            case .screener: "line.3.horizontal.decrease.circle"
            case .alerts: "bell.badge"
            case .settings: "gearshape"
            }
        }
    }

    /// iPhone tab set. Everything else is one level in, inside More.
    // Exactly FIVE tabs. A sixth makes iOS fold the overflow into a
    // system "More" list, which is where the phantom back-chevrons on
    // root tabs came from. Trade is gone — Markets IS trading.
    enum CompactTab: String, CaseIterable, Identifiable {
        case markets = "Markets"
        case tars = "Tars"
        case portfolio = "Portfolio"
        case academy = "Academy"
        case more = "More"
        var id: String { rawValue }
        var label: String { self == .tars ? "Assistant" : rawValue }
        var icon: String {
            switch self {
            case .markets: "globe"
            case .portfolio: "briefcase"
            case .academy: "graduationcap"
            case .tars: "bubble.left.and.text.bubble.right"
            case .more: "ellipsis.circle"
            }
        }
    }

    // Relaunch resumes where the user left off, not back at the terminal.
    @State private var section: Section =
        Section(rawValue: UserDefaults.standard.string(forKey: "root.section") ?? "") ?? .markets
    @State private var tab: CompactTab =
        CompactTab(rawValue: UserDefaults.standard.string(forKey: "root.tab") ?? "") ?? .markets
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

            if hSizeClass == .compact {
                compactShell
            } else {
                regularShell
            }

            ErrorToast()

            LaunchOverlay(isPresented: $showLaunch)
        }
        .tint(TarsTheme.accent)
        .sheet(isPresented: $showTars) {
            // The desk manager — the same assistant as the phone tab and
            // the web, not the retired mentor panel.
            NavigationStack { AssistantView() }
                .presentationDetents([.large, .medium])
                .presentationBackground(TarsTheme.bg1)
        }
        .sheet(isPresented: $showPalette) {
            CommandPalette { destination in
                showPalette = false
                switch destination {
                case .section(let s):
                    section = s
                    if hSizeClass == .compact { tab = CompactTab(matching: s) }
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
        .onChange(of: section) { _, s in UserDefaults.standard.set(s.rawValue, forKey: "root.section") }
        .onChange(of: tab) { _, t in UserDefaults.standard.set(t.rawValue, forKey: "root.tab") }
        .onAppear {
            agentLab.connect(trading: store)
            alertEngine.start(store: store)
            Sound.enabled = prefs.soundOn
            Haptics.enabled = prefs.hapticsOn
        }
        .environment(\.alertEngine, alertEngine)
    }

    // MARK: - Regular shell (iPad rail + detail)

    private var regularShell: some View {
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
    }

    // MARK: - Compact shell (iPhone five-tab)

    private var compactShell: some View {
        TabView(selection: $tab) {
            // The desk's front page leads — the same IA as the web terminal.
            compactStack(.markets) { MarketsHomeView() }
                .tabItem { Label(CompactTab.markets.label, systemImage: CompactTab.markets.icon) }
                .tag(CompactTab.markets)

            // The desk manager rides second — conversation is a first-class
            // way to trade here.
            compactStack(.tars) { AssistantView() }
                .tabItem { Label(CompactTab.tars.label, systemImage: CompactTab.tars.icon) }
                .tag(CompactTab.tars)

            compactStack(.portfolio) { DeskView() }
                .tabItem { Label(CompactTab.portfolio.label, systemImage: CompactTab.portfolio.icon) }
                .tag(CompactTab.portfolio)

            compactStack(.academy) { AcademyHomeView() }
                .tabItem { Label(CompactTab.academy.label, systemImage: CompactTab.academy.icon) }
                .tag(CompactTab.academy)

            compactStack(.more) { MoreHomeView(alertEngine: alertEngine) }
                .tabItem { Label(CompactTab.more.rawValue, systemImage: CompactTab.more.icon) }
                .tag(CompactTab.more)
        }
        .toolbarBackground(.visible, for: .tabBar)
    }

    /// Shared chrome for compact tabs: nav stack, pinned PAPER capsule,
    /// symbol destinations, and the global search entry point.
    private func compactStack<Content: View>(_ tab: CompactTab,
                                             @ViewBuilder content: () -> Content) -> some View {
        NavigationStack {
            content()
                .background(Color.clear)
                .safeAreaInset(edge: .top) { ModeBanner(compact: true) }
                .navigationDestination(for: String.self) { symbol in
                    SymbolDetailView(symbol: symbol)
                        .background(TarsTheme.bg0)
                }
                .toolbar {
                    ToolbarItem(placement: .topBarTrailing) {
                        Button {
                            Haptics.tap()
                            showPalette = true
                        } label: {
                            Image(systemName: "magnifyingglass")
                        }
                        .accessibilityLabel("Search symbols and sections")
                    }
                }
        }
    }

    // MARK: - Icon rail

    private var rail: some View {
        VStack(spacing: TarsTheme.Space.s) {
            TarsApexMark(size: 24)
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
                Image(systemName: "bubble.left.and.text.bubble.right")
                    .font(.system(size: 17, weight: .medium))
                    .foregroundStyle(TarsTheme.accent)
                    .frame(width: 44, height: 44)
                    .background(
                        Circle().fill(TarsTheme.bg2)
                            .overlay(Circle().strokeBorder(TarsTheme.hairline, lineWidth: 1)))
            }
            .buttonStyle(PressableStyle())
            .accessibilityLabel("Ask Tars, your trading mentor")

            railButton(.settings)
                .padding(.bottom, TarsTheme.Space.l)
        }
        .frame(width: 74)
        .background(.ultraThinMaterial)
        .background(TarsTheme.bg1.opacity(0.55))
        .overlay(alignment: .trailing) {
            Rectangle().fill(TarsTheme.hairline).frame(width: 1)
        }
    }

    private var mainSections: [Section] {
        let all: [Section] = prefs.complexity == .simple
            ? [.markets, .portfolio, .academy, .journal]
            : [.markets, .portfolio, .academy, .agents, .journal, .screener, .alerts]
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
                .font(TarsTheme.Text.micro)
                .lineLimit(1)
                .minimumScaleFactor(0.8)
        }
        .foregroundStyle(selected ? TarsTheme.accent : TarsTheme.inkTertiary)
        .frame(width: 62, height: 52)
        .background(
            RoundedRectangle(cornerRadius: TarsTheme.Radius.m, style: .continuous)
                .fill(selected ? TarsTheme.selectionWash(TarsTheme.accent) : .clear)
        )
        .contentShape(Rectangle())
    }

    @ViewBuilder
    private var detail: some View {
        switch section {
        case .markets: MarketsTerminal()
        case .terminal: MarketsTerminal()
        case .portfolio: DeskView()
        case .academy: AcademyHomeView()
        case .agents: AgentLabView()
        case .journal: JournalView()
        case .screener: ScreenerView()
        case .alerts: AlertsView(engine: alertEngine)
        case .settings: SettingsView()
        }
    }
}

/// The iPad terminal: the board docked left, the market you're working
/// on filling the room. Selection, not navigation — a desk keeps its
/// papers side by side instead of stacking them.
private struct MarketsTerminal: View {
    @State private var symbol = "SPY"

    var body: some View {
        HStack(spacing: 0) {
            MarketsHomeView(onSelect: { symbol = $0 })
                .frame(width: 400)
            Divider().overlay(TarsTheme.hairline)
            NavigationStack {
                MarketSymbolView(symbol: symbol)
                    .background(TarsTheme.bg0)
            }
            .id(symbol)
        }
        .background(TarsTheme.bg0)
    }
}

private extension RootView.CompactTab {
    /// Best-effort mapping when the ⌘K palette targets an iPad section.
    init(matching section: RootView.Section) {
        switch section {
        case .markets: self = .markets
        case .terminal: self = .markets
        case .portfolio: self = .portfolio
        case .academy: self = .academy
        default: self = .more
        }
    }
}

// MARK: - More (iPhone level-two home)

/// The quiet home for everything that didn't earn a tab: agents, screener,
/// alerts, journal, settings. Designed rows, not an afterthought list.
private struct MoreHomeView: View {
    let alertEngine: AlertEngine
    @Environment(PreferencesStore.self) private var prefs

    private struct Row: Identifiable {
        let section: RootView.Section
        let subtitle: String
        var id: String { section.id }
    }

    private var rows: [Row] {
        var r: [Row] = []
        if prefs.complexity != .simple {
            r.append(Row(section: .agents, subtitle: "Design, backtest, and run paper agents"))
            r.append(Row(section: .screener, subtitle: "Find symbols by what they're doing"))
            r.append(Row(section: .alerts, subtitle: "Price and condition alerts"))
        }
        r.append(Row(section: .journal, subtitle: "Your trades, your reasoning"))
        r.append(Row(section: .settings, subtitle: "Mode, sounds, disclosures"))
        return r
    }

    var body: some View {
        ScrollView {
            VStack(spacing: TarsTheme.Space.m) {
                ForEach(rows) { row in
                    NavigationLink {
                        destination(for: row.section)
                            .background(TarsTheme.bg0)
                    } label: {
                        HStack(spacing: TarsTheme.Space.l) {
                            Image(systemName: row.section.icon)
                                .font(.system(size: 18, weight: .medium))
                                .foregroundStyle(TarsTheme.inkSecondary)
                                .frame(width: 30)
                            VStack(alignment: .leading, spacing: 2) {
                                Text(row.section.rawValue)
                                    .font(TarsTheme.Text.body.weight(.semibold))
                                    .foregroundStyle(TarsTheme.inkPrimary)
                                Text(row.subtitle)
                                    .font(TarsTheme.Text.caption)
                                    .foregroundStyle(TarsTheme.inkTertiary)
                                    .lineLimit(1)
                            }
                            Spacer()
                            Image(systemName: "chevron.right")
                                .font(TarsTheme.Text.caption)
                                .foregroundStyle(TarsTheme.inkQuaternary)
                        }
                        .padding(.vertical, TarsTheme.Space.m)
                        .frame(minHeight: TarsTheme.Metrics.rowPrimary)
                        .contentShape(Rectangle())
                    }
                    .buttonStyle(PressableStyle())
                    Divider().overlay(TarsTheme.hairline)
                }
            }
            .padding(TarsTheme.Space.l)
            .padding(.bottom, 72)
        }
        .background(TarsTheme.bg0)
        .navigationTitle("More")
        .navigationBarTitleDisplayMode(.inline)
    }

    @ViewBuilder
    private func destination(for section: RootView.Section) -> some View {
        switch section {
        case .agents: AgentLabView()
        case .screener: ScreenerView()
        case .alerts: AlertsView(engine: alertEngine)
        case .journal: JournalView()
        case .settings: SettingsView()
        default: EmptyView()
        }
    }
}

// MARK: - Global error toast

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
                .tarsFloatingGlass(radius: TarsTheme.Radius.capsule)
                .overlay(
                    Capsule().strokeBorder(TarsTheme.warning.opacity(0.4), lineWidth: 1))
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
