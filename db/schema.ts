import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const tutorBoards = sqliteTable("tutor_boards", {
  userId: text("user_id").primaryKey(),
  boardId: text("board_id").notNull(),
  stateJson: text("state_json").notNull().default("{}"),
  snapshotDataUrl: text("snapshot_data_url"),
  eventVersion: integer("event_version").notNull().default(0),
  lastMcpAt: integer("last_mcp_at"),
  updatedAt: integer("updated_at").notNull(),
});

export const tutorActions = sqliteTable("tutor_actions", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: text("user_id").notNull(),
  boardId: text("board_id").notNull(),
  actionJson: text("action_json").notNull(),
  createdAt: integer("created_at").notNull(),
});
