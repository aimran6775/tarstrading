-- Variation margin needs one piece of state: which session a futures position
-- has been settled through. avgEntryPrice doubles as the VM basis (it resets
-- to each session's settlement price, exactly like a real futures statement);
-- vm_stamp records the session date so settlement is idempotent per session.
-- Null for everything that isn't a futures position.

ALTER TABLE "positions" ADD COLUMN "vm_stamp" text;
