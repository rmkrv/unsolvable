"use client";

import Link from "next/link";
import { createTutorTransport } from "@/lib/client/tutor/tutor-transport";
import {
  ArrowUpRight,
  Cable,
  Check,
  ChevronDown,
  Circle,
  CircleStop,
  Eraser,
  Hand,
  Highlighter,
  Layers2,
  Mic,
  MousePointer2,
  PenLine,
  Plus,
  Square,
  Minus,
  Redo2,
  Sparkles,
  Undo2,
  Wifi,
  WifiOff,
  X,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  distanceToStroke,
  makeId,
  strokeBounds,
  type Page,
  type Point,
  type Stroke,
  type Viewport,
} from "@/lib/domain/board/model";
import {
  aggregateStrokeBounds,
  clamp,
  copyPages,
  parseClipboardStrokes,
  selectedStrokes,
  strokeSelectionIds,
} from "@/lib/domain/board/operations";
import type { BoardAction } from "@/lib/domain/tutor/board-action";
import { createHttpBoardGateway } from "@/lib/client/board/board-gateway";
import { BoardSaveCoordinator, type BoardSaveKind } from "@/lib/client/board/board-save-coordinator";
import { invalidateBoardCanvas, renderBoardCanvas } from "@/lib/client/board/canvas-renderer";
import { MAX_BOARD_SNAPSHOT_DATA_URL_LENGTH } from "@/lib/domain/board/limits";
import {
  readActionCursor,
  readBoardColor,
  readLocalBoard,
  writeActionCursor,
  writeBoardColor,
  writeLocalBoard,
} from "@/lib/client/board/local-board-store";
import { generateArrow, generateFeedbackStroke, generateHandwriting, generatePlainText, generateTemplate, measureHandwriting } from "@/lib/trajectory-generator";
import { findFreeHandwritingAnchor } from "@/lib/handwriting-placement.mjs";
import { createEnglishSpeechController } from "@/lib/english-speech.mjs";
import { boundsIntersect, buildShapePaths, isEditableTarget, selectionBounds, type ShapeTool } from "@/lib/board-interactions.mjs";

type Tool = "select" | "pen" | "highlighter" | "eraser" | "hand" | ShapeTool;
type DrawingTool = "pen" | "highlighter" | ShapeTool;
type BridgeState = "connecting" | "authorized" | "offline" | "thinking" | "drawing";
type ConnectionTarget = "codex" | "claude" | "other";
type DrawingGesture = {
  tool: DrawingTool;
  color: string;
  pageId: string;
  start: { x: number; y: number; pressure: number; t: number };
  current: { x: number; y: number; pressure: number; t: number };
  rawPoints: Array<{ x: number; y: number; pressure: number; t: number }>;
  groupId: string;
  createdAt: number;
};
type SpeechRecognitionResultLike = {
  readonly isFinal: boolean;
  readonly 0: { readonly transcript: string };
};
type SpeechRecognitionEventLike = { readonly results: ArrayLike<SpeechRecognitionResultLike> };
type SpeechRecognitionLike = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onstart: (() => void) | null;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
};
type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;
type SpeechRecognitionWindow = Window & {
  SpeechRecognition?: SpeechRecognitionConstructor;
  webkitSpeechRecognition?: SpeechRecognitionConstructor;
};
const STROKE_CLIPBOARD_TYPE = "application/x-unsolvable-strokes+json";
const INITIAL_PAGE: Page = { id: "page-1", name: "Page 1", strokes: [] };
const boardGateway = createHttpBoardGateway();

const tutorBridgeUrl = import.meta.env.VITE_TUTOR_BRIDGE_URL;
const tutorTransport = createTutorTransport(tutorBridgeUrl);
const localTutor = tutorTransport.mode === "local";

function agentAvailable(state: BridgeState) {
  return state === "authorized";
}

const TOOL_ITEMS: { id: Tool; label: string; icon: typeof PenLine; shortcut?: string; ariaShortcut?: string }[] = [
  { id: "select", label: "Select", icon: MousePointer2, shortcut: "Ctrl/⌘ V", ariaShortcut: "Control+V Meta+V" },
  { id: "pen", label: "Pen", icon: PenLine, shortcut: "Ctrl/⌘ P", ariaShortcut: "Control+P Meta+P" },
  { id: "highlighter", label: "Highlight", icon: Highlighter, shortcut: "Ctrl/⌘ H", ariaShortcut: "Control+H Meta+H" },
  { id: "eraser", label: "Eraser", icon: Eraser, shortcut: "Ctrl/⌘ E", ariaShortcut: "Control+E Meta+E" },
  { id: "line", label: "Line", icon: Minus, shortcut: "Hold Shift", ariaShortcut: "Shift" },
  { id: "rectangle", label: "Rectangle", icon: Square, shortcut: "Hold Ctrl", ariaShortcut: "Control" },
  { id: "ellipse", label: "Ellipse", icon: Circle, shortcut: "Hold E", ariaShortcut: "E" },
  { id: "arrow", label: "Arrow", icon: ArrowUpRight, shortcut: "Hold A", ariaShortcut: "A" },
  { id: "hand", label: "Pan", icon: Hand, shortcut: "Space", ariaShortcut: "Space" },
];


function ToolButton({
  active,
  label,
  shortcut,
  ariaShortcut,
  onClick,
  children,
}: {
  active?: boolean;
  label: string;
  shortcut?: string;
  ariaShortcut?: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      className={`tool-button ${active ? "is-active" : ""}`}
      onClick={onClick}
      title={`${label}${shortcut ? ` (${shortcut})` : ""}`}
      aria-label={label}
      aria-keyshortcuts={ariaShortcut ?? shortcut}
      type="button"
    >
      {children}
    </button>
  );
}

function worldPoint(event: React.PointerEvent<HTMLCanvasElement>, canvas: HTMLCanvasElement, view: Viewport) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: (event.clientX - rect.left - view.x) / view.zoom,
    y: (event.clientY - rect.top - view.y) / view.zoom,
  };
}

