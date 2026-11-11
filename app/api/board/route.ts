import { NextResponse } from "next/server";
import { z } from "zod";
import { isSameOrigin } from "@/lib/server/auth/request-identity";
import { requireRequestViewer } from "@/lib/server/auth/viewer-service";
import { readTutorActions, readTutorBoard, saveTutorBoard } from "@/lib/server/boards/board-service";
import { Conflict } from "@/lib/server/auth/authorization-errors";
import { errorResponse } from "@/lib/server/http/api-errors";
import { deprecationHeaders, routeError } from "@/lib/server/http/route-utils";

export const dynamic = "force-dynamic";

const updateSchema = z.object({
  boardId: z.string().trim().min(1).max(120),
  state: z.record(z.string(), z.unknown()),
  snapshotDataUrl: z.string().startsWith("data:image/png;base64,").max(750_000).nullable().optional(),
  title: z.string().max(120).optional(),
  expectedVersion: z.number().int().nonnegative().optional(),
}).strict();

export async function GET(request: Request) {
  try {
    const viewer = await requireRequestViewer();
    const url = new URL(request.url);
    const boardId = url.searchParams.get("boardId")?.trim();
    if (!boardId) return deprecated(errorResponse("invalid_input", "A board ID is required.", 400));
    const board = await readTutorBoard(viewer, boardId.slice(0, 120), false);
    if (!board) return deprecated(NextResponse.json({ board: null, actions: [] }));
    const after = Number(url.searchParams.get("after") || 0);
    const actions = await readTutorActions(viewer, board.boardId, Number.isFinite(after) ? after : 0);
    return deprecated(NextResponse.json({
      board: {
        boardId: board.boardId,
        state: JSON.parse(board.stateJson),
        eventVersion: board.eventVersion,
        lastMcpAt: board.lastMcpAt,
        updatedAt: board.updatedAt,
      },
      actions: actions.map((action) => ({ id: action.id, value: JSON.parse(action.actionJson) })),
    }));
  } catch (error) {
    return deprecated(routeError(error, "Could not read the board."));
  }
}

export async function PUT(request: Request) {
  if (!isSameOrigin(request)) return deprecated(errorResponse("cross_origin", "Cross-origin write rejected.", 403));
  try {
    const viewer = await requireRequestViewer();
    const raw = await request.text();
    if (raw.length > 1_800_000) return deprecated(errorResponse("payload_too_large", "Board state is too large.", 413));
    const parsed = updateSchema.safeParse(JSON.parse(raw || "{}"));
    if (!parsed.success) return deprecated(errorResponse("invalid_input", "Invalid board state.", 400));
    const result = await saveTutorBoard(viewer, {
      boardId: parsed.data.boardId,
      stateJson: JSON.stringify(parsed.data.state),
      snapshotDataUrl: parsed.data.snapshotDataUrl ?? null,
      title: parsed.data.title,
      expectedVersion: parsed.data.expectedVersion,
    });
    return deprecated(NextResponse.json({ ok: true, ...result }));
  } catch (error) {
    if (error instanceof SyntaxError) return deprecated(errorResponse("invalid_json", "Invalid JSON.", 400));
    if (error instanceof Error && error.message.startsWith("BOARD_VERSION_CONFLICT:")) {
      return deprecated(routeError(new Conflict("Board changed elsewhere. Reload the latest version.")));
    }
    return deprecated(routeError(error, "Could not update the board."));
  }
}

function deprecated(response: Response) {
  for (const [key, value] of Object.entries(deprecationHeaders)) response.headers.set(key, value);
  response.headers.set("Link", "</api/student/boards>; rel=\"successor-version\"");
  return response;
}
