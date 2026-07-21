import SwiftUI
import UIKit

/// Price-alert tripwires: armed list, fired history, and a composer sheet.
/// Alerts watch live quotes while the app runs — Tars doesn't pretend to
/// watch the tape while you're both asleep.
public struct AlertsView: View {
    let engine: AlertEngine

    @Environment(TradingStore.self) private var store
    @State private var showComposer = false

    public var body: some View {
        VStack(spacing: 0) {
            AlertsHeader(armedCount: engine.armed.count) {
                showComposer = true
            }
            if engine.permission == .denied {
                PermissionDeniedBanner()
                    .padding(.horizontal, TarsTheme.Space.l)
                    .padding(.bottom, TarsTheme.Space.m)
                    .transition(.move(edge: .top).combined(with: .opacity))
            }
            if engine.alerts.isEmpty {
                AlertsEmptyState { showComposer = true }
            } else {
                alertList
            }
        }
        .background(TarsTheme.bg0)
        .sheet(isPresented: $showComposer) {
            AlertComposerSheet(engine: engine)
                .presentationDetents([.medium, .large])
                .presentationBackground(TarsTheme.bg1)
                .presentationDragIndicator(.visible)
        }
        .animation(Motion.spatial, value: engine.permission == .denied)
    }

    private var alertList: some View {
        List {
            if !engine.armed.isEmpty {
                Section {
                    ForEach(engine.armed) { alert in
                        ArmedAlertRow(alert: alert, quote: store.quote(for: alert.symbol))
                            .listRowBackground(Color.clear)
                            .listRowSeparatorTint(TarsTheme.hairline)
                            .swipeActions(edge: .trailing, allowsFullSwipe: false) {
                                Button(role: .destructive) {
                                    engine.remove(alert)
                                } label: {
                                    Label("Delete", systemImage: "trash")
                                }
                                Button {
                                    engine.disarm(alert)
                                } label: {
                                    Label("Disarm", systemImage: "bell.slash")
                                }
                                .tint(TarsTheme.warning)
                            }
                    }
                } header: {
                    AlertSectionHeader(title: "Armed", count: engine.armed.count)
                }
            }
            if !disarmedIdle.isEmpty {
                Section {
                    ForEach(disarmedIdle) { alert in
                        DisarmedAlertRow(alert: alert)
                            .listRowBackground(Color.clear)
                            .listRowSeparatorTint(TarsTheme.hairline)
                            .swipeActions(edge: .trailing, allowsFullSwipe: false) {
                                Button(role: .destructive) {
                                    engine.remove(alert)
                                } label: {
                                    Label("Delete", systemImage: "trash")
                                }
                            }
                            .swipeActions(edge: .leading) {
                                Button {
                                    engine.rearm(alert)
                                } label: {
                                    Label("Re-arm", systemImage: "bell.fill")
                                }
                                .tint(TarsTheme.accent)
                            }
                    }
                } header: {
                    AlertSectionHeader(title: "Disarmed", count: disarmedIdle.count)
                }
            }
            if !engine.fired.isEmpty {
                Section {
                    ForEach(engine.fired) { alert in
                        FiredAlertRow(alert: alert) {
                            engine.rearm(alert)
                        }
                        .listRowBackground(Color.clear)
                        .listRowSeparatorTint(TarsTheme.hairline)
                        .swipeActions(edge: .trailing, allowsFullSwipe: false) {
                            Button(role: .destructive) {
                                engine.remove(alert)
                            } label: {
                                Label("Delete", systemImage: "trash")
                            }
                        }
                    }
                } header: {
                    AlertSectionHeader(title: "Fired", count: engine.fired.count)
                }
            }
        }
        .listStyle(.plain)
        .scrollContentBackground(.hidden)
        .animation(Motion.spatial, value: engine.alerts)
    }

    /// Manually disarmed but never fired — parked, not history.
    private var disarmedIdle: [AlertEngine.PriceAlert] {
        engine.alerts.filter { !$0.isArmed && $0.firedAt == nil }
    }
}

// MARK: - Header

