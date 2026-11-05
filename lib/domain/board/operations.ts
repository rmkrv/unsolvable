import { strokeBounds, type Page, type Stroke } from "./model";

export function clamp(value: number, minimum: number, maximum: number) {
  return Math.max(minimum, Math.min(maximum, value));
}

export function copyPages(pages: Page[]) {
  return pages.map((page) => ({
    ...page,
    strokes: page.strokes.map((stroke) => ({
      ...stroke,
      points: stroke.points.map((point) => ({ ...point })),
    })),
  }));
}

export function selectedStrokes(page: Page | undefined, selectedIds: string[]) {
  if (!page || !selectedIds.length) return [];
  const ids = new Set(selectedIds);
  const groups = new Set(
    page.strokes.filter((stroke) => ids.has(stroke.id) && stroke.groupId).map((stroke) => stroke.groupId),
  );
  return page.strokes.filter((stroke) => ids.has(stroke.id) || Boolean(stroke.groupId && groups.has(stroke.groupId)));
}

export function strokeSelectionIds(page: Page, stroke: Stroke) {
  return stroke.groupId
    ? page.strokes.filter((candidate) => candidate.groupId === stroke.groupId).map((candidate) => candidate.id)
    : [stroke.id];
}

export function parseClipboardStrokes(raw: string) {
  try {
    const value = JSON.parse(raw) as { strokes?: Stroke[] };
    if (!Array.isArray(value.strokes)) return [];
    return value.strokes.filter((stroke) =>
      stroke
      && typeof stroke.id === "string"
      && typeof stroke.color === "string"
      && Number.isFinite(stroke.width)
      && Number.isFinite(stroke.opacity)
      && ["pen", "highlighter", "feedback"].includes(stroke.kind)
      && Array.isArray(stroke.points)
      && stroke.points.every((point) =>
        Number.isFinite(point?.x) && Number.isFinite(point?.y) && Number.isFinite(point?.pressure) && Number.isFinite(point?.t),
      ),
    );
  } catch {
    return [];
  }
}

export function aggregateStrokeBounds(strokes: Stroke[]) {
  if (!strokes.length) return null;
  const boxes = strokes.map(strokeBounds);
  const x = Math.min(...boxes.map((box) => box.x));
  const y = Math.min(...boxes.map((box) => box.y));
  const right = Math.max(...boxes.map((box) => box.x + box.width));
  const bottom = Math.max(...boxes.map((box) => box.y + box.height));
  return { x, y, width: right - x, height: bottom - y };
}
