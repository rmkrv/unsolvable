CREATE TYPE "public"."account_role" AS ENUM('student', 'parent', 'admin');--> statement-breakpoint
CREATE TYPE "public"."parent_student_link_status" AS ENUM('pending', 'active', 'revoked');--> statement-breakpoint
CREATE TABLE "audit_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"actor_user_id" uuid,
	"target_user_id" uuid,
	"action" text NOT NULL,
	"target_type" text NOT NULL,
	"target_id" text NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "parent_student_links" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"parent_user_id" uuid NOT NULL,
	"student_user_id" uuid NOT NULL,
	"status" "parent_student_link_status" DEFAULT 'pending' NOT NULL,
	"invited_by_user_id" uuid NOT NULL,
	"invited_at" timestamp with time zone DEFAULT now() NOT NULL,
	"accepted_at" timestamp with time zone,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "parent_student_links_distinct_users_check" CHECK ("parent_student_links"."parent_user_id" <> "parent_student_links"."student_user_id")
);
--> statement-breakpoint
CREATE TABLE "subscription_entitlements" (
	"subscription_id" uuid NOT NULL,
	"beneficiary_user_id" uuid NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "subscription_entitlements_subscription_id_beneficiary_user_id_pk" PRIMARY KEY("subscription_id","beneficiary_user_id")
);
--> statement-breakpoint
CREATE TABLE "subscriptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"billing_account_id" uuid NOT NULL,
	"provider_subscription_id" text,
	"plan" text DEFAULT 'free' NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"renews_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "subscriptions_provider_subscription_id_unique" UNIQUE("provider_subscription_id")
);
--> statement-breakpoint
ALTER TABLE "billing_accounts" RENAME COLUMN "user_id" TO "owner_user_id";--> statement-breakpoint
ALTER TABLE "billing_accounts" DROP CONSTRAINT "billing_accounts_provider_subscription_id_unique";--> statement-breakpoint
ALTER TABLE "billing_accounts" DROP CONSTRAINT "billing_accounts_user_id_app_users_id_fk";
--> statement-breakpoint
ALTER TABLE "billing_accounts" DROP CONSTRAINT "billing_accounts_pkey";--> statement-breakpoint
ALTER TABLE "app_users" ADD COLUMN "role" "account_role" DEFAULT 'student' NOT NULL;--> statement-breakpoint
ALTER TABLE "app_users" ADD COLUMN "role_confirmed_at" timestamp with time zone;--> statement-breakpoint
UPDATE "app_users" SET "role_confirmed_at" = "created_at" WHERE "role_confirmed_at" IS NULL;--> statement-breakpoint
ALTER TABLE "billing_accounts" ADD COLUMN "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL;--> statement-breakpoint
ALTER TABLE "audit_events" ADD CONSTRAINT "audit_events_actor_user_id_app_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."app_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_events" ADD CONSTRAINT "audit_events_target_user_id_app_users_id_fk" FOREIGN KEY ("target_user_id") REFERENCES "public"."app_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "parent_student_links" ADD CONSTRAINT "parent_student_links_parent_user_id_app_users_id_fk" FOREIGN KEY ("parent_user_id") REFERENCES "public"."app_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "parent_student_links" ADD CONSTRAINT "parent_student_links_student_user_id_app_users_id_fk" FOREIGN KEY ("student_user_id") REFERENCES "public"."app_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "parent_student_links" ADD CONSTRAINT "parent_student_links_invited_by_user_id_app_users_id_fk" FOREIGN KEY ("invited_by_user_id") REFERENCES "public"."app_users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscription_entitlements" ADD CONSTRAINT "subscription_entitlements_subscription_id_subscriptions_id_fk" FOREIGN KEY ("subscription_id") REFERENCES "public"."subscriptions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscription_entitlements" ADD CONSTRAINT "subscription_entitlements_beneficiary_user_id_app_users_id_fk" FOREIGN KEY ("beneficiary_user_id") REFERENCES "public"."app_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_billing_account_id_billing_accounts_id_fk" FOREIGN KEY ("billing_account_id") REFERENCES "public"."billing_accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "audit_events_created_idx" ON "audit_events" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "audit_events_actor_created_idx" ON "audit_events" USING btree ("actor_user_id","created_at");--> statement-breakpoint
CREATE INDEX "audit_events_target_created_idx" ON "audit_events" USING btree ("target_user_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "parent_student_links_pair_uidx" ON "parent_student_links" USING btree ("parent_user_id","student_user_id");--> statement-breakpoint
CREATE INDEX "parent_student_links_parent_status_idx" ON "parent_student_links" USING btree ("parent_user_id","status");--> statement-breakpoint
CREATE INDEX "parent_student_links_student_status_idx" ON "parent_student_links" USING btree ("student_user_id","status");--> statement-breakpoint
CREATE INDEX "subscription_entitlements_beneficiary_status_idx" ON "subscription_entitlements" USING btree ("beneficiary_user_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "subscriptions_billing_account_uidx" ON "subscriptions" USING btree ("billing_account_id");--> statement-breakpoint
ALTER TABLE "billing_accounts" ADD CONSTRAINT "billing_accounts_owner_user_id_app_users_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "public"."app_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "billing_accounts_owner_user_uidx" ON "billing_accounts" USING btree ("owner_user_id");--> statement-breakpoint
INSERT INTO "subscriptions" (
	"id",
	"billing_account_id",
	"provider_subscription_id",
	"plan",
	"status",
	"renews_at",
	"created_at",
	"updated_at"
)
SELECT
	gen_random_uuid(),
	"id",
	"provider_subscription_id",
	"plan",
	"status",
	"renews_at",
	"created_at",
	"updated_at"
FROM "billing_accounts";--> statement-breakpoint
INSERT INTO "subscription_entitlements" (
	"subscription_id",
	"beneficiary_user_id",
	"status",
	"created_at",
	"updated_at"
)
SELECT
	"subscriptions"."id",
	"billing_accounts"."owner_user_id",
	'active',
	"subscriptions"."created_at",
	"subscriptions"."updated_at"
FROM "subscriptions"
INNER JOIN "billing_accounts"
	ON "billing_accounts"."id" = "subscriptions"."billing_account_id";--> statement-breakpoint
ALTER TABLE "billing_accounts" DROP COLUMN "plan";--> statement-breakpoint
ALTER TABLE "billing_accounts" DROP COLUMN "provider_subscription_id";--> statement-breakpoint
ALTER TABLE "billing_accounts" DROP COLUMN "renews_at";
