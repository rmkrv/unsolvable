import { NextResponse } from "next/server";
import { dynamicTools, sanitizeBoardAction } from "../../bridge/actions.mjs";
import { verifyArithmeticEquation, verifyMathStep } from "../../bridge/math-verifier.mjs";
import type { BoardCommand, StrokeDraft } from "@/lib/domain/board/commands";
import { makeId, strokeBounds, type BoardDocument, type Stroke } from "@/lib/domain/board/model";
import { aggregateStrokeBounds } from "@/lib/domain/board/operations";
import type { BoardAction } from "@/lib/domain/tutor/board-action";
import { boardToolAnnotations } from "@/lib/domain/tutor/mcp-tool-policy";
import { getMcpOAuth } from "@/lib/server/auth/mcp-oauth";
import { resolveViewerForAuthSubject } from "@/lib/server/auth/viewer-service";
import { applyTutorBoardCommands, enqueueTutorAction, markMcpConnected, readTutorBoard } from "@/lib/server/boards/board-service";
import { findFreeHandwritingAnchor } from "@/lib/handwriting-placement.mjs";
import {
  generateArrow,
  generateFeedbackStroke,
  generateHandwriting,
  generatePlainText,
  generateTemplate,
  measureHandwriting,
} from "@/lib/trajectory-generator";

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
  { ...OBSERVE_TOOL, annotations: boardToolAnnotations(OBSERVE_TOOL.name) },
  ...dynamicTools.map((tool) => ({
    name: tool.name,
    description: tool.description,
    inputSchema: tool.inputSchema,
    annotations: boardToolAnnotations(tool.name),
  })),
];

type JsonValue = string | number | boolean | null | JsonObject | JsonValue[];
type JsonObject = { [key: string]: JsonValue | undefined };
type RpcContent =
  | { type: "text"; text: string }
  | { type: "image"; mimeType: "image/png"; data: string };

function asObject(value: unknown): JsonObject {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as JsonObject
    : {};
}

function rpcResult(id: unknown, result: unknown) {
  return NextResponse.json({ jsonrpc: "2.0", id, result }, { headers: { "cache-control": "private, no-store" } });
}

function rpcError(id: unknown, code: number, message: string) {
  return NextResponse.json(
    { jsonrpc: "2.0", id, error: { code, message } },
    { headers: { "cache-control": "private, no-store" } },
  );
}

function summarizeBoard(stateValue: unknown) {
  const state = asObject(stateValue);
  const pages = Array.isArray(state.pages) ? state.pages.slice(0, 20) : [];
  const viewport = asObject(state.viewport);
  const snapshot = asObject(state.snapshot);
  const zoom = Number(viewport.zoom) || 1;
  const cssWidth = Number(snapshot.cssWidth) || 1200;
  const cssHeight = Number(snapshot.cssHeight) || 800;
  return {
    boardId: state.boardId,
    activePageId: state.activePageId,
    hintLevel: state.hintLevel,
    autoObserve: state.autoObserve === true,
    viewport,
    snapshot: state.snapshot,
    visibleWorldBounds: {
      left: -(Number(viewport.x) || 0) / zoom,
      top: -(Number(viewport.y) || 0) / zoom,
      right: (cssWidth - (Number(viewport.x) || 0)) / zoom,
      bottom: (cssHeight - (Number(viewport.y) || 0)) / zoom,
    },
    newestRequest: state.request ?? null,
    pages: pages.map((pageValue) => {
      const page = asObject(pageValue);
      return {
        id: String(page.id ?? ""),
        name: String(page.name ?? "").slice(0, 80),
        strokes: Array.isArray(page.strokes)
          ? page.strokes.slice(-800).map((strokeValue) => {
            const stroke = asObject(strokeValue);
            const points = Array.isArray(stroke.points) ? stroke.points.map(asObject) : [];
            const xs = points.map((point) => Number(point.x) || 0);
            const ys = points.map((point) => Number(point.y) || 0);
            return {
              id: String(stroke.id ?? ""),
              author: stroke.author === "ai" ? "ai" : "student",
              kind: String(stroke.kind ?? "pen"),
              pointCount: points.length,
              bbox: points.length
                ? {
                    x: Math.min(...xs),
                    y: Math.min(...ys),
                    width: Math.max(...xs) - Math.min(...xs),
                    height: Math.max(...ys) - Math.min(...ys),
                  }
                : null,
              modifiedBy: stroke.modifiedBy,
              semantic: typeof stroke.semantic === "string" ? stroke.semantic.slice(0, 120) : undefined,
              groupId: typeof stroke.groupId === "string" ? stroke.groupId : undefined,
            };
          })
          : [],
      };
    }),
  };
}

function expectedVersion(args: JsonObject, fallback: number) {
  const value = Number(args.expectedVersion);
  return Number.isInteger(value) && value >= 0 ? value : fallback;
}

