import { NextResponse } from "next/server";
import { isSameOrigin } from "@/lib/server/auth/request-identity";
import { requireRequestViewer } from "@/lib/server/auth/viewer-service";
import { revokeStudentLink } from "@/lib/server/parents/parent-dashboard-service";
import { errorResponse } from "@/lib/server/http/api-errors";
import { routeError } from "@/lib/server/http/route-utils";

export async function DELETE(
  request: Request,
  context: { params: Promise<{ studentId: string }> },
) {
  if (!isSameOrigin(request)) return errorResponse("cross_origin", "Cross-origin write rejected.", 403);
  try {
    const viewer = await requireRequestViewer();
    const { studentId } = await context.params;
    await revokeStudentLink(viewer, studentId);
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return routeError(error, "Could not remove the student link.");
  }
}
