// The main player window (275x116, or 14px tall in shade mode).
import { box, canvasBox, sprite, pressable, localPoint, dragging, el, applyRegion } from './dom.js';
import { drawSkinText, textBg, fmtTime } from './text.js';
import { ClassicVis } from './vis.js';

export class MainWindow {
  constructor(app, root) {
    this.app = app;
    this.root = root;
    this.marqueeOffset = 0;
    this.marqueeText = '';
    this.marqueeTick = 0;
    this.scrubbing = null;
    this.build();
  }

  get skin() { return this.app.skin; }

  build() {
    const r = this.root;
    const app = this.app;
    r.innerHTML = '';

    // ---------- full mode ----------
    const full = this.full = el('div', 'layer', r);
    this.bg = box(full, 0, 0, 275, 116);
    this.title = box(full, 0, 0, 275, 14, 'titlebar');
    this.title.addEventListener('dblclick', () => app.toggleShade());

    const winBtn = (parent, l, up, dn, onClick) => {
      const b = box(parent, l, 3, 9, 9);
      pressable(b, { onClick, render: (d) => sprite(b, this.skin, 'titlebar', ...(d ? dn : up)) });
      return b;
    };
    this.btnOptions = winBtn(full, 6, [0, 0], [0, 9], () => app.showMainMenu());
    winBtn(full, 244, [9, 0], [9, 9], () => window.wavedeck.win.minimize());
    winBtn(full, 254, [0, 18], [9, 18], () => app.toggleShade());
    winBtn(full, 264, [18, 0], [18, 9], () => window.wavedeck.win.close());

    // clutter bar
    this.clutter = box(full, 10, 22, 8, 43);
    const clut = [
      ['O', 3, 8, [304, 47], () => app.showMainMenu()],
      ['A', 11, 7, [312, 55], () => app.toggleOnTop()],
      ['I', 18, 7, [320, 62], () => app.showFileInfo()],
      ['D', 25, 8, [328, 69], () => app.toggleDouble()],
      ['V', 33, 7, [336, 77], () => app.showVisMenu()],
    ];
    this.clutterBtns = clut.map(([key, top, h, sel, fn]) => {
      const b = box(this.clutter, 0, top, 8, h);
      const p = pressable(b, {
        onClick: fn,
        render: (d) => {
          const on = d || (key === 'A' && app.state.alwaysOnTop) || (key === 'D' && app.state.scaleK !== app.baseK);
          if (on) sprite(b, this.skin, 'titlebar', sel[0], sel[1]); else { b.style.backgroundImage = 'none'; b._sk = null; }
        },
      });
      return p;
    });

    this.playpaus = box(full, 26, 28, 9, 9);
    // time
    this.timeBox = box(full, 36, 26, 63, 13, 'interactive');
    this.timeBox.addEventListener('mousedown', (e) => { if (e.button === 0) { e.stopPropagation(); app.toggleTimeMode(); } });
    this.minus = box(this.timeBox, 2, 6, 5, 1);
    this.digits = [12, 24, 42, 54].map((l) => box(this.timeBox, l, 0, 9, 13));

    // visualizer
    this.visCanvas = canvasBox(full, 24, 43, 76, 16, 'interactive');
    this.vis = new ClassicVis(this.visCanvas);
    this.visCanvas.addEventListener('mousedown', (e) => {
      e.stopPropagation();
      if (e.button === 0) app.cycleVis();
    });
    this.visCanvas.addEventListener('contextmenu', (e) => { e.preventDefault(); e.stopPropagation(); app.showVisMenu(); });

    this.marquee = canvasBox(full, 111, 27, 154, 6, 'interactive');
    this.marquee.addEventListener('mousedown', (e) => {
      if (e.button !== 0) return;
      const start = e.clientX, startOff = this.marqueeOffset;
      this.marqueeHold = true;
      dragging(e, (m) => { this.marqueeOffset = Math.max(0, startOff - Math.round((m.clientX - start) / this.app.zoom)); this.drawMarquee(true); },
        () => { this.marqueeHold = false; });
    });
    this.kbps = canvasBox(full, 111, 43, 15, 6);
    this.khz = canvasBox(full, 156, 43, 10, 6);
    this.mono = box(full, 212, 41, 27, 12);
    this.stereo = box(full, 239, 41, 29, 12);

    // volume / balance
    this.volume = box(full, 107, 57, 68, 13, 'interactive');
    this.volThumb = box(this.volume, 0, 1, 14, 11);
    this.balance = box(full, 177, 57, 38, 13, 'interactive');
    this.balThumb = box(this.balance, 0, 1, 14, 11);
    this.slider(this.volume, 68, (v) => app.setVolume(Math.round(v * 100)), () => `Volume: ${app.state.volume}%`);
    this.slider(this.balance, 38, (v) => { let b = Math.round(v * 200 - 100); if (Math.abs(b) < 12) b = 0; app.setBalance(b); },
      () => { const b = app.state.balance; return b === 0 ? 'Balance: Center' : `Balance: ${Math.abs(b)}% ${b < 0 ? 'Left' : 'Right'}`; });

    this.eqBtn = box(full, 219, 58, 23, 12);
    this.plBtn = box(full, 242, 58, 23, 12);
    this.eqP = pressable(this.eqBtn, { onClick: () => app.toggleEqWindow(), render: (d) => sprite(this.eqBtn, this.skin, 'shufrep', d ? 46 : 0, app.state.eqVisible ? 73 : 61) });
    this.plP = pressable(this.plBtn, { onClick: () => app.togglePlWindow(), render: (d) => sprite(this.plBtn, this.skin, 'shufrep', d ? 69 : 23, app.state.plVisible ? 73 : 61) });

    // position
    this.posbar = box(full, 16, 72, 248, 10, 'interactive');
    this.posThumb = box(this.posbar, 0, 0, 29, 10);
    this.posbar.addEventListener('mousedown', (e) => {
      if (e.button !== 0 || !app.engine.duration) return;
      dragging(e, (m) => {
        const p = localPoint(this.posbar, m, 248, 10);
        this.scrubbing = Math.max(0, Math.min(1, (p.x - 14) / (248 - 29)));
        this.flash(`Seek to: ${fmtTime(this.scrubbing * app.engine.duration)}/${fmtTime(app.engine.duration)} (${Math.round(this.scrubbing * 100)}%)`);
        this.update();
      }, () => { app.seekTo(this.scrubbing * app.engine.duration); this.scrubbing = null; this.flash(null); });
    });

    // transport
    const transport = [
      [16, 23, 18, 0, () => app.prev()], [39, 23, 18, 23, () => app.play()], [62, 23, 18, 46, () => app.pause()],
      [85, 23, 18, 69, () => app.stop()], [108, 22, 18, 92, () => app.next()],
    ];
    for (const [l, w, h, sx, fn] of transport) {
      const b = box(full, l, 88, w, h);
      pressable(b, { onClick: fn, render: (d) => sprite(b, this.skin, 'cbuttons', sx, d ? 18 : 0) });
    }
    const ej = box(full, 136, 89, 22, 16);
    pressable(ej, { onClick: () => app.openFiles(true), render: (d) => sprite(ej, this.skin, 'cbuttons', 114, d ? 16 : 0) });

    this.shuffle = box(full, 164, 89, 47, 15);
    this.repeat = box(full, 210, 89, 28, 15);
    this.shufP = pressable(this.shuffle, { onClick: () => app.toggleShuffle(), render: (d) => sprite(this.shuffle, this.skin, 'shufrep', 28, (app.state.shuffle ? 30 : 0) + (d ? 15 : 0)) });
    this.repP = pressable(this.repeat, { onClick: () => app.toggleRepeat(), render: (d) => sprite(this.repeat, this.skin, 'shufrep', 0, (app.state.repeat ? 30 : 0) + (d ? 15 : 0)) });

    const about = box(full, 253, 91, 13, 15);
    pressable(about, { onClick: () => app.showAbout() });

    // ---------- shade mode ----------
    const shade = this.shadeLayer = el('div', 'layer', r);
    this.shadeBg = box(shade, 0, 0, 275, 14, 'titlebar');
    this.shadeBg.addEventListener('dblclick', () => app.toggleShade());
    winBtn(shade, 6, [0, 0], [0, 9], () => app.showMainMenu());
    winBtn(shade, 244, [9, 0], [9, 9], () => window.wavedeck.win.minimize());
    winBtn(shade, 254, [0, 27], [9, 27], () => app.toggleShade());
    winBtn(shade, 264, [18, 0], [18, 9], () => window.wavedeck.win.close());
    this.shadeVis = canvasBox(shade, 79, 5, 38, 5, 'interactive');
    this.shadeVisObj = new ClassicVis(this.shadeVis);
    this.shadeVis.addEventListener('mousedown', (e) => { e.stopPropagation(); app.cycleVis(); });
    this.shadeTime = canvasBox(shade, 127, 4, 25, 6, 'interactive');
    this.shadeTime.addEventListener('mousedown', (e) => { e.stopPropagation(); app.toggleTimeMode(); });
    const sb = [[169, 7, () => app.prev()], [176, 10, () => app.play()], [186, 10, () => app.pause()], [196, 9, () => app.stop()], [205, 10, () => app.next()], [215, 10, () => app.openFiles(true)]];
    for (const [l, w, fn] of sb) { const b = box(shade, l, 2, w, 10); pressable(b, { onClick: fn }); }
    this.shadePos = box(shade, 226, 4, 17, 7, 'interactive');
    this.shadeThumb = box(this.shadePos, 0, 0, 3, 7);
    this.shadePos.addEventListener('mousedown', (e) => {
      if (!app.engine.duration) return;
      dragging(e, (m) => { const p = localPoint(this.shadePos, m, 17, 7); this.scrubbing = Math.max(0, Math.min(1, p.x / 17)); this.update(); },
        () => { app.seekTo(this.scrubbing * app.engine.duration); this.scrubbing = null; });
    });

    r.addEventListener('contextmenu', (e) => { e.preventDefault(); app.showMainMenu(); });
    r.addEventListener('wheel', (e) => { app.setVolume(app.state.volume + (e.deltaY < 0 ? 4 : -4)); this.flash(`Volume: ${app.state.volume}%`); clearTimeout(this.wheelT); this.wheelT = setTimeout(() => this.flash(null), 900); }, { passive: true });
    this.applySkin();
  }

