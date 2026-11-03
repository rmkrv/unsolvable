const DRAW_TEMPLATES = new Set([
  "axes",
  "parabola",
  "force_diagram",
  "energy_bars",
  "projectile",
  "phasor",
  "series_circuit",
  "free_body",
]);

const VISUAL_MARKS = new Set(["underline", "highlight", "circle", "point"]);

function boundedNumber(value, minimum, maximum, fallback) {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.min(maximum, Math.max(minimum, value))
    : fallback;
}

function shortString(value, maximum = 240) {
  return typeof value === "string" ? value.slice(0, maximum) : "";
}

function englishSpeech(value) {
  const text = shortString(value);
  for (const character of text) {
    if (/\p{L}/u.test(character) && !/\p{Script=Latin}/u.test(character)) {
      throw new Error("Spoken text must be in English. Translate it and retry the tool call.");
    }
  }
  return text;
}

function stringList(value, maximum = 20) {
  if (!Array.isArray(value)) return [];
  return value.filter((item) => typeof item === "string").slice(0, maximum);
}

export function sanitizeBoardAction(tool, args, allowedStrokeIds) {
  const input = args && typeof args === "object" ? args : {};
  if (tool === "board_write_equation") {
    const text = typeof input.text === "string"
      ? input.text.trim().replaceAll("−", "-").replaceAll("×", "*").replaceAll("÷", "/").replaceAll("²", "^2").replaceAll("³", "^3")
      : "";
    if (!text || text.length > 64 || !/^[A-Za-z0-9+\-*/=().^_ ∫π√]+$/.test(text) || text.split("=").length !== 2) {
      throw new Error("Write one equation of at most 64 supported math characters.");
    }
    const verification = verifyArithmeticEquation(text);
    if (verification.verdict === "invalid") throw new Error(`The proposed correction is false: ${verification.reason}`);
    return {
      type: "write",
      text,
      nearStrokeIds: stringList(input.nearStrokeIds, 30).filter((id) => allowedStrokeIds.has(id)),
      size: boundedNumber(input.size, 14, 34, 26),
      narration: englishSpeech(input.narration),
    };
  }
  if (tool === "board_draw") {
    const template = DRAW_TEMPLATES.has(input.template) ? input.template : null;
    if (!template) throw new Error("Unsupported drawing template");
    return {
      type: "draw",
      template,
      anchor: {
        x: boundedNumber(input.anchor?.x, -20_000, 20_000, 640),
        y: boundedNumber(input.anchor?.y, -20_000, 20_000, 420),
      },
      scale: boundedNumber(input.scale, 0.25, 3, 1),
      labels: stringList(input.labels, 8).map((item) => item.slice(0, 32)),
      narration: englishSpeech(input.narration),
    };
  }
  if (tool === "board_feedback") {
    const requested = stringList(input.strokeIds, 40);
    return {
      type: "feedback",
      verdict: ["correct", "potential_mistake", "uncertain"].includes(input.verdict)
        ? input.verdict
        : "uncertain",
      mark: VISUAL_MARKS.has(input.mark) ? input.mark : "underline",
      strokeIds: requested.filter((id) => allowedStrokeIds.has(id)),
      color: input.verdict === "correct" ? "#15803d" : "#d9483b",
      speech: englishSpeech(input.speech),
      hintLevel: Math.round(boundedNumber(input.hintLevel, 0, 5, 2)),
      confidence: boundedNumber(input.confidence, 0, 1, 0),
    };
  }
  if (tool === "board_erase") {
    return {
      type: "erase",
      strokeIds: stringList(input.strokeIds, 40).filter((id) => allowedStrokeIds.has(id)),
      speech: englishSpeech(input.speech),
    };
  }
  if (tool === "board_say") {
    return { type: "say", speech: englishSpeech(input.speech), tone: shortString(input.tone, 24) };
  }
  throw new Error(`Unknown board tool: ${tool}`);
}

