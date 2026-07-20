import Foundation

/// Networking core: async/await, typed errors, retry with jittered backoff,
/// 429-awareness, response cache, and a token-bucket rate limiter tuned for
/// Massive's free tier. Every remote call in the app goes through this actor.
actor HTTPClient {
    struct CachedResponse {
        let data: Data
        let storedAt: Date
    }

    private let session: URLSession
    private var cache: [String: CachedResponse] = [:]
    private let cacheTTL: TimeInterval
    private var requestTimestamps: [Date] = []
    private let requestsPerMinute: Int?

    init(cacheTTL: TimeInterval = 60, requestsPerMinute: Int? = nil) {
        let config = URLSessionConfiguration.default
        config.timeoutIntervalForRequest = 20
        config.waitsForConnectivity = true
        self.session = URLSession(configuration: config)
        self.cacheTTL = cacheTTL
        self.requestsPerMinute = requestsPerMinute
    }

    func get<T: Decodable>(
        _ type: T.Type,
        url: URL,
        headers: [String: String] = [:],
        decoder: JSONDecoder = .tars,
        cacheable: Bool = true,
        maxRetries: Int = 3
    ) async throws -> T {
        let key = url.absoluteString
        if cacheable, let hit = cache[key], Date.now.timeIntervalSince(hit.storedAt) < cacheTTL {
            return try decode(type, from: hit.data, decoder: decoder)
        }

        var attempt = 0
        while true {
            try await respectRateLimit()
            var request = URLRequest(url: url)
            headers.forEach { request.setValue($1, forHTTPHeaderField: $0) }

            do {
                let (data, response) = try await session.data(for: request)
                let http = response as? HTTPURLResponse
                switch http?.statusCode ?? 0 {
                case 200..<300:
                    if cacheable { cache[key] = CachedResponse(data: data, storedAt: .now) }
                    return try decode(type, from: data, decoder: decoder)
                case 401, 403:
                    throw TarsError.unauthorized
                case 429:
                    let retryAfter = http?.value(forHTTPHeaderField: "Retry-After").flatMap(TimeInterval.init)
                    guard attempt < maxRetries else { throw TarsError.rateLimited(retryAfter: retryAfter) }
                    try await Task.sleep(for: .seconds(retryAfter ?? backoff(attempt: attempt)))
                case let code where code >= 500:
                    guard attempt < maxRetries else { throw TarsError.network("Server error \(code)") }
                    try await Task.sleep(for: .seconds(backoff(attempt: attempt)))
                default:
                    let body = String(data: data, encoding: .utf8) ?? ""
                    throw TarsError.network("HTTP \(http?.statusCode ?? -1): \(body.prefix(200))")
                }
            } catch let error as TarsError {
                throw error
            } catch {
                guard attempt < maxRetries else { throw TarsError.network(error.localizedDescription) }
                try await Task.sleep(for: .seconds(backoff(attempt: attempt)))
            }
            attempt += 1
        }
    }

    func send<T: Decodable, Body: Encodable>(
        _ type: T.Type,
        url: URL,
        method: String,
        body: Body?,
        headers: [String: String] = [:],
        decoder: JSONDecoder = .tars
    ) async throws -> T {
        var request = URLRequest(url: url)
        request.httpMethod = method
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        headers.forEach { request.setValue($1, forHTTPHeaderField: $0) }
        if let body {
            request.httpBody = try JSONEncoder.tars.encode(body)
        }
        let (data, response) = try await session.data(for: request)
        let code = (response as? HTTPURLResponse)?.statusCode ?? 0
        switch code {
        case 200..<300:
            return try decode(type, from: data, decoder: decoder)
        case 401, 403:
            throw TarsError.unauthorized
        case 422:
            let body = String(data: data, encoding: .utf8) ?? "unprocessable"
            throw TarsError.orderRejected(String(body.prefix(200)))
        default:
            let body = String(data: data, encoding: .utf8) ?? ""
            throw TarsError.network("HTTP \(code): \(body.prefix(200))")
        }
    }

    // MARK: - Internals

    private func decode<T: Decodable>(_ type: T.Type, from data: Data, decoder: JSONDecoder) throws -> T {
        do { return try decoder.decode(type, from: data) }
        catch { throw TarsError.decoding(String(describing: error).prefix(200).description) }
    }

    private func backoff(attempt: Int) -> Double {
        pow(2, Double(attempt)) + Double.random(in: 0...0.8)
    }

    /// Token-bucket over a sliding 60s window.
    private func respectRateLimit() async throws {
        guard let limit = requestsPerMinute else { return }
        let cutoff = Date.now.addingTimeInterval(-60)
        requestTimestamps.removeAll { $0 < cutoff }
        if requestTimestamps.count >= limit {
            let oldest = requestTimestamps[0]
            let wait = 60 - Date.now.timeIntervalSince(oldest) + 0.5
            if wait > 0 { try await Task.sleep(for: .seconds(wait)) }
        }
        requestTimestamps.append(.now)
    }
}

extension JSONDecoder {
    static let tars: JSONDecoder = {
        let d = JSONDecoder()
        d.keyDecodingStrategy = .convertFromSnakeCase
        d.dateDecodingStrategy = .iso8601
        return d
    }()
}

extension JSONEncoder {
    static let tars: JSONEncoder = {
        let e = JSONEncoder()
        e.keyEncodingStrategy = .convertToSnakeCase
        e.dateEncodingStrategy = .iso8601
        return e
    }()
}