function stringIds(value: JsonValue | undefined, maximum = 100) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string").slice(0, maximum) : [];
}

function directCommands(name: JsonValue | undefined, args: JsonObject): BoardCommand[] | null {
  if (name === "board_add_strokes") {
    const pageId = String(args.pageId ?? "");
    const strokes: StrokeDraft[] = (Array.isArray(args.strokes) ? args.strokes : []).slice(0, 40).map((value) => {
      const stroke = asObject(value);
      const points = (Array.isArray(stroke.points) ? stroke.points : []).slice(0, 500).map((pointValue, index) => {
        const point = asObject(pointValue);
        return {
          x: Number(point.x),
          y: Number(point.y),
          pressure: Number.isFinite(Number(point.pressure)) ? Number(point.pressure) : 0.6,
          t: index * 12,
        };
      });
      return {
        id: makeId("ai"),
        points,
        color: typeof stroke.color === "string" ? stroke.color : "#3558d4",
        width: Number.isFinite(Number(stroke.width)) ? Number(stroke.width) : 3,
        opacity: Number.isFinite(Number(stroke.opacity)) ? Number(stroke.opacity) : 1,
        kind: stroke.kind === "highlighter" ? "highlighter" : "pen",
        semantic: "agent:freehand",
      };
    });
    return [{ type: "stroke.add", pageId, strokes }];
  }
  if (name === "board_move_strokes") {
    return [{
      type: "stroke.move",
      pageId: String(args.pageId ?? ""),
      strokeIds: stringIds(args.strokeIds),
      dx: Number(args.dx),
      dy: Number(args.dy),
    }];
  }
  if (name === "board_delete_strokes") {
    return [{ type: "stroke.delete", pageId: String(args.pageId ?? ""), strokeIds: stringIds(args.strokeIds) }];
  }
  if (name === "board_manage_page") {
    const operation = String(args.operation ?? "");
    const pageId = String(args.pageId ?? "");
    if (operation === "create") return [{
      type: "page.create",
      pageId,
      name: String(args.name ?? "New page"),
      afterPageId: typeof args.afterPageId === "string" ? args.afterPageId : undefined,
    }];
    if (operation === "rename") return [{ type: "page.rename", pageId, name: String(args.name ?? "") }];
    if (operation === "delete") return [{ type: "page.delete", pageId }];
    throw new Error("BOARD_PAGE_OPERATION_INVALID");
  }
  if (name === "board_set_hint_level") {
    return [{ type: "hint.set", level: Number(args.level) }];
  }
  return null;
}

function asDrafts(strokes: Stroke[]): StrokeDraft[] {
  return strokes.map((stroke) => ({
    id: stroke.id,
    points: stroke.points,
    color: stroke.color,
    width: stroke.width,
    opacity: stroke.opacity,
    kind: stroke.kind,
    semantic: stroke.semantic,
    groupId: stroke.groupId,
    createdAt: stroke.createdAt,
  }));
}

function commandsForAction(action: BoardAction, state: BoardDocument): { commands: BoardCommand[]; speech: string } {
  const page = state.pages.find((candidate) => candidate.id === state.activePageId) ?? state.pages[0];
  if (!page) throw new Error("BOARD_PAGE_NOT_FOUND");
  if (action.type === "write") {
    const nearby = page.strokes.filter((stroke) => action.nearStrokeIds.includes(stroke.id));
    const target = aggregateStrokeBounds(nearby);
    const zoom = state.viewport.zoom || 1;
    const viewport = {
      x: -state.viewport.x / zoom,
      y: -state.viewport.y / zoom,
      width: (state.snapshot?.cssWidth ?? 1200) / zoom,
      height: (state.snapshot?.cssHeight ?? 800) / zoom,
    };
    const measured = measureHandwriting(action.text, action.size);
    const anchor = findFreeHandwritingAnchor({
      target,
      occupied: page.strokes.map(strokeBounds),
      viewport,
      width: measured.width,
      height: measured.height,
    });
    return {
      commands: [{ type: "stroke.add", pageId: page.id, strokes: asDrafts(generateHandwriting(action.text, anchor, action.size)) }],
      speech: action.narration,
    };
  }
  if (action.type === "draw") return {
    commands: [{ type: "stroke.add", pageId: page.id, strokes: asDrafts(generateTemplate(action.template, action.anchor, action.scale, action.labels)) }],
    speech: action.narration,
  };
  if (action.type === "text") return {
    commands: [{ type: "stroke.add", pageId: page.id, strokes: asDrafts(generatePlainText(action.text, action.anchor, action.size)) }],
    speech: action.narration,
  };
  if (action.type === "arrow") return {
    commands: [{ type: "stroke.add", pageId: page.id, strokes: asDrafts(generateArrow(action.from, action.to)) }],
    speech: action.narration,
  };
  if (action.type === "feedback") {
    const targets = page.strokes.filter((stroke) => action.strokeIds.includes(stroke.id));
    const bounds = aggregateStrokeBounds(targets);
    const strokes = bounds && (action.verdict !== "uncertain" || action.confidence >= 0.6)
      ? generateFeedbackStroke(action.mark, bounds, action.color)
      : [];
    return {
      commands: strokes.length ? [{ type: "stroke.add", pageId: page.id, strokes: asDrafts(strokes) }] : [],
      speech: action.speech,
    };
  }
  if (action.type === "erase") return {
    commands: action.strokeIds.length ? [{ type: "stroke.delete", pageId: page.id, strokeIds: action.strokeIds }] : [],
    speech: action.speech,
  };
  return { commands: [], speech: action.speech };
}

