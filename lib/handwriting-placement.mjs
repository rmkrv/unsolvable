function right(box) { return box.x + box.width; }
function bottom(box) { return box.y + box.height; }

function overlaps(a, b, gap = 12) {
  return a.x < right(b) + gap && right(a) > b.x - gap &&
    a.y < bottom(b) + gap && bottom(a) > b.y - gap;
}

function inside(box, viewport, margin = 18) {
  return box.x >= viewport.x + margin && box.y >= viewport.y + margin &&
    right(box) <= right(viewport) - margin && bottom(box) <= bottom(viewport) - margin;
}

export function findFreeHandwritingAnchor({ target, occupied, viewport, width, height }) {
  const gap = Math.max(26, height);
  const focus = target ?? {
    x: viewport.x + 32,
    y: viewport.y + 32,
    width: 0,
    height: 0,
  };
  const candidates = [
    [right(focus) + gap, focus.y],
    [focus.x, bottom(focus) + gap],
    [focus.x, focus.y - height - gap],
    [focus.x - width - gap, focus.y],
  ];
  for (let ring = 1; ring <= 5; ring += 1) {
    candidates.push(
      [right(focus) + gap, focus.y + ring * (height + gap)],
      [focus.x, bottom(focus) + gap + ring * (height + gap)],
      [focus.x + ring * (width + gap), bottom(focus) + gap],
    );
  }
  for (const [x, y] of candidates) {
    const box = { x, y, width, height };
    if (inside(box, viewport) && !occupied.some((other) => overlaps(box, other))) return { x, y };
  }
  // The board is infinite. Prefer a clear position to writing over existing work.
  const furthest = Math.max(right(focus), ...occupied.map(right));
  return { x: furthest + gap, y: focus.y };
}
