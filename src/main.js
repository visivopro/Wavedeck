// Wavedeck — main process
// Windows, custom protocols, file access, media library, settings and plugins.
const {
  app, BrowserWindow, ipcMain, dialog, protocol, globalShortcut, shell, session, Menu, screen,
} = require('electron');
const path = require('path');
const fs = require('fs');
const fsp = fs.promises;
const crypto = require('crypto');
const { Readable } = require('stream');

const AUDIO_EXT = ['.mp3', '.flac', '.ogg', '.oga', '.opus', '.wav', '.m4a', '.aac', '.mp4', '.webm', '.wma'];
const PLAYLIST_EXT = ['.m3u', '.m3u8', '.pls'];
const MODERN_EXT = ['.wal', '.wmz', '.sgf', '.kjofol', '.face', '.uib', '.jsk'];
const SKIN_EXT = ['.wsz', '.wdskin', '.rwskin', '.zip', ...MODERN_EXT];
const MIME = {
  '.mp3': 'audio/mpeg', '.flac': 'audio/flac', '.ogg': 'audio/ogg', '.oga': 'audio/ogg', '.opus': 'audio/ogg',
  '.wav': 'audio/wav', '.m4a': 'audio/mp4', '.aac': 'audio/aac', '.mp4': 'audio/mp4', '.webm': 'audio/webm',
  '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css',
  '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.ico': 'image/x-icon',
};

const RENDERER = path.join(__dirname, 'renderer');
const BUNDLED_PLUGINS = path.join(__dirname, '..', 'plugins');
const BUNDLED_SKINS = path.join(__dirname, '..', 'skins');

protocol.registerSchemesAsPrivileged([
  { scheme: 'app', privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true } },
  { scheme: 'media', privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true, stream: true, bypassCSP: true } },
]);

if (!app.requestSingleInstanceLock()) { app.quit(); }

let mainWin = null;
const userDir = () => app.getPath('userData');
const skinsDir = () => path.join(userDir(), 'Skins');
const pluginsDir = () => path.join(userDir(), 'Plugins');
const pluginDataDir = () => path.join(userDir(), 'PluginData');

// ---------- settings ----------
const settingsFile = () => path.join(userDir(), 'settings.json');
let settings = {};
function loadSettings() {
  try { settings = JSON.parse(fs.readFileSync(settingsFile(), 'utf8')); } catch { settings = {}; }
}
let saveTimer = null;
function saveSettings() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    fs.writeFile(settingsFile(), JSON.stringify(settings, null, 2), () => {});
  }, 300);
}

// ---------- helpers ----------
const isAudio = (p) => AUDIO_EXT.includes(path.extname(p).toLowerCase());
const broadcast = (ch, ...args) => BrowserWindow.getAllWindows().forEach((w) => w.webContents.send(ch, ...args));

async function walk(dir, out, exts = AUDIO_EXT) {
  let entries;
  try { entries = await fsp.readdir(dir, { withFileTypes: true }); } catch { return out; }
  for (const e of entries) {
    if (e.name.startsWith('.')) continue;
    const full = path.join(dir, e.name);
    if (e.isDirectory()) await walk(full, out, exts);
    else if (exts.includes(path.extname(e.name).toLowerCase())) out.push(full);
  }
  return out;
}

async function expandPaths(paths) {
  const out = [];
  for (const p of paths) {
    try {
      const st = await fsp.stat(p);
      if (st.isDirectory()) { const files = await walk(p, []); files.sort((a, b) => a.localeCompare(b, undefined, { numeric: true })); out.push(...files); }
      else if (isAudio(p)) out.push(p);
      else if (PLAYLIST_EXT.includes(path.extname(p).toLowerCase())) out.push(...(await readPlaylist(p)).map((i) => i.path || i.url));
    } catch { /* skip */ }
  }
  return out;
}

let mm = null;
function musicMetadata() { if (!mm) mm = require('music-metadata'); return mm; }

