ALTER TABLE "calendar_events" ADD COLUMN "plan_group_id" uuid;--> statement-breakpoint
ALTER TABLE "calendar_events" ADD COLUMN "plan_starts_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "calendar_events" ADD COLUMN "plan_ends_at" timestamp with time zone;--> statement-breakpoint
UPDATE "calendar_events"
SET "plan_group_id" = "id",
    "plan_starts_at" = "starts_at",
    "plan_ends_at" = COALESCE("recurrence_ends_at", "ends_at")
WHERE "kind" = 'study_session' AND "recurrence_frequency" = 'weekly';--> statement-breakpoint
CREATE INDEX "calendar_events_plan_group_idx" ON "calendar_events" USING btree ("plan_group_id");
