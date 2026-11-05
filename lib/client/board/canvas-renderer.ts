import type { Page, Stroke, Viewport } from "@/lib/domain/board/model";
import { aggregateStrokeBounds, selectedStrokes } from "@/lib/domain/board/operations";
import { selectionBounds } from "@/lib/board-interactions.mjs";

type SelectionBox = {
  start: { x: number; y: number };
  current: { x: number; y: number };
};

export type CanvasRenderInput = {
  canvas: HTMLCanvasElement;
  stage: HTMLDivElement;
  page: Page | undefined;
  previewStrokes: Stroke[];
  selectedIds: string[];
  selectionBox: SelectionBox | null;
  viewport: Viewport;
};

export function renderBoardCanvas(input: CanvasRenderInput) {
  const { canvas, stage, page, previewStrokes, selectedIds, selectionBox, viewport } = input;
  const rect = stage.getBoundingClientRect();
  const ratio = Math.max(1, window.devicePixelRatio || 1);
  const width = Math.max(1, Math.round(rect.width * ratio));
  const height = Math.max(1, Math.round(rect.height * ratio));
  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
    canvas.style.width = `${rect.width}px`;
    canvas.style.height = `${rect.height}px`;
  }

  const context = canvas.getContext("2d");
  if (!context) return;
  context.setTransform(ratio, 0, 0, ratio, 0, 0);
  context.clearRect(0, 0, rect.width, rect.height);
  context.fillStyle = "#fbfaf6";
  context.fillRect(0, 0, rect.width, rect.height);

  const minor = 24 * viewport.zoom;
  const major = minor * 5;
  const offsetX = ((viewport.x % minor) + minor) % minor;
  const offsetY = ((viewport.y % minor) + minor) % minor;
  context.lineWidth = 1;
  for (let x = offsetX; x < rect.width; x += minor) {
    context.strokeStyle = Math.abs(((x - viewport.x) % major + major) % major) < 1 ? "#d9d6cd" : "#ebe8df";
    context.beginPath();
    context.moveTo(x, 0);
    context.lineTo(x, rect.height);
    context.stroke();
  }
  for (let y = offsetY; y < rect.height; y += minor) {
    context.strokeStyle = Math.abs(((y - viewport.y) % major + major) % major) < 1 ? "#d9d6cd" : "#ebe8df";
    context.beginPath();
    context.moveTo(0, y);
    context.lineTo(rect.width, y);
    context.stroke();
  }

  for (const stroke of [...(page?.strokes ?? []), ...previewStrokes]) {
    if (stroke.points.length < 2) continue;
    context.save();
    context.globalAlpha = stroke.opacity;
    context.strokeStyle = stroke.color;
    context.lineCap = "round";
    context.lineJoin = "round";
    for (let index = 1; index < stroke.points.length; index += 1) {
      const a = stroke.points[index - 1];
      const b = stroke.points[index];
      context.lineWidth = Math.max(1, stroke.width * ((a.pressure + b.pressure) / 2) * viewport.zoom);
      context.beginPath();
      context.moveTo(a.x * viewport.zoom + viewport.x, a.y * viewport.zoom + viewport.y);
      context.quadraticCurveTo(
        a.x * viewport.zoom + viewport.x,
        a.y * viewport.zoom + viewport.y,
        b.x * viewport.zoom + viewport.x,
        b.y * viewport.zoom + viewport.y,
      );
      context.stroke();
    }
    context.restore();
  }

  const selected = selectedStrokes(page, selectedIds);
  const selectedBounds = aggregateStrokeBounds(selected);
  if (selectedBounds) {
    context.save();
    context.strokeStyle = "#3558d4";
    context.lineWidth = 1.25;
    context.setLineDash([5, 4]);
    context.strokeRect(
      selectedBounds.x * viewport.zoom + viewport.x - 7,
      selectedBounds.y * viewport.zoom + viewport.y - 7,
      selectedBounds.width * viewport.zoom + 14,
      selectedBounds.height * viewport.zoom + 14,
    );
    context.restore();
  }

  if (selectionBox) {
    const box = selectionBounds(selectionBox.start, selectionBox.current);
    context.save();
    context.fillStyle = "rgba(53, 88, 212, 0.08)";
    context.strokeStyle = "#3558d4";
    context.lineWidth = 1;
    context.setLineDash([5, 4]);
    context.fillRect(box.x * viewport.zoom + viewport.x, box.y * viewport.zoom + viewport.y, box.width * viewport.zoom, box.height * viewport.zoom);
    context.strokeRect(box.x * viewport.zoom + viewport.x, box.y * viewport.zoom + viewport.y, box.width * viewport.zoom, box.height * viewport.zoom);
    context.restore();
  }
}
