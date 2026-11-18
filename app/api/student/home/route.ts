import { NextResponse } from "next/server";
import { requireRequestViewer } from "@/lib/server/auth/viewer-service";
import { listUserBoards } from "@/lib/server/boards/board-service";
import { listTopicTestAnalyses } from "@/lib/server/analyses/analysis-service";
import { getStudentHome } from "@/lib/server/students/student-service";
import { routeError } from "@/lib/server/http/route-utils";

export async function GET() {
  try {
    const viewer = await requireRequestViewer();
    const [{ profile, insights }, recentBoards, analyses] = await Promise.all([
      getStudentHome(viewer),
      listUserBoards(viewer, 5),
      listTopicTestAnalyses(viewer, 1),
    ]);
    return NextResponse.json({ profile, recentBoards, latestAnalysis: analyses[0] ?? null, ...insights });
  } catch (error) {
    return routeError(error, "Could not load student Home.");
  }
}
