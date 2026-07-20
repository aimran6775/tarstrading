import Foundation

enum AppConfig {
    static let alpacaBase = URL(string: "https://paper-api.alpaca.markets/v2")!
    static let marketDataBase = URL(string: "https://api.massive.com")!

    /// Massive free tier: 5 requests/min. Stay under it.
    static let marketDataRequestsPerMinute = 5

    /// True when real API keys are present; otherwise the app runs on DemoMarket.
    static var hasLiveKeys: Bool {
        !Secrets.alpacaKeyID.isEmpty && !Secrets.alpacaSecret.isEmpty
    }

    static var hasMarketDataKey: Bool { !Secrets.massiveKey.isEmpty }

    /// Hard rule: this build is paper-only. There is no code path to a live
    /// brokerage endpoint; this flag exists so UI can badge state honestly.
    static let tradingMode: TradingMode = .paper

    static let appVersion = Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String ?? "1.0"
}

enum TradingMode: String {
    case paper, demo
    var badgeText: String {
        switch self {
        case .paper: "PAPER"
        case .demo: "DEMO"
        }
    }
}
