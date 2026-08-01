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

    /// A real profile per instrument: the company's full name, what the
    /// business actually DOES, and what tends to move it. Generic species
    /// copy ("a share of one company") teaches a beginner nothing — the
    /// question they're asking is "what IS this?".
    struct Profile {
        let name: String     // full legal-ish name
        let sector: String   // one-line classification
        let what: String     // what it does, in plain English
        let moves: String    // what tends to move the price
    }

    static let profiles: [String: Profile] = [
        "AAPL": .init(name: "Apple Inc.", sector: "Consumer technology",
                      what: "Makes the iPhone, Mac, iPad, Watch and AirPods, and runs the App Store and iCloud services on top of them.", moves: "iPhone sales cycles and the growth of its services business."),
        "MSFT": .init(name: "Microsoft Corporation", sector: "Software & cloud",
                      what: "Sells Windows and Office, and runs Azure — the world's second-largest cloud platform. Also owns LinkedIn, GitHub and Xbox.", moves: "Azure's growth rate and enterprise software spending."),
        "NVDA": .init(name: "NVIDIA Corporation", sector: "Semiconductors",
                      what: "Designs the GPUs that train and run almost all modern AI, plus chips for gaming and data centres.", moves: "AI data-centre demand — its results move the whole chip sector."),
        "AMZN": .init(name: "Amazon.com, Inc.", sector: "E-commerce & cloud",
                      what: "Runs the world's largest online store and AWS, the biggest cloud computing platform. Also owns Prime Video and Whole Foods.", moves: "AWS growth and retail margins, which are thin by design."),
        "GOOG": .init(name: "Alphabet Inc.", sector: "Internet & advertising",
                      what: "Google's parent: search, YouTube, Android, Chrome and Google Cloud. Most of the money still comes from advertising.", moves: "Search ad spending and how AI reshapes search."),
        "META": .init(name: "Meta Platforms, Inc.", sector: "Social media",
                      what: "Owns Facebook, Instagram, WhatsApp and Threads, and spends heavily on AI and virtual reality (Reality Labs).", moves: "Ad revenue per user and how much it burns on the metaverse."),
        "TSLA": .init(name: "Tesla, Inc.", sector: "Electric vehicles",
                      what: "Builds electric cars, batteries and solar products, and is betting on self-driving software and robots.", moves: "Delivery numbers, price cuts, and belief in its self-driving promises."),
        "AMD": .init(name: "Advanced Micro Devices, Inc.", sector: "Semiconductors",
                      what: "Makes CPUs and GPUs that compete directly with Intel and NVIDIA, in PCs, servers and game consoles.", moves: "Server-chip share gains and its distant second place in AI silicon."),
        "NFLX": .init(name: "Netflix, Inc.", sector: "Streaming media",
                      what: "The largest subscription streaming service, now also selling a cheaper ad-supported tier and live events.", moves: "Subscriber additions and how well the ad tier sells."),
        "AVGO": .init(name: "Broadcom Inc.", sector: "Semiconductors & software",
                      what: "Makes networking, broadband and custom AI chips, and owns VMware's enterprise software business.", moves: "Custom AI chip orders from the big cloud providers."),
        "INTC": .init(name: "Intel Corporation", sector: "Semiconductors",
                      what: "The classic PC and server chipmaker, now trying to become a contract manufacturer for other companies' designs.", moves: "Whether its expensive factory build-out wins outside customers."),
        "MU": .init(name: "Micron Technology, Inc.", sector: "Semiconductors",
                      what: "Makes memory chips — DRAM and flash storage — including the high-bandwidth memory that AI accelerators need.", moves: "Memory prices, which swing hard in boom-and-bust cycles."),
        "CRM": .init(name: "Salesforce, Inc.", sector: "Enterprise software",
                      what: "Sells the cloud software companies use to track customers, sales and support.", moves: "Seat growth and corporate software budgets."),
        "ORCL": .init(name: "Oracle Corporation", sector: "Enterprise software & cloud",
                      what: "Database software for large institutions, now aggressively renting out AI cloud capacity.", moves: "Cloud backlog — the contracts it has signed but not yet delivered."),
        "ADBE": .init(name: "Adobe Inc.", sector: "Creative software",
                      what: "Photoshop, Illustrator, Premiere and Acrobat, all sold as subscriptions.", moves: "Whether AI image tools expand its market or erode it."),
        "PLTR": .init(name: "Palantir Technologies Inc.", sector: "Data & AI software",
                      what: "Builds data-analysis platforms for governments, defence agencies and large companies.", moves: "Government contract awards and its commercial expansion."),
        "SMCI": .init(name: "Super Micro Computer, Inc.", sector: "Server hardware",
                      what: "Assembles the physical servers and racks that data centres fill with AI chips.", moves: "AI build-out spending — and a history of accounting controversy."),
        "COIN": .init(name: "Coinbase Global, Inc.", sector: "Crypto exchange",
                      what: "The largest US crypto exchange, earning fees when people trade digital assets.", moves: "Crypto prices and trading volume — it is a leveraged bet on the sector."),
        "JPM": .init(name: "JPMorgan Chase & Co.", sector: "Banking",
                      what: "The largest US bank: consumer accounts, corporate lending, investment banking and trading.", moves: "Interest rates and credit losses across the economy."),
        "BAC": .init(name: "Bank of America Corporation", sector: "Banking",
                      what: "A giant consumer and commercial bank, with a huge portfolio of deposits and loans.", moves: "Rate moves — it is unusually sensitive to them."),
        "GS": .init(name: "The Goldman Sachs Group, Inc.", sector: "Investment banking",
                      what: "Advises on mergers, underwrites share sales, and trades for institutions.", moves: "Deal activity and market volatility."),
        "V": .init(name: "Visa Inc.", sector: "Payments network",
                      what: "Runs the rails that carry card payments between banks. It takes a small cut of the spending; it does not lend.", moves: "Consumer spending volume and cross-border travel."),
        "MA": .init(name: "Mastercard Incorporated", sector: "Payments network",
                      what: "Visa's direct competitor — the second global card network, also a toll on spending rather than a lender.", moves: "Payment volumes and international travel."),
        "BRK.B": .init(name: "Berkshire Hathaway Inc. (Class B)", sector: "Conglomerate",
                      what: "Warren Buffett's holding company: insurance (GEICO), railways (BNSF), energy, plus a huge stock portfolio led by Apple.", moves: "The performance of its subsidiaries and its enormous cash pile."),
        "UNH": .init(name: "UnitedHealth Group Incorporated", sector: "Health insurance",
                      what: "The largest US health insurer, and through Optum, a huge provider of care and pharmacy services.", moves: "Medical cost ratios — how much of each premium goes to care."),
        "LLY": .init(name: "Eli Lilly and Company", sector: "Pharmaceuticals",
                      what: "Drugmaker behind the weight-loss and diabetes treatments Mounjaro and Zepbound.", moves: "Obesity-drug demand and manufacturing capacity."),
        "JNJ": .init(name: "Johnson & Johnson", sector: "Pharmaceuticals",
                      what: "Prescription medicines and medical devices, after spinning off its consumer brands.", moves: "Drug pipelines and litigation over talc and opioids."),
        "XOM": .init(name: "Exxon Mobil Corporation", sector: "Oil & gas",
                      what: "One of the largest integrated oil companies: it drills, refines and sells fuel worldwide.", moves: "The price of crude oil, more than anything it does itself."),
        "CVX": .init(name: "Chevron Corporation", sector: "Oil & gas",
                      what: "Integrated oil major with major operations in the Permian Basin and Kazakhstan.", moves: "Crude prices and production growth."),
        "WMT": .init(name: "Walmart Inc.", sector: "Retail",
                      what: "The largest retailer on earth by revenue, and increasingly an online and advertising business too.", moves: "Grocery traffic and how thrifty shoppers are feeling."),
        "COST": .init(name: "Costco Wholesale Corporation", sector: "Retail",
                      what: "Membership warehouse clubs — most of the actual profit comes from membership fees, not the goods.", moves: "Membership renewal rates and fee increases."),
        "HD": .init(name: "The Home Depot, Inc.", sector: "Retail",
                      what: "The biggest home-improvement chain, serving both homeowners and contractors.", moves: "Housing turnover and mortgage rates."),
        "MCD": .init(name: "McDonald's Corporation", sector: "Restaurants",
                      what: "The largest fast-food chain — and, in practice, a giant franchiser and property owner.", moves: "Same-store sales and value-menu pricing."),
        "KO": .init(name: "The Coca-Cola Company", sector: "Beverages",
                      what: "Sells concentrate and brands to bottlers worldwide: Coke, Sprite, Fanta, Dasani.", moves: "Pricing power and currency swings abroad."),
        "PEP": .init(name: "PepsiCo, Inc.", sector: "Food & beverages",
                      what: "Pepsi drinks plus Frito-Lay snacks and Quaker foods — the snack half is the bigger profit engine.", moves: "Snack volumes and input costs."),
        "DIS": .init(name: "The Walt Disney Company", sector: "Media & entertainment",
                      what: "Film studios, ESPN, ABC, theme parks and cruise lines, plus Disney+ streaming.", moves: "Park attendance and streaming profitability."),
        "BA": .init(name: "The Boeing Company", sector: "Aerospace & defence",
                      what: "Builds commercial jets and defence systems — one half of the world's aircraft duopoly with Airbus.", moves: "Delivery rates, safety regulation, and its order backlog."),
        "CAT": .init(name: "Caterpillar Inc.", sector: "Heavy machinery",
                      what: "Makes construction and mining equipment — a bellwether for global building activity.", moves: "Infrastructure spending and mining capital budgets."),
        "GE": .init(name: "GE Aerospace", sector: "Aerospace",
                      what: "Builds and services jet engines, after splitting off its healthcare and energy arms.", moves: "Air traffic and lucrative engine servicing contracts."),
        "F": .init(name: "Ford Motor Company", sector: "Automotive",
                      what: "Trucks (the F-150), commercial vans, and a loss-making but strategic EV division.", moves: "Truck demand, labour costs, and EV losses."),
        "UBER": .init(name: "Uber Technologies, Inc.", sector: "Mobility & delivery",
                      what: "Ride-hailing and food delivery, plus a growing freight and advertising business.", moves: "Trip growth and driver supply costs."),
        "ABNB": .init(name: "Airbnb, Inc.", sector: "Travel",
                      what: "A marketplace for short-term stays; it takes a cut of each booking rather than owning property.", moves: "Travel demand and city-by-city regulation."),
        "SHOP": .init(name: "Shopify Inc.", sector: "E-commerce software",
                      what: "Software that lets merchants run their own online stores, plus payments and logistics tools.", moves: "Merchant sales volume — it earns a slice of what they sell."),
        "SQ": .init(name: "Block, Inc.", sector: "Payments & fintech",
                      what: "Square card readers for small businesses and the Cash App consumer wallet, plus bitcoin services.", moves: "Cash App user growth and small-business health."),
        "PYPL": .init(name: "PayPal Holdings, Inc.", sector: "Payments",
                      what: "Online checkout, Venmo, and Braintree's payment processing behind the scenes.", moves: "Transaction margins under pressure from newer rivals."),
        "HOOD": .init(name: "Robinhood Markets, Inc.", sector: "Brokerage",
                      what: "A commission-free trading app for stocks, options and crypto, earning mostly from order flow and interest.", moves: "Retail trading activity and crypto volume."),
        "SOFI": .init(name: "SoFi Technologies, Inc.", sector: "Digital banking",
                      what: "An online bank that started in student loans and now offers accounts, investing and lending.", moves: "Deposit growth and loan credit quality."),
        "RBLX": .init(name: "Roblox Corporation", sector: "Gaming platform",
                      what: "A platform where users build and play each other's games, monetised through its Robux currency.", moves: "Daily users and hours engaged, mostly younger players."),
        "RDDT": .init(name: "Reddit, Inc.", sector: "Social media",
                      what: "The forum network of subreddits, earning from advertising and from licensing its text to AI companies.", moves: "User growth and AI data-licensing deals."),
        "ARM": .init(name: "Arm Holdings plc", sector: "Semiconductor IP",
                      what: "Designs the chip architecture almost every smartphone uses, and licenses it out rather than manufacturing.", moves: "Royalty rates and its push into data-centre chips."),
        "DELL": .init(name: "Dell Technologies Inc.", sector: "Computer hardware",
                      what: "PCs, servers and storage, now selling AI server racks to data centres.", moves: "AI server orders against thin hardware margins."),
        "MRVL": .init(name: "Marvell Technology, Inc.", sector: "Semiconductors",
                      what: "Makes networking and custom silicon that moves data inside data centres.", moves: "Custom AI chip programmes with hyperscale customers."),
        "QCOM": .init(name: "QUALCOMM Incorporated", sector: "Semiconductors",
                      what: "Smartphone processors and the modem patents most phones must license.", moves: "Phone sales and its licensing disputes."),
        "TXN": .init(name: "Texas Instruments Incorporated", sector: "Semiconductors",
                      what: "Analog chips — the unglamorous components inside cars, factories and appliances.", moves: "Industrial and automotive demand cycles."),
        "CSCO": .init(name: "Cisco Systems, Inc.", sector: "Networking",
                      what: "Routers, switches and security software that carry enterprise and internet traffic.", moves: "Enterprise network upgrade cycles."),
        "IBM": .init(name: "International Business Machines Corporation", sector: "Enterprise IT",
                      what: "Consulting, mainframes, hybrid cloud (Red Hat) and quantum computing research.", moves: "Software and consulting growth against a shrinking legacy base."),
        "NOW": .init(name: "ServiceNow, Inc.", sector: "Enterprise software",
                      what: "Workflow software that automates IT, HR and customer service tickets inside large companies.", moves: "Subscription renewals and large enterprise deals."),
        "INTU": .init(name: "Intuit Inc.", sector: "Financial software",
                      what: "TurboTax, QuickBooks, Credit Karma and Mailchimp — small business and consumer finance software.", moves: "Tax season results and small-business formation."),
        "PANW": .init(name: "Palo Alto Networks, Inc.", sector: "Cybersecurity",
                      what: "Firewalls and cloud security for large organisations.", moves: "Security budgets, which tend to survive cost cutting."),
        "CRWD": .init(name: "CrowdStrike Holdings, Inc.", sector: "Cybersecurity",
                      what: "Cloud-delivered software that protects laptops and servers from attack.", moves: "Subscription growth and its reputation after outages."),
        "SNOW": .init(name: "Snowflake Inc.", sector: "Data cloud",
                      what: "A cloud data warehouse companies use to store and query enormous datasets.", moves: "Consumption — customers pay for what they run, so usage is revenue."),
        "DDOG": .init(name: "Datadog, Inc.", sector: "Software monitoring",
                      what: "Watches whether other companies' software and infrastructure is healthy.", moves: "Cloud usage growth among its customers."),
        "NET": .init(name: "Cloudflare, Inc.", sector: "Internet infrastructure",
                      what: "A global network that speeds up and protects websites, and increasingly runs code at the edge.", moves: "Large enterprise contracts and developer adoption."),
        "SPOT": .init(name: "Spotify Technology S.A.", sector: "Music streaming",
                      what: "The largest music streaming service, with podcasts and audiobooks layered on.", moves: "Subscriber growth and the royalties it owes labels."),
        "TSM": .init(name: "Taiwan Semiconductor Manufacturing Company", sector: "Semiconductor foundry",
                      what: "Manufactures the chips that Apple, NVIDIA and AMD design — the most advanced foundry in the world.", moves: "Leading-edge capacity, AI demand, and Taiwan geopolitics."),
        "ASML": .init(name: "ASML Holding N.V.", sector: "Semiconductor equipment",
                      what: "The only company making EUV lithography machines — no advanced chip exists without them.", moves: "Machine orders and export restrictions to China."),
        "BABA": .init(name: "Alibaba Group Holding Limited", sector: "E-commerce & cloud",
                      what: "China's largest e-commerce group (Taobao, Tmall) plus its cloud division.", moves: "Chinese consumer spending and Beijing's regulatory mood."),
        "MELI": .init(name: "MercadoLibre, Inc.", sector: "E-commerce & fintech",
                      what: "Latin America's dominant online marketplace, with Mercado Pago payments attached.", moves: "Regional growth and currency instability."),
        "WFC": .init(name: "Wells Fargo & Company", sector: "Banking",
                      what: "A large US consumer and commercial bank, long constrained by regulatory penalties.", moves: "Rates, and relief from its regulatory asset cap."),
        "MS": .init(name: "Morgan Stanley", sector: "Investment banking & wealth",
                      what: "Investment banking plus a very large wealth management arm managing client money.", moves: "Market levels — fee income tracks asset values."),
        "C": .init(name: "Citigroup Inc.", sector: "Banking",
                      what: "A global bank with unusually large international and corporate treasury operations.", moves: "Its long restructuring and global rate spreads."),
        "AXP": .init(name: "American Express Company", sector: "Payments & lending",
                      what: "Unlike Visa, it issues its own cards and lends — earning fees and interest from affluent spenders.", moves: "Affluent consumer spending and travel."),
        "ABBV": .init(name: "AbbVie Inc.", sector: "Pharmaceuticals",
                      what: "Immunology drugs Skyrizi and Rinvoq, plus Botox, after Humira lost exclusivity.", moves: "How fast newer drugs replace Humira's lost revenue."),
        "MRK": .init(name: "Merck & Co., Inc.", sector: "Pharmaceuticals",
                      what: "Best known for Keytruda, the leading cancer immunotherapy.", moves: "Keytruda's patent cliff and the pipeline behind it."),
        "PFE": .init(name: "Pfizer Inc.", sector: "Pharmaceuticals",
                      what: "Vaccines and medicines, still normalising after its COVID-era boom.", moves: "Pipeline results and post-pandemic revenue decline."),
        "TMO": .init(name: "Thermo Fisher Scientific Inc.", sector: "Life sciences tools",
                      what: "Sells the instruments and reagents laboratories use — a supplier to the whole industry.", moves: "Pharma research budgets."),
        "NKE": .init(name: "NIKE, Inc.", sector: "Apparel & footwear",
                      what: "The largest athletic footwear and apparel brand, shifting toward selling direct to consumers.", moves: "Wholesale orders and China demand."),
        "SBUX": .init(name: "Starbucks Corporation", sector: "Restaurants",
                      what: "The global coffeehouse chain, with a huge mobile ordering and rewards business.", moves: "Same-store sales and China's recovery."),
        "LOW": .init(name: "Lowe's Companies, Inc.", sector: "Retail",
                      what: "The second-largest home-improvement chain, weighted toward DIY customers.", moves: "Home renovation demand and rates."),
        "TGT": .init(name: "Target Corporation", sector: "Retail",
                      what: "A general merchandise retailer leaning on apparel and home goods more than groceries.", moves: "Discretionary spending, which swings with sentiment."),
        "T": .init(name: "AT&T Inc.", sector: "Telecommunications",
                      what: "US mobile and fibre broadband, after shedding its media ambitions.", moves: "Subscriber additions and its dividend's safety."),
        "VZ": .init(name: "Verizon Communications Inc.", sector: "Telecommunications",
                      what: "A large US wireless carrier with a growing fibre and fixed-wireless business.", moves: "Phone subscriber churn and dividend coverage."),
        "TMUS": .init(name: "T-Mobile US, Inc.", sector: "Telecommunications",
                      what: "The wireless carrier that grew fastest after the Sprint merger, with the deepest 5G spectrum.", moves: "Subscriber share gains from rivals."),
        "GM": .init(name: "General Motors Company", sector: "Automotive",
                      what: "Chevrolet, GMC, Cadillac and Buick, plus the Cruise self-driving unit.", moves: "Truck and SUV margins, and EV losses."),
        "RIVN": .init(name: "Rivian Automotive, Inc.", sector: "Electric vehicles",
                      what: "Builds electric trucks and SUVs, and delivery vans for Amazon.", moves: "Production ramp and how fast it burns cash."),
        "DAL": .init(name: "Delta Air Lines, Inc.", sector: "Airlines",
                      what: "A major US airline, unusually reliant on premium cabins and its credit-card partnership.", moves: "Travel demand and jet fuel prices."),
        "MAR": .init(name: "Marriott International, Inc.", sector: "Hotels",
                      what: "The largest hotel group — it franchises and manages brands rather than owning most buildings.", moves: "Room rates and business travel."),
        "CVNA": .init(name: "Carvana Co.", sector: "Auto retail",
                      what: "Sells used cars entirely online, delivering them or dispensing them from vending-machine towers.", moves: "Used car prices and its heavy debt load."),
        "AFRM": .init(name: "Affirm Holdings, Inc.", sector: "Consumer lending",
                      what: "Buy-now-pay-later loans offered at online checkout.", moves: "Consumer credit quality and funding costs."),
        "DASH": .init(name: "DoorDash, Inc.", sector: "Delivery",
                      what: "The largest US food-delivery platform, expanding into groceries and retail.", moves: "Order frequency and its take rate per delivery."),
        "SPY": .init(name: "SPDR S&P 500 ETF Trust", sector: "US large-cap ETF",
                      what: "One share holds a slice of all 500 companies in the S&P 500 — the broadest single bet on the US market. The oldest and most traded ETF in existence.", moves: "The US economy in aggregate; it IS the market benchmark."),
        "QQQ": .init(name: "Invesco QQQ Trust", sector: "US tech ETF",
                      what: "Holds the 100 largest non-financial Nasdaq companies — very concentrated in big tech.", moves: "Technology earnings and interest rates."),
        "IWM": .init(name: "iShares Russell 2000 ETF", sector: "US small-cap ETF",
                      what: "Holds two thousand smaller US companies. Small caps swing harder than large ones, in both directions.", moves: "Domestic economic health and credit conditions."),
        "DIA": .init(name: "SPDR Dow Jones Industrial Average ETF", sector: "US blue-chip ETF",
                      what: "Tracks the 30 companies of the Dow — weighted by share price, an old-fashioned quirk.", moves: "Large industrial and consumer names."),
        "VTI": .init(name: "Vanguard Total Stock Market ETF", sector: "Total US market ETF",
                      what: "Holds essentially every publicly traded US company, large and small, in one fund.", moves: "The entire US equity market."),
        "GLD": .init(name: "SPDR Gold Shares", sector: "Commodity ETF",
                      what: "Holds physical gold bullion in a vault; one share is a small fraction of an ounce.", moves: "Real interest rates, the dollar, and fear."),
        "SLV": .init(name: "iShares Silver Trust", sector: "Commodity ETF",
                      what: "Holds physical silver — part precious metal, part industrial input, so it moves more violently than gold.", moves: "Industrial demand and precious-metal sentiment."),
        "USO": .init(name: "United States Oil Fund", sector: "Commodity ETF",
                      what: "Tracks crude oil using futures contracts, which means it can drift from the spot price over time.", moves: "Oil prices and the shape of the futures curve."),
        "TLT": .init(name: "iShares 20+ Year Treasury Bond ETF", sector: "Bond ETF",
                      what: "Holds long-dated US government bonds. It rises when interest rates fall and falls when they rise.", moves: "Long-term interest rates — its whole story."),
        "ARKK": .init(name: "ARK Innovation ETF", sector: "Thematic ETF",
                      what: "An actively managed fund concentrated in speculative, high-growth technology bets.", moves: "Risk appetite; it amplifies both booms and busts."),
        "SMH": .init(name: "VanEck Semiconductor ETF", sector: "Sector ETF",
                      what: "Holds the largest chipmakers — NVIDIA, TSMC, Broadcom and peers — in one basket.", moves: "The semiconductor cycle and AI spending."),
        "VOO": .init(name: "Vanguard S&P 500 ETF", sector: "US large-cap ETF",
                      what: "The same S&P 500 as SPY, at one of the lowest fees available.", moves: "The US market; the difference from SPY is cost, not holdings."),
        "SCHD": .init(name: "Schwab U.S. Dividend Equity ETF", sector: "Dividend ETF",
                      what: "Screens for established US companies with a long record of paying dividends.", moves: "Rates and the appeal of income versus growth."),
        "XLK": .init(name: "Technology Select Sector SPDR Fund", sector: "Sector ETF",
                      what: "The technology slice of the S&P 500 in one fund.", moves: "Big-tech earnings."),
        "XLF": .init(name: "Financial Select Sector SPDR Fund", sector: "Sector ETF",
                      what: "Banks, insurers and asset managers from the S&P 500.", moves: "Interest rates and credit conditions."),
        "XLE": .init(name: "Energy Select Sector SPDR Fund", sector: "Sector ETF",
                      what: "The S&P 500's oil and gas producers and servicers.", moves: "Crude oil and natural gas prices."),
        "XLV": .init(name: "Health Care Select Sector SPDR Fund", sector: "Sector ETF",
                      what: "Pharma, insurers and device makers from the S&P 500.", moves: "Drug pipelines and health policy."),
        "XLY": .init(name: "Consumer Discretionary Select Sector SPDR", sector: "Sector ETF",
                      what: "The things people buy when they feel comfortable — cars, restaurants, retail. Amazon and Tesla dominate it.", moves: "Consumer confidence and spending."),
        "XLI": .init(name: "Industrial Select Sector SPDR Fund", sector: "Sector ETF",
                      what: "Machinery, aerospace, railways and logistics.", moves: "Manufacturing activity and infrastructure spending."),
        "EEM": .init(name: "iShares MSCI Emerging Markets ETF", sector: "International ETF",
                      what: "Stocks from developing economies — China, India, Taiwan, Brazil and others.", moves: "The dollar, global growth, and China."),
        "EFA": .init(name: "iShares MSCI EAFE ETF", sector: "International ETF",
                      what: "Developed markets outside North America: Europe, Australasia and the Far East.", moves: "Foreign currencies and non-US growth."),
        "VNQ": .init(name: "Vanguard Real Estate ETF", sector: "Real estate ETF",
                      what: "Holds REITs — companies that own income-producing property and must pay out most profits.", moves: "Interest rates and property occupancy."),
        "HYG": .init(name: "iShares iBoxx High Yield Corporate Bond ETF", sector: "Bond ETF",
                      what: "Holds 'junk' bonds — debt from companies with weaker credit, paying higher interest for the risk.", moves: "Credit spreads; it falls when investors fear defaults."),
        "AGG": .init(name: "iShares Core U.S. Aggregate Bond ETF", sector: "Bond ETF",
                      what: "A broad basket of investment-grade US bonds — government, corporate and mortgage.", moves: "Interest rates across the whole curve."),
        "TQQQ": .init(name: "ProShares UltraPro QQQ", sector: "Leveraged ETF",
                      what: "Aims for THREE TIMES the Nasdaq-100's move each DAY. Because it resets daily, it decays in choppy markets — it is a tool for days, not years.", moves: "Nasdaq moves, magnified — and time itself works against you."),
        "SQQQ": .init(name: "ProShares UltraPro Short QQQ", sector: "Inverse leveraged ETF",
                      what: "Aims for MINUS three times the Nasdaq-100's daily move — it gains when tech falls. Decay is brutal over time.", moves: "Nasdaq declines, magnified; holding it long is usually a loss."),
        "SOXL": .init(name: "Direxion Daily Semiconductor Bull 3X", sector: "Leveraged ETF",
                      what: "Three times the daily move of a semiconductor index — among the most volatile funds listed.", moves: "Chip stocks, magnified threefold each day."),
        "GDX": .init(name: "VanEck Gold Miners ETF", sector: "Sector ETF",
                      what: "Holds gold mining companies, which amplify gold's moves because their costs are fixed.", moves: "Gold prices, leveraged by mining economics."),
        "BITO": .init(name: "ProShares Bitcoin Strategy ETF", sector: "Crypto futures ETF",
                      what: "Tracks bitcoin through futures contracts rather than holding coins, so it can drift from spot.", moves: "Bitcoin's price and futures roll costs."),
        "BTC/USD": .init(name: "Bitcoin", sector: "Cryptocurrency",
                      what: "The first and largest cryptocurrency. No company, no earnings, no board — its price is supply, demand and conviction. Supply is capped at 21 million coins.", moves: "Institutional adoption, rates, and its four-year halving cycle."),
        "ETH/USD": .init(name: "Ethereum", sector: "Cryptocurrency",
                      what: "The network most crypto applications are built on. Its coin, ether, pays the fees to run programs on that network.", moves: "On-chain activity and staking economics."),
        "SOL/USD": .init(name: "Solana", sector: "Cryptocurrency",
                      what: "A fast, cheap blockchain competing with Ethereum, popular for trading apps and consumer tokens.", moves: "Network usage — and its history of outages."),
        "XRP/USD": .init(name: "XRP", sector: "Cryptocurrency",
                      what: "A token designed for moving money between institutions quickly and cheaply.", moves: "Bank adoption and its long US legal history."),
        "DOGE/USD": .init(name: "Dogecoin", sector: "Cryptocurrency",
                      what: "Started as a joke about crypto speculation and became a real, heavily traded market. Unlimited supply.", moves: "Sentiment and celebrity attention more than fundamentals."),
        "AVAX/USD": .init(name: "Avalanche", sector: "Cryptocurrency",
                      what: "A blockchain platform emphasising speed and custom sub-networks for institutions.", moves: "Developer adoption and its subnet strategy."),
        "LINK/USD": .init(name: "Chainlink", sector: "Cryptocurrency",
                      what: "An 'oracle' network that feeds real-world data, like prices, into blockchain contracts.", moves: "How much value depends on its data feeds."),
        "DOT/USD": .init(name: "Polkadot", sector: "Cryptocurrency",
                      what: "A network designed to let separate blockchains talk to each other.", moves: "Parachain activity and cross-chain demand."),
        "LTC/USD": .init(name: "Litecoin", sector: "Cryptocurrency",
                      what: "One of the oldest bitcoin alternatives, built for faster, cheaper payments.", moves: "Payment usage and bitcoin's direction."),
        "BCH/USD": .init(name: "Bitcoin Cash", sector: "Cryptocurrency",
                      what: "A 2017 split from bitcoin that chose larger blocks to make everyday payments cheaper.", moves: "Bitcoin's direction and its own niche adoption."),
        "UNI/USD": .init(name: "Uniswap", sector: "Cryptocurrency",
                      what: "The token of the largest decentralised exchange, where trades happen without a company in the middle.", moves: "Trading volume on the protocol and governance decisions."),
        "AAVE/USD": .init(name: "Aave", sector: "Cryptocurrency",
                      what: "The token of a lending protocol where people borrow and lend crypto without a bank.", moves: "Total value deposited and lending rates."),
        "SHIB/USD": .init(name: "Shiba Inu", sector: "Cryptocurrency",
                      what: "A meme token with an enormous supply, which is why each unit costs a tiny fraction of a cent.", moves: "Retail enthusiasm; there is little underlying to value."),
        "MKR/USD": .init(name: "Maker", sector: "Cryptocurrency",
                      what: "Governs the DAI stablecoin system — holders vote on the rules that keep DAI near one dollar.", moves: "DAI demand and protocol revenue."),
        "CRV/USD": .init(name: "Curve DAO", sector: "Cryptocurrency",
                      what: "Governs an exchange specialised in swapping stablecoins with very low slippage.", moves: "Stablecoin trading volume."),
        "GRT/USD": .init(name: "The Graph", sector: "Cryptocurrency",
                      what: "Pays a network to index blockchain data so applications can query it quickly.", moves: "Developer demand for indexed data."),
        "XTZ/USD": .init(name: "Tezos", sector: "Cryptocurrency",
                      what: "A blockchain that upgrades itself through on-chain voting rather than contentious splits.", moves: "Governance activity and adoption."),
        "BAT/USD": .init(name: "Basic Attention Token", sector: "Cryptocurrency",
                      what: "Rewards users of the Brave browser for viewing privacy-respecting ads.", moves: "Brave's user growth and advertiser interest."),
        "SPX": .init(name: "S&P 500 Index", sector: "US large-cap index",
                      what: "The number itself — a measure of 500 large US companies, weighted by market value. You cannot buy the index; trade SPY or its futures instead.", moves: "The broad US market."),
        "NDX": .init(name: "Nasdaq-100 Index", sector: "US tech index",
                      what: "Measures the 100 largest non-financial Nasdaq companies. Trade it through QQQ or futures.", moves: "Big technology."),
        "COMP": .init(name: "Nasdaq Composite Index", sector: "US index",
                      what: "Measures roughly all 3,000+ companies listed on the Nasdaq exchange.", moves: "Technology and growth stocks broadly."),
        "DJI": .init(name: "Dow Jones Industrial Average", sector: "US blue-chip index",
                      what: "Thirty large US companies, weighted by share price rather than size — an old convention that still moves headlines.", moves: "Large industrials and consumer names."),
        "RUT": .init(name: "Russell 2000 Index", sector: "US small-cap index",
                      what: "Measures two thousand smaller US companies — the domestic economy's temperature.", moves: "Small business conditions and credit."),
        "VIX": .init(name: "CBOE Volatility Index", sector: "Volatility index",
                      what: "The market's fear gauge: how much movement traders EXPECT in the S&P 500 over the next 30 days, derived from option prices. It spikes when stocks fall.", moves: "Fear itself — it usually rises when the market drops."),
    ]

    static func profile(_ symbol: String) -> Profile? { profiles[symbol] }

    static func name(_ symbol: String) -> String? {
        if let p = profiles[symbol] { return p.name }
        if symbol.hasPrefix("FX:") { return "\(SymbolDisplay.pretty(symbol)) exchange rate" }
        if symbol.hasPrefix("FUT:") { return futuresName(symbol) }
        return nil
    }

    /// "FUT:ESU6" → "E-mini S&P 500 · Sep 2026". The root carries the
    /// contract's identity; the suffix carries its month.
    static let futuresRoots: [String: String] = [
        "ES": "E-mini S&P 500", "MES": "Micro E-mini S&P 500",
        "NQ": "E-mini Nasdaq-100", "MNQ": "Micro E-mini Nasdaq-100",
        "YM": "E-mini Dow", "RTY": "E-mini Russell 2000",
        "CL": "Crude Oil", "MCL": "Micro Crude Oil", "NG": "Natural Gas",
        "GC": "Gold", "MGC": "Micro Gold", "SI": "Silver", "HG": "Copper",
        "ZB": "30-Year Treasury Bond", "ZN": "10-Year Treasury Note",
        "ZC": "Corn", "ZS": "Soybeans", "ZW": "Wheat",
        "6E": "Euro FX", "6J": "Japanese Yen", "6B": "British Pound",
        "6A": "Australian Dollar", "6C": "Canadian Dollar", "6S": "Swiss Franc",
        "BTC": "Bitcoin Futures", "MBT": "Micro Bitcoin Futures",
        "ETH": "Ether Futures", "MET": "Micro Ether Futures",
    ]

    static func futuresName(_ symbol: String) -> String {
        let body = symbol.replacingOccurrences(of: "FUT:", with: "")
        for (root, label) in futuresRoots where body.hasPrefix(root) {
            return label
        }
        return "Futures contract"
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
        if let p = profiles[symbol] { return p.what }
        // No profile yet — say what the SPECIES is rather than inventing
        // facts about a company we don't have on file.
        switch kind {
        case .stock: return "A share in a listed company. You own a slice of its business — its profits, its risks, its news. We don't have a profile for this one on file yet."
        case .etf: return "An ETF — a basket of many holdings bought as one share. Diversification without picking each name."
        case .crypto: return "A cryptocurrency priced in dollars. Trades around the clock, every day — no opening bell, no closing bell."
        case .fx: return "A currency pair — the price of one currency measured in another. Moves in tiny increments called pips."
        case .index: return "An index — a NUMBER measuring a slice of the market. You can't buy it directly; trade its ETF or its future instead."
        case .future: return "A futures contract — an agreement on a price for a set delivery month. You post margin instead of paying principal, and settle the difference daily."
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
    private var profile: Instruments.Profile? { Instruments.profile(symbol) }

    var body: some View {
        VStack(alignment: .leading, spacing: TarsTheme.Space.m) {
            // Identity: ticker, the FULL name, and what species it is.
            HStack(alignment: .top) {
                VStack(alignment: .leading, spacing: 3) {
                    Text(SymbolDisplay.pretty(symbol))
                        .font(TarsTheme.Text.title)
                        .foregroundStyle(TarsTheme.inkPrimary)
                    if let n = Instruments.name(symbol) {
                        Text(n)
                            .font(TarsTheme.Text.body.weight(.semibold))
                            .foregroundStyle(TarsTheme.inkSecondary)
                            .fixedSize(horizontal: false, vertical: true)
                    }
                    Text(profile?.sector ?? kind.rawValue.capitalized)
                        .font(TarsTheme.Text.micro)
                        .foregroundStyle(TarsTheme.inkQuaternary)
                }
                Spacer(minLength: TarsTheme.Space.s)
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
                        let rounded = (chg * 10000).rounded() / 100
                        let shown = rounded == 0 ? 0 : rounded
                        Text("\(shown > 0 ? "+" : "")\(shown, specifier: "%.2f")%")
                            .font(TarsTheme.Text.caption.monospacedDigit())
                            .foregroundStyle(TarsTheme.pnl(shown))
                    }
                }
            }

            Divider().overlay(TarsTheme.hairline)

            // The answer to "what IS this?"
            Text(Instruments.what(symbol, kind: kind))
                .font(TarsTheme.Text.body)
                .foregroundStyle(TarsTheme.inkPrimary)
                .fixedSize(horizontal: false, vertical: true)

            // What actually moves it — the second question a beginner asks.
            if let moves = profile?.moves {
                labelled("WHAT MOVES IT", moves)
            }
            labelled("HOW IT TRADES HERE", Instruments.how(kind))
            if let note = Instruments.provenanceNote(provenance) {
                labelled("THIS PRICE", note)
            }
        }
        .padding(TarsTheme.Space.xl)
        .frame(width: 340, alignment: .leading)
        .background(TarsTheme.bg1)
    }

    private func labelled(_ label: String, _ body: String) -> some View {
        VStack(alignment: .leading, spacing: 3) {
            TarsMicroLabel(label, tone: TarsTheme.inkQuaternary)
            Text(body)
                .font(TarsTheme.Text.caption)
                .foregroundStyle(TarsTheme.inkSecondary)
                .fixedSize(horizontal: false, vertical: true)
        }
    }
}
