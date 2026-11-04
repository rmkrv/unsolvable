"use client";

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
} from "@/lib/board-model";
import { generateFeedbackStroke, generateHandwriting, generateTemplate, measureHandwriting } from "@/lib/trajectory-generator";
import { findFreeHandwritingAnchor } from "@/lib/handwriting-placement.mjs";
import { createEnglishSpeechController } from "@/lib/english-speech.mjs";
import { buildShapePaths, isEditableTarget, type ShapeTool } from "@/lib/board-interactions.mjs";

type Tool = "select" | "pen" | "highlighter" | "eraser" | "hand" | ShapeTool;
type DrawingTool = "pen" | "highlighter" | ShapeTool;
type BridgeState = "connecting" | "ready" | "offline" | "thinking" | "drawing";
type DrawingGesture = {
  tool: DrawingTool;
  pageId: string;
  start: { x: number; y: number; pressure: number; t: number };
  current: { x: number; y: number; pressure: number; t: number };
  rawPoints: Array<{ x: number; y: number; pressure: number; t: number }>;
  groupId: string;
  createdAt: number;
};
type BoardAction =
  | { type: "draw"; template: string; anchor: { x: number; y: number }; scale: number; labels: string[]; narration: string }
  | { type: "write"; text: string; nearStrokeIds: string[]; size: number; narration: string }
  | { type: "feedback"; verdict: string; mark: string; strokeIds: string[]; color: string; speech: string; hintLevel: number; confidence: number }
  | { type: "erase"; strokeIds: string[]; speech: string }
  | { type: "say"; speech: string; tone: string };

const STORAGE_KEY = "vector-tutor-board-v1";
const BOARD_ID_KEY = "vector-tutor-board-id-v1";
const ACTION_CURSOR_KEY = "vector-tutor-action-cursor-v1";
const STROKE_CLIPBOARD_TYPE = "application/x-unsolvable-strokes+json";
const LOCAL_CODEX_BRIDGE = import.meta.env.VITE_TUTOR_BRIDGE_URL as string | undefined;
const INITIAL_PAGE: Page = { id: "page-1", name: "Page 1", strokes: [] };

const TOOL_ITEMS: { id: Tool; label: string; icon: typeof PenLine; shortcut: string }[] = [
  { id: "select", label: "Select", icon: MousePointer2, shortcut: "V" },
  { id: "pen", label: "Pen", icon: PenLine, shortcut: "P" },
  { id: "highlighter", label: "Highlight", icon: Highlighter, shortcut: "H" },
  { id: "eraser", label: "Eraser", icon: Eraser, shortcut: "E" },
  { id: "line", label: "Line", icon: Minus, shortcut: "L" },
  { id: "rectangle", label: "Rectangle", icon: Square, shortcut: "R" },
  { id: "ellipse", label: "Ellipse", icon: Circle, shortcut: "O" },
  { id: "arrow", label: "Arrow", icon: ArrowUpRight, shortcut: "A" },
  { id: "hand", label: "Pan", icon: Hand, shortcut: "Space" },
];

function clamp(value: number, minimum: number, maximum: number) {
  return Math.max(minimum, Math.min(maximum, value));
}

function copyPages(pages: Page[]) {
  return pages.map((page) => ({
    ...page,
    strokes: page.strokes.map((stroke) => ({
      ...stroke,
      points: stroke.points.map((point) => ({ ...point })),
    })),
  }));
}

function selectedStrokes(page: Page | undefined, selectedId: string | null) {
  if (!page || !selectedId) return [];
  const selected = page.strokes.find((stroke) => stroke.id === selectedId);
  if (!selected) return [];
  return selected.groupId
    ? page.strokes.filter((stroke) => stroke.groupId === selected.groupId)
    : [selected];
}

