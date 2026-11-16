import type { Page, Point, Stroke } from "@/lib/domain/board/model";
import { makeId } from "@/lib/domain/board/model";
import {
  MAX_BOARD_EMBEDDED_IMAGE_DATA_URL_LENGTH,
  MAX_PASTED_IMAGE_DATA_URL_LENGTH,
  MAX_PASTED_IMAGE_FILE_BYTES,
  MAX_PASTED_TEXT_CHARACTERS,
} from "@/lib/domain/board/limits";

const MAX_IMAGE_EDGE = 1_600;
const TEXT_FONT_SIZE = 22;
const TEXT_LINE_HEIGHT = 30;
const TEXT_FONT = `500 ${TEXT_FONT_SIZE}px ui-sans-serif, system-ui, sans-serif`;

function blobDataUrl(blob: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("The pasted image could not be read."));
    reader.readAsDataURL(blob);
  });
}

function canvasBlob(canvas: HTMLCanvasElement, quality: number) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => blob ? resolve(blob) : reject(new Error("The pasted image could not be prepared.")),
      "image/webp",
      quality,
    );
  });
}

function resizeCanvas(source: CanvasImageSource, width: number, height: number) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("The pasted image could not be prepared.");
  context.drawImage(source, 0, 0, width, height);
  return canvas;
}

async function encodeImage(source: HTMLCanvasElement) {
  let canvas = source;
  for (let resize = 0; resize < 6; resize += 1) {
    for (const quality of [0.9, 0.78, 0.64, 0.5, 0.38]) {
      const dataUrl = await blobDataUrl(await canvasBlob(canvas, quality));
      if (dataUrl.length <= MAX_PASTED_IMAGE_DATA_URL_LENGTH) {
        return { dataUrl, width: canvas.width, height: canvas.height };
      }
    }
    const scale = 0.78;
    canvas = resizeCanvas(
      canvas,
      Math.max(1, Math.round(canvas.width * scale)),
      Math.max(1, Math.round(canvas.height * scale)),
    );
  }
  throw new Error("That image cannot be compressed enough for this board.");
}

export async function prepareClipboardImage(file: File) {
  if (!file.type.startsWith("image/")) throw new Error("The clipboard item is not an image.");
  if (file.size > MAX_PASTED_IMAGE_FILE_BYTES) throw new Error("Paste an image smaller than 10 MB.");
  const bitmap = await createImageBitmap(file);
  try {
    const scale = Math.min(1, MAX_IMAGE_EDGE / Math.max(bitmap.width, bitmap.height));
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));
    return encodeImage(resizeCanvas(bitmap, width, height));
  } finally {
    bitmap.close();
  }
}

function rectanglePoints(x: number, y: number, width: number, height: number): Point[] {
  const t = Date.now();
  return [
    { x, y, pressure: 1, t },
    { x: x + width, y, pressure: 1, t },
    { x: x + width, y: y + height, pressure: 1, t },
    { x, y: y + height, pressure: 1, t },
    { x, y, pressure: 1, t },
  ];
}

export function createImageStroke(
  image: { dataUrl: string; width: number; height: number },
  center: { x: number; y: number },
  maximumSize: { width: number; height: number },
): Stroke {
  const scale = Math.min(1, maximumSize.width / image.width, maximumSize.height / image.height);
  const width = Math.max(1, image.width * scale);
  const height = Math.max(1, image.height * scale);
  const x = center.x - width / 2;
  const y = center.y - height / 2;
  return {
    id: makeId("image"),
    points: rectanglePoints(x, y, width, height),
    color: "#172036",
    width: 1,
    opacity: 1,
    kind: "image",
    author: "student",
    createdAt: Date.now(),
    semantic: "pasted-image",
    image,
  };
}

function wrapText(context: CanvasRenderingContext2D, text: string, maximumWidth: number) {
  const lines: string[] = [];
  for (const paragraph of text.split("\n")) {
    if (!paragraph) {
      lines.push("");
      continue;
    }
    let line = "";
    for (const word of paragraph.split(/\s+/)) {
      const candidate = line ? `${line} ${word}` : word;
      if (line && context.measureText(candidate).width > maximumWidth) {
        lines.push(line);
        line = word;
      } else {
        line = candidate;
      }
      while (context.measureText(line).width > maximumWidth && line.length > 1) {
        let end = line.length - 1;
        while (end > 1 && context.measureText(line.slice(0, end)).width > maximumWidth) end -= 1;
        lines.push(line.slice(0, end));
        line = line.slice(end);
      }
    }
    lines.push(line);
  }
  return lines;
}

export function createTextStroke(
  rawText: string,
  center: { x: number; y: number },
  maximumWidth: number,
  color: string,
): Stroke {
  const value = rawText.replace(/\r\n?/g, "\n").trim();
  if (!value) throw new Error("The clipboard does not contain readable text.");
  if (value.length > MAX_PASTED_TEXT_CHARACTERS) {
    throw new Error(`Paste up to ${MAX_PASTED_TEXT_CHARACTERS.toLocaleString()} characters at a time.`);
  }
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Pasted text is unavailable in this browser.");
  context.font = TEXT_FONT;
  const lines = wrapText(context, value, Math.max(160, maximumWidth));
  const width = Math.max(40, ...lines.map((line) => context.measureText(line || " ").width));
  const height = Math.max(TEXT_LINE_HEIGHT, lines.length * TEXT_LINE_HEIGHT);
  const x = center.x - width / 2;
  const y = center.y - height / 2;
  return {
    id: makeId("text"),
    points: rectanglePoints(x, y, width, height),
    color,
    width: 1,
    opacity: 1,
    kind: "text",
    author: "student",
    createdAt: Date.now(),
    semantic: "pasted-text",
    text: { value, lines, fontSize: TEXT_FONT_SIZE, lineHeight: TEXT_LINE_HEIGHT },
  };
}

export function embeddedImageDataUrlLength(pages: Page[]) {
  return pages.reduce(
    (total, page) => total + page.strokes.reduce(
      (pageTotal, stroke) => pageTotal + (stroke.kind === "image" ? stroke.image?.dataUrl.length ?? 0 : 0),
      0,
    ),
    0,
  );
}

export function ensureEmbeddedImageBudget(pages: Page[], additionalLength: number) {
  if (embeddedImageDataUrlLength(pages) + additionalLength > MAX_BOARD_EMBEDDED_IMAGE_DATA_URL_LENGTH) {
    throw new Error("This board has reached its 900 KB pasted-image limit. Remove an image before pasting another.");
  }
}
