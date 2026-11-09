import { revalidateTag } from "next/cache";
import { NextResponse } from "next/server";
import { z } from "zod";
import { updateAccountProfile } from "@/lib/server/accounts/account-service";
import { isSameOrigin } from "@/lib/server/auth/request-identity";
import { requireRequestViewer } from "@/lib/server/auth/viewer-service";
import { HOME_CACHE_TAG } from "@/lib/server/home/dashboard-data";
import { errorResponse } from "@/lib/server/http/api-errors";
import { routeError } from "@/lib/server/http/route-utils";

const profileSchema = z.object({
  displayName: z.string().trim().min(1).max(100),
  isDiscoverable: z.boolean(),
}).strict();

export async function PATCH(request: Request) {
  if (!isSameOrigin(request)) return errorResponse("cross_origin", "Cross-origin write rejected.", 403);
  try {
    const viewer = await requireRequestViewer();
    const parsed = profileSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return errorResponse("invalid_input", "Invalid profile details.", 400);
    const profile = await updateAccountProfile(viewer, parsed.data);
    revalidateTag(HOME_CACHE_TAG, "max");
    return NextResponse.json({ profile });
  } catch (error) {
    return routeError(error, "Could not update the profile.");
  }
}
