import { readFileSync } from "fs";

/*
  Test setup — runs before any test module imports app code. Loads DATABASE_URL
  from .env.local so tests hit the real Supabase (these are integration tests of
  the DB layer), and UNSETS the market key so getQuote uses the deterministic
  demo market — no network, stable prices.
*/
try {
  for (const line of readFileSync(new URL("../.env.local", import.meta.url), "utf8").split("\n")) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
} catch { /* CI provides env directly */ }

delete process.env.MASSIVE_API_KEY; // force the deterministic demo market
