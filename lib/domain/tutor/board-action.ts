export type BoardAction =
  | { type: "draw"; template: string; anchor: { x: number; y: number }; scale: number; labels: string[]; narration: string }
  | { type: "write"; text: string; nearStrokeIds: string[]; size: number; narration: string }
  | { type: "text"; text: string; anchor: { x: number; y: number }; size: number; narration: string }
  | { type: "arrow"; from: { x: number; y: number }; to: { x: number; y: number }; narration: string }
  | { type: "feedback"; verdict: string; mark: string; strokeIds: string[]; color: string; speech: string; hintLevel: number; confidence: number }
  | { type: "erase"; strokeIds: string[]; speech: string }
  | { type: "say"; speech: string; tone: string };
