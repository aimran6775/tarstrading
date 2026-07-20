import SwiftUI
import UniformTypeIdentifiers

/// Settings: appearance, mode honesty, journal prompts, Tars engine,
/// backup, danger zone, disclosures.
/// Calm and legible — the one screen where nothing should ever surprise you.
public struct SettingsView: View {
    @Environment(PreferencesStore.self) private var prefs
    @Environment(TradingStore.self) private var trading
    @Environment(TarsStore.self) private var tars
    @Environment(AcademyProgress.self) private var academy

    @State private var confirmClearJournal = false
    @State private var confirmClearAcademy = false
    @State private var confirmClearTars = false
    @State private var showImporter = false
    @State private var restoreMessage: String?

    @AppStorage("thesisPromptMode")
    private var thesisPromptModeRaw = TradingStore.ThesisPromptMode.closesOnly.rawValue

    public init() {}

    public var body: some View {
        ScrollView {
            VStack(spacing: TarsTheme.Space.l) {
                appearanceCard
                modeCard
                journalCard
                tarsCard
                backupCard
                dangerCard
                aboutCard
            }
            .frame(maxWidth: 680)
            .padding(TarsTheme.Space.xl)
            .frame(maxWidth: .infinity)
        }
        .background(TarsTheme.bg0)
        .navigationTitle("Settings")
        .onAppear { Sound.enabled = prefs.soundOn }
        .onChange(of: prefs.soundOn) { _, on in
            Sound.enabled = on
            if on { Sound.orderStaged.play() }
        }
        .fileImporter(isPresented: $showImporter,
                      allowedContentTypes: [.json]) { result in
            switch result {
            case .success(let url): restoreBackup(from: url)
            case .failure: restoreMessage = "Couldn't open that file. Nothing was changed."
            }
        }
        .alert("Import backup",
               isPresented: Binding(get: { restoreMessage != nil },
                                    set: { if !$0 { restoreMessage = nil } })) {
            Button("OK", role: .cancel) {}
        } message: {
            Text(restoreMessage ?? "")
        }
    }

    // MARK: - Appearance

    private var appearanceCard: some View {
        @Bindable var prefs = prefs
        return SettingsCard(title: "Appearance", icon: "paintbrush.fill") {
            VStack(alignment: .leading, spacing: TarsTheme.Space.m) {
                Text("Complexity")
                    .font(TarsTheme.Text.caption)
                    .foregroundStyle(TarsTheme.inkSecondary)
                Picker("Complexity", selection: $prefs.complexity.animation(Motion.snappy)) {
                    ForEach(PreferencesStore.ComplexityMode.allCases) { mode in
                        Text(mode.rawValue).tag(mode)
                    }
                }
                .pickerStyle(.segmented)
                .onChange(of: prefs.complexity) { _, _ in Haptics.tick() }

                Text(prefs.complexity == .simple
                     ? "Simple keeps the essentials: stocks, watchlist, portfolio, Academy, journal. The Agent Lab, options chains, and advanced order types stay tucked away until you want them. Nothing is deleted — just quieter."
                     : "Pro shows everything: the Agent Lab, options, brackets, every order type. If the terminal starts feeling like a cockpit you didn't ask for, Simple is one tap away.")
                    .font(TarsTheme.Text.body)
                    .foregroundStyle(TarsTheme.inkSecondary)
                    .fixedSize(horizontal: false, vertical: true)
                    .animation(Motion.snappy, value: prefs.complexity)

                Divider().overlay(TarsTheme.hairline)

                HStack(alignment: .top, spacing: TarsTheme.Space.m) {
                    Image(systemName: "moon.fill")
                        .font(TarsTheme.Text.body)
                        .foregroundStyle(TarsTheme.inkSecondary)
                        .frame(width: 22)
                    VStack(alignment: .leading, spacing: 2) {
                        Text("Appearance")
                            .font(TarsTheme.Text.body)
                            .foregroundStyle(TarsTheme.inkPrimary)
                        Text("Light mode ships the day it can be shipped proudly. That day is not today.")
                            .font(TarsTheme.Text.caption)
                            .foregroundStyle(TarsTheme.inkTertiary)
                            .fixedSize(horizontal: false, vertical: true)
                    }
                    Spacer()
                    Text("Dark, by design")
                        .font(TarsTheme.Text.caption)
                        .foregroundStyle(TarsTheme.inkSecondary)
                }
                .accessibilityElement(children: .combine)

                SettingsToggleRow(icon: "speaker.wave.2.fill", title: "Sound",
                                  subtitle: "Short cues for fills, alerts, and achievements.",
                                  isOn: $prefs.soundOn)
                SettingsToggleRow(icon: "iphone.radiowaves.left.and.right", title: "Haptics",
                                  subtitle: "Physical feedback on ticks, confirms, and fills.",
                                  isOn: $prefs.hapticsOn)
            }
        }
    }

