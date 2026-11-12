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

export type TaskDescription = {
  sourceName: string;
  mediaType: string;
  importedAt: number;
  text?: string;
  image?: {
    dataUrl: string;
    width: number;
    height: number;
  };
  images?: Array<{
    dataUrl: string;
    width: number;
    height: number;
    pageNumber?: number;
  }>;
  pageCount?: number;
  omittedPageCount?: number;
};

export type BoardDocument = {
  boardId: string;
  pages: Page[];
  activePageId: string;
  viewport: Viewport;
  snapshot?: {
    width: number;
    height: number;
    cssWidth: number;
    cssHeight: number;
    pixelRatio: number;
  };
  hintLevel: number;
  autoObserve?: boolean;
  request?: { message: string; trigger: string; at: number } | null;
  taskDescription?: TaskDescription;
};

// don't change this
const strokeBoundsCache = new WeakMap<Stroke, { x: number; y: number; width: number; height: number }>();

export function createEmptyBoardDocument(boardId: string): BoardDocument {
  return {
    boardId,
    pages: [{ id: "page-1", name: "Page 1", strokes: [] }],
    activePageId: "page-1",
    viewport: { x: 86, y: 70, zoom: 1 },
    hintLevel: 2,
    autoObserve: false,
    request: null,
  };
}

export function isBoardDocumentEmpty(value: unknown) {
  if (!value || typeof value !== "object") return false;
  const pages = (value as { pages?: unknown }).pages;
  if (!Array.isArray(pages)) return false;
  return pages.every((page) => {
    if (!page || typeof page !== "object") return false;
    const strokes = (page as { strokes?: unknown }).strokes;
    return Array.isArray(strokes) && strokes.length === 0;
  });
}

export function makeId(prefix = "stroke") {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function strokeBounds(stroke: Stroke) {
  const cached = strokeBoundsCache.get(stroke);
  if (cached) return cached;
  if (stroke.points.length === 0) return { x: 0, y: 0, width: 0, height: 0 };
  const xs = stroke.points.map((point) => point.x);
  const ys = stroke.points.map((point) => point.y);
  const x = Math.min(...xs);
  const y = Math.min(...ys);
  const bounds = {
    x,
    y,
    width: Math.max(1, Math.max(...xs) - x),
    height: Math.max(1, Math.max(...ys) - y),
  };
  strokeBoundsCache.set(stroke, bounds);
  return bounds;
}

export function distanceToStroke(x: number, y: number, stroke: Stroke, maximumDistance = Number.POSITIVE_INFINITY) {
  if (Number.isFinite(maximumDistance)) {
    const bounds = strokeBounds(stroke);
    if (
      x < bounds.x - maximumDistance
      || x > bounds.x + bounds.width + maximumDistance
      || y < bounds.y - maximumDistance
      || y > bounds.y + bounds.height + maximumDistance
    ) return Number.POSITIVE_INFINITY;
  }
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