  slider(elm, width, onValue, label) {
    elm.addEventListener('mousedown', (e) => {
      if (e.button !== 0) return;
      const thumbW = 14;
      dragging(e, (m) => {
        const p = localPoint(elm, m, width, 13);
        onValue(Math.max(0, Math.min(1, (p.x - thumbW / 2) / (width - thumbW))));
        elm.classList.add('down');
        this.flash(label());
      }, () => { elm.classList.remove('down'); this.flash(null); this.update(); });
    });
  }

  flash(text) { this.flashText = text; this.drawMarquee(true); }

  applySkin() {
    const s = this.skin;
    this.root.querySelectorAll('*').forEach((n) => { n._sk = null; });
    sprite(this.bg, s, 'main', 0, 0);
    sprite(this.clutter, s, 'titlebar', 304, 0);
    for (const b of this.root.querySelectorAll('.sk')) if (b._refresh) b._refresh();
    for (const c of this.root.querySelectorAll('canvas')) c._last = null;
    this.marqueeText = '';
    this.update(true);
  }

  update(force) {
    const app = this.app, s = this.skin, st = app.state, eng = app.engine;
    const shade = st.shade;
    this.full.style.display = shade ? 'none' : '';
    this.shadeLayer.style.display = shade ? '' : 'none';
    if (this._regionSkin !== s || this._regionShade !== shade) {
      this._regionSkin = s; this._regionShade = !!shade;
      const r = s.regions;
      applyRegion(this.root, r && (shade ? r.windowshade : r.normal), 275, shade ? 14 : 116);
    }
    const active = app.focused;

    if (shade) {
      sprite(this.shadeBg, s, 'titlebar', 27, active ? 29 : 42);
      this.drawMiniTime(this.shadeTime);
      const pct = this.scrubbing ?? (eng.duration ? eng.time / eng.duration : 0);
      this.shadeThumb.style.left = Math.round(pct * 14) + 'px';
      sprite(this.shadeThumb, s, 'titlebar', pct < 0.3 ? 17 : pct > 0.7 ? 23 : 20, 36);
      sprite(this.shadePos, s, 'titlebar', 0, 36);
      this.shadePos.style.visibility = st.status === 'stopped' ? 'hidden' : '';
      return;
    }

    sprite(this.title, s, 'titlebar', 27, active ? 0 : 15);
    sprite(this.playpaus, s, 'playpaus', st.status === 'playing' ? 0 : st.status === 'paused' ? 9 : 18, 0);

    // time display
    const showTime = st.status !== 'stopped';
    this.timeBox.style.visibility = showTime ? '' : 'hidden';
    if (showTime) {
      const blink = st.status === 'paused' && Math.floor(performance.now() / 500) % 2;
      let t = eng.time;
      const remaining = st.timeMode === 'remaining' && eng.duration;
      if (remaining) t = Math.max(0, eng.duration - eng.time);
      t = Math.floor(t);
      const mins = Math.min(99, Math.floor(t / 60)), secs = t % 60;
      const d = [Math.floor(mins / 10), mins % 10, Math.floor(secs / 10), secs % 10];
      const numSheet = 'numbers';
      this.digits.forEach((e, i) => {
        e.style.visibility = blink ? 'hidden' : '';
        sprite(e, s, numSheet, d[i] * 9, 0);
      });
      this.minus.style.visibility = remaining && !blink ? '' : 'hidden';
      sprite(this.minus, s, numSheet, 20, 6);
    }

    // kbps / khz / mono-stereo
    const t = app.currentTrack();
    const playing = st.status !== 'stopped' && t;
    this.drawSmallText(this.kbps, playing && t.bitrate ? String(Math.min(999, t.bitrate)).padStart(3, ' ') : '', 15);
    this.drawSmallText(this.khz, playing && t.sampleRate ? String(Math.round(t.sampleRate / 1000)).padStart(2, ' ') : '', 10);
    const ch = playing ? (t.channels || 2) : 0;
    sprite(this.mono, s, 'monoster', 29, ch === 1 ? 0 : 12);
    sprite(this.stereo, s, 'monoster', 0, ch >= 2 ? 0 : 12);

    // volume / balance
    const vol = st.volume;
    const vf = Math.round((vol / 100) * 28);
    sprite(this.volume, s, 'volume', 0, Math.max(0, vf - 1) * 15);
    this.volThumb.style.left = Math.round((vol / 100) * (68 - 14)) + 'px';
    sprite(this.volThumb, s, 'volume', this.volume.classList.contains('down') ? 0 : 15, 422);
    const bal = st.balance;
    sprite(this.balance, s, 'balance', 9, Math.floor((Math.abs(bal) / 100) * 27) * 15);
    this.balThumb.style.left = Math.round(((bal + 100) / 200) * (38 - 14)) + 'px';
    sprite(this.balThumb, s, 'balance', this.balance.classList.contains('down') ? 0 : 15, 422);

    // position
    sprite(this.posbar, s, 'posbar', 0, 0);
    const hasPos = st.status !== 'stopped' && eng.duration > 0;
    this.posThumb.style.display = hasPos ? '' : 'none';
    const pct = this.scrubbing ?? (eng.duration ? eng.time / eng.duration : 0);
    this.posThumb.style.left = Math.round(pct * (248 - 29)) + 'px';
    sprite(this.posThumb, s, 'posbar', this.scrubbing !== null ? 278 : 248, 0);

    this.eqP.refresh(); this.plP.refresh(); this.shufP.refresh(); this.repP.refresh();
    this.clutterBtns.forEach((b) => b.refresh());
    this.drawMarquee(force);
  }

