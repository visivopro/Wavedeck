// Classic in-window visualizer (spectrum analyser / oscilloscope) plus a
// registry so plugins can add their own modes.

export const visModes = [
  { id: 'spectrum', name: 'Spectrum analyzer', draw: drawSpectrum },
  { id: 'oscilloscope', name: 'Oscilloscope', draw: drawOscilloscope },
  { id: 'off', name: 'Off', draw: null },
];
export function registerVisMode(mode) { visModes.splice(visModes.length - 1, 0, mode); }

const peaks = new Float32Array(64);
const peakVel = new Float32Array(64);
const levels = new Float32Array(64);

function background(ctx, colors, w, h) {
  ctx.fillStyle = colors[0];
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = colors[1];
  for (let y = 1; y < h; y += 2) for (let x = 1; x < w; x += 2) ctx.fillRect(x, y, 1, 1);
}

function drawSpectrum(ctx, engine, colors, w, h) {
  background(ctx, colors, w, h);
  const data = engine.spectrum();
  if (!data) return;
  const bars = Math.floor((w + 1) / 4);
  const sr = engine.ctx.sampleRate;
  const binHz = sr / 2 / data.length;
  const fMin = 40, fMax = 17000;
  for (let i = 0; i < bars; i++) {
    const f0 = fMin * Math.pow(fMax / fMin, i / bars);
    const f1 = fMin * Math.pow(fMax / fMin, (i + 1) / bars);
    let b0 = Math.floor(f0 / binHz), b1 = Math.max(b0 + 1, Math.floor(f1 / binHz));
    let m = 0;
    for (let b = b0; b < b1 && b < data.length; b++) m = Math.max(m, data[b]);
    const tilt = 0.8 + 0.5 * (i / bars); // lift the treble a little like the original
    const v = Math.min(h, Math.max(0, ((m / 255) * tilt * 1.15 - 0.12) * h * 1.12));
    // fall-off
    levels[i] = v > levels[i] ? v : Math.max(v, levels[i] - 1.1);
    if (levels[i] >= peaks[i]) { peaks[i] = levels[i]; peakVel[i] = 0; }
    else { peakVel[i] += 0.035; peaks[i] = Math.max(0, peaks[i] - peakVel[i]); }
    const x = i * 4;
    const height = Math.round(levels[i]);
    for (let y = 0; y < height; y++) {
      const row = h - 1 - y;
      ctx.fillStyle = colors[2 + Math.min(15, Math.floor((row / h) * 16))];
      ctx.fillRect(x, row, 3, 1);
    }
    const p = Math.round(peaks[i]);
    if (p > 0) { ctx.fillStyle = colors[23]; ctx.fillRect(x, h - p, 3, 1); }
  }
}

function drawOscilloscope(ctx, engine, colors, w, h) {
  background(ctx, colors, w, h);
  const data = engine.waveform();
  if (!data) return;
  const step = data.length / w;
  let prev = null;
  for (let x = 0; x < w; x++) {
    let v = data[Math.floor(x * step)] / 255; // 0..1
    const y = Math.max(0, Math.min(h - 1, Math.round(v * (h - 1))));
    const dist = Math.abs(y - h / 2) / (h / 2);
    ctx.fillStyle = colors[18 + Math.min(4, Math.floor(dist * 5))];
    if (prev !== null) {
      const a = Math.min(prev, y), b = Math.max(prev, y);
      ctx.fillRect(x, a, 1, Math.max(1, b - a + (a === b ? 0 : 0)));
    } else ctx.fillRect(x, y, 1, 1);
    prev = y;
  }
}

export class ClassicVis {
  constructor(canvas) { this.canvas = canvas; this.ctx = canvas.getContext('2d'); this.mode = 0; }
  draw(engine, colors, active) {
    const { ctx, canvas } = this;
    const m = visModes[this.mode] || visModes[0];
    const w = canvas._lw || canvas.width, h = canvas._lh || canvas.height;
    if (!m.draw || !active || !engine.ctx) { background(ctx, colors, w, h); return; }
    try { m.draw(ctx, engine, colors, w, h); } catch (e) { console.error(e); this.mode = 0; }
  }
}
