// Wavedeck player — application state, playback, playlist, menus, shortcuts, plugins.
import { AudioEngine, EQ_BANDS } from './audio.js';
import { defaultSkin, loadSkinArchive, exportTemplate, recipeSkin, packRecipeTheme, packRecipeSheets } from './skin.js';
import { setAllCanvasRes } from './dom.js';
import { Browser, SourceManager } from './browse.js';
import { Mixtapes } from './mixtapes.js';
import { MainWindow } from './ui-main.js';
import { EqWindow } from './ui-eq.js';
import { PlaylistWindow } from './ui-pl.js';
import { visModes, registerVisMode } from './vis.js';

const R = window.wavedeck;

export const EQ_PRESETS = {
  Flat: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  Classical: [0, 0, 0, 0, 0, 0, -4, -4, -4, -6],
  Club: [0, 0, 5, 3, 3, 3, 2, 0, 0, 0],
  Dance: [6, 4, 1, 0, 0, -3, -4, -4, 0, 0],
  'Full Bass': [6, 6, 6, 4, 1, -2, -5, -6, -7, -7],
  'Full Bass & Treble': [4, 3, 0, -4, -3, 1, 5, 7, 7, 8],
  'Full Treble': [-6, -6, -6, -2, 1, 7, 10, 10, 10, 11],
  Headphones: [3, 7, 3, -2, -1, 1, 3, 6, 8, 9],
  'Large Hall': [6, 6, 3, 3, 0, -3, -3, -3, 0, 0],
  Live: [-3, 0, 2, 3, 3, 3, 2, 1, 1, 1],
  Party: [4, 4, 0, 0, 0, 0, 0, 0, 4, 4],
  Pop: [-1, 3, 4, 5, 3, 0, -1, -1, -1, -1],
  Reggae: [0, 0, 0, -3, 0, 4, 4, 0, 0, 0],
  Rock: [5, 3, -3, -5, -2, 2, 5, 6, 6, 6],
  Ska: [-1, -3, -2, 0, 2, 3, 5, 6, 6, 6],
  Soft: [3, 1, 0, -1, 0, 2, 5, 6, 7, 8],
  'Soft Rock': [2, 2, 1, 0, -2, -3, -2, 0, 1, 5],
  Techno: [5, 3, 0, -3, -3, 0, 5, 6, 6, 5],
};

let nextId = 1;
// Classic skins draw with Wavedeck's own renderer; "modern" formats (Winamp 5, WMP,
// Sonique, K-Jofol, Audion, Cowon, JetAudio) use the bundled modern-skin engine.
const MODERN_RE = /\.(wal|wmz|sgf|kjofol|face|uib|jsk)$/i;
const SKIN_RE = /\.(wsz|wdskin|rwskin|wal|wmz|sgf|kjofol|face|uib|jsk)$/i;
const baseName = (p) => decodeURIComponent(String(p).split(/[\\/]/).pop() || p);
const stripExt = (n) => n.replace(/\.[a-z0-9]{2,5}$/i, '');

class App {
  constructor() {
    this.engine = new AudioEngine();
    this.skin = defaultSkin();
    this.focused = document.hasFocus();
    this.version = 0;
    this.history = [];
    this.pluginMenu = [];
    this.listeners = {};
    this.errorStreak = 0;
  }

  // ---------------- init ----------------
  async init() {
    const s = this.settings = await R.getSettings();
    this.state = {
      playlist: [], current: -1, selected: new Set(), selVersion: 0,
      status: 'stopped',
      volume: s.volume ?? 75, balance: s.balance ?? 0,
      shuffle: !!s.shuffle, repeat: !!s.repeat,
      timeMode: s.timeMode || 'elapsed', visMode: s.visMode ?? 0,
      eqVisible: s.eqVisible ?? true, plVisible: s.plVisible ?? true,
      shade: !!s.shade, alwaysOnTop: !!s.alwaysOnTop, scaleK: s.scaleK ?? null, legacyDouble: !!s.doubleSize, modernK: s.modernK ?? null,
      plRows: s.plRows || 6,
      eq: { on: s.eq?.on ?? true, auto: !!s.eq?.auto, preamp: s.eq?.preamp ?? 0, bands: s.eq?.bands || EQ_BANDS.map(() => 0) },
      scrollTitle: s.scrollTitle ?? true,
      plMode: s.plMode === 'browse' ? 'browse' : 'playlist',
    };
    this.sources = new SourceManager();
    this.mixtapes = new Mixtapes();
    const e = this.engine;
    e.setVolume(this.state.volume); e.setBalance(this.state.balance);
    e.eqOn = this.state.eq.on; e.preamp = this.state.eq.preamp; e.bands = [...this.state.eq.bands];

    const stack = this.stack = document.getElementById('stack');
    this.main = new MainWindow(this, document.getElementById('main'));
    this.eq = new EqWindow(this, document.getElementById('eq'));
    this.pl = new PlaylistWindow(this, document.getElementById('pl'));
    this.browser = new Browser(this);
    if (this.state.scaleK === null) this.state.scaleK = this.baseK * (this.state.legacyDouble ? 2 : 1);
    this.workArea = await R.win.workArea();
    this.stack.style.zoom = this.zoom;

    this.bindEngine();
    this.bindWindow();
    this.bindResizeHandles();
    this.watchDpr();
    this.bindKeys();
    this.bindDrop();
    window.wavedeckPlayer = this.publicApi();

    if (s.skinFile) await this.loadSkinFile(s.skinFile, true);
    if (s.modernSkin) this.enterModern(s.modernSkin);
    if (!s.skinFile || this.skin.builtin) this.setSkin(defaultSkin(this.renderRes()));
    if (Array.isArray(s.playlist) && s.playlist.length) {
      this.state.playlist = s.playlist.map((t) => ({ ...t, id: nextId++ }));
      this.state.current = Math.min(s.current ?? -1, this.state.playlist.length - 1);
      if (this.state.current >= 0) this.engine.load(this.currentTrack());
      this.version++;
    }
    this.layout();
    this.loop();
    R.onOpenFiles((files) => this.openPaths(files, true));
    await this.mixtapes.load();
    R.mixtapes.onChanged(async () => { await this.mixtapes.load(); this.browserRefreshIf((l) => l.title === 'Mixtapes' || l.mixtape || this.browser.stack.length === 1); });
    R.lib.onChanged(async () => { await this.sources.refresh(); this.browserRefreshIf((l) => this.browser.stack.indexOf(l) <= 1); });
    if (this.state.plMode === 'browse') this.browser.open();
    R.onMediaKey((k) => ({ playpause: () => (this.state.status === 'playing' ? this.pause() : this.play()), next: () => this.next(), prev: () => this.prev(), stop: () => this.stop() }[k]?.()));
    this.loadPlugins();
  }

  persist() {
    clearTimeout(this.persistT);
    this.persistT = setTimeout(() => {
      const st = this.state;
      R.setSettings({
        volume: st.volume, balance: st.balance, shuffle: st.shuffle, repeat: st.repeat, timeMode: st.timeMode,
        visMode: st.visMode, eqVisible: st.eqVisible, plVisible: st.plVisible, shade: st.shade, scaleK: st.scaleK, modernK: st.modernK, doubleSize: false,
        plRows: st.plRows, eq: st.eq, scrollTitle: st.scrollTitle, plMode: st.plMode,
        playlist: st.playlist.slice(0, 20000).map(({ id, ...t }) => t), current: st.current,
      });
    }, 500);
  }

  // ---------------- tracks ----------------
  currentTrack() { return this.state.playlist[this.state.current] || null; }
  trackTitle(t) {
    if (!t) return '';
    if (t.artist && t.title) return `${t.artist} - ${t.title}`;
    if (t.title) return t.title;
    if (t.displayTitle) return t.displayTitle;
    return stripExt(baseName(t.path || t.url || ''));
  }
  makeTrack(x) {
    if (typeof x === 'string') return /^https?:/i.test(x) ? { id: nextId++, url: x } : { id: nextId++, path: x };
    return { ...x, id: nextId++ };
  }

  async addTracks(items, { play = false, replace = false, at = null, keepEndless = false } = {}) {
    const tracks = items.map((x) => this.makeTrack(x));
    if (!tracks.length) return;
    const st = this.state;
    if (replace && !keepEndless) this.endless = null;
    if (replace) { this.stop(); st.playlist = []; st.current = -1; st.selected = new Set(); this.history = []; }
    const insertAt = at ?? st.playlist.length;
    st.playlist.splice(insertAt, 0, ...tracks);
    if (st.current >= insertAt && !replace) st.current += tracks.length;
    this.changed();
    if (play) this.playIndex(insertAt);
    // fill tags for local files lacking them
    const need = tracks.filter((t) => t.path && t.title === undefined);
    for (let i = 0; i < need.length; i += 50) {
      const chunk = need.slice(i, i + 50);
      const metas = await R.readMeta(chunk.map((t) => t.path));
      chunk.forEach((t, k) => Object.assign(t, metas[k] || {}));
      this.changed();
      const cur = this.currentTrack();
      if (cur && chunk.includes(cur)) this.emit('trackchange', this.publicTrack(cur));
    }
  }

