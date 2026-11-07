import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  serial,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
};

export const appUsers = pgTable("app_users", {
  id: uuid("id").primaryKey().defaultRandom(),
  authSubject: text("auth_subject").notNull().unique(),
  ...timestamps,
});

export const userProfiles = pgTable("user_profiles", {
  userId: uuid("user_id")
    .primaryKey()
    .references(() => appUsers.id, { onDelete: "cascade" }),
  displayName: text("display_name"),
  avatarObjectKey: text("avatar_object_key"),
  isDiscoverable: boolean("is_discoverable").notNull().default(false),
  learningLevel: text("learning_level"),
  learningGoal: text("learning_goal"),
  locale: text("locale").notNull().default("en"),
  onboardingCompletedAt: timestamp("onboarding_completed_at", { withTimezone: true }),
  ...timestamps,
});

export const billingAccounts = pgTable("billing_accounts", {
  userId: uuid("user_id")
    .primaryKey()
    .references(() => appUsers.id, { onDelete: "cascade" }),
  plan: text("plan").notNull().default("free"),
  status: text("status").notNull().default("active"),
  providerCustomerId: text("provider_customer_id").unique(),
  providerSubscriptionId: text("provider_subscription_id").unique(),
  renewsAt: timestamp("renews_at", { withTimezone: true }),
  ...timestamps,
});

export const workspaces = pgTable("workspaces", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  kind: text("kind").notNull().default("personal"),
  personalOwnerId: uuid("personal_owner_id")
    .references(() => appUsers.id, { onDelete: "cascade" })
    .unique(),
  ...timestamps,
});

export const workspaceMembers = pgTable(
  "workspace_members",
  {
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => appUsers.id, { onDelete: "cascade" }),
    role: text("role").notNull().default("owner"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.workspaceId, table.userId] }),
    index("workspace_members_user_idx").on(table.userId),
  ],
);

export const boards = pgTable(
  "boards",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    externalId: text("external_id").notNull(),
    title: text("title").notNull().default("Untitled board"),
    subject: text("subject"),
    state: jsonb("state").notNull().default({}),
    snapshotDataUrl: text("snapshot_data_url"),
    eventVersion: integer("event_version").notNull().default(0),
    lastMcpAt: timestamp("last_mcp_at", { withTimezone: true }),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("boards_workspace_external_id_uidx").on(table.workspaceId, table.externalId),
    index("boards_workspace_updated_idx").on(table.workspaceId, table.updatedAt),
  ],
);

export const userBoardActivity = pgTable(
  "user_board_activity",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => appUsers.id, { onDelete: "cascade" }),
    boardId: uuid("board_id")
      .notNull()
      .references(() => boards.id, { onDelete: "cascade" }),
    lastOpenedAt: timestamp("last_opened_at", { withTimezone: true }).notNull().defaultNow(),
    lastViewedEventVersion: integer("last_viewed_event_version").notNull().default(0),
    isFavorite: boolean("is_favorite").notNull().default(false),
  },
  (table) => [
    primaryKey({ columns: [table.userId, table.boardId] }),
    index("user_board_activity_recent_idx").on(table.userId, table.lastOpenedAt),
  ],
);

export const boardMembers = pgTable(
  "board_members",
  {
    boardId: uuid("board_id")
      .notNull()
      .references(() => boards.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => appUsers.id, { onDelete: "cascade" }),
    role: text("role").notNull().default("owner"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.boardId, table.userId] }),
    index("board_members_user_idx").on(table.userId),
  ],
);

export const tutorActions = pgTable(
  "tutor_actions",
  {
    id: serial("id").primaryKey(),
    boardId: uuid("board_id")
      .notNull()
      .references(() => boards.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => appUsers.id, { onDelete: "cascade" }),
    action: jsonb("action").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("tutor_actions_board_id_idx").on(table.boardId, table.id)],
);

export const friendRequests = pgTable(
  "friend_requests",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    senderUserId: uuid("sender_user_id")
      .notNull()
      .references(() => appUsers.id, { onDelete: "cascade" }),
    recipientUserId: uuid("recipient_user_id")
      .notNull()
      .references(() => appUsers.id, { onDelete: "cascade" }),
    status: text("status").notNull().default("pending"),
    respondedAt: timestamp("responded_at", { withTimezone: true }),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("friend_requests_pair_uidx").on(table.senderUserId, table.recipientUserId),
    index("friend_requests_recipient_status_idx").on(table.recipientUserId, table.status),
  ],
);

export const friendships = pgTable(
  "friendships",
  {
    userAId: uuid("user_a_id")
      .notNull()
      .references(() => appUsers.id, { onDelete: "cascade" }),
    userBId: uuid("user_b_id")
      .notNull()
      .references(() => appUsers.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.userAId, table.userBId] }),
    index("friendships_user_b_idx").on(table.userBId),
  ],
);

export const userBlocks = pgTable(
  "user_blocks",
  {
    blockerUserId: uuid("blocker_user_id")
      .notNull()
      .references(() => appUsers.id, { onDelete: "cascade" }),
    blockedUserId: uuid("blocked_user_id")
      .notNull()
      .references(() => appUsers.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [primaryKey({ columns: [table.blockerUserId, table.blockedUserId] })],
);

export const skills = pgTable("skills", {
  id: text("id").primaryKey(),
  parentSkillId: text("parent_skill_id"),
  name: text("name").notNull(),
  version: integer("version").notNull().default(1),
  ...timestamps,
});

export const practiceSessions = pgTable(
  "practice_sessions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => appUsers.id, { onDelete: "cascade" }),
    boardId: uuid("board_id").references(() => boards.id, { onDelete: "set null" }),
    mode: text("mode").notNull().default("practice"),
    startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
  },
  (table) => [index("practice_sessions_user_started_idx").on(table.userId, table.startedAt)],
);

export const practiceAttempts = pgTable(
  "practice_attempts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    sessionId: uuid("session_id")
      .notNull()
      .references(() => practiceSessions.id, { onDelete: "cascade" }),
    skillId: text("skill_id")
      .notNull()
      .references(() => skills.id, { onDelete: "restrict" }),
    outcome: text("outcome").notNull(),
    evidence: jsonb("evidence").notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("practice_attempts_session_idx").on(table.sessionId)],
);

export const userSkillMastery = pgTable(
  "user_skill_mastery",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => appUsers.id, { onDelete: "cascade" }),
    skillId: text("skill_id")
      .notNull()
      .references(() => skills.id, { onDelete: "cascade" }),
    score: integer("score").notNull(),
    confidence: integer("confidence").notNull(),
    evidenceCount: integer("evidence_count").notNull().default(0),
    calculatedAt: timestamp("calculated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.userId, table.skillId] }),
    index("user_skill_mastery_score_idx").on(table.userId, table.score),
  ],
);
