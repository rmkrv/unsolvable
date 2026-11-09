import { NextResponse } from "next/server";
import { requireRequestViewer } from "@/lib/server/auth/viewer-service";
import { getStudentPerformance } from "@/lib/server/students/student-service";
import { routeError } from "@/lib/server/http/route-utils";

export async function GET() {
  try {
    const viewer = await requireRequestViewer();
    return NextResponse.json({ performance: await getStudentPerformance(viewer) });
  } catch (error) {
    return routeError(error, "Could not load performance.");
  }
}
