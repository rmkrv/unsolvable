import { NextResponse } from "next/server";
import { requireRequestViewer } from "@/lib/server/auth/viewer-service";
import { getParentStudents } from "@/lib/server/parents/parent-dashboard-service";
import { parseBoundedLimit, routeError } from "@/lib/server/http/route-utils";

export async function GET(request: Request) {
  try {
    const viewer = await requireRequestViewer();
    return NextResponse.json({
      students: await getParentStudents(viewer, parseBoundedLimit(request, 50, 100)),
    });
  } catch (error) {
    return routeError(error, "Could not load linked students.");
  }
}
