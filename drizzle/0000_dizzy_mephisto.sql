CREATE TABLE IF NOT EXISTS `tutor_actions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` text NOT NULL,
	`board_id` text NOT NULL,
	`action_json` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `tutor_boards` (
	`user_id` text PRIMARY KEY NOT NULL,
	`board_id` text NOT NULL,
	`state_json` text DEFAULT '{}' NOT NULL,
	`snapshot_data_url` text,
	`event_version` integer DEFAULT 0 NOT NULL,
	`last_mcp_at` integer,
	`updated_at` integer NOT NULL
);
