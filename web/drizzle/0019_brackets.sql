-- Bracket / OCO orders.
--
-- A bracket is an entry with a take-profit and a stop-loss attached: whichever
-- child fills first cancels the other (one-cancels-other). Until now a user
-- could place a stop, or a limit, but never both bound together — so the exit
-- discipline the analysts run internally was unavailable to the human placing
-- the trade.
--
-- Two columns carry it:
--   parent_id — the entry this child protects (null for ordinary orders)
--   oco_group — children sharing a group cancel each other on fill
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "parent_id" text;
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "oco_group" text;

CREATE INDEX IF NOT EXISTS "orders_oco_group" ON "orders" ("oco_group");
CREATE INDEX IF NOT EXISTS "orders_parent" ON "orders" ("parent_id");
