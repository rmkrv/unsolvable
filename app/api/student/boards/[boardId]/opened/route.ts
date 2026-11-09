import { NextResponse } from "next/server";
import { isSameOrigin } from "@/lib/server/auth/request-identity";
import { requireRequestViewer } from "@/lib/server/auth/viewer-service";
import { markBoardOpened } from "@/lib/server/boards/board-service";
import { ResourceNotFound } from "@/lib/server/auth/authorization-errors";
import { errorResponse } from "@/lib/server/http/api-errors";
import { routeError } from "@/lib/server/http/route-utils";

export async function POST(request: Request, context: { params: Promise<{ boardId: string }> }) {
  if (!isSameOrigin(request)) return errorResponse("cross_origin", "Cross-origin write rejected.", 403);
  try {
    const viewer = await requireRequestViewer();
    const { boardId } = await context.params;
    if (!await markBoardOpened(viewer, boardId.slice(0, 120))) throw new ResourceNotFound();
    return NextResponse.json({ ok: true });
  } catch (error) {
    return routeError(error, "Could not mark the board as opened.");
  }
}
