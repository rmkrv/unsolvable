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
  if (tool === "board_write_text") {
    const text = typeof input.text === "string" ? input.text.trim() : "";
    if (!text || text.length > 48 || !/^[\x20-\x7E]+$/.test(text)) {
      throw new Error("Write one line of 1 to 48 printable ASCII characters.");
    }
    return {
      type: "text",
      text,
      anchor: {
        x: boundedNumber(input.anchor?.x, -20_000, 20_000, 640),
        y: boundedNumber(input.anchor?.y, -20_000, 20_000, 420),
      },
      size: boundedNumber(input.size, 14, 34, 22),
      narration: englishSpeech(input.narration),
    };
  }
  if (tool === "board_draw_arrow") {
    const from = input.from;
    const to = input.to;
    if (![from?.x, from?.y, to?.x, to?.y].every((value) => typeof value === "number" && Number.isFinite(value) && Math.abs(value) <= 20_000)) {
      throw new Error("Arrow endpoints must be finite board coordinates within ±20000.");
    }
    const length = Math.hypot(to.x - from.x, to.y - from.y);
    if (length < 12 || length > 1200) throw new Error("Arrow length must be between 12 and 1200 board units.");
    return { type: "arrow", from: { x: from.x, y: from.y }, to: { x: to.x, y: to.y }, narration: englishSpeech(input.narration) };
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
    name: "board_add_strokes",
    description: "Draw one or more freehand paths on an explicit page using world coordinates. Use observe_board first. Coordinates are board-world coordinates, not screenshot pixels.",
    inputSchema: {
      type: "object",
      properties: {
        pageId: { type: "string" },
        expectedVersion: { type: "integer", minimum: 0 },
        strokes: {
          type: "array",
          minItems: 1,
          maxItems: 40,
          items: {
            type: "object",
            properties: {
              points: {
                type: "array",
                minItems: 2,
                maxItems: 500,
                items: {
                  type: "object",
                  properties: { x: { type: "number" }, y: { type: "number" }, pressure: { type: "number", minimum: 0, maximum: 1 } },
                  required: ["x", "y"],
                  additionalProperties: false,
                },
              },
              color: { type: "string" },
              width: { type: "number", minimum: 0.5, maximum: 40 },
              opacity: { type: "number", minimum: 0, maximum: 1 },
              kind: { enum: ["pen", "highlighter"] },
            },
            required: ["points"],
            additionalProperties: false,
          },
        },
      },
      required: ["pageId", "strokes"],
      additionalProperties: false,
    },
  },
  {
    type: "function",
    name: "board_move_strokes",
    description: "Move identified editable strokes or groups on an explicit page by a world-coordinate delta. Use exact IDs from observe_board.",
    inputSchema: {
      type: "object",
      properties: {
        pageId: { type: "string" },
        strokeIds: { type: "array", items: { type: "string" }, minItems: 1, maxItems: 100 },
        dx: { type: "number" },
        dy: { type: "number" },
        expectedVersion: { type: "integer", minimum: 0 },
      },
      required: ["pageId", "strokeIds", "dx", "dy"],
      additionalProperties: false,
    },
  },
  {
    type: "function",
    name: "board_delete_strokes",
    description: "Delete identified editable strokes or their groups from an explicit page. This has the same content-editing authority as the delegating user, so use exact IDs and the fewest necessary deletions.",
    inputSchema: {
      type: "object",
      properties: {
        pageId: { type: "string" },
        strokeIds: { type: "array", items: { type: "string" }, minItems: 1, maxItems: 100 },
        expectedVersion: { type: "integer", minimum: 0 },
      },
      required: ["pageId", "strokeIds"],
      additionalProperties: false,
    },
  },
  {
    type: "function",
    name: "board_manage_page",
    description: "Create, rename, or delete a board page. Page deletion is rejected when it would remove the final page.",
    inputSchema: {
      type: "object",
      properties: {
        operation: { enum: ["create", "rename", "delete"] },
        pageId: { type: "string" },
        name: { type: "string", maxLength: 80 },
        afterPageId: { type: "string" },
        expectedVersion: { type: "integer", minimum: 0 },
      },
      required: ["operation", "pageId"],
      additionalProperties: false,
    },
  },
  {
    type: "function",
    name: "board_set_hint_level",
    description: "Set the shared tutoring hint level from 0 to 5.",
    inputSchema: {
      type: "object",
      properties: { level: { type: "integer", minimum: 0, maximum: 5 }, expectedVersion: { type: "integer", minimum: 0 } },
      required: ["level"],
      additionalProperties: false,
    },
  },
  {
    type: "function",
    name: "verify_arithmetic_equation",
    description: "Check a non-obvious numeric equation or simple polynomial definite integral. Do not call for basic arithmetic: reason directly, and board_write_equation independently rejects false corrections. Returns unknown for unsupported equations with variables.",
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
    description: "Handwrite a corrected equation as readable lowercase and numeral pen strokes near the mistake, in free space. The server validates numeric corrections and rejects false ones. Use ^ for raised powers, _ for subscripts, and / for a stacked fraction; ∫, π, √ are supported. Pass exact nearby stroke IDs. Leave narration empty if another action already spoke.",
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
    name: "board_write_text",
    description: "Write one short plain-text label at an explicit board coordinate as editable grouped pen strokes. Use for labels that do not belong to a fixed template. Printable ASCII only; no math layout. Leave narration empty if another action speaks.",
    inputSchema: {
      type: "object",
      properties: {
        text: { type: "string", minLength: 1, maxLength: 48 },
        anchor: {
          type: "object",
          properties: { x: { type: "number" }, y: { type: "number" } },
          required: ["x", "y"],
          additionalProperties: false,
        },
        size: { type: "number", minimum: 14, maximum: 34 },
        narration: { type: "string" },
      },
      required: ["text", "anchor", "narration"],
      additionalProperties: false,
    },
  },
  {
    type: "function",
    name: "board_draw_arrow",
    description: "Draw one editable arrow between explicit board coordinates. Use only when a fixed diagram template does not fit. The arrow is not attached to other objects. Leave narration empty if another action speaks.",
    inputSchema: {
      type: "object",
      properties: {
        from: { type: "object", properties: { x: { type: "number" }, y: { type: "number" } }, required: ["x", "y"], additionalProperties: false },
        to: { type: "object", properties: { x: { type: "number" }, y: { type: "number" } }, required: ["x", "y"], additionalProperties: false },
        narration: { type: "string" },
      },
      required: ["from", "to", "narration"],
      additionalProperties: false,
    },
  },
  {
    type: "function",
    name: "verify_math_step",
    description:
      "Deterministically verify whether one confidently transcribed, nontrivial algebraic equation follows from another. Call at most once for that transition. Do not use for simple arithmetic or when the source handwriting itself is ambiguous.",
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
    description: "Erase identified AI-created or obsolete feedback strokes. One stroke ID removes its entire grouped label or arrow. Write speech in English.",
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