    // MARK: - Mode

    private var modeCard: some View {
        SettingsCard(title: "Trading Mode", icon: "shippingbox.fill") {
            VStack(alignment: .leading, spacing: TarsTheme.Space.m) {
                HStack(spacing: TarsTheme.Space.s) {
                    Text(trading.mode.badgeText)
                        .font(TarsTheme.Text.micro)
                        .kerning(2)
                        .foregroundStyle(TarsTheme.paperBadge)
                        .padding(.horizontal, TarsTheme.Space.m)
                        .padding(.vertical, 5)
                        .background(
                            Capsule()
                                .fill(TarsTheme.paperBadge.opacity(0.12))
                                .overlay(Capsule().strokeBorder(
                                    TarsTheme.paperBadge.opacity(0.35), lineWidth: 1)))
                    Text(trading.mode == .demo ? "Demo market" : "Alpaca paper account")
                        .font(TarsTheme.Text.heading)
                        .foregroundStyle(TarsTheme.inkPrimary)
                }

                Text(trading.mode == .demo
                     ? "You're trading a fully simulated market that lives on this iPad. Prices move realistically but are generated locally — no network, no keys, no real money. Perfect for learning the controls without consequences."
                     : "You're connected to an Alpaca paper account: real market plumbing, simulated money. Orders route through Alpaca's paper API and fill against real quotes — but no actual dollars ever move.")
                    .font(TarsTheme.Text.body)
                    .foregroundStyle(TarsTheme.inkSecondary)
                    .fixedSize(horizontal: false, vertical: true)

                Divider().overlay(TarsTheme.hairline)

                VStack(alignment: .leading, spacing: TarsTheme.Space.s) {
                    Label("Connecting Alpaca paper keys", systemImage: "key.fill")
                        .font(TarsTheme.Text.caption)
                        .foregroundStyle(TarsTheme.inkPrimary)
                    Text("Keys are never typed into the app — no field here will ever ask for them. Copy Config/Secrets.example.swift to Config/Secrets.swift in the Xcode project, fill in your Alpaca paper key ID and secret (and optionally a Massive market-data key), then rebuild. The app detects them at launch and switches to paper mode automatically.")
                        .font(TarsTheme.Text.body)
                        .foregroundStyle(TarsTheme.inkSecondary)
                        .fixedSize(horizontal: false, vertical: true)
                    Text("Config/Secrets.swift")
                        .font(TarsTheme.Text.mono)
                        .foregroundStyle(TarsTheme.accent)
                        .padding(.horizontal, TarsTheme.Space.m)
                        .padding(.vertical, TarsTheme.Space.s)
                        .background(
                            RoundedRectangle(cornerRadius: TarsTheme.Radius.s, style: .continuous)
                                .fill(TarsTheme.bg3))
                }

                HStack(alignment: .top, spacing: TarsTheme.Space.s) {
                    Image(systemName: "clock.badge.exclamationmark")
                        .font(TarsTheme.Text.caption)
                        .foregroundStyle(TarsTheme.warning)
                    Text("Honesty note: the free Massive data tier allows 5 requests per minute, so live quotes are cached and can run minutes stale. Every price in the app shows its age rather than pretending to be live. Slow truth beats fast fiction.")
                        .font(TarsTheme.Text.caption)
                        .foregroundStyle(TarsTheme.inkSecondary)
                        .fixedSize(horizontal: false, vertical: true)
                }
                .padding(TarsTheme.Space.m)
                .background(
                    RoundedRectangle(cornerRadius: TarsTheme.Radius.s, style: .continuous)
                        .fill(TarsTheme.warning.opacity(0.08)))
            }
        }
    }

    // MARK: - Journal prompts

