-- Row Level Security lockdown for Supabase.
--
-- WHY: tables created by `drizzle-kit push` have RLS DISABLED. Supabase grants
-- the public `anon`/`authenticated` roles access to the `public` schema, so with
-- RLS off, anyone with the (public-by-design) anon key can read/write every table
-- through the REST API — including users.password_hash and account balances.
--
-- FIX: enable RLS on every table. We add NO policies, so anon/authenticated are
-- denied by default. The app connects as the `postgres` role, which OWNS these
-- tables and has BYPASSRLS, so application access is unaffected. `ENABLE` (not
-- `FORCE`) keeps that owner bypass.
--
-- Reapply on any fresh environment after `drizzle-kit push`:
--   set -a; . ./.env.local; set +a
--   psql "$DATABASE_URL" -f db/enable-rls.sql

ALTER TABLE public.users            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.accounts         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sessions         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.positions        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.watchlist_items  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agents           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_activity   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.equity_history   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.journal_entries  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lesson_progress  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_messages    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tars_memory      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.price_alerts     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quiz_attempts    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.practice_streaks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.card_reviews     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.game_attempts    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mission_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.replay_results   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platform_config  ENABLE ROW LEVEL SECURITY;
