import { mkdirSync } from "node:fs";
import sharp from "sharp";
import { layoutHandwrittenMath } from "../lib/handwritten-math.mjs";

const rows = [
  { text: "1 + 1 = 2", x: 40, y: 38, size: 32 },
  { text: "F(x) = x^3/3 + x^2/2 - 2x + C", x: 40, y: 120, size: 30 },
  { text: "∫_0^2 (x^2 + x - 2) dx = 2/3", x: 40, y: 240, size: 30 },
];
const lines = rows.flatMap(({ text, x, y, size }) =>
  layoutHandwrittenMath(text, size).paths.map((path) =>
    `<polyline points="${path.points.map(([px, py]) => `${(x + px).toFixed(2)},${(y + py).toFixed(2)}`).join(" ")}" fill="none" stroke="#3558d4" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"/>`,
  ),
);
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1000" height="380" viewBox="0 0 1000 380"><rect width="1000" height="380" fill="#fbfaf6"/><defs><pattern id="grid" width="26" height="26" patternUnits="userSpaceOnUse"><path d="M 26 0 L 0 0 0 26" fill="none" stroke="#e4e0d6" stroke-width="1"/></pattern></defs><rect width="1000" height="380" fill="url(#grid)"/>${lines.join("")}</svg>`;
mkdirSync("outputs", { recursive: true });
await sharp(Buffer.from(svg)).png().toFile("outputs/handwriting-preview.png");