export const dynamicTools = [
  {
    type: "function",
    name: "verify_arithmetic_equation",
    description: "Check whether a numeric equation or simple polynomial definite integral is true before writing a correction. For example, 1 + 2 = 4 is invalid, 1 + 2 = 3 is valid, and ∫_0^2(x^2+x-2)dx=2/3 is valid. Returns unknown for unsupported equations with variables.",
    inputSchema: {
      type: "object",
      properties: { equation: { type: "string" } },
      required: ["equation"],
      additionalProperties: false,
    },
  },
  {
    type: "function",
    name: "board_write_equation",
    description: "Handwrite a corrected equation as readable lowercase and numeral pen strokes near the mistake, in free space. Use ^ for raised powers, _ for subscripts, and / for a stacked fraction; ∫, π, √ are supported. Use after verifying a numeric correction. Pass exact nearby stroke IDs. Leave narration empty if another action already spoke.",
    inputSchema: {
      type: "object",
      properties: {
        text: { type: "string", maxLength: 64 },
        nearStrokeIds: { type: "array", items: { type: "string" }, maxItems: 30 },
        size: { type: "number", minimum: 14, maximum: 34 },
        narration: { type: "string" },
      },
      required: ["text", "nearStrokeIds", "narration"],
      additionalProperties: false,
    },
  },
  {
    type: "function",
    name: "verify_math_step",
    description:
      "Deterministically verify whether one algebraic equation follows from another. Call this before marking an algebra step correct or incorrect.",
    inputSchema: {
      type: "object",
      properties: { from: { type: "string" }, to: { type: "string" } },
      required: ["from", "to"],
      additionalProperties: false,
    },
  },
  {
    type: "function",
    name: "board_feedback",
    description:
      "Place a concise visual mark on exact existing stroke IDs and optionally speak one short hint in English. Use uncertainty when recognition is weak.",
    inputSchema: {
      type: "object",
      properties: {
        verdict: { enum: ["correct", "potential_mistake", "uncertain"] },
        mark: { enum: ["underline", "highlight", "circle", "point"] },
        strokeIds: { type: "array", items: { type: "string" }, maxItems: 40 },
        speech: { type: "string" },
        hintLevel: { type: "integer", minimum: 0, maximum: 5 },
        confidence: { type: "number", minimum: 0, maximum: 1 },
      },
      required: ["verdict", "mark", "strokeIds", "speech", "hintLevel", "confidence"],
      additionalProperties: false,
    },
  },
  {
    type: "function",
    name: "board_draw",
    description:
      "Draw a semantic engineering template using locally generated pen trajectories. Write narration in English. Never invent raw point lists.",
    inputSchema: {
      type: "object",
      properties: {
        template: {
          enum: [
            "axes",
            "parabola",
            "force_diagram",
            "energy_bars",
            "projectile",
            "phasor",
            "series_circuit",
            "free_body",
          ],
        },
        anchor: {
          type: "object",
          properties: { x: { type: "number" }, y: { type: "number" } },
          required: ["x", "y"],
          additionalProperties: false,
        },
        scale: { type: "number", minimum: 0.25, maximum: 3 },
        labels: { type: "array", items: { type: "string" }, maxItems: 8 },
        narration: { type: "string" },
      },
      required: ["template", "anchor", "scale", "labels", "narration"],
      additionalProperties: false,
    },
  },
  {
    type: "function",
    name: "board_erase",
    description: "Erase only identified AI-created or obsolete feedback strokes. Write speech in English.",
    inputSchema: {
      type: "object",
      properties: {
        strokeIds: { type: "array", items: { type: "string" }, maxItems: 40 },
        speech: { type: "string" },
      },
      required: ["strokeIds", "speech"],
      additionalProperties: false,
    },
  },
  {
    type: "function",
    name: "board_say",
    description: "Speak a brief response in English without adding a visual mark.",
    inputSchema: {
      type: "object",
      properties: { speech: { type: "string" }, tone: { type: "string" } },
      required: ["speech", "tone"],
      additionalProperties: false,
    },
  },
];

import { verifyArithmeticEquation } from "./math-verifier.mjs";