fileprivate struct AlertsHeader: View {
    let armedCount: Int
    let onNew: () -> Void

    var body: some View {
        HStack(alignment: .firstTextBaseline) {
            VStack(alignment: .leading, spacing: TarsTheme.Space.xs) {
                Text("Alerts")
                    .font(TarsTheme.Text.title)
                    .foregroundStyle(TarsTheme.inkPrimary)
                Text(armedCount == 0
                     ? "No tripwires set"
                     : "^[\(armedCount) tripwire](inflect: true) armed")
                    .font(TarsTheme.Text.caption)
                    .monospacedDigit()
                    .foregroundStyle(TarsTheme.inkSecondary)
                    .contentTransition(.numericText())
                    .animation(Motion.ticker, value: armedCount)
            }
            Spacer()
            Button(action: onNew) {
                Label("New Alert", systemImage: "plus")
                    .font(TarsTheme.Text.caption)
                    .foregroundStyle(TarsTheme.bg0)
                    .padding(.horizontal, TarsTheme.Space.l)
                    .padding(.vertical, TarsTheme.Space.s)
                    .background(
                        Capsule().fill(TarsTheme.accent)
                    )
            }
            .buttonStyle(PressableStyle())
            .accessibilityLabel("New price alert")
        }
        .padding(.horizontal, TarsTheme.Space.l)
        .padding(.top, TarsTheme.Space.xl)
        .padding(.bottom, TarsTheme.Space.l)
    }
}

fileprivate struct AlertSectionHeader: View {
    let title: String
    let count: Int

    var body: some View {
        HStack(spacing: TarsTheme.Space.s) {
            Text(title.uppercased())
                .font(TarsTheme.Text.micro)
                .foregroundStyle(TarsTheme.inkTertiary)
                .kerning(1.2)
            Text("\(count)")
                .font(TarsTheme.Text.micro)
                .monospacedDigit()
                .foregroundStyle(TarsTheme.inkTertiary)
                .padding(.horizontal, TarsTheme.Space.s)
                .padding(.vertical, 2)
                .background(Capsule().fill(TarsTheme.bg2))
        }
        .textCase(nil)
        .listRowInsets(EdgeInsets(top: TarsTheme.Space.l, leading: TarsTheme.Space.l,
                                  bottom: TarsTheme.Space.s, trailing: TarsTheme.Space.l))
    }
}

// MARK: - Rows

fileprivate struct ArmedAlertRow: View {
    let alert: AlertEngine.PriceAlert
    let quote: Quote?

    var body: some View {
        HStack(spacing: TarsTheme.Space.m) {
            Image(systemName: "bell.fill")
                .font(TarsTheme.Text.heading)
                .foregroundStyle(TarsTheme.accent)
                .frame(width: 32)
                .accessibilityHidden(true)

            VStack(alignment: .leading, spacing: TarsTheme.Space.xs) {
                Text(alert.symbol)
                    .font(TarsTheme.Text.price)
                    .foregroundStyle(TarsTheme.inkPrimary)
                    .lineLimit(1)
                    .minimumScaleFactor(0.7)
                HStack(spacing: TarsTheme.Space.xs) {
                    Image(systemName: alert.kind.iconName)
                        .font(TarsTheme.Text.micro)
                    Text("\(alert.kind.label) \(alert.threshold, format: .currency(code: "USD"))")
                        .font(TarsTheme.Text.priceSmall)
                }
                .foregroundStyle(TarsTheme.inkSecondary)
                if !alert.note.isEmpty {
                    Text(alert.note)
                        .font(TarsTheme.Text.caption)
                        .foregroundStyle(TarsTheme.inkTertiary)
                        .lineLimit(2)
                }
            }

            Spacer()

            if let quote {
                VStack(alignment: .trailing, spacing: TarsTheme.Space.xs) {
                    TickerText(value: quote.price, font: TarsTheme.Text.priceSmall)
                    Text("now")
                        .font(TarsTheme.Text.micro)
                        .foregroundStyle(TarsTheme.inkTertiary)
                }
            } else {
                Text("no quote")
                    .font(TarsTheme.Text.micro)
                    .foregroundStyle(TarsTheme.inkTertiary)
            }
        }
        .padding(.vertical, TarsTheme.Space.s)
        .accessibilityElement(children: .combine)
    }
}

