const TAU = Math.PI * 2;

export function snapLineEnd(start, end, step = Math.PI / 4) {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const length = Math.hypot(dx, dy);
  if (!length) return { ...end };
  const angle = Math.round(Math.atan2(dy, dx) / step) * step;
  return { x: start.x + Math.cos(angle) * length, y: start.y + Math.sin(angle) * length };
}

export function shapeBounds(start, end, constrain = false, fromCenter = false) {
  let dx = end.x - start.x;
  let dy = end.y - start.y;
  if (constrain) {
    const size = Math.max(Math.abs(dx), Math.abs(dy));
    dx = Math.sign(dx || 1) * size;
    dy = Math.sign(dy || 1) * size;
  }
  const opposite = fromCenter ? { x: start.x - dx, y: start.y - dy } : start;
  const corner = fromCenter ? { x: start.x + dx, y: start.y + dy } : { x: start.x + dx, y: start.y + dy };
  return {
    x: Math.min(opposite.x, corner.x),
    y: Math.min(opposite.y, corner.y),
    width: Math.abs(corner.x - opposite.x),
    height: Math.abs(corner.y - opposite.y),
  };
}

export function buildShapePaths(tool, start, end, options = {}) {
  const constrain = Boolean(options.constrain);
  const fromCenter = Boolean(options.fromCenter);
  if (tool === "line" || tool === "arrow") {
    const target = constrain ? snapLineEnd(start, end) : { ...end };
    const origin = fromCenter
      ? { x: start.x - (target.x - start.x), y: start.y - (target.y - start.y) }
      : { ...start };
    const line = [[origin, target]];
    if (tool === "line") return line;
    const angle = Math.atan2(target.y - origin.y, target.x - origin.x);
    const length = Math.hypot(target.x - origin.x, target.y - origin.y);
    const head = Math.max(8, Math.min(24, length * 0.28));
    return [
      line[0],
      [target, { x: target.x - Math.cos(angle - Math.PI / 6) * head, y: target.y - Math.sin(angle - Math.PI / 6) * head }],
      [target, { x: target.x - Math.cos(angle + Math.PI / 6) * head, y: target.y - Math.sin(angle + Math.PI / 6) * head }],
    ];
  }

  const bounds = shapeBounds(start, end, constrain, fromCenter);
  if (tool === "rectangle") {
    const right = bounds.x + bounds.width;
    const bottom = bounds.y + bounds.height;
    return [[
      { x: bounds.x, y: bounds.y },
      { x: right, y: bounds.y },
      { x: right, y: bottom },
      { x: bounds.x, y: bottom },
      { x: bounds.x, y: bounds.y },
    ]];
  }
  if (tool === "ellipse") {
    const cx = bounds.x + bounds.width / 2;
    const cy = bounds.y + bounds.height / 2;
    const rx = bounds.width / 2;
    const ry = bounds.height / 2;
    return [[...Array(49)].map((_, index) => {
      const angle = (index / 48) * TAU;
      return { x: cx + Math.cos(angle) * rx, y: cy + Math.sin(angle) * ry };
    })];
  }
  return [];
}

export function isEditableTarget(target) {
  return target instanceof Element && Boolean(target.closest("input, textarea, select, [contenteditable='true'], [contenteditable='']"));
}
