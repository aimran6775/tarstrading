import "server-only";

/*
  The live feed. One persistent websocket per Alpaca stream (IEX stocks +
  crypto), held as a module singleton for the life of the server process.
  Every trade tick lands in an in-memory map that getQuotes overlays on top
  of the EOD baseline — so prices move in real time while previousClose (and
  therefore day-change %) still comes from the daily tier.

  - Subscriptions are dynamic: every quotes request funnels its symbols
    through ensureLiveFeed(), so the feed tracks exactly what users watch.
  - Reconnects with backoff; a dead feed degrades gracefully to the EOD tier
    (the UI's staleness chips stay honest either way).
  - No dependency: Node ≥21 ships a native WebSocket client.
*/

const KEY = process.env.ALPACA_KEY_ID ?? "";
const SECRET = process.env.ALPACA_SECRET_KEY ?? "";
export const hasLiveFeed = KEY.length > 0 && SECRET.length > 0;

const STOCK_URL = "wss://stream.data.alpaca.markets/v2/iex";
const CRYPTO_URL = "wss://stream.data.alpaca.markets/v1beta3/crypto/us";

type Tick = { price: number; at: number };
type Lane = {
  url: string;
  ws: WebSocket | null;
  authed: boolean;
  wanted: Set<string>;
  subscribed: Set<string>;
  retryMs: number;
  lastError: string | null;
};

type FeedState = {
  ticks: Map<string, Tick>;
  tickCount: number;
  lanes: Record<"stocks" | "crypto", Lane>;
};

// Global singleton: dev HMR re-evaluates this module, and each stale instance
// would otherwise keep a socket open — Alpaca allows ONE connection per
// stream, so leaked sockets lock the fresh instance out with error 406.
declare global {
  var __tarsFeed: FeedState | undefined;
}
const state: FeedState = globalThis.__tarsFeed ??= {
  ticks: new Map(),
  tickCount: 0,
  lanes: {
    stocks: { url: STOCK_URL, ws: null, authed: false, wanted: new Set(), subscribed: new Set(), retryMs: 2_000, lastError: null },
    crypto: { url: CRYPTO_URL, ws: null, authed: false, wanted: new Set(), subscribed: new Set(), retryMs: 2_000, lastError: null },
  },
};
const { ticks, lanes } = state;

function laneFor(symbol: string): Lane {
  return symbol.includes("/") ? lanes.crypto : lanes.stocks;
}

function connect(lane: Lane) {
  if (!hasLiveFeed || lane.ws) return;
  try {
    const ws = new WebSocket(lane.url);
    lane.ws = ws;

    ws.onopen = () => {
      lane.retryMs = 2_000;
      ws.send(JSON.stringify({ action: "auth", key: KEY, secret: SECRET }));
    };

    ws.onmessage = (ev) => {
      let msgs: Array<Record<string, unknown>>;
      try { msgs = JSON.parse(String(ev.data)); } catch { return; }
      if (!Array.isArray(msgs)) return;
      for (const m of msgs) {
        if (m.T === "success" && m.msg === "authenticated") {
          lane.authed = true;
          lane.lastError = null;
          flushSubscriptions(lane);
        } else if (m.T === "t" && typeof m.S === "string" && typeof m.p === "number") {
          // A trade: the freshest possible price for this symbol.
          ticks.set(m.S, { price: m.p, at: Date.now() });
          state.tickCount++;
        } else if (m.T === "error") {
          lane.authed = false;
          lane.lastError = `${m.code ?? "?"}: ${m.msg ?? "unknown"}`;
          // "connection limit exceeded" — a stale socket holds our slot.
          // Close and retry; the stale one dies with its old process/module.
          if (m.code === 406) { try { ws.close(); } catch { /* closing */ } }
        }
      }
    };

    const reopen = () => {
      lane.ws = null;
      lane.authed = false;
      lane.subscribed.clear();
      setTimeout(() => connect(lane), lane.retryMs);
      lane.retryMs = Math.min(lane.retryMs * 2, 60_000);
    };
    ws.onclose = reopen;
    ws.onerror = () => { try { ws.close(); } catch { /* already closing */ } };
  } catch {
    lane.ws = null;
    setTimeout(() => connect(lane), lane.retryMs);
    lane.retryMs = Math.min(lane.retryMs * 2, 60_000);
  }
}

function flushSubscriptions(lane: Lane) {
  if (!lane.ws || lane.ws.readyState !== WebSocket.OPEN || !lane.authed) return;
  const missing = [...lane.wanted].filter((s) => !lane.subscribed.has(s));
  if (!missing.length) return;
  lane.ws.send(JSON.stringify({ action: "subscribe", trades: missing }));
  missing.forEach((s) => lane.subscribed.add(s));
}

/** Make sure the feed is running and covering these symbols. Cheap to call
    on every quotes request — new symbols subscribe, known ones no-op. */
export function ensureLiveFeed(symbols: string[]) {
  if (!hasLiveFeed) return;
  for (const s of symbols) {
    const lane = laneFor(s);
    if (!lane.wanted.has(s)) lane.wanted.add(s);
    if (!lane.ws) connect(lane);
    else flushSubscriptions(lane);
  }
}

/** The freshest live price for a symbol, if the feed has one that isn't stale. */
export function livePrice(symbol: string, maxAgeMs = 90_000): Tick | undefined {
  const t = ticks.get(symbol);
  return t && Date.now() - t.at <= maxAgeMs ? t : undefined;
}

/** Feed health for the admin dashboard. */
export function liveFeedStatus() {
  const lane = (l: Lane) => ({
    connected: l.ws?.readyState === WebSocket.OPEN,
    authed: l.authed,
    subscribed: l.subscribed.size,
    lastError: l.lastError,
  });
  return {
    enabled: hasLiveFeed,
    stocks: lane(lanes.stocks),
    crypto: lane(lanes.crypto),
    symbolsTicking: ticks.size,
    ticksSeen: state.tickCount,
  };
}
