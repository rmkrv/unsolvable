export type Point = { x: number; y: number; pressure: number; t: number };

export type Stroke = {
  id: string;
  points: Point[];
  color: string;
  width: number;
  opacity: number;
  kind: "pen" | "highlighter" | "feedback";
  author: "student" | "ai";
  createdAt: number;
  modifiedAt?: number;
  modifiedBy?: "student" | "ai";
  semantic?: string;
  groupId?: string;
};

export type Page = { id: string; name: string; strokes: Stroke[] };
export type Viewport = { x: number; y: number; zoom: number };

export function makeId(prefix = "stroke") {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function strokeBounds(stroke: Stroke) {
  if (stroke.points.length === 0) return { x: 0, y: 0, width: 0, height: 0 };
  const xs = stroke.points.map((point) => point.x);
  const ys = stroke.points.map((point) => point.y);
  const x = Math.min(...xs);
  const y = Math.min(...ys);
  return {
    x,
    y,
    width: Math.max(1, Math.max(...xs) - x),
    height: Math.max(1, Math.max(...ys) - y),
  };
}

export function distanceToStroke(x: number, y: number, stroke: Stroke) {
  let minimum = Number.POSITIVE_INFINITY;
  for (let index = 1; index < stroke.points.length; index += 1) {
    const a = stroke.points[index - 1];
    const b = stroke.points[index];
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const lengthSquared = dx * dx + dy * dy || 1;
    const progress = Math.max(0, Math.min(1, ((x - a.x) * dx + (y - a.y) * dy) / lengthSquared));
    const px = a.x + progress * dx;
    const py = a.y + progress * dy;
    minimum = Math.min(minimum, Math.hypot(x - px, y - py));
  }
  return minimum;
}

export function serializeBoard(page: Page, viewport: Viewport, hintLevel: number) {
  return {
    pageId: page.id,
    pageName: page.name,
    hintLevel,
    viewport,
    strokes: page.strokes.map((stroke) => ({
      id: stroke.id,
      author: stroke.author,
      kind: stroke.kind,
      color: stroke.color,
      bbox: strokeBounds(stroke),
      pointCount: stroke.points.length,
      modifiedBy: stroke.modifiedBy,
      semantic: stroke.semantic,
      groupId: stroke.groupId,
    })),
  };
}

