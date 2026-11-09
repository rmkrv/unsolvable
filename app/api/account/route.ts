import { NextResponse } from "next/server";
import { requireRequestViewer } from "@/lib/server/auth/viewer-service";
import { getAccount } from "@/lib/server/accounts/account-service";
import { routeError } from "@/lib/server/http/route-utils";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const viewer = await requireRequestViewer();
    return NextResponse.json({ account: await getAccount(viewer) });
  } catch (error) {
    return routeError(error, "Could not load the account.");
  }
}
