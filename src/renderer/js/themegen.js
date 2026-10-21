// Theme generator: turns a small "recipe" of design choices into a complete
// skin (all sprite sheets + colours), drawn at any resolution.
import { GLYPHS, FONT_LOOKUP, pixelTextWidth } from './font.js';

// ---------------------------------------------------------------- colour utils
const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
export function hexToRgb(h) {
  h = String(h || '#000').replace('#', '');
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  const n = parseInt(h.slice(0, 6), 16) || 0;
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
export const rgbToHex = (r, g, b) => '#' + [r, g, b].map((v) => Math.round(clamp(v, 0, 255)).toString(16).padStart(2, '0')).join('');
export function rgbToHsl(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2;
  if (mx === mn) return [0, 0, l];
  const d = mx - mn, s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn);
  let h = mx === r ? (g - b) / d + (g < b ? 6 : 0) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [h * 60, s, l];
}
export function hslToHex(h, s, l) {
  h = ((h % 360) + 360) % 360; s = clamp(s); l = clamp(l);
  const c = (1 - Math.abs(2 * l - 1)) * s, x = c * (1 - Math.abs(((h / 60) % 2) - 1)), m = l - c / 2;
  const [r, g, b] = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
  return rgbToHex((r + m) * 255, (g + m) * 255, (b + m) * 255);
}
export const hsl = (hex) => rgbToHsl(...hexToRgb(hex));
export function mix(a, b, t) { const A = hexToRgb(a), B = hexToRgb(b); return rgbToHex(...A.map((v, i) => v + (B[i] - v) * t)); }
export const lighten = (hex, amt) => { const [h, s, l] = hsl(hex); return hslToHex(h, s, l + amt); };
export const alpha = (hex, a) => { const [r, g, b] = hexToRgb(hex); return `rgba(${r},${g},${b},${a})`; };
export function luminance(hex) {
  const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
  const [r, g, b] = hexToRgb(hex); return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}
