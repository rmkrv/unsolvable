export type GeometryPoint = { x: number; y: number };
export type ShapeTool = "line" | "rectangle" | "ellipse" | "arrow";

export function snapLineEnd(start: GeometryPoint, end: GeometryPoint, step?: number): GeometryPoint;
export function shapeBounds(
  start: GeometryPoint,
  end: GeometryPoint,
  constrain?: boolean,
  fromCenter?: boolean,
): { x: number; y: number; width: number; height: number };
export function selectionBounds(
  start: GeometryPoint,
  current: GeometryPoint,
): { x: number; y: number; width: number; height: number };
export function boundsIntersect(
  a: { x: number; y: number; width: number; height: number },
  b: { x: number; y: number; width: number; height: number },
): boolean;
export function buildShapePaths(
  tool: ShapeTool,
  start: GeometryPoint,
  end: GeometryPoint,
  options?: { constrain?: boolean; fromCenter?: boolean },
): GeometryPoint[][];
export function isEditableTarget(target: EventTarget | null): boolean;
