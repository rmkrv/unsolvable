import { and, desc, eq, isNotNull } from "drizzle-orm";
import type { getDb } from "@/db";
import { practiceSessions } from "@/db/schema";
import { normalizeTopicTestAnalysis, type TopicTestMode } from "@/lib/domain/topic-test";
import type { AnalysisRepository, SavedTopicTestAnalysis, SaveTopicTestAnalysisInput } from "./analysis-repository";

type Database = ReturnType<typeof getDb>;

export class PostgresAnalysisRepository implements AnalysisRepository {
  constructor(private readonly db: Database) {}

  async saveForUser(input: SaveTopicTestAnalysisInput): Promise<SavedTopicTestAnalysis> {
    const updates = {
      mode: input.mode,
      topicSlug: input.topicSlug,
      topicName: input.topicName,
      subtopic: input.subtopic,
      answers: input.answers,
      analysis: input.analysis,
      startedAt: new Date(input.startedAt),
      completedAt: new Date(input.analysis.completedAt),
    };
    const values = { id: input.id, userId: input.userId, ...updates };
    await this.db.insert(practiceSessions).values(values).onConflictDoNothing();
    const updated = await this.db
      .update(practiceSessions)
      .set(updates)
      .where(and(eq(practiceSessions.id, input.id), eq(practiceSessions.userId, input.userId)))
      .returning({ id: practiceSessions.id });
    if (!updated[0]) throw new Error("ANALYSIS_SAVE_FAILED");
    return stripUserId(input);
  }

  async listForUser(userId: string, limit = 50): Promise<SavedTopicTestAnalysis[]> {
    const rows = await this.db
      .select()
      .from(practiceSessions)
      .where(and(eq(practiceSessions.userId, userId), isNotNull(practiceSessions.analysis)))
      .orderBy(desc(practiceSessions.completedAt))
      .limit(Math.max(1, Math.min(50, limit)));
    return rows.flatMap(toSavedAnalysis);
  }

  async readForUser(userId: string, id: string): Promise<SavedTopicTestAnalysis | null> {
    const rows = await this.db
      .select()
      .from(practiceSessions)
      .where(and(eq(practiceSessions.userId, userId), eq(practiceSessions.id, id)))
      .limit(1);
    return rows[0] ? toSavedAnalysis(rows[0])[0] ?? null : null;
  }
}

function toSavedAnalysis(row: typeof practiceSessions.$inferSelect): SavedTopicTestAnalysis[] {
  const analysis = normalizeTopicTestAnalysis(row.analysis);
  if (!analysis || !row.topicSlug || !row.topicName || !row.subtopic || !isTopicTestMode(row.mode)) return [];
  return [{
    id: row.id,
    topicSlug: row.topicSlug,
    topicName: row.topicName,
    subtopic: row.subtopic,
    mode: row.mode,
    answers: Array.isArray(row.answers) ? row.answers.filter((answer): answer is string => typeof answer === "string") : [],
    analysis,
    startedAt: row.startedAt.getTime(),
  }];
}

function isTopicTestMode(value: string): value is TopicTestMode {
  return value === "preparation" || value === "test";
}

function stripUserId(input: SaveTopicTestAnalysisInput): SavedTopicTestAnalysis {
  return {
    id: input.id,
    topicSlug: input.topicSlug,
    topicName: input.topicName,
    subtopic: input.subtopic,
    mode: input.mode,
    answers: input.answers,
    analysis: input.analysis,
    startedAt: input.startedAt,
  };
}
