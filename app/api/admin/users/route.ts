import { NextResponse } from "next/server";
import { requireRequestViewer } from "@/lib/server/auth/viewer-service";
import { listAdminUsers } from "@/lib/server/admin/admin-service";
import { parseBoundedLimit, routeError } from "@/lib/server/http/route-utils";

export async function GET(request: Request) {
  try {
    const viewer = await requireRequestViewer();
    return NextResponse.json({ users: await listAdminUsers(viewer, parseBoundedLimit(request, 50, 100)) });
  } catch (error) {
    return routeError(error, "Could not load users.");
  }
}
