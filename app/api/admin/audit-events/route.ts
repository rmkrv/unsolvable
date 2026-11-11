import { NextResponse } from "next/server";
import { requireRequestViewer } from "@/lib/server/auth/viewer-service";
import { listAuditEvents } from "@/lib/server/admin/admin-service";
import { parseBoundedLimit, parseDateCursor, routeError } from "@/lib/server/http/route-utils";

export async function GET(request: Request) {
  try {
    const viewer = await requireRequestViewer();
    const events = await listAuditEvents(
      viewer,
      parseBoundedLimit(request, 50, 100),
      parseDateCursor(request),
    );
    return NextResponse.json({ events });
  } catch (error) {
    return routeError(error, "Could not load audit events.");
  }
}
