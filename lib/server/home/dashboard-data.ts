import { cache } from "react";
import { unstable_cache } from "next/cache";
import { listUserBoards } from "@/lib/server/boards/board-service";
import { listTopicTestAnalyses } from "@/lib/server/analyses/analysis-service";
import { getStudentHome } from "@/lib/server/students/student-service";
import type { Viewer } from "@/lib/server/auth/viewer";

export const HOME_CACHE_TAG = "home-dashboard";
const HOME_CACHE_SECONDS = 15;

const cachedUserBoards = unstable_cache(
  (viewer: Viewer, limit: number) => listUserBoards(viewer, limit),
  ["user-boards"],
  { revalidate: HOME_CACHE_SECONDS, tags: [HOME_CACHE_TAG] },
);

const cachedHomeOverview = unstable_cache(
  (viewer: Viewer) => getStudentHome(viewer),
  ["student-home-overview"],
  { revalidate: HOME_CACHE_SECONDS, tags: [HOME_CACHE_TAG] },
);

const cachedLatestAnalysis = unstable_cache(
  async (viewer: Viewer) => (await listTopicTestAnalyses(viewer, 1))[0] ?? null,
  ["latest-topic-test-analysis"],
  { revalidate: HOME_CACHE_SECONDS, tags: [HOME_CACHE_TAG] },
);

export const loadUserBoards = cache(cachedUserBoards);
export const loadRecentBoards = (viewer: Viewer) => loadUserBoards(viewer, 5);
export const loadHomeOverview = cache(cachedHomeOverview);
export const loadLatestAnalysis = cache(cachedLatestAnalysis);
