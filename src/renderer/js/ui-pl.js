// Playlist editor window (275 wide, resizable in 29px steps).
import { box, canvasBox, sprite, pressable, localPoint, dragging, el } from './dom.js';
import { drawSkinText, textBg, fmtTime } from './text.js';

const ROW_H = 13;

export class PlaylistWindow {
  constructor(app, root) {
    this.app = app;
    this.root = root;
    this.scroll = 0;
    this.anchor = null;
    this.build();
  }
  get skin() { return this.app.skin; }
  get rows() { return this.app.state.plRows; }
  get height() { return 20 + this.rows * 29 + 38; }

  build() {
    const r = this.root, app = this.app;
    r.innerHTML = '';
    const rows = this.rows;
    this.topParts = [];
    for (const l of [25, 50, 75, 187, 212, 237]) this.topParts.push(['tile', box(r, l, 0, 25, 20, 'titlebar')]);
    this.topParts.push(['left', box(r, 0, 0, 25, 20, 'titlebar')]);
    this.topParts.push(['title', box(r, 87, 0, 100, 20, 'titlebar')]);
    this.topParts.push(['right', box(r, 250, 0, 25, 20, 'titlebar')]);
    for (const [, e] of this.topParts) e.addEventListener('dblclick', () => app.togglePlWindow());
    const close = box(r, 264, 3, 9, 9);
    pressable(close, { onClick: () => app.togglePlWindow(), render: (d) => { if (d) sprite(close, this.skin, 'pledit', 52, 42); else { close.style.backgroundImage = 'none'; close._sk = null; } } });

    this.sides = [];
    for (let k = 0; k < rows; k++) {
      this.sides.push(['l', box(r, 0, 20 + k * 29, 12, 29)]);
      this.sides.push(['r', box(r, 255, 20 + k * 29, 20, 29)]);
    }

    // track list
    this.list = el('div', 'pl-list interactive', r, { left: '12px', top: '20px', width: '243px', height: rows * 29 + 'px' });
    this.list.addEventListener('wheel', (e) => { e.stopPropagation(); this.scrollBy(Math.sign(e.deltaY) * 3); }, { passive: true });
    this.list.addEventListener('mousedown', (e) => this.onListDown(e));
    this.list.addEventListener('dblclick', (e) => {
      const i = this.rowAt(e);
      if (i !== null && i < app.state.playlist.length) app.playIndex(i);
    });
    this.list.addEventListener('contextmenu', (e) => {
      e.preventDefault(); e.stopPropagation();
      const i = this.rowAt(e);
      if (i !== null && i < app.state.playlist.length && !app.state.selected.has(i)) { app.select([i]); }
      app.showPlaylistMenu();
    });

    // scrollbar
    this.scrollTrack = box(r, 260, 20, 8, rows * 29, 'interactive');
    this.handle = box(this.scrollTrack, 0, 0, 8, 18);
    this.scrollTrack.addEventListener('mousedown', (e) => {
      dragging(e, (m) => {
        const p = localPoint(this.scrollTrack, m, 8, rows * 29);
        const max = this.maxScroll();
        this.scroll = Math.round(Math.max(0, Math.min(1, (p.y - 9) / (rows * 29 - 18))) * max);
        this.handle.classList.add('down');
        this.renderList();
      }, () => { this.handle.classList.remove('down'); this.renderList(); });
    });

    // bottom bar
    const by = 20 + rows * 29;
    this.bottomL = box(r, 0, by, 125, 38);
    this.bottomR = box(r, 125, by, 150, 38);
    const menuBtn = (l, fn) => { const b = box(r, l, by + 8, 22, 18); pressable(b, { onClick: (e) => fn(e) }); };
    menuBtn(14, () => app.showPlAddMenu());
    menuBtn(43, () => app.showPlRemoveMenu());
    menuBtn(72, () => app.showPlSelectMenu());
    menuBtn(101, () => app.showPlMiscMenu());
    menuBtn(231, () => app.showPlListMenu());
    this.runTime = canvasBox(r, 132, by + 10, 67, 6);
    const acts = [() => app.prev(), () => app.play(), () => app.pause(), () => app.stop(), () => app.next(), () => app.openFiles(true)];
    acts.forEach((fn, i) => { const b = box(r, 129 + i * 10, by + 22, 10, 10); pressable(b, { onClick: fn }); });
    this.miniTime = canvasBox(r, 191, by + 23, 25, 6);

    // resize grip
    const grip = box(r, 255, by + 18, 20, 20, 'interactive grip');
    grip.addEventListener('mousedown', (e) => {
      const startY = e.screenY, startRows = this.rows;
      const scale = app.zoom;
      dragging(e, (m) => {
        const n = Math.max(2, Math.min(30, startRows + Math.round((m.screenY - startY) / (29 * scale))));
        if (n !== this.rows) app.setPlRows(n);
      });
    });

    r.addEventListener('contextmenu', (e) => { e.preventDefault(); app.showPlaylistMenu(); });
    this.applySkin();
  }