  drawSmallText(canvas, str, w) {
    const ctx = canvas.getContext('2d');
    if (canvas._last === str + this.skin.name) return;
    canvas._last = str + this.skin.name;
    ctx.clearRect(0, 0, w, 6);
    if (str) { textBg(ctx, this.skin, w, 6); drawSkinText(ctx, this.skin, str, 0, 0); }
  }

  drawMiniTime(canvas) {
    const app = this.app, eng = app.engine;
    const ctx = canvas.getContext('2d');
    textBg(ctx, this.skin, 25, 6);
    if (app.state.status === 'stopped') return;
    let t = eng.time, neg = false;
    if (app.state.timeMode === 'remaining' && eng.duration) { t = eng.duration - eng.time; neg = true; }
    const m = Math.min(99, Math.floor(t / 60)), s = Math.floor(t % 60);
    const mm = m < 10 ? `${neg ? '-' : ' '}${m}` : String(m);
    drawSkinText(ctx, this.skin, `${mm}:${String(s).padStart(2, '0')}`, 0, 0);
  }

  marqueeString() {
    const app = this.app;
    const t = app.currentTrack();
    if (!t) return 'WAVEDECK  ***  DRAG FILES HERE OR PRESS L TO OPEN';
    const i = app.state.current + 1;
    const dur = t.duration ? ` (${fmtTime(t.duration, false)})` : '';
    return `${i}. ${app.trackTitle(t)}${dur}`;
  }

