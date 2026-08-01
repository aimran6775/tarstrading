import Foundation
import Observation

/*
  The quote heartbeat — one polling loop for whatever symbols are on screen.

  Rules it lives by:
  - 20s cadence, the same beat the web terminal runs.
  - A hidden app polls NOTHING (deactivate on background; battery is a
    design material). Coming back triggers an immediate refresh, because
    returning to a stale board without a fresh read would quietly lie.
  - Failures keep the last good quotes and stamp them stale — screens show
    honest age, never a blank.
*/
@Observable @MainActor
final class MarketStore {
    private(set) var quotes: [String: APIQuote] = [:]
    private(set) var lastTickAt: Date?
    /// True when the most recent poll failed — surfaces the amber banner.
    private(set) var stale = false

    private var symbols: [String] = []
    private var loop: Task<Void, Never>?
    private let api = TarsAPIClient.shared
    private let cadence: Duration = .seconds(20)

    /// The screen declares what it's watching; the store does the rest.
    func watch(_ syms: [String]) {
        let cleaned = Array(Set(syms)).sorted()
        guard cleaned != symbols else { return }
        symbols = cleaned
        Task { await tick() } // new interest deserves an immediate read
    }

    func activate() {
        guard loop == nil else { return }
        loop = Task { [weak self] in
            while !Task.isCancelled {
                await self?.tick()
                try? await Task.sleep(for: self?.cadence ?? .seconds(20))
            }
        }
    }

    func deactivate() {
        loop?.cancel()
        loop = nil
    }

    private func tick() async {
        guard !symbols.isEmpty else { return }
        do {
            let fresh = try await api.quotes(symbols: symbols)
            for q in fresh { quotes[q.symbol] = q }
            lastTickAt = Date()
            stale = false
        } catch {
            stale = true // keep last-good; the banner tells the truth
        }
    }
}