fileprivate struct DisarmedAlertRow: View {
    let alert: AlertEngine.PriceAlert

    var body: some View {
        HStack(spacing: TarsTheme.Space.m) {
            Image(systemName: "bell.slash")
                .font(TarsTheme.Text.heading)
                .foregroundStyle(TarsTheme.inkTertiary)
                .frame(width: 32)
                .accessibilityHidden(true)
            VStack(alignment: .leading, spacing: TarsTheme.Space.xs) {
                Text(alert.symbol)
                    .font(TarsTheme.Text.price)
                    .foregroundStyle(TarsTheme.inkSecondary)
                    .lineLimit(1)
                    .minimumScaleFactor(0.7)
                Text("\(alert.kind.label) \(alert.threshold, format: .currency(code: "USD")) · disarmed")
                    .font(TarsTheme.Text.priceSmall)
                    .foregroundStyle(TarsTheme.inkTertiary)
            }
            Spacer()
        }
        .padding(.vertical, TarsTheme.Space.s)
        .accessibilityElement(children: .combine)
    }
}

fileprivate struct FiredAlertRow: View {
    let alert: AlertEngine.PriceAlert
    let onRearm: () -> Void

    var body: some View {
        HStack(spacing: TarsTheme.Space.m) {
            Image(systemName: "bell.slash")
                .font(TarsTheme.Text.heading)
                .foregroundStyle(TarsTheme.warning)
                .frame(width: 32)
                .accessibilityHidden(true)

            VStack(alignment: .leading, spacing: TarsTheme.Space.xs) {
                Text(alert.symbol)
                    .font(TarsTheme.Text.price)
                    .foregroundStyle(TarsTheme.inkPrimary)
                    .lineLimit(1)
                    .minimumScaleFactor(0.7)
                Text("\(alert.kind.label) \(alert.threshold, format: .currency(code: "USD"))")
                    .font(TarsTheme.Text.priceSmall)
                    .foregroundStyle(TarsTheme.inkSecondary)
                if let firedAt = alert.firedAt {
                    Text("Fired \(firedAt, format: .relative(presentation: .named))")
                        .font(TarsTheme.Text.caption)
                        .foregroundStyle(TarsTheme.inkTertiary)
                }
            }

            Spacer()

            Button(action: onRearm) {
                Label("Re-arm", systemImage: "arrow.counterclockwise")
                    .font(TarsTheme.Text.caption)
                    .foregroundStyle(TarsTheme.accent)
                    .padding(.horizontal, TarsTheme.Space.m)
                    .padding(.vertical, TarsTheme.Space.xs + 2)
                    .background(
                        Capsule().strokeBorder(TarsTheme.accent.opacity(0.4), lineWidth: 1)
                    )
            }
            .buttonStyle(PressableStyle())
            .accessibilityLabel("Re-arm alert for \(alert.symbol)")
        }
        .padding(.vertical, TarsTheme.Space.s)
    }
}

// MARK: - Empty state

fileprivate struct AlertsEmptyState: View {
    let onNew: () -> Void
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var pulsing = false

    var body: some View {
        VStack(spacing: TarsTheme.Space.l) {
            Spacer()

            ZStack {
                ForEach(0..<2, id: \.self) { ring in
                    Circle()
                        .strokeBorder(TarsTheme.accent.opacity(0.18), lineWidth: 1)
                        .frame(width: 96 + CGFloat(ring) * 36,
                               height: 96 + CGFloat(ring) * 36)
                        .scaleEffect(pulsing ? 1.12 : 0.96)
                        .opacity(pulsing ? 0.25 : 0.9)
                        .animation(
                            reduceMotion ? nil :
                                .easeInOut(duration: 2.4)
                                .repeatForever(autoreverses: true)
                                .delay(Double(ring) * 0.4),
                            value: pulsing
                        )
                }
                Image(systemName: "bell.badge")
                    .font(TarsTheme.Text.hero)
                    .foregroundStyle(TarsTheme.accent)
            }
            .onAppear { if !reduceMotion { pulsing = true } }
            .accessibilityHidden(true)

            VStack(spacing: TarsTheme.Space.s) {
                Text("Silence is a choice")
                    .font(TarsTheme.Text.title)
                    .foregroundStyle(TarsTheme.inkPrimary)
                Text("Set a tripwire on a price and Tars will tap you when it crosses. He makes no promises about whether you'll like the news.")
                    .font(TarsTheme.Text.body)
                    .foregroundStyle(TarsTheme.inkSecondary)
                    .multilineTextAlignment(.center)
                    .frame(maxWidth: 420)
            }

            Button(action: onNew) {
                Label("Set a tripwire", systemImage: "plus")
                    .font(TarsTheme.Text.heading)
                    .foregroundStyle(TarsTheme.bg0)
                    .padding(.horizontal, TarsTheme.Space.xl)
                    .padding(.vertical, TarsTheme.Space.m)
                    .background(Capsule().fill(TarsTheme.accent))
            }
            .buttonStyle(PressableStyle())
            .padding(.top, TarsTheme.Space.s)

            Spacer()
            Spacer()
        }
        .frame(maxWidth: .infinity)
        .padding(TarsTheme.Space.xl)
    }
}

