import { getDb } from "@/db";
import type { Viewer } from "@/lib/server/auth/viewer";
import { requireStudent } from "@/lib/server/auth/policies";
import { getAccountProfile } from "@/lib/server/accounts/account-service";
import type { StudentSummaryRepository } from "./student-summary-repository";
import { PostgresStudentSummaryRepository } from "./postgres-student-summary-repository";

let repository: StudentSummaryRepository | null = null;

export function getStudentSummaryRepository(): StudentSummaryRepository {
  repository ??= new PostgresStudentSummaryRepository(getDb());
  return repository;
}

export function setStudentSummaryRepositoryForTesting(value: StudentSummaryRepository | null) {
  repository = value;
}

export async function getStudentHome(viewer: Viewer) {
  requireStudent(viewer);
  const [profile, insights] = await Promise.all([
    getAccountProfile(viewer),
    getStudentSummaryRepository().getHomeInsights(viewer.appUserId),
  ]);
  return { profile, insights };
}

export function getStudentPerformance(viewer: Viewer) {
  requireStudent(viewer);
  return getStudentSummaryRepository().getPerformance(viewer.appUserId);
}

export function getStudentAttendance(viewer: Viewer, limit = 30, before?: Date) {
  requireStudent(viewer);
  return getStudentSummaryRepository().getAttendance(viewer.appUserId, limit, before);
}
