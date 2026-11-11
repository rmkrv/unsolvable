import { getDb } from "@/db";
import { PostgresAuditRepository } from "./postgres-audit-repository";
import type { AuditEventInput, AuditRepository } from "./audit-repository";

let repository: AuditRepository | null = null;

export function getAuditRepository(): AuditRepository {
  repository ??= new PostgresAuditRepository(getDb());
  return repository;
}

export function setAuditRepositoryForTesting(value: AuditRepository | null) {
  repository = value;
}

export function recordAuditEvent(input: AuditEventInput) {
  return getAuditRepository().record(input);
}