    private var thesisPromptMode: Binding<TradingStore.ThesisPromptMode> {
        Binding(get: { TradingStore.ThesisPromptMode(rawValue: thesisPromptModeRaw) ?? .closesOnly },
                set: { thesisPromptModeRaw = $0.rawValue })
    }

    private var journalCard: some View {
        SettingsCard(title: "Journal", icon: "square.and.pencil") {
            VStack(alignment: .leading, spacing: TarsTheme.Space.m) {
                Text("Thesis prompts")
                    .font(TarsTheme.Text.caption)
                    .foregroundStyle(TarsTheme.inkSecondary)
                Picker("Thesis prompts", selection: thesisPromptMode.animation(Motion.snappy)) {
                    ForEach(TradingStore.ThesisPromptMode.allCases) { mode in
                        Text(mode.rawValue).tag(mode)
                    }
                }
                .pickerStyle(.segmented)
                .onChange(of: thesisPromptModeRaw) { _, _ in Haptics.tick() }

                Text(thesisPromptFootnote)
                    .font(TarsTheme.Text.caption)
                    .foregroundStyle(TarsTheme.inkTertiary)
                    .fixedSize(horizontal: false, vertical: true)
                    .animation(Motion.snappy, value: thesisPromptModeRaw)
            }
        }
    }

    private var thesisPromptFootnote: String {
        switch thesisPromptMode.wrappedValue {
        case .always:
            return "Every fill asks for a thesis — entries and exits alike. Maximum discipline, maximum interruptions."
        case .closesOnly:
            return "You're asked to write only when a position closes — the moment the result is in and the lesson is freshest. Entries still land in the journal; the thesis field just waits for you."
        case .never:
            return "No prompts, ever. Trades still record themselves in the journal; whether any thinking gets written down is entirely on you."
        }
    }

    // MARK: - Tars

    private var tarsCard: some View {
        SettingsCard(title: "Tars", icon: "brain.head.profile") {
            VStack(alignment: .leading, spacing: TarsTheme.Space.m) {
                HStack(spacing: TarsTheme.Space.s) {
                    Circle()
                        .fill(CloudTarsEngine.isConfigured ? TarsTheme.gain : TarsTheme.accent)
                        .frame(width: 8, height: 8)
                    Text(CloudTarsEngine.isConfigured ? "Cloud model" : "Offline mentor")
                        .font(TarsTheme.Text.body)
                        .foregroundStyle(TarsTheme.inkPrimary)
                    Spacer()
                    Text("Engine")
                        .font(TarsTheme.Text.caption)
                        .foregroundStyle(TarsTheme.inkTertiary)
                }
                Text(CloudTarsEngine.isConfigured
                     ? "Tars is running on a cloud model, with the offline mentor as a fallback when the network isn't cooperating."
                     : "Tars is running fully on-device: a rule-based mentor with a solid glossary and opinions about your journal. No network required, no data leaves the iPad.")
                    .font(TarsTheme.Text.caption)
                    .foregroundStyle(TarsTheme.inkSecondary)
                    .fixedSize(horizontal: false, vertical: true)

                Divider().overlay(TarsTheme.hairline)

                Button {
                    confirmClearTars = true
                } label: {
                    HStack {
                        Label("Clear conversation", systemImage: "bubble.left.and.exclamationmark.bubble.right")
                            .font(TarsTheme.Text.body)
                            .foregroundStyle(TarsTheme.inkPrimary)
                        Spacer()
                        Text("\(tars.messages.count) message\(tars.messages.count == 1 ? "" : "s")")
                            .font(TarsTheme.Text.priceSmall)
                            .foregroundStyle(TarsTheme.inkTertiary)
                    }
                }
                .buttonStyle(PressableStyle())
                .disabled(tars.messages.isEmpty)
                .opacity(tars.messages.isEmpty ? 0.4 : 1)
                .confirmationDialog("Clear the conversation with Tars?",
                                    isPresented: $confirmClearTars, titleVisibility: .visible) {
                    Button("Clear conversation", role: .destructive) {
                        withAnimation(Motion.fluid) { tars.clearHistory() }
                        Haptics.warning()
                    }
                } message: {
                    Text("Tars won't take it personally. He doesn't take anything personally.")
                }
            }
        }
    }

