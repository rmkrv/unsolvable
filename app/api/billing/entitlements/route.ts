import { NextResponse } from "next/server";
import { getEntitlements } from "@/lib/server/billing/billing-service";
import { requireRequestViewer } from "@/lib/server/auth/viewer-service";
import { routeError } from "@/lib/server/http/route-utils";

export async function GET() {
  try {
    const viewer = await requireRequestViewer();
    return NextResponse.json({ entitlements: await getEntitlements(viewer) });
  } catch (error) {
    return routeError(error, "Could not load entitlements.");
  }
}
