import { cache } from "react";
import { unstable_cache } from "next/cache";
import { listUserBoards } from "@/lib/server/boards/board-service";
import { getHomeOverviewForIdentity } from "@/lib/server/users/user-service";

export const HOME_CACHE_TAG = "home-dashboard";
const HOME_CACHE_SECONDS = 15;

const cachedUserBoards = unstable_cache(
  (userId: string, limit: number) => listUserBoards(userId, limit),
  ["user-boards"],
  { revalidate: HOME_CACHE_SECONDS, tags: [HOME_CACHE_TAG] },
);

const cachedOverview = unstable_cache(
  (userId: string, suggestedDisplayName: string) => getHomeOverviewForIdentity(userId, suggestedDisplayName),
  ["home-overview"],
  { revalidate: HOME_CACHE_SECONDS, tags: [HOME_CACHE_TAG] },
);

export const loadUserBoards = cache(cachedUserBoards);
export const loadRecentBoards = (userId: string) => loadUserBoards(userId, 5);
export const loadHomeOverview = cache(cachedOverview);