  applySkin() {
    this.root.querySelectorAll('*').forEach((n) => { n._sk = null; });
    for (const b of this.root.querySelectorAll('.sk')) if (b._refresh) b._refresh();
    for (const c of this.root.querySelectorAll('canvas')) c._last = null;
    const p = this.skin.pledit;
    Object.assign(this.list.style, { background: p.normalbg, color: p.normal, fontFamily: `"${(p.font || 'Tahoma').split(',')[0].replace(/"/g, '')}", Tahoma, sans-serif` });
    this.update(true);
  }

  maxScroll() { return Math.max(0, this.app.state.playlist.length - this.visibleRows()); }
  visibleRows() { return Math.floor((this.rows * 29 - 6) / ROW_H); }
  scrollBy(n) { this.scroll = Math.max(0, Math.min(this.maxScroll(), this.scroll + n)); this.renderList(); }
  ensureVisible(i) {
    const v = this.visibleRows();
    if (i < this.scroll) this.scroll = i; else if (i >= this.scroll + v) this.scroll = i - v + 1;
    this.scroll = Math.max(0, Math.min(this.maxScroll(), this.scroll));
    this.renderList();
  }

  rowAt(e) {
    const p = localPoint(this.list, e, 243, this.rows * 29);
    const i = this.scroll + Math.floor((p.y - 3) / ROW_H);
    return i >= 0 ? i : null;
  }

  onListDown(e) {
    if (e.button !== 0) return;
    e.stopPropagation();
    const app = this.app;
    const i = this.rowAt(e);
    const n = app.state.playlist.length;
    if (i === null || i >= n) { app.select([]); return; }
    const sel = app.state.selected;
    if (e.shiftKey && this.anchor !== null) {
      const a = Math.min(this.anchor, i), b = Math.max(this.anchor, i);
      app.select(Array.from({ length: b - a + 1 }, (_, k) => a + k));
    } else if (e.ctrlKey || e.metaKey) {
      const s = new Set(sel); s.has(i) ? s.delete(i) : s.add(i); app.select([...s]); this.anchor = i;
    } else {
      if (!sel.has(i)) app.select([i]);
      this.anchor = i;
      // drag to reorder the selection
      let last = i;
      dragging(e, (m) => {
        const j = Math.max(0, Math.min(n - 1, this.rowAt(m) ?? 0));
        if (j !== last) { const moved = app.moveSelection(j - last); if (moved) last = j; }
      });
    }
  }

  update(force) {
    const s = this.skin, active = this.app.focused;
    for (const [kind, e] of this.topParts) {
      const y = active ? 0 : 21;
      if (kind === 'tile') sprite(e, s, 'pledit', 127, y);
      else if (kind === 'left') sprite(e, s, 'pledit', 0, y);
      else if (kind === 'title') sprite(e, s, 'pledit', 26, y);
      else sprite(e, s, 'pledit', 153, y);
    }
    for (const [k, e] of this.sides) sprite(e, s, 'pledit', k === 'l' ? 0 : 31, 42);
    sprite(this.bottomL, s, 'pledit', 0, 72);
    sprite(this.bottomR, s, 'pledit', 126, 72);
    this.renderList(force);
    this.drawStatus();
  }

  renderList() {
    const app = this.app, pl = app.state.playlist, p = this.skin.pledit;
    const v = this.visibleRows();
    this.scroll = Math.max(0, Math.min(this.maxScroll(), this.scroll));
    const key = [this.skin.name, app.version, this.scroll, v, app.state.current, app.state.selVersion].join('|');
    // scroll handle
    const travel = this.rows * 29 - 18;
    const max = this.maxScroll();
    this.handle.style.top = (max ? Math.round((this.scroll / max) * travel) : 0) + 'px';
    sprite(this.handle, this.skin, 'pledit', this.handle.classList.contains('down') ? 61 : 52, 53);
    if (this.list._key === key) return;
    this.list._key = key;
    const frag = document.createDocumentFragment();
    for (let k = 0; k < v; k++) {
      const i = this.scroll + k;
      if (i >= pl.length) break;
      const t = pl[i];
      const row = document.createElement('div');
      row.className = 'pl-row';
      row.style.top = 3 + k * ROW_H + 'px';
      if (app.state.selected.has(i)) row.style.background = p.selectedbg;
      if (i === app.state.current) row.style.color = p.current;
      const title = document.createElement('span'); title.className = 'pl-title';
      title.textContent = `${i + 1}. ${app.trackTitle(t)}`;
      const dur = document.createElement('span'); dur.className = 'pl-dur';
      dur.textContent = t.duration ? fmtTime(t.duration, false) : '';
      row.append(title, dur);
      frag.appendChild(row);
    }
    this.list.replaceChildren(frag);
  }

  drawStatus() {
    const app = this.app, s = this.skin;
    const ctx = this.runTime.getContext('2d');
    const sel = [...app.state.selected].reduce((a, i) => a + (app.state.playlist[i]?.duration || 0), 0);
    const total = app.state.playlist.reduce((a, t) => a + (t.duration || 0), 0);
    const str = `${fmtTime(sel, false)}/${fmtTime(total, false)}`;
    if (this.runTime._last !== str + s.name) {
      this.runTime._last = str + s.name;
      textBg(ctx, s, 67, 6); drawSkinText(ctx, s, str, 0, 0);
    }
    const m = app.main;
    if (m) m.drawMiniTime(this.miniTime);
  }
}
