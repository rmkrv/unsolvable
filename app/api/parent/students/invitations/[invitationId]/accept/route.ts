import { NextResponse } from "next/server";
import { isSameOrigin } from "@/lib/server/auth/request-identity";
import { requireRequestViewer } from "@/lib/server/auth/viewer-service";
import { acceptStudentInvitation } from "@/lib/server/parents/parent-dashboard-service";
import { errorResponse } from "@/lib/server/http/api-errors";
import { routeError } from "@/lib/server/http/route-utils";

export async function POST(
  request: Request,
  context: { params: Promise<{ invitationId: string }> },
) {
  if (!isSameOrigin(request)) return errorResponse("cross_origin", "Cross-origin write rejected.", 403);
  try {
    const viewer = await requireRequestViewer();
    const { invitationId } = await context.params;
    return NextResponse.json({ link: await acceptStudentInvitation(viewer, invitationId) });
  } catch (error) {
    return routeError(error, "Could not accept the invitation.");
  }
}
