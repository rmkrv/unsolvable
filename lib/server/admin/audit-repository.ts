export type AuditEventInput = {
  actorUserId: string | null;
  targetUserId: string | null;
  action: string;
  targetType: string;
  targetId: string;
  metadata?: Record<string, string | number | boolean | null>;
};

export type AuditEventRecord = AuditEventInput & {
  id: string;
  createdAt: number;
};

export interface AuditRepository {
  record(input: AuditEventInput): Promise<void>;
  list(limit: number, before?: Date): Promise<AuditEventRecord[]>;
}
