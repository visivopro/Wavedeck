// A left/right level meter drawn in the skin's visualizer colours.
export default function activate(api) {
  const level = [0, 0], peak = [0, 0];
  api.vis.register({
    id: 'vu-meter',
    name: 'VU meter',
    draw(ctx, engine, colors, w, h) {
      ctx.fillStyle = colors[0];
      ctx.fillRect(0, 0, w, h);
      const lv = engine.levels();
      if (!lv) return;
      const chans = [lv.timeByteArrayL, lv.timeByteArrayR];
      const barH = Math.floor((h - 3) / 2);
      chans.forEach((data, c) => {
        let sum = 0;
        for (let i = 0; i < data.length; i++) { const v = (data[i] - 128) / 128; sum += v * v; }
        const rms = Math.sqrt(sum / data.length);
        const db = 20 * Math.log10(rms + 1e-6);              // -inf..0
        const target = Math.max(0, Math.min(1, (db + 48) / 48));
        level[c] = target > level[c] ? target : level[c] * 0.92;
        peak[c] = Math.max(level[c], peak[c] - 0.01);
        const y = 1 + c * (barH + 1);
        const filled = Math.round(level[c] * w);
        for (let x = 0; x < filled; x += 2) {
          ctx.fillStyle = colors[17 - Math.min(15, Math.floor((x / w) * 16))];
          ctx.fillRect(x, y, 1, barH);
        }
        ctx.fillStyle = colors[23];
        ctx.fillRect(Math.min(w - 1, Math.round(peak[c] * w)), y, 1, barH);
      });
    },
  });
}
