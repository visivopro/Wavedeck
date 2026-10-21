// Equalizer window: preamp + 10 bands, ON/AUTO, presets and response graph.
import { box, canvasBox, sprite, pressable, localPoint, dragging, applyRegion } from './dom.js';

export class EqWindow {
  constructor(app, root) {
    this.app = app;
    this.root = root;
    this.build();
  }
  get skin() { return this.app.skin; }

  build() {
    const r = this.root, app = this.app;
    r.innerHTML = '';
    this.bg = box(r, 0, 0, 275, 116);
    this.title = box(r, 0, 0, 275, 14, 'titlebar');
    const close = box(r, 264, 3, 9, 9);
    pressable(close, { onClick: () => app.toggleEqWindow(), render: (d) => sprite(close, this.skin, 'eqmain', 0, d ? 125 : 116) });

    const on = box(r, 14, 18, 26, 12);
    this.onP = pressable(on, {
      onClick: () => app.setEqOn(!app.state.eq.on),
      render: (d) => sprite(on, this.skin, 'eqmain', app.state.eq.on ? (d ? 187 : 69) : (d ? 128 : 10), 119),
    });
    const auto = box(r, 40, 18, 32, 12);
    this.autoP = pressable(auto, {
      onClick: () => app.setEqAuto(!app.state.eq.auto),
      render: (d) => sprite(auto, this.skin, 'eqmain', app.state.eq.auto ? (d ? 213 : 95) : (d ? 154 : 36), 119),
    });
    const presets = box(r, 217, 18, 44, 12);
    pressable(presets, { onClick: () => app.showEqPresets(), render: (d) => sprite(presets, this.skin, 'eqmain', 224, d ? 176 : 164) });

    this.graph = canvasBox(r, 86, 17, 113, 19);

    // sliders: index -1 = preamp
    this.sliders = [];
    const mk = (l, idx) => {
      const s = box(r, l, 38, 14, 63, 'interactive');
      const thumb = box(s, 1, 0, 11, 11);
      s.addEventListener('mousedown', (e) => {
        if (e.button !== 0) return;
        s.classList.add('down');
        dragging(e, (m) => {
          const p = localPoint(s, m, 14, 63);
          let v01 = 1 - Math.max(0, Math.min(1, (p.y - 5.5) / (62 - 11)));
          let db = Math.round((v01 * 24 - 12) * 10) / 10;
          if (Math.abs(db) < 0.8) db = 0;
          if (idx < 0) app.setPreamp(db); else app.setBand(idx, db);
          app.main.flash(`${idx < 0 ? 'Preamp' : `EQ: ${['60', '170', '310', '600', '1K', '3K', '6K', '12K', '14K', '16K'][idx]}HZ`}: ${db > 0 ? '+' : ''}${db.toFixed(1)} DB`);
        }, () => { s.classList.remove('down'); app.main.flash(null); this.update(); });
      });
      s.addEventListener('dblclick', () => { if (idx < 0) app.setPreamp(0); else app.setBand(idx, 0); });
      this.sliders.push({ s, thumb, idx });
    };
    mk(21, -1);
    for (let i = 0; i < 10; i++) mk(78 + i * 18, i);

    // +12 / 0 / -12 shortcuts
    const setAll = (db) => { for (let i = 0; i < 10; i++) app.setBand(i, db); };
    for (const [t, db] of [[36, 12], [64, 0], [95, -12]]) { const b = box(r, 45, t, 22, 8); pressable(b, { onClick: () => setAll(db) }); }

    r.addEventListener('contextmenu', (e) => { e.preventDefault(); app.showEqPresets(); });
    this.applySkin();
  }

  applySkin() {
    this.root.querySelectorAll('*').forEach((n) => { n._sk = null; });
    for (const b of this.root.querySelectorAll('.sk')) if (b._refresh) b._refresh();
    applyRegion(this.root, this.skin.regions && this.skin.regions.equalizer, 275, 116);
    this.update();
  }

  update() {
    const s = this.skin, st = this.app.state;
    sprite(this.bg, s, 'eqmain', 0, 0);
    sprite(this.title, s, 'eqmain', 0, this.app.focused ? 134 : 149);
    this.onP.refresh(); this.autoP.refresh();
    for (const { s: el, thumb, idx } of this.sliders) {
      const db = idx < 0 ? st.eq.preamp : st.eq.bands[idx];
      const v01 = (db + 12) / 24;
      const n = Math.round(v01 * 27);
      sprite(el, s, 'eqmain', 13 + (n % 14) * 15, 164 + Math.floor(n / 14) * 65);
      thumb.style.top = Math.round((1 - v01) * (62 - 11)) + 'px';
      sprite(thumb, s, 'eqmain', 0, el.classList.contains('down') ? 176 : 164);
    }
    this.drawGraph();
  }

  drawGraph() {
    const s = this.skin, st = this.app.state;
    const ctx = this.graph.getContext('2d');
    const R = s.res || 1;
    ctx.drawImage(s.sheets.eqmain, 0, 294 * R, 113 * R, 19 * R, 0, 0, 113, 19);
    // preamp line
    const py = Math.round(9 - (st.eq.preamp / 12) * 9);
    ctx.drawImage(s.sheets.eqmain, 0, 314 * R, 113 * R, 1 * R, 0, py, 113, 1);
    // smooth curve through the 10 bands (Catmull-Rom)
    const pts = st.eq.bands.map((db, i) => [i * (112 / 9), 9 - (db / 12) * 9]);
    let prevY = null;
    for (let x = 0; x < 113; x++) {
      const f = x / (112 / 9);
      const i = Math.min(8, Math.floor(f)), t = f - i;
      const p0 = pts[Math.max(0, i - 1)][1], p1 = pts[i][1], p2 = pts[i + 1][1], p3 = pts[Math.min(9, i + 2)][1];
      const y = 0.5 * ((2 * p1) + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t * t + (-p0 + 3 * p1 - 3 * p2 + p3) * t * t * t);
      const yi = Math.max(0, Math.min(18, Math.round(y)));
      const a = prevY === null ? yi : Math.min(prevY, yi), b = prevY === null ? yi : Math.max(prevY, yi);
      for (let yy = a; yy <= b; yy++) ctx.drawImage(s.sheets.eqmain, 115 * R, (294 + yy) * R, R, R, x, yy, 1, 1);
      prevY = yi;
    }
  }
}
