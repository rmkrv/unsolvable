import { NextResponse } from "next/server";
import { z } from "zod";
import { isSameOrigin } from "@/lib/server/auth/request-identity";
import { requireRequestViewer } from "@/lib/server/auth/viewer-service";
import { deleteEmptyTutorBoard, readTutorBoard, saveTutorBoard } from "@/lib/server/boards/board-service";
import { ResourceNotFound, Conflict } from "@/lib/server/auth/authorization-errors";
import { errorResponse } from "@/lib/server/http/api-errors";
import { routeError } from "@/lib/server/http/route-utils";
import { MAX_BOARD_SNAPSHOT_DATA_URL_LENGTH } from "@/lib/domain/board/limits";

const updateBoardSchema = z.object({
  state: z.record(z.string(), z.unknown()),
  snapshotDataUrl: z.string().startsWith("data:image/png;base64,").max(MAX_BOARD_SNAPSHOT_DATA_URL_LENGTH).nullable().optional(),
  title: z.string().trim().min(1).max(120).optional(),
  expectedVersion: z.number().int().nonnegative(),
}).strict();

export async function GET(_request: Request, context: { params: Promise<{ boardId: string }> }) {
  try {
    const viewer = await requireRequestViewer();
    const { boardId } = await context.params;
    const board = await readTutorBoard(viewer, boardId.slice(0, 120), false);
    if (!board) throw new ResourceNotFound();
    return NextResponse.json({
      board: {
        boardId: board.boardId,
        title: board.title,
        state: JSON.parse(board.stateJson),
        eventVersion: board.eventVersion,
        lastMcpAt: board.lastMcpAt,
        updatedAt: board.updatedAt,
      },
    });
  } catch (error) {
    return routeError(error, "Could not read the board.");
  }
}

export async function PUT(request: Request, context: { params: Promise<{ boardId: string }> }) {
  if (!isSameOrigin(request)) return errorResponse("cross_origin", "Cross-origin write rejected.", 403);
  try {
    const viewer = await requireRequestViewer();
    const { boardId } = await context.params;
    const raw = await request.text();
    if (raw.length > 1_800_000) return errorResponse("payload_too_large", "Board state is too large.", 413);
    const parsed = updateBoardSchema.safeParse(JSON.parse(raw || "{}"));
    if (!parsed.success) return errorResponse("invalid_input", "Invalid board state.", 400);
    const result = await saveTutorBoard(viewer, {
      boardId: boardId.slice(0, 120),
      stateJson: JSON.stringify(parsed.data.state),
      snapshotDataUrl: parsed.data.snapshotDataUrl ?? null,
      title: parsed.data.title,
      expectedVersion: parsed.data.expectedVersion,
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    if (error instanceof SyntaxError) return errorResponse("invalid_json", "Invalid JSON.", 400);
    if (error instanceof Error && error.message.startsWith("BOARD_VERSION_CONFLICT:")) {
      return routeError(new Conflict("Board changed elsewhere. Reload the latest version."));
    }
    return routeError(error, "Could not update the board.");
  }
}

export async function DELETE(request: Request, context: { params: Promise<{ boardId: string }> }) {
  if (!isSameOrigin(request)) return errorResponse("cross_origin", "Cross-origin write rejected.", 403);
  try {
    const viewer = await requireRequestViewer();
    const { boardId } = await context.params;
    const deleted = await deleteEmptyTutorBoard(viewer, boardId.slice(0, 120));
    return NextResponse.json({ deleted });
  } catch (error) {
    return routeError(error, "Could not clean up the empty board.");
  }
}
