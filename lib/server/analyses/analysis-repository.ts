import type { TopicTestAnalysis, TopicTestMode } from "@/lib/domain/topic-test";

export type SavedTopicTestAnalysis = {
  id: string;
  topicSlug: string;
  topicName: string;
  subtopic: string;
  mode: TopicTestMode;
  answers: string[];
  analysis: TopicTestAnalysis;
  startedAt: number;
};

export type SaveTopicTestAnalysisInput = SavedTopicTestAnalysis & { userId: string };

export interface AnalysisRepository {
  saveForUser(input: SaveTopicTestAnalysisInput): Promise<SavedTopicTestAnalysis>;
  listForUser(userId: string, limit?: number): Promise<SavedTopicTestAnalysis[]>;
  readForUser(userId: string, id: string): Promise<SavedTopicTestAnalysis | null>;
}
