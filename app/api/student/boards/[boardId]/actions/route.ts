import { NextResponse } from "next/server";
import { requireRequestViewer } from "@/lib/server/auth/viewer-service";
import { readTutorActions } from "@/lib/server/boards/board-service";
import { routeError } from "@/lib/server/http/route-utils";

export async function GET(request: Request, context: { params: Promise<{ boardId: string }> }) {
  try {
    const viewer = await requireRequestViewer();
    const { boardId } = await context.params;
    const after = Number(new URL(request.url).searchParams.get("after") ?? 0);
    const actions = await readTutorActions(
      viewer,
      boardId.slice(0, 120),
      Number.isFinite(after) ? Math.max(0, Math.trunc(after)) : 0,
    );
    return NextResponse.json({
      actions: actions.map((action) => ({ id: action.id, value: JSON.parse(action.actionJson) })),
    });
  } catch (error) {
    return routeError(error, "Could not read board actions.");
  }
}