  async openPaths(paths, play) {
    const skins = paths.filter((p) => SKIN_RE.test(p));
    if (skins.length) await this.loadSkinFile(skins[0]);
    const rest = paths.filter((p) => !SKIN_RE.test(p));
    if (!rest.length) return;
    const files = await R.expand(rest);
    await this.addTracks(files, { play, replace: play });
  }

  async openFiles(replace) {
    const files = await R.openFiles();
    if (files.length) await this.addTracks(files, { play: !!replace, replace: !!replace });
  }
  async openFolder(replace) {
    const files = await R.openFolder();
    if (files.length) await this.addTracks(files, { play: !!replace, replace: !!replace });
  }
  async openUrl() {
    const url = await this.prompt('Open URL', 'Stream or file URL (http/https):', 'https://');
    if (url && /^https?:\/\//.test(url)) this.addTracks([{ url, displayTitle: url }], { play: true });
  }

  changed() { this.version++; this.pl.update(); this.persist(); }

  // ---------------- selection & editing ----------------
  select(indices) { this.state.selected = new Set(indices); this.state.selVersion++; this.pl.update(); }
  selectAll() { this.select(this.state.playlist.map((_, i) => i)); }
  invertSelection() { const s = this.state.selected; this.select(this.state.playlist.map((_, i) => i).filter((i) => !s.has(i))); }
  removeIndices(idx) {
    const st = this.state, del = new Set(idx);
    if (!del.size) return;
    const cur = this.currentTrack();
    st.playlist = st.playlist.filter((_, i) => !del.has(i));
    st.current = cur ? st.playlist.indexOf(cur) : -1;
    if (cur && st.current < 0) { /* current removed: keep playing but no highlight */ }
    st.selected = new Set(); st.selVersion++;
    this.changed();
  }
  removeSelected() { this.removeIndices([...this.state.selected]); }
  cropSelected() { const s = this.state.selected; this.removeIndices(this.state.playlist.map((_, i) => i).filter((i) => !s.has(i))); }
  clearPlaylist() { this.endless = null; this.stop(); this.state.playlist = []; this.state.current = -1; this.state.selected = new Set(); this.changed(); }
  moveSelection(delta) {
    const st = this.state;
    const sel = [...st.selected].sort((a, b) => a - b);
    if (!sel.length || !delta) return false;
    if (sel[0] + delta < 0 || sel[sel.length - 1] + delta >= st.playlist.length) return false;
    const cur = this.currentTrack();
    const moving = sel.map((i) => st.playlist[i]);
    const rest = st.playlist.filter((_, i) => !st.selected.has(i));
    const insertAt = sel[0] + delta;
    rest.splice(insertAt, 0, ...moving);
    st.playlist = rest;
    st.current = cur ? rest.indexOf(cur) : -1;
    st.selected = new Set(moving.map((_, k) => insertAt + k)); st.selVersion++;
    this.changed();
    return true;
  }
  sortBy(key) {
    const st = this.state, cur = this.currentTrack();
    const val = (t) => {
      if (key === 'title') return this.trackTitle(t).toLowerCase();
      if (key === 'file') return baseName(t.path || t.url).toLowerCase();
      if (key === 'path') return (t.path || t.url).toLowerCase();
      if (key === 'album') return `${(t.albumartist || t.artist || '').toLowerCase()}|${(t.album || '').toLowerCase()}|${String(t.disc || 1).padStart(3, '0')}|${String(t.track || 0).padStart(4, '0')}`;
      return '';
    };
    st.playlist.sort((a, b) => val(a).localeCompare(val(b), undefined, { numeric: true }));
    st.current = cur ? st.playlist.indexOf(cur) : -1;
    this.changed();
  }
  randomize() {
    const st = this.state, cur = this.currentTrack(), a = st.playlist;
    for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
    st.current = cur ? a.indexOf(cur) : -1; this.changed();
  }
  reverse() { const st = this.state, cur = this.currentTrack(); st.playlist.reverse(); st.current = cur ? st.playlist.indexOf(cur) : -1; this.changed(); }
  removeDuplicates() {
    const seen = new Set(); const dup = [];
    this.state.playlist.forEach((t, i) => { const k = t.path || t.url; if (seen.has(k)) dup.push(i); else seen.add(k); });
    this.removeIndices(dup);
  }

  // ---------------- playback ----------------
  bindEngine() {
    const e = this.engine;
    e.addEventListener('playing', () => { this.setStatus('playing'); this.errorStreak = 0; });
    e.addEventListener('play', () => this.setStatus('playing'));
    e.addEventListener('pause', () => { if (!e.stopped && !e.el.ended) this.setStatus('paused'); });
    e.addEventListener('stopped', () => this.setStatus('stopped'));
    e.addEventListener('loadedmetadata', () => {
      const t = this.currentTrack();
      if (t && isFinite(e.el.duration) && (!t.duration || Math.abs(t.duration - e.el.duration) > 1)) { t.duration = e.el.duration; this.changed(); }
    });
    e.addEventListener('ended', () => this.onEnded());
    e.addEventListener('error', () => {
      if (!this.currentTrack() || !e.el.src) return;
      this.errorStreak++;
      this.main.flash('CANNOT PLAY THIS FILE');
      setTimeout(() => { this.main.flash(null); if (this.errorStreak < Math.min(5, this.state.playlist.length)) this.next(true); else this.stop(); }, 1200);
    });
  }

  setStatus(s) {
    if (this.state.status === s) return;
    this.state.status = s;
    this.emit('statechange', s);
  }

  playIndex(i, { fromHistory = false } = {}) {
    const st = this.state;
    if (i < 0 || i >= st.playlist.length) return;
    if (!fromHistory && st.current >= 0 && st.current !== i) this.history.push(st.current);
    st.current = i;
    const t = st.playlist[i];
    if (t.missing) {
      this.main.flash('SERVER NOT CONNECTED'); setTimeout(() => this.main.flash(null), 1200);
      if (this.pickNext() >= 0 && i !== this.pickNext()) setTimeout(() => this.next(true), 900);
      return;
    }
    this.engine.stopped = false;
    this.engine.load(t);
    if (this.endless) this.topUpEndless();
    if (st.eq.auto) this.applyAutoEq(t);
    this.engine.play();
    this.pl.ensureVisible(i);
    this.version++;
    this.pl.update();
    this.persist();
    this.emit('trackchange', this.publicTrack(t));
  }

  play() {
    const st = this.state;
    if (st.status === 'paused') { this.engine.play(); return; }
    if (st.status === 'playing') { this.engine.seek(0); return; }
    if (!st.playlist.length) { this.openFiles(true); return; }
    const idx = st.selected.size === 1 && st.current < 0 ? [...st.selected][0] : Math.max(0, st.current);
    if (this.engine.el.src && idx === st.current) { this.engine.stopped = false; this.engine.play(); }
    else this.playIndex(idx);
  }
  pause() {
    const st = this.state;
    if (st.status === 'playing') this.engine.pause();
    else if (st.status === 'paused') this.engine.play();
  }
  stop() { this.engine.stop(); this.setStatus('stopped'); }
  pickNext() {
    const st = this.state, n = st.playlist.length;
    if (!n) return -1;
    if (st.shuffle && !this.endless) {
      if (n === 1) return 0;
      let j; do { j = Math.floor(Math.random() * n); } while (j === st.current);
      return j;
    }
    if (st.current + 1 < n) return st.current + 1;
    return st.repeat ? 0 : -1;
  }
  next(auto) {
    const j = this.pickNext();
    if (j < 0) { if (!auto) return; this.stop(); return; }
    this.playIndex(j);
  }
  prev() {
    const st = this.state;
    if (this.engine.time > 4 && st.status === 'playing') { this.engine.seek(0); return; }
    if (st.shuffle && this.history.length) { this.playIndex(this.history.pop(), { fromHistory: true }); return; }
    if (st.current > 0) this.playIndex(st.current - 1);
    else if (st.repeat && st.playlist.length) this.playIndex(st.playlist.length - 1);
  }
  onEnded() {
    const st = this.state;
    if (st.repeat === 'one') { this.playIndex(st.current); return; }
    const j = this.pickNext();
    if (j < 0) { this.stop(); return; }
    this.playIndex(j);
  }
  seekTo(sec) { this.engine.seek(sec); }
  seekBy(sec) { this.engine.seek(this.engine.time + sec); }

  setVolume(v) { this.state.volume = Math.max(0, Math.min(100, Math.round(v))); this.engine.setVolume(this.state.volume); this.persist(); }
  setBalance(b) { this.state.balance = Math.max(-100, Math.min(100, Math.round(b))); this.engine.setBalance(this.state.balance); this.persist(); }
  toggleShuffle() { this.state.shuffle = !this.state.shuffle; this.persist(); }
  toggleRepeat() { this.state.repeat = !this.state.repeat; this.persist(); }
  toggleTimeMode() { this.state.timeMode = this.state.timeMode === 'elapsed' ? 'remaining' : 'elapsed'; this.persist(); }
  cycleVis() { this.state.visMode = (this.state.visMode + 1) % visModes.length; this.persist(); }

  // ---------------- equalizer ----------------
  setEqOn(on) { this.state.eq.on = on; this.engine.setEqOn(on); this.eqChanged(); }
  setEqAuto(on) { this.state.eq.auto = on; this.eqChanged(); }
  setPreamp(db) { this.state.eq.preamp = db; this.engine.setPreamp(db); this.eqChanged(); }
  setBand(i, db) { this.state.eq.bands[i] = db; this.engine.setBand(i, db); this.eqChanged(); }
  applyEq(bands, preamp) {
    bands.forEach((v, i) => { this.state.eq.bands[i] = v; this.engine.setBand(i, v); });
    if (preamp !== undefined) { this.state.eq.preamp = preamp; this.engine.setPreamp(preamp); }
    this.eqChanged(true);
  }
  eqChanged(fromPreset) {
    const st = this.state;
    if (st.eq.auto && !fromPreset) {
      const t = this.currentTrack();
      if (t) { const k = t.path || t.url; this.settings.autoEq = this.settings.autoEq || {}; this.settings.autoEq[k] = { bands: [...st.eq.bands], preamp: st.eq.preamp }; R.setSettings({ autoEq: this.settings.autoEq }); }
    }
    this.eq.update(); this.persist();
  }
  applyAutoEq(t) {
    const saved = this.settings.autoEq?.[t.path || t.url];
    if (saved) this.applyEq(saved.bands, saved.preamp);
  }

  // ---------------- windows & scaling ----------------
  // Size is stored as K = screen pixels per skin pixel. Only whole numbers are
  // allowed, so skin pixel art always lands on the physical pixel grid and stays
  // sharp at any Windows display scaling. The largest K is whatever still fits
  // on the current monitor.
  get dpr() { return window.devicePixelRatio || 1; }
  get baseK() { return Math.max(1, Math.ceil(this.dpr - 0.01)); }
  get zoom() { return this.state.scaleK / this.dpr; }
  logicalSize() {
    const st = this.state;
    const mainH = st.shade ? 14 : 116;
    return { w: 275, h: mainH + (st.eqVisible ? 116 : 0) + (st.plVisible ? this.pl.height : 0), mainH };
  }
  // Current size step: the classic player's, or the modern skin's while one is showing.
  get curK() { return this.modernActive() ? (this.state.modernK || this.baseK) : this.state.scaleK; }
  maxK() {
    const wa = this.workArea || { width: screen.availWidth, height: screen.availHeight };
    if (this.modernActive()) {
      // the largest size where the biggest skin window still fits on screen
      const b = this.modernBox;
      if (!b) return this.baseK * 4;
      const fit = Math.floor(Math.min((wa.width * this.dpr) / Math.max(1, b.w), (wa.height * this.dpr) / Math.max(1, b.h)));
      return Math.max(1, Math.min(fit, this.baseK * 4));
    }
    const { w } = this.logicalSize();
    // limit by the full (unshaded) height so toggling shade or panels never needs a shrink
    const fullH = 116 + (this.state.eqVisible ? 116 : 0) + (this.state.plVisible ? this.pl.height : 0);
    const fit = Math.floor(Math.min((wa.width * this.dpr) / w, (wa.height * this.dpr) / fullH));
    return Math.max(1, Math.min(fit, this.baseK * 4));
  }
  clampK(k) { return Math.max(1, Math.min(this.maxK(), Math.round(k))); }
  layout() {
    const st = this.state;
    const { w, h, mainH } = this.logicalSize();
    document.getElementById('main').style.height = mainH + 'px';
    const eqEl = document.getElementById('eq'), plEl = document.getElementById('pl');
    eqEl.style.display = st.eqVisible ? '' : 'none';
    plEl.style.display = st.plVisible ? '' : 'none';
    plEl.style.height = this.pl.height + 'px';
    const k = this.clampK(st.scaleK);
    if (k !== st.scaleK) { st.scaleK = k; this.persist(); }
    this.stack.style.zoom = this.zoom;
    document.body.classList.toggle('shaded', !!st.shade);
    R.win.setSize(Math.ceil(w * this.zoom), Math.ceil(h * this.zoom));
    if (this.skin) this.rerenderForScale();
  }
  setScale(k, { flash = true } = {}) {
    k = this.clampK(k);
    if (this.modernActive()) {
      if (k === this.curK) return;
      this.state.modernK = k; this.persist();
      const m = this.modernWin.wavedeckModern;
      if (m && m.setScale) m.setScale(k / this.dpr);
      return;
    }
    if (k === this.state.scaleK) return;
    this.state.scaleK = k; this.layout(); this.persist();
    if (flash) this.flashSize();
  }
  flashSize() {
    this.main.flash(`SIZE: ${Math.round((this.state.scaleK / this.baseK) * 100)}%`);
    clearTimeout(this.sizeT); this.sizeT = setTimeout(() => this.main.flash(null), 1000);
  }
  toggleDouble() { this.setScale(this.curK === this.baseK ? this.baseK * 2 : this.baseK); }
  scaleStep(d) { this.setScale(this.curK + d); }
  sizeSubmenu() {
    const max = this.maxK(), items = [];
    for (let k = 1; k <= max; k++) {
      const pct = Math.round((k / this.baseK) * 100);
      items.push({ id: `size:${k}`, label: `${pct}%${k === this.baseK ? ' (normal)' : ''}`, checked: k === this.curK, radio: true });
    }
    return [...items, { type: 'separator' }, { id: 'size:up', label: 'Larger', accelerator: 'Ctrl+=', enabled: this.curK < max }, { id: 'size:down', label: 'Smaller', accelerator: 'Ctrl+-', enabled: this.curK > 1 }];
  }
  sizeHandlers() {
    const h = { 'size:up': () => this.scaleStep(1), 'size:down': () => this.scaleStep(-1) };
    for (let k = 1; k <= this.maxK(); k++) h[`size:${k}`] = () => this.setScale(k);
    return h;
  }

  // Drag any edge or corner to scale the whole player, proportions locked.
  bindResizeHandles() {
    const box = document.getElementById('handles');
    for (const dir of ['n', 's', 'e', 'w', 'ne', 'nw', 'se', 'sw']) {
      const hd = document.createElement('div');
      hd.className = `h h-${dir}`;
      hd.addEventListener('mousedown', (e) => this.startScaleDrag(e, dir));
      hd.addEventListener('dblclick', () => this.setScale(this.baseK));
      box.appendChild(hd);
    }
  }
  startScaleDrag(e, dir) {
    if (e.button !== 0) return;
    e.preventDefault(); e.stopPropagation();
    R.win.workArea().then((wa) => { this.workArea = wa; });
    const L = this.logicalSize();
    const z0 = this.zoom;
    const x0 = window.screenX, y0 = window.screenY, w0 = L.w * z0, h0 = L.h * z0;
    const sx = e.screenX, sy = e.screenY;
    const right = x0 + w0, bottom = y0 + h0;
    const move = (m) => {
      const dx = m.screenX - sx, dy = m.screenY - sy;
      const cands = [];
      if (dir.includes('e')) cands.push((w0 + dx) / L.w);
      if (dir.includes('w')) cands.push((w0 - dx) / L.w);
      if (dir.includes('s')) cands.push((h0 + dy) / L.h);
      if (dir.includes('n')) cands.push((h0 - dy) / L.h);
      // corners: follow whichever axis the mouse moved further
      const z = cands.reduce((a, c) => (Math.abs(c - z0) > Math.abs(a - z0) ? c : a), cands[0]);
      const k = this.clampK(z * this.dpr);
      if (k === this.state.scaleK) return;
      this.state.scaleK = k;
      const zz = this.zoom, W = Math.ceil(L.w * zz), H = Math.ceil(L.h * zz);
      this.stack.style.zoom = zz;
      R.win.setBounds({ x: dir.includes('w') ? right - W : x0, y: dir.includes('n') ? bottom - H : y0, width: W, height: H });
      this.flashSize();
      this.rerenderForScale();
    };
    const up = () => { window.removeEventListener('mousemove', move); window.removeEventListener('mouseup', up); this.persist(); };
    window.addEventListener('mousemove', move); window.addEventListener('mouseup', up);
  }

  // Moving to a monitor with different Windows scaling: keep the same physical look.
  watchDpr() {
    let last = this.dpr;
    const check = async () => {
      const now = this.dpr;
      if (now !== last) {
        const z = this.state.scaleK / last;
        last = now;
        this.workArea = await R.win.workArea();
        this.state.scaleK = this.clampK(z * now);
        this.layout(); this.persist();
      }
      matchMedia(`(resolution: ${now}dppx)`).addEventListener('change', check, { once: true });
    };
    matchMedia(`(resolution: ${last}dppx)`).addEventListener('change', check, { once: true });
  }

  toggleEqWindow() { this.state.eqVisible = !this.state.eqVisible; this.layout(); this.persist(); }
  togglePlWindow() { this.state.plVisible = !this.state.plVisible; this.layout(); this.persist(); }
  toggleShade() { this.state.shade = !this.state.shade; this.layout(); this.persist(); }
  toggleOnTop() { this.state.alwaysOnTop = !this.state.alwaysOnTop; R.win.alwaysOnTop(this.state.alwaysOnTop); }
  setPlRows(n) { this.state.plRows = n; this.pl.build(); this.layout(); this.persist(); }

  bindWindow() {
    window.addEventListener('focus', () => { this.focused = true; this.repaintAll(); });
    window.addEventListener('blur', () => { this.focused = false; this.repaintAll(); });
    // drag the window from any non-interactive area
    this.stack.addEventListener('mousedown', (e) => {
      if (e.button !== 0 || e.target.closest('.interactive')) return;
      const sx = e.screenX, sy = e.screenY, wx = window.screenX, wy = window.screenY;
      let raf = null, last = null;
      const move = (m) => {
        last = [wx + m.screenX - sx, wy + m.screenY - sy];
        if (!raf) raf = requestAnimationFrame(() => { raf = null; R.win.setPos(last[0], last[1]); });
      };
      const up = async () => {
        window.removeEventListener('mousemove', move); window.removeEventListener('mouseup', up);
        this.workArea = await R.win.workArea();
        if (this.clampK(this.state.scaleK) !== this.state.scaleK) this.layout();
      };
      window.addEventListener('mousemove', move); window.addEventListener('mouseup', up);
    });
  }
  repaintAll() { this.main.update(true); this.eq.update(); this.pl.update(); }

  // ---------------- skins ----------------
  // Recipe themes are drawn natively at the current scale; classic bitmap skins stay at 1x.
  renderRes() { return Math.max(1, Math.min(6, this.state.scaleK || 1)); }
  async loadSkinFile(file, silent) {
    if (MODERN_RE.test(file)) { this.enterModern(file); return true; }
    if (this.modernActive()) this.exitModern();
    try {
      const bytes = await R.readBinary(file);
      const skin = await loadSkinArchive(bytes, stripExt(baseName(file)), { res: this.renderRes() });
      this.setSkin(skin);
      R.setSettings({ skinFile: file }); this.settings.skinFile = file;
      if (!silent) { this.main.flash(`SKIN: ${skin.name}`.slice(0, 31)); setTimeout(() => this.main.flash(null), 1600); }
      return true;
    } catch (e) {
      console.error(e);
      if (!silent) R.message({ type: 'error', message: 'Could not load that skin.', detail: String(e.message || e) });
      return false;
    }
  }
  useDefaultSkin() { if (this.modernActive()) this.exitModern(); this.setSkin(defaultSkin(this.renderRes())); R.setSettings({ skinFile: null }); this.settings.skinFile = null; }
  setSkin(skin) {
    this.skin = skin;
    setAllCanvasRes(skin.res || 1);
    this.main.applySkin(); this.eq.applySkin(); this.pl.applySkin();
    this.emit('skinchange', { name: skin.name, libraryCss: skin.libraryCss });
    for (const w of [this.libraryWin, this.milkWin]) { try { w && !w.closed && w.onSkinChange && w.onSkinChange(); } catch { /* closed */ } }
  }
  // Redraw a recipe theme at the new size after scaling, so it stays sharp.
  rerenderForScale() {
    clearTimeout(this.rerenderT);
    this.rerenderT = setTimeout(async () => {
      const sk = this.skin, res = this.renderRes();
      if (!sk.recipe || sk.res === res) return;
      const s = await recipeSkin(sk.recipe, res, { builtin: sk.builtin });
      if (this.skin === sk) this.setSkin(s);
    }, 140);
  }

  // ---------------- Theme Studio ----------------
  // ---------------- modern skins (Winamp 5 .wal and friends) ----------------
  modernActive() { return !!(this.modernWin && !this.modernWin.closed); }
  // Closing the skin window yourself (taskbar, Alt+F4) exits Wavedeck, like Winamp.
  // Closes Wavedeck makes on purpose (switching skins, going back to classic, a skin
  // that failed to load) are remembered here so they don't.
  closeModernWin(w) {
    if (!w) return;
    (this.intentionalCloses ||= new WeakSet()).add(w);
    if (!w.closed) w.close();
  }
  enterModern(file) {
    const old = this.modernWin;
    this.modernWin = null;
    this.closeModernWin(old);
    const w = window.open(`app://wavedeck/modern.html?skin=${encodeURIComponent(file)}`, `modern${Date.now()}`, 'modern');
    this.modernWin = w;
    const watch = setInterval(() => {
      if (!w.closed) return;
      clearInterval(watch);
      const intended = this.intentionalCloses && this.intentionalCloses.has(w);
      if (this.modernWin === w) this.modernWin = null;
      if (!intended) this.quit();
    }, 400);
  }
  modernReady(file) {
    this.settings.modernSkin = file;
    R.setSettings({ modernSkin: file });
    R.win.hideMain();
    if (this.studioWin && !this.studioWin.closed) this.studioWin.close();
  }
  modernFailed(file, msg) {
    const w = this.modernWin;
    this.modernWin = null;
    if (w) (this.intentionalCloses ||= new WeakSet()).add(w);
    this.settings.modernSkin = null;
    R.setSettings({ modernSkin: null });
    R.win.showMain();
    R.message({ type: 'error', message: "Couldn't load that skin.", detail: `${file.split(/[\\/]/).pop()}: ${msg}` });
  }
  exitModern() {
    if (!this.modernActive()) return;
    const w = this.modernWin;
    this.modernWin = null;
    this.closeModernWin(w);
    this.settings.modernSkin = null;
    R.setSettings({ modernSkin: null });
    R.win.showMain();
  }
  quit() { R.win.close(); }

  openStudio() {
    if (this.modernActive()) this.exitModern();
    if (this.studioWin && !this.studioWin.closed) { this.studioWin.focus(); return; }
    this.studioWin = window.open('app://wavedeck/studio.html', 'studio', 'studio');
  }
  currentRecipe() { return this.skin.recipe ? { ...this.skin.recipe } : null; }
  async previewRecipe(recipe) {
    if (!this.studioBackup) this.studioBackup = { skin: this.skin, file: this.settings.skinFile };
    const id = ++this.previewId || (this.previewId = 1);
    const s = await recipeSkin(recipe, this.renderRes());
    if (id !== this.previewId) return;
    this.setSkin(s);
  }
  studioCancel() {
    const b = this.studioBackup;
    this.studioBackup = null; this.previewId = (this.previewId || 0) + 1;
    if (!b) return;
    if (b.skin.recipe && b.skin.res !== this.renderRes()) recipeSkin(b.skin.recipe, this.renderRes(), { builtin: b.skin.builtin }).then((s) => this.setSkin(s));
    else this.setSkin(b.skin);
  }
  async studioSave(recipe) {
    const bytes = await packRecipeTheme(recipe);
    const file = await R.saveSkin(`${recipe.name || 'My theme'}.wdskin`, bytes);
    this.studioBackup = null;
    await this.loadSkinFile(file, true);
    return file;
  }
  async studioExport(recipe, sheetsOnly) {
    const data = sheetsOnly ? await packRecipeSheets(recipe) : await packRecipeTheme(recipe);
    const name = `${recipe.name || 'My theme'}${sheetsOnly ? ' (sheets)' : ''}.wdskin`;
    return R.saveFile({ defaultPath: name, data, filters: [{ name: 'Wavedeck skin', extensions: ['wdskin'] }] });
  }

  async exportSkinTemplate() {
    const data = await exportTemplate();
    const out = await R.saveFile({ defaultPath: 'MyWavedeckSkin.wdskin', data, filters: [{ name: 'Wavedeck skin', extensions: ['wdskin'] }] });
    if (out) R.showInFolder(out);
  }

  // ---------------- child windows ----------------
  openLibrary() {
    if (this.libraryWin && !this.libraryWin.closed) { this.libraryWin.focus(); return; }
    this.libraryWin = window.open('app://wavedeck/library.html', 'library', 'library');
  }
  openMilkdrop() {
    if (this.milkWin && !this.milkWin.closed) { this.milkWin.focus(); return; }
    this.milkWin = window.open('app://wavedeck/milkdrop.html', 'milkdrop', 'milkdrop');
  }
  openTool(name) { window.open(`app://wavedeck/${name}.html`, name, name); }
  showFileInfo() { if (this.currentTrack() || this.state.selected.size) this.openTool('info'); }
  showAbout() { this.openTool('about'); }

  // tiny in-window prompt
  prompt(title, label, value = '', placeholder = '') {
    // while a modern skin is showing, this window is hidden: ask from the skin's window
    const m = this.modernActive() && this.modernWin.wavedeckModern;
    if (m && m.prompt) return m.prompt(title, label, value, placeholder);
    return new Promise((resolve) => {
      const o = document.getElementById('overlay');
      o.innerHTML = `<form class="prompt"><b>${title}</b><label>${label}</label><input spellcheck="false"><div><button type="button" class="c">Cancel</button><button>OK</button></div></form>`;
      o.hidden = false;
      const inp = o.querySelector('input'); inp.value = value; inp.placeholder = placeholder; inp.focus(); inp.select();
      const done = (v) => { o.hidden = true; o.innerHTML = ''; resolve(v); };
      o.querySelector('form').onsubmit = (e) => { e.preventDefault(); done(inp.value.trim()); };
      o.querySelector('.c').onclick = () => done(null);
      inp.onkeydown = (e) => { if (e.key === 'Escape') done(null); e.stopPropagation(); };
    });
  }

  // ---------------- menus ----------------
  async menu(template, handlers) {
    const id = await R.popupMenu(template);
    if (id && handlers[id]) handlers[id]();
    else if (id && id.startsWith('plugin:')) this.pluginMenu[+id.slice(7)]?.fn();
  }
  async skinsSubmenu() {
    const skins = await R.listSkins();
    this._skins = skins;
    const cur = this.settings.skinFile;
    return [
      { id: 'skin:studio', label: 'Theme Studio…', accelerator: 'Ctrl+Shift+T' },
      { type: 'separator' },
      { id: 'skin:load', label: 'Load skin…' },
      { id: 'skin:dir', label: 'Open skins folder' },
      { id: 'skin:export', label: 'Export skin template (.wdskin)…' },
      { type: 'separator' },
      { id: 'skin:default', label: '<Wavedeck Midnight> (built-in)', checked: this.skin.builtin, radio: true },
      ...skins.filter((s) => !MODERN_RE.test(s.file)).map((s) => ({ id: `skin:${skins.indexOf(s)}`, label: s.name, checked: s.file === cur && !this.skin.builtin && !this.modernActive(), radio: true })),
      ...(skins.some((s) => MODERN_RE.test(s.file)) ? [{ type: 'separator' }, { label: 'Modern skins', enabled: false }] : []),
      ...skins.filter((s) => MODERN_RE.test(s.file)).map((s) => ({ id: `skin:${skins.indexOf(s)}`, label: s.name, checked: this.modernActive() && s.file === this.settings.modernSkin, radio: true })),
      ...(this.modernActive() ? [{ type: 'separator' }, { id: 'skin:classic', label: 'Back to classic skin' }] : []),
    ];
  }
  async skinHandlers() {
    const h = {
      'skin:studio': () => this.openStudio(),
      'skin:classic': () => this.exitModern(),
      'skin:load': async () => { const f = await R.openSkin(); if (f) this.loadSkinFile(f); },
      'skin:dir': () => R.openSkinsDir(),
      'skin:export': () => this.exportSkinTemplate(),
      'skin:default': () => this.useDefaultSkin(),
    };
    (this._skins || []).forEach((s, i) => { h[`skin:${i}`] = () => this.loadSkinFile(s.file); });
    return h;
  }

  async showMainMenu() {
    const st = this.state;
    const skins = await this.skinsSubmenu();
    const modern = this.modernActive(), tapes = this.mixtapes.list;
    const tpl = [
      { id: 'about', label: 'About Wavedeck…' },
      { type: 'separator' },
      { id: 'openfile', label: 'Play file…', accelerator: 'L' },
      { id: 'openfolder', label: 'Play folder…', accelerator: 'Shift+L' },
      { id: 'openurl', label: 'Play URL…', accelerator: 'Ctrl+L' },
      { type: 'separator' },
      { id: 'library', label: modern ? 'Media Library: servers, mixtapes, playlists' : 'Media Library', accelerator: 'Alt+L' },
      ...(modern ? [] : [{ id: 'browse', label: 'Browse in playlist window', accelerator: 'Tab' }]),
      { label: 'Play a mixtape', submenu: tapes.length ? tapes.map((m) => ({ id: `playmx:${m.id}`, label: `${m.name}  (${m.tracks.length})` })) : [{ label: 'No mixtapes yet', enabled: false }] },
      { id: 'savemix', label: 'Save playlist as mixtape…' },
      { id: 'milkdrop', label: 'Visualization window', accelerator: 'Ctrl+Shift+K' },
      ...(modern ? [] : [
        { id: 'eqwin', label: 'Equalizer', checked: st.eqVisible, accelerator: 'Alt+G' },
        { id: 'plwin', label: 'Playlist editor', checked: st.plVisible, accelerator: 'Alt+E' },
      ]),
      { type: 'separator' },
      { id: 'skin:studio', label: 'Theme Studio…', accelerator: 'Ctrl+Shift+T' },
      { label: 'Skins', submenu: skins },
      { label: 'Options', submenu: [
        { id: 'ontop', label: 'Always on top', checked: st.alwaysOnTop, accelerator: 'Ctrl+A' },
        { id: 'double', label: 'Double size', checked: this.curK === this.baseK * 2, accelerator: 'Ctrl+D' },
        { label: 'Size', submenu: this.sizeSubmenu() },
        { id: 'shade', label: 'Windowshade mode', checked: st.shade, accelerator: 'Ctrl+W' },
        { id: 'timemode', label: 'Time remaining', checked: st.timeMode === 'remaining', accelerator: 'Ctrl+T' },
        { id: 'scroll', label: 'Scroll song title', checked: st.scrollTitle },
        { type: 'separator' },
        { id: 'repeat', label: 'Repeat', checked: !!st.repeat, accelerator: 'R' },
        { id: 'shuffle', label: 'Shuffle', checked: st.shuffle, accelerator: 'S' },
      ] },
      { label: 'Playback', submenu: [
        { id: 'prev', label: 'Previous', accelerator: 'Z' }, { id: 'play', label: 'Play', accelerator: 'X' },
        { id: 'pause', label: 'Pause', accelerator: 'C' }, { id: 'stop', label: 'Stop', accelerator: 'V' },
        { id: 'next', label: 'Next', accelerator: 'B' }, { type: 'separator' },
        { id: 'back5', label: 'Back 5 seconds', accelerator: 'Left' }, { id: 'fwd5', label: 'Forward 5 seconds', accelerator: 'Right' },
        { id: 'jump', label: 'Jump to file…', accelerator: 'J' },
      ] },
      { label: 'Visualization', submenu: this.visSubmenu() },
      { label: 'Plugins', submenu: [
        ...this.pluginMenu.map((m, i) => ({ id: `plugin:${i}`, label: m.label })),
        ...(this.pluginMenu.length ? [{ type: 'separator' }] : []),
        { id: 'plugindir', label: 'Open plugins folder' },
        { id: 'pluginlist', label: `${this.plugins?.length || 0} plugin(s) loaded`, enabled: false },
      ] },
      { type: 'separator' },
      { id: 'exit', label: 'Exit' },
    ];
    this.menu(tpl, {
      about: () => this.showAbout(), openfile: () => this.openFiles(true), openfolder: () => this.openFolder(true), openurl: () => this.openUrl(),
      library: () => this.openLibrary(), browse: () => { if (this.modernActive()) { this.openLibrary(); return; } if (!this.state.plVisible) this.togglePlWindow(); this.setPlMode('browse'); }, savemix: () => this.saveAsMixtape(), milkdrop: () => this.openMilkdrop(), eqwin: () => this.toggleEqWindow(), plwin: () => this.togglePlWindow(),
      ontop: () => this.toggleOnTop(), double: () => this.toggleDouble(), shade: () => this.toggleShade(), timemode: () => this.toggleTimeMode(),
      scroll: () => { this.state.scrollTitle = !this.state.scrollTitle; this.persist(); },
      repeat: () => this.toggleRepeat(), shuffle: () => this.toggleShuffle(),
      prev: () => this.prev(), play: () => this.play(), pause: () => this.pause(), stop: () => this.stop(), next: () => this.next(),
      back5: () => this.seekBy(-5), fwd5: () => this.seekBy(5), jump: () => this.openTool('jump'),
      plugindir: () => R.plugins.openDir(), exit: () => R.win.close(),
      ...this.visHandlers(), ...this.sizeHandlers(), ...(await this.skinHandlers()),
      ...Object.fromEntries(tapes.map((m) => [`playmx:${m.id}`, async () => this.playList(await this.resolveRefs(m.tracks), 0)])),
    });
  }
  visSubmenu() {
    return [
      ...visModes.map((m, i) => ({ id: `vis:${i}`, label: m.name, checked: this.state.visMode === i, radio: true })),
      { type: 'separator' },
      { id: 'milkdrop', label: 'Open visualization window (Milkdrop presets)' },
    ];
  }
  visHandlers() {
    const h = { milkdrop: () => this.openMilkdrop() };
    visModes.forEach((_, i) => { h[`vis:${i}`] = () => { this.state.visMode = i; this.persist(); }; });
    return h;
  }
  showVisMenu() { this.menu(this.visSubmenu(), this.visHandlers()); }

  showEqPresets() {
    const user = this.settings.eqPresets || {};
    const tpl = [
      { label: 'Load', submenu: [
        ...Object.keys(EQ_PRESETS).map((n) => ({ id: `p:${n}`, label: n })),
        ...(Object.keys(user).length ? [{ type: 'separator' }, ...Object.keys(user).map((n) => ({ id: `u:${n}`, label: n }))] : []),
      ] },
      { id: 'save', label: 'Save current as preset…' },
      ...(Object.keys(user).length ? [{ label: 'Delete preset', submenu: Object.keys(user).map((n) => ({ id: `d:${n}`, label: n })) }] : []),
      { type: 'separator' },
      { id: 'reset', label: 'Reset to flat' },
    ];
    const h = {
      save: async () => {
        const name = await this.prompt('Save EQ preset', 'Preset name:', '');
        if (!name) return;
        this.settings.eqPresets = { ...user, [name]: { bands: [...this.state.eq.bands], preamp: this.state.eq.preamp } };
        R.setSettings({ eqPresets: this.settings.eqPresets });
      },
      reset: () => this.applyEq(EQ_PRESETS.Flat, 0),
    };
    Object.keys(EQ_PRESETS).forEach((n) => { h[`p:${n}`] = () => this.applyEq(EQ_PRESETS[n], 0); });
    Object.keys(user).forEach((n) => {
      h[`u:${n}`] = () => this.applyEq(user[n].bands, user[n].preamp);
      h[`d:${n}`] = () => { const u = { ...user }; delete u[n]; this.settings.eqPresets = u; R.setSettings({ eqPresets: u }); };
    });
    this.menu(tpl, h);
  }

  showPlAddMenu() {
    this.menu([{ id: 'file', label: 'Add file(s)…' }, { id: 'dir', label: 'Add folder…' }, { id: 'url', label: 'Add URL…' }, { type: 'separator' }, { id: 'lib', label: 'Add from Media Library…' }],
      { file: () => this.openFiles(false), dir: () => this.openFolder(false), url: () => this.openUrl(), lib: () => this.openLibrary() });
  }
  showPlRemoveMenu() {
    this.menu([{ id: 'sel', label: 'Remove selected', accelerator: 'Delete' }, { id: 'crop', label: 'Crop (keep selected)' }, { id: 'dup', label: 'Remove duplicates' }, { type: 'separator' }, { id: 'all', label: 'Remove all' }],
      { sel: () => this.removeSelected(), crop: () => this.cropSelected(), dup: () => this.removeDuplicates(), all: () => this.clearPlaylist() });
  }
  showPlSelectMenu() {
    this.menu([{ id: 'all', label: 'Select all', accelerator: 'Ctrl+A' }, { id: 'none', label: 'Select none' }, { id: 'inv', label: 'Invert selection' }],
      { all: () => this.selectAll(), none: () => this.select([]), inv: () => this.invertSelection() });
  }
  showPlMiscMenu() {
    this.menu([
      { label: 'Sort list', submenu: [{ id: 'st', label: 'By title' }, { id: 'sf', label: 'By file name' }, { id: 'sp', label: 'By path and file name' }, { id: 'sa', label: 'By artist / album / track' }, { type: 'separator' }, { id: 'rev', label: 'Reverse list' }, { id: 'rnd', label: 'Randomize list' }] },
      { id: 'info', label: 'File info…', accelerator: 'Alt+3' },
      { id: 'show', label: 'Show in folder' },
    ], {
      st: () => this.sortBy('title'), sf: () => this.sortBy('file'), sp: () => this.sortBy('path'), sa: () => this.sortBy('album'),
      rev: () => this.reverse(), rnd: () => this.randomize(), info: () => this.openTool('info'),
      show: () => { const i = [...this.state.selected][0] ?? this.state.current; const t = this.state.playlist[i]; if (t?.path) R.showInFolder(t.path); },
    });
  }
  showPlListMenu() {
    this.menu([{ id: 'new', label: 'New list' }, { id: 'load', label: 'Load list…' }, { id: 'save', label: 'Save list…' }, { type: 'separator' }, { id: 'mix', label: 'Save as mixtape…' }, { id: 'browse', label: 'Browse mixtapes' }],
      { new: () => this.clearPlaylist(), load: () => this.loadPlaylistFile(), save: () => this.savePlaylistFile(), mix: () => this.saveAsMixtape(),
        browse: async () => { this.setPlMode('browse'); await this.browser.open(); this.browser.home(); await this.browser.push(this.browser.mixtapesLevel()); } });
  }
  showPlaylistMenu() {
    const n = this.state.selected.size;
    const mxSel = this.mixtapeSubmenu(async () => [...this.state.selected].sort((a, b) => a - b).map((i) => this.state.playlist[i]));
    this.menu([
      { id: 'play', label: 'Play item', enabled: n > 0 },
      { id: 'info', label: 'File info…', enabled: n > 0 },
      { id: 'show', label: 'Show in folder', enabled: n > 0 },
      { type: 'separator' },
      { id: 'rem', label: 'Remove selected', enabled: n > 0 },
      { id: 'crop', label: 'Crop', enabled: n > 0 },
      { type: 'separator' },
      { label: 'Add selected to mixtape', enabled: n > 0, submenu: mxSel.submenu },
      { id: 'mixall', label: 'Save playlist as mixtape…', enabled: this.state.playlist.length > 0 },
      { type: 'separator' },
      { id: 'add', label: 'Add files…' },
      { id: 'save', label: 'Save list…' },
    ], {
      ...mxSel.handlers, mixall: () => this.saveAsMixtape(),
      play: () => this.playIndex([...this.state.selected][0]), info: () => this.openTool('info'),
      show: () => { const t = this.state.playlist[[...this.state.selected][0]]; if (t?.path) R.showInFolder(t.path); },
      rem: () => this.removeSelected(), crop: () => this.cropSelected(), add: () => this.openFiles(false), save: () => this.savePlaylistFile(),
    });
  }
  async loadPlaylistFile() { const items = await R.openPlaylist(); if (items) this.addTracks(items, { replace: true }); }
  async savePlaylistFile() {
    const items = this.state.playlist.map((t) => ({ path: t.path, url: t.url, duration: t.duration, displayTitle: this.trackTitle(t) }));
    R.savePlaylist(items);
  }

  // ---------------- browse tab, sources, endless shuffle ----------------
  setPlMode(m) {
    this.state.plMode = m === 'browse' ? 'browse' : 'playlist';
    if (this.state.plMode === 'browse') this.browser.open();
    this.pl.list._key = null; this.pl.tabs._key = null;
    this.pl.renderList(); this.persist();
  }
  browserRefreshIf(test) {
    const b = this.browser;
    if (!b.stack.length) return;
    if (test(b.level)) b.refreshLevel();
    else for (const l of b.stack) if (test(l)) l.items = null; // reload when revisited
  }
  flashMsg(text, ms = 1600) { this.main.flash(String(text).toUpperCase().slice(0, 31)); clearTimeout(this.flashT); this.flashT = setTimeout(() => this.main.flash(null), ms); }
  async playList(tracks, start = 0, { shuffle = false } = {}) {
    let list = tracks.filter((t) => !t.missing);
    if (!list.length) { this.flashMsg('NOTHING TO PLAY'); return; }
    if (shuffle) { list = [...list]; for (let i = list.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [list[i], list[j]] = [list[j], list[i]]; } start = 0; }
    else start = Math.max(0, list.indexOf(tracks[start]));
    await this.addTracks(list, { replace: true });
    this.playIndex(start);
  }
  // Mixtape refs → playable tracks (server songs get a fresh stream address).
  async resolveRefs(refs) {
    await this.sources.load();
    return Promise.all(refs.map(async (r) => {
      if (r.server && r.songId) {
        const s = this.sources.server(r.server);
        if (!s) return { ...r, missing: true };
        return { ...r, url: await s.streamUrl(r.songId) };
      }
      return { ...r };
    }));
  }
  trackKey(t) { return t.server ? `${t.server}:${t.songId}` : t.path || t.url; }
  // Shuffle all: random songs from a whole source, topped up as you listen.
  async startEndless(src) {
    this.flashMsg(`SHUFFLE ALL: ${src.name}`);
    const endless = { src, seen: new Set() };
    this.endless = endless;
    const batch = await this.fetchEndless(endless, 50);
    if (this.endless !== endless) return;
    if (!batch.length) { this.endless = null; this.flashMsg('NO SONGS FOUND'); return; }
    await this.addTracks(batch, { replace: true, keepEndless: true });
    this.playIndex(0);
  }
  async fetchEndless(endless, n) {
    let songs = [];
    try { songs = await endless.src.randomSongs(n, endless.seen); } catch (e) { console.error(e); }
    songs.forEach((t) => endless.seen.add(this.trackKey(t)));
    return songs;
  }
  async topUpEndless() {
    const e = this.endless, st = this.state;
    if (!e || e.busy || st.current < st.playlist.length - 10) return;
    e.busy = true;
    const more = await this.fetchEndless(e, 40);
    e.busy = false;
    if (this.endless !== e || !more.length) return;
    await this.addTracks(more, { keepEndless: true });
    // keep the queue from growing forever: drop songs played long ago
    const drop = st.current - 150;
    if (drop > 0) this.removeIndices(Array.from({ length: drop }, (_, k) => k));
  }

  // ---------------- mixtapes ----------------
  async newMixtape(tracks = []) {
    const name = await this.prompt('New mixtape', 'Name your mixtape:', '', 'e.g. Road Trip, Sunday Morning');
    if (name === null) return null;
    const m = await this.mixtapes.create(name || this.mixtapes.nextName(), tracks);
    this.flashMsg(tracks.length ? `SAVED ${tracks.length} TO ${m.name}` : `CREATED ${m.name}`);
    return m;
  }
  async addToMixtape(id, tracks) {
    const n = await this.mixtapes.add(id, tracks);
    const m = this.mixtapes.get(id);
    this.flashMsg(n ? `+${n} TO ${m.name}` : `ALREADY ON ${m.name}`);
  }
  // menu entries for "Add to mixtape ▸"; get(): resolves to the tracks
  mixtapeSubmenu(get, prefix = 'mx') {
    const items = this.mixtapes.list.map((m) => ({ id: `${prefix}:${m.id}`, label: `${m.name}  (${m.tracks.length})` }));
    const handlers = {};
    for (const m of this.mixtapes.list) handlers[`${prefix}:${m.id}`] = async () => this.addToMixtape(m.id, await get());
    handlers[`${prefix}:new`] = async () => this.newMixtape(await get());
    return { submenu: [...items, ...(items.length ? [{ type: 'separator' }] : []), { id: `${prefix}:new`, label: 'New mixtape…' }], handlers };
  }
  async saveAsMixtape() {
    if (!this.state.playlist.length) { this.flashMsg('PLAYLIST IS EMPTY'); return; }
    await this.newMixtape(this.state.playlist);
  }
  async renameMixtape(id) {
    const m = this.mixtapes.get(id); if (!m) return;
    const name = await this.prompt('Rename mixtape', 'New name:', m.name);
    if (name) await this.mixtapes.rename(id, name);
  }
  async deleteMixtape(id) {
    const m = this.mixtapes.get(id); if (!m) return;
    const r = await R.message({ type: 'question', buttons: ['Delete', 'Cancel'], defaultId: 1, cancelId: 1, message: `Delete the mixtape “${m.name}”?`, detail: 'The songs themselves are not affected.' });
    if (r.response !== 0) return;
    await this.mixtapes.remove(id);
    if (this.browser.level && this.browser.level.mixtape === id) this.browser.back();
  }

  async showBrowseMenu(it, i) {
    const b = this.browser;
    if (it.kind === 'info' || it.kind === 'up') return;
    if (it.kind === 'action') { this.menu([{ id: 'run', label: it.label.replace(/^[^\w]+/, '') }], { run: () => it.run() }); return; }
    const getTracks = async () => (it.kind === 'song' ? [it.track] : it.tracks ? it.tracks() : []);
    const mx = this.mixtapeSubmenu(getTracks);
    const tpl = [], h = { ...mx.handlers };
    if (it.kind === 'song') {
      tpl.push({ id: 'play', label: 'Play from here' }, { id: 'one', label: 'Play just this song' });
      h.play = () => b.activate(i); h.one = () => this.playList([it.track], 0);
    } else if (it.kind === 'folder' && it.tracks) {
      tpl.push({ id: 'play', label: 'Play' }, { id: 'shuf', label: 'Shuffle' });
      h.play = async () => this.playList(await getTracks(), 0); h.shuf = async () => this.playList(await getTracks(), 0, { shuffle: true });
    } else if (it.kind === 'folder') {
      tpl.push({ id: 'open', label: 'Open' }); h.open = () => b.activate(i);
    }
    if (it.kind === 'song' || it.tracks) {
      tpl.push({ id: 'next', label: 'Play next' }, { id: 'add', label: 'Add to playlist' }, { label: 'Add to mixtape', submenu: mx.submenu });
      h.next = async () => { const t = await getTracks(); await this.addTracks(t, { at: Math.max(0, this.state.current + 1) }); this.flashMsg(`PLAYING NEXT: ${t.length}`); };
      h.add = async () => { const t = await getTracks(); await this.addTracks(t); this.flashMsg(`ADDED ${t.length} TO PLAYLIST`); };
    }
    if (it.kind === 'folder' && it.mixtape) {
      tpl.push({ type: 'separator' }, { id: 'ren', label: 'Rename mixtape…' }, { id: 'del', label: 'Delete mixtape…' });
      h.ren = () => this.renameMixtape(it.mixtape); h.del = () => this.deleteMixtape(it.mixtape);
    }
    if (it.kind === 'song' && it.mixtape) {
      const m = this.mixtapes.get(it.mixtape);
      tpl.push({ type: 'separator' },
        { id: 'up', label: 'Move up', enabled: it.index > 0 }, { id: 'down', label: 'Move down', enabled: m && it.index < m.tracks.length - 1 },
        { id: 'rm', label: 'Remove from mixtape' });
      h.up = async () => { await this.mixtapes.move(it.mixtape, it.index, -1); b.sel = Math.max(0, b.sel - 1); };
      h.down = async () => { await this.mixtapes.move(it.mixtape, it.index, 1); b.sel = b.sel + 1; };
      h.rm = () => this.mixtapes.removeAt(it.mixtape, it.index);
    }
    if (it.track && it.track.path) { tpl.push({ type: 'separator' }, { id: 'show', label: 'Show in folder' }); h.show = () => R.showInFolder(it.track.path); }
    this.menu(tpl, h);
  }

  browseKeys(k, e) {
    const b = this.browser, n = b.items.length, page = this.pl.visibleRows();
    const go = (i) => { b.sel = Math.max(0, Math.min(n - 1, i)); this.pl.ensureVisible(b.sel, true); this.pl.renderList(); };
    const map = {
      arrowdown: () => go(b.sel + 1), arrowup: () => go(b.sel - 1), pagedown: () => go(b.sel + page), pageup: () => go(b.sel - page),
      home: () => go(0), end: () => go(n - 1), enter: () => b.activate(), backspace: () => b.back(),
      arrowright: () => { const it = b.items[b.sel]; if (it && (it.kind === 'folder' || it.kind === 'up')) b.activate(); else return false; },
      arrowleft: () => (b.stack.length > 1 ? b.back() : false),
    };
    if (!map[k]) return false;
    if (map[k]() === false) return false;
    e.preventDefault();
    return true;
  }

  // ---------------- keyboard ----------------
  bindKeys() {
    const handler = (e) => {
      if (e.target.closest && e.target.closest('input, textarea')) return;
      const k = e.key.toLowerCase(), c = e.ctrlKey || e.metaKey, a = e.altKey, s = e.shiftKey;
      const act = (fn) => { e.preventDefault(); fn(); };
      if (a && k === 'g') return act(() => this.toggleEqWindow());
      if (a && k === 'e') return act(() => this.togglePlWindow());
      if (a && k === 'l') return act(() => this.openLibrary());
      if (a && k === '3') return act(() => this.openTool('info'));
      if (c && s && k === 'k') return act(() => this.openMilkdrop());
      if (c && s && k === 't') return act(() => this.openStudio());
      if (c && k === 'd') return act(() => this.toggleDouble());
      if (c && (k === '=' || k === '+')) return act(() => this.scaleStep(1));
      if (c && (k === '-' || k === '_')) return act(() => this.scaleStep(-1));
      if (c && k === '0') return act(() => this.setScale(this.baseK));
      if (c && k === 'w') return act(() => this.toggleShade());
      if (c && k === 't') return act(() => this.toggleTimeMode());
      if (c && k === 'l') return act(() => this.openUrl());
      if (c && k === 'a') return act(() => (this.state.plVisible ? this.selectAll() : this.toggleOnTop()));
      if (c && k === 'o') return act(() => this.openFiles(true));
      if (c && k === 's') return act(() => this.savePlaylistFile());
      if (c || a) return;
      if (this.state.plVisible && this.state.plMode === 'browse' && this.browseKeys(k, e)) return;
      if (k === 'tab' && this.state.plVisible) return act(() => this.setPlMode(this.state.plMode === 'browse' ? 'playlist' : 'browse'));
      const map = {
        z: () => this.prev(), x: () => this.play(), c: () => this.pause(), v: () => (s ? this.stop() : this.stop()), b: () => this.next(),
        l: () => (s ? this.openFolder(true) : this.openFiles(true)), j: () => this.openTool('jump'), r: () => this.toggleRepeat(), s: () => this.toggleShuffle(),
        arrowleft: () => this.seekBy(-5), arrowright: () => this.seekBy(5),
        arrowup: () => { if (this.state.selected.size && this.state.plVisible && document.activeElement !== document.body) return; this.setVolume(this.state.volume + 2); },
        arrowdown: () => this.setVolume(this.state.volume - 2),
        delete: () => this.removeSelected(), enter: () => { const i = [...this.state.selected][0]; if (i !== undefined) this.playIndex(i); },
        ' ': () => this.pause(), pageup: () => this.pl.scrollBy(-this.pl.visibleRows()), pagedown: () => this.pl.scrollBy(this.pl.visibleRows()),
        home: () => this.pl.scrollBy(-1e9), end: () => this.pl.scrollBy(1e9),
      };
      if (map[k]) act(map[k]);
    };
    this.keyHandler = handler;
    window.addEventListener('keydown', handler);
  }

  bindDrop() {
    document.addEventListener('dragover', (e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; });
    document.addEventListener('drop', async (e) => {
      e.preventDefault();
      const internal = e.dataTransfer.getData('application/x-wavedeck-tracks');
      if (internal) { this.addTracks(JSON.parse(internal)); return; }
      const paths = [...e.dataTransfer.files].map((f) => R.pathForFile(f)).filter(Boolean);
      if (!paths.length) return;
      const onPlaylist = e.target.closest && e.target.closest('#pl');
      const skins = paths.filter((p) => SKIN_RE.test(p));
      if (skins.length) { await this.loadSkinFile(skins[0]); return; }
      const files = await R.expand(paths);
      this.addTracks(files, { play: !onPlaylist, replace: !onPlaylist && !e.shiftKey });
    });
  }

  // ---------------- loop ----------------
  loop() {
    const tick = () => {
      this.main.frame();
      this.pl.drawStatus();
      if (this.state.status === 'playing') this.emit('tick', { time: this.engine.time, duration: this.engine.duration });
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }

  // ---------------- events / public API ----------------
  on(ev, fn) { (this.listeners[ev] ||= new Set()).add(fn); return () => this.listeners[ev].delete(fn); }
  emit(ev, data) { this.listeners[ev]?.forEach((fn) => { try { fn(data); } catch (e) { console.error(e); } }); }
  publicTrack(t) { if (!t) return null; const { id, ...rest } = t; return { ...rest, displayTitle: this.trackTitle(t) }; }

  publicApi() {
    const app = this;
    return {
      app,
      engine: this.engine,
      addTracks: (items, opts) => app.addTracks(items, opts),
      playIndex: (i) => app.playIndex(i),
      getPlaylist: () => app.state.playlist.map((t) => app.publicTrack(t)),
      getSelected: () => [...app.state.selected].map((i) => app.publicTrack(app.state.playlist[i])),
      getCurrent: () => app.publicTrack(app.currentTrack()),
      getState: () => ({ status: app.state.status, current: app.state.current, volume: app.state.volume, time: app.engine.time, duration: app.engine.duration }),
      levels: () => app.engine.levels(),
      skin: () => ({ name: app.skin.name, libraryCss: app.skin.libraryCss, pledit: app.skin.pledit, viscolors: app.skin.viscolors }),
      on: (ev, fn) => app.on(ev, fn),
      control: (cmd) => app[cmd] && app[cmd](),
      mixtapes: () => app.mixtapes.list.map((m) => ({ id: m.id, name: m.name, count: m.tracks.length })),
      addToMixtape: (id, tracks) => app.addToMixtape(id, tracks),
      createMixtape: (name, tracks) => app.mixtapes.create(name, tracks),
      nextMixtapeName: () => app.mixtapes.nextName(),
      // used by the Media Library window (works with classic and modern skins)
      mixtapeList: () => app.mixtapes.list.map((m) => ({ id: m.id, name: m.name, count: m.tracks.length, duration: m.tracks.reduce((s, t) => s + (t.duration || 0), 0) })),
      mixtapeTracks: async (id) => app.resolveRefs(app.mixtapes.get(id)?.tracks || []),
      renameMixtape: (id, name) => app.mixtapes.rename(id, name),
      deleteMixtape: (id) => app.mixtapes.remove(id),
      removeFromMixtape: async (id, indices) => { for (const i of [...indices].sort((a, b) => b - a)) await app.mixtapes.removeAt(id, i); },
      playList: (tracks, start, opts) => app.playList(tracks, start, opts),
      shuffleAll: async (sourceId) => {
        await app.sources.load();
        const src = app.sources.all().find((x) => x.id === sourceId);
        if (src && (src.kind !== 'subsonic' || await app.sources.connect(src))) await app.startEndless(src);
      },
    };
  }

  async loadPlugins() {
    this.plugins = [];
    let list = [];
    try { list = await R.plugins.list(); } catch { return; }
    const disabled = new Set(this.settings.disabledPlugins || []);
    for (const p of list) {
      if (disabled.has(p.id)) continue;
      try {
        const mod = await import(p.url);
        const activate = mod.default || mod.activate;
        if (typeof activate !== 'function') throw new Error('plugin has no default export');
        await activate(this.pluginApi(p));
        this.plugins.push(p);
      } catch (e) { console.error(`Plugin ${p.id} failed:`, e); }
    }
  }

  pluginApi(p) {
    const app = this;
    const store = () => (app.settings.pluginStorage ||= {})[p.id] ||= {};
    return Object.freeze({
      id: p.id, name: p.name,
      player: {
        play: () => app.play(), pause: () => app.pause(), stop: () => app.stop(), next: () => app.next(), prev: () => app.prev(),
        seek: (s) => app.seekTo(s), setVolume: (v) => app.setVolume(v),
        getCurrentTrack: () => app.publicTrack(app.currentTrack()),
        getState: () => ({ status: app.state.status, time: app.engine.time, duration: app.engine.duration, volume: app.state.volume }),
        getPlaylist: () => app.state.playlist.map((t) => app.publicTrack(t)),
        addTracks: (items, opts) => app.addTracks(items, opts),
        on: (ev, fn) => app.on(ev, fn),
      },
      audio: {
        context: () => { app.engine.ensureGraph(); return app.engine.ctx; },
        getSpectrum: () => app.engine.spectrum(),
        getWaveform: () => app.engine.waveform(),
        setEffectChain: (build) => app.engine.setEffectChain(build),
      },
      vis: { register: (mode) => registerVisMode(mode) },
      ui: {
        addMenuItem: (label, fn) => app.pluginMenu.push({ label: `${p.name}: ${label}`, fn }),
        notify: (text, ms = 2000) => { app.main.flash(String(text).slice(0, 31)); setTimeout(() => app.main.flash(null), ms); },
      },
      storage: {
        get: (k) => store()[k],
        set: (k, v) => { store()[k] = v; R.setSettings({ pluginStorage: app.settings.pluginStorage }); },
      },
      files: { writeText: (name, text) => R.plugins.writeText(p.id, name, text) },
    });
  }
}

const app = new App();
window.addEventListener('DOMContentLoaded', () => app.init());
export default app;
