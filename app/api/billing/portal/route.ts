import { NextResponse } from "next/server";
import { createBillingPortalSession } from "@/lib/server/billing/billing-service";
import { isSameOrigin } from "@/lib/server/auth/request-identity";
import { requireRequestViewer } from "@/lib/server/auth/viewer-service";
import { errorResponse } from "@/lib/server/http/api-errors";
import { routeError } from "@/lib/server/http/route-utils";

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return errorResponse("cross_origin", "Cross-origin write rejected.", 403);
  try {
    const viewer = await requireRequestViewer();
    const session = await createBillingPortalSession(viewer);
    return NextResponse.json(session);
  } catch (error) {
    return routeError(error, "Could not open the billing portal.");
  }
}
