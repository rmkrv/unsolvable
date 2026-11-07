import { cache } from "react";
import { unstable_cache } from "next/cache";
import { listUserBoards } from "@/lib/server/boards/board-service";
import { getHomeOverviewForIdentity } from "@/lib/server/users/user-service";

export const HOME_CACHE_TAG = "home-dashboard";
const HOME_CACHE_SECONDS = 15;

const cachedRecentBoards = unstable_cache(
  (userId: string) => listUserBoards(userId, 5),
  ["home-recent-boards"],
  { revalidate: HOME_CACHE_SECONDS, tags: [HOME_CACHE_TAG] },
);

const cachedOverview = unstable_cache(
  (userId: string, suggestedDisplayName: string) => getHomeOverviewForIdentity(userId, suggestedDisplayName),
  ["home-overview"],
  { revalidate: HOME_CACHE_SECONDS, tags: [HOME_CACHE_TAG] },
);

export const loadRecentBoards = cache(cachedRecentBoards);
export const loadHomeOverview = cache(cachedOverview);
