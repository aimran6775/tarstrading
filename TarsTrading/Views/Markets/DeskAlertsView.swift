import SwiftUI

/*
  Alerts — two kinds, and the second is the one that matters.

  A PRICE alert warns you about the market. A MARGIN alert warns you about
  yourself, and the market never liquidates you — your requirement does. So
  margin usage gets equal billing here rather than hiding behind a symbol
  field nobody would think to type "$MARGIN" into.
*/
struct DeskAlertsView: View {
    @State private var model = DeskAlertsModel()
    @State private var mode: Mode = .price
    @State private var symbol = ""
    @State private var level = ""
    @State private var direction = "above"
    enum Mode: String, CaseIterable { case price = "Price", margin = "Margin usage" }

    var body: some View {
        ScrollView {
            LazyVStack(alignment: .leading, spacing: TarsTheme.Space.l) {
                composer
                listCard
            }
            .padding(TarsTheme.Space.l)
            .padding(.bottom, 72)
        }
        .background(TarsTheme.bg0)
        .navigationTitle("Alerts")
        .navigationBarTitleDisplayMode(.inline)
        .refreshable { await model.load() }
        .task { if model.alerts.isEmpty { await model.load() } }
    }

    private var composer: some View {
        VStack(alignment: .leading, spacing: TarsTheme.Space.m) {
            Picker("Kind", selection: $mode) {
                ForEach(Mode.allCases, id: \.self) { Text($0.rawValue).tag($0) }
            }
            .pickerStyle(.segmented)

            if mode == .price {
                field("Symbol", text: $symbol, placeholder: "AAPL, BTC/USD, FX:EURUSD",
                      uppercased: true)
                field("Level", text: $level, placeholder: "Price", numeric: true)
            } else {
                field("Warn me at", text: $level, placeholder: "80", numeric: true)
                Text("Percent of equity committed. A margin alert warns you about yourself — the market never liquidates you, your requirement does.")
                    .font(TarsTheme.Text.micro)
                    .foregroundStyle(TarsTheme.inkQuaternary)
            }

            Picker("Direction", selection: $direction) {
                Text(mode == .price ? "Rises above" : "Rises past").tag("above")
                Text(mode == .price ? "Falls below" : "Falls under").tag("below")
            }
            .pickerStyle(.segmented)

            Button {
                Task { await create() }
            } label: {
                Text("Set alert")
                    .font(TarsTheme.Text.heading)
                    .frame(maxWidth: .infinity, minHeight: 48)
            }
            .background(canCreate ? TarsTheme.paperBadge : TarsTheme.bg3)
            .foregroundStyle(canCreate ? TarsTheme.onFill : TarsTheme.inkTertiary)
            .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
            .disabled(!canCreate)

            if let err = model.error {
                Text(err).font(TarsTheme.Text.micro).foregroundStyle(TarsTheme.loss)
            }
        }
        .padding(TarsTheme.Space.l)
        .tarsPanel()
    }

    private var canCreate: Bool {
        guard let v = Double(level), v > 0 else { return false }
        return mode == .margin || !symbol.trimmingCharacters(in: .whitespaces).isEmpty
    }

    private func create() async {
        guard let v = Double(level) else { return }
        // A margin alert rides the reserved symbol with the level as a fraction.
        let sym = mode == .margin ? "$MARGIN" : symbol.trimmingCharacters(in: .whitespaces).uppercased()
        let price = mode == .margin ? v / 100 : v
        await model.create(symbol: sym, price: price, direction: direction)
        if model.error == nil { symbol = ""; level = ""; Haptics.success() }
        else { Haptics.warning() }
    }

    private var listCard: some View {
        VStack(alignment: .leading, spacing: 0) {
            if model.alerts.isEmpty {
                Text(model.loaded ? "No alerts set." : "Loading…")
                    .font(TarsTheme.Text.caption)
                    .foregroundStyle(TarsTheme.inkTertiary)
                    .padding(TarsTheme.Space.l)
            } else {
                ForEach(model.alerts) { a in
                    row(a)
                    Divider().overlay(TarsTheme.hairline)
                }
            }
        }
        .tarsPanel()
    }

    private func row(_ a: APIAlert) -> some View {
        HStack {
            VStack(alignment: .leading, spacing: 3) {
                Text(a.isMargin ? "Margin usage" : SymbolDisplay.pretty(a.symbol))
                    .font(TarsTheme.Text.body.weight(.semibold))
                    .foregroundStyle(TarsTheme.inkPrimary)
                Text(a.isMargin
                     ? "\(a.direction == "above" ? "Rises past" : "Falls under") \(a.price * 100, specifier: "%.0f")% of equity"
                     : "\(a.direction == "above" ? "Rises above" : "Falls below") \(SymbolDisplay.price(a.symbol, a.price))")
                    .font(TarsTheme.Text.micro.monospacedDigit())
                    .foregroundStyle(TarsTheme.inkTertiary)
                if a.triggeredAt != nil {
                    Text("TRIGGERED")
                        .font(.system(size: 9, weight: .bold, design: .monospaced))
                        .foregroundStyle(TarsTheme.paperBadge)
                }
            }
            Spacer()
            Button {
                Haptics.tap()
                Task { await model.remove(a.id) }
            } label: {
                Image(systemName: "trash")
                    .font(.system(size: 14))
                    .foregroundStyle(TarsTheme.inkTertiary)
                    .frame(width: 44, height: 44)
            }
            .buttonStyle(.plain)
            .accessibilityLabel("Delete alert")
        }
        .padding(.horizontal, TarsTheme.Space.l)
        .padding(.vertical, TarsTheme.Space.s)
    }

    private func field(_ label: String, text: Binding<String>,
                       placeholder: String, numeric: Bool = false,
                       uppercased: Bool = false) -> some View {
        HStack {
            Text(label).font(TarsTheme.Text.caption).foregroundStyle(TarsTheme.inkSecondary)
            Spacer()
            TextField(placeholder, text: text)
                .keyboardType(numeric ? .decimalPad : .default)
                .textInputAutocapitalization(uppercased ? .characters : .sentences)
                .autocorrectionDisabled(uppercased)
                .multilineTextAlignment(.trailing)
                .font(TarsTheme.Text.body.monospacedDigit())
                .foregroundStyle(TarsTheme.inkPrimary)
        }
        .padding(.horizontal, TarsTheme.Space.l)
        .frame(minHeight: 48)
        .background(TarsTheme.bg2)
        .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
    }
}

@Observable @MainActor
final class DeskAlertsModel {
    private(set) var alerts: [APIAlert] = []
    private(set) var loaded = false
    var error: String?
    private let api = TarsAPIClient.shared

    func load() async {
        alerts = (try? await api.alerts()) ?? alerts
        loaded = true
    }

    func create(symbol: String, price: Double, direction: String) async {
        error = nil
        do {
            try await api.createAlert(symbol: symbol, price: price, direction: direction)
            await load()
        } catch {
            // The server's sentence — it names exactly what it refused.
            self.error = error.localizedDescription
        }
    }

    func remove(_ id: String) async {
        await api.deleteAlert(id: id)
        await load()
    }
}
