// Small DOM helpers for the pixel-positioned skin UI.
export function el(tag, cls, parent, style) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (style) Object.assign(e.style, style);
  if (parent) parent.appendChild(e);
  return e;
}

export function box(parent, l, t, w, h, cls = '') {
  return el('div', 'sk ' + cls, parent, { left: l + 'px', top: t + 'px', width: w + 'px', height: h + 'px' });
}

export function canvasBox(parent, l, t, w, h, cls = '') {
  const c = el('canvas', 'sk ' + cls, parent, { left: l + 'px', top: t + 'px', width: w + 'px', height: h + 'px' });
  c._lw = w; c._lh = h;
  setCanvasRes(c, currentRes);
  return c;
}

// Canvases draw in skin pixels; their backing store is multiplied by the skin's
// render resolution so text and visualizers stay sharp when the player is scaled.
let currentRes = 1;
export function setCanvasRes(c, res) {
  c.width = Math.round(c._lw * res); c.height = Math.round(c._lh * res);
  const ctx = c.getContext('2d');
  ctx.setTransform(res, 0, 0, res, 0, 0);
  ctx.imageSmoothingEnabled = res > 1;
  c._last = null;
}
export function setAllCanvasRes(res) {
  currentRes = res;
  document.querySelectorAll('canvas.sk').forEach((c) => { if (c._lw) setCanvasRes(c, res); });
}

// Set a sprite on an element; caches to avoid needless style writes.
export function sprite(e, skin, sheet, x, y) {
  const key = `${skin.name}|${skin.res}|${skin.urls[sheet] ? skin.urls[sheet].length : 0}|${sheet}|${x}|${y}`;
  if (e._sk === key) return;
  e._sk = key;
  const url = skin.urls[sheet];
  e.style.backgroundImage = url ? `url(${url})` : 'none';
  e.style.backgroundPosition = `${-x}px ${-y}px`;
  const sz = skin.res !== 1 && skin.size && skin.size[sheet];
  e.style.backgroundSize = sz ? `${sz[0]}px ${sz[1]}px` : '';
}

// Button with pressed state. render(down) repaints; onClick fires on release inside.
export function pressable(e, { onClick, onRight, render }) {
  let down = false;
  const set = (v) => { down = v; e.classList.toggle('down', v); render && render(v); };
  e.classList.add('interactive');
  e.addEventListener('mousedown', (ev) => {
    if (ev.button !== 0) return;
    ev.stopPropagation(); ev.preventDefault();
    set(true);
    const up = (u) => {
      window.removeEventListener('mouseup', up);
      const inside = e.contains(document.elementFromPoint(u.clientX, u.clientY));
      set(false);
      if (inside && onClick) onClick(u);
    };
    window.addEventListener('mouseup', up);
  });
  if (onRight) e.addEventListener('contextmenu', (ev) => { ev.preventDefault(); ev.stopPropagation(); onRight(ev); });
  e._refresh = () => render && render(down);
  render && render(false);
  return { get down() { return down; }, refresh: () => render && render(down) };
}

// Map a mouse event to element-local logical pixels (works with CSS zoom).
export function localPoint(e, ev, logicalW, logicalH) {
  const r = e.getBoundingClientRect();
  return { x: ((ev.clientX - r.left) / r.width) * logicalW, y: ((ev.clientY - r.top) / r.height) * logicalH };
}

// Generic drag helper: onMove(ev) for each move, onEnd(ev) on release.
export function dragging(ev, onMove, onEnd) {
  ev.preventDefault(); ev.stopPropagation();
  const move = (m) => onMove(m);
  const up = (u) => { window.removeEventListener('mousemove', move); window.removeEventListener('mouseup', up); onEnd && onEnd(u); };
  window.addEventListener('mousemove', move);
  window.addEventListener('mouseup', up);
  onMove(ev);
}
