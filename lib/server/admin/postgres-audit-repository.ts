import { desc, lt } from "drizzle-orm";
import type { getDb } from "../../../db/index.ts";
import { auditEvents } from "../../../db/schema.ts";
import type { AuditEventInput, AuditEventRecord, AuditRepository } from "./audit-repository";

type Database = ReturnType<typeof getDb>;

export class PostgresAuditRepository implements AuditRepository {
  private readonly db: Database;

  constructor(db: Database) {
    this.db = db;
  }

  async record(input: AuditEventInput): Promise<void> {
    await this.db.insert(auditEvents).values({ ...input, metadata: input.metadata ?? {} });
  }

  async list(limit: number, before?: Date): Promise<AuditEventRecord[]> {
    const query = this.db.select().from(auditEvents);
    const rows = await (before ? query.where(lt(auditEvents.createdAt, before)) : query)
      .orderBy(desc(auditEvents.createdAt))
      .limit(Math.max(1, Math.min(100, limit)));
    return rows.map((row) => ({
      id: row.id,
      actorUserId: row.actorUserId,
      targetUserId: row.targetUserId,
      action: row.action,
      targetType: row.targetType,
      targetId: row.targetId,
      metadata: boundedMetadata(row.metadata),
      createdAt: row.createdAt.getTime(),
    }));
  }
}

function boundedMetadata(value: unknown): Record<string, string | number | boolean | null> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return Object.fromEntries(
    Object.entries(value)
      .slice(0, 20)
      .filter((entry): entry is [string, string | number | boolean | null] => {
        const item = entry[1];
        return item === null || ["string", "number", "boolean"].includes(typeof item);
      })
      .map(([key, item]) => [key.slice(0, 80), typeof item === "string" ? item.slice(0, 500) : item]),
  );
}