// MARK: - Permission denied

fileprivate struct PermissionDeniedBanner: View {
    var body: some View {
        HStack(alignment: .top, spacing: TarsTheme.Space.m) {
            Image(systemName: "bell.slash.circle.fill")
                .font(TarsTheme.Text.heading)
                .foregroundStyle(TarsTheme.warning)
            VStack(alignment: .leading, spacing: TarsTheme.Space.xs) {
                Text("Notifications are off")
                    .font(TarsTheme.Text.caption)
                    .foregroundStyle(TarsTheme.inkPrimary)
                Text("Alerts still trip inside the app — banners need permission from Settings.")
                    .font(TarsTheme.Text.caption)
                    .foregroundStyle(TarsTheme.inkSecondary)
            }
            Spacer()
            Button {
                if let url = URL(string: UIApplication.openSettingsURLString) {
                    UIApplication.shared.open(url)
                }
            } label: {
                Text("Settings")
                    .font(TarsTheme.Text.caption)
                    .foregroundStyle(TarsTheme.warning)
                    .padding(.horizontal, TarsTheme.Space.m)
                    .padding(.vertical, TarsTheme.Space.xs + 2)
                    .background(
                        Capsule().strokeBorder(TarsTheme.warning.opacity(0.5), lineWidth: 1)
                    )
            }
            .buttonStyle(PressableStyle())
        }
        .padding(TarsTheme.Space.m)
        .tarsPanel(elevation: 2)
    }
}

// MARK: - Composer sheet

