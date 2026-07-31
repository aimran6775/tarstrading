-- Partial fills.
--
-- Every order filled whole, instantly, at any size — so a 500,000-share order
-- in a thinly traded name completed in one print. Real books work the order
-- down over time, and the difference is a lesson: size takes time, and time
-- is risk.
--
-- filled_qty tracks how much of an order has executed. An order with
-- 0 < filled_qty < qty stays "accepted" and keeps working on later passes.
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "filled_qty" double precision NOT NULL DEFAULT 0;
