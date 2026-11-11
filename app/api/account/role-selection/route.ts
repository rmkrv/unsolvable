import { NextResponse } from "next/server";
import { z } from "zod";
import { isSameOrigin } from "@/lib/server/auth/request-identity";
import { requireRequestViewer, selectPublicRole } from "@/lib/server/auth/viewer-service";
import { roleEntryPath } from "@/lib/server/auth/viewer";
import { errorResponse } from "@/lib/server/http/api-errors";
import { routeError } from "@/lib/server/http/route-utils";

const roleSchema = z.object({ role: z.enum(["student", "parent"]) }).strict();

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return errorResponse("cross_origin", "Cross-origin write rejected.", 403);
  try {
    const viewer = await requireRequestViewer();
    const parsed = roleSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return errorResponse("invalid_input", "Choose student or parent.", 400);
    const updated = await selectPublicRole(viewer, parsed.data.role);
    return NextResponse.json({ role: updated.role, entryPath: roleEntryPath(updated.role) });
  } catch (error) {
    return routeError(error, "Could not confirm the account role.");
  }
}
