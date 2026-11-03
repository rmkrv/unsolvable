import { makeId, type Point, type Stroke } from "./board-model";
import { layoutHandwrittenMath } from "./handwritten-math.mjs";

type RawPoint = [number, number];

function point(x: number, y: number, index: number): Point {
  const wobble = Math.sin(index * 1.77) * 0.22;
  return { x: x + wobble, y: y + wobble * 0.55, pressure: 0.58 + Math.sin(index * 0.43) * 0.08, t: index * 12 };
}

function resample(points: RawPoint[], spacing = 5): Point[] {
  const result: Point[] = [];
  let index = 0;
  for (let segment = 1; segment < points.length; segment += 1) {
    const [ax, ay] = points[segment - 1];
    const [bx, by] = points[segment];
    const distance = Math.max(1, Math.hypot(bx - ax, by - ay));
    const steps = Math.max(2, Math.ceil(distance / spacing));
    for (let step = segment === 1 ? 0 : 1; step <= steps; step += 1) {
      const progress = step / steps;
      result.push(point(ax + (bx - ax) * progress, ay + (by - ay) * progress, index++));
    }
  }
  return result;
}

function stroke(raw: RawPoint[], semantic: string, color = "#3558d4", width = 3): Stroke {
  return {
    id: makeId("ai"),
    points: resample(raw),
    color,
    width,
    opacity: 1,
    kind: "pen",
    author: "ai",
    createdAt: Date.now(),
    semantic,
  };
}

function arrow(from: RawPoint, to: RawPoint, semantic: string, color?: string): Stroke[] {
  const angle = Math.atan2(to[1] - from[1], to[0] - from[0]);
  const size = 12;
  return [
    stroke([from, to], semantic, color),
    stroke(
      [
        [to[0] - Math.cos(angle - 0.55) * size, to[1] - Math.sin(angle - 0.55) * size],
        to,
        [to[0] - Math.cos(angle + 0.55) * size, to[1] - Math.sin(angle + 0.55) * size],
      ],
      `${semantic}:arrowhead`,
      color,
    ),
  ];
}

function circle(cx: number, cy: number, radius: number, semantic: string, color?: string) {
  return stroke(
    Array.from({ length: 33 }, (_, index) => {
      const angle = (index / 32) * Math.PI * 2;
      return [cx + Math.cos(angle) * radius, cy + Math.sin(angle) * radius] as RawPoint;
    }),
    semantic,
    color,
  );
}

function label(text: string, x: number, y: number, size: number, semantic: string, color?: string) {
  return layoutHandwrittenMath(text, size).paths.map((path) => stroke(
    path.points.map(([px, py]: [number, number]) => [x + px, y + py] as RawPoint),
    `${semantic}:label:${path.character}`,
    color,
    Math.max(2, size * 0.085),
  ));
}

export function measureHandwriting(text: string, size: number) {
  const { width, height } = layoutHandwrittenMath(text, size);
  return { width, height };
}

export function generateHandwriting(text: string, anchor: { x: number; y: number }, size = 26): Stroke[] {
  const { paths } = layoutHandwrittenMath(text, size);
  return paths.map((path, index) => stroke(
    path.points.map(([x, y]: [number, number]) => [anchor.x + x, anchor.y + y] as RawPoint),
    `equation:${text}:stroke:${index}:${path.character}`,
    "#3558d4",
    Math.max(2, size * 0.085),
  ));
}

