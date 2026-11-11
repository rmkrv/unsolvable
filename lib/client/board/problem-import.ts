import type { Page } from "@/lib/domain/board/model";
import { makeId } from "@/lib/domain/board/model";
import { generatePlainText } from "@/lib/trajectory-generator";

const LINE_LENGTH = 72;
const LINES_PER_PAGE = 24;
const MAX_IMPORT_PAGES = 8;

function safeHandwritingText(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/[–—]/g, "-")
    .replace(/…/g, "...")
    .replace(/[^\x20-\x7E]/g, "?");
}

export function wrapProblemText(value: string, lineLength = LINE_LENGTH) {
  const lines: string[] = [];
  for (const paragraph of safeHandwritingText(value).split("\n")) {
    const words = paragraph.trim().split(/\s+/).filter(Boolean);
    if (!words.length) {
      if (lines.at(-1) !== "") lines.push("");
      continue;
    }
    let line = "";
    for (const word of words) {
      if (!line) {
        line = word;
        continue;
      }
      if (`${line} ${word}`.length <= lineLength) line += ` ${word}`;
      else {
        lines.push(line);
        line = word;
      }
    }
    if (line) lines.push(line);
  }
  return lines;
}

export function buildProblemPages(text: string, title: string): Page[] {
  const lines = wrapProblemText(text).slice(0, LINES_PER_PAGE * MAX_IMPORT_PAGES);
  const pageCount = Math.max(1, Math.ceil(lines.length / LINES_PER_PAGE));
  return Array.from({ length: pageCount }, (_, pageIndex) => {
    const pageLines = lines.slice(pageIndex * LINES_PER_PAGE, (pageIndex + 1) * LINES_PER_PAGE);
    const strokes = pageLines.flatMap((line, lineIndex) => {
      if (!line) return [];
      try {
        return generatePlainText(line, { x: 92, y: 84 + lineIndex * 34 }, 20).map((stroke) => ({
          ...stroke,
          color: "#172036",
          opacity: 0.92,
        }));
      } catch {
        return generatePlainText(line.replace(/[^A-Za-z0-9 .,;:!?()\[\]{}+\-=*/^_'"#$%&@]/g, "?"), { x: 92, y: 84 + lineIndex * 34 }, 20);
      }
    });
    return {
      id: makeId("page"),
      name: pageCount === 1 ? title : `${title} ${pageIndex + 1}`,
      strokes,
    };
  });
}
