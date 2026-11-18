ALTER TABLE "practice_sessions" ADD COLUMN "topic_slug" text;--> statement-breakpoint
ALTER TABLE "practice_sessions" ADD COLUMN "topic_name" text;--> statement-breakpoint
ALTER TABLE "practice_sessions" ADD COLUMN "subtopic" text;--> statement-breakpoint
ALTER TABLE "practice_sessions" ADD COLUMN "answers" jsonb;--> statement-breakpoint
ALTER TABLE "practice_sessions" ADD COLUMN "analysis" jsonb;--> statement-breakpoint
CREATE INDEX "practice_sessions_user_completed_idx" ON "practice_sessions" USING btree ("user_id","completed_at");--> statement-breakpoint
INSERT INTO "practice_sessions" (
  "user_id",
  "board_id",
  "mode",
  "topic_slug",
  "topic_name",
  "subtopic",
  "answers",
  "analysis",
  "started_at",
  "completed_at"
)
SELECT
  "board_members"."user_id",
  "boards"."id",
  "boards"."state" #>> '{topicTest,mode}',
  "boards"."state" #>> '{topicTest,topicSlug}',
  "boards"."state" #>> '{topicTest,topicName}',
  "boards"."state" #>> '{topicTest,subtopic}',
  COALESCE("boards"."state" #> '{topicTest,answers}', '[]'::jsonb),
  "boards"."state" #> '{topicTest,analysis}',
  to_timestamp(COALESCE(NULLIF("boards"."state" #>> '{topicTest,startedAt}', '')::double precision, extract(epoch FROM "boards"."updated_at") * 1000) / 1000),
  to_timestamp(COALESCE(NULLIF("boards"."state" #>> '{topicTest,analysis,completedAt}', '')::double precision, extract(epoch FROM "boards"."updated_at") * 1000) / 1000)
FROM "boards"
INNER JOIN "board_members" ON "board_members"."board_id" = "boards"."id" AND "board_members"."role" = 'owner'
WHERE "boards"."state" #>> '{topicTest,status}' = 'complete'
  AND jsonb_typeof("boards"."state" #> '{topicTest,analysis}') = 'object';
