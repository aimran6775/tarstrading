import SwiftUI

/*
  The instrument dictionary — what each thing IS, in words a beginner can
  use. Names are ported from the web's lib/symbols.ts (one catalog, two
  clients); the teaching copy is the house voice: explain, never advise.

  This powers two things:
  - names under tickers on the board (a price without a name is a code), and
  - the long-press explainer: press any ticker and a card says what kind
    of thing it is, how it trades here, and what its data badge means.
*/
enum Instruments {

    // MARK: Names (ported from web/src/lib/symbols.ts — keep in sync)
    static let names: [String: String] = [
        "AAPL": "Apple",
        "MSFT": "Microsoft",
        "NVDA": "NVIDIA",
        "AMZN": "Amazon",
        "GOOG": "Alphabet (Google)",
        "META": "Meta Platforms",
        "TSLA": "Tesla",
        "AMD": "Advanced Micro Devices",
        "NFLX": "Netflix",
        "AVGO": "Broadcom",
        "INTC": "Intel",
        "MU": "Micron Technology",
        "CRM": "Salesforce",
        "ORCL": "Oracle",
        "ADBE": "Adobe",
        "PLTR": "Palantir",
        "SMCI": "Super Micro Computer",
        "COIN": "Coinbase",
        "JPM": "JPMorgan Chase",
        "BAC": "Bank of America",
        "GS": "Goldman Sachs",
        "V": "Visa",
        "MA": "Mastercard",
        "BRK.B": "Berkshire Hathaway",
        "UNH": "UnitedHealth",
        "LLY": "Eli Lilly",
        "JNJ": "Johnson & Johnson",
        "XOM": "Exxon Mobil",
        "CVX": "Chevron",
        "WMT": "Walmart",
        "COST": "Costco",
        "HD": "Home Depot",
        "MCD": "McDonald's",
        "KO": "Coca-Cola",
        "PEP": "PepsiCo",
        "DIS": "Disney",
        "BA": "Boeing",
        "CAT": "Caterpillar",
        "GE": "GE Aerospace",
        "F": "Ford",
        "UBER": "Uber",
        "ABNB": "Airbnb",
        "SHOP": "Shopify",
        "SQ": "Block",
        "PYPL": "PayPal",
        "HOOD": "Robinhood",
        "SOFI": "SoFi Technologies",
        "RBLX": "Roblox",
        "RDDT": "Reddit",
        "ARM": "Arm Holdings",
        "DELL": "Dell Technologies",
        "MRVL": "Marvell Technology",
        "QCOM": "Qualcomm",
        "TXN": "Texas Instruments",
        "CSCO": "Cisco",
        "IBM": "IBM",
        "NOW": "ServiceNow",
        "INTU": "Intuit",
        "PANW": "Palo Alto Networks",
        "CRWD": "CrowdStrike",
        "SNOW": "Snowflake",
        "DDOG": "Datadog",
        "NET": "Cloudflare",
        "SPOT": "Spotify",
        "TSM": "Taiwan Semiconductor",
        "ASML": "ASML Holding",
        "BABA": "Alibaba",
        "MELI": "MercadoLibre",
        "WFC": "Wells Fargo",
        "MS": "Morgan Stanley",
        "C": "Citigroup",
        "AXP": "American Express",
        "ABBV": "AbbVie",
        "MRK": "Merck",
        "PFE": "Pfizer",
        "TMO": "Thermo Fisher",
        "NKE": "Nike",
        "SBUX": "Starbucks",
        "LOW": "Lowe's",
        "TGT": "Target",
        "T": "AT&T",
        "VZ": "Verizon",
        "TMUS": "T-Mobile",
        "GM": "General Motors",
        "RIVN": "Rivian",
        "DAL": "Delta Air Lines",
        "MAR": "Marriott",
        "CVNA": "Carvana",
        "AFRM": "Affirm",
        "DASH": "DoorDash",
        "SPY": "S&P 500 ETF",
        "QQQ": "Nasdaq-100 ETF",
        "IWM": "Russell 2000 ETF",
        "DIA": "Dow Jones ETF",
        "VTI": "Total US Market ETF",
        "GLD": "Gold ETF",
        "SLV": "Silver ETF",
        "USO": "US Oil Fund",
        "TLT": "20+ Year Treasury ETF",
        "ARKK": "ARK Innovation ETF",
        "SMH": "Semiconductor ETF",
        "VOO": "Vanguard S&P 500 ETF",
        "SCHD": "Schwab Dividend ETF",
        "XLK": "Technology Sector ETF",
        "XLF": "Financials Sector ETF",
        "XLE": "Energy Sector ETF",
        "XLV": "Health Care Sector ETF",
        "XLY": "Consumer Discretionary ETF",
        "XLI": "Industrials Sector ETF",
        "EEM": "Emerging Markets ETF",
        "EFA": "Developed Markets ETF",
        "VNQ": "Real Estate ETF",
        "HYG": "High-Yield Bond ETF",
        "AGG": "US Aggregate Bond ETF",
        "TQQQ": "3x Nasdaq-100 ETF",
        "SQQQ": "-3x Nasdaq-100 ETF",
        "SOXL": "3x Semiconductor ETF",
        "GDX": "Gold Miners ETF",
        "BITO": "Bitcoin Strategy ETF",
        "BTC/USD": "Bitcoin",
        "ETH/USD": "Ethereum",
        "SOL/USD": "Solana",
        "XRP/USD": "XRP",
        "DOGE/USD": "Dogecoin",
        "AVAX/USD": "Avalanche",
        "LINK/USD": "Chainlink",
        "DOT/USD": "Polkadot",
        "LTC/USD": "Litecoin",
        "BCH/USD": "Bitcoin Cash",
        "UNI/USD": "Uniswap",
        "AAVE/USD": "Aave",
        "SHIB/USD": "Shiba Inu",
        "MKR/USD": "Maker",
        "CRV/USD": "Curve DAO",
        "GRT/USD": "The Graph",
        "XTZ/USD": "Tezos",
        "BAT/USD": "Basic Attention",
        // Indices and futures the board lists beyond the web catalog.
        "SPX": "S&P 500 Index", "NDX": "Nasdaq-100 Index",
        "COMP": "Nasdaq Composite", "DJI": "Dow Jones Industrial",
        "RUT": "Russell 2000 Index", "VIX": "Volatility Index",
    ]