export function generateTemplate(
  template: string,
  anchor: { x: number; y: number },
  scale = 1,
  labels: string[] = [],
): Stroke[] {
  const x = anchor.x;
  const y = anchor.y;
  const s = scale;
  const ink = "#3558d4";
  const result: Stroke[] = [];
  const addLabel = (text: string, lx: number, ly: number, size = 20, name = text) =>
    result.push(...label(text, lx, ly, size * s, `${template}:${name}`, ink));

  if (template === "axes" || template === "parabola") {
    result.push(...arrow([x - 130 * s, y], [x + 150 * s, y], `${template}:x-axis`, ink));
    result.push(...arrow([x, y + 115 * s], [x, y - 130 * s], `${template}:y-axis`, ink));
    addLabel(labels[0] || "x", x + 155 * s, y - 8 * s, 17, "x");
    addLabel(labels[1] || "y", x + 9 * s, y - 145 * s, 17, "y");
    if (template === "parabola") {
      result.push(
        stroke(
          Array.from({ length: 41 }, (_, index) => {
            const px = -105 + index * 5.25;
            return [x + px * s, y + (70 - (px * px) / 155) * s] as RawPoint;
          }),
          "parabola:curve",
          ink,
          3.2,
        ),
      );
    }
  } else if (template === "force_diagram" || template === "free_body") {
    const half = 34 * s;
    result.push(stroke([[x - half, y - half], [x + half, y - half], [x + half, y + half], [x - half, y + half], [x - half, y - half]], `${template}:body`, ink));
    result.push(...arrow([x, y - half], [x, y - 125 * s], `${template}:normal`, ink));
    result.push(...arrow([x, y + half], [x, y + 130 * s], `${template}:weight`, "#d9483b"));
    result.push(...arrow([x + half, y], [x + 135 * s, y], `${template}:applied`, ink));
    if (template === "free_body") result.push(...arrow([x - half, y], [x - 115 * s, y], `${template}:friction`, "#d98a2b"));
    addLabel(labels[0] || "N", x + 10 * s, y - 125 * s, 17, "normal");
    addLabel(labels[1] || "mg", x + 10 * s, y + 105 * s, 17, "weight");
    addLabel(labels[2] || "F", x + 105 * s, y - 24 * s, 17, "force");
  } else if (template === "projectile") {
    result.push(stroke([[x - 140 * s, y + 80 * s], [x + 155 * s, y + 80 * s]], "projectile:ground", ink));
    result.push(
      stroke(
        Array.from({ length: 35 }, (_, index) => {
          const px = index * 8.2;
          return [x - 120 * s + px * s, y + (58 - 1.15 * px + 0.0042 * px * px) * s] as RawPoint;
        }),
        "projectile:path",
        "#d98a2b",
        3,
      ),
    );
    result.push(circle(x - 120 * s, y + 58 * s, 8 * s, "projectile:object", ink));
    result.push(...arrow([x - 120 * s, y + 58 * s], [x - 38 * s, y - 20 * s], "projectile:velocity", ink));
    result.push(...arrow([x - 120 * s, y + 58 * s], [x - 38 * s, y + 58 * s], "projectile:v-x", "#15803d"));
    result.push(...arrow([x - 120 * s, y + 58 * s], [x - 120 * s, y - 20 * s], "projectile:v-y", "#d9483b"));
    addLabel(labels[0] || "V", x - 55 * s, y - 42 * s, 17, "velocity");
  } else if (template === "energy_bars") {
    result.push(stroke([[x - 120 * s, y + 80 * s], [x + 145 * s, y + 80 * s]], "energy:baseline", ink));
    const heights = [105, 55, 35];
    heights.forEach((height, index) => {
      const bx = x - 90 * s + index * 90 * s;
      result.push(stroke([[bx, y + 80 * s], [bx, y + (80 - height) * s], [bx + 42 * s, y + (80 - height) * s], [bx + 42 * s, y + 80 * s]], `energy:bar:${index}`, index === 0 ? "#3558d4" : "#d98a2b", 4));
      addLabel(labels[index] || ["PE", "KE", "Q"][index], bx + 4 * s, y + 91 * s, 14, `bar-${index}`);
    });
  } else if (template === "phasor") {
    result.push(...arrow([x - 125 * s, y], [x + 135 * s, y], "phasor:real-axis", ink));
    result.push(...arrow([x, y + 115 * s], [x, y - 125 * s], "phasor:imag-axis", ink));
    result.push(circle(x, y, 78 * s, "phasor:circle", "#93a3d8"));
    result.push(...arrow([x, y], [x + 66 * s, y - 52 * s], "phasor:vector", "#d9483b"));
    addLabel(labels[0] || "V", x + 72 * s, y - 65 * s, 17, "vector");
  } else if (template === "series_circuit") {
    result.push(stroke([[x - 135 * s, y - 75 * s], [x - 55 * s, y - 75 * s]], "circuit:wire-1", ink));
    result.push(stroke([[x + 55 * s, y - 75 * s], [x + 135 * s, y - 75 * s], [x + 135 * s, y + 75 * s], [x - 135 * s, y + 75 * s], [x - 135 * s, y + 12 * s]], "circuit:wire-2", ink));
    result.push(stroke([[x - 135 * s, y - 12 * s], [x - 135 * s, y - 75 * s]], "circuit:wire-3", ink));
    result.push(stroke([[x - 151 * s, y - 12 * s], [x - 119 * s, y - 12 * s]], "circuit:battery-long", ink));
    result.push(stroke([[x - 145 * s, y + 12 * s], [x - 125 * s, y + 12 * s]], "circuit:battery-short", ink));
    const zigzag: RawPoint[] = [[x - 55 * s, y - 75 * s]];
    for (let index = 1; index <= 8; index += 1) zigzag.push([x + (-55 + index * 13.75) * s, y + (-75 + (index % 2 ? -13 : 13)) * s]);
    zigzag.push([x + 55 * s, y - 75 * s]);
    result.push(stroke(zigzag, "circuit:resistor", "#d98a2b"));
    addLabel(labels[0] || "R", x - 8 * s, y - 115 * s, 17, "resistor");
    addLabel(labels[1] || "V", x - 115 * s, y - 4 * s, 17, "voltage");
  }
  return result;
}

export function generateFeedbackStroke(
  mark: string,
  bounds: { x: number; y: number; width: number; height: number },
  color: string,
): Stroke[] {
  if (mark === "circle") {
    return [circle(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2, Math.max(bounds.width, bounds.height) * 0.62 + 8, "feedback:circle", color)];
  }
  if (mark === "point") {
    return arrow([bounds.x - 48, bounds.y - 35], [bounds.x, bounds.y], "feedback:point", color);
  }
  const y = bounds.y + bounds.height + (mark === "highlight" ? 2 : 8);
  const output = stroke([[bounds.x - 2, y], [bounds.x + bounds.width + 2, y]], `feedback:${mark}`, color, mark === "highlight" ? 12 : 3.5);
  output.kind = "feedback";
  output.opacity = mark === "highlight" ? 0.28 : 1;
  return [output];
}

