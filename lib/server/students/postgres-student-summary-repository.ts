import { and, asc, count, desc, eq, lt, or, sql, sum } from "drizzle-orm";
import type { getDb } from "../../../db/index.ts";
import {
  friendRequests,
  friendships,
  practiceSessions,
  skills,
  userSkillMastery,
} from "../../../db/schema.ts";
import type {
  StudentAttendanceSummary,
  StudentHomeInsights,
  StudentPerformanceSummary,
  StudentSummaryRepository,
  WeakSpotSummary,
} from "./student-summary-repository";

type Database = ReturnType<typeof getDb>;

export class PostgresStudentSummaryRepository implements StudentSummaryRepository {
  private readonly db: Database;

  constructor(db: Database) {
    this.db = db;
  }

  async getHomeInsights(userId: string): Promise<StudentHomeInsights> {
    const [friendRows, requestRows, masteryRows] = await this.db.batch([
      this.db
        .select({ value: count() })
        .from(friendships)
        .where(or(eq(friendships.userAId, userId), eq(friendships.userBId, userId))),
      this.db
        .select({ value: count() })
        .from(friendRequests)
        .where(and(eq(friendRequests.recipientUserId, userId), eq(friendRequests.status, "pending"))),
      this.masteryQuery(userId, 1),
    ]);
    return {
      friendCount: friendRows[0]?.value ?? 0,
      pendingRequestCount: requestRows[0]?.value ?? 0,
      weakSpot: masteryRows[0] ? toWeakSpot(masteryRows[0]) : null,
    };
  }

  async getPerformance(userId: string): Promise<StudentPerformanceSummary> {
    const [aggregateRows, weakSpotRows] = await this.db.batch([
      this.db
        .select({
          averageMastery: sql<number | null>`round(avg(${userSkillMastery.score}))`,
          skillsMeasured: count(),
          totalEvidence: sum(userSkillMastery.evidenceCount),
        })
        .from(userSkillMastery)
        .where(eq(userSkillMastery.userId, userId)),
      this.masteryQuery(userId, 20),
    ]);
    const aggregate = aggregateRows[0];
    return {
      averageMastery: aggregate?.averageMastery == null ? null : Number(aggregate.averageMastery),
      skillsMeasured: aggregate?.skillsMeasured ?? 0,
      totalEvidence: Number(aggregate?.totalEvidence ?? 0),
      weakSpots: weakSpotRows.map(toWeakSpot),
    };
  }

  async getAttendance(userId: string, limit: number, before?: Date): Promise<StudentAttendanceSummary> {
    const boundedLimit = Math.max(1, Math.min(50, limit));
    const filters = [eq(practiceSessions.userId, userId)];
    if (before) filters.push(lt(practiceSessions.startedAt, before));
    const rows = await this.db
      .select({
        id: practiceSessions.id,
        startedAt: practiceSessions.startedAt,
        completedAt: practiceSessions.completedAt,
      })
      .from(practiceSessions)
      .where(and(...filters))
      .orderBy(desc(practiceSessions.startedAt))
      .limit(boundedLimit + 1);
    const hasNext = rows.length > boundedLimit;
    const page = rows.slice(0, boundedLimit);
    const entries = page.map((row) => ({
      sessionId: row.id,
      activityDate: row.startedAt.toISOString().slice(0, 10),
      startedAt: row.startedAt.getTime(),
      completedAt: row.completedAt?.getTime() ?? null,
      durationMs: row.completedAt ? Math.max(0, row.completedAt.getTime() - row.startedAt.getTime()) : null,
      completed: Boolean(row.completedAt),
    }));
    return {
      entries,
      activityCount: entries.length,
      completedCount: entries.filter((entry) => entry.completed).length,
      nextCursor: hasNext ? page.at(-1)?.startedAt.toISOString() ?? null : null,
    };
  }

  private masteryQuery(userId: string, limit: number) {
    return this.db
      .select({
        skillId: userSkillMastery.skillId,
        skillName: skills.name,
        score: userSkillMastery.score,
        confidence: userSkillMastery.confidence,
        evidenceCount: userSkillMastery.evidenceCount,
        calculatedAt: userSkillMastery.calculatedAt,
      })
      .from(userSkillMastery)
      .innerJoin(skills, eq(skills.id, userSkillMastery.skillId))
      .where(eq(userSkillMastery.userId, userId))
      .orderBy(asc(userSkillMastery.score))
      .limit(limit);
  }
}

function toWeakSpot(row: {
  skillId: string;
  skillName: string;
  score: number;
  confidence: number;
  evidenceCount: number;
  calculatedAt: Date;
}): WeakSpotSummary {
  return { ...row, calculatedAt: row.calculatedAt.getTime() };
}