export default function TutorBoard({
  displayName,
  boardId,
  initialTitle,
}: {
  displayName: string;
  boardId: string;
  initialTitle: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const titleInputRef = useRef<HTMLInputElement>(null);
  const [pages, setPages] = useState<Page[]>([INITIAL_PAGE]);
  const [activePageId, setActivePageId] = useState("page-1");
  const [view, setView] = useState<Viewport>({ x: 86, y: 70, zoom: 1 });
  const [tool, setTool] = useState<Tool>("pen");
  const [color, setColor] = useState("#172036");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bridgeState, setBridgeState] = useState<BridgeState>("connecting");
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [connectionOpen, setConnectionOpen] = useState(false);
  const [connectionTarget, setConnectionTarget] = useState<ConnectionTarget>("codex");
  const [hintLevel, setHintLevel] = useState(2);
  const [autoObserve, setAutoObserve] = useState(false);
  const [prompt, setPrompt] = useState("");
  const [isListening, setIsListening] = useState(false);
  const [toast, setToast] = useState("Draw naturally — Unsolvable will wait for a complete thought.");
  const [pagesOpen, setPagesOpen] = useState(false);
  const [boardTitle, setBoardTitle] = useState(initialTitle);
  const [titleDraft, setTitleDraft] = useState(initialTitle);
  const [isRenamingTitle, setIsRenamingTitle] = useState(false);
  const [isSavingTitle, setIsSavingTitle] = useState(false);
  const undoRef = useRef<Page[][]>([]);
  const redoRef = useRef<Page[][]>([]);
  const pagesRef = useRef(pages);
  const viewRef = useRef(view);
  const toolRef = useRef<Tool>(tool);
  const activePageIdRef = useRef(activePageId);
  const currentStrokesRef = useRef<Stroke[]>([]);
  const drawingGestureRef = useRef<DrawingGesture | null>(null);
  const pointerModeRef = useRef<"draw" | "pan" | "move" | "erase" | "marquee" | null>(null);
  const selectionBoxRef = useRef<{ start: { x: number; y: number }; current: { x: number; y: number } } | null>(null);
  const pointerStartRef = useRef({ x: 0, y: 0, screenX: 0, screenY: 0 });
  const viewStartRef = useRef(view);
  const gestureSnapshotRef = useRef<Page[] | null>(null);
  const renderFrameRef = useRef<number | null>(null);
  const pointerMutationFrameRef = useRef<number | null>(null);
  const pendingPointerMutationRef = useRef<(() => void) | null>(null);
  const animationRef = useRef<AbortController | null>(null);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const speechRef = useRef<ReturnType<typeof createEnglishSpeechController> | null>(null);
  const observationTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const interactionCountRef = useRef(0);
  const lastActionIdRef = useRef(0);
  const hasActionCursorRef = useRef(false);
  const serverVersionRef = useRef(0);
  const hintLevelRef = useRef(hintLevel);
  const autoObserveRef = useRef(autoObserve);
  const hydrationCompleteRef = useRef(false);
  const saveCoordinatorRef = useRef<BoardSaveCoordinator | null>(null);
  const applyingRemoteStateRef = useRef(false);
  const requestRef = useRef<{ message: string; trigger: string; at: number } | null>(null);
  const previousToolRef = useRef<Tool | null>(null);
  const temporaryShapeToolRef = useRef<{ key: string; tool: ShapeTool; previousTool: Tool } | null>(null);
  const shiftPressedRef = useRef(false);
  const altPressedRef = useRef(false);
  const clipboardRef = useRef<Stroke[]>([]);
  const pasteCountRef = useRef(0);

  const activePage = useMemo(
    () => pages.find((page) => page.id === activePageId) ?? pages[0],
    [activePageId, pages],
  );

  useEffect(() => {
    pagesRef.current = pages;
  }, [pages]);
  useEffect(() => {
    viewRef.current = view;
  }, [view]);
  useEffect(() => {
    toolRef.current = tool;
  }, [tool]);
  useEffect(() => {
    activePageIdRef.current = activePageId;
  }, [activePageId]);
  useEffect(() => {
    hintLevelRef.current = hintLevel;
  }, [hintLevel]);
  useEffect(() => {
    autoObserveRef.current = autoObserve;
    if (autoObserve) return;
    interactionCountRef.current = 0;
    if (observationTimerRef.current) clearTimeout(observationTimerRef.current);
    observationTimerRef.current = null;
  }, [autoObserve]);

  if (saveCoordinatorRef.current == null) {
    saveCoordinatorRef.current = new BoardSaveCoordinator(boardGateway);
  }

  useEffect(() => {
    if (!isRenamingTitle) return;
    titleInputRef.current?.focus();
    titleInputRef.current?.select();
  }, [isRenamingTitle]);

  useEffect(() => {
    const saved = readBoardColor(localStorage);
    if (!saved) return;
    const frame = requestAnimationFrame(() => setColor(saved));
    return () => cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    writeBoardColor(localStorage, color);
  }, [color]);

  useEffect(() => {
    try {
      const saved = readLocalBoard(localStorage, boardId);
      if (!saved) return;
      const frame = requestAnimationFrame(() => {
        setPages(saved.pages);
        setActivePageId(saved.activePageId);
        setHintLevel(saved.hintLevel);
        setAutoObserve(saved.autoObserve);
      });
      return () => cancelAnimationFrame(frame);
    } catch {
      const frame = requestAnimationFrame(() => {
        setToast("The saved board could not be restored; a fresh board is open.");
      });
      return () => cancelAnimationFrame(frame);
    }
  }, [boardId]);

  useEffect(() => {
    let idleId: number | null = null;
    const timer = setTimeout(() => {
      const persist = () => {
        idleId = null;
        writeLocalBoard(localStorage, { pages, activePageId, hintLevel, autoObserve }, boardId);
      };
      if ("requestIdleCallback" in window) {
        idleId = window.requestIdleCallback(persist, { timeout: 1_500 });
      } else {
        persist();
      }
    }, 750);
    return () => {
      clearTimeout(timer);
      if (idleId !== null && "cancelIdleCallback" in window) window.cancelIdleCallback(idleId);
    };
  }, [activePageId, autoObserve, boardId, hintLevel, pages]);

  const drawCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    const stage = stageRef.current;
    if (!canvas || !stage) return;
    const page = pagesRef.current.find((candidate) => candidate.id === activePageIdRef.current) ?? pagesRef.current[0];
    renderBoardCanvas({
      canvas,
      stage,
      page,
      previewStrokes: currentStrokesRef.current,
      selectedIds,
      selectionBox: selectionBoxRef.current,
      viewport: viewRef.current,
    });
  }, [selectedIds]);

  const requestRender = useCallback(() => {
    if (renderFrameRef.current !== null) return;
    renderFrameRef.current = requestAnimationFrame(() => {
      renderFrameRef.current = null;
      drawCanvas();
    });
  }, [drawCanvas]);

  // don't change this
  const schedulePointerMutation = useCallback((mutation: () => void) => {
    pendingPointerMutationRef.current = mutation;
    if (pointerMutationFrameRef.current !== null) return;
    pointerMutationFrameRef.current = requestAnimationFrame(() => {
      pointerMutationFrameRef.current = null;
      const pending = pendingPointerMutationRef.current;
      pendingPointerMutationRef.current = null;
      pending?.();
    });
  }, []);

  const flushPointerMutation = useCallback(() => {
    if (pointerMutationFrameRef.current !== null) cancelAnimationFrame(pointerMutationFrameRef.current);
    pointerMutationFrameRef.current = null;
    const pending = pendingPointerMutationRef.current;
    pendingPointerMutationRef.current = null;
    pending?.();
  }, []);

  useEffect(() => () => {
    if (pointerMutationFrameRef.current !== null) cancelAnimationFrame(pointerMutationFrameRef.current);
  }, []);

  const rebuildDrawingPreview = useCallback(() => {
    const gesture = drawingGestureRef.current;
    if (!gesture) return;
    const isInk = gesture.tool === "pen" || gesture.tool === "highlighter";
    const paths = isInk
      ? [shiftPressedRef.current ? [gesture.start, gesture.current] : gesture.rawPoints]
      : buildShapePaths(gesture.tool as ShapeTool, gesture.start, gesture.current, {
          constrain: shiftPressedRef.current,
          fromCenter: altPressedRef.current,
        });
    const highlighter = gesture.tool === "highlighter";
    currentStrokesRef.current = paths.map((path, pathIndex) => ({
      id: pathIndex === 0 ? gesture.groupId : `${gesture.groupId}-${pathIndex}`,
      points: path.map((point, pointIndex) => ({
        ...point,
        pressure: typeof (point as Partial<Point>).pressure === "number" ? (point as Point).pressure : 0.62,
        t: typeof (point as Partial<Point>).t === "number" ? (point as Point).t : gesture.createdAt + pointIndex,
      })),
      color: gesture.color,
      width: highlighter ? 18 : 4.2,
      opacity: highlighter ? 0.28 : 1,
      kind: highlighter ? "highlighter" : "pen",
      author: "student",
      createdAt: gesture.createdAt,
      semantic: isInk ? undefined : `shape:${gesture.tool}`,
      groupId: paths.length > 1 ? gesture.groupId : undefined,
    }));
    requestRender();
  }, [requestRender]);

  useEffect(() => {
    requestRender();
  }, [pages, requestRender, selectedIds, view]);

  useEffect(() => {
    const observer = new ResizeObserver(requestRender);
    if (stageRef.current) observer.observe(stageRef.current);
    return () => observer.disconnect();
  }, [requestRender]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      if (event.ctrlKey || Math.abs(event.deltaY) > Math.abs(event.deltaX)) {
        const rect = canvas.getBoundingClientRect();
        const screenX = event.clientX - rect.left;
        const screenY = event.clientY - rect.top;
        const old = viewRef.current;
        const nextZoom = clamp(old.zoom * Math.exp(-event.deltaY * 0.0012), 0.2, 4);
        const worldX = (screenX - old.x) / old.zoom;
        const worldY = (screenY - old.y) / old.zoom;
        setView({ x: screenX - worldX * nextZoom, y: screenY - worldY * nextZoom, zoom: nextZoom });
      } else {
        setView((previous) => ({ ...previous, x: previous.x - event.deltaX, y: previous.y - event.deltaY }));
      }
    };
    canvas.addEventListener("wheel", onWheel, { passive: false });
    return () => canvas.removeEventListener("wheel", onWheel);
  }, []);

  const commitPages = useCallback((updater: (previous: Page[]) => Page[]) => {
    setPages((previous) => {
      const next = updater(previous);
      if (next === previous) return previous;
      // don't change this
      undoRef.current.push(previous);
      if (undoRef.current.length > 80) undoRef.current.shift();
      redoRef.current = [];
      return next;
    });
  }, []);

  const undo = useCallback(() => {
    const snapshot = undoRef.current.pop();
    if (!snapshot) return;
    redoRef.current.push(pagesRef.current);
    setPages(snapshot);
    setSelectedIds([]);
  }, []);

  const redo = useCallback(() => {
    const snapshot = redoRef.current.pop();
    if (!snapshot) return;
    undoRef.current.push(pagesRef.current);
    setPages(snapshot);
    setSelectedIds([]);
  }, []);

  const copySelection = useCallback(() => {
    const page = pagesRef.current.find((candidate) => candidate.id === activePageIdRef.current);
    const strokes = selectedStrokes(page, selectedIds);
    if (!strokes.length) return [];
    clipboardRef.current = copyPages([{ id: "clipboard", name: "Clipboard", strokes }])[0].strokes;
    pasteCountRef.current = 0;
    return clipboardRef.current;
  }, [selectedIds]);

  const deleteSelection = useCallback(() => {
    const page = pagesRef.current.find((candidate) => candidate.id === activePageIdRef.current);
    const ids = new Set(selectedStrokes(page, selectedIds).map((stroke) => stroke.id));
    if (!ids.size) return;
    commitPages((previous) => previous.map((candidate) =>
      candidate.id === activePageIdRef.current
        ? { ...candidate, strokes: candidate.strokes.filter((stroke) => !ids.has(stroke.id)) }
        : candidate,
    ));
    setSelectedIds([]);
  }, [commitPages, selectedIds]);

  const pasteStrokes = useCallback((source = clipboardRef.current) => {
    if (!source.length) return;
    pasteCountRef.current += 1;
    const offset = (18 * pasteCountRef.current) / viewRef.current.zoom;
    const groupIds = new Map<string, string>();
    const pasted = source.map((stroke) => {
      const groupId = stroke.groupId
        ? (groupIds.get(stroke.groupId) ?? (() => {
            const id = makeId("group");
            groupIds.set(stroke.groupId!, id);
            return id;
          })())
        : undefined;
      return {
        ...stroke,
        id: makeId("student"),
        groupId,
        author: "student" as const,
        createdAt: Date.now(),
        modifiedAt: Date.now(),
        modifiedBy: "student" as const,
        points: stroke.points.map((point) => ({ ...point, x: point.x + offset, y: point.y + offset })),
      };
    });
    commitPages((previous) => previous.map((page) =>
      page.id === activePageIdRef.current ? { ...page, strokes: [...page.strokes, ...pasted] } : page,
    ));
    setSelectedIds(pasted.map((stroke) => stroke.id));
    setTool("select");
  }, [commitPages]);

  const duplicateSelection = useCallback(() => {
    const copied = copySelection();
    if (copied.length) pasteStrokes(copied);
  }, [copySelection, pasteStrokes]);

  const zoomAtCenter = useCallback((factor: number) => {
    const rect = stageRef.current?.getBoundingClientRect();
    if (!rect) return;
    const screenX = rect.width / 2;
    const screenY = rect.height / 2;
    setView((old) => {
      const nextZoom = clamp(old.zoom * factor, 0.2, 4);
      const worldX = (screenX - old.x) / old.zoom;
      const worldY = (screenY - old.y) / old.zoom;
      return { x: screenX - worldX * nextZoom, y: screenY - worldY * nextZoom, zoom: nextZoom };
    });
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Shift") {
        shiftPressedRef.current = true;
        rebuildDrawingPreview();
      }
      if (event.key === "Alt") {
        altPressedRef.current = true;
        rebuildDrawingPreview();
        if (drawingGestureRef.current) event.preventDefault();
      }
      if (isEditableTarget(event.target)) return;
      if (connectionOpen && event.key !== "Escape") return;
      const modifier = event.ctrlKey || event.metaKey;
      const key = event.key.toLowerCase();
      const permanentTools: Partial<Record<string, Tool>> = { p: "pen", h: "highlighter", e: "eraser" };
      const temporaryShapeTools: Partial<Record<string, ShapeTool>> = { e: "ellipse", a: "arrow" };
      if (modifier && key === "v") {
        setTool("select");
        return;
      }
      if (modifier && !event.altKey && permanentTools[key]) {
        event.preventDefault();
        setTool(permanentTools[key]!);
        return;
      }
      if (!modifier && !event.altKey && temporaryShapeTools[key]) {
        event.preventDefault();
        if (!event.repeat && !temporaryShapeToolRef.current) {
          const temporaryTool = temporaryShapeTools[key]!;
          temporaryShapeToolRef.current = { key, tool: temporaryTool, previousTool: toolRef.current };
          setTool(temporaryTool);
        }
        return;
      }
      if (modifier && key === "z") {
        event.preventDefault();
        if (event.shiftKey) redo();
        else undo();
        return;
      }
      if (modifier && key === "y") {
        event.preventDefault();
        redo();
        return;
      }
      if (modifier && key === "d") {
        event.preventDefault();
        duplicateSelection();
        return;
      }
      if (modifier && (key === "+" || key === "=")) {
        event.preventDefault();
        zoomAtCenter(1.18);
        return;
      }
      if (modifier && key === "-") {
        event.preventDefault();
        zoomAtCenter(1 / 1.18);
        return;
      }
      if (modifier && key === "0") {
        event.preventDefault();
        setView({ x: 86, y: 70, zoom: 1 });
        return;
      }
      if ((event.key === "Delete" || event.key === "Backspace") && selectedIds.length) {
        event.preventDefault();
        deleteSelection();
        return;
      }
      if (event.key === "Escape") {
        event.preventDefault();
        setConnectionOpen(false);
        setPagesOpen(false);
        setSelectedIds([]);
        selectionBoxRef.current = null;
        if (gestureSnapshotRef.current && (pointerModeRef.current === "move" || pointerModeRef.current === "erase")) {
          setPages(gestureSnapshotRef.current);
        }
        gestureSnapshotRef.current = null;
        drawingGestureRef.current = null;
        currentStrokesRef.current = [];
        pointerModeRef.current = null;
        requestRender();
        return;
      }
      if (event.code === "Space" && !modifier && !event.altKey && !event.repeat && !pointerModeRef.current) {
        event.preventDefault();
        previousToolRef.current = toolRef.current;
        setTool("hand");
        return;
      }
      if (modifier || event.altKey) return;
    };
    const onKeyUp = (event: KeyboardEvent) => {
      if (event.key === "Shift") {
        shiftPressedRef.current = false;
        rebuildDrawingPreview();
      }
      if (event.key === "Alt") {
        altPressedRef.current = false;
        rebuildDrawingPreview();
      }
      if (event.code === "Space" && previousToolRef.current) {
        setTool(previousToolRef.current);
        previousToolRef.current = null;
      }
      const temporaryTool = temporaryShapeToolRef.current;
      if (temporaryTool && (event.key.toLowerCase() === temporaryTool.key || event.key === "Control" || event.key === "Meta")) {
        setTool(temporaryTool.previousTool);
        temporaryShapeToolRef.current = null;
      }
    };
    const onCopy = (event: ClipboardEvent) => {
      if (isEditableTarget(event.target)) return;
      const strokes = copySelection();
      if (!strokes.length) return;
      event.preventDefault();
      event.clipboardData?.setData(STROKE_CLIPBOARD_TYPE, JSON.stringify({ version: 1, strokes }));
    };
    const onCut = (event: ClipboardEvent) => {
      if (isEditableTarget(event.target)) return;
      const strokes = copySelection();
      if (!strokes.length) return;
      event.preventDefault();
      event.clipboardData?.setData(STROKE_CLIPBOARD_TYPE, JSON.stringify({ version: 1, strokes }));
      deleteSelection();
    };
    const onPaste = (event: ClipboardEvent) => {
      if (isEditableTarget(event.target)) return;
      const raw = event.clipboardData?.getData(STROKE_CLIPBOARD_TYPE) ?? "";
      const hasExternalPayload = Boolean(event.clipboardData?.types.length);
      const strokes = raw ? parseClipboardStrokes(raw) : hasExternalPayload ? [] : clipboardRef.current;
      if (!strokes.length) return;
      event.preventDefault();
      if (raw) {
        clipboardRef.current = strokes;
        pasteCountRef.current = 0;
      }
      pasteStrokes(strokes);
    };
    const onBlur = () => {
      shiftPressedRef.current = false;
      altPressedRef.current = false;
      if (previousToolRef.current) {
        setTool(previousToolRef.current);
        previousToolRef.current = null;
      }
      if (temporaryShapeToolRef.current) {
        setTool(temporaryShapeToolRef.current.previousTool);
        temporaryShapeToolRef.current = null;
      }
      rebuildDrawingPreview();
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("copy", onCopy);
    window.addEventListener("cut", onCut);
    window.addEventListener("paste", onPaste);
    window.addEventListener("blur", onBlur);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("copy", onCopy);
      window.removeEventListener("cut", onCut);
      window.removeEventListener("paste", onPaste);
      window.removeEventListener("blur", onBlur);
    };
  }, [connectionOpen, copySelection, deleteSelection, duplicateSelection, pasteStrokes, rebuildDrawingPreview, redo, requestRender, selectedIds, undo, zoomAtCenter]);

  useEffect(() => {
    if (!("speechSynthesis" in window)) return;
    const controller = createEnglishSpeechController(
      window.speechSynthesis,
      SpeechSynthesisUtterance,
      () => setToast("No English voice is available in this browser. Add an English voice in Windows or Chrome to hear Unsolvable."),
    );
    speechRef.current = controller;
    return () => {
      controller.dispose();
      if (speechRef.current === controller) speechRef.current = null;
    };
  }, []);

  const speak = useCallback((text: string) => { speechRef.current?.speak(text); }, []);

  const animateStrokes = useCallback(
    async (incoming: Stroke[], narration = "") => {
      if (!incoming.length) {
        speak(narration);
        return;
      }
      animationRef.current?.abort();
      const controller = new AbortController();
      animationRef.current = controller;
      setBridgeState("drawing");
      undoRef.current.push(pagesRef.current);
      redoRef.current = [];
      if (narration) speak(narration);

      const pageId = activePageIdRef.current;
      for (const source of incoming) {
        if (controller.signal.aborted) break;
        const partial = { ...source, points: source.points.slice(0, 1) };
        setPages((previous) =>
          previous.map((page) =>
            page.id === pageId ? { ...page, strokes: [...page.strokes, partial] } : page,
          ),
        );
        for (let index = 2; index <= source.points.length; index += 2) {
          if (controller.signal.aborted) break;
          const points = source.points.slice(0, index);
          setPages((previous) =>
            previous.map((page) =>
              page.id === pageId
                ? {
                    ...page,
                    strokes: page.strokes.map((stroke) =>
                      stroke.id === source.id ? { ...stroke, points } : stroke,
                    ),
                  }
                : page,
            ),
          );
          await new Promise((resolve) => setTimeout(resolve, 12));
        }
        setPages((previous) =>
          previous.map((page) =>
            page.id === pageId
              ? {
                  ...page,
                  strokes: page.strokes.map((stroke) => (stroke.id === source.id ? source : stroke)),
                }
              : page,
          ),
        );
      }
      if (!controller.signal.aborted) setBridgeState("authorized");
    },
    [speak],
  );

  const handleAction = useCallback(
    async (action: BoardAction) => {
      if (action.type === "write") {
        const page = pagesRef.current.find((candidate) => candidate.id === activePageIdRef.current);
        const canvas = canvasRef.current;
        if (!page || !canvas) return;
        const nearby = page.strokes.filter((stroke) => action.nearStrokeIds.includes(stroke.id));
        const target = aggregateStrokeBounds(nearby);
        const view = viewRef.current;
        const rect = canvas.getBoundingClientRect();
        const viewport = {
          x: -view.x / view.zoom,
          y: -view.y / view.zoom,
          width: rect.width / view.zoom,
          height: rect.height / view.zoom,
        };
        const { width, height } = measureHandwriting(action.text, action.size);
        const anchor = findFreeHandwritingAnchor({
          target,
          occupied: page.strokes.map(strokeBounds),
          viewport,
          width,
          height,
        });
        await animateStrokes(generateHandwriting(action.text, anchor, action.size), action.narration);
        setToast(`Unsolvable wrote ${action.text} on the board.`);
        return;
      }
      if (action.type === "draw") {
        const strokes = generateTemplate(action.template, action.anchor, action.scale, action.labels);
        await animateStrokes(strokes, action.narration);
        setToast("Unsolvable added editable pen strokes to the shared board.");
        return;
      }
      if (action.type === "text") {
        await animateStrokes(generatePlainText(action.text, action.anchor, action.size), action.narration);
        setToast("Unsolvable added an editable text label to the board.");
        return;
      }
      if (action.type === "arrow") {
        await animateStrokes(generateArrow(action.from, action.to), action.narration);
        setToast("Unsolvable added an editable arrow to the board.");
        return;
      }
      if (action.type === "feedback") {
        const page = pagesRef.current.find((candidate) => candidate.id === activePageIdRef.current);
        const targets = page?.strokes.filter((stroke) => action.strokeIds.includes(stroke.id)) ?? [];
        const bounds = aggregateStrokeBounds(targets);
        if (bounds && (action.verdict !== "uncertain" || action.confidence >= 0.6)) {
          await animateStrokes(generateFeedbackStroke(action.mark, bounds, action.color), action.speech);
        } else speak(action.speech);
        setToast(
          action.verdict === "correct"
            ? "That step checks out."
            : action.verdict === "uncertain"
              ? "Unsolvable is not confident enough to mark this step."
              : "Unsolvable marked the first step worth revisiting.",
        );
        return;
      }
      if (action.type === "erase") {
        commitPages((previous) =>
          previous.map((page) =>
            page.id === activePageIdRef.current
              ? (() => {
                  const selected = page.strokes.filter((stroke) => action.strokeIds.includes(stroke.id));
                  const groups = new Set(selected.map((stroke) => stroke.groupId).filter(Boolean));
                  return {
                    ...page,
                    strokes: page.strokes.filter((stroke) =>
                      (stroke.author !== "ai" && stroke.kind !== "feedback") ||
                      (!action.strokeIds.includes(stroke.id) && !Boolean(stroke.groupId && groups.has(stroke.groupId))),
                    ),
                  };
                })()
              : page,
          ),
        );
        speak(action.speech);
        return;
      }
      speak(action.speech);
    },
    [animateStrokes, commitPages, speak],
  );

  const syncBoard = useCallback(
    async ({
      captureSnapshot = false,
      title,
      kind = "autosave",
    }: { captureSnapshot?: boolean; title?: string; kind?: BoardSaveKind } = {}) => {
      if (!sessionId || !hydrationCompleteRef.current) return null;
      const canvas = canvasRef.current;
      const rect = canvas?.getBoundingClientRect();
      const capturedSnapshot = captureSnapshot ? canvas?.toDataURL("image/png") : undefined;
      const snapshotDataUrl = capturedSnapshot && capturedSnapshot.length <= MAX_BOARD_SNAPSHOT_DATA_URL_LENGTH
        ? capturedSnapshot
        : undefined;
      const result = await saveCoordinatorRef.current!.enqueue({
        document: {
          boardId: sessionId,
          pages: pagesRef.current,
          activePageId: activePageIdRef.current,
          viewport: viewRef.current,
          snapshot: canvas && rect
            ? {
                width: canvas.width,
                height: canvas.height,
                cssWidth: rect.width,
                cssHeight: rect.height,
                pixelRatio: rect.width > 0 ? canvas.width / rect.width : 1,
              }
            : undefined,
          hintLevel: hintLevelRef.current,
          autoObserve: autoObserveRef.current,
          request: requestRef.current,
        },
        snapshotDataUrl,
        title,
      }, kind);
      serverVersionRef.current = result.eventVersion;
      return result;
    },
    [sessionId],
  );

  useEffect(() => {
    let disposed = false;
    let polling = false;
    let timer: ReturnType<typeof setInterval> | null = null;

    async function readSharedBoard(boardId: string, restore: boolean, includeBoard = true) {
      if (polling) return serverVersionRef.current;
      polling = true;
      try {
        const payload = await boardGateway.read(boardId, lastActionIdRef.current, { includeBoard });
        if (disposed) return serverVersionRef.current;
        const remoteVersion = payload.board?.eventVersion ?? serverVersionRef.current;
        const remoteChanged = remoteVersion > serverVersionRef.current;
        const coordinatorBusy = saveCoordinatorRef.current?.getPhase() === "saving";
        const shouldApplyRemote = restore || (remoteChanged && !coordinatorBusy);
        if (shouldApplyRemote && payload.board?.state?.pages?.length) {
          applyingRemoteStateRef.current = true;
          setPages(payload.board.state.pages);
          setActivePageId(payload.board.state.activePageId || payload.board.state.pages[0].id);
          setHintLevel(clamp(Number(payload.board.state.hintLevel) || 2, 0, 5));
          setAutoObserve(payload.board.state.autoObserve === true);
        }
        if (shouldApplyRemote && payload.board?.title) {
          setBoardTitle(payload.board.title);
          setTitleDraft(payload.board.title);
        }
        if (shouldApplyRemote) {
          serverVersionRef.current = Math.max(serverVersionRef.current, remoteVersion);
          if (hydrationCompleteRef.current) saveCoordinatorRef.current?.rebase(remoteVersion);
        }
        if (restore && !hasActionCursorRef.current && payload.board) {
          // Existing boards predate the stored cursor. Treat their queued actions
          // as historical so a refresh cannot replay old drawing or speech.
          lastActionIdRef.current = Math.max(lastActionIdRef.current, ...((payload.actions || []).map((action) => action.id)));
          writeActionCursor(localStorage, boardId, lastActionIdRef.current);
          hasActionCursorRef.current = true;
        }
        if (payload.board || localTutor) {
          const recentlyUsed = Date.now() - Number(payload.board?.lastMcpAt || 0) < 120_000;
          const localStatus = localTutor ? await tutorTransport.status() : null;
          setBridgeState((current) => current === "drawing" || current === "thinking" ? current : (localStatus?.ready ?? recentlyUsed) ? "authorized" : "offline");
        }
        const processActions = async () => {
          const sharedCursor = readActionCursor(localStorage, boardId);
          if (sharedCursor !== null) {
            lastActionIdRef.current = Math.max(lastActionIdRef.current, sharedCursor);
          }
          for (const queued of payload.actions || []) {
            if (queued.id <= lastActionIdRef.current) continue;
            await handleAction(queued.value);
            lastActionIdRef.current = queued.id;
            writeActionCursor(localStorage, boardId, queued.id);
          }
        };
        if (navigator.locks) {
          await navigator.locks.request(`vector-board-actions:${boardId}`, { ifAvailable: true }, async (lock) => {
            if (lock) await processActions();
          });
        } else await processActions();
        return remoteVersion;
      } finally {
        polling = false;
      }
    }

    async function connect() {
      setBridgeState("connecting");
      hydrationCompleteRef.current = false;
      saveCoordinatorRef.current?.stop();
      setSessionId(boardId);
      const storedCursor = readActionCursor(localStorage, boardId);
      hasActionCursorRef.current = storedCursor !== null;
      lastActionIdRef.current = storedCursor ?? 0;
      try {
        const initialVersion = await readSharedBoard(boardId, true);
        if (!disposed) {
          serverVersionRef.current = initialVersion;
          saveCoordinatorRef.current?.start(initialVersion);
          hydrationCompleteRef.current = true;
          setBridgeState((current) => (current === "authorized" ? current : "offline"));
          let pollCount = 0;
          timer = setInterval(() => {
            if (document.visibilityState !== "visible") return;
            pollCount += 1;
            readSharedBoard(boardId!, false, pollCount % 5 === 0).catch(() => undefined);
          }, 2_000);
        }
      } catch (error) {
        if (!disposed) {
          setBridgeState("offline");
          setToast(error instanceof Error ? error.message : "Shared board unavailable");
        }
      }
    }
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible" && hydrationCompleteRef.current) {
        readSharedBoard(boardId, false, true).catch(() => undefined);
      }
    };
    document.addEventListener("visibilitychange", onVisibilityChange);
    connect();
    return () => {
      disposed = true;
      hydrationCompleteRef.current = false;
      saveCoordinatorRef.current?.stop();
      if (timer) clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [boardId, handleAction]);

  useEffect(() => {
    if (!sessionId || !hydrationCompleteRef.current) return;
    if (applyingRemoteStateRef.current) {
      applyingRemoteStateRef.current = false;
      return;
    }
    const timer = setTimeout(() => {
      syncBoard().catch((error) => {
        setToast(error instanceof Error ? error.message : "Could not sync the shared board.");
      });
    }, 1_500);
    return () => clearTimeout(timer);
  }, [activePageId, autoObserve, hintLevel, pages, sessionId, syncBoard]);

  const interrupt = useCallback(async () => {
    if (localTutor && sessionId) await tutorTransport.interrupt(sessionId);
    animationRef.current?.abort();
    speechRef.current?.stop();
    setBridgeState((current) => current === "offline" ? "offline" : sessionId ? "authorized" : "offline");
    setToast("Stopped. Your current board work is preserved.");
  }, [sessionId]);

  const sendTurn = useCallback(
    async (message: string, trigger = "explicit") => {
      if (!sessionId) {
        setToast("The shared board is still initializing.");
        return;
      }
      if (bridgeState === "thinking" || bridgeState === "drawing") await interrupt();
      requestRef.current = { message: message.slice(0, 800), trigger, at: Date.now() };
      setToast(localTutor ? "Starting Codex…" : "Request shared. Continue in your connected AI chat to let Unsolvable respond.");
      try {
        await syncBoard({ captureSnapshot: true, kind: "explicit" });
        if (localTutor) {
          setBridgeState("thinking");
          const result = await tutorTransport.sendTurn({ boardId: sessionId, message, trigger });
          setToast(result.reply || "Codex finished.");
          setBridgeState("authorized");
          return;
        }
        if (bridgeState === "offline") setConnectionOpen(true);
      } catch (error) {
        setBridgeState("offline");
        setToast(error instanceof Error ? error.message : "Could not share the request with the AI assistant.");
      }
    },
    [bridgeState, interrupt, sessionId, syncBoard],
  );

  const scheduleObservation = useCallback(() => {
    interactionCountRef.current += 1;
    if (!autoObserve || interactionCountRef.current < 2) return;
    if (observationTimerRef.current) clearTimeout(observationTimerRef.current);
    observationTimerRef.current = setTimeout(() => {
      interactionCountRef.current = 0;
      if (agentAvailable(bridgeState)) {
        sendTurn(
          "Observe silently unless there is a high-confidence issue in the newest completed reasoning step. Do not explain more than the selected hint level.",
          "pause_after_strokes",
        );
      }
    }, 5_000);
  }, [autoObserve, bridgeState, sendTurn]);

  const onPointerDown = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (event.button !== 0 && event.button !== 1 && event.button !== 2) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    if (event.button === 2 || event.ctrlKey || event.metaKey) event.preventDefault();
    canvas.setPointerCapture(event.pointerId);
    const world = worldPoint(event, canvas, viewRef.current);
    pointerStartRef.current = { ...world, screenX: event.clientX, screenY: event.clientY };
    viewStartRef.current = { ...viewRef.current };
    const page = pagesRef.current.find((candidate) => candidate.id === activePageIdRef.current) ?? pagesRef.current[0];

    if (event.button === 2) {
      pointerModeRef.current = "marquee";
      selectionBoxRef.current = { start: world, current: world };
      setSelectedIds([]);
      requestRender();
      return;
    }

    const heldShapeTool = temporaryShapeToolRef.current?.tool;
    const currentToolIsShape = tool === "line" || tool === "rectangle" || tool === "ellipse" || tool === "arrow";
    const gestureTool = heldShapeTool
      ?? (event.ctrlKey ? "rectangle" : event.shiftKey && !currentToolIsShape ? "line" : undefined);
    if ((tool === "hand" && !gestureTool) || event.button === 1) {
      pointerModeRef.current = "pan";
      return;
    }

    const hitRadius = 12 / viewRef.current.zoom;
    const hit = [...page.strokes]
      .reverse()
      .find((stroke) => distanceToStroke(world.x, world.y, stroke, hitRadius) < hitRadius);

    if (tool === "select" && !gestureTool) {
      if (!hit) setSelectedIds([]);
      else if (!selectedIds.includes(hit.id)) setSelectedIds(strokeSelectionIds(page, hit));
      if (hit) {
        pointerModeRef.current = "move";
        gestureSnapshotRef.current = pagesRef.current;
      }
      return;
    }
    if (tool === "eraser" && !gestureTool) {
      pointerModeRef.current = "erase";
      gestureSnapshotRef.current = pagesRef.current;
      if (hit) {
        const erasedIds = new Set(
          hit.groupId ? page.strokes.filter((stroke) => stroke.groupId === hit.groupId).map((stroke) => stroke.id) : [hit.id],
        );
        setPages((previous) =>
          previous.map((candidate) =>
            candidate.id === page.id
              ? { ...candidate, strokes: candidate.strokes.filter((stroke) => !erasedIds.has(stroke.id)) }
              : candidate,
          ),
        );
      }
      return;
    }

    pointerModeRef.current = "draw";
    const pressure = event.pointerType === "mouse" ? 0.62 : clamp(event.pressure || 0.55, 0.15, 1);
    const point = { x: world.x, y: world.y, pressure, t: performance.now() };
    shiftPressedRef.current = event.shiftKey;
    altPressedRef.current = event.altKey;
    drawingGestureRef.current = {
      tool: (gestureTool ?? tool) as DrawingTool,
      color,
      pageId: page.id,
      start: point,
      current: point,
      rawPoints: [point],
      groupId: makeId("student"),
      createdAt: Date.now(),
    };
    rebuildDrawingPreview();
  };

  const onPointerMove = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas || !pointerModeRef.current) return;
    if (pointerModeRef.current === "pan") {
      viewRef.current = {
        ...viewStartRef.current,
        x: viewStartRef.current.x + event.clientX - pointerStartRef.current.screenX,
        y: viewStartRef.current.y + event.clientY - pointerStartRef.current.screenY,
      };
      requestRender();
      return;
    }
    const world = worldPoint(event, canvas, viewRef.current);
    if (pointerModeRef.current === "marquee" && selectionBoxRef.current) {
      selectionBoxRef.current.current = world;
      const page = pagesRef.current.find((candidate) => candidate.id === activePageIdRef.current) ?? pagesRef.current[0];
      const box = selectionBounds(selectionBoxRef.current.start, world);
      const hits = page.strokes.filter((stroke) => boundsIntersect(box, strokeBounds(stroke))).map((stroke) => stroke.id);
      setSelectedIds(selectedStrokes(page, hits).map((stroke) => stroke.id));
      requestRender();
      return;
    }
    if (pointerModeRef.current === "draw" && drawingGestureRef.current) {
      const gesture = drawingGestureRef.current;
      const pressure = event.pointerType === "mouse" ? 0.62 : clamp(event.pressure || 0.55, 0.15, 1);
      const point = { x: world.x, y: world.y, pressure, t: performance.now() };
      gesture.current = point;
      shiftPressedRef.current = event.shiftKey;
      altPressedRef.current = event.altKey;
      if (gesture.tool === "pen" || gesture.tool === "highlighter") {
        const last = gesture.rawPoints.at(-1)!;
        if (Math.hypot(world.x - last.x, world.y - last.y) >= 0.7) gesture.rawPoints.push(point);
      }
      rebuildDrawingPreview();
      return;
    }
    const pageId = activePageIdRef.current;
    if (pointerModeRef.current === "move" && selectedIds.length && gestureSnapshotRef.current) {
      const dx = world.x - pointerStartRef.current.x;
      const dy = world.y - pointerStartRef.current.y;
      const sourcePage = gestureSnapshotRef.current.find((page) => page.id === pageId);
      const sources = selectedStrokes(sourcePage, selectedIds);
      const sourceById = new Map(sources.map((stroke) => [stroke.id, stroke]));
      if (!sources.length) return;
      schedulePointerMutation(() => setPages((previous) =>
        previous.map((page) =>
          page.id === pageId
            ? {
                ...page,
                strokes: page.strokes.map((stroke) =>
                  sourceById.has(stroke.id)
                    ? {
                        ...stroke,
                        points: sourceById.get(stroke.id)!.points.map((point) => ({ ...point, x: point.x + dx, y: point.y + dy })),
                        modifiedAt: Date.now(),
                        modifiedBy: "student",
                      }
                    : stroke,
                ),
              }
            : page,
        ),
      ));
      return;
    }
    if (pointerModeRef.current === "erase") {
      const eraseRadius = 14 / viewRef.current.zoom;
      schedulePointerMutation(() => setPages((previous) =>
        previous.map((page) =>
          page.id === pageId
            ? {
                ...page,
                strokes: (() => {
                  const hitStrokes = page.strokes.filter(
                    (stroke) => distanceToStroke(world.x, world.y, stroke, eraseRadius) < eraseRadius,
                  );
                  const ids = new Set(hitStrokes.map((stroke) => stroke.id));
                  const groups = new Set(hitStrokes.map((stroke) => stroke.groupId).filter(Boolean));
                  return page.strokes.filter((stroke) => !ids.has(stroke.id) && (!stroke.groupId || !groups.has(stroke.groupId)));
                })(),
              }
            : page,
        ),
      ));
    }
  };

  const finishPointer = (event: React.PointerEvent<HTMLCanvasElement>) => {
    flushPointerMutation();
    const mode = pointerModeRef.current;
    pointerModeRef.current = null;
    try {
      canvasRef.current?.releasePointerCapture(event.pointerId);
    } catch {
      // Pointer capture may already have been released by the browser.
    }
    if (mode === "marquee") {
      if (event.type === "pointerup" && selectionBoxRef.current && canvasRef.current) {
        const world = worldPoint(event, canvasRef.current, viewRef.current);
        selectionBoxRef.current.current = world;
        const page = pagesRef.current.find((candidate) => candidate.id === activePageIdRef.current) ?? pagesRef.current[0];
        const box = selectionBounds(selectionBoxRef.current.start, world);
        const hits = page.strokes.filter((stroke) => boundsIntersect(box, strokeBounds(stroke))).map((stroke) => stroke.id);
        setSelectedIds(selectedStrokes(page, hits).map((stroke) => stroke.id));
      }
      selectionBoxRef.current = null;
      if (event.type === "pointercancel") setSelectedIds([]);
    } else if (mode === "draw" && drawingGestureRef.current) {
      const gesture = drawingGestureRef.current;
      const canvas = canvasRef.current;
      if (canvas && event.type === "pointerup") {
        const world = worldPoint(event, canvas, viewRef.current);
        gesture.current = { ...world, pressure: gesture.current.pressure, t: performance.now() };
        if (gesture.tool === "pen" || gesture.tool === "highlighter") {
          const last = gesture.rawPoints.at(-1)!;
          if (Math.hypot(world.x - last.x, world.y - last.y) >= 0.7) gesture.rawPoints.push(gesture.current);
        }
      }
      shiftPressedRef.current = event.shiftKey;
      altPressedRef.current = event.altKey;
      rebuildDrawingPreview();
      const distance = Math.hypot(gesture.current.x - gesture.start.x, gesture.current.y - gesture.start.y);
      const isInk = gesture.tool === "pen" || gesture.tool === "highlighter";
      const finished = currentStrokesRef.current;
      drawingGestureRef.current = null;
      currentStrokesRef.current = [];
      if (isInk && finished[0]?.points.length === 1) {
        finished[0].points.push({ ...finished[0].points[0], x: finished[0].points[0].x + 0.5 });
      }
      if (event.type !== "pointercancel" && finished.length && (isInk || distance >= 3 / viewRef.current.zoom)) {
        commitPages((previous) =>
          previous.map((page) =>
            page.id === gesture.pageId ? { ...page, strokes: [...page.strokes, ...finished] } : page,
          ),
        );
        scheduleObservation();
      }
    } else if (mode === "pan") {
      invalidateBoardCanvas(canvasRef.current);
      setView(viewRef.current);
    } else if ((mode === "move" || mode === "erase") && gestureSnapshotRef.current) {
      if (event.type === "pointercancel") {
        setPages(gestureSnapshotRef.current);
      } else {
        undoRef.current.push(gestureSnapshotRef.current);
        redoRef.current = [];
        scheduleObservation();
      }
      gestureSnapshotRef.current = null;
    }
    requestRender();
  };

  const addPage = () => {
    const id = `page-${Date.now().toString(36)}`;
    commitPages((previous) => [...previous, { id, name: `Page ${previous.length + 1}`, strokes: [] }]);
    setActivePageId(id);
    setSelectedIds([]);
    setView({ x: 86, y: 70, zoom: 1 });
    setPagesOpen(false);
    if (autoObserve && agentAvailable(bridgeState)) {
      sendTurn("I moved to a new page. Preserve the reasoning context from earlier pages and observe silently.", "page_changed");
    }
  };

  const resetView = () => setView({ x: 86, y: 70, zoom: 1 });

  const startVoice = async () => {
    const speechWindow = window as SpeechRecognitionWindow;
    const SpeechRecognition = speechWindow.SpeechRecognition || speechWindow.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setToast("Speech recognition is not available in this browser. Type a short request instead.");
      return;
    }
    if (isListening) {
      recognitionRef.current?.stop();
      return;
    }
    await interrupt();
    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = navigator.language || "en-US";
    recognition.onstart = () => {
      setIsListening(true);
      setToast("Listening… speak naturally.");
    };
    recognition.onresult = (event) => {
      const transcript = Array.from(event.results)
        .map((result) => result[0].transcript)
        .join(" ");
      setPrompt(transcript);
      if (event.results[event.results.length - 1].isFinal) {
        setPrompt("");
        sendTurn(transcript, "voice");
      }
    };
    recognition.onerror = () => setToast("I could not hear that clearly. Please try again.");
    recognition.onend = () => setIsListening(false);
    recognitionRef.current = recognition;
    recognition.start();
  };

  const beginTitleRename = () => {
    setTitleDraft(boardTitle);
    setIsRenamingTitle(true);
  };

  const cancelTitleRename = () => {
    setTitleDraft(boardTitle);
    setIsRenamingTitle(false);
  };

  const saveBoardTitle = async () => {
    const nextTitle = titleDraft.trim();
    if (!nextTitle) {
      setToast("Board name cannot be empty.");
      titleInputRef.current?.focus();
      return;
    }
    if (nextTitle === boardTitle) {
      setIsRenamingTitle(false);
      return;
    }
    setIsSavingTitle(true);
    try {
      const result = await syncBoard({ captureSnapshot: true, title: nextTitle, kind: "explicit" });
      if (!result) throw new Error("The shared board is still initializing.");
      setBoardTitle(nextTitle);
      setTitleDraft(nextTitle);
      setIsRenamingTitle(false);
      setToast(`Board renamed to “${nextTitle}”.`);
    } catch (error) {
      setToast(error instanceof Error ? error.message : "Could not rename the board.");
      titleInputRef.current?.focus();
    } finally {
      setIsSavingTitle(false);
    }
  };

  const statusLabel = {
    connecting: "Preparing board",
    authorized: localTutor ? "Codex ready" : "AI recently active",
    offline: "Connect AI",
    thinking: "AI active",
    drawing: "AI drawing",
  }[bridgeState];

  const connectionInstructions = connectionTarget === "codex"
    ? <>Run <code>codex mcp add unsolvable --url &lt;this-site&gt;/mcp</code>, or add the same URL in Codex MCP settings.</>
    : connectionTarget === "claude"
      ? <>In Claude or Claude Desktop, open Settings → Connectors → Add custom connector, then paste this site&apos;s <code>/mcp</code> URL.</>
      : <>Add this site&apos;s <code>/mcp</code> URL as a remote Streamable HTTP server in any OAuth-capable MCP client.</>;

  return (
    <main className="tutor-shell">
      <header className="topbar">
        <Link className="brand-block" href="/home" aria-label="Back to home">
          <div className="brand-mark" aria-hidden="true" />
          <div><div className="brand-name">unsolvable</div><div className="brand-subtitle">Mathematical tutor</div></div>
        </Link>

        {isRenamingTitle ? (
          <form className="problem-title-editor" onSubmit={(event) => { event.preventDefault(); void saveBoardTitle(); }}>
            <span className="problem-kicker">Board name</span>
            <input
              ref={titleInputRef}
              className="input input-sm board-title-input"
              value={titleDraft}
              maxLength={120}
              disabled={isSavingTitle}
              aria-label="Board name"
              onChange={(event) => setTitleDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Escape") {
                  event.preventDefault();
                  cancelTitleRename();
                }
              }}
            />
            <div className="problem-title-actions">
              <button className="btn btn-ghost btn-sm btn-square" type="submit" disabled={isSavingTitle} aria-label="Save board name"><Check size={15} /></button>
              <button className="btn btn-ghost btn-sm btn-square" type="button" disabled={isSavingTitle} aria-label="Cancel renaming" onClick={cancelTitleRename}><X size={15} /></button>
            </div>
          </form>
        ) : (
          <button className="problem-title btn btn-ghost" type="button" onClick={beginTitleRename} aria-label={`Rename board: ${boardTitle}`}>
            <span className="problem-kicker">Board name</span>
            <span className="board-title-text">{boardTitle}</span>
            <PenLine size={14} />
          </button>
        )}

        <div className="top-actions">
          <label className="observe-toggle">
            <input type="checkbox" checked={autoObserve} onChange={(event) => setAutoObserve(event.target.checked)} />
            <span /> Auto-observe
          </label>
          <button className={`agent-status status-${bridgeState}`} title="Remote MCP assistant" type="button" onClick={() => setConnectionOpen(true)}>
            {bridgeState === "offline" ? <WifiOff size={14} /> : <Wifi size={14} />}
            <span>{statusLabel}</span><i />
          </button>
        </div>
      </header>

      <section className="workspace">
        <aside className="tool-rail" aria-label="Whiteboard tools">
          <div className="tool-group">
            {TOOL_ITEMS.map((item) => {
              const Icon = item.icon;
              return <ToolButton key={item.id} active={tool === item.id} label={item.label} shortcut={item.shortcut} ariaShortcut={item.ariaShortcut} onClick={() => setTool(item.id)}><Icon size={19} strokeWidth={1.8} /></ToolButton>;
            })}
          </div>
          <div className="tool-divider" />
          <div className="color-row" aria-label="Ink colors">
            {["#172036", "#3558d4", "#d9483b"].map((swatch) => (
              <button type="button" aria-label={`Use ${swatch} color`} aria-pressed={color === swatch} className={`color-dot ${color === swatch ? "is-active" : ""}`} style={{ backgroundColor: swatch }} key={swatch} onClick={() => setColor(swatch)} />
            ))}
            <label className={`custom-color ${!["#172036", "#3558d4", "#d9483b"].includes(color.toLowerCase()) ? "is-active" : ""}`} title="Choose any color">
              <input type="color" value={color} onChange={(event) => setColor(event.target.value)} aria-label="Choose any drawing color" />
              <span className="custom-color-preview" style={{ backgroundColor: color }} aria-hidden="true" />
            </label>
          </div>
          <div className="tool-divider" />
          <div className="tool-group">
            <ToolButton label="Undo" shortcut="Ctrl/⌘ Z" ariaShortcut="Control+Z Meta+Z" onClick={undo}><Undo2 size={18} /></ToolButton>
            <ToolButton label="Redo" shortcut="Ctrl/⌘ Shift Z or Ctrl Y" ariaShortcut="Control+Shift+Z Meta+Shift+Z Control+Y" onClick={redo}><Redo2 size={18} /></ToolButton>
          </div>
        </aside>

        <div className="board-stage" ref={stageRef}>
          <canvas ref={canvasRef} className={`board-canvas cursor-${tool}`} onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={finishPointer} onPointerCancel={finishPointer} onContextMenu={(event) => event.preventDefault()} aria-label="Infinite shared engineering whiteboard" />

          <div className="page-chip-wrap">
            <button className="page-chip" type="button" onClick={() => setPagesOpen((open) => !open)}>
              <Layers2 size={14} /><span>{activePage.name}</span><span className="page-count">{pages.findIndex((page) => page.id === activePageId) + 1}/{pages.length}</span><ChevronDown size={13} />
            </button>
            {pagesOpen && (
              <div className="page-popover">
                <div className="page-popover-label">Problem pages</div>
                {pages.map((page, index) => (
                  <button type="button" key={page.id} className={page.id === activePageId ? "is-active" : ""} onClick={() => { setActivePageId(page.id); setPagesOpen(false); setSelectedIds([]); }}>
                    <span>{index + 1}</span><b>{page.name}</b><small>{page.strokes.length} marks</small>
                  </button>
                ))}
                <button type="button" className="add-page" onClick={addPage}><Plus size={15} /> New page</button>
              </div>
            )}
          </div>

          <div className="zoom-controls">
            <button type="button" aria-label="Zoom out" onClick={() => setView((previous) => ({ ...previous, zoom: clamp(previous.zoom / 1.18, 0.2, 4) }))}><ZoomOut size={16} /></button>
            <button type="button" className="zoom-value" onClick={resetView}>{Math.round(view.zoom * 100)}%</button>
            <button type="button" aria-label="Zoom in" onClick={() => setView((previous) => ({ ...previous, zoom: clamp(previous.zoom * 1.18, 0.2, 4) }))}><ZoomIn size={16} /></button>
          </div>

          <div className="hint-control">
            <span>Help</span>
            <div>{[0, 1, 2, 3, 4, 5].map((level) => <button type="button" key={level} className={hintLevel === level ? "is-active" : ""} onClick={() => setHintLevel(level)} aria-label={`Hint level ${level}`}>{level}</button>)}</div>
          </div>

          <div className="tutor-composer">
            <div className="composer-status" aria-live="polite"><Sparkles size={13} /><span>{toast}</span></div>
            <div className="composer-row">
              <button type="button" className={`voice-button ${isListening ? "is-listening" : ""}`} onClick={startVoice} aria-label={isListening ? "Stop listening" : "Talk to Unsolvable"}>{isListening ? <CircleStop size={19} /> : <Mic size={19} />}</button>
              <input value={prompt} onChange={(event) => setPrompt(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && prompt.trim()) { const message = prompt.trim(); setPrompt(""); sendTurn(message, "typed"); } }} placeholder="Ask briefly, or keep working…" aria-label="Ask Unsolvable" />
              {(bridgeState === "thinking" || bridgeState === "drawing") && <button type="button" className="stop-button" onClick={interrupt}><CircleStop size={15} /> Stop</button>}
              <button type="button" className="check-button" onClick={() => sendTurn("Check my work. Mark only the first invalid step, or briefly confirm if it is correct.", "explicit_verification")}><Check size={16} /> Check work</button>
            </div>
          </div>
        </div>
      </section>

      {connectionOpen && (
        <div className="connection-backdrop" role="presentation" onMouseDown={() => setConnectionOpen(false)}>
          <section className="connection-dialog" role="dialog" aria-modal="true" aria-labelledby="connect-title" onMouseDown={(event) => event.stopPropagation()}>
            <button className="connection-close" type="button" aria-label="Close" onClick={() => setConnectionOpen(false)}><X size={18} /></button>
            <div className="connection-icon"><Cable size={22} /></div>
            <p>Remote MCP connection</p>
            <h2 id="connect-title">Connect an AI assistant</h2>
            <div className="connection-copy">{connectionInstructions}</div>
            <div className="connection-targets" aria-label="AI client">
              {(["codex", "claude", "other"] as const).map((target) => (
                <button
                  type="button"
                  key={target}
                  className={connectionTarget === target ? "is-active" : ""}
                  onClick={() => setConnectionTarget(target)}
                >
                  {target === "other" ? "Other MCP" : target[0].toUpperCase() + target.slice(1)}
                </button>
              ))}
            </div>
            <div className="connection-note">
              <strong>{localTutor ? "Local Codex runner enabled" : bridgeState === "authorized" ? "An AI assistant accessed this board recently" : "No recent remote AI activity"}</strong>
              <span>The MCP client opens Unsolvable sign-in and consent for {displayName}; no model-provider key is stored here.</span>
            </div>
            <button className="connection-done" type="button" onClick={() => { navigator.clipboard.writeText(`${window.location.origin}/mcp`).then(() => setToast("MCP server address copied.")).catch(() => undefined); }}>Copy MCP server address</button>
            <button className="connection-secondary" type="button" onClick={() => setConnectionOpen(false)}>Close</button>
          </section>
        </div>
      )}
    </main>
  );
}

