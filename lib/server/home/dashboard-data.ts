import { cache } from "react";
import { listUserBoards } from "@/lib/server/boards/board-service";
import { getStudentHome } from "@/lib/server/students/student-service";
import type { Viewer } from "@/lib/server/auth/viewer";

export const HOME_CACHE_TAG = "home-dashboard";
export const loadUserBoards = cache((viewer: Viewer, limit: number) => listUserBoards(viewer, limit));
export const loadRecentBoards = (viewer: Viewer) => loadUserBoards(viewer, 5);
export const loadHomeOverview = cache((viewer: Viewer) => getStudentHome(viewer));