async function readMeta(file) {
  try {
    const m = await musicMetadata().parseFile(file, { duration: false, skipCovers: true });
    const c = m.common, f = m.format;
    return {
      title: c.title || null,
      artist: c.artist || null,
      albumartist: c.albumartist || null,
      album: c.album || null,
      track: c.track && c.track.no ? c.track.no : null,
      disc: c.disk && c.disk.no ? c.disk.no : null,
      year: c.year || null,
      genre: c.genre && c.genre[0] ? c.genre[0] : null,
      duration: f.duration || null,
      bitrate: f.bitrate ? Math.round(f.bitrate / 1000) : null,
      sampleRate: f.sampleRate || null,
      channels: f.numberOfChannels || null,
      codec: f.codec || f.container || null,
      lossless: !!f.lossless,
    };
  } catch {
    return { title: null, artist: null, album: null, duration: null };
  }
}

async function pool(items, n, fn) {
  let i = 0;
  const workers = Array.from({ length: Math.min(n, items.length) }, async () => {
    while (i < items.length) { const idx = i++; await fn(items[idx], idx); }
  });
  await Promise.all(workers);
}

// ---------- playlists ----------
async function readPlaylist(file) {
  const text = await fsp.readFile(file, 'utf8');
  const base = path.dirname(file);
  const ext = path.extname(file).toLowerCase();
  const items = [];
  const resolve = (s) => {
    s = s.trim();
    if (/^https?:\/\//i.test(s)) return { url: s };
    if (s.startsWith('file://')) return { path: decodeURIComponent(s.replace(/^file:\/\/\/?/, '')) };
    return { path: path.isAbsolute(s) || /^[a-zA-Z]:[\\/]/.test(s) || s.startsWith('\\\\') ? s : path.join(base, s) };
  };
  if (ext === '.pls') {
    const files = {}, titles = {};
    for (const line of text.split(/\r?\n/)) {
      let m = line.match(/^File(\d+)=(.*)$/i); if (m) files[m[1]] = m[2];
      m = line.match(/^Title(\d+)=(.*)$/i); if (m) titles[m[1]] = m[2];
    }
    Object.keys(files).sort((a, b) => a - b).forEach((k) => items.push({ ...resolve(files[k]), title: titles[k] || null }));
  } else {
    let pendingTitle = null, pendingDur = null;
    for (const line of text.split(/\r?\n/)) {
      if (!line.trim()) continue;
      const m = line.match(/^#EXTINF:(-?\d+),(.*)$/);
      if (m) { pendingDur = +m[1] > 0 ? +m[1] : null; pendingTitle = m[2]; continue; }
      if (line.startsWith('#')) continue;
      items.push({ ...resolve(line), displayTitle: pendingTitle, duration: pendingDur });
      pendingTitle = pendingDur = null;
    }
  }
  return items;
}

async function writePlaylist(file, items) {
  const ext = path.extname(file).toLowerCase();
  let out;
  if (ext === '.pls') {
    out = '[playlist]\r\n' + items.map((t, i) => `File${i + 1}=${t.path || t.url}\r\nTitle${i + 1}=${t.displayTitle || ''}\r\nLength${i + 1}=${Math.round(t.duration || -1)}`).join('\r\n') + `\r\nNumberOfEntries=${items.length}\r\nVersion=2\r\n`;
  } else {
    out = '#EXTM3U\r\n' + items.map((t) => `#EXTINF:${Math.round(t.duration || -1)},${t.displayTitle || ''}\r\n${t.path || t.url}`).join('\r\n') + '\r\n';
  }
  await fsp.writeFile(file, out, 'utf8');
}

// ---------- media library ----------
const libFile = () => path.join(userDir(), 'library.json');
let library = null;
function loadLibrary() {
  if (library) return library;
  try { library = JSON.parse(fs.readFileSync(libFile(), 'utf8')); } catch { library = null; }
  if (!library || typeof library !== 'object') library = {};
  library.folders = library.folders || [];
  library.tracks = library.tracks || {};
  library.servers = library.servers || [];
  return library;
}
function saveLibrary() { return fsp.writeFile(libFile(), JSON.stringify(library)); }

let scanning = false;
async function scanLibrary() {
  if (scanning) return { busy: true };
  scanning = true;
  const lib = loadLibrary();
  const seen = new Set();
  let added = 0, updated = 0, removed = 0;
  try {
    broadcast('lib:progress', { phase: 'listing', done: 0, total: 0 });
    const files = [];
    const reachable = [];
    for (const folder of lib.folders) {
      try { await fsp.access(folder); reachable.push(folder); await walk(folder, files); } catch { /* offline share */ }
    }
    const todo = [];
    await pool(files, 16, async (f) => {
      seen.add(f);
      try {
        const st = await fsp.stat(f);
        const prev = lib.tracks[f];
        if (!prev || prev.mtime !== st.mtimeMs || prev.size !== st.size) todo.push({ f, st, isNew: !prev });
      } catch { /* gone */ }
    });
    let done = 0;
    broadcast('lib:progress', { phase: 'reading', done, total: todo.length });
    await pool(todo, 6, async ({ f, st, isNew }) => {
      const meta = await readMeta(f);
      lib.tracks[f] = { ...meta, mtime: st.mtimeMs, size: st.size, added: lib.tracks[f]?.added || Date.now() };
      isNew ? added++ : updated++;
      done++;
      if (done % 40 === 0) broadcast('lib:progress', { phase: 'reading', done, total: todo.length });
    });
    for (const p of Object.keys(lib.tracks)) {
      const inReachable = reachable.some((r) => p.toLowerCase().startsWith(r.toLowerCase()));
      const inAny = lib.folders.some((r) => p.toLowerCase().startsWith(r.toLowerCase()));
      if ((inReachable && !seen.has(p)) || !inAny) { delete lib.tracks[p]; removed++; }
    }
    await saveLibrary();
  } finally {
    scanning = false;
  }
  const result = { added, updated, removed, total: Object.keys(lib.tracks).length };
  broadcast('lib:progress', { phase: 'done', ...result });
  broadcast('lib:changed');
  return result;
}

// ---------- skins ----------
async function listSkins() {
  const out = [];
  for (const dir of [BUNDLED_SKINS, skinsDir()]) {
    try {
      for (const f of await fsp.readdir(dir)) {
        if (SKIN_EXT.includes(path.extname(f).toLowerCase())) out.push({ name: path.basename(f, path.extname(f)), file: path.join(dir, f) });
      }
    } catch { /* none */ }
  }
  return out.sort((a, b) => a.name.localeCompare(b.name));
}

// ---------- plugins ----------
async function listPlugins() {
  const out = [];
  for (const [dir, kind] of [[BUNDLED_PLUGINS, 'bundled'], [pluginsDir(), 'user']]) {
    let names = [];
    try { names = await fsp.readdir(dir); } catch { continue; }
    for (const n of names) {
      try {
        const manifest = JSON.parse(await fsp.readFile(path.join(dir, n, 'plugin.json'), 'utf8'));
        out.push({
          id: n, kind, name: manifest.name || n, version: manifest.version || '',
          description: manifest.description || '', author: manifest.author || '',
          url: `app://wavedeck/__plugins/${kind}/${encodeURIComponent(n)}/${manifest.main || 'index.js'}`,
        });
      } catch { /* not a plugin */ }
    }
  }
  return out;
}

// ---------- protocols ----------
function registerProtocols() {
  protocol.handle('app', async (req) => {
    const u = new URL(req.url);
    let rel = decodeURIComponent(u.pathname).replace(/^\/+/, '');
    let file;
    const pm = rel.match(/^__plugins\/(bundled|user)\/(.+)$/);
    if (pm) {
      const root = pm[1] === 'bundled' ? BUNDLED_PLUGINS : pluginsDir();
      file = path.normalize(path.join(root, pm[2]));
      if (!file.startsWith(path.normalize(root))) return new Response('forbidden', { status: 403 });
    } else {
      if (!rel) rel = 'index.html';
      file = path.normalize(path.join(RENDERER, rel));
      if (!file.startsWith(RENDERER)) return new Response('forbidden', { status: 403 });
    }
    try {
      const data = await fsp.readFile(file);
      return new Response(data, { headers: { 'content-type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream' } });
    } catch {
      return new Response('not found', { status: 404 });
    }
  });

  // media://local/?p=<absolute path>  — streams local audio with Range support + CORS so the analyser can read it
  protocol.handle('media', async (req) => {
    const u = new URL(req.url);
    const file = u.searchParams.get('p');
    let st;
    try { st = await fsp.stat(file); } catch { return new Response('not found', { status: 404 }); }
    const type = MIME[path.extname(file).toLowerCase()] || 'application/octet-stream';
    const headers = { 'content-type': type, 'accept-ranges': 'bytes', 'access-control-allow-origin': '*' };
    const range = req.headers.get('range');
    if (range) {
      const m = range.match(/bytes=(\d*)-(\d*)/);
      let start = m && m[1] ? parseInt(m[1], 10) : 0;
      let end = m && m[2] ? parseInt(m[2], 10) : st.size - 1;
      if (start >= st.size) return new Response(null, { status: 416, headers: { 'content-range': `bytes */${st.size}` } });
      end = Math.min(end, st.size - 1);
      const stream = fs.createReadStream(file, { start, end });
      return new Response(Readable.toWeb(stream), {
        status: 206,
        headers: { ...headers, 'content-range': `bytes ${start}-${end}/${st.size}`, 'content-length': String(end - start + 1) },
      });
    }
    return new Response(Readable.toWeb(fs.createReadStream(file)), { status: 200, headers: { ...headers, 'content-length': String(st.size) } });
  });
}

// ---------- windows ----------
function childWindowOptions(features) {
  const kind = /library/.test(features) ? 'library' : /milkdrop/.test(features) ? 'milkdrop' : 'other';
  const base = {
    backgroundColor: '#0d0f14',
    autoHideMenuBar: true,
    title: 'Wavedeck',
    icon: path.join(__dirname, '..', 'build', 'icon.png'),
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, sandbox: false },
  };
  if (kind === 'library') {
    const b = settings.libraryBounds || {};
    return { ...base, width: b.width || 1100, height: b.height || 700, x: b.x, y: b.y, minWidth: 720, minHeight: 420, title: 'Wavedeck — Media Library' };
  }
  if (kind === 'milkdrop') {
    const b = settings.milkdropBounds || {};
    return { ...base, width: b.width || 640, height: b.height || 420, x: b.x, y: b.y, minWidth: 240, minHeight: 160, backgroundColor: '#000000', title: 'Wavedeck — Visualization' };
  }
  if (/modern\.html/.test(features)) {
    // Modern skins can be any shape: a transparent, click-through layer over the desktop.
    const d = screen.getDisplayMatching(mainWin ? mainWin.getBounds() : screen.getPrimaryDisplay().bounds);
    const wa = d.workArea;
    return {
      ...base, x: wa.x, y: wa.y, width: wa.width, height: wa.height,
      frame: false, transparent: true, backgroundColor: '#00000000', hasShadow: false, resizable: false, movable: false,
      maximizable: false, minimizable: true, fullscreenable: false, skipTaskbar: false, alwaysOnTop: !!settings.alwaysOnTop,
      title: 'Wavedeck', webPreferences: { ...base.webPreferences, backgroundThrottling: false },
    };
  }
  const sizes = { jump: [460, 520], info: [480, 560], about: [420, 400], studio: [470, 860] };
  const name = Object.keys(sizes).find((k) => features.includes(k + '.html'));
  const [w, h] = sizes[name] || [520, 420];
  let pos = {};
  if (name === 'studio' && mainWin) {
    // open beside the player so the live preview stays visible
    const b = mainWin.getBounds(), wa = screen.getDisplayMatching(b).workArea;
    const right = b.x + b.width + 12, left = b.x - w - 12;
    pos = { x: right + w <= wa.x + wa.width ? right : Math.max(wa.x, left), y: Math.max(wa.y, Math.min(b.y, wa.y + wa.height - h)) };
  }
  return { ...base, ...pos, width: w, height: Math.min(h, screen.getPrimaryDisplay().workArea.height - 20), minimizable: false, maximizable: false, resizable: name !== 'about', parent: mainWin && mainWin.isVisible() ? mainWin : undefined, title: name ? { jump: 'Jump to file', info: 'File info', about: 'About Wavedeck', studio: 'Wavedeck Theme Studio' }[name] : 'Wavedeck' };
}

function createMainWindow() {
  const b = settings.mainBounds || {};
  mainWin = new BrowserWindow({
    width: 275, height: 348, x: b.x, y: b.y,
    useContentSize: true, frame: false, transparent: true, resizable: false, maximizable: false,
    fullscreenable: false, hasShadow: false, backgroundColor: '#00000000',
    alwaysOnTop: !!settings.alwaysOnTop,
    title: 'Wavedeck',
    icon: path.join(__dirname, '..', 'build', 'icon.png'),
    show: false,
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, sandbox: false, backgroundThrottling: false },
  });
  mainWin.loadURL('app://wavedeck/index.html');
  // With a modern skin active the classic window stays hidden; the renderer shows it if needed.
  mainWin.once('ready-to-show', () => { if (!settings.modernSkin) mainWin.show(); });
  mainWin.on('moved', () => { const [x, y] = mainWin.getPosition(); settings.mainBounds = { x, y }; saveSettings(); });
  mainWin.on('closed', () => { mainWin = null; app.quit(); });

  mainWin.webContents.setWindowOpenHandler(({ url, features }) => {
    if (url.startsWith('app://wavedeck/')) {
      return { action: 'allow', overrideBrowserWindowOptions: childWindowOptions(url + ' ' + features) };
    }
    if (/^https?:\/\//.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });
  mainWin.webContents.on('did-create-window', (child, { url }) => {
    const key = /library/.test(url) ? 'libraryBounds' : /milkdrop/.test(url) ? 'milkdropBounds' : null;
    child.setMenuBarVisibility(false);
    if (key) {
      const save = () => { if (!child.isDestroyed()) { settings[key] = child.getBounds(); saveSettings(); } };
      child.on('resized', save); child.on('moved', save);
    }
  });
}

function fileArgs(argv) {
  return argv.slice(app.isPackaged ? 1 : 2).filter((a) => !a.startsWith('-') && fs.existsSync(a));
}

function sendOpenFiles(files) {
  if (!mainWin || !files.length) return;
  mainWin.webContents.send('open-files', files);
}

// ---------- IPC ----------
// Dialogs and menus attach to the calling window, or to whatever Wavedeck window is
// visible (the classic window is hidden while a modern skin is in use).
function parentOf(e) {
  const w = BrowserWindow.fromWebContents(e.sender);
  if (w && w.isVisible()) return w;
  return BrowserWindow.getAllWindows().find((x) => x.isVisible() && !x.isDestroyed());
}
function registerIpc() {
  const audioFilters = [
    { name: 'Audio', extensions: AUDIO_EXT.map((e) => e.slice(1)).concat(PLAYLIST_EXT.map((e) => e.slice(1))) },
    { name: 'All files', extensions: ['*'] },
  ];
  ipcMain.handle('dialog:openFiles', async (e) => {
    const r = await dialog.showOpenDialog(parentOf(e), { properties: ['openFile', 'multiSelections'], filters: audioFilters });
    return r.canceled ? [] : expandPaths(r.filePaths);
  });
  ipcMain.handle('dialog:openFolder', async (e, opts = {}) => {
    const r = await dialog.showOpenDialog(parentOf(e), { properties: ['openDirectory', 'multiSelections'], title: opts.title });
    if (r.canceled) return opts.raw ? [] : [];
    return opts.raw ? r.filePaths : expandPaths(r.filePaths);
  });
  ipcMain.handle('dialog:openPlaylist', async (e) => {
    const r = await dialog.showOpenDialog(parentOf(e), { properties: ['openFile'], filters: [{ name: 'Playlists', extensions: ['m3u', 'm3u8', 'pls'] }] });
    return r.canceled ? null : readPlaylist(r.filePaths[0]);
  });
  ipcMain.handle('dialog:savePlaylist', async (e, items) => {
    const r = await dialog.showSaveDialog(parentOf(e), { defaultPath: 'playlist.m3u8', filters: [{ name: 'M3U playlist', extensions: ['m3u8', 'm3u'] }, { name: 'PLS playlist', extensions: ['pls'] }] });
    if (r.canceled) return false;
    await writePlaylist(r.filePath, items);
    return true;
  });
  ipcMain.handle('dialog:openSkin', async (e) => {
    const r = await dialog.showOpenDialog(parentOf(e), { properties: ['openFile'], filters: [{ name: 'Skins', extensions: ['wsz', 'wdskin', 'rwskin', 'zip', ...MODERN_EXT.map((x) => x.slice(1))] }] });
    if (r.canceled) return null;
    const src = r.filePaths[0];
    await fsp.mkdir(skinsDir(), { recursive: true });
    const dest = path.join(skinsDir(), path.basename(src));
    if (path.resolve(src) !== path.resolve(dest)) await fsp.copyFile(src, dest);
    return dest;
  });
  ipcMain.handle('dialog:saveFile', async (e, { defaultPath, data, filters }) => {
    const r = await dialog.showSaveDialog(parentOf(e), { defaultPath, filters });
    if (r.canceled) return null;
    await fsp.writeFile(r.filePath, Buffer.from(data));
    return r.filePath;
  });
  ipcMain.handle('dialog:message', async (e, opts) => dialog.showMessageBox(parentOf(e), opts));

  ipcMain.handle('fs:expand', (e, paths) => expandPaths(paths));
  ipcMain.handle('fs:readBinary', async (e, p) => new Uint8Array(await fsp.readFile(p)));
  ipcMain.handle('fs:showInFolder', (e, p) => shell.showItemInFolder(p));
  ipcMain.handle('meta:read', async (e, paths) => {
    const out = new Array(paths.length);
    const lib = loadLibrary();
    await pool(paths, 6, async (p, i) => { out[i] = lib.tracks[p] || await readMeta(p); });
    return out;
  });
  ipcMain.handle('meta:cover', async (e, p) => {
    try {
      const m = await musicMetadata().parseFile(p, { duration: false });
      const pic = musicMetadata().selectCover(m.common.picture);
      if (pic) return `data:${pic.format};base64,${Buffer.from(pic.data).toString('base64')}`;
    } catch { /* fall through */ }
    for (const n of ['cover.jpg', 'folder.jpg', 'front.jpg', 'cover.png', 'folder.png', 'albumart.jpg']) {
      const f = path.join(path.dirname(p), n);
      try { const d = await fsp.readFile(f); return `data:image/${n.endsWith('png') ? 'png' : 'jpeg'};base64,${d.toString('base64')}`; } catch { /* next */ }
    }
    return null;
  });

  ipcMain.handle('settings:get', () => settings);
  ipcMain.handle('settings:set', (e, patch) => { Object.assign(settings, patch); saveSettings(); broadcast('settings:changed', patch); return true; });

  ipcMain.handle('skins:list', listSkins);
  ipcMain.handle('skins:save', async (e, name, data) => {
    await fsp.mkdir(skinsDir(), { recursive: true });
    const clean = String(name).replace(/[<>:"/\\|?*\x00-\x1f]/g, '_').trim() || 'theme.wdskin';
    const ext = path.extname(clean) || '.wdskin', stem = path.basename(clean, ext);
    // Saving under the same theme name replaces that theme (it's the same theme, edited).
    const f = path.join(skinsDir(), stem + ext);
    await fsp.writeFile(f, Buffer.from(data));
    return f;
  });
  ipcMain.handle('skins:dir', async () => { await fsp.mkdir(skinsDir(), { recursive: true }); shell.openPath(skinsDir()); });

  ipcMain.handle('lib:get', () => { const l = loadLibrary(); return { folders: l.folders, tracks: l.tracks, servers: l.servers }; });
  ipcMain.handle('lib:addFolder', async (e) => {
    const r = await dialog.showOpenDialog(parentOf(e), { properties: ['openDirectory', 'multiSelections'], title: 'Add music folder (local or network share)' });
    if (r.canceled) return loadLibrary().folders;
    const l = loadLibrary();
    for (const f of r.filePaths) if (!l.folders.includes(f)) l.folders.push(f);
    await saveLibrary();
    scanLibrary();
    return l.folders;
  });
  ipcMain.handle('lib:addFolderPath', async (e, p) => {
    const l = loadLibrary();
    try { await fsp.access(p); } catch { return { error: `Can't reach ${p}` }; }
    if (!l.folders.includes(p)) l.folders.push(p);
    await saveLibrary(); scanLibrary();
    return { folders: l.folders };
  });
  ipcMain.handle('lib:removeFolder', async (e, f) => {
    const l = loadLibrary();
    l.folders = l.folders.filter((x) => x !== f);
    for (const p of Object.keys(l.tracks)) if (p.toLowerCase().startsWith(f.toLowerCase())) delete l.tracks[p];
    await saveLibrary();
    broadcast('lib:changed');
    return l.folders;
  });
  ipcMain.handle('lib:scan', scanLibrary);
  ipcMain.handle('lib:setServers', async (e, servers) => { loadLibrary().servers = servers; await saveLibrary(); broadcast('lib:changed'); return true; });

  // Mixtapes: the user's own playlists, stored on this PC.
  const mixFile = () => path.join(userDir(), 'mixtapes.json');
  ipcMain.handle('mixtapes:get', async () => { try { return JSON.parse(await fsp.readFile(mixFile(), 'utf8')); } catch { return []; } });
  ipcMain.handle('mixtapes:save', async (e, list) => {
    const tmp = mixFile() + '.tmp';
    await fsp.writeFile(tmp, JSON.stringify(list));
    await fsp.rename(tmp, mixFile());
    broadcast('mixtapes:changed');
    return true;
  });

  ipcMain.handle('plugins:list', listPlugins);
  ipcMain.handle('plugins:dir', async () => { await fsp.mkdir(pluginsDir(), { recursive: true }); shell.openPath(pluginsDir()); });
  ipcMain.handle('plugins:writeText', async (e, id, name, text) => {
    const safeId = String(id).replace(/[^\w.-]/g, '_'), safeName = path.basename(String(name));
    const dir = path.join(pluginDataDir(), safeId);
    await fsp.mkdir(dir, { recursive: true });
    const f = path.join(dir, safeName);
    await fsp.writeFile(f, String(text), 'utf8');
    return f;
  });

  ipcMain.handle('util:md5', (e, s) => crypto.createHash('md5').update(String(s)).digest('hex'));
  ipcMain.handle('util:openExternal', (e, url) => { if (/^https?:\/\//.test(url)) shell.openExternal(url); });
  ipcMain.handle('util:popupMenu', (e, template) => new Promise((resolve) => {
    const win = parentOf(e);
    const build = (items) => items.map((it) => {
      if (it.type === 'separator') return { type: 'separator' };
      const o = { label: it.label, enabled: it.enabled !== false, accelerator: it.accelerator, registerAccelerator: false };
      if (it.checked !== undefined) { o.type = it.radio ? 'radio' : 'checkbox'; o.checked = !!it.checked; }
      if (it.submenu) o.submenu = build(it.submenu);
      else o.click = () => { resolved = true; resolve(it.id); };
      return o;
    });
    let resolved = false;
    const menu = Menu.buildFromTemplate(build(template));
    menu.popup({ window: win, callback: () => setTimeout(() => { if (!resolved) resolve(null); }, 50) });
  }));

  ipcMain.handle('win:setSize', (e, w, h) => {
    const win = BrowserWindow.fromWebContents(e.sender);
    win.setResizable(true); win.setContentSize(Math.round(w), Math.round(h)); win.setResizable(false);
  });
  ipcMain.handle('win:setPos', (e, x, y) => { const w = BrowserWindow.fromWebContents(e.sender); w.setPosition(Math.round(x), Math.round(y)); });
  ipcMain.handle('win:setBounds', (e, b) => {
    const w = BrowserWindow.fromWebContents(e.sender);
    w.setResizable(true);
    w.setBounds({ x: Math.round(b.x), y: Math.round(b.y), width: Math.round(b.width), height: Math.round(b.height) });
    w.setResizable(false);
  });
  ipcMain.handle('win:workArea', (e) => screen.getDisplayMatching(BrowserWindow.fromWebContents(e.sender).getBounds()).workArea);
  ipcMain.handle('win:ignoreMouse', (e, on) => { const w = BrowserWindow.fromWebContents(e.sender); if (w) w.setIgnoreMouseEvents(!!on, { forward: true }); });
  ipcMain.handle('win:hideMain', () => { if (mainWin) mainWin.hide(); });
  ipcMain.handle('win:showMain', () => { if (mainWin) { mainWin.show(); mainWin.focus(); } });
  ipcMain.handle('win:minimize', (e) => BrowserWindow.fromWebContents(e.sender).minimize());
  ipcMain.handle('win:close', (e) => BrowserWindow.fromWebContents(e.sender).close());
  ipcMain.handle('win:alwaysOnTop', (e, on) => { BrowserWindow.fromWebContents(e.sender).setAlwaysOnTop(!!on); settings.alwaysOnTop = !!on; saveSettings(); });
  ipcMain.handle('win:fullscreen', (e) => { const w = BrowserWindow.fromWebContents(e.sender); w.setFullScreen(!w.isFullScreen()); });
  ipcMain.handle('win:focusMain', () => { if (mainWin) mainWin.focus(); });
  ipcMain.handle('app:version', () => app.getVersion());
}

// ---------- startup ----------
app.on('second-instance', (e, argv) => {
  if (mainWin) { if (mainWin.isMinimized()) mainWin.restore(); mainWin.focus(); }
  sendOpenFiles(fileArgs(argv));
});

app.whenReady().then(() => {
  loadSettings();
  registerProtocols();
  registerIpc();
  // Let network streams (Subsonic / Navidrome / internet radio) feed the analyser.
  session.defaultSession.webRequest.onHeadersReceived({ urls: ['http://*/*', 'https://*/*'] }, (details, cb) => {
    const h = details.responseHeaders || {};
    const has = Object.keys(h).some((k) => k.toLowerCase() === 'access-control-allow-origin');
    if (!has) h['Access-Control-Allow-Origin'] = ['*'];
    cb({ responseHeaders: h });
  });
  createMainWindow();
  mainWin.webContents.once('did-finish-load', () => setTimeout(() => sendOpenFiles(fileArgs(process.argv)), 300));
  if (process.env.REWIND_TEST) require('./devtest')(mainWin);
  const keys = { MediaPlayPause: 'playpause', MediaNextTrack: 'next', MediaPreviousTrack: 'prev', MediaStop: 'stop' };
  for (const [k, v] of Object.entries(keys)) {
    try { globalShortcut.register(k, () => mainWin && mainWin.webContents.send('media-key', v)); } catch { /* taken */ }
  }
});

app.on('will-quit', () => globalShortcut.unregisterAll());
app.on('window-all-closed', () => app.quit());
