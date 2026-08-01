import Foundation

/*
  The platform client — the app's ONLY door to data.

  Everything this app knows arrives through tarstrading.com's API: the same
  endpoints, the same account, the same $100k as the web terminal. The app
  ships with zero secrets; its sole credential is a revocable device token
  minted at sign-in and kept in the Keychain.

  An actor, so token reads/writes serialize without locks. Every call:
  - attaches `Authorization: Bearer <token>` when signed in
  - maps 401 → .unauthorized (the session store reacts by signing out)
  - surfaces the server's own error sentence when it wrote one — the
    platform's rejection reasons are teaching copy, not noise.
*/
/// The platform's error envelope: `{ ok: false, error: "a sentence" }`.
private struct ServerErrorBody: Decodable { let error: String? }

actor TarsAPIClient {
    static let shared = TarsAPIClient()

    /// Production by default. DEBUG builds can point at a local server with
    /// -TarsAPIBase on the launch arguments — never a build-config secret.
    private let base: URL = {
        #if DEBUG
        if let override = UserDefaults.standard.string(forKey: "TarsAPIBase"),
           let url = URL(string: override) {
            return url
        }
        #endif
        return URL(string: "https://tarstrading.com")!
    }()

    private var token: String?
    private let session: URLSession

    init() {
        let config = URLSessionConfiguration.default
        config.timeoutIntervalForRequest = 15
        config.waitsForConnectivity = false // fail fast; stores show last-good
        session = URLSession(configuration: config)
        token = Keychain.loadToken()
        #if DEBUG
        // Headless simulator drives: -TarsAuthToken <token> authenticates the
        // run without typing. Never persisted, never in release builds.
        if let injected = UserDefaults.standard.string(forKey: "TarsAuthToken"),
           !injected.isEmpty {
            token = injected
        }
        #endif
    }

    var isSignedIn: Bool { token != nil }

    // MARK: - Auth

    func signIn(email: String, password: String) async throws {
        struct Body: Encodable { let email: String; let password: String }
        let res: TokenResponse = try await request(
            "POST", "/api/auth/token", body: Body(email: email, password: password),
            authenticated: false)
        guard res.ok, let t = res.token else {
            throw TarsAPIError.server(res.error ?? "Sign-in failed.")
        }
        token = t
        Keychain.saveToken(t)
    }

    /// Sign out kills the credential server-side FIRST — a token that only
    /// died locally is a token somebody else could still use.
    func signOut() async {
        if token != nil {
            var req = URLRequest(url: base.appending(path: "/api/auth/token"))
            req.httpMethod = "DELETE"
            attachAuth(&req)
            _ = try? await session.data(for: req)
        }
        token = nil
        Keychain.deleteToken()
    }

    // MARK: - Data

    func bootstrap() async throws -> BootstrapResponse {
        try await request("GET", "/api/bootstrap")
    }

    func quotes(symbols: [String]) async throws -> [APIQuote] {
        guard !symbols.isEmpty else { return [] }
        let joined = symbols.joined(separator: ",")
            .addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? ""
        let res: QuotesResponse = try await request("GET", "/api/market/quotes?symbols=\(joined)")
        return res.quotes
    }

    // MARK: - Plumbing

    private func attachAuth(_ req: inout URLRequest) {
        if let token { req.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization") }
    }

    private func request<Out: Decodable>(
        _ method: String, _ path: String,
        body: (some Encodable)? = Optional<Int>.none,
        authenticated: Bool = true
    ) async throws -> Out {
        guard let url = URL(string: path, relativeTo: base) else { throw TarsAPIError.network }
        var req = URLRequest(url: url)
        req.httpMethod = method
        if authenticated { attachAuth(&req) }
        if let body {
            req.setValue("application/json", forHTTPHeaderField: "Content-Type")
            req.httpBody = try JSONEncoder().encode(body)
        }

        let data: Data, response: URLResponse
        do {
            (data, response) = try await session.data(for: req)
        } catch {
            throw TarsAPIError.network
        }

        let status = (response as? HTTPURLResponse)?.statusCode ?? 0
        switch status {
        case 200...299:
            do { return try JSONDecoder().decode(Out.self, from: data) }
            catch { throw TarsAPIError.decoding }
        case 401:
            throw TarsAPIError.unauthorized
        case 429:
            throw TarsAPIError.rateLimited
        default:
            // The platform writes rejection reasons worth reading — pass them on.
            let msg = (try? JSONDecoder().decode(ServerErrorBody.self, from: data))?.error
            throw TarsAPIError.server(msg ?? "Something went wrong (\(status)).")
        }
    }
}

extension TarsAPIClient {
    /// The curated board — Trending by default, or one venue's own page.
    func board(category: String? = nil, limit: Int = 250) async throws -> BoardResponse {
        var path = "/api/market/board?limit=\(limit)"
        if let category, !category.isEmpty {
            path += "&category=\(category.lowercased())"
        }
        return try await request("GET", path)
    }
}
