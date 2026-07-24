-- Dedupe any pre-existing duplicate progress rows (from before the unique
-- constraints) so the UNIQUE indexes below can be created. Keep the earliest.
DELETE FROM "lesson_progress" a USING "lesson_progress" b
  WHERE a.user_id = b.user_id AND a.lesson_id = b.lesson_id
    AND (a.completed_at > b.completed_at OR (a.completed_at = b.completed_at AND a.id > b.id));--> statement-breakpoint
DELETE FROM "mission_progress" a USING "mission_progress" b
  WHERE a.user_id = b.user_id AND a.mission_id = b.mission_id
    AND (a.completed_at > b.completed_at OR (a.completed_at = b.completed_at AND a.id > b.id));--> statement-breakpoint
DELETE FROM "replay_results" a USING "replay_results" b
  WHERE a.user_id = b.user_id AND a.scenario_id = b.scenario_id
    AND (a.completed_at > b.completed_at OR (a.completed_at = b.completed_at AND a.id > b.id));--> statement-breakpoint
DROP INDEX "bars_series";--> statement-breakpoint
CREATE INDEX "accounts_equity" ON "accounts" USING btree ("equity");--> statement-breakpoint
CREATE UNIQUE INDEX "lesson_progress_uq" ON "lesson_progress" USING btree ("user_id","lesson_id");--> statement-breakpoint
CREATE UNIQUE INDEX "mission_progress_uq" ON "mission_progress" USING btree ("user_id","mission_id");--> statement-breakpoint
CREATE INDEX "orders_user_status" ON "orders" USING btree ("user_id","status");--> statement-breakpoint
CREATE INDEX "orders_agent" ON "orders" USING btree ("agent_id");--> statement-breakpoint
CREATE UNIQUE INDEX "replay_results_uq" ON "replay_results" USING btree ("user_id","scenario_id");