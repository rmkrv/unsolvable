import font from "./handwriting-font-data.mjs";

// Hershey SCRIPT_SIMPLEX uses R as the origin. Its capitals and numerals span
// roughly y=-12..9; the lowercase x-height sits on the same baseline.
const EXTRA_GLYPHS = {
  "∫": { advance: 25, paths: [[[21, -21], [18, -23], [15, -23], [13, -20], [12, -16], [11, -9], [11, -2], [10, 6], [9, 13], [7, 19], [5, 22], [2, 23], [0, 21], [0, 19]]] },
  "π": { advance: 20, paths: [[[1, 0], [18, 0]], [[5, 0], [4, 9]], [[15, 0], [14, 6], [16, 9], [19, 8]]] },
  "√": { advance: 22, paths: [[[1, 3], [5, 8], [9, -1], [20, -1]]] },
  "*": { advance: 19, paths: [[[2, -8], [17, 8]], [[16, -8], [2, 8]]] },
};

function glyph(character) {
  return EXTRA_GLYPHS[character] ?? font[character] ?? null;
}

function splitExpression(text) {
  const parts = [];
  let term = "";
  let depth = 0;
  for (const character of text) {
    if (character === "(") depth += 1;
    if (character === ")") depth = Math.max(0, depth - 1);
    if (depth === 0 && "=+-".includes(character) && term.trim() && !term.trimEnd().endsWith("^")) {
      parts.push({ type: "term", value: term.trim() });
      parts.push({ type: "operator", value: character });
      term = "";
    } else term += character;
  }
  if (term.trim()) parts.push({ type: "term", value: term.trim() });
  return parts;
}

function fractionIndex(text) {
  let depth = 0;
  for (let index = 0; index < text.length; index += 1) {
    if (text[index] === "(") depth += 1;
    if (text[index] === ")") depth = Math.max(0, depth - 1);
    if (text[index] === "/" && depth === 0 && index > 0 && index < text.length - 1) return index;
  }
  return -1;
}

function layoutInline(text, size, top = 0) {
  const paths = [];
  let cursor = 0;
  for (let position = 0; position < text.length; position += 1) {
    const character = text[position];
    if (character === "∫") {
      const item = glyph(character);
      const unit = size / 21;
      for (const raw of item.paths) {
        paths.push({
          character,
          points: raw.map(([x, y]) => [cursor + x * unit, top + (y + 12) * unit]),
        });
      }
      const limits = /^_([A-Za-z0-9]+)\^([A-Za-z0-9]+)/.exec(text.slice(position + 1));
      if (limits) {
        const lower = layoutInline(limits[1], size * 0.48, top + size * 1.12);
        const upper = layoutInline(limits[2], size * 0.48, top - size * 0.54);
        for (const path of lower.paths) {
          paths.push({ ...path, points: path.points.map(([x, y]) => [x + cursor + size * 0.69, y]) });
        }
        for (const path of upper.paths) {
          paths.push({ ...path, points: path.points.map(([x, y]) => [x + cursor + size * 1.2, y]) });
        }
        cursor += Math.max(item.advance * unit, size * 1.2 + upper.width, size * 0.69 + lower.width) + size * 0.1;
        position += limits[0].length;
      } else cursor += item.advance * unit;
      continue;
    }
    if (character === "^" || character === "_") {
      const next = text[position + 1];
      if (!next) continue;
      let exponent = "";
      if (next === "(") {
        const end = text.indexOf(")", position + 2);
        if (end > position) {
          exponent = text.slice(position + 2, end);
          position = end;
        }
      }
      if (!exponent) {
        let end = position + 1;
        while (end < text.length && /[A-Za-z0-9]/.test(text[end])) end += 1;
        exponent = text.slice(position + 1, end);
        position = end - 1;
      }
      if (exponent) {
        const raised = layoutInline(exponent, size * 0.58, top + (character === "^" ? -size * 0.46 : size * 0.53));
        for (const path of raised.paths) paths.push({ ...path, points: path.points.map(([x, y]) => [x + cursor, y]) });
        cursor += raised.width + size * 0.04;
      }
      continue;
    }
    const item = glyph(character);
    if (!item) continue;
    const unit = size / 21;
    const drift = Math.sin((position + 1) * 2.31) * size * 0.012;
    for (const raw of item.paths) {
      paths.push({
        character,
        points: raw.map(([x, y]) => [cursor + x * unit, top + (y + 12) * unit + drift]),
      });
    }
    cursor += item.advance * unit + (character === " " ? 0 : size * 0.025);
  }
  return { paths, width: cursor };
}

function layoutTerm(text, size) {
  const slash = fractionIndex(text);
  if (slash < 0) return layoutInline(text, size);
  const numerator = layoutInline(text.slice(0, slash), size * 0.7, -size * 0.38);
  const denominator = layoutInline(text.slice(slash + 1), size * 0.7, size * 0.6);
  const width = Math.max(numerator.width, denominator.width) + size * 0.25;
  const paths = [
    ...numerator.paths.map((path) => ({ ...path, points: path.points.map(([x, y]) => [x + (width - numerator.width) / 2, y]) })),
    { character: "fraction bar", points: [[0, size * 0.51], [width, size * 0.51]] },
    ...denominator.paths.map((path) => ({ ...path, points: path.points.map(([x, y]) => [x + (width - denominator.width) / 2, y]) })),
  ];
  return { paths, width };
}

export function layoutHandwrittenMath(text, size = 26) {
  const paths = [];
  let cursor = 0;
  for (const part of splitExpression(text)) {
    const layout = part.type === "operator" ? layoutInline(part.value, size) : layoutTerm(part.value, size);
    if (part.type === "operator") cursor += size * 0.22;
    for (const path of layout.paths) paths.push({ ...path, points: path.points.map(([x, y]) => [x + cursor, y]) });
    cursor += layout.width + (part.type === "operator" ? size * 0.22 : 0);
  }
  if (!paths.length) return { paths: [], width: 0, height: 0 };
  const ys = paths.flatMap((path) => path.points.map((point) => point[1]));
  const top = Math.min(...ys);
  const bottom = Math.max(...ys);
  return {
    paths: paths.map((path) => ({ ...path, points: path.points.map(([x, y]) => [x, y - top]) })),
    width: cursor,
    height: bottom - top,
  };
}
