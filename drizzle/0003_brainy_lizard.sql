CREATE TYPE "public"."calendar_event_kind" AS ENUM('study_session', 'deadline');--> statement-breakpoint
CREATE TYPE "public"."calendar_event_status" AS ENUM('scheduled', 'completed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."calendar_recurrence_frequency" AS ENUM('daily', 'weekly', 'monthly');--> statement-breakpoint
CREATE TABLE "calendar_event_exports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"calendar_event_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"occurrence_start" timestamp with time zone NOT NULL,
	"google_calendar_id" text DEFAULT 'primary' NOT NULL,
	"google_event_id" text NOT NULL,
	"exported_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "calendar_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"student_user_id" uuid NOT NULL,
	"created_by_user_id" uuid NOT NULL,
	"updated_by_user_id" uuid NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"kind" "calendar_event_kind" DEFAULT 'study_session' NOT NULL,
	"status" "calendar_event_status" DEFAULT 'scheduled' NOT NULL,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone NOT NULL,
	"time_zone" text DEFAULT 'UTC' NOT NULL,
	"recurrence_frequency" "calendar_recurrence_frequency",
	"recurrence_interval" integer DEFAULT 1 NOT NULL,
	"recurrence_ends_at" timestamp with time zone,
	"reminder_minutes" integer DEFAULT 30 NOT NULL,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "calendar_events_time_order_check" CHECK ("calendar_events"."ends_at" > "calendar_events"."starts_at"),
	CONSTRAINT "calendar_events_recurrence_interval_check" CHECK ("calendar_events"."recurrence_interval" >= 1 AND "calendar_events"."recurrence_interval" <= 30),
	CONSTRAINT "calendar_events_reminder_minutes_check" CHECK ("calendar_events"."reminder_minutes" >= 0 AND "calendar_events"."reminder_minutes" <= 40320)
);
--> statement-breakpoint
CREATE TABLE "google_calendar_connections" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"encrypted_refresh_token" text NOT NULL,
	"granted_scopes" text NOT NULL,
	"connected_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "calendar_event_exports" ADD CONSTRAINT "calendar_event_exports_calendar_event_id_calendar_events_id_fk" FOREIGN KEY ("calendar_event_id") REFERENCES "public"."calendar_events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "calendar_event_exports" ADD CONSTRAINT "calendar_event_exports_user_id_app_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."app_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "calendar_events" ADD CONSTRAINT "calendar_events_student_user_id_app_users_id_fk" FOREIGN KEY ("student_user_id") REFERENCES "public"."app_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "calendar_events" ADD CONSTRAINT "calendar_events_created_by_user_id_app_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."app_users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "calendar_events" ADD CONSTRAINT "calendar_events_updated_by_user_id_app_users_id_fk" FOREIGN KEY ("updated_by_user_id") REFERENCES "public"."app_users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "google_calendar_connections" ADD CONSTRAINT "google_calendar_connections_user_id_app_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."app_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "calendar_event_exports_occurrence_uidx" ON "calendar_event_exports" USING btree ("calendar_event_id","user_id","occurrence_start");--> statement-breakpoint
CREATE INDEX "calendar_event_exports_user_idx" ON "calendar_event_exports" USING btree ("user_id","exported_at");--> statement-breakpoint
CREATE INDEX "calendar_events_student_starts_idx" ON "calendar_events" USING btree ("student_user_id","starts_at");--> statement-breakpoint
CREATE INDEX "calendar_events_student_recurrence_idx" ON "calendar_events" USING btree ("student_user_id","recurrence_ends_at");