function allowedStrokeIds(stateValue: unknown) {
  const state = asObject(stateValue);
  const ids = new Set<string>();
  for (const pageValue of Array.isArray(state.pages) ? state.pages : []) {
    const page = asObject(pageValue);
    for (const strokeValue of Array.isArray(page.strokes) ? page.strokes : []) {
      const stroke = asObject(strokeValue);
      if (typeof stroke.id === "string") ids.add(stroke.id);
    }
  }
  return ids;
}

export async function POST(request: Request) {
  const auth = await getMcpOAuth(request).requireBearerAuth({ requiredScopes: ["openid"] })(request);
  if (auth instanceof Response) return auth;
  const viewer = await resolveViewerForAuthSubject(auth.sub);

  let body: JsonObject;
  try {
    body = asObject(await request.json());
  } catch {
    return rpcError(null, -32700, "Invalid JSON");
  }

  const id = body?.id ?? null;
  try {
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

    const board = await readTutorBoard(viewer, undefined, true);
    if (!board) return rpcError(id, -32001, "Open Unsolvable and create a board before using its AI tools.");
    await markMcpConnected(viewer, board.boardId);

    const params = asObject(body.params);
    const name = params.name;
    const args = asObject(params.arguments);
    const state = JSON.parse(board.stateJson);

    if (name === "observe_board") {
      const summary = summarizeBoard(state);
      const unchanged = Number(args.sinceVersion) === board.eventVersion;
      const content: RpcContent[] = [
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

    const commands = directCommands(name, args);
    if (commands) {
      const writeAuth = await getMcpOAuth(request).requireBearerAuth({ requiredScopes: ["openid"] })(request);
      if (writeAuth instanceof Response) return writeAuth;
      const result = await applyTutorBoardCommands({
        viewer,
        boardId: board.boardId,
        expectedVersion: expectedVersion(args, board.eventVersion),
        commands,
        actor: { id: `agent:${viewer.appUserId}`, type: "agent", onBehalfOf: viewer.appUserId },
      });
      return rpcResult(id, {
        content: [{ type: "text", text: `Applied ${commands.length} board command(s) at event version ${result.eventVersion}.` }],
        structuredContent: { applied: true, eventVersion: result.eventVersion, board: summarizeBoard(result.document) },
      });
    }

    const action = sanitizeBoardAction(name, args, allowedStrokeIds(state)) as BoardAction;
    const writeAuth = await getMcpOAuth(request).requireBearerAuth({ requiredScopes: ["openid"] })(request);
    if (writeAuth instanceof Response) return writeAuth;
    const compiled = commandsForAction(action, state as BoardDocument);
    const updated = compiled.commands.length
      ? await applyTutorBoardCommands({
          viewer,
          boardId: board.boardId,
          expectedVersion: board.eventVersion,
          commands: compiled.commands,
          actor: { id: `agent:${viewer.appUserId}`, type: "agent", onBehalfOf: viewer.appUserId },
        })
      : null;
    const actionId = compiled.speech
      ? await enqueueTutorAction(viewer, board.boardId, { type: "say", speech: compiled.speech, tone: "calm" })
      : null;
    if (compiled.speech && !actionId) throw new Error("BOARD_ACTION_NOT_AUTHORIZED");
    return rpcResult(id, {
      content: [{
        type: "text",
        text: updated
          ? `Applied editable board changes at event version ${updated.eventVersion}${actionId ? ` and queued speech ${actionId}` : ""}.`
          : `Queued Unsolvable speech action ${actionId}.`,
      }],
      structuredContent: {
        applied: Boolean(updated),
        eventVersion: updated?.eventVersion ?? board.eventVersion,
        speechActionId: actionId,
        action,
      },
    });
  } catch (error) {
    if (error instanceof Error && error.message === "AUTH_REQUIRED") {
      return rpcError(id, -32000, "Authentication required");
    }
    return rpcError(id, -32603, error instanceof Error ? error.message : "Internal error");
  }
}