    // MARK: - Backup & export

    private var backupCard: some View {
        SettingsCard(title: "Backup & Export", icon: "externaldrive.fill") {
            VStack(alignment: .leading, spacing: TarsTheme.Space.m) {
                Text("Everything in this app — journal, agents, backtests, Academy progress, watchlist, and every word Tars has said — lives on this iPad and nowhere else. Nothing syncs. Delete the app and it all goes with it, unless you've exported it first.")
                    .font(TarsTheme.Text.body)
                    .foregroundStyle(TarsTheme.inkSecondary)
                    .fixedSize(horizontal: false, vertical: true)

                Divider().overlay(TarsTheme.hairline)

                ShareLink(item: TarsBackupFile(),
                          preview: SharePreview("Tars Trading backup")) {
                    HStack(alignment: .top, spacing: TarsTheme.Space.m) {
                        Image(systemName: "square.and.arrow.up")
                            .font(TarsTheme.Text.body)
                            .foregroundStyle(TarsTheme.accent)
                            .frame(width: 22)
                        VStack(alignment: .leading, spacing: 2) {
                            Text("Export everything")
                                .font(TarsTheme.Text.body)
                                .foregroundStyle(TarsTheme.inkPrimary)
                            Text("One JSON file with all of it. Keep it somewhere sensible.")
                                .font(TarsTheme.Text.caption)
                                .foregroundStyle(TarsTheme.inkTertiary)
                                .fixedSize(horizontal: false, vertical: true)
                        }
                        Spacer()
                    }
                    .contentShape(Rectangle())
                }
                .buttonStyle(PressableStyle())

                Divider().overlay(TarsTheme.hairline)

                Button {
                    showImporter = true
                } label: {
                    HStack(alignment: .top, spacing: TarsTheme.Space.m) {
                        Image(systemName: "square.and.arrow.down")
                            .font(TarsTheme.Text.body)
                            .foregroundStyle(TarsTheme.accent)
                            .frame(width: 22)
                        VStack(alignment: .leading, spacing: 2) {
                            Text("Import backup")
                                .font(TarsTheme.Text.body)
                                .foregroundStyle(TarsTheme.inkPrimary)
                            Text("Restores a previous export, overwriting what's here now. A restart afterwards loads everything.")
                                .font(TarsTheme.Text.caption)
                                .foregroundStyle(TarsTheme.inkTertiary)
                                .fixedSize(horizontal: false, vertical: true)
                        }
                        Spacer()
                    }
                    .contentShape(Rectangle())
                }
                .buttonStyle(PressableStyle())
            }
        }
    }

    private func restoreBackup(from url: URL) {
        let secured = url.startAccessingSecurityScopedResource()
        defer { if secured { url.stopAccessingSecurityScopedResource() } }

        guard let data = try? Data(contentsOf: url),
              let combined = (try? JSONSerialization.jsonObject(with: data)) as? [String: Any],
              !combined.isEmpty else {
            restoreMessage = "That doesn't look like a Tars Trading backup. Nothing was changed."
            return
        }

        var restored = 0
        for (key, value) in combined {
            // Filenames come from the backup — accept plain alphanumeric keys only.
            guard !key.isEmpty, key.allSatisfy({ $0.isLetter || $0.isNumber }),
                  let entry = try? JSONSerialization.data(withJSONObject: value,
                                                          options: [.fragmentsAllowed]) else { continue }
            let dest = Persistence.directory.appending(path: "\(key).json")
            if (try? entry.write(to: dest, options: .atomic)) != nil { restored += 1 }
        }

        if restored > 0 {
            Haptics.tick()
            restoreMessage = "Restored — restart the app to load everything."
        } else {
            restoreMessage = "That backup had nothing this app could restore. Nothing was changed."
        }
    }

    // MARK: - Danger zone

