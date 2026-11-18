import { getDb } from "@/db";
import type { TopicTestAnalysis, TopicTestMode } from "@/lib/domain/topic-test";
import type { Viewer } from "@/lib/server/auth/viewer";
import { requireStudent } from "@/lib/server/auth/policies";
import type { AnalysisRepository } from "./analysis-repository";
import { PostgresAnalysisRepository } from "./postgres-analysis-repository";

let repository: AnalysisRepository | null = null;

export function getAnalysisRepository(): AnalysisRepository {
  repository ??= new PostgresAnalysisRepository(getDb());
  return repository;
}

export function setAnalysisRepositoryForTesting(value: AnalysisRepository | null) {
  repository = value;
}

export function listTopicTestAnalyses(viewer: Viewer, limit = 50) {
  requireStudent(viewer);
  return getAnalysisRepository().listForUser(viewer.appUserId, limit);
}

export function readTopicTestAnalysis(viewer: Viewer, id: string) {
  requireStudent(viewer);
  return getAnalysisRepository().readForUser(viewer.appUserId, id);
}

export function saveTopicTestAnalysis(viewer: Viewer, input: {
  id: string;
  topicSlug: string;
  topicName: string;
  subtopic: string;
  mode: TopicTestMode;
  answers: string[];
  analysis: TopicTestAnalysis;
  startedAt: number;
}) {
  requireStudent(viewer);
  return getAnalysisRepository().saveForUser({ ...input, userId: viewer.appUserId });
}
