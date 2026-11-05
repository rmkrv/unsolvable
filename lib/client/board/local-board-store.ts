import { clamp } from "@/lib/domain/board/operations";
import type { Page } from "@/lib/domain/board/model";

const STORAGE_KEY = "vector-tutor-board-v1";
const BOARD_ID_KEY = "vector-tutor-board-id-v1";
const ACTION_CURSOR_KEY = "vector-tutor-action-cursor-v1";
const COLOR_KEY = "vector-tutor-color-v1";

export type LocalBoardState = {
  pages: Page[];
  activePageId: string;
  hintLevel: number;
};

export function readLocalBoard(storage: Storage): LocalBoardState | null {
  const raw = storage.getItem(STORAGE_KEY);
  if (!raw) return null;
  const parsed = JSON.parse(raw) as Partial<LocalBoardState>;
  if (!Array.isArray(parsed.pages) || !parsed.pages.length) return null;
  return {
    pages: parsed.pages,
    activePageId: parsed.activePageId || parsed.pages[0].id,
    hintLevel: clamp(Number(parsed.hintLevel) || 2, 0, 5),
  };
}

export function writeLocalBoard(storage: Storage, state: LocalBoardState) {
  storage.setItem(STORAGE_KEY, JSON.stringify(state));
}

export function readBoardColor(storage: Storage) {
  const value = storage.getItem(COLOR_KEY);
  return value && /^#[0-9a-f]{6}$/i.test(value) ? value : null;
}

export function writeBoardColor(storage: Storage, color: string) {
  storage.setItem(COLOR_KEY, color);
}

export function getOrCreateBoardId(storage: Storage, createId: () => string) {
  const existing = storage.getItem(BOARD_ID_KEY);
  if (existing) return existing;
  const boardId = createId();
  storage.setItem(BOARD_ID_KEY, boardId);
  return boardId;
}

function actionCursorKey(boardId: string) {
  return `${ACTION_CURSOR_KEY}:${boardId}`;
}

export function readActionCursor(storage: Storage, boardId: string) {
  const raw = storage.getItem(actionCursorKey(boardId));
  if (raw === null) return null;
  const value = Number(raw);
  return Number.isSafeInteger(value) && value >= 0 ? value : null;
}

export function writeActionCursor(storage: Storage, boardId: string, cursor: number) {
  storage.setItem(actionCursorKey(boardId), String(cursor));
}