    static func name(_ symbol: String) -> String? {
        if let n = names[symbol] { return n }
        if symbol.hasPrefix("FX:") {
            let pair = SymbolDisplay.pretty(symbol)
            return "\(pair) exchange rate"
        }
        if symbol.hasPrefix("FUT:") { return "Futures contract" }
        return nil
    }

    // MARK: Kind — what species of market this is

    enum Kind: String {
        case stock = "STOCK", etf = "ETF", crypto = "CRYPTO",
             fx = "FX PAIR", index = "INDEX", future = "FUTURES"

        var tone: Color {
            switch self {
            case .stock: TarsTheme.inkSecondary
            case .etf: TarsTheme.accent
            case .crypto: TarsTheme.warning
            case .fx: TarsTheme.inkSecondary
            case .index: TarsTheme.inkTertiary
            case .future: TarsTheme.agentPurple
            }
        }
    }

    static let indexSymbols: Set<String> = ["SPX", "NDX", "COMP", "DJI", "RUT", "VIX"]
    static let etfSymbols: Set<String> = [
        "SPY", "QQQ", "IWM", "DIA", "VTI", "GLD", "SLV", "USO", "TLT", "ARKK",
        "SMH", "VOO", "SCHD", "XLK", "XLF", "XLE", "XLV", "XLY", "XLI", "EEM",
        "EFA", "VNQ", "HYG", "AGG", "TQQQ", "SQQQ", "SOXL", "GDX", "BITO", "UVIX",
    ]

    static func kind(_ symbol: String, category: String? = nil) -> Kind {
        if symbol.contains("/") { return .crypto }
        if symbol.hasPrefix("FX:") { return .fx }
        if symbol.hasPrefix("FUT:") || category == "Futures" { return .future }
        if indexSymbols.contains(symbol) || category == "Indices" { return .index }
        if etfSymbols.contains(symbol) || category == "ETFs" { return .etf }
        return .stock
    }

    // MARK: The teaching copy — what it is, and how it trades here

    static func what(_ symbol: String, kind: Kind) -> String {
        // Flagships get their own sentence; everything else gets its species.
        switch symbol {
        case "SPY": return "One share of SPY holds a slice of all 500 companies in the S&P 500 — the broadest single bet on the US market."
        case "QQQ": return "One share of QQQ holds the 100 biggest Nasdaq companies — the tech-heavy end of the market."
        case "DIA": return "DIA tracks the Dow Jones Industrial Average — 30 blue-chip US companies."
        case "IWM": return "IWM tracks the Russell 2000 — two thousand smaller US companies. Small caps swing harder, both ways."
        case "VIX": return "The market's fear gauge — it measures how much movement traders EXPECT in the S&P 500 over the next 30 days. It spikes when stocks fall."
        case "BTC/USD": return "Bitcoin priced in dollars. The oldest cryptocurrency — no company, no earnings, just supply, demand, and conviction."
        case "ETH/USD": return "Ethereum priced in dollars — the network most crypto apps are built on."
        case "TQQQ": return "A 3x LEVERAGED fund: it aims for triple the Nasdaq-100's DAILY move. Leverage decays over time — visit the Academy before sizing this."
        case "SQQQ": return "An INVERSE 3x fund: it gains when the Nasdaq-100 falls, times three, per day. Decay is brutal — a tool for days, not months."
        case "GLD": return "GLD holds gold bullion in a vault — one share is roughly a tenth of an ounce of gold exposure."
        case "TLT": return "TLT holds 20-year-plus US Treasury bonds. It rises when interest rates fall, and falls when they rise."
        default: break
        }
        switch kind {
        case .stock: return "A share of one company. You own a slice of its business — its profits, its risks, its news."
        case .etf: return "An ETF — a basket of many holdings you buy in one share. Diversification without picking each name."
        case .crypto: return "A cryptocurrency priced in dollars. Trades around the clock, every day — no opening bell, no closing bell."
        case .fx: return "A currency pair — the price of one currency in another. Moves in tiny increments called pips; the venue marks at daily ECB rates."
        case .index: return "An index — a NUMBER that measures a slice of the market. You can't buy it directly; trade its ETF or its future instead."
        case .future: return "A futures contract — an agreement on a price for a future date. You post margin instead of paying principal, and settle the difference daily."
        }
    }

