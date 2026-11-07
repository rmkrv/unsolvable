import { NextResponse } from "next/server";
import { z } from "zod";
import { isSameOrigin, requireRequestUserId } from "@/lib/server/auth/request-identity";
import { createTutorBoard, listUserBoards } from "@/lib/server/boards/board-service";

export const dynamic = "force-dynamic";

const createBoardSchema = z.object({
  title: z.string().trim().min(1).max(120).optional(),
});

export async function GET(request: Request) {
  try {
    const userId = await requireRequestUserId();
    const requestedLimit = Number(new URL(request.url).searchParams.get("limit") || 12);
    const boards = await listUserBoards(userId, Number.isFinite(requestedLimit) ? requestedLimit : 12);
    return NextResponse.json({ boards });
  } catch (error) {
    if (error instanceof Error && error.message === "AUTH_REQUIRED") {
      return NextResponse.json({ error: "Sign in to view boards." }, { status: 401 });
    }
    return NextResponse.json({ error: "Could not list boards." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  if (!isSameOrigin(request)) {
    return NextResponse.json({ error: "Cross-origin write rejected." }, { status: 403 });
  }
  try {
    const userId = await requireRequestUserId();
    const parsed = createBoardSchema.safeParse(await request.json().catch(() => ({})));
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid board details." }, { status: 400 });
    }
    const board = await createTutorBoard(userId, parsed.data.title);
    return NextResponse.json({ board }, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message === "AUTH_REQUIRED") {
      return NextResponse.json({ error: "Sign in to create a board." }, { status: 401 });
    }
    return NextResponse.json({ error: "Could not create the board." }, { status: 500 });
  }
}
