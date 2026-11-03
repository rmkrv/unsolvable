import { NextResponse } from "next/server";
import { dynamicTools, sanitizeBoardAction } from "../../bridge/actions.mjs";
import { verifyArithmeticEquation, verifyMathStep } from "../../bridge/math-verifier.mjs";
import { requireRequestUserId } from "@/lib/request-user";
import { enqueueTutorAction, markMcpConnected, readTutorBoard } from "@/lib/tutor-store";

export const dynamic = "force-dynamic";

const PROTOCOL_VERSION = "2026-07-28";
const OBSERVE_TOOL = {
  name: "observe_board",
  description:
    "Read the signed-in student's current Unsolvable whiteboard, newest request, page history, exact stroke IDs, and optional PNG snapshot. Call this first and again when monitoring for board changes.",
  inputSchema: {
    type: "object",
    properties: { sinceVersion: { type: "integer", minimum: 0 } },
    additionalProperties: false,
  },
};

const TOOLS = [
  OBSERVE_TOOL,
  ...dynamicTools.map((tool) => ({ name: tool.name, description: tool.description, inputSchema: tool.inputSchema })),
];

function rpcResult(id: unknown, result: unknown) {
  return NextResponse.json({ jsonrpc: "2.0", id, result }, { headers: { "cache-control": "private, no-store" } });
}

function rpcError(id: unknown, code: number, message: string) {
  return NextResponse.json(
    { jsonrpc: "2.0", id, error: { code, message } },
    { headers: { "cache-control": "private, no-store" } },
  );
}

function summarizeBoard(state: any) {
  const pages = Array.isArray(state?.pages) ? state.pages.slice(0, 20) : [];
  return {
    boardId: state?.boardId,
    activePageId: state?.activePageId,
    hintLevel: state?.hintLevel,
    viewport: state?.viewport,
    newestRequest: state?.request ?? null,
    pages: pages.map((page: any) => ({
      id: String(page?.id ?? ""),
      name: String(page?.name ?? "").slice(0, 80),
      strokes: Array.isArray(page?.strokes)
        ? page.strokes.slice(-800).map((stroke: any) => {
            const points = Array.isArray(stroke?.points) ? stroke.points : [];
            const xs = points.map((point: any) => Number(point?.x) || 0);
            const ys = points.map((point: any) => Number(point?.y) || 0);
            return {
              id: String(stroke?.id ?? ""),
              author: stroke?.author === "ai" ? "ai" : "student",
              kind: String(stroke?.kind ?? "pen"),
              pointCount: points.length,
              bbox: points.length
                ? {
                    x: Math.min(...xs),
                    y: Math.min(...ys),
                    width: Math.max(...xs) - Math.min(...xs),
                    height: Math.max(...ys) - Math.min(...ys),
                  }
                : null,
              modifiedBy: stroke?.modifiedBy,
              semantic: typeof stroke?.semantic === "string" ? stroke.semantic.slice(0, 120) : undefined,
            };
          })
        : [],
    })),
  };
}

function allowedStrokeIds(state: any) {
  const ids = new Set<string>();
  for (const page of Array.isArray(state?.pages) ? state.pages : []) {
    for (const stroke of Array.isArray(page?.strokes) ? page.strokes : []) {
      if (typeof stroke?.id === "string") ids.add(stroke.id);
    }
  }
  return ids;
}

export async function POST(request: Request) {
  let body: any;
  try {
    body = await request.json();
  } catch {
    return rpcError(null, -32700, "Invalid JSON");
  }

  const id = body?.id ?? null;
  try {
    const url = new URL(request.url);
    const isLocalDevelopment =
      process.env.NODE_ENV === "development" &&
      (url.hostname === "127.0.0.1" || url.hostname === "localhost") &&
      !request.headers.get("origin");
    const userId = isLocalDevelopment
      ? request.headers.get("oai-authenticated-user-id") ?? "local_seedy"
      : requireRequestUserId(request);
    if (body?.method === "initialize") {
      return rpcResult(id, {
        protocolVersion: "2025-06-18",
        capabilities: { tools: { listChanged: false } },
        serverInfo: { name: "unsolvable-tutor", title: "Unsolvable — AI Engineering Tutor", version: "0.1.0" },
      });
    }
    if (body?.method === "notifications/initialized") return new Response(null, { status: 202 });
    if (body?.method === "ping") return rpcResult(id, {});
    if (body?.method === "server/discover") {
      return rpcResult(id, { supportedVersions: [PROTOCOL_VERSION], capabilities: { tools: {} } });
    }
    if (body?.method === "tools/list") return rpcResult(id, { tools: TOOLS });
    if (body?.method !== "tools/call") return rpcError(id, -32601, "Method not found");

    const board = await readTutorBoard(userId);
    if (!board) return rpcError(id, -32001, "Open Unsolvable and create a board before using its Codex tools.");
    await markMcpConnected(userId);

    const name = body?.params?.name;
    const args = body?.params?.arguments ?? {};
    const state = JSON.parse(board.stateJson);

    if (name === "observe_board") {
      const summary = summarizeBoard(state);
      const unchanged = Number(args.sinceVersion) === board.eventVersion;
      const content: any[] = [
        {
          type: "text",
          text: unchanged
            ? `Board ${board.boardId} is unchanged at event version ${board.eventVersion}.`
            : `Unsolvable board event version ${board.eventVersion}.\n${JSON.stringify(summary)}`,
        },
      ];
      if (!unchanged && board.snapshotDataUrl) {
        content.push({
          type: "image",
          mimeType: "image/png",
          data: board.snapshotDataUrl.slice("data:image/png;base64,".length),
        });
      }
      return rpcResult(id, {
        content,
        structuredContent: { unchanged, eventVersion: board.eventVersion, board: summary },
      });
    }

    if (name === "verify_math_step") {
      const result = verifyMathStep(String(args.from ?? ""), String(args.to ?? ""));
      return rpcResult(id, {
        content: [{ type: "text", text: JSON.stringify(result) }],
        structuredContent: result,
      });
    }

    if (name === "verify_arithmetic_equation") {
      const result = verifyArithmeticEquation(String(args.equation ?? ""));
      return rpcResult(id, {
        content: [{ type: "text", text: JSON.stringify(result) }],
        structuredContent: result,
      });
    }

    const action = sanitizeBoardAction(name, args, allowedStrokeIds(state));
    const actionId = await enqueueTutorAction(userId, board.boardId, action);
    return rpcResult(id, {
      content: [{ type: "text", text: `Queued editable Unsolvable board action ${actionId}.` }],
      structuredContent: { queued: true, actionId, action },
    });
  } catch (error) {
    if (error instanceof Error && error.message === "AUTH_REQUIRED") {
      return rpcError(id, -32000, "Authentication required");
    }
    return rpcError(id, -32603, error instanceof Error ? error.message : "Internal error");
  }
}
