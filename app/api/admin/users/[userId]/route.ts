import { NextResponse } from "next/server";
import { requireRequestViewer } from "@/lib/server/auth/viewer-service";
import { getAdminUser } from "@/lib/server/admin/admin-service";
import { routeError } from "@/lib/server/http/route-utils";

export async function GET(_request: Request, context: { params: Promise<{ userId: string }> }) {
  try {
    const viewer = await requireRequestViewer();
    const { userId } = await context.params;
    return NextResponse.json({ user: await getAdminUser(viewer, userId) });
  } catch (error) {
    return routeError(error, "Could not load the user.");
  }
}
