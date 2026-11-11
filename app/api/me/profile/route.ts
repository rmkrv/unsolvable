import { NextResponse } from "next/server";
import { PATCH as patchProfile } from "@/app/api/account/profile/route";
import { getAccountProfile } from "@/lib/server/accounts/account-service";
import { requireRequestViewer } from "@/lib/server/auth/viewer-service";
import { getBilling } from "@/lib/server/billing/billing-service";
import { deprecationHeaders, routeError } from "@/lib/server/http/route-utils";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const viewer = await requireRequestViewer();
    const [profile, billing] = await Promise.all([getAccountProfile(viewer), getBilling(viewer)]);
    return deprecated(NextResponse.json({ profile, billing, email: viewer.email }));
  } catch (error) {
    return deprecated(routeError(error, "Could not load the profile."));
  }
}

export async function PATCH(request: Request) {
  return deprecated(await patchProfile(request));
}

function deprecated(response: Response) {
  for (const [key, value] of Object.entries(deprecationHeaders)) response.headers.set(key, value);
  response.headers.set("Link", "</api/account>; rel=\"successor-version\"");
  return response;
}