    private var dangerCard: some View {
        SettingsCard(title: "Danger Zone", icon: "exclamationmark.triangle.fill",
                     tint: TarsTheme.loss) {
            VStack(alignment: .leading, spacing: TarsTheme.Space.m) {
                Button {
                    confirmClearJournal = true
                } label: {
                    SettingsDangerRow(title: "Clear journal",
                                      subtitle: "Deletes every trade note and thesis. Your account and positions are untouched.",
                                      count: trading.journal.count)
                }
                .buttonStyle(PressableStyle())
                .disabled(trading.journal.isEmpty)
                .opacity(trading.journal.isEmpty ? 0.4 : 1)
                .confirmationDialog("Delete all journal entries?",
                                    isPresented: $confirmClearJournal, titleVisibility: .visible) {
                    Button("Delete \(trading.journal.count) \(trading.journal.count == 1 ? "entry" : "entries")", role: .destructive) {
                        withAnimation(Motion.fluid) { trading.journal.removeAll() }
                        Persistence().save([JournalEntry](), "journal")
                        Haptics.warning()
                    }
                } message: {
                    Text("The journal is where the learning lives. This cannot be undone.")
                }

                Divider().overlay(TarsTheme.hairline)

                Button {
                    confirmClearAcademy = true
                } label: {
                    SettingsDangerRow(title: "Reset Academy progress",
                                      subtitle: "Clears lessons, missions, XP, and your streak. The curriculum stays; your history doesn't.",
                                      count: academy.state.xp, unit: "XP")
                }
                .buttonStyle(PressableStyle())
                .confirmationDialog("Reset all Academy progress?",
                                    isPresented: $confirmClearAcademy, titleVisibility: .visible) {
                    Button("Reset progress", role: .destructive) {
                        withAnimation(Motion.fluid) { academy.state = AcademyProgress.State() }
                        Persistence().save(AcademyProgress.State(), "academy")
                        Haptics.warning()
                    }
                } message: {
                    Text("Back to Observer rank. The knowledge stays in your head — hopefully.")
                }
            }
        }
    }

    // MARK: - About

    private var aboutCard: some View {
        SettingsCard(title: "About", icon: "info.circle.fill") {
            VStack(alignment: .leading, spacing: TarsTheme.Space.m) {
                NavigationLink {
                    SettingsDisclosuresView()
                } label: {
                    HStack {
                        Label("Disclosures", systemImage: "doc.text.magnifyingglass")
                            .font(TarsTheme.Text.body)
                            .foregroundStyle(TarsTheme.inkPrimary)
                        Spacer()
                        Text("Worth one honest read")
                            .font(TarsTheme.Text.caption)
                            .foregroundStyle(TarsTheme.inkTertiary)
                        Image(systemName: "chevron.right")
                            .font(TarsTheme.Text.caption)
                            .foregroundStyle(TarsTheme.inkTertiary)
                    }
                }
                .buttonStyle(PressableStyle())

                Divider().overlay(TarsTheme.hairline)

                HStack {
                    Text("Version")
                        .font(TarsTheme.Text.body)
                        .foregroundStyle(TarsTheme.inkSecondary)
                    Spacer()
                    Text(AppConfig.appVersion)
                        .font(TarsTheme.Text.priceSmall)
                        .foregroundStyle(TarsTheme.inkPrimary)
                }
                Text("Tars Trading — simulated trading and market education. No real money, anywhere in this app.")
                    .font(TarsTheme.Text.caption)
                    .foregroundStyle(TarsTheme.inkTertiary)
                    .fixedSize(horizontal: false, vertical: true)
            }
        }
    }
}

// MARK: - Backup file (Transferable)

/// Lazily bundles every JSON file in the persistence directory into one
/// combined object `{filename: contents}` the moment the share actually
/// happens — so the export is always current, never a stale snapshot.
fileprivate struct TarsBackupFile: Transferable {
    static var transferRepresentation: some TransferRepresentation {
        FileRepresentation(exportedContentType: .json) { _ in
            SentTransferredFile(try makeBackup(), allowAccessingOriginalFile: false)
        }
    }

    static func makeBackup() throws -> URL {
        let fm = FileManager.default
        var combined: [String: Any] = [:]
        let files = (try? fm.contentsOfDirectory(at: Persistence.directory,
                                                 includingPropertiesForKeys: nil)) ?? []
        for file in files where file.pathExtension == "json" {
            guard let data = try? Data(contentsOf: file),
                  let object = try? JSONSerialization.jsonObject(with: data,
                                                                 options: [.fragmentsAllowed])
            else { continue }  // skip missing or unreadable — export what exists
            combined[file.deletingPathExtension().lastPathComponent] = object
        }
        let payload = try JSONSerialization.data(withJSONObject: combined,
                                                 options: [.prettyPrinted, .sortedKeys])
        let dest = fm.temporaryDirectory.appending(path: "tars-trading-backup.json")
        try payload.write(to: dest, options: .atomic)
        return dest
    }
}