export const contrast = (a, b) => { const x = luminance(a), y = luminance(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
// Nudge a foreground colour until it reads clearly on the background.
function readable(fg, bg, min = 3) {
  let c = fg, i = 0;
  const dir = luminance(bg) < 0.3 ? 0.05 : -0.05;
  while (contrast(c, bg) < min && i++ < 14) c = lighten(c, dir);
  return c;
}

// ---------------------------------------------------------------- recipes
export const DISPLAYS = {
  match: { name: 'Match accent' }, lcd: { name: 'Green LCD', fg: '#8dff6a' }, vfd: { name: 'Blue VFD', fg: '#4fe3ff' },
  amber: { name: 'Amber', fg: '#ffb547' }, oled: { name: 'White OLED', fg: '#eef2fa' }, red: { name: 'Red LED', fg: '#ff4a4a' },
};
export const MATERIALS = { flat: 'Flat', metal: 'Brushed metal', chrome: 'Chrome', wood: 'Wood', carbon: 'Carbon fiber', leather: 'Leather', glass: 'Frosted glass' };

const BASE = { version: 1, author: '', base: '#1c1f29', accent: '#2de2c5', accent2: '#ffb547', display: 'match', material: 'flat', bevel: 1, roundness: 0, glow: 0.3, texture: 0.5, buttons: 'square', labels: 'pixel', titleText: 'WAVEDECK', bg: null };
export const PRESETS = [
  { ...BASE, id: 'midnight', name: 'Midnight' },
  { ...BASE, id: 'steel', name: 'Brushed Steel', base: '#7e858f', accent: '#3fa9ff', accent2: '#ff6a3d', display: 'vfd', material: 'metal', bevel: 2, roundness: 1, glow: 0.45, texture: 0.75, buttons: 'rounded', labels: 'modern' },
  { ...BASE, id: 'chrome', name: 'Y2K Chrome', base: '#aeb8cc', accent: '#6a5cff', accent2: '#ff4fd8', display: 'oled', material: 'chrome', bevel: 2, roundness: 3, glow: 0.5, texture: 0.6, buttons: 'pill', labels: 'modern' },
  { ...BASE, id: 'synthwave', name: 'Synthwave', base: '#1d1033', accent: '#ff2e97', accent2: '#29e7ff', display: 'match', material: 'flat', bevel: 1, roundness: 2, glow: 1, buttons: 'rounded', labels: 'pixel' },
  { ...BASE, id: 'walnut', name: 'Walnut Hi-Fi', base: '#5e3b23', accent: '#ffb547', accent2: '#ff7a3d', display: 'amber', material: 'wood', bevel: 2, roundness: 1, glow: 0.6, texture: 0.85, buttons: 'rounded', labels: 'modern' },
  { ...BASE, id: 'paper', name: 'Paper Minimal', base: '#e8e5de', accent: '#1f6feb', accent2: '#e5484d', display: 'oled', material: 'flat', bevel: 0, roundness: 3, glow: 0, texture: 0.2, buttons: 'rounded', labels: 'modern' },
  { ...BASE, id: 'cassette', name: 'Cassette', base: '#eadcbc', accent: '#f26b1d', accent2: '#2a6f97', display: 'amber', material: 'leather', bevel: 1, roundness: 2, glow: 0.3, texture: 0.45, buttons: 'square', labels: 'pixel' },
  { ...BASE, id: 'carbon', name: 'Carbon Racing', base: '#17191d', accent: '#e10600', accent2: '#ffd400', display: 'red', material: 'carbon', bevel: 1, roundness: 1, glow: 0.7, texture: 0.8, buttons: 'rounded', labels: 'modern' },
];
export const DEFAULT_RECIPE = { ...PRESETS[0], name: 'Wavedeck Midnight', author: 'Wavedeck' };
export function normalizeRecipe(r) {
  const out = { ...BASE, ...(r || {}) };
  out.bevel = clamp(+out.bevel || 0, 0, 3); out.roundness = clamp(+out.roundness || 0, 0, 4);
  out.glow = clamp(+out.glow || 0); out.texture = clamp(+out.texture || 0);
  if (!DISPLAYS[out.display]) out.display = 'match';
  if (!MATERIALS[out.material]) out.material = 'flat';
  if (!['square', 'rounded', 'pill'].includes(out.buttons)) out.buttons = 'square';
  if (!['pixel', 'modern'].includes(out.labels)) out.labels = 'pixel';
  out.titleText = String(out.titleText || 'WAVEDECK').toUpperCase().slice(0, 16);
  return out;
}

// ---------------------------------------------------------------- design tokens
export function tokens(r) {
  const base = r.base, dark = luminance(base) < 0.2;
  const L = (amt) => lighten(base, dark ? amt : -amt * 0.9);
  const acc = r.accent;
  const dispFg = r.display === 'match' ? (hsl(acc)[2] < 0.45 ? lighten(acc, 0.2) : acc) : DISPLAYS[r.display].fg;
  const dispBg = mix(mix(base, '#05060a', dark ? 0.72 : 0.9), dispFg, 0.035);
  const btn = dark ? lighten(base, 0.06) : lighten(base, 0.05);
  const label = readable(mix(base, dark ? '#ffffff' : '#000000', dark ? 0.42 : 0.5), base, 2.6);
  const labelHi = readable(mix(base, dark ? '#ffffff' : '#000000', dark ? 0.8 : 0.82), base, 5);
  return {
    dark, base, acc, acc2: r.accent2 || mix(acc, '#ffb547', 0.6),
    frameHi: dark ? lighten(base, 0.11) : lighten(base, 0.12), frameLo: dark ? lighten(base, -0.11) : lighten(base, -0.28),
    faceTop: L(0.035), faceBot: L(-0.03),
    titleA: [L(0.085), L(-0.02)], titleI: [L(0.03), L(-0.035)],
    dispBg, dispFg, dispDim: alpha(dispFg, 0.09), dispLine: mix(dispBg, dispFg, 0.08),
    well: dispBg,
    btn, btnHi: lighten(btn, dark ? 0.12 : 0.1), btnLo: lighten(btn, dark ? -0.14 : -0.3), btnDown: lighten(btn, -0.04),
    label, labelHi, icon: labelHi, iconDown: readable(acc, btn, 2.5),
    led: acc, ledOff: mix(btn, dark ? '#000000' : '#888888', 0.35),
  };
}

// ---------------------------------------------------------------- drawing kit
function seeded(seed) { let a = seed >>> 0; return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

class Kit {
  constructor(recipe, res, bgCanvas) {
    this.r = recipe; this.T = tokens(recipe); this.res = res; this.bg = bgCanvas;
  }
  sheet(w, h) {
    const c = document.createElement('canvas');
    c.width = Math.round(w * this.res); c.height = Math.round(h * this.res);
    const x = c.getContext('2d'); x.setTransform(this.res, 0, 0, this.res, 0, 0); x.imageSmoothingEnabled = true;
    this.x = x; this.rand = seeded(w * 131 + h * 7);
    return c;
  }
  rect(c, l, t, w, h) { const x = this.x; x.fillStyle = c; x.fillRect(l, t, w, h); }
  grad(l, t, w, h, stops, horizontal) {
    const x = this.x; const g = horizontal ? x.createLinearGradient(l, 0, l + w, 0) : x.createLinearGradient(0, t, 0, t + h);
    stops.forEach(([o, c]) => g.addColorStop(o, c)); x.fillStyle = g; x.fillRect(l, t, w, h);
  }
  rr(l, t, w, h, rad) { const x = this.x; x.beginPath(); if (rad > 0) x.roundRect(l, t, w, h, Math.min(rad, w / 2, h / 2)); else x.rect(l, t, w, h); }
  // Material fill for frames and panels.
  material(l, t, w, h, { shade = 0 } = {}) {
    const { T, r } = this, x = this.x, k = r.texture;
    const top = shade ? lighten(T.faceTop, shade) : T.faceTop, bot = shade ? lighten(T.faceBot, shade) : T.faceBot;
    switch (r.material) {
      case 'metal': {
        this.grad(l, t, w, h, [[0, lighten(top, 0.04)], [0.5, top], [1, bot]]);
        for (let y = t; y < t + h; y += 0.5) {
          const v = this.rand();
          x.fillStyle = v > 0.5 ? `rgba(255,255,255,${0.05 * k * (v - 0.5) * 2})` : `rgba(0,0,0,${0.08 * k * (0.5 - v) * 2})`;
          x.fillRect(l, y, w, 0.5);
        }
        break;
      }
      case 'chrome':
        this.grad(l, t, w, h, [[0, lighten(top, 0.28 * k + 0.08)], [0.42, lighten(top, 0.04)], [0.5, lighten(bot, -0.12 * k - 0.04)], [0.75, bot], [1, lighten(bot, 0.12 * k)]]);
        break;
      case 'wood': {
        const [hh, ss, ll] = hsl(top);
        for (let y = t; y < t + h; y += 0.5) {
          const g = Math.sin(y * 0.9 + Math.sin(y * 0.13) * 3) * 0.5 + Math.sin(y * 2.7) * 0.2 + (this.rand() - 0.5) * 0.25;
          x.fillStyle = hslToHex(hh, ss, ll + g * 0.06 * k);
          x.fillRect(l, y, w, 0.5);
        }
        this.grad(l, t, w, h, [[0, 'rgba(255,255,255,0.05)'], [1, 'rgba(0,0,0,0.12)']]);
        break;
      }
      case 'carbon': {
        this.rect(bot, l, t, w, h);
        const a = lighten(bot, 0.05 * k + 0.01), b = lighten(bot, -0.03 * k);
        for (let yy = 0; yy < h; yy += 2) for (let xx = 0; xx < w; xx += 2) {
          const odd = ((Math.floor((l + xx) / 2) + Math.floor((t + yy) / 2)) & 1);
          this.grad(l + xx, t + yy, 2, 2, odd ? [[0, a], [1, b]] : [[0, b], [1, a]], !odd);
        }
        this.grad(l, t, w, h, [[0, 'rgba(255,255,255,0.06)'], [0.5, 'rgba(255,255,255,0)'], [1, 'rgba(0,0,0,0.15)']]);
        break;
      }
      case 'leather':
        this.grad(l, t, w, h, [[0, top], [1, bot]]);
        for (let i = 0; i < w * h * 0.35; i++) {
          const v = this.rand();
          x.fillStyle = v > 0.5 ? `rgba(255,255,255,${0.07 * k})` : `rgba(0,0,0,${0.12 * k})`;
          x.fillRect(l + this.rand() * w, t + this.rand() * h, 0.6, 0.6);
        }
        break;
      case 'glass':
        this.grad(l, t, w, h, [[0, alpha(lighten(top, 0.08), 0.62)], [0.5, alpha(top, 0.5)], [1, alpha(bot, 0.66)]]);
        this.grad(l, t, w, Math.min(6, h), [[0, 'rgba(255,255,255,0.16)'], [1, 'rgba(255,255,255,0)']]);
        break;
      default:
        this.grad(l, t, w, h, [[0, top], [1, bot]]);
    }
  }
  // Window face: material, or the background photo when one is set.
  face(l, t, w, h, region) {
    if (this.bg && region !== undefined) {
      const x = this.x, R = this.res;
      x.drawImage(this.bg, l * R, (t + region) * R, w * R, h * R, l, t, w, h);
      if (this.r.material === 'glass') this.material(l, t, w, h);
      return;
    }
    this.material(l, t, w, h);
  }
  edges(l, t, w, h, inset) {
    const { T } = this, d = inset ? 1 : this.r.bevel;
    for (let i = 0; i < d; i++) {
      const a = 0.9 - i * 0.3;
      this.rect(alpha(inset ? T.frameLo : T.frameHi, a), l + i, t + i, w - i * 2, 1); this.rect(alpha(inset ? T.frameLo : T.frameHi, a), l + i, t + i, 1, h - i * 2);
      this.rect(alpha(inset ? T.frameHi : T.frameLo, a), l + i, t + h - 1 - i, w - i * 2, 1); this.rect(alpha(inset ? T.frameHi : T.frameLo, a), l + w - 1 - i, t + i, 1, h - i * 2);
    }
  }
  frame(l, t, w, h, region) { this.face(l, t, w, h, region); this.edges(l, t, w, h); }
  // Display well (screen recess)
  well(l, t, w, h, { fill, opacity } = {}) {
    const { T } = this, x = this.x, rad = this.r.roundness * 0.75;
    const op = opacity ?? (this.bg ? 0.9 : 1);
    x.save();
    this.rr(l, t, w, h, rad); x.globalAlpha = op; x.fillStyle = fill || T.well; x.fill(); x.globalAlpha = 1;
    x.clip();
    this.grad(l, t, w, Math.min(4, h), [[0, 'rgba(0,0,0,0.35)'], [1, 'rgba(0,0,0,0)']]);
    x.restore();
    this.rr(l + 0.5, t + 0.5, w - 1, h - 1, rad); x.lineWidth = 1; x.strokeStyle = alpha(T.frameLo, 0.9); x.stroke();
    if (T.dark || this.r.bevel) { x.beginPath(); x.moveTo(l + rad, t + h - 0.5 + 1); x.lineTo(l + w - rad, t + h - 0.5 + 1); x.strokeStyle = alpha(T.frameHi, 0.55); x.stroke(); }
  }
  button(l, t, w, h, down, { fill } = {}) {
    const { T, r } = this, x = this.x;
    const rad = r.buttons === 'pill' ? h / 2 : r.buttons === 'rounded' ? 1.5 + r.roundness * 0.8 : r.roundness * 0.4;
    const base = fill || T.btn;
    x.save();
    this.rr(l + 0.5, t + 0.5, w - 1, h - 1, rad); x.clip();
    const glossy = r.material === 'chrome' || r.material === 'glass';
    if (down) this.grad(l, t, w, h, [[0, lighten(base, -0.08)], [1, lighten(base, -0.02)]]);
    else if (glossy) this.grad(l, t, w, h, [[0, lighten(base, 0.22)], [0.48, lighten(base, 0.04)], [0.52, lighten(base, -0.06)], [1, lighten(base, 0.06)]]);
    else if (r.material === 'metal') { this.grad(l, t, w, h, [[0, lighten(base, 0.08)], [1, lighten(base, -0.04)]]); for (let y = t; y < t + h; y += 0.5) { x.fillStyle = `rgba(255,255,255,${this.rand() * 0.05 * r.texture})`; x.fillRect(l, y, w, 0.5); } }
    else this.grad(l, t, w, h, [[0, lighten(base, 0.04)], [1, lighten(base, -0.03)]]);
    if (!down && r.bevel > 0) this.grad(l, t, w, Math.max(2, h / 2), [[0, 'rgba(255,255,255,0.10)'], [1, 'rgba(255,255,255,0)']]);
    if (down) this.grad(l, t, w, 3, [[0, 'rgba(0,0,0,0.3)'], [1, 'rgba(0,0,0,0)']]);
    x.restore();
    this.rr(l + 0.5, t + 0.5, w - 1, h - 1, rad);
    x.lineWidth = 1; x.strokeStyle = down ? alpha(T.btnLo, 1) : alpha(T.btnLo, 0.95); x.stroke();
    if (!down && r.bevel > 0) {
      x.save(); this.rr(l + 1.5, t + 1.5, w - 3, h - 3, Math.max(0, rad - 1)); x.strokeStyle = alpha(T.btnHi, 0.35 + r.bevel * 0.12); x.lineWidth = 0.6; x.stroke(); x.restore();
    }
  }
  glowOn(color, amount) {
    const g = this.r.glow * (amount ?? 1);
    if (g <= 0) return;
    this.x.shadowColor = color; this.x.shadowBlur = g * 3.5 * this.res;
  }
  glowOff() { this.x.shadowBlur = 0; this.x.shadowColor = 'transparent'; }
  // Labels: pixel font, or a clean sans-serif when labels === 'modern'
  text(str, l, t, color, { center, right, spacing = 1, size = 1 } = {}) {
    const x = this.x;
    str = String(str).toUpperCase();
    if (this.r.labels === 'modern') {
      x.save();
      x.font = `700 ${6.6 * size}px "Segoe UI", "Helvetica Neue", Arial, sans-serif`;
      try { x.letterSpacing = `${0.35 * spacing}px`; } catch { /* older canvas */ }
      x.textBaseline = 'alphabetic'; x.fillStyle = color;
      const w = x.measureText(str).width;
      let lx = l;
      if (center !== undefined) lx = l + (center - w) / 2;
      if (right) lx = l - w;
      x.fillText(str, lx, t + 5 * size);
      x.restore();
      return w;
    }
    const w = pixelTextWidth(str, spacing) * size;
    let lx = l;
    if (center !== undefined) lx = l + Math.floor((center - w) / 2);
    if (right) lx = l - w;
    x.fillStyle = color;
    let cx = lx;
    for (const ch of str) {
      const g = GLYPHS[ch] || GLYPHS[' '];
      for (let rr = 0; rr < 5; rr++) for (let c = 0; c < 3; c++) if (g[rr][c] === '#') x.fillRect(cx + c * size, t + rr * size, size, size);
      cx += (3 + spacing) * size;
    }
    return w;
  }
  icon(kind, cx, cy, color, s = 1) {
    const x = this.x;
    x.save(); x.translate(cx, cy); x.scale(s, s); x.fillStyle = color;
    const tri = (l, t, h, dir = 1) => { x.beginPath(); x.moveTo(l, t); x.lineTo(l + dir * Math.ceil(h / 2), t + h / 2); x.lineTo(l, t + h); x.closePath(); x.fill(); };
    switch (kind) {
      case 'play': tri(-2.5, -4.5, 9); break;
      case 'pause': x.fillRect(-3, -4, 2, 8); x.fillRect(1, -4, 2, 8); break;
      case 'stop': x.fillRect(-3.5, -3.5, 7, 7); break;
      case 'prev': x.fillRect(-4.5, -3.5, 2, 7); tri(2.5, -3.5, 7, -1); break;
      case 'next': tri(-2.5, -3.5, 7); x.fillRect(2.5, -3.5, 2, 7); break;
      case 'eject': x.beginPath(); x.moveTo(-3.5, 0.5); x.lineTo(0, -4); x.lineTo(3.5, 0.5); x.closePath(); x.fill(); x.fillRect(-3.5, 1.5, 7, 2); break;
      case 'x': x.lineWidth = 1.2; x.strokeStyle = color; x.beginPath(); x.moveTo(-2.2, -2.2); x.lineTo(2.2, 2.2); x.moveTo(2.2, -2.2); x.lineTo(-2.2, 2.2); x.stroke(); break;
      case 'min': x.fillRect(-2.5, 1, 5, 1.2); break;
      case 'shade': x.fillRect(-2.5, -2, 5, 1.1); x.fillRect(-2.5, 1, 5, 1.1); break;
      case 'menu': x.fillRect(-2.5, -2.4, 5, 1); x.fillRect(-2.5, -0.5, 5, 1); x.fillRect(-2.5, 1.4, 5, 1); break;
      default:
    }
    x.restore();
  }
  grooves(l, t, w) {
    const { T } = this;
    for (let i = 0; i < w; i += 2) { this.rect(alpha(T.frameHi, 0.8), l + i, t, 1, 1); this.rect(alpha(T.frameLo, 0.9), l + i + 1, t + 1, 1, 1); }
  }
  titleBar(l, t, w, active, label, { dot = true } = {}) {
    const { T } = this;
    if (this.bg && this.r.material !== 'glass') { this.material(l, t, w, 14); this.rect(alpha(T.base, 0.25), l, t, w, 14); }
    else this.material(l, t, w, 14);
    this.grad(l, t, w, 14, (active ? T.titleA : T.titleI).map((c, i) => [i, alpha(c, 0.55)]));
    this.rect(alpha(active ? T.frameHi : T.frameHi, active ? 0.9 : 0.5), l, t, w, 1);
    this.rect(T.frameLo, l, t + 13, w, 1);
    if (!label) return;
    const tw = this.r.labels === 'modern' ? this.measure(label, 2) : pixelTextWidth(label, 2);
    const tx = l + Math.floor((w - tw) / 2);
    for (let g = 0; g < 3; g++) { this.grooves(l + 18, t + 4 + g * 2, tx - l - 24); this.grooves(tx + tw + 6, t + 4 + g * 2, l + w - 30 - (tx + tw + 6)); }
    if (active && dot) { this.glowOn(T.acc2, 0.8); this.rect(T.acc2, tx - 6, t + 6, 2, 2); this.glowOff(); }
    this.text(label, tx, t + 4, active ? T.labelHi : T.label, { spacing: 2 });
  }
  measure(str, spacing = 1) {
    const x = this.x; x.save(); x.font = '700 6.6px "Segoe UI", "Helvetica Neue", Arial, sans-serif';
    try { x.letterSpacing = `${0.35 * spacing}px`; } catch { /* */ }
    const w = x.measureText(String(str).toUpperCase()).width; x.restore(); return w;
  }
  led(cx, cy, on) {
    const { T } = this;
    if (on) { this.glowOn(T.led, 1.2); this.rect(T.led, cx - 1.5, cy - 1.5, 3, 3); this.glowOff(); this.rect(alpha('#ffffff', 0.45), cx - 1.5, cy - 1.5, 1, 1); }
    else this.rect(T.ledOff, cx - 1.5, cy - 1.5, 3, 3);
  }
  toggle(l, t, w, h, label, on, down) {
    const { T } = this;
    this.button(l, t, w, h, down);
    const o = down ? 0.5 : 0;
    this.led(l + 5 + o, t + h / 2 + o, on);
    this.text(label, l + 9 + o, t + Math.floor((h - 5) / 2) + o, on ? T.labelHi : T.label);
  }
  thumb(l, t, w, h, down, vertical) {
    const { T } = this;
    this.button(l, t, w, h, down, { fill: down ? mix(T.btn, T.acc, 0.35) : T.btn });
    this.glowOn(T.acc, 0.6);
    if (vertical) this.rect(down ? '#ffffff' : T.acc, l + 3, t + h / 2 - 0.5, w - 6, 1.2);
    else this.rect(down ? '#ffffff' : T.acc, l + w / 2 - 1, t + 3, 2, h - 6);
    this.glowOff();
  }
}

// ---------------------------------------------------------------- sheets
const SEG = { a: [2, 1, 5, 1], b: [7, 2, 1, 4], c: [7, 7, 1, 4], d: [2, 11, 5, 1], e: [1, 7, 1, 4], f: [1, 2, 1, 4], g: [2, 6, 5, 1] };
const DIGITS = ['abcdef', 'bc', 'abged', 'abgcd', 'fgbc', 'afgcd', 'afgedc', 'abc', 'abcdefg', 'abcdfg'];
const LOGO_W = ['#...#', '#...#', '#.#.#', '#.#.#', '.#.#.'];

function mainSheet(K) {
  const { T } = K; const c = K.sheet(275, 116);
  K.frame(0, 0, 275, 116, 0);
  // display
  K.well(8, 19, 97, 47);
  K.x.save(); K.rr(9, 20, 95, 45, K.r.roundness * 0.75); K.x.clip();
  for (let y = 21; y < 64; y += 2) K.rect(alpha(T.dispFg, 0.018), 9, y, 95, 1);
  K.x.restore();
  K.glowOn(T.dispFg); K.rect(T.dispFg, 72, 29, 2, 2); K.rect(T.dispFg, 72, 34, 2, 2); K.glowOff();
  K.well(108, 22, 160, 12);
  K.well(109, 40, 19, 10); K.text('KBPS', 130, 43, T.label);
  K.well(154, 40, 14, 10); K.text('KHZ', 170, 43, T.label);
  K.well(210, 39, 59, 16);
  K.well(15, 71, 250, 12);
  K.rect(alpha(T.frameLo, 0.6), 8, 85, 259, 1); K.rect(alpha(T.frameHi, 0.4), 8, 86, 259, 1);
  // logo badge
  K.button(251, 89, 17, 19, false);
  K.glowOn(T.acc2, 0.7);
  const title = K.r.titleText;
  if (title === 'WAVEDECK') LOGO_W.forEach((row, r) => [...row].forEach((ch, cc) => { if (ch === '#') K.rect(T.acc2, 254 + cc * 2, 94 + r * 2, 2, 2); }));
  else { const g = GLYPHS[title[0]] || GLYPHS.W; g.forEach((row, r) => [...row].forEach((ch, cc) => { if (ch === '#') K.rect(T.acc2, 256 + cc * 2, 94 + r * 2, 2, 2); })); }
  K.glowOff();
  K.text('VOL', 108, 52, T.label); K.text('BAL', 178, 52, T.label);
  return c;
}

function titlebarSheet(K) {
  const { T } = K; const c = K.sheet(344, 87);
  K.titleBar(27, 0, 275, true, K.r.titleText); K.titleBar(27, 15, 275, false, K.r.titleText);
  K.titleBar(27, 57, 275, true, K.r.titleText); K.titleBar(27, 72, 275, false, K.r.titleText);
  for (const [top, active] of [[29, true], [42, false]]) { K.titleBar(27, top, 275, active, null); K.well(27 + 78, top + 2, 98, 10, { opacity: 1 }); }
  const wbtn = (l, t, down, kind) => { K.button(l, t, 9, 9, down); K.icon(kind, l + 4.5, t + 4.5, down ? T.iconDown : T.icon); };
  wbtn(0, 0, false, 'menu'); wbtn(0, 9, true, 'menu'); wbtn(9, 0, false, 'min'); wbtn(9, 9, true, 'min');
  wbtn(18, 0, false, 'x'); wbtn(18, 9, true, 'x'); wbtn(0, 18, false, 'shade'); wbtn(9, 18, true, 'shade');
  wbtn(0, 27, false, 'shade'); wbtn(9, 27, true, 'shade');
  K.rect(T.dispBg, 0, 36, 17, 7); K.rect(T.acc, 17, 36, 3, 7); K.rect(T.acc, 20, 36, 3, 7); K.rect(T.acc, 23, 36, 3, 7);
  const letters = [['O', 3], ['A', 11], ['I', 18], ['D', 25], ['V', 33]];
  for (const l of [304, 312]) { K.rect(T.dispBg, l, 0, 8, 43); K.edges(l, 0, 8, 43, true); letters.forEach(([ch, t]) => K.text(ch, l + 2.5, t + 1, T.label)); }
  const sel = [[304, 47, 8, 'O'], [312, 55, 7, 'A'], [320, 62, 7, 'I'], [328, 69, 8, 'D'], [336, 77, 7, 'V']];
  for (const [l, t, h, ch] of sel) { K.rect(T.dispBg, l, t, 8, h); K.glowOn(T.acc2); K.text(ch, l + 2.5, t + 1, T.acc2); K.glowOff(); }
  return c;
}

function cbuttonsSheet(K) {
  const { T } = K; const c = K.sheet(136, 36);
  const kinds = [['prev', 0, 23], ['play', 23, 23], ['pause', 46, 23], ['stop', 69, 23], ['next', 92, 22]];
  for (const [k, l, w] of kinds) for (const down of [false, true]) {
    const t = down ? 18 : 0;
    K.button(l, t, w, 18, down);
    if (down) K.glowOn(T.iconDown, 0.8);
    K.icon(k, l + w / 2 + (down ? 0.5 : 0), t + 9 + (down ? 0.5 : 0), down ? T.iconDown : T.icon);
    K.glowOff();
  }
  for (const down of [false, true]) { const t = down ? 16 : 0; K.button(114, t, 22, 16, down); K.icon('eject', 125 + (down ? 0.5 : 0), t + 8, down ? T.iconDown : T.acc2); }
  return c;
}

function numbersSheet(K, ex) {
  const { T } = K; const c = K.sheet(ex ? 108 : 99, 13);
  K.rect(T.dispBg, 0, 0, ex ? 108 : 99, 13);
  const dig = (l, segs) => { for (const [k, [sx, sy, w, h]] of Object.entries(SEG)) { if (segs.includes(k)) continue; K.rect(T.dispDim, l + sx, sy, w, h); } K.glowOn(T.dispFg); for (const [k, [sx, sy, w, h]] of Object.entries(SEG)) if (segs.includes(k)) K.rect(T.dispFg, l + sx, sy, w, h); K.glowOff(); };
  DIGITS.forEach((s, i) => dig(i * 9, s)); dig(90, ''); if (ex) dig(99, 'g');
  return c;
}

function textSheet(K) {
  const { T } = K; const c = K.sheet(155, 18);
  K.rect(T.dispBg, 0, 0, 155, 18);
  K.glowOn(T.dispFg, 0.6);
  for (const [ch, [row, col]] of Object.entries(FONT_LOOKUP)) {
    const g = GLYPHS[ch.toUpperCase()] || GLYPHS[ch]; if (!g) continue;
    K.x.fillStyle = T.dispFg;
    for (let r = 0; r < 5; r++) for (let k = 0; k < 3; k++) if (g[r][k] === '#') K.x.fillRect(col * 5 + 1 + k, row * 6 + r, 1, 1);
  }
  K.glowOff();
  return c;
}

function posbarSheet(K) {
  const { T } = K; const c = K.sheet(307, 10);
  K.rect(T.dispBg, 0, 0, 248, 10);
  K.rect(T.dispLine, 2, 4, 244, 2); K.rect(alpha('#000000', 0.5), 2, 4, 244, 1);
  K.thumb(248, 0, 29, 10, false); K.thumb(278, 0, 29, 10, true);
  return c;
}

function volumeSheet(K) {
  const { T } = K; const c = K.sheet(68, 433);
  for (let i = 0; i < 28; i++) {
    const t = i * 15;
    K.rect(T.dispBg, 0, t, 68, 13);
    K.rect(T.dispLine, 2, t + 5, 64, 3);
    K.glowOn(T.acc, 0.5); K.rect(mix(T.acc, T.acc2, i / 27), 2, t + 5, Math.round((64 * i) / 27), 3); K.glowOff();
  }
  K.thumb(0, 422, 14, 11, true); K.thumb(15, 422, 14, 11, false);
  return c;
}

function balanceSheet(K) {
  const { T } = K; const c = K.sheet(47, 433);
  for (let i = 0; i < 28; i++) {
    const t = i * 15;
    K.rect(T.dispBg, 9, t, 38, 13);
    K.rect(T.dispLine, 11, t + 5, 34, 3);
    const half = Math.round((i / 27) * 16), col = mix(T.acc, T.acc2, i / 27);
    K.glowOn(col, 0.5); K.rect(col, 28 - half, t + 5, half, 3); K.rect(col, 28, t + 5, half, 3); K.glowOff();
    K.rect(T.labelHi, 27.5, t + 4, 1, 5);
  }
  K.thumb(0, 422, 14, 11, true); K.thumb(15, 422, 14, 11, false);
  return c;
}

function shufrepSheet(K) {
  const c = K.sheet(92, 85);
  [[0, false, false], [15, false, true], [30, true, false], [45, true, true]].forEach(([t, on, down]) => {
    K.toggle(0, t, 28, 15, 'REP', on, down); K.toggle(28, t, 47, 15, 'SHUFFLE', on, down);
  });
  [[61, false], [73, true]].forEach(([t, on]) => {
    K.toggle(0, t, 23, 12, 'EQ', on, false); K.toggle(46, t, 23, 12, 'EQ', on, true);
    K.toggle(23, t, 23, 12, 'PL', on, false); K.toggle(69, t, 23, 12, 'PL', on, true);
  });
  return c;
}

function monosterSheet(K) {
  const { T } = K; const c = K.sheet(56, 24);
  const lbl = (l, t, w, s, on) => { K.rect(T.dispBg, l, t, w, 12); if (on) K.glowOn(T.acc2, 0.8); K.text(s, l, t + 3.5, on ? T.acc2 : mix(T.dispBg, T.label, 0.35), { center: w }); K.glowOff(); };
  lbl(0, 0, 29, 'STEREO', true); lbl(0, 12, 29, 'STEREO', false); lbl(29, 0, 27, 'MONO', true); lbl(29, 12, 27, 'MONO', false);
  return c;
}

function playpausSheet(K) {
  const { T } = K; const c = K.sheet(42, 9);
  K.rect(T.dispBg, 0, 0, 42, 9);
  K.glowOn(T.dispFg); K.icon('play', 4.5, 4.5, T.dispFg, 0.85); K.glowOff();
  K.glowOn(T.acc2); K.rect(T.acc2, 10, 1, 2, 7); K.rect(T.acc2, 14, 1, 2, 7); K.glowOff();
  K.rect('#ff5d6c', 20, 2, 5, 5);
  K.rect(T.dispBg, 36, 0, 3, 9); K.rect(T.dispFg, 39, 2, 2, 5);
  return c;
}

function pleditSheet(K) {
  const { T } = K; const c = K.sheet(280, 186);
  const top = (t, active) => {
    for (const [l, w] of [[0, 25], [26, 100], [127, 25], [153, 25]]) K.titleBar(l, t, w, active, null);
    K.grad(0, t + 14, 178, 6, [[0, alpha(T.faceTop, 1)], [1, alpha(T.faceBot, 1)]]);
    for (const [l, w] of [[0, 25], [26, 100], [127, 25], [153, 25]]) K.material(l, t + 14, w, 6);
    for (let i = 0; i < 3; i++) { K.grooves(127, t + 7 + i * 2, 25); K.grooves(12, t + 7 + i * 2, 13); K.grooves(153, t + 7 + i * 2, 10); }
    K.rect(T.base, 26, t + 3, 100, 12);
    K.material(26, t + 3, 100, 12);
    K.text('PLAYLIST', 26, t + 7, active ? T.labelHi : T.label, { center: 100, spacing: 1 });
    K.button(153 + 14, t + 3, 9, 9, false); K.icon('x', 153 + 18.5, t + 7.5, T.icon);
    K.rect(T.frameLo, 12, t + 19, 13, 1); K.rect(T.frameLo, 127, t + 19, 25, 1); K.rect(T.frameLo, 153, t + 19, 5, 1);
  };
  top(0, true); top(21, false);
  K.material(0, 42, 12, 29); K.rect(alpha(T.frameHi, 0.8), 0, 42, 1, 29); K.rect(T.frameLo, 11, 42, 1, 29);
  K.material(31, 42, 20, 29); K.rect(T.frameLo, 31, 42, 1, 29); K.rect(T.frameLo, 50, 42, 1, 29);
  K.rect(T.dispBg, 31 + 6, 42, 8, 29);
  K.thumb(52, 53, 8, 18, false, true); K.thumb(61, 53, 8, 18, true, true);
  K.button(52, 42, 9, 9, true); K.icon('x', 56.5, 46.5, T.iconDown);
  K.button(62, 42, 9, 9, true); K.icon('shade', 66.5, 46.5, T.iconDown);
  K.button(150, 42, 9, 9, true); K.icon('shade', 154.5, 46.5, T.iconDown);
  for (const [l, t, w] of [[72, 57, 25], [72, 42, 25], [99, 57, 50], [99, 42, 50]]) K.titleBar(l, t, w, true, null);
  const bottomBg = (l, t, w) => { K.material(l, t, w, 38); K.rect(T.frameLo, l, t + 37, w, 1); K.rect(T.frameLo, l, t, w, 1); };
  bottomBg(179, 0, 25);
  bottomBg(0, 72, 125); K.rect(alpha(T.frameHi, 0.8), 0, 72, 1, 38);
  ['ADD', 'REM', 'SEL', 'MISC'].forEach((s, i) => { const l = 14 + i * 29; K.button(l, 80, 22, 18, false); K.text(s, l, 87, T.labelHi, { center: 22 }); });
  bottomBg(126, 72, 150); K.rect(T.frameLo, 275, 72, 1, 38);
  const br = 126;
  K.well(br + 6, 80, 72, 12, { opacity: 1 });
  K.well(br + 2, 93, 64, 12, { opacity: 1 });
  ['prev', 'play', 'pause', 'stop', 'next', 'eject'].forEach((k, i) => K.icon(k, br + 3 + i * 10 + 5, 99, T.label, 0.6));
  K.well(br + 64, 93, 34, 12, { opacity: 1 });
  K.button(br + 106, 80, 22, 18, false); K.text('LIST', br + 106, 87, T.labelHi, { center: 22 });
  for (let i = 0; i < 4; i++) K.rect(alpha(T.frameHi, 0.9), br + 140 - i * 3, 105, 1, 1);
  K.material(205, 0, 75, 38); K.well(207, 11, 71, 20, { opacity: 1 });
  const menus = [[0, 'URL', 'DIR', 'FILE'], [54, 'ALL', 'CROP', 'SEL', 'MISC'], [104, 'INV', 'NONE', 'ALL'], [154, 'SORT', 'INFO', 'OPTS'], [204, 'NEW', 'SAVE', 'LOAD']];
  for (const [l, ...labels] of menus) labels.forEach((s, i) => {
    K.button(l, 111 + i * 19, 22, 18, false); K.text(s, l, 111 + i * 19 + 7, T.labelHi, { center: 22 });
    K.button(l + 23, 111 + i * 19, 22, 18, true); K.text(s, l + 23, 111 + i * 19 + 7, T.iconDown, { center: 22 });
  });
  return c;
}

function eqmainSheet(K) {
  const { T } = K; const c = K.sheet(275, 315);
  K.frame(0, 0, 275, 116, 116);
  K.well(84, 15, 117, 23);
  K.text('+12', 48, 38, T.label); K.text('0', 52, 66, T.label); K.text('-12', 48, 97, T.label);
  K.well(19, 37, 18, 66);
  for (let i = 0; i < 10; i++) K.well(76 + i * 18, 37, 18, 66);
  K.text('PRE', 19, 106, T.label, { center: 18 });
  ['60', '170', '310', '600', '1K', '3K', '6K', '12K', '14K', '16K'].forEach((s, i) => K.text(s, 76 + i * 18, 106, T.label, { center: 18 }));
  for (const [t, active] of [[134, true], [149, false]]) {
    K.titleBar(0, t, 275, active, 'EQUALIZER', { dot: false });
    K.button(264, t + 3, 9, 9, false); K.icon('x', 268.5, t + 7.5, T.icon);
  }
  K.button(0, 116, 9, 9, false); K.icon('x', 4.5, 120.5, T.icon);
  K.button(0, 125, 9, 9, true); K.icon('x', 4.5, 129.5, T.iconDown);
  K.toggle(10, 119, 26, 12, 'ON', false, false); K.toggle(128, 119, 26, 12, 'ON', false, true);
  K.toggle(69, 119, 26, 12, 'ON', true, false); K.toggle(187, 119, 26, 12, 'ON', true, true);
  K.toggle(36, 119, 32, 12, 'AUTO', false, false); K.toggle(154, 119, 32, 12, 'AUTO', false, true);
  K.toggle(95, 119, 32, 12, 'AUTO', true, false); K.toggle(213, 119, 32, 12, 'AUTO', true, true);
  for (let i = 0; i < 28; i++) {
    const l = 13 + (i % 14) * 15, t = 164 + Math.floor(i / 14) * 65;
    K.rect(T.dispBg, l, t, 14, 63);
    K.rect(T.dispLine, l + 6, t + 2, 2, 59);
    for (let y = t + 4; y < t + 61; y += 4) K.rect(alpha(T.dispFg, 0.08), l + 3, y, 8, 1);
    const level = i / 27, fillTop = t + 2 + Math.round((1 - level) * 52) + 5, mid = t + 32;
    const col = mix(T.acc, T.acc2, Math.abs(level - 0.5) * 2);
    K.glowOn(col, 0.5);
    if (fillTop < mid) K.rect(col, l + 6, fillTop, 2, mid - fillTop); else K.rect(col, l + 6, mid, 2, Math.max(1, fillTop - mid));
    K.glowOff();
  }
  K.thumb(0, 164, 11, 11, false, true); K.thumb(0, 176, 11, 11, true, true);
  K.button(224, 164, 44, 12, false); K.text('PRESETS', 224, 167.5, T.labelHi, { center: 44 });
  K.button(224, 176, 44, 12, true); K.text('PRESETS', 224.5, 180, T.iconDown, { center: 44 });
  K.rect(T.dispBg, 0, 294, 113, 19);
  for (let l = 0; l < 113; l += 4) K.rect(alpha(T.dispFg, 0.07), l, 303, 2, 1);
  for (let i = 0; i < 19; i++) K.rect(mix(T.acc2, T.acc, i / 18), 115, 294 + i, 1, 1);
  for (let l = 0; l < 113; l += 2) K.rect(alpha(T.label, 0.8), l, 314, 1, 1);
  return c;
}

// ---------------------------------------------------------------- colours for vis, playlist, library
export function themeColors(r) {
  const T = tokens(r);
  const vis = [
    T.dispBg, mix(T.dispBg, T.dispFg, 0.1),
    ...Array.from({ length: 16 }, (_, i) => mix(T.acc2, T.acc, i / 15)),
    mix(T.dispFg, '#ffffff', 0.6), mix(T.dispFg, '#ffffff', 0.3), T.dispFg, mix(T.dispFg, T.dispBg, 0.3), mix(T.dispFg, T.dispBg, 0.55),
    mix(T.labelHi, '#ffffff', 0.5),
  ];
  const pledit = {
    normal: readable(mix(T.dispFg, T.dark ? '#c9d1e6' : '#c9d1e6', 0.55), T.dispBg, 4.5),
    current: readable(T.acc, T.dispBg, 4.5),
    normalbg: T.dispBg,
    selectedbg: mix(T.dispBg, T.acc, 0.22),
    font: r.labels === 'modern' ? 'Segoe UI' : 'Tahoma',
  };
  const lb = T.dark ? lighten(T.base, -0.05) : lighten(T.base, 0.02);
  const accentInk = luminance(T.acc) > 0.35 ? '#0a0a0a' : '#ffffff';
  const libraryCss = `:root{--bg:${T.dark ? lighten(T.base, -0.06) : lighten(T.base, 0.03)};--panel:${lb};--panel2:${T.dark ? lighten(T.base, 0.03) : lighten(T.base, -0.03)};--line:${T.dark ? lighten(T.base, 0.08) : lighten(T.base, -0.1)};--hover:${T.dark ? lighten(T.base, 0.05) : lighten(T.base, -0.05)};--text:${T.labelHi};--muted:${T.label};--faint:${mix(T.label, T.base, 0.4)};--accent:${T.acc};--accent-ink:${accentInk};--amber:${T.acc2};}`;
  return { vis, pledit, libraryCss, tokens: T };
}

// ---------------------------------------------------------------- build
async function loadImage(src) {
  return new Promise((resolve) => { const i = new Image(); i.onload = () => resolve(i); i.onerror = () => resolve(null); i.src = src; });
}
// Background photo, cover-fitted across main + EQ (275x232), blurred/dimmed, at device resolution.
function prepareBg(img, r, res) {
  const W = 275 * res, H = 232 * res;
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const x = c.getContext('2d');
  const s = Math.max(W / img.width, H / img.height);
  const dw = img.width * s, dh = img.height * s;
  const blur = (r.bg.blur || 0) * 6 * res;
  x.filter = blur ? `blur(${blur}px)` : 'none';
  const pad = blur * 2;
  x.drawImage(img, (W - dw) / 2 - pad, (H - dh) / 2 - pad, dw + pad * 2, dh + pad * 2);
  x.filter = 'none';
  x.fillStyle = alpha(r.base, clamp(r.bg.dim ?? 0.35));
  x.fillRect(0, 0, W, H);
  return c;
}

export function buildSheetsSync(recipe, res = 1, bgCanvas = null) {
  const K = new Kit(recipe, res, bgCanvas);
  return {
    main: mainSheet(K), titlebar: titlebarSheet(K), cbuttons: cbuttonsSheet(K), numbers: numbersSheet(K, false), nums_ex: numbersSheet(K, true),
    text: textSheet(K), posbar: posbarSheet(K), volume: volumeSheet(K), balance: balanceSheet(K), shufrep: shufrepSheet(K),
    monoster: monosterSheet(K), playpaus: playpausSheet(K), pledit: pleditSheet(K), eqmain: eqmainSheet(K),
  };
}

export async function buildTheme(recipeIn, res = 1) {
  const recipe = normalizeRecipe(recipeIn);
  let bgCanvas = null;
  if (recipe.bg && recipe.bg.src) { const img = await loadImage(recipe.bg.src); if (img) bgCanvas = prepareBg(img, recipe, res); }
  const sheets = buildSheetsSync(recipe, res, bgCanvas);
  return { recipe, sheets, ...themeColors(recipe) };
}

// Quick main-window-only preview for galleries.
export function previewMain(recipeIn, res = 1) {
  const r = normalizeRecipe({ ...recipeIn, bg: null });
  const K = new Kit(r, res, null);
  const c = mainSheet(K);
  const tb = titlebarSheet(K);
  const cb = cbuttonsSheet(K);
  const x = c.getContext('2d'); x.setTransform(1, 0, 0, 1, 0, 0);
  x.drawImage(tb, 27 * res, 0, 275 * res, 14 * res, 0, 0, 275 * res, 14 * res);
  [0, 23, 46, 69, 92].forEach((sx, i) => x.drawImage(cb, sx * res, 0, (i === 4 ? 22 : 23) * res, 18 * res, (16 + sx) * res, 88 * res, (i === 4 ? 22 : 23) * res, 18 * res));
  return c;
}

// ---------------------------------------------------------------- palette from an image
export function paletteFromImage(img) {
  const N = 64, c = document.createElement('canvas'); c.width = N; c.height = N;
  const x = c.getContext('2d'); x.drawImage(img, 0, 0, N, N);
  const d = x.getImageData(0, 0, N, N).data;
  const buckets = new Map();
  for (let i = 0; i < d.length; i += 4) {
    const [h, s, l] = rgbToHsl(d[i], d[i + 1], d[i + 2]);
    const key = `${Math.round(h / 24)}|${Math.round(s * 3)}|${Math.round(l * 4)}`;
    const b = buckets.get(key) || { n: 0, r: 0, g: 0, b: 0 };
    b.n++; b.r += d[i]; b.g += d[i + 1]; b.b += d[i + 2]; buckets.set(key, b);
  }
  const cols = [...buckets.values()].map((b) => { const hex = rgbToHex(b.r / b.n, b.g / b.n, b.b / b.n); const [h, s, l] = hsl(hex); return { hex, n: b.n, h, s, l }; });
  const dark = cols.filter((c) => c.l < 0.4).sort((a, b) => b.n - a.n)[0] || cols.sort((a, b) => a.l - b.l)[0];
  const scoreAcc = (c) => c.n * Math.pow(c.s, 2) * (1 - Math.abs(c.l - 0.58) * 1.6);
  const vivid = cols.filter((c) => c.s > 0.3 && c.l > 0.3 && c.l < 0.85).sort((a, b) => scoreAcc(b) - scoreAcc(a));
  const accent = vivid[0] ? vivid[0].hex : '#2de2c5';
  const ah = hsl(accent)[0];
  const second = vivid.find((c) => Math.min(Math.abs(c.h - ah), 360 - Math.abs(c.h - ah)) > 35);
  const [bh, bs] = hsl(dark ? dark.hex : '#1c1f29');
  return {
    base: hslToHex(bh, Math.min(bs, 0.35), 0.13),
    accent: hslToHex(hsl(accent)[0], Math.max(hsl(accent)[1], 0.6), clamp(hsl(accent)[2], 0.5, 0.68)),
    accent2: second ? hslToHex(second.h, Math.max(second.s, 0.6), clamp(second.l, 0.5, 0.7)) : hslToHex(ah + 150, 0.75, 0.62),
  };
}

// ---------------------------------------------------------------- "describe it" (keyword based)
const WORDS = {
  colors: {
    red: '#e5484d', crimson: '#d6213a', scarlet: '#ff3b30', orange: '#f26b1d', amber: '#ffb547', gold: '#e8b54a', golden: '#e8b54a', yellow: '#ffd400',
    lime: '#a3e635', green: '#2ecc71', emerald: '#10b981', mint: '#5eead4', teal: '#2de2c5', cyan: '#29e7ff', aqua: '#29e7ff', turquoise: '#22d3c5',
    blue: '#3fa9ff', azure: '#4aa8ff', navy: '#3b5bdb', indigo: '#6366f1', purple: '#8b5cf6', violet: '#8b5cf6', lavender: '#b4a2ff', magenta: '#ff2bd6',
    pink: '#ff4f9a', rose: '#ff6b8b', coral: '#ff7a59', peach: '#ffad85', white: '#eef2fa', silver: '#c3cad6', copper: '#d97a45', bronze: '#c98a4b',
  },
  styles: {
    neon: 'synthwave', synthwave: 'synthwave', vaporwave: 'synthwave', outrun: 'synthwave', cyberpunk: 'synthwave', '80s': 'synthwave', miami: 'synthwave', arcade: 'synthwave',
    wood: 'walnut', wooden: 'walnut', walnut: 'walnut', oak: 'walnut', teak: 'walnut', '70s': 'walnut', hifi: 'walnut', 'hi-fi': 'walnut', stereo: 'walnut', vintage: 'walnut', cabin: 'walnut',
    chrome: 'chrome', y2k: 'chrome', '2000s': 'chrome', futuristic: 'chrome', space: 'chrome', shiny: 'chrome',
    steel: 'steel', metal: 'steel', metallic: 'steel', industrial: 'steel', aluminum: 'steel', aluminium: 'steel', brushed: 'steel',
    minimal: 'paper', minimalist: 'paper', clean: 'paper', paper: 'paper', light: 'paper', bright: 'paper', simple: 'paper',
    cassette: 'cassette', tape: 'cassette', retro: 'cassette', walkman: 'cassette', boombox: 'cassette',
    carbon: 'carbon', racing: 'carbon', sport: 'carbon', sporty: 'carbon', f1: 'carbon', car: 'carbon',
    dark: 'midnight', night: 'midnight', midnight: 'midnight',
  },
  moods: {
    ocean: { accent: '#29b6f6', accent2: '#5eead4', base: '#0e1e2e' }, sea: { accent: '#29b6f6', base: '#0e1e2e' }, rain: { accent: '#7cc4ff', accent2: '#c3cad6', base: '#141c26' }, rainy: { accent: '#7cc4ff', base: '#141c26' },
    forest: { accent: '#7ccf5a', accent2: '#e8b54a', base: '#18241a' }, jungle: { accent: '#3ddc84', base: '#132017' }, moss: { accent: '#9ccf5a', base: '#1d2618' },
    sunset: { accent: '#ff7a59', accent2: '#ff4f9a', base: '#2a1626' }, fire: { accent: '#ff5a1f', accent2: '#ffd400', base: '#1f0e0a' }, lava: { accent: '#ff4a1c', accent2: '#ffb547', base: '#1a0b08' },
    ice: { accent: '#7fe7ff', accent2: '#c3cad6', base: '#cfdbe6', material: 'glass' }, frost: { accent: '#7fe7ff', base: '#cfdbe6', material: 'glass' }, winter: { accent: '#7fe7ff', base: '#d9e2ea' },
    luxury: { accent: '#e8b54a', accent2: '#f5e6c4', base: '#0d0d0f', material: 'metal' }, royal: { accent: '#e8b54a', accent2: '#8b5cf6', base: '#1a1033' },
    matrix: { accent: '#3dff6e', accent2: '#a3ff7a', base: '#050805', display: 'lcd' }, hacker: { accent: '#3dff6e', base: '#050805', display: 'lcd' }, terminal: { accent: '#3dff6e', base: '#0a0d0a', display: 'lcd' },
    coffee: { accent: '#d9a066', accent2: '#f5e6c4', base: '#2b1d14', material: 'leather' }, chocolate: { accent: '#d9a066', base: '#2a1a12' },
    candy: { accent: '#ff7ac8', accent2: '#7ad7ff', base: '#f4e8f2' }, pastel: { accent: '#b4a2ff', accent2: '#ffad85', base: '#efe9f4' },
    tokyo: { accent: '#ff3d8b', accent2: '#4fe3ff', base: '#141024' }, galaxy: { accent: '#b26bff', accent2: '#4fe3ff', base: '#0b0a1a' }, cosmic: { accent: '#b26bff', accent2: '#ff4fd8', base: '#0b0a1a' },
    desert: { accent: '#e8a35a', accent2: '#c2553a', base: '#3b2a1c' }, military: { accent: '#c9b458', base: '#2b2f22', material: 'leather' }, army: { accent: '#c9b458', base: '#2b2f22' },
    glass: { material: 'glass' }, frosted: { material: 'glass' }, leather: { material: 'leather' }, glossy: { material: 'chrome' }, matte: { material: 'flat' },
    round: { roundness: 4, buttons: 'pill' }, rounded: { roundness: 3, buttons: 'rounded' }, soft: { roundness: 3, buttons: 'rounded', bevel: 1 }, sharp: { roundness: 0, buttons: 'square' }, boxy: { roundness: 0, buttons: 'square' },
    glow: { glow: 1 }, glowing: { glow: 1 }, bold: { bevel: 3 }, flat: { bevel: 0, material: 'flat' }, pixel: { labels: 'pixel' }, modern: { labels: 'modern' },
  },
};
export function describe(text, current) {
  const words = String(text).toLowerCase().replace(/[^a-z0-9\s-]/g, ' ').split(/\s+/).filter(Boolean);
  let r = { ...current }, understood = [], colorsSeen = [];
  // style first so colours/moods can refine it
  for (const w of words) if (WORDS.styles[w]) { const p = PRESETS.find((x) => x.id === WORDS.styles[w]); r = { ...r, ...p, name: r.name, author: r.author, titleText: r.titleText, bg: r.bg }; understood.push(w); }
  for (const w of words) if (WORDS.moods[w]) { r = { ...r, ...WORDS.moods[w] }; understood.push(w); }
  for (const w of words) if (WORDS.colors[w]) { colorsSeen.push(WORDS.colors[w]); understood.push(w); }
  if (colorsSeen[0]) r.accent = colorsSeen[0];
  if (colorsSeen[1]) r.accent2 = colorsSeen[1];
  if (words.includes('black')) { r.base = '#0c0c0e'; understood.push('black'); }
  if (words.includes('white') && !colorsSeen.length) { r.base = '#ecebe7'; }
  return { recipe: normalizeRecipe(r), understood: [...new Set(understood)] };
}

// ---------------------------------------------------------------- surprise me
export function surprise(current) {
  const rnd = Math.random;
  const p = PRESETS[Math.floor(rnd() * PRESETS.length)];
  const hue = rnd() * 360;
  const darkBase = rnd() < 0.72;
  const base = p.material === 'wood' ? hslToHex(20 + rnd() * 18, 0.45, 0.22 + rnd() * 0.08) : darkBase ? hslToHex(hue + 180 + rnd() * 60, 0.15 + rnd() * 0.25, 0.08 + rnd() * 0.08) : hslToHex(hue, 0.1 + rnd() * 0.2, 0.82 + rnd() * 0.08);
  const accent = hslToHex(hue, 0.75 + rnd() * 0.2, 0.55 + rnd() * 0.1);
  const accent2 = hslToHex(hue + (rnd() < 0.5 ? 150 : 40) + rnd() * 40, 0.8, 0.6);
  const display = ['match', 'match', 'lcd', 'vfd', 'amber', 'oled', 'red'][Math.floor(rnd() * 7)];
  return normalizeRecipe({
    ...p, name: current.name, author: current.author, titleText: current.titleText, bg: current.bg,
    base, accent, accent2, display,
    bevel: Math.floor(rnd() * 3), roundness: Math.floor(rnd() * 5), glow: Math.round(rnd() * 10) / 10,
    buttons: ['square', 'rounded', 'pill'][Math.floor(rnd() * 3)], labels: rnd() < 0.5 ? 'pixel' : 'modern',
  });
}
