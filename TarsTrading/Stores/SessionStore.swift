import Foundation
import Observation

/*
  Who is signed in, and what the desk knew at first paint.

  One cold-start round trip (/api/bootstrap) fills identity, the full margin
  picture, watchlist, positions and the unread count — the app opens as an
  instrument, not a stack of spinners. Everything here is the SERVER's
  number; this store never derives money math locally.
*/
@Observable @MainActor
final class SessionStore {
    enum Phase: Equatable {
        case checking            // app launch: is there a Keychain token?
        case signedOut
        case authenticating
        case signedIn
    }

    private(set) var phase: Phase = .checking
    private(set) var user: APIUser?
    private(set) var risk: AccountRiskPayload?
    private(set) var rates: FinancingRatesPayload?
    private(set) var watchlist: [String] = []
    private(set) var positions: [APIPosition] = []
    private(set) var unreadNotifications = 0
    /// When the bootstrap last landed — the staleness banner reads this.
    private(set) var lastSyncAt: Date?
    var signInError: String?

    private let api = TarsAPIClient.shared

    /// App launch: a stored token means we TRY the desk; a dead token signs out.
    func restore() async {
        guard await api.isSignedIn else { phase = .signedOut; return }
        await refresh(onAuthFailure: .signedOut)
        if phase == .checking { phase = .signedIn }
    }

    func signIn(email: String, password: String) async {
        phase = .authenticating
        signInError = nil
        do {
            try await api.signIn(email: email, password: password)
            await refresh(onAuthFailure: .signedOut)
            phase = user != nil ? .signedIn : .signedOut
        } catch {
            signInError = error.localizedDescription
            phase = .signedOut
        }
    }

    /// Optimistic star: flip locally, then let the server confirm. A
    /// failed call restores the truth rather than leaving a lie on screen.
    func toggleWatch(_ symbol: String) async {
        let wasWatching = watchlist.contains(symbol)
        if wasWatching { watchlist.removeAll { $0 == symbol } }
        else { watchlist.append(symbol) }
        do {
            watchlist = wasWatching
                ? try await api.removeFromWatchlist(symbol)
                : try await api.addToWatchlist(symbol)
        } catch {
            if wasWatching { watchlist.append(symbol) }
            else { watchlist.removeAll { $0 == symbol } }
        }
    }

    func isWatching(_ symbol: String) -> Bool { watchlist.contains(symbol) }

    func signOut() async {
        await api.signOut()
        user = nil; risk = nil; rates = nil
        watchlist = []; positions = []; unreadNotifications = 0
        phase = .signedOut
    }

    /// Pull the bootstrap. Network failures keep the last good state — the
    /// staleness stamp tells the truth; blanking the screen would lie harder.
    func refresh(onAuthFailure: Phase? = nil) async {
        do {
            let boot = try await api.bootstrap()
            user = boot.user
            risk = boot.risk
            rates = boot.rates
            watchlist = boot.watchlist
            positions = boot.positions
            unreadNotifications = boot.unreadNotifications
            lastSyncAt = Date()
            if phase != .signedIn { phase = .signedIn }
        } catch TarsAPIError.unauthorized {
            // The token died server-side (revoked or expired): sign out fully.
            if let fallback = onAuthFailure { await signOut(); phase = fallback }
        } catch {
            // Transient: keep last-good data; views read lastSyncAt for honesty.
        }
    }
}
