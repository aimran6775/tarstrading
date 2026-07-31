# Tars Trading — operations runbook

The procedures that must be *rehearsed* rather than improvised. Written for
whoever is on the keyboard at 3am, including a future version of the person
who built it.

---

## 1. Is the platform healthy?

Open the console → **Feeds**. It reads `feed_status`, which the watchdog
writes on every heartbeat (`src/server/watchdog.ts`).

Vitals and their budgets:

| Vital | Healthy | Meaning when late |
|---|---|---|
| `heartbeat` | < 15 min | The scheduler is dead — see §2 |
| `feed:sweep` | < 6 min | Board quotes are freezing |
| `feed:live-slots` | < 10 min | Websocket roster not re-armed |
| `feed:fx` / `indices-daily` / `futures` | < 36 h | A daily source is failing |
| `quote-freshness` | < 10% stale | Users are seeing old prices |
| `dead-listings` | 0 | A listed symbol prices nothing |

Quick check without the UI:

```bash
curl -s -X POST https://admin.tarstrading.com/api/cron/tick \
  -H "authorization: Bearer $CRON_SECRET" | python3 -m json.tool | head -40
```

The response carries the full `watchdog` report.

---

## 2. The scheduler has stopped

Symptom: `heartbeat` vital late, board frozen at a stale print, no new rows
in `cron_runs`.

This has happened once, on 2026-07-30. Cause: four exchange sweeps ran
concurrently, each opening `SELECT … FOR UPDATE` transactions on the same
account rows out of one 10-connection pool; blocked waiters held the
connections the lock holders needed and the backend wedged. Fixed by
serialising the exchange sweeps (`src/server/heartbeat.ts`) and adding an
overrun guard in `src/instrumentation.ts`.

If it recurs:

1. Confirm it's the pool, not the process:
   `select count(*), state from pg_stat_activity group by state;`
   Many `idle in transaction` rows means locks are held.
2. Redeploy the `api` service. A fresh process drops every stale connection
   and the scheduler re-arms on boot (15s later).
3. Verify recovery with a **hands-off** observation — no manual cron calls —
   until `sweep` is under 120s old on its own. Manual ticks mask the fault.

---

## 3. Database backup and rollback

Supabase keeps automatic daily backups (Project → Database → Backups).

**Before any migration that drops or rewrites data**, take a manual snapshot
first — the automatic one may be up to 24h old:

```bash
# Point-in-time export of the tables that hold user state.
pg_dump "$DATABASE_URL" \
  --table=users --table=accounts --table=positions --table=orders \
  --table=journal_entries --table=equity_history --table=agents \
  --data-only --column-inserts > backup-$(date +%F-%H%M).sql
```

**Rolling back a bad migration.** Drizzle migrations are forward-only by
design, so recovery is: write a NEW migration that undoes the change. Never
edit an applied migration file — the journal hash won't match and every
environment diverges.

```bash
# 1. Write the inverse migration in web/drizzle/, add it to meta/_journal.json
# 2. Apply it the only way that works here (psql is classifier-blocked):
node --env-file=.env.local node_modules/.bin/drizzle-kit migrate
# 3. Verify against the live schema before deploying code that depends on it.
```

**Restoring data** is a Supabase console operation (Backups → Restore). It
replaces the whole database, so take the export above first if any writes
happened after the backup you're restoring.

---

## 4. Deploying

```bash
cd web && railway up --service web --detach
cd web && railway up --service api --detach
```

`railway up` **must** run from `web/`. From the repo root, Railpack sees the
iOS Xcode project and fails instantly with empty logs.

Both services run the same image; `APP_ROLE=backend` on `api` is what arms
the scheduler and makes it abstain from holding the Alpaca websockets.

---

## 5. Credentials

- **Railway token**: the token in use is *account-scoped*. It should be a
  project-scoped token (Railway → tars-trading → Settings → Tokens) and
  rotated — an account token can reach every project on the account.
- **Console password** (`CONSOLE_PASS`) gates the control centre and is now
  asked for again before any platform-wide switch (halt trading, pause all
  analysts).
- `KEYS.md`, `Secrets.swift` and `.env*` are gitignored and must stay that
  way. Verify before every commit: `git check-ignore web/.env.local`.

---

## 6. Trading is halted / analysts are paused

Both are deliberate switches in the console (**Controls**), stored in
`platform_config` and read by `placeOrder` and `tickAllRunningAgents`. If
users report rejected orders reading "temporarily halted by the platform",
check there first — it's a switch, not a fault.
