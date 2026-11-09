import { revalidateTag } from "next/cache";
import { NextResponse } from "next/server";
import { z } from "zod";
import { isSameOrigin } from "@/lib/server/auth/request-identity";
import { requireRequestViewer } from "@/lib/server/auth/viewer-service";
import { createTutorBoard, listUserBoards } from "@/lib/server/boards/board-service";
import { HOME_CACHE_TAG } from "@/lib/server/home/dashboard-data";
import { errorResponse } from "@/lib/server/http/api-errors";
import { parseBoundedLimit, routeError } from "@/lib/server/http/route-utils";

const createBoardSchema = z.object({ title: z.string().trim().min(1).max(120).optional() }).strict();

export async function GET(request: Request) {
  try {
    const viewer = await requireRequestViewer();
    return NextResponse.json({ boards: await listUserBoards(viewer, parseBoundedLimit(request, 12, 50)) });
  } catch (error) {
    return routeError(error, "Could not list boards.");
  }
}

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return errorResponse("cross_origin", "Cross-origin write rejected.", 403);
  try {
    const viewer = await requireRequestViewer();
    const parsed = createBoardSchema.safeParse(await request.json().catch(() => ({})));
    if (!parsed.success) return errorResponse("invalid_input", "Invalid board details.", 400);
    const board = await createTutorBoard(viewer, parsed.data.title);
    revalidateTag(HOME_CACHE_TAG, "max");
    return NextResponse.json({ board }, { status: 201 });
  } catch (error) {
    return routeError(error, "Could not create the board.");
  }
}
