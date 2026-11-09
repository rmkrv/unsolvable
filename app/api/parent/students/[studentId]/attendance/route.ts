import { NextResponse } from "next/server";
import { requireRequestViewer } from "@/lib/server/auth/viewer-service";
import { getLinkedStudentAttendance } from "@/lib/server/parents/parent-dashboard-service";
import { parseBoundedLimit, parseDateCursor, routeError } from "@/lib/server/http/route-utils";

export async function GET(
  request: Request,
  context: { params: Promise<{ studentId: string }> },
) {
  try {
    const viewer = await requireRequestViewer();
    const { studentId } = await context.params;
    const attendance = await getLinkedStudentAttendance(
      viewer,
      studentId,
      parseBoundedLimit(request, 30, 50),
      parseDateCursor(request),
    );
    return NextResponse.json({ attendance });
  } catch (error) {
    return routeError(error, "Could not load student attendance.");
  }
}
