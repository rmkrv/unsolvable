import {
  boolean,
  check,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  serial,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
};

export const accountRole = pgEnum("account_role", ["student", "parent", "admin"]);
export const parentStudentLinkStatus = pgEnum("parent_student_link_status", [
  "pending",
  "active",
  "revoked",
]);
export const calendarEventKind = pgEnum("calendar_event_kind", ["study_session", "deadline"]);
export const calendarEventStatus = pgEnum("calendar_event_status", ["scheduled", "completed", "cancelled"]);
export const calendarRecurrenceFrequency = pgEnum("calendar_recurrence_frequency", [
  "daily",
  "weekly",
  "monthly",
]);

export const appUsers = pgTable("app_users", {
  id: uuid("id").primaryKey().defaultRandom(),
  authSubject: text("auth_subject").notNull().unique(),
  role: accountRole("role").notNull().default("student"),
  roleConfirmedAt: timestamp("role_confirmed_at", { withTimezone: true }),
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

export const parentStudentLinks = pgTable(
  "parent_student_links",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    parentUserId: uuid("parent_user_id")
      .notNull()
      .references(() => appUsers.id, { onDelete: "cascade" }),
    studentUserId: uuid("student_user_id")
      .notNull()
      .references(() => appUsers.id, { onDelete: "cascade" }),
    status: parentStudentLinkStatus("status").notNull().default("pending"),
    invitedByUserId: uuid("invited_by_user_id")
      .notNull()
      .references(() => appUsers.id, { onDelete: "restrict" }),
    invitedAt: timestamp("invited_at", { withTimezone: true }).notNull().defaultNow(),
    acceptedAt: timestamp("accepted_at", { withTimezone: true }),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("parent_student_links_pair_uidx").on(table.parentUserId, table.studentUserId),
    index("parent_student_links_parent_status_idx").on(table.parentUserId, table.status),
    index("parent_student_links_student_status_idx").on(table.studentUserId, table.status),
    check("parent_student_links_distinct_users_check", sql`${table.parentUserId} <> ${table.studentUserId}`),
  ],
);

export const calendarEvents = pgTable(
  "calendar_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    studentUserId: uuid("student_user_id")
      .notNull()
      .references(() => appUsers.id, { onDelete: "cascade" }),
    createdByUserId: uuid("created_by_user_id")
      .notNull()
      .references(() => appUsers.id, { onDelete: "restrict" }),
    updatedByUserId: uuid("updated_by_user_id")
      .notNull()
      .references(() => appUsers.id, { onDelete: "restrict" }),
    title: text("title").notNull(),
    description: text("description"),
    kind: calendarEventKind("kind").notNull().default("study_session"),
    status: calendarEventStatus("status").notNull().default("scheduled"),
    startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
    endsAt: timestamp("ends_at", { withTimezone: true }).notNull(),
    timeZone: text("time_zone").notNull().default("UTC"),
    recurrenceFrequency: calendarRecurrenceFrequency("recurrence_frequency"),
    recurrenceInterval: integer("recurrence_interval").notNull().default(1),
    recurrenceEndsAt: timestamp("recurrence_ends_at", { withTimezone: true }),
    reminderMinutes: integer("reminder_minutes").notNull().default(30),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    planGroupId: uuid("plan_group_id"),
    planStartsAt: timestamp("plan_starts_at", { withTimezone: true }),
    planEndsAt: timestamp("plan_ends_at", { withTimezone: true }),
    ...timestamps,
  },
  (table) => [
    index("calendar_events_student_starts_idx").on(table.studentUserId, table.startsAt),
    index("calendar_events_student_recurrence_idx").on(
      table.studentUserId,
      table.recurrenceEndsAt,
    ),
    index("calendar_events_plan_group_idx").on(table.planGroupId),
    check("calendar_events_time_order_check", sql`${table.endsAt} > ${table.startsAt}`),
    check(
      "calendar_events_recurrence_interval_check",
      sql`${table.recurrenceInterval} >= 1 AND ${table.recurrenceInterval} <= 30`,
    ),
    check(
      "calendar_events_reminder_minutes_check",
      sql`${table.reminderMinutes} >= 0 AND ${table.reminderMinutes} <= 40320`,
    ),
  ],
);