fileprivate struct AlertComposerSheet: View {
    let engine: AlertEngine

    @Environment(TradingStore.self) private var store
    @Environment(\.dismiss) private var dismiss

    @State private var symbol: String = ""
    @State private var kind: AlertEngine.PriceAlert.Kind = .above
    @State private var priceText: String = ""
    @State private var note: String = ""

    /// Watchlist first, then the rest of the demo universe, deduplicated.
    private var symbols: [String] {
        var seen = Set<String>()
        return (store.watchlist + DemoMarket.universe.map(\.symbol))
            .filter { seen.insert($0).inserted }
    }

    private var currentQuote: Quote? { store.quote(for: symbol) }

    private var parsedPrice: Double? {
        Double(priceText.replacingOccurrences(of: ",", with: "."))
    }

    private var canSave: Bool {
        guard let p = parsedPrice else { return false }
        return !symbol.isEmpty && p > 0
    }

    /// Honest hint: with strict cross semantics, a threshold already breached
    /// won't fire until price recrosses it.
    private var alreadyBeyond: Bool {
        guard let p = parsedPrice, let q = currentQuote else { return false }
        return kind == .above ? q.price >= p : q.price <= p
    }

    var body: some View {
        ScrollView {
            composerContent
        }
        .background(TarsTheme.bg1)
        .onAppear {
            if symbol.isEmpty {
                symbol = symbols.first ?? "AAPL"
                prefillPrice()
            }
        }
        .onChange(of: symbol) { _, _ in prefillPrice() }
    }

    private var composerContent: some View {
        VStack(alignment: .leading, spacing: TarsTheme.Space.l) {
            HStack {
                Text("New Tripwire")
                    .font(TarsTheme.Text.title)
                    .foregroundStyle(TarsTheme.inkPrimary)
                Spacer()
                Button("Cancel") { dismiss() }
                    .font(TarsTheme.Text.body)
                    .foregroundStyle(TarsTheme.inkSecondary)
            }

            // Symbol + live price
            VStack(alignment: .leading, spacing: TarsTheme.Space.s) {
                fieldLabel("Symbol")
                HStack {
                    Picker("Symbol", selection: $symbol) {
                        ForEach(symbols, id: \.self) { s in
                            Text(s).tag(s)
                        }
                    }
                    .pickerStyle(.menu)
                    .tint(TarsTheme.accent)
                    Spacer()
                    if let q = currentQuote {
                        VStack(alignment: .trailing, spacing: 2) {
                            TickerText(value: q.price, font: TarsTheme.Text.price)
                            PercentText(value: q.changePercent)
                        }
                    }
                }
                .padding(TarsTheme.Space.m)
                .tarsPanel(elevation: 2)
            }

            // Direction
            VStack(alignment: .leading, spacing: TarsTheme.Space.s) {
                fieldLabel("Fires when price crosses")
                Picker("Direction", selection: $kind) {
                    ForEach(AlertEngine.PriceAlert.Kind.allCases) { k in
                        Text(k.label).tag(k)
                    }
                }
                .pickerStyle(.segmented)
            }

            // Threshold
            VStack(alignment: .leading, spacing: TarsTheme.Space.s) {
                fieldLabel("Threshold")
                HStack {
                    Text("$")
                        .font(TarsTheme.Text.price)
                        .foregroundStyle(TarsTheme.inkTertiary)
                    TextField("0.00", text: $priceText)
                        .font(TarsTheme.Text.price)
                        .foregroundStyle(TarsTheme.inkPrimary)
                        .keyboardType(.decimalPad)
                        .accessibilityLabel("Threshold price in dollars")
                }
                .padding(TarsTheme.Space.m)
                .tarsPanel(elevation: 2)
                if alreadyBeyond {
                    Label("Price is already \(kind.label.lowercased()) this line — it fires on the next cross, not right now.",
                          systemImage: "info.circle")
                        .font(TarsTheme.Text.caption)
                        .foregroundStyle(TarsTheme.warning)
                }
            }

            // Note
            VStack(alignment: .leading, spacing: TarsTheme.Space.s) {
                fieldLabel("Note (optional)")
                TextField("Why does this level matter to you?", text: $note, axis: .vertical)
                    .font(TarsTheme.Text.body)
                    .foregroundStyle(TarsTheme.inkPrimary)
                    .lineLimit(1...3)
                    .padding(TarsTheme.Space.m)
                    .tarsPanel(elevation: 2)
            }

            Spacer(minLength: 0)

            Button {
                guard let threshold = parsedPrice else { return }
                engine.add(AlertEngine.PriceAlert(symbol: symbol, kind: kind,
                                                  threshold: threshold, note: note))
                dismiss()
            } label: {
                Text("Arm Tripwire")
                    .font(TarsTheme.Text.heading)
                    .foregroundStyle(canSave ? TarsTheme.bg0 : TarsTheme.inkTertiary)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, TarsTheme.Space.m)
                    .background(
                        Capsule().fill(canSave ? TarsTheme.accent : TarsTheme.bg3)
                    )
            }
            .buttonStyle(PressableStyle())
            .disabled(!canSave)
        }
        .padding(TarsTheme.Space.xl)
    }

    private func prefillPrice() {
        guard let q = store.quote(for: symbol) else { return }
        let decimals = q.price < 1 ? 4 : 2
        priceText = q.price.formatted(.number
            .precision(.fractionLength(decimals))
            .grouping(.never))
    }

    private func fieldLabel(_ text: String) -> some View {
        Text(text.uppercased())
            .font(TarsTheme.Text.micro)
            .foregroundStyle(TarsTheme.inkTertiary)
            .kerning(1.2)
    }
}