function parseClipboardStrokes(raw: string) {
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

function aggregateBounds(strokes: Stroke[]) {
  if (!strokes.length) return null;
  const boxes = strokes.map(strokeBounds);
  const x = Math.min(...boxes.map((box) => box.x));
  const y = Math.min(...boxes.map((box) => box.y));
  const right = Math.max(...boxes.map((box) => box.x + box.width));
  const bottom = Math.max(...boxes.map((box) => box.y + box.height));
  return { x, y, width: right - x, height: bottom - y };
}

export default function TutorBoard({ displayName }: { displayName: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const [pages, setPages] = useState<Page[]>([INITIAL_PAGE]);
  const [activePageId, setActivePageId] = useState("page-1");
  const [view, setView] = useState<Viewport>({ x: 86, y: 70, zoom: 1 });
  const [tool, setTool] = useState<Tool>("pen");
  const [color, setColor] = useState("#172036");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [bridgeState, setBridgeState] = useState<BridgeState>("connecting");
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [model, setModel] = useState<string | null>(null);
  const [connectionOpen, setConnectionOpen] = useState(false);
  const [hintLevel, setHintLevel] = useState(2);
  const [autoObserve, setAutoObserve] = useState(true);
  const [prompt, setPrompt] = useState("");
  const [isListening, setIsListening] = useState(false);
  const [toast, setToast] = useState("Draw naturally — Unsolvable will wait for a complete thought.");
  const [pagesOpen, setPagesOpen] = useState(false);
  const undoRef = useRef<Page[][]>([]);
  const redoRef = useRef<Page[][]>([]);
  const pagesRef = useRef(pages);
  const viewRef = useRef(view);
  const toolRef = useRef<Tool>(tool);
  const activePageIdRef = useRef(activePageId);
  const currentStrokesRef = useRef<Stroke[]>([]);
  const drawingGestureRef = useRef<DrawingGesture | null>(null);
  const pointerModeRef = useRef<"draw" | "pan" | "move" | "erase" | null>(null);
  const pointerStartRef = useRef({ x: 0, y: 0, screenX: 0, screenY: 0 });
  const viewStartRef = useRef(view);
  const gestureSnapshotRef = useRef<Page[] | null>(null);
  const renderFrameRef = useRef<number | null>(null);
  const animationRef = useRef<AbortController | null>(null);
  const turnRef = useRef<AbortController | null>(null);
  const recognitionRef = useRef<any>(null);
  const speechRef = useRef<ReturnType<typeof createEnglishSpeechController> | null>(null);
  const observationTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const interactionCountRef = useRef(0);
  const lastActionIdRef = useRef(0);
  const hasActionCursorRef = useRef(false);
  const requestRef = useRef<{ message: string; trigger: string; at: number } | null>(null);
  const previousToolRef = useRef<Tool | null>(null);
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
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (!saved) return;
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed.pages) && parsed.pages.length) {
        setPages(parsed.pages);
        setActivePageId(parsed.activePageId || parsed.pages[0].id);
        setHintLevel(clamp(Number(parsed.hintLevel) || 2, 0, 5));
      }
    } catch {
      setToast("The saved board could not be restored; a fresh board is open.");
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ pages, activePageId, hintLevel }));
    }, 250);
    return () => clearTimeout(timer);
  }, [activePageId, hintLevel, pages]);

  const drawCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    const stage = stageRef.current;
    if (!canvas || !stage) return;
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

    const currentView = viewRef.current;
    const minor = 24 * currentView.zoom;
    const major = minor * 5;
    const offsetX = ((currentView.x % minor) + minor) % minor;
    const offsetY = ((currentView.y % minor) + minor) % minor;
    context.lineWidth = 1;
    for (let x = offsetX; x < rect.width; x += minor) {
      context.strokeStyle = Math.abs(((x - currentView.x) % major + major) % major) < 1 ? "#d9d6cd" : "#ebe8df";
      context.beginPath();
      context.moveTo(x, 0);
      context.lineTo(x, rect.height);
      context.stroke();
    }
    for (let y = offsetY; y < rect.height; y += minor) {
      context.strokeStyle = Math.abs(((y - currentView.y) % major + major) % major) < 1 ? "#d9d6cd" : "#ebe8df";
      context.beginPath();
      context.moveTo(0, y);
      context.lineTo(rect.width, y);
      context.stroke();
    }

    const page = pagesRef.current.find((candidate) => candidate.id === activePageIdRef.current) ?? pagesRef.current[0];
    const strokes = [...(page?.strokes ?? [])];
    strokes.push(...currentStrokesRef.current);
    for (const stroke of strokes) {
      if (stroke.points.length < 2) continue;
      context.save();
      context.globalAlpha = stroke.opacity;
      context.strokeStyle = stroke.color;
      context.lineCap = "round";
      context.lineJoin = "round";
      for (let index = 1; index < stroke.points.length; index += 1) {
        const a = stroke.points[index - 1];
        const b = stroke.points[index];
        context.lineWidth = Math.max(1, stroke.width * ((a.pressure + b.pressure) / 2) * currentView.zoom);
        context.beginPath();
        context.moveTo(a.x * currentView.zoom + currentView.x, a.y * currentView.zoom + currentView.y);
        context.quadraticCurveTo(
          a.x * currentView.zoom + currentView.x,
          a.y * currentView.zoom + currentView.y,
          b.x * currentView.zoom + currentView.x,
          b.y * currentView.zoom + currentView.y,
        );
        context.stroke();
      }
      context.restore();
    }

    if (selectedId) {
      const selected = selectedStrokes(page, selectedId);
      if (selected.length) {
        const box = aggregateBounds(selected)!;
        context.save();
        context.strokeStyle = "#3558d4";
        context.lineWidth = 1.25;
        context.setLineDash([5, 4]);
        context.strokeRect(
          box.x * currentView.zoom + currentView.x - 7,
          box.y * currentView.zoom + currentView.y - 7,
          box.width * currentView.zoom + 14,
          box.height * currentView.zoom + 14,
        );
        context.restore();
      }
    }
  }, [selectedId]);

  const requestRender = useCallback(() => {
    if (renderFrameRef.current !== null) return;
    renderFrameRef.current = requestAnimationFrame(() => {
      renderFrameRef.current = null;
      drawCanvas();
    });
  }, [drawCanvas]);

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
      color: highlighter ? "#f2c94c" : color,
      width: highlighter ? 18 : 4.2,
      opacity: highlighter ? 0.28 : 1,
      kind: highlighter ? "highlighter" : "pen",
      author: "student",
      createdAt: gesture.createdAt,
      semantic: isInk ? undefined : `shape:${gesture.tool}`,
      groupId: paths.length > 1 ? gesture.groupId : undefined,
    }));
    requestRender();
  }, [color, requestRender]);

  useEffect(() => {
    requestRender();
  }, [pages, requestRender, selectedId, view]);

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
      undoRef.current.push(copyPages(previous));
      if (undoRef.current.length > 80) undoRef.current.shift();
      redoRef.current = [];
      return next;
    });
  }, []);

  const undo = useCallback(() => {
    const snapshot = undoRef.current.pop();
    if (!snapshot) return;
    redoRef.current.push(copyPages(pagesRef.current));
    setPages(snapshot);
    setSelectedId(null);
  }, []);

  const redo = useCallback(() => {
    const snapshot = redoRef.current.pop();
    if (!snapshot) return;
    undoRef.current.push(copyPages(pagesRef.current));
    setPages(snapshot);
    setSelectedId(null);
  }, []);

  const copySelection = useCallback(() => {
    const page = pagesRef.current.find((candidate) => candidate.id === activePageIdRef.current);
    const strokes = selectedStrokes(page, selectedId);
    if (!strokes.length) return [];
    clipboardRef.current = copyPages([{ id: "clipboard", name: "Clipboard", strokes }])[0].strokes;
    pasteCountRef.current = 0;
    return clipboardRef.current;
  }, [selectedId]);

  const deleteSelection = useCallback(() => {
    const page = pagesRef.current.find((candidate) => candidate.id === activePageIdRef.current);
    const ids = new Set(selectedStrokes(page, selectedId).map((stroke) => stroke.id));
    if (!ids.size) return;
    commitPages((previous) => previous.map((candidate) =>
      candidate.id === activePageIdRef.current
        ? { ...candidate, strokes: candidate.strokes.filter((stroke) => !ids.has(stroke.id)) }
        : candidate,
    ));
    setSelectedId(null);
  }, [commitPages, selectedId]);

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
    setSelectedId(pasted[0].id);
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
      if ((event.key === "Delete" || event.key === "Backspace") && selectedId) {
        event.preventDefault();
        deleteSelection();
        return;
      }
      if (event.key === "Escape") {
        event.preventDefault();
        setConnectionOpen(false);
        setPagesOpen(false);
        setSelectedId(null);
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
      const mapped: Record<string, Tool> = {
        v: "select", p: "pen", h: "highlighter", e: "eraser",
        l: "line", r: "rectangle", o: "ellipse", a: "arrow",
      };
      if (mapped[key]) setTool(mapped[key]);
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
      const strokes = raw ? parseClipboardStrokes(raw) : clipboardRef.current;
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
  }, [connectionOpen, copySelection, deleteSelection, duplicateSelection, pasteStrokes, rebuildDrawingPreview, redo, requestRender, selectedId, undo, zoomAtCenter]);

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
      undoRef.current.push(copyPages(pagesRef.current));
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
      if (!controller.signal.aborted) setBridgeState("ready");
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
        const target = aggregateBounds(nearby);
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
      if (action.type === "feedback") {
        const page = pagesRef.current.find((candidate) => candidate.id === activePageIdRef.current);
        const targets = page?.strokes.filter((stroke) => action.strokeIds.includes(stroke.id)) ?? [];
        const bounds = aggregateBounds(targets);
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
              ? {
                  ...page,
                  strokes: page.strokes.filter(
                    (stroke) =>
                      !action.strokeIds.includes(stroke.id) ||
                      (stroke.author !== "ai" && stroke.kind !== "feedback"),
                  ),
                }
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
    async (captureSnapshot = false) => {
      if (!sessionId) return null;
      const snapshotDataUrl = captureSnapshot ? canvasRef.current?.toDataURL("image/png") : undefined;
      const response = await fetch("/api/board", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          boardId: sessionId,
          state: {
            boardId: sessionId,
            pages: pagesRef.current,
            activePageId: activePageIdRef.current,
            viewport: viewRef.current,
            hintLevel,
            request: requestRef.current,
          },
          snapshotDataUrl,
        }),
      });
      const payload = await response.json() as { error?: string };
      if (!response.ok) throw new Error(payload.error || "Could not sync the shared board.");
      return payload;
    },
    [hintLevel, sessionId],
  );

  useEffect(() => {
    let disposed = false;
    let polling = false;
    let timer: ReturnType<typeof setInterval> | null = null;

    async function readSharedBoard(boardId: string, restore: boolean) {
      if (polling) return;
      polling = true;
      try {
        const response = await fetch(`/api/board?after=${lastActionIdRef.current}`, { cache: "no-store" });
        const payload = await response.json() as {
          error?: string;
          board?: { state?: { pages?: Page[]; activePageId?: string; hintLevel?: number }; lastMcpAt?: number };
          actions?: Array<{ id: number; value: BoardAction }>;
        };
        if (!response.ok) throw new Error(payload.error || "Shared board unavailable");
        if (disposed) return;
        if (restore && payload.board?.state?.pages?.length) {
          setPages(payload.board.state.pages);
          setActivePageId(payload.board.state.activePageId || payload.board.state.pages[0].id);
          setHintLevel(clamp(Number(payload.board.state.hintLevel) || 2, 0, 5));
        }
        if (restore && !hasActionCursorRef.current && payload.board) {
          // Existing boards predate the stored cursor. Treat their queued actions
          // as historical so a refresh cannot replay old drawing or speech.
          lastActionIdRef.current = Math.max(lastActionIdRef.current, ...((payload.actions || []).map((action) => action.id)));
          localStorage.setItem(`${ACTION_CURSOR_KEY}:${boardId}`, String(lastActionIdRef.current));
          hasActionCursorRef.current = true;
        }
        if (!LOCAL_CODEX_BRIDGE) {
          const recentlyUsed = Date.now() - Number(payload.board?.lastMcpAt || 0) < 120_000;
          setBridgeState((current) => current === "drawing" ? current : recentlyUsed ? "ready" : "offline");
        }
        const processActions = async () => {
          const sharedCursor = Number(localStorage.getItem(`${ACTION_CURSOR_KEY}:${boardId}`));
          if (Number.isSafeInteger(sharedCursor) && sharedCursor >= 0) {
            lastActionIdRef.current = Math.max(lastActionIdRef.current, sharedCursor);
          }
          for (const queued of payload.actions || []) {
            if (queued.id <= lastActionIdRef.current) continue;
            await handleAction(queued.value);
            lastActionIdRef.current = queued.id;
            localStorage.setItem(`${ACTION_CURSOR_KEY}:${boardId}`, String(queued.id));
          }
        };
        if (navigator.locks) {
          await navigator.locks.request(`vector-board-actions:${boardId}`, { ifAvailable: true }, async (lock) => {
            if (lock) await processActions();
          });
        } else await processActions();
      } finally {
        polling = false;
      }
    }

    async function connect() {
      setBridgeState("connecting");
      let boardId = localStorage.getItem(BOARD_ID_KEY);
      if (!boardId) {
        boardId = makeId("board");
        localStorage.setItem(BOARD_ID_KEY, boardId);
      }
      setSessionId(boardId);
      const storedCursor = Number(localStorage.getItem(`${ACTION_CURSOR_KEY}:${boardId}`));
      hasActionCursorRef.current = Number.isSafeInteger(storedCursor) && storedCursor >= 0 && localStorage.getItem(`${ACTION_CURSOR_KEY}:${boardId}`) !== null;
      lastActionIdRef.current = hasActionCursorRef.current ? storedCursor : 0;
      setModel(LOCAL_CODEX_BRIDGE ? "Codex local" : "Codex MCP");
      try {
        await readSharedBoard(boardId, true);
        if (!disposed) {
          if (LOCAL_CODEX_BRIDGE) {
            const response = await fetch(`${LOCAL_CODEX_BRIDGE}/status`);
            const status = await response.json() as { ready?: boolean; error?: string };
            setBridgeState(status.ready ? "ready" : "offline");
            if (!status.ready && status.error) setToast(status.error);
          } else setBridgeState((current) => (current === "ready" ? current : "offline"));
          timer = setInterval(() => {
            readSharedBoard(boardId!, false).catch(() => undefined);
          }, 1_200);
        }
      } catch (error) {
        if (!disposed) {
          setBridgeState("offline");
          setToast(error instanceof Error ? error.message : "Shared board unavailable");
        }
      }
    }
    connect();
    return () => {
      disposed = true;
      if (timer) clearInterval(timer);
    };
  }, [handleAction]);

  useEffect(() => {
    if (!sessionId) return;
    const timer = setTimeout(() => {
      syncBoard(true).catch((error) => {
        setToast(error instanceof Error ? error.message : "Could not sync the shared board.");
      });
    }, 700);
    return () => clearTimeout(timer);
  }, [activePageId, hintLevel, pages, sessionId, syncBoard]);

  const interrupt = useCallback(async () => {
    animationRef.current?.abort();
    turnRef.current?.abort();
    speechRef.current?.stop();
    if (LOCAL_CODEX_BRIDGE && sessionId) {
      await fetch(`${LOCAL_CODEX_BRIDGE}/interrupt`, {
        method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ boardId: sessionId }),
      }).catch(() => undefined);
    }
    setBridgeState((current) => (current === "offline" ? "offline" : sessionId ? "ready" : "offline"));
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
      setToast(LOCAL_CODEX_BRIDGE ? "Codex is checking your board…" : "Request shared. Continue in your Codex tutor chat to let Unsolvable respond.");
      try {
        await syncBoard(true);
        if (LOCAL_CODEX_BRIDGE) {
          setBridgeState("thinking");
          const controller = new AbortController();
          turnRef.current = controller;
          const response = await fetch(`${LOCAL_CODEX_BRIDGE}/turn`, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ boardId: sessionId, message, trigger }),
            signal: controller.signal,
          });
          if (turnRef.current === controller) turnRef.current = null;
          const result = await response.json() as { reply?: string; error?: string };
          if (!response.ok) throw new Error(result.error || "Codex could not complete this turn.");
          setBridgeState("ready");
          if (result.reply) setToast(result.reply.slice(0, 280));
        } else if (bridgeState === "offline") setConnectionOpen(true);
      } catch (error) {
        if (error instanceof Error && error.name === "AbortError") return;
        setBridgeState("offline");
        setToast(error instanceof Error ? error.message : "Could not share the request with Codex.");
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
      if (bridgeState === "ready") {
        sendTurn(
          "Observe silently unless there is a high-confidence issue in the newest completed reasoning step. Do not explain more than the selected hint level.",
          "pause_after_strokes",
        );
      }
    }, 5_000);
  }, [autoObserve, bridgeState, sendTurn]);

  const onPointerDown = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (event.button !== 0 && event.button !== 1) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.setPointerCapture(event.pointerId);
    const world = worldPoint(event, canvas, viewRef.current);
    pointerStartRef.current = { ...world, screenX: event.clientX, screenY: event.clientY };
    viewStartRef.current = { ...viewRef.current };

    if (tool === "hand" || event.button === 1) {
      pointerModeRef.current = "pan";
      return;
    }

    const page = pagesRef.current.find((candidate) => candidate.id === activePageIdRef.current) ?? pagesRef.current[0];
    const hit = [...page.strokes]
      .reverse()
      .find((stroke) => distanceToStroke(world.x, world.y, stroke) < 12 / viewRef.current.zoom);

    if (tool === "select") {
      setSelectedId(hit?.id ?? null);
      if (hit) {
        pointerModeRef.current = "move";
        gestureSnapshotRef.current = copyPages(pagesRef.current);
      }
      return;
    }
    if (tool === "eraser") {
      pointerModeRef.current = "erase";
      gestureSnapshotRef.current = copyPages(pagesRef.current);
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
      tool: tool as DrawingTool,
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
      setView({
        ...viewStartRef.current,
        x: viewStartRef.current.x + event.clientX - pointerStartRef.current.screenX,
        y: viewStartRef.current.y + event.clientY - pointerStartRef.current.screenY,
      });
      return;
    }
    const world = worldPoint(event, canvas, viewRef.current);
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
    if (pointerModeRef.current === "move" && selectedId && gestureSnapshotRef.current) {
      const dx = world.x - pointerStartRef.current.x;
      const dy = world.y - pointerStartRef.current.y;
      const sourcePage = gestureSnapshotRef.current.find((page) => page.id === pageId);
      const sources = selectedStrokes(sourcePage, selectedId);
      const sourceById = new Map(sources.map((stroke) => [stroke.id, stroke]));
      if (!sources.length) return;
      setPages((previous) =>
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
      );
      return;
    }
    if (pointerModeRef.current === "erase") {
      setPages((previous) =>
        previous.map((page) =>
          page.id === pageId
            ? {
                ...page,
                strokes: (() => {
                  const hitStrokes = page.strokes.filter(
                    (stroke) => distanceToStroke(world.x, world.y, stroke) < 14 / viewRef.current.zoom,
                  );
                  const ids = new Set(hitStrokes.map((stroke) => stroke.id));
                  const groups = new Set(hitStrokes.map((stroke) => stroke.groupId).filter(Boolean));
                  return page.strokes.filter((stroke) => !ids.has(stroke.id) && (!stroke.groupId || !groups.has(stroke.groupId)));
                })(),
              }
            : page,
        ),
      );
    }
  };

  const finishPointer = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const mode = pointerModeRef.current;
    pointerModeRef.current = null;
    try {
      canvasRef.current?.releasePointerCapture(event.pointerId);
    } catch {
      // Pointer capture may already have been released by the browser.
    }
    if (mode === "draw" && drawingGestureRef.current) {
      const gesture = drawingGestureRef.current;
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
      if (finished.length && (isInk || distance >= 3 / viewRef.current.zoom)) {
        commitPages((previous) =>
          previous.map((page) =>
            page.id === gesture.pageId ? { ...page, strokes: [...page.strokes, ...finished] } : page,
          ),
        );
        scheduleObservation();
      }
    } else if ((mode === "move" || mode === "erase") && gestureSnapshotRef.current) {
      undoRef.current.push(gestureSnapshotRef.current);
      redoRef.current = [];
      gestureSnapshotRef.current = null;
      scheduleObservation();
    }
    requestRender();
  };

  const addPage = () => {
    const id = `page-${Date.now().toString(36)}`;
    commitPages((previous) => [...previous, { id, name: `Page ${previous.length + 1}`, strokes: [] }]);
    setActivePageId(id);
    setSelectedId(null);
    setView({ x: 86, y: 70, zoom: 1 });
    setPagesOpen(false);
    if (autoObserve && bridgeState === "ready") {
      sendTurn("I moved to a new page. Preserve the reasoning context from earlier pages and observe silently.", "page_changed");
    }
  };

  const resetView = () => setView({ x: 86, y: 70, zoom: 1 });

  const startVoice = async () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
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
    recognition.onresult = (event: any) => {
      const transcript = Array.from(event.results)
        .map((result: any) => result[0].transcript)
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

  const statusLabel = {
    connecting: "Preparing board",
    ready: "Codex connected",
    offline: "Connect Codex",
    thinking: "Codex active",
    drawing: "Drawing",
  }[bridgeState];

  return (
    <main className="tutor-shell">
      <header className="topbar">
        <div className="brand-block">
          <div className="brand-mark" aria-hidden="true"><span /><span /></div>
          <div><div className="brand-name">Unsolvable</div><div className="brand-subtitle">Engineering tutor</div></div>
        </div>

        <button className="problem-title" type="button" onClick={() => setPagesOpen((open) => !open)}>
          <span className="problem-kicker">Open board</span>
          <span>Untitled engineering problem</span>
          <ChevronDown size={15} />
        </button>

        <div className="top-actions">
          <label className="observe-toggle">
            <input type="checkbox" checked={autoObserve} onChange={(event) => setAutoObserve(event.target.checked)} />
            <span /> Auto-observe
          </label>
          <button className={`agent-status status-${bridgeState}`} title={model || "Codex MCP plugin"} type="button" onClick={() => setConnectionOpen(true)}>
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
              return <ToolButton key={item.id} active={tool === item.id} label={item.label} shortcut={item.shortcut} onClick={() => setTool(item.id)}><Icon size={19} strokeWidth={1.8} /></ToolButton>;
            })}
          </div>
          <div className="tool-divider" />
          <div className="color-row" aria-label="Ink colors">
            {["#172036", "#3558d4", "#d9483b"].map((swatch) => (
              <button type="button" aria-label={`Use ${swatch} ink`} className={`color-dot ${color === swatch ? "is-active" : ""}`} style={{ backgroundColor: swatch }} key={swatch} onClick={() => { setColor(swatch); setTool("pen"); }} />
            ))}
          </div>
          <div className="tool-divider" />
          <div className="tool-group">
            <ToolButton label="Undo" shortcut="Ctrl/⌘ Z" ariaShortcut="Control+Z Meta+Z" onClick={undo}><Undo2 size={18} /></ToolButton>
            <ToolButton label="Redo" shortcut="Ctrl/⌘ Shift Z or Ctrl Y" ariaShortcut="Control+Shift+Z Meta+Shift+Z Control+Y" onClick={redo}><Redo2 size={18} /></ToolButton>
          </div>
        </aside>

        <div className="board-stage" ref={stageRef}>
          <canvas ref={canvasRef} className={`board-canvas cursor-${tool}`} onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={finishPointer} onPointerCancel={finishPointer} aria-label="Infinite shared engineering whiteboard" />

          <div className="page-chip-wrap">
            <button className="page-chip" type="button" onClick={() => setPagesOpen((open) => !open)}>
              <Layers2 size={14} /><span>{activePage.name}</span><span className="page-count">{pages.findIndex((page) => page.id === activePageId) + 1}/{pages.length}</span><ChevronDown size={13} />
            </button>
            {pagesOpen && (
              <div className="page-popover">
                <div className="page-popover-label">Problem pages</div>
                {pages.map((page, index) => (
                  <button type="button" key={page.id} className={page.id === activePageId ? "is-active" : ""} onClick={() => { setActivePageId(page.id); setPagesOpen(false); setSelectedId(null); }}>
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
            <p>{LOCAL_CODEX_BRIDGE ? "Local connection" : "One-time setup"}</p>
            <h2 id="connect-title">{LOCAL_CODEX_BRIDGE ? "Codex on this computer" : "Open Unsolvable in Codex"}</h2>
            <div className="connection-copy">
              {LOCAL_CODEX_BRIDGE
                ? "Unsolvable uses the Codex installation and ChatGPT sign-in already on this computer. Close this window and press Check work to start a turn."
                : <>Open Codex Settings → MCP servers → Add server. Choose Streamable HTTP and enter <code>http://127.0.0.1:5173/mcp</code>.</>}
            </div>
            <div className="connection-note">
              <strong>{bridgeState === "ready" ? "Connection detected" : "Codex is not ready"}</strong>
              <span>Signed in as {displayName}. No API key is needed.</span>
            </div>
            {LOCAL_CODEX_BRIDGE ? (
              <button className="connection-done" type="button" onClick={() => setConnectionOpen(false)}>Start using Unsolvable</button>
            ) : (
              <button className="connection-done" type="button" onClick={() => { navigator.clipboard.writeText("http://127.0.0.1:5173/mcp").then(() => setToast("Local MCP address copied.")).catch(() => undefined); }}>Copy MCP address</button>
            )}
            <button className="connection-secondary" type="button" onClick={() => setConnectionOpen(false)}>Close</button>
          </section>
        </div>
      )}
    </main>
  );
}

