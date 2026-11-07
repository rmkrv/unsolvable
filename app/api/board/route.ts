import { NextResponse } from "next/server";
import { isSameOrigin, requireRequestUserId } from "@/lib/server/auth/request-identity";
import { readTutorActions, readTutorBoard, saveTutorBoard } from "@/lib/server/boards/board-service";

export const dynamic = "force-dynamic";

function authError(error: unknown) {
  if (error instanceof Error && error.message === "AUTH_REQUIRED") {
    return NextResponse.json({ error: "Sign in to use the shared board." }, { status: 401 });
  }
  return null;
}

export async function GET(request: Request) {
  try {
    const userId = await requireRequestUserId();
    const url = new URL(request.url);
    const boardId = url.searchParams.get("boardId")?.trim();
    if (!boardId) return NextResponse.json({ error: "A board ID is required." }, { status: 400 });
    const board = await readTutorBoard(userId, boardId.slice(0, 120), false);
    if (!board) return NextResponse.json({ board: null, actions: [] });

    const after = Number(url.searchParams.get("after") || 0);
    const actions = await readTutorActions(userId, board.boardId, Number.isFinite(after) ? after : 0);
    return NextResponse.json({
      board: {
        boardId: board.boardId,
        state: JSON.parse(board.stateJson),
        eventVersion: board.eventVersion,
        lastMcpAt: board.lastMcpAt,
        updatedAt: board.updatedAt,
      },
      actions: actions.map((action) => ({ id: action.id, value: JSON.parse(action.actionJson) })),
    });
  } catch (error) {
    return authError(error) ?? NextResponse.json({ error: "Could not read the shared board." }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  if (!isSameOrigin(request)) return NextResponse.json({ error: "Cross-origin write rejected." }, { status: 403 });
  try {
    const userId = await requireRequestUserId();
    const raw = await request.text();
    if (raw.length > 1_800_000) return NextResponse.json({ error: "Board state is too large." }, { status: 413 });
    const body = JSON.parse(raw || "{}");
    if (typeof body.boardId !== "string" || !body.boardId || typeof body.state !== "object") {
      return NextResponse.json({ error: "Invalid board state." }, { status: 400 });
    }
    const snapshotDataUrl =
      typeof body.snapshotDataUrl === "string" &&
      body.snapshotDataUrl.startsWith("data:image/png;base64,") &&
      body.snapshotDataUrl.length <= 750_000
        ? body.snapshotDataUrl
        : null;
    const expectedVersion = Number.isInteger(body.expectedVersion) && body.expectedVersion >= 0
      ? body.expectedVersion
      : undefined;
    const result = await saveTutorBoard({
      userId,
      boardId: body.boardId.slice(0, 120),
      stateJson: JSON.stringify(body.state),
      snapshotDataUrl,
      title: typeof body.title === "string" ? body.title.slice(0, 120) : undefined,
      expectedVersion,
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("BOARD_VERSION_CONFLICT:")) {
      return NextResponse.json(
        { error: "Board changed elsewhere. Reloading the latest version.", currentVersion: Number(error.message.split(":")[1]) },
        { status: 409 },
      );
    }
    return authError(error) ?? NextResponse.json({ error: "Could not update the shared board." }, { status: 500 });
  }
}