// MARK: - Card chrome

fileprivate struct SettingsCard<Content: View>: View {
    let title: String
    let icon: String
    var tint: Color = TarsTheme.accent
    @ViewBuilder let content: Content

    var body: some View {
        VStack(alignment: .leading, spacing: TarsTheme.Space.l) {
            HStack(spacing: TarsTheme.Space.s) {
                Image(systemName: icon)
                    .font(TarsTheme.Text.caption)
                    .foregroundStyle(tint)
                    .frame(width: 24, height: 24)
                    .background(
                        RoundedRectangle(cornerRadius: TarsTheme.Radius.s, style: .continuous)
                            .fill(tint.opacity(0.12)))
                Text(title)
                    .font(TarsTheme.Text.heading)
                    .foregroundStyle(TarsTheme.inkPrimary)
            }
            content
        }
        .padding(TarsTheme.Space.xl)
        .frame(maxWidth: .infinity, alignment: .leading)
        .tarsPanel()
    }
}

fileprivate struct SettingsToggleRow: View {
    let icon: String
    let title: String
    let subtitle: String
    @Binding var isOn: Bool

    var body: some View {
        Toggle(isOn: $isOn.animation(Motion.snappy)) {
            HStack(spacing: TarsTheme.Space.m) {
                Image(systemName: icon)
                    .font(TarsTheme.Text.body)
                    .foregroundStyle(TarsTheme.inkSecondary)
                    .frame(width: 22)
                VStack(alignment: .leading, spacing: 2) {
                    Text(title)
                        .font(TarsTheme.Text.body)
                        .foregroundStyle(TarsTheme.inkPrimary)
                    Text(subtitle)
                        .font(TarsTheme.Text.caption)
                        .foregroundStyle(TarsTheme.inkTertiary)
                        .fixedSize(horizontal: false, vertical: true)
                }
            }
        }
        .tint(TarsTheme.accent)
        .onChange(of: isOn) { _, _ in Haptics.tap() }
    }
}

fileprivate struct SettingsDangerRow: View {
    let title: String
    let subtitle: String
    let count: Int
    var unit: String = ""

    var body: some View {
        HStack(alignment: .top, spacing: TarsTheme.Space.m) {
            VStack(alignment: .leading, spacing: 2) {
                Text(title)
                    .font(TarsTheme.Text.body)
                    .foregroundStyle(TarsTheme.loss)
                Text(subtitle)
                    .font(TarsTheme.Text.caption)
                    .foregroundStyle(TarsTheme.inkTertiary)
                    .fixedSize(horizontal: false, vertical: true)
            }
            Spacer()
            Text(unit.isEmpty ? "\(count)" : "\(count) \(unit)")
                .font(TarsTheme.Text.priceSmall)
                .foregroundStyle(TarsTheme.inkTertiary)
        }
        .contentShape(Rectangle())
    }
}

// MARK: - Disclosures (design flagship, not fine print)