export const googleCalendarConnections = pgTable("google_calendar_connections", {
  userId: uuid("user_id")
    .primaryKey()
    .references(() => appUsers.id, { onDelete: "cascade" }),
  encryptedRefreshToken: text("encrypted_refresh_token").notNull(),
  grantedScopes: text("granted_scopes").notNull(),
  connectedAt: timestamp("connected_at", { withTimezone: true }).notNull().defaultNow(),
  ...timestamps,
});

export const calendarEventExports = pgTable(
  "calendar_event_exports",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    calendarEventId: uuid("calendar_event_id")
      .notNull()
      .references(() => calendarEvents.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => appUsers.id, { onDelete: "cascade" }),
    occurrenceStart: timestamp("occurrence_start", { withTimezone: true }).notNull(),
    googleCalendarId: text("google_calendar_id").notNull().default("primary"),
    googleEventId: text("google_event_id").notNull(),
    exportedAt: timestamp("exported_at", { withTimezone: true }).notNull().defaultNow(),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("calendar_event_exports_occurrence_uidx").on(
      table.calendarEventId,
      table.userId,
      table.occurrenceStart,
    ),
    index("calendar_event_exports_user_idx").on(table.userId, table.exportedAt),
  ],
);

export const billingAccounts = pgTable(
  "billing_accounts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ownerUserId: uuid("owner_user_id")
      .notNull()
      .references(() => appUsers.id, { onDelete: "cascade" }),
    providerCustomerId: text("provider_customer_id").unique(),
    status: text("status").notNull().default("active"),
    ...timestamps,
  },
  (table) => [uniqueIndex("billing_accounts_owner_user_uidx").on(table.ownerUserId)],
);

export const subscriptions = pgTable(
  "subscriptions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    billingAccountId: uuid("billing_account_id")
      .notNull()
      .references(() => billingAccounts.id, { onDelete: "cascade" }),
    providerSubscriptionId: text("provider_subscription_id").unique(),
    plan: text("plan").notNull().default("free"),
    status: text("status").notNull().default("active"),
    renewsAt: timestamp("renews_at", { withTimezone: true }),
    ...timestamps,
  },
  (table) => [uniqueIndex("subscriptions_billing_account_uidx").on(table.billingAccountId)],
);

export const subscriptionEntitlements = pgTable(
  "subscription_entitlements",
  {
    subscriptionId: uuid("subscription_id")
      .notNull()
      .references(() => subscriptions.id, { onDelete: "cascade" }),
    beneficiaryUserId: uuid("beneficiary_user_id")
      .notNull()
      .references(() => appUsers.id, { onDelete: "cascade" }),
    status: text("status").notNull().default("active"),
    ...timestamps,
  },
  (table) => [
    primaryKey({ columns: [table.subscriptionId, table.beneficiaryUserId] }),
    index("subscription_entitlements_beneficiary_status_idx").on(
      table.beneficiaryUserId,
      table.status,
    ),
  ],
);

export const auditEvents = pgTable(
  "audit_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    actorUserId: uuid("actor_user_id").references(() => appUsers.id, { onDelete: "set null" }),
    targetUserId: uuid("target_user_id").references(() => appUsers.id, { onDelete: "set null" }),
    action: text("action").notNull(),
    targetType: text("target_type").notNull(),
    targetId: text("target_id").notNull(),
    metadata: jsonb("metadata").notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("audit_events_created_idx").on(table.createdAt),
    index("audit_events_actor_created_idx").on(table.actorUserId, table.createdAt),
    index("audit_events_target_created_idx").on(table.targetUserId, table.createdAt),
  ],
);

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
    topicSlug: text("topic_slug"),
    topicName: text("topic_name"),
    subtopic: text("subtopic"),
    answers: jsonb("answers"),
    analysis: jsonb("analysis"),
    startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
  },
  (table) => [
    index("practice_sessions_user_started_idx").on(table.userId, table.startedAt),
    index("practice_sessions_user_completed_idx").on(table.userId, table.completedAt),
  ],
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
