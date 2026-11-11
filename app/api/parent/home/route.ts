import { NextResponse } from "next/server";
import { requireRequestViewer } from "@/lib/server/auth/viewer-service";
import { getParentHome } from "@/lib/server/parents/parent-dashboard-service";
import { routeError } from "@/lib/server/http/route-utils";

export async function GET() {
  try {
    const viewer = await requireRequestViewer();
    return NextResponse.json({ home: await getParentHome(viewer) });
  } catch (error) {
    return routeError(error, "Could not load the parent dashboard.");
  }
}