  drawMarquee(force) {
    const ctx = this.marquee.getContext('2d');
    const s = this.skin;
    if (this.flashText) {
      textBg(ctx, s, 154, 6);
      drawSkinText(ctx, s, this.flashText.slice(0, 31), 0, 0);
      return;
    }
    const str = this.marqueeString();
    const fits = str.length * 5 <= 154;
    if (str !== this.marqueeText) { this.marqueeText = str; this.marqueeOffset = 0; force = true; }
    if (!fits && !this.marqueeHold && this.app.state.scrollTitle !== false) {
      this.marqueeTick++;
      if (this.marqueeTick % 8 === 0) { this.marqueeOffset += 5; force = true; }
    }
    if (!force) return;
    textBg(ctx, s, 154, 6);
    if (fits) { drawSkinText(ctx, s, str, 0, 0); return; }
    const loop = str + '  ***  ';
    const total = loop.length * 5;
    const off = this.marqueeOffset % total;
    drawSkinText(ctx, s, loop + loop, -off, 0);
  }

  frame() {
    const app = this.app;
    const active = app.state.status === 'playing';
    if (app.state.shade) this.shadeVisObj.draw(app.engine, app.skin.viscolors, active);
    else this.vis.draw(app.engine, app.skin.viscolors, active);
    this.vis.mode = this.shadeVisObj.mode = app.state.visMode;
    this.update();
  }
}
