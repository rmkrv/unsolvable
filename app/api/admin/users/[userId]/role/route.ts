import { NextResponse } from "next/server";
import { z } from "zod";
import { isSameOrigin } from "@/lib/server/auth/request-identity";
import { requireRequestViewer } from "@/lib/server/auth/viewer-service";
import { changeUserRole } from "@/lib/server/admin/admin-service";
import { errorResponse } from "@/lib/server/http/api-errors";
import { routeError } from "@/lib/server/http/route-utils";

const roleSchema = z.object({
  role: z.enum(["student", "parent", "admin"]),
  confirm: z.literal(true),
}).strict();

export async function PATCH(
  request: Request,
  context: { params: Promise<{ userId: string }> },
) {
  if (!isSameOrigin(request)) return errorResponse("cross_origin", "Cross-origin write rejected.", 403);
  try {
    const viewer = await requireRequestViewer();
    const parsed = roleSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return errorResponse("confirmation_required", "Explicit confirmation is required.", 400);
    const { userId } = await context.params;
    return NextResponse.json({ user: await changeUserRole(viewer, userId, parsed.data.role) });
  } catch (error) {
    return routeError(error, "Could not change the account role.");
  }
}