fileprivate struct SettingsDisclosuresView: View {
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var appeared = false

    private static let items: [(index: String, title: String, body: String)] = [
        ("01", "Everything here is simulated.",
         "Every order, fill, and position in Tars Trading runs against simulated or paper accounts. No real securities are bought or sold, and no real money is at risk — or available to be made."),
        ("02", "No real money. Ever.",
         "There is no code path in this app that touches a live brokerage account. The PAPER badge isn't decoration; it's a promise, pinned to every screen."),
        ("03", "Simulated results are not future returns.",
         "Paper profits come without slippage that hurts, fear that compounds, or size that moves markets. A strategy that works here may fail with real capital — and most do. Treat every result as practice, never as evidence."),
        ("04", "Education, not advice.",
         "Nothing in this app — lessons, missions, charts, or agents — is investment advice, a recommendation, or a solicitation to trade. We teach mechanics and reasoning. What you do with real money, elsewhere, is entirely your decision and your responsibility."),
        ("05", "Tars is software.",
         "Tars is a language model with a personality, not a licensed advisor, fiduciary, or human. He can explain, question, and critique — and he can also be wrong. He will never tell you what to buy, and you shouldn't trust anything that does."),
    ]

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: TarsTheme.Space.xxl) {
                header
                VStack(alignment: .leading, spacing: TarsTheme.Space.xxl) {
                    ForEach(Array(Self.items.enumerated()), id: \.offset) { i, item in
                        DisclosureBlock(index: item.index, title: item.title, text: item.body)
                            .opacity(appeared ? 1 : 0)
                            .offset(y: appeared ? 0 : 18)
                            .animation(reduceMotion ? nil
                                       : Motion.fluid.delay(0.08 * Double(i + 1)),
                                       value: appeared)
                    }
                }
                footer
                    .opacity(appeared ? 1 : 0)
                    .animation(reduceMotion ? nil : Motion.molasses.delay(0.6), value: appeared)
            }
            .frame(maxWidth: 620, alignment: .leading)
            .padding(TarsTheme.Space.xxl)
            .frame(maxWidth: .infinity)
        }
        .background(TarsTheme.bg0)
        .navigationTitle("Disclosures")
        .navigationBarTitleDisplayMode(.inline)
        .onAppear { appeared = true }
    }

    private var header: some View {
        VStack(alignment: .leading, spacing: TarsTheme.Space.l) {
            PaperStamp()
            Text("Read this once, properly.")
                .font(TarsTheme.Text.hero)
                .foregroundStyle(TarsTheme.inkPrimary)
                .fixedSize(horizontal: false, vertical: true)
            Text("Five things that are true about this app. They stay true no matter how green your portfolio gets.")
                .font(TarsTheme.Text.body)
                .foregroundStyle(TarsTheme.inkSecondary)
                .fixedSize(horizontal: false, vertical: true)
        }
        .opacity(appeared ? 1 : 0)
        .animation(reduceMotion ? nil : Motion.fluid, value: appeared)
    }

    private var footer: some View {
        VStack(alignment: .leading, spacing: TarsTheme.Space.s) {
            Divider().overlay(TarsTheme.hairline)
            Text("— Tars")
                .font(TarsTheme.Text.heading)
                .foregroundStyle(TarsTheme.inkSecondary)
            Text("\u{201C}I'd rather bore you with the truth than flatter you into a margin call. Fortunately, this app can't even offer you one.\u{201D}")
                .font(TarsTheme.Text.body)
                .italic()
                .foregroundStyle(TarsTheme.inkTertiary)
                .fixedSize(horizontal: false, vertical: true)
        }
        .padding(.top, TarsTheme.Space.xl)
    }
}

/// The PAPER stamp motif: an inked rubber-stamp mark, slightly rotated,
/// like it was pressed onto the page by someone who meant it.
fileprivate struct PaperStamp: View {
    var body: some View {
        Text("PAPER")
            .font(TarsTheme.Text.title)
            .kerning(10)
            .foregroundStyle(TarsTheme.paperBadge.opacity(0.85))
            .padding(.horizontal, TarsTheme.Space.xl)
            .padding(.vertical, TarsTheme.Space.m)
            .overlay(
                RoundedRectangle(cornerRadius: TarsTheme.Radius.s, style: .continuous)
                    .strokeBorder(TarsTheme.paperBadge.opacity(0.7), lineWidth: 3))
            .rotationEffect(.degrees(-4))
            .opacity(0.9)
            .accessibilityLabel("Paper trading stamp")
    }
}

fileprivate struct DisclosureBlock: View {
    let index: String
    let title: String
    let text: String

    var body: some View {
        HStack(alignment: .top, spacing: TarsTheme.Space.xl) {
            Text(index)
                .font(TarsTheme.Text.title.monospacedDigit())
                .foregroundStyle(TarsTheme.accent.opacity(0.55))
                .frame(width: 52, alignment: .leading)
            VStack(alignment: .leading, spacing: TarsTheme.Space.s) {
                Text(title)
                    .font(TarsTheme.Text.title)
                    .foregroundStyle(TarsTheme.inkPrimary)
                    .fixedSize(horizontal: false, vertical: true)
                Text(text)
                    .font(TarsTheme.Text.body)
                    .foregroundStyle(TarsTheme.inkSecondary)
                    .lineSpacing(4)
                    .fixedSize(horizontal: false, vertical: true)
            }
        }
    }
}