    static func how(_ kind: Kind) -> String {
        switch kind {
        case .stock, .etf: return "Trades here 9:30–4:00 ET. Market, limit, stop and trailing orders; long or short."
        case .crypto: return "Trades here 24/7. Fills carry a 25 bps commission, priced into the math."
        case .fx: return "Marked at daily ECB rates; P&L converts to dollars at the same rates."
        case .index: return "Quote-only on this desk — a benchmark to read, not an order to place."
        case .future: return "Post initial margin, settle variation daily. The ticket lists exactly what it requires."
        }
    }

    /// What the data badge means — beginners read "EOD" as noise.
    static func provenanceNote(_ p: Provenance?) -> String? {
        switch p {
        case .live: return "LIVE — this price is ticking in real time."
        case .delayed: return "Delayed — the price is real but runs about 15 minutes behind."
        case .eod: return "EOD — end-of-day print; it updates after each session closes."
        case .derived: return "DERIVED — computed from related markets, not quoted directly."
        default: return nil
        }
    }
}

// MARK: - The long-press explainer card

/// What pops up when you press and hold any ticker: the thing, named and
/// explained. The card teaches; the menu acts.
struct InstrumentExplainer: View {
    let symbol: String
    var category: String? = nil
    var price: Double? = nil
    var changePercent: Double? = nil
    var provenance: Provenance? = nil

    private var kind: Instruments.Kind { Instruments.kind(symbol, category: category) }

    var body: some View {
        VStack(alignment: .leading, spacing: TarsTheme.Space.m) {
            HStack(alignment: .firstTextBaseline) {
                VStack(alignment: .leading, spacing: 2) {
                    Text(SymbolDisplay.pretty(symbol))
                        .font(TarsTheme.Text.title)
                        .foregroundStyle(TarsTheme.inkPrimary)
                    if let n = Instruments.name(symbol) {
                        Text(n)
                            .font(TarsTheme.Text.caption)
                            .foregroundStyle(TarsTheme.inkSecondary)
                    }
                }
                Spacer()
                Text(kind.rawValue)
                    .font(.system(size: 9, weight: .bold, design: .monospaced))
                    .kerning(0.8)
                    .foregroundStyle(kind.tone)
                    .padding(.horizontal, 8).padding(.vertical, 4)
                    .background(Capsule().fill(kind.tone.opacity(0.12)))
            }

            if let price {
                HStack(spacing: TarsTheme.Space.s) {
                    Text(SymbolDisplay.price(symbol, price))
                        .font(TarsTheme.Text.heading.monospacedDigit())
                        .foregroundStyle(TarsTheme.inkPrimary)
                    if let chg = changePercent {
                        let shown = abs(chg) < 0.00005 ? 0 : chg
                        Text("\(shown > 0 ? "+" : "")\(shown * 100, specifier: "%.2f")%")
                            .font(TarsTheme.Text.caption.monospacedDigit())
                            .foregroundStyle(TarsTheme.pnl(shown))
                    }
                }
            }

            Text(Instruments.what(symbol, kind: kind))
                .font(TarsTheme.Text.body)
                .foregroundStyle(TarsTheme.inkPrimary)
                .fixedSize(horizontal: false, vertical: true)

            Text(Instruments.how(kind))
                .font(TarsTheme.Text.caption)
                .foregroundStyle(TarsTheme.inkSecondary)
                .fixedSize(horizontal: false, vertical: true)

            if let note = Instruments.provenanceNote(provenance) {
                Text(note)
                    .font(TarsTheme.Text.micro)
                    .foregroundStyle(TarsTheme.inkTertiary)
                    .fixedSize(horizontal: false, vertical: true)
            }
        }
        .padding(TarsTheme.Space.xl)
        .frame(width: 340, alignment: .leading)
        .background(TarsTheme.bg1)
    }
}
