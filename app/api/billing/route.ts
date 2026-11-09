import { NextResponse } from "next/server";
import { getBilling } from "@/lib/server/billing/billing-service";
import { requireRequestViewer } from "@/lib/server/auth/viewer-service";
import { routeError } from "@/lib/server/http/route-utils";

export async function GET() {
  try {
    const viewer = await requireRequestViewer();
    return NextResponse.json({ billing: await getBilling(viewer) });
  } catch (error) {
    return routeError(error, "Could not load billing.");
  }
}
