import { NextResponse } from "next/server";
import { requireRequestViewer } from "@/lib/server/auth/viewer-service";
import { getStudentAttendance } from "@/lib/server/students/student-service";
import { parseBoundedLimit, parseDateCursor, routeError } from "@/lib/server/http/route-utils";

export async function GET(request: Request) {
  try {
    const viewer = await requireRequestViewer();
    const attendance = await getStudentAttendance(
      viewer,
      parseBoundedLimit(request, 30, 50),
      parseDateCursor(request),
    );
    return NextResponse.json({ attendance });
  } catch (error) {
    return routeError(error, "Could not load attendance.");
  }
}
