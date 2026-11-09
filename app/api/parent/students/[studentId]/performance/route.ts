import { NextResponse } from "next/server";
import { requireRequestViewer } from "@/lib/server/auth/viewer-service";
import { getLinkedStudentPerformance } from "@/lib/server/parents/parent-dashboard-service";
import { routeError } from "@/lib/server/http/route-utils";

export async function GET(
  _request: Request,
  context: { params: Promise<{ studentId: string }> },
) {
  try {
    const viewer = await requireRequestViewer();
    const { studentId } = await context.params;
    return NextResponse.json({ performance: await getLinkedStudentPerformance(viewer, studentId) });
  } catch (error) {
    return routeError(error, "Could not load student performance.");
  }
}
