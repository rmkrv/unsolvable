import { strokeBounds, type Page, type Stroke, type Viewport } from "@/lib/domain/board/model";
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

type StaticCanvasCache = {
  buffer: HTMLCanvasElement;
  page: Page | undefined;
  width: number;
  height: number;
  cssWidth: number;
  cssHeight: number;
  ratio: number;
  viewport: Viewport;
};

const staticCanvasCaches = new WeakMap<HTMLCanvasElement, StaticCanvasCache>();

export function invalidateBoardCanvas(canvas: HTMLCanvasElement | null) {
  if (canvas) staticCanvasCaches.delete(canvas);
}

function isVisible(stroke: Stroke, viewport: Viewport, width: number, height: number) {
  const bounds = strokeBounds(stroke);
  const padding = Math.max(8, stroke.width * viewport.zoom);
  const left = bounds.x * viewport.zoom + viewport.x - padding;
  const top = bounds.y * viewport.zoom + viewport.y - padding;
  const right = (bounds.x + bounds.width) * viewport.zoom + viewport.x + padding;
  const bottom = (bounds.y + bounds.height) * viewport.zoom + viewport.y + padding;
  return right >= 0 && bottom >= 0 && left <= width && top <= height;
}

function drawGrid(context: CanvasRenderingContext2D, width: number, height: number, viewport: Viewport) {
  context.fillStyle = "#fbfaf6";
  context.fillRect(0, 0, width, height);

  const minor = 24 * viewport.zoom;
  const major = minor * 5;
  const offsetX = ((viewport.x % minor) + minor) % minor;
  const offsetY = ((viewport.y % minor) + minor) % minor;
  context.lineWidth = 1;
  for (let x = offsetX; x < width; x += minor) {
    context.strokeStyle = Math.abs(((x - viewport.x) % major + major) % major) < 1 ? "#d9d6cd" : "#ebe8df";
    context.beginPath();
    context.moveTo(x, 0);
    context.lineTo(x, height);
    context.stroke();
  }
  for (let y = offsetY; y < height; y += minor) {
    context.strokeStyle = Math.abs(((y - viewport.y) % major + major) % major) < 1 ? "#d9d6cd" : "#ebe8df";
    context.beginPath();
    context.moveTo(0, y);
    context.lineTo(width, y);
    context.stroke();
  }
}

function drawStroke(context: CanvasRenderingContext2D, stroke: Stroke, viewport: Viewport) {
  if (stroke.points.length < 2) return;
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
  let cache = staticCanvasCaches.get(canvas);
  if (!cache) {
    cache = {
      buffer: document.createElement("canvas"),
      page: undefined,
      width: 0,
      height: 0,
      cssWidth: 0,
      cssHeight: 0,
      ratio: 0,
      viewport: { x: Number.NaN, y: Number.NaN, zoom: Number.NaN },
    };
    staticCanvasCaches.set(canvas, cache);
  }

  // don't change this
  const canReuseStaticLayer = cache.page === page
    && cache.width === width
    && cache.height === height
    && cache.cssWidth === rect.width
    && cache.cssHeight === rect.height
    && cache.ratio === ratio
    && cache.viewport.zoom === viewport.zoom
    && Math.abs(cache.viewport.x - viewport.x) < rect.width
    && Math.abs(cache.viewport.y - viewport.y) < rect.height;
  const staticLayerChanged = !canReuseStaticLayer;

  if (staticLayerChanged) {
    if (cache.buffer.width !== width) cache.buffer.width = width;
    if (cache.buffer.height !== height) cache.buffer.height = height;
    const bufferContext = cache.buffer.getContext("2d");
    if (bufferContext) {
      bufferContext.setTransform(ratio, 0, 0, ratio, 0, 0);
      bufferContext.clearRect(0, 0, rect.width, rect.height);
      drawGrid(bufferContext, rect.width, rect.height, viewport);
      for (const stroke of page?.strokes ?? []) {
        if (isVisible(stroke, viewport, rect.width, rect.height)) drawStroke(bufferContext, stroke, viewport);
      }
    }
    cache.page = page;
    cache.width = width;
    cache.height = height;
    cache.cssWidth = rect.width;
    cache.cssHeight = rect.height;
    cache.ratio = ratio;
    cache.viewport = { ...viewport };
  }

  context.setTransform(1, 0, 0, 1, 0, 0);
  context.clearRect(0, 0, width, height);
  const translatedX = (viewport.x - cache.viewport.x) * ratio;
  const translatedY = (viewport.y - cache.viewport.y) * ratio;
  if (translatedX !== 0 || translatedY !== 0) {
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    drawGrid(context, rect.width, rect.height, viewport);
    context.setTransform(1, 0, 0, 1, 0, 0);
  }
  context.drawImage(cache.buffer, translatedX, translatedY);
  context.setTransform(ratio, 0, 0, ratio, 0, 0);
  for (const stroke of previewStrokes) drawStroke(context, stroke, viewport);

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
