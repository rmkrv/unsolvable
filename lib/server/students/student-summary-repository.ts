export type WeakSpotSummary = {
  skillId: string;
  skillName: string;
  score: number;
  confidence: number;
  evidenceCount: number;
  calculatedAt: number;
};

export type StudentPerformanceSummary = {
  averageMastery: number | null;
  skillsMeasured: number;
  totalEvidence: number;
  weakSpots: WeakSpotSummary[];
};

export type AttendanceEntry = {
  sessionId: string;
  activityDate: string;
  startedAt: number;
  completedAt: number | null;
  durationMs: number | null;
  completed: boolean;
};

export type StudentAttendanceSummary = {
  entries: AttendanceEntry[];
  activityCount: number;
  completedCount: number;
  nextCursor: string | null;
};

export type StudentHomeInsights = {
  friendCount: number;
  pendingRequestCount: number;
  weakSpot: WeakSpotSummary | null;
};

export interface StudentSummaryRepository {
  getHomeInsights(userId: string): Promise<StudentHomeInsights>;
  getPerformance(userId: string): Promise<StudentPerformanceSummary>;
  getAttendance(userId: string, limit: number, before?: Date): Promise<StudentAttendanceSummary>;
}
