import { copyPages, selectedStrokes } from "./operations";
import type { BoardDocument, Page, Point, Stroke } from "./model";

export type BoardActor = {
  id: string;
  type: "human" | "agent" | "system";
  onBehalfOf?: string;
};

export type StrokeDraft = Omit<Stroke, "author" | "createdAt" | "modifiedAt" | "modifiedBy"> & {
  createdAt?: number;
};

export type BoardCommand =
  | { type: "stroke.add"; pageId: string; strokes: StrokeDraft[] }
  | { type: "stroke.move"; pageId: string; strokeIds: string[]; dx: number; dy: number }
  | { type: "stroke.delete"; pageId: string; strokeIds: string[] }
  | { type: "page.create"; pageId: string; name: string; afterPageId?: string }
  | { type: "page.rename"; pageId: string; name: string }
  | { type: "page.delete"; pageId: string }
  | { type: "hint.set"; level: number };

const MAX_COORDINATE = 20_000;
const MAX_STROKES_PER_COMMAND = 120;
const MAX_POINTS_PER_STROKE = 2_500;

function finiteBounded(value: number, limit = MAX_COORDINATE) {
  return Number.isFinite(value) && Math.abs(value) <= limit;
}

function validId(value: string) {
  return typeof value === "string" && value.length > 0 && value.length <= 160;
}

function validatePoint(point: Point) {
  if (!finiteBounded(point.x) || !finiteBounded(point.y)) throw new Error("BOARD_POINT_OUT_OF_BOUNDS");
  if (!Number.isFinite(point.pressure) || point.pressure < 0 || point.pressure > 1) throw new Error("BOARD_POINT_PRESSURE_INVALID");
  if (!Number.isFinite(point.t)) throw new Error("BOARD_POINT_TIME_INVALID");
}

function validateStroke(stroke: StrokeDraft) {
  if (!validId(stroke.id)) throw new Error("BOARD_STROKE_ID_INVALID");
  if (!Array.isArray(stroke.points) || stroke.points.length < 2 || stroke.points.length > MAX_POINTS_PER_STROKE) {
    throw new Error("BOARD_STROKE_POINTS_INVALID");
  }
  stroke.points.forEach(validatePoint);
  if (!/^#[0-9a-f]{6}$/i.test(stroke.color)) throw new Error("BOARD_STROKE_COLOR_INVALID");
  if (!Number.isFinite(stroke.width) || stroke.width <= 0 || stroke.width > 80) throw new Error("BOARD_STROKE_WIDTH_INVALID");
  if (!Number.isFinite(stroke.opacity) || stroke.opacity < 0 || stroke.opacity > 1) throw new Error("BOARD_STROKE_OPACITY_INVALID");
  if (!["pen", "highlighter", "feedback"].includes(stroke.kind)) throw new Error("BOARD_STROKE_KIND_INVALID");
}

function findPage(pages: Page[], pageId: string) {
  const page = pages.find((candidate) => candidate.id === pageId);
  if (!page) throw new Error("BOARD_PAGE_NOT_FOUND");
  return page;
}

export function applyBoardCommands(document: BoardDocument, commands: BoardCommand[], actor: BoardActor): BoardDocument {
  if (!Array.isArray(commands) || commands.length === 0 || commands.length > 40) {
    throw new Error("BOARD_COMMAND_BATCH_INVALID");
  }

  let next: BoardDocument = { ...document, pages: copyPages(document.pages) };
  const now = Date.now();

  for (const command of commands) {
    if (command.type === "stroke.add") {
      if (!Array.isArray(command.strokes) || command.strokes.length === 0 || command.strokes.length > MAX_STROKES_PER_COMMAND) {
        throw new Error("BOARD_STROKE_BATCH_INVALID");
      }
      const page = findPage(next.pages, command.pageId);
      const existing = new Set(next.pages.flatMap((candidate) => candidate.strokes.map((stroke) => stroke.id)));
      for (const stroke of command.strokes) {
        validateStroke(stroke);
        if (existing.has(stroke.id)) throw new Error("BOARD_STROKE_ID_CONFLICT");
        existing.add(stroke.id);
      }
      const additions: Stroke[] = command.strokes.map((stroke) => ({
        ...stroke,
        points: stroke.points.map((point) => ({ ...point })),
        author: actor.type === "human" ? "student" : "ai",
        createdAt: stroke.createdAt ?? now,
      }));
      page.strokes.push(...additions);
      continue;
    }

    if (command.type === "stroke.move") {
      if (!finiteBounded(command.dx, 5_000) || !finiteBounded(command.dy, 5_000)) throw new Error("BOARD_MOVE_INVALID");
      const page = findPage(next.pages, command.pageId);
      const targets = new Set(selectedStrokes(page, command.strokeIds).map((stroke) => stroke.id));
      if (!targets.size) throw new Error("BOARD_STROKE_NOT_FOUND");
      page.strokes = page.strokes.map((stroke) => targets.has(stroke.id)
        ? {
            ...stroke,
            points: stroke.points.map((point) => ({ ...point, x: point.x + command.dx, y: point.y + command.dy })),
            modifiedAt: now,
            modifiedBy: actor.type === "human" ? "student" : "ai",
          }
        : stroke);
      continue;
    }

    if (command.type === "stroke.delete") {
      const page = findPage(next.pages, command.pageId);
      const targets = new Set(selectedStrokes(page, command.strokeIds).map((stroke) => stroke.id));
      if (!targets.size) throw new Error("BOARD_STROKE_NOT_FOUND");
      page.strokes = page.strokes.filter((stroke) => !targets.has(stroke.id));
      continue;
    }

    if (command.type === "page.create") {
      if (next.pages.length >= 50 || !validId(command.pageId)) throw new Error("BOARD_PAGE_LIMIT");
      if (next.pages.some((page) => page.id === command.pageId)) throw new Error("BOARD_PAGE_ID_CONFLICT");
      const page = { id: command.pageId, name: command.name.trim().slice(0, 80) || `Page ${next.pages.length + 1}`, strokes: [] };
      const after = command.afterPageId ? next.pages.findIndex((candidate) => candidate.id === command.afterPageId) : -1;
      if (after < 0) next.pages.push(page);
      else next.pages.splice(after + 1, 0, page);
      continue;
    }

    if (command.type === "page.rename") {
      const page = findPage(next.pages, command.pageId);
      const name = command.name.trim().slice(0, 80);
      if (!name) throw new Error("BOARD_PAGE_NAME_INVALID");
      page.name = name;
      continue;
    }

    if (command.type === "page.delete") {
      if (next.pages.length <= 1) throw new Error("BOARD_LAST_PAGE_DELETE_REJECTED");
      findPage(next.pages, command.pageId);
      next.pages = next.pages.filter((page) => page.id !== command.pageId);
      if (next.activePageId === command.pageId) next.activePageId = next.pages[0].id;
      continue;
    }

    if (command.type === "hint.set") {
      if (!Number.isInteger(command.level) || command.level < 0 || command.level > 5) throw new Error("BOARD_HINT_LEVEL_INVALID");
      next = { ...next, hintLevel: command.level };
      continue;
    }

    throw new Error("BOARD_COMMAND_UNKNOWN");
  }

  return next;
}
