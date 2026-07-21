import SwiftUI
import UserNotifications

/// Price-alert tripwires. Watches the store's live quotes on a 5-second sweep;
/// an armed alert whose threshold is genuinely crossed fires once — haptic,
/// local notification, and a spot in the fired history. Honest-data rule:
/// alerts fire on observed crosses, they don't pretend to watch the market
/// while the app is closed.
@Observable
final class AlertEngine {

    // MARK: - Model

    struct PriceAlert: Identifiable, Codable, Equatable {
        enum Kind: String, Codable, CaseIterable, Identifiable {
            case above, below
            var id: String { rawValue }
            var label: String { self == .above ? "Above" : "Below" }
            var iconName: String { self == .above ? "arrow.up.right" : "arrow.down.right" }
        }

        var id = UUID()
        var symbol: String
        var kind: Kind
        var threshold: Double
        var note: String = ""
        var isArmed: Bool = true
        var firedAt: Date?
    }

    enum NotificationPermission { case undetermined, granted, denied }

    // MARK: - State

    var alerts: [PriceAlert] = []
    var permission: NotificationPermission = .undetermined

    var armed: [PriceAlert] { alerts.filter { $0.isArmed && $0.firedAt == nil } }
    var fired: [PriceAlert] {
        alerts.filter { $0.firedAt != nil }
            .sorted { ($0.firedAt ?? .distantPast) > ($1.firedAt ?? .distantPast) }
    }

    @ObservationIgnored private let persistence = Persistence()
    @ObservationIgnored private var watcher: Task<Void, Never>?
    /// Last observed price per symbol — a fire requires a real cross, not just
    /// "price happens to be past the line when the alert was created".
    @ObservationIgnored private var lastPrices: [String: Double] = [:]
    @ObservationIgnored private var hasRequestedAuth = false

    init() {
        alerts = persistence.load([PriceAlert].self, "priceAlerts") ?? []
        Task { await refreshPermission() }
    }

    // MARK: - Lifecycle

    /// Begin the 5-second sweep over `store.quotes`. Safe to call repeatedly.
    func start(store: TradingStore) {
        watcher?.cancel()
        watcher = Task { [weak self] in
            while !Task.isCancelled {
                guard let self else { return }
                await MainActor.run { self.sweep(quotes: store.quotes) }
                try? await Task.sleep(for: .seconds(5))
            }
        }
    }

    func stop() {
        watcher?.cancel()
        watcher = nil
    }

    // MARK: - Mutations

    @MainActor
    func add(_ alert: PriceAlert) {
        withAnimation(Motion.spatial) { alerts.insert(alert, at: 0) }
        save()
        Haptics.confirm()
        // Lazy permission ask: the first time a tripwire exists is the first
        // time a notification could matter.
        if permission == .undetermined && !hasRequestedAuth {
            hasRequestedAuth = true
            Task { await requestPermission() }
        }
    }

    @MainActor
    func remove(_ alert: PriceAlert) {
        withAnimation(Motion.spatial) { alerts.removeAll { $0.id == alert.id } }
        save()
        Haptics.tap()
    }

    @MainActor
    func disarm(_ alert: PriceAlert) {
        guard let i = alerts.firstIndex(where: { $0.id == alert.id }) else { return }
        withAnimation(Motion.snappy) { alerts[i].isArmed = false }
        save()
        Haptics.tick()
    }

    /// Bring a fired (or disarmed) alert back to the armed list.
    @MainActor
    func rearm(_ alert: PriceAlert) {
        guard let i = alerts.firstIndex(where: { $0.id == alert.id }) else { return }
        withAnimation(Motion.spatial) {
            alerts[i].firedAt = nil
            alerts[i].isArmed = true
        }
        save()
        Haptics.tap()
    }

    // MARK: - Sweep

    @MainActor
    private func sweep(quotes: [String: Quote]) {
        var didFire = false
        for i in alerts.indices {
            let alert = alerts[i]
            guard alert.isArmed, alert.firedAt == nil,
                  let quote = quotes[alert.symbol],
                  let previous = lastPrices[alert.symbol],
                  crossed(alert.kind, from: previous, to: quote.price, threshold: alert.threshold)
            else { continue }
            withAnimation(Motion.spatial) {
                alerts[i].firedAt = .now
                alerts[i].isArmed = false
            }
            didFire = true
            Haptics.warning()
            postNotification(for: alerts[i], price: quote.price)
        }
        for (symbol, quote) in quotes { lastPrices[symbol] = quote.price }
        if didFire { save() }
    }

    private func crossed(_ kind: PriceAlert.Kind, from previous: Double,
                         to current: Double, threshold: Double) -> Bool {
        switch kind {
        case .above: previous < threshold && current >= threshold
        case .below: previous > threshold && current <= threshold
        }
    }

    // MARK: - Notifications

    private func postNotification(for alert: PriceAlert, price: Double) {
        guard permission == .granted else { return }
        let content = UNMutableNotificationContent()
        let direction = alert.kind == .above ? "crossed above" : "dropped below"
        content.title = "PAPER · \(alert.symbol) \(direction) \(alert.threshold.formatted(.currency(code: "USD")))"
        var body = "\(alert.symbol) is at \(price.formatted(.currency(code: "USD")))."
        if !alert.note.isEmpty { body += " Your note: \(alert.note)" }
        content.body = body
        content.sound = .default
        let request = UNNotificationRequest(identifier: alert.id.uuidString,
                                            content: content, trigger: nil)
        UNUserNotificationCenter.current().add(request)
    }

    func requestPermission() async {
        let granted = (try? await UNUserNotificationCenter.current()
            .requestAuthorization(options: [.alert, .sound, .badge])) ?? false
        await MainActor.run {
            withAnimation(Motion.snappy) {
                permission = granted ? .granted : .denied
            }
        }
    }

    func refreshPermission() async {
        let settings = await UNUserNotificationCenter.current().notificationSettings()
        let resolved: NotificationPermission = switch settings.authorizationStatus {
        case .authorized, .provisional, .ephemeral: .granted
        case .denied: .denied
        default: .undetermined
        }
        await MainActor.run { permission = resolved }
    }

    // MARK: - Persistence

    private func save() {
        persistence.save(alerts, "priceAlerts")
    }
}
