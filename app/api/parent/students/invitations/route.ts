import { NextResponse } from "next/server";
import { z } from "zod";
import { isSameOrigin } from "@/lib/server/auth/request-identity";
import { requireRequestViewer } from "@/lib/server/auth/viewer-service";
import { inviteStudent } from "@/lib/server/parents/parent-dashboard-service";
import { errorResponse } from "@/lib/server/http/api-errors";
import { routeError } from "@/lib/server/http/route-utils";

const invitationSchema = z.object({ studentId: z.string().uuid() }).strict();

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return errorResponse("cross_origin", "Cross-origin write rejected.", 403);
  try {
    const viewer = await requireRequestViewer();
    const parsed = invitationSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return errorResponse("invalid_input", "A valid student ID is required.", 400);
    return NextResponse.json({ invitation: await inviteStudent(viewer, parsed.data.studentId) }, { status: 201 });
  } catch (error) {
    return routeError(error, "Could not create the invitation.");
  }
}
