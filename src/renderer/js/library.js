// Media Library window: browse by artist / album / song / genre across local
// folders (including network shares) and Subsonic-compatible servers.
import { LocalSource, SubsonicSource } from './sources.js';

const R = window.wavedeck;
const P = () => window.opener && window.opener.wavedeckPlayer;
const $ = (s, r = document) => r.querySelector(s);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmt = (sec) => { if (!sec) return ''; sec = Math.round(sec); const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60; return h ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}` : `${m}:${String(s).padStart(2, '0')}`; };
const fmtLong = (sec) => { const m = Math.round((sec || 0) / 60); return m >= 60 ? `${Math.floor(m / 60)} hr ${m % 60} min` : `${m} min`; };
const initials = (s) => (s || '?').replace(/^the\s+/i, '').trim().slice(0, 1).toUpperCase();
const hue = (s) => { let h = 0; for (const c of s || '') h = (h * 31 + c.charCodeAt(0)) % 360; return h; };
const trackKey = (t) => t && (t.path || t.url);
const codecName = (c) => { c = String(c || ''); if (/mpeg.*layer\s*3|^mp3$/i.test(c)) return 'MP3'; if (/mpeg.*layer\s*2/i.test(c)) return 'MP2'; if (/^(aac|mpeg-4\/aac)/i.test(c) || /mp4a|m4a/i.test(c)) return 'AAC'; if (/vorbis/i.test(c)) return 'OGG'; if (/pcm|wav/i.test(c)) return 'WAV'; return c.toUpperCase(); };

const S = {
  sources: [], source: null, mx: null, mixtape: null, playlist: null, view: 'artists', artist: null, genre: null, album: null, query: '',
  sort: { albums: 'artist', songs: { key: 'artist', dir: 1 } }, selected: new Set(), rows: [],
};

// ---------------- boot ----------------
async function init() {
  const local = new LocalSource();
  await local.load();
  S.sources = [local];
  const lib = await R.lib.get();
  for (const cfg of lib.servers || []) S.sources.push(new SubsonicSource(cfg));
  S.source = local;
  renderSources();
  bindChrome();
  applySkin();
  render();
  for (const s of S.sources) if (s.kind === 'subsonic') s.load().catch(() => {}).finally(renderSources);
  R.lib.onProgress(onProgress);
  R.lib.onChanged(async () => { await local.load(); renderSources(); if (S.source === local) render(); });
  const player = P();
  if (player) player.on('trackchange', markPlaying);
  window.onSkinChange = applySkin;
  R.mixtapes.onChanged(() => { renderMixtapeCount(); if (S.mx) render(); });
  renderMixtapeCount();
}

function renderMixtapeCount() { const p = P(); const n = p ? p.mixtapeList().length : 0; $('#mx-count').textContent = n ? String(n) : ''; }

function applySkin() {
  const p = P();
  $('#skin-css').textContent = p ? p.skin().libraryCss || '' : '';
}

function bindChrome() {
  for (const b of document.querySelectorAll('#tabs button')) b.onclick = () => setView(b.dataset.view);
  let t;
  $('#search').oninput = (e) => { clearTimeout(t); t = setTimeout(() => { S.query = e.target.value.trim(); S.album = null; render(); }, 180); };
  $('#search').onkeydown = (e) => { if (e.key === 'Escape') { e.target.value = ''; S.query = ''; render(); } };
  $('#btn-folders').onclick = foldersDialog;
  $('#btn-servers').onclick = serversDialog;
  $('#btn-rescan').onclick = () => { R.lib.scan(); };
  $('#nav-mixtapes').onclick = () => { S.mx = true; S.mixtape = null; renderSources(); render(); };
  $('#btn-shuffleall').onclick = async () => { const p = P(); if (!p) return; toast(`Shuffling all of ${S.source.name}…`); await p.shuffleAll(S.source.id); };
  $('#sort').onchange = (e) => { S.sort.albums = e.target.value; render(); };
  window.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'f') { e.preventDefault(); $('#search').focus(); $('#search').select(); }
    if (e.key === 'Escape') { hideCtx(); closeModal(); }
    if (e.target.tagName === 'INPUT') return;
    if (e.key === 'Enter' && S.selected.size) { const tr = selectedTracks(); play(tr, 0); }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'a' && S.rows.length) { e.preventDefault(); S.selected = new Set(S.rows.map((_, i) => i)); paintSelection(); }
    if (e.key === 'Backspace' && S.album) { S.album = null; render(); }
  });
  document.addEventListener('click', hideCtx);
  window.addEventListener('blur', hideCtx);
}

function setView(v) {
  S.view = v; S.album = null; S.playlist = null; S.query = ''; $('#search').value = '';
  for (const b of document.querySelectorAll('#tabs button')) b.classList.toggle('on', b.dataset.view === v);
  render();
}

function renderSources() {
  const nav = $('#sources');
  nav.innerHTML = '';
  for (const s of S.sources) {
    const b = document.createElement('button');
    b.className = s === S.source && !S.mx ? 'on' : '';
    const icon = s.kind === 'local' ? '◉' : '⇄';
    const right = s.kind === 'local' ? `<span class="count">${s.count.toLocaleString()}</span>` : `<span class="dot ${s.ok ? 'ok' : ''}" title="${s.ok ? 'Connected' : esc(s.error || 'Connecting…')}"></span>`;
    b.innerHTML = `<i>${icon}</i><span>${esc(s.name)}</span>${right}`;
    b.onclick = () => { S.source = s; S.mx = false; S.artist = S.genre = S.album = S.playlist = null; if (S.view === 'playlists') S.view = 'artists'; renderSources(); render(); };
    nav.appendChild(b);
  }
  $('#nav-mixtapes').classList.toggle('on', !!S.mx);
  document.body.classList.toggle('mx-mode', !!S.mx);
  // Playlists tab only for sources that have playlists (music servers)
  const src = S.source;
  const hasPl = src && src.kind === 'subsonic' && src.ok;
  $('#tab-playlists').hidden = !hasPl;
  for (const b of document.querySelectorAll('#tabs button')) b.classList.toggle('on', b.dataset.view === S.view);
  const local = S.sources[0];
  $('#stats').innerHTML = local.count ? `${local.count.toLocaleString()} tracks<br>${local.albumMap.size.toLocaleString()} albums · ${local.artistMap.size.toLocaleString()} artists` : '';
}

function onProgress(p) {
  const el = $('#scan');
  if (p.phase === 'done') {
    el.hidden = true;
    toast(`Library updated: ${p.added} added, ${p.updated} updated, ${p.removed} removed`);
    return;
  }
  el.hidden = false;
  el.querySelector('.scan-text').textContent = p.phase === 'listing' ? 'Finding music…' : `Reading tags ${p.done.toLocaleString()} / ${p.total.toLocaleString()}`;
  el.querySelector('.bar span').style.width = p.total ? `${(p.done / p.total) * 100}%` : '15%';
}

// ---------------- rendering ----------------
const view = () => $('#view');

function setSortOptions(opts) {
  const sel = $('#sort');
  sel.innerHTML = opts.map(([v, l]) => `<option value="${v}" ${S.sort.albums === v ? 'selected' : ''}>${l}</option>`).join('');
}

async function render() {
  hideCtx();
  S.selected = new Set(); S.rows = []; S.rowsMixtape = null;
  const src = S.source;
  setSortOptions([]);
  if (S.mx) return S.mixtape ? renderMixtape(S.mixtape) : renderMixtapes();
  if (src.kind === 'local' && !src.count) return renderEmpty();
  if (src.kind === 'subsonic' && src.ok === false) return renderError(src);
  if (S.album) return renderAlbum(S.album);
  if (S.query) return renderSearch(S.query);
  if (S.view === 'artists') return renderArtists();
  if (S.view === 'albums') return renderAllAlbums();
  if (S.view === 'songs') return renderSongs();
  if (S.view === 'genres') return renderGenres();
  if (S.view === 'playlists') return S.playlist ? renderServerPlaylist(S.playlist) : renderServerPlaylists();
}

// ---------------- mixtapes ----------------
function mxIcon(name) { return `<span class="ic" style="background:linear-gradient(135deg,hsl(${hue(name)} 45% 38%),hsl(${(hue(name) + 50) % 360} 40% 22%))">${esc(initials(name))}</span>`; }

function renderMixtapes() {
  const p = P(); const tapes = p ? p.mixtapeList() : [];
  const v = view();
  v.innerHTML = `<div class="pane" style="height:100%"><button class="btn primary mx-new" id="mx-new">+ New mixtape</button>
    ${tapes.length ? '<div class="mx-list" id="mx-list"></div>' : '<div class="empty"><div><h2>No mixtapes yet</h2><p>Mixtapes are your own named playlists. Right-click any song, album or artist and choose “Add to mixtape…”, or start an empty one here.</p></div></div>'}</div>`;
  $('#mx-new').onclick = () => toMixtape(async () => [], { newOnly: true });
  const list = $('#mx-list'); if (!list) return;
  for (const m of tapes) {
    const row = document.createElement('div'); row.className = 'mx-row';
    row.innerHTML = `${mxIcon(m.name)}<span class="nm">${esc(m.name)}</span><span class="info">${m.count} song${m.count === 1 ? '' : 's'}${m.duration ? ' · ' + fmtLong(m.duration) : ''}</span><span class="acts"><button class="btn primary">▶ Play</button><button class="btn">⤮ Shuffle</button></span>`;
    const [bp, bs] = row.querySelectorAll('.acts .btn');
    bp.onclick = async (e) => { e.stopPropagation(); p.playList(await p.mixtapeTracks(m.id), 0); };
    bs.onclick = async (e) => { e.stopPropagation(); p.playList(await p.mixtapeTracks(m.id), 0, { shuffle: true }); };
    row.onclick = () => { S.mixtape = m.id; render(); };
    row.oncontextmenu = (e) => ctx(e, [['Play', async () => p.playList(await p.mixtapeTracks(m.id), 0)], ['Shuffle', async () => p.playList(await p.mixtapeTracks(m.id), 0, { shuffle: true })], ['Add to playlist', async () => enqueue((await p.mixtapeTracks(m.id)).filter((t) => !t.missing))], null, ['Rename…', () => renameMx(m.id)], ['Delete…', () => deleteMx(m.id)]]);
    list.appendChild(row);
  }
}

async function renderMixtape(id) {
  const p = P(); const m = p && p.mixtapeList().find((x) => x.id === id);
  if (!m) { S.mixtape = null; return renderMixtapes(); }
  const v = view();
  v.innerHTML = '<div class="pane" style="height:100%" id="mxpane"></div>';
  const pane = $('#mxpane'); loading(pane);
  const tracks = await p.mixtapeTracks(id);
  if (S.mixtape !== id) return;
  const missing = tracks.filter((t) => t.missing).length;
  pane.innerHTML = `<button class="back" id="back">← Mixtapes</button>
    <div class="album-head"><div class="cover" style="background:linear-gradient(135deg,hsl(${hue(m.name)} 45% 38%),hsl(${(hue(m.name) + 50) % 360} 40% 18%))"><span class="ph">${esc(initials(m.name))}</span></div>
      <div class="meta"><div class="kind">Mixtape</div><h1>${esc(m.name)}</h1>
      <div class="sub">${tracks.length} song${tracks.length === 1 ? '' : 's'}${m.duration ? ' · ' + fmtLong(m.duration) : ''}${missing ? ` · ${missing} on a server that isn't connected` : ''}</div>
      <div class="row-actions" style="margin:0"><button class="btn primary" id="mx-play">▶ Play</button><button class="btn" id="mx-shuf">⤮ Shuffle</button><button class="btn" id="mx-ren">Rename</button><button class="btn" id="mx-del">Delete</button></div></div></div>
    ${tracks.length ? '<div class="table" id="mx-table"></div>' : '<div class="empty"><div><p>This mixtape is empty. Right-click songs, albums or artists anywhere and choose “Add to mixtape…”.</p></div></div>'}`;
  $('#back').onclick = () => { S.mixtape = null; render(); };
  $('#mx-play').onclick = () => p.playList(tracks, 0);
  $('#mx-shuf').onclick = () => p.playList(tracks, 0, { shuffle: true });
  $('#mx-ren').onclick = () => renameMx(id);
  $('#mx-del').onclick = () => deleteMx(id);
  if (tracks.length) trackTable($('#mx-table'), tracks, { compact: false, mixtape: id });
}

function renameMx(id) {
  const p = P(); const m = p.mixtapeList().find((x) => x.id === id); if (!m) return;
  const d = modal(`<h2>Rename mixtape</h2><div class="row"><input id="mx-name" spellcheck="false"></div><div class="foot"><button class="btn" id="mx-cancel">Cancel</button><button class="btn primary" id="mx-ok">Rename</button></div>`);
  const inp = d.querySelector('#mx-name'); inp.value = m.name; inp.focus(); inp.select();
  const ok = async () => { if (inp.value.trim()) await p.renameMixtape(id, inp.value.trim()); closeModal(); };
  d.querySelector('#mx-ok').onclick = ok; d.querySelector('#mx-cancel').onclick = closeModal;
  inp.onkeydown = (e) => { if (e.key === 'Enter') ok(); };
}

function deleteMx(id) {
  const p = P(); const m = p.mixtapeList().find((x) => x.id === id); if (!m) return;
  const d = modal(`<h2>Delete “${esc(m.name)}”?</h2><p class="hint">The songs themselves are not affected.</p><div class="foot"><button class="btn" id="mx-cancel">Cancel</button><button class="btn primary" id="mx-ok">Delete</button></div>`);
  d.querySelector('#mx-ok').onclick = async () => { await p.deleteMixtape(id); closeModal(); S.mixtape = null; render(); };
  d.querySelector('#mx-cancel').onclick = closeModal;
}

// ---------------- server playlists ----------------
async function renderServerPlaylists() {
  const v = view();
  v.innerHTML = '<div class="pane" style="height:100%" id="plpane"></div>';
  const pane = $('#plpane'); loading(pane);
  let pls = [];
  try { pls = (await S.source.playlists()) || []; } catch (e) { pane.innerHTML = `<div class="loading">${esc(e.message)}</div>`; return; }
  if (!pls.length) { pane.innerHTML = '<div class="empty"><div><h2>No playlists on this server yet</h2></div></div>'; return; }
  pane.innerHTML = '<div class="mx-list" id="pl-list"></div>';
  const list = $('#pl-list');
  for (const pl of pls) {
    const row = document.createElement('div'); row.className = 'mx-row';
    row.innerHTML = `${mxIcon(pl.name)}<span class="nm">${esc(pl.name)}</span><span class="info">${pl.songCount ? pl.songCount + ' songs' : ''}</span><span class="acts"><button class="btn primary">▶ Play</button><button class="btn">⤮ Shuffle</button></span>`;
    const [bp, bs] = row.querySelectorAll('.acts .btn');
    bp.onclick = async (e) => { e.stopPropagation(); play(await S.source.playlistTracks(pl.key), 0); };
    bs.onclick = async (e) => { e.stopPropagation(); const t = await S.source.playlistTracks(pl.key); shuffle(t); play(t, 0); };
    row.onclick = () => { S.playlist = pl; render(); };
    row.oncontextmenu = (e) => ctx(e, [['Play', async () => play(await S.source.playlistTracks(pl.key), 0)], ['Add to playlist', async () => enqueue(await S.source.playlistTracks(pl.key))], ['Add to mixtape…', () => toMixtape(() => S.source.playlistTracks(pl.key))]]);
    list.appendChild(row);
  }
}

async function renderServerPlaylist(pl) {
  const v = view();
  v.innerHTML = '<div class="pane" style="height:100%" id="plpane"></div>';
  const pane = $('#plpane'); loading(pane);
  const tracks = await S.source.playlistTracks(pl.key);
  if (S.playlist !== pl) return;
  const dur = tracks.reduce((s, t) => s + (t.duration || 0), 0);
  pane.innerHTML = `<button class="back" id="back">← Playlists</button>
    <div class="album-head"><div class="cover" style="background:linear-gradient(135deg,hsl(${hue(pl.name)} 45% 38%),hsl(${(hue(pl.name) + 50) % 360} 40% 18%))"><span class="ph">${esc(initials(pl.name))}</span></div>
      <div class="meta"><div class="kind">Playlist · ${esc(S.source.name)}</div><h1>${esc(pl.name)}</h1><div class="sub">${tracks.length} songs · ${fmtLong(dur)}</div>
      <div class="row-actions" style="margin:0"><button class="btn primary" id="pl-play">▶ Play</button><button class="btn" id="pl-shuf">⤮ Shuffle</button><button class="btn" id="pl-add">+ Add to playlist</button><button class="btn" id="pl-mx">Add to mixtape</button></div></div></div>
    <div class="table" id="pl-table"></div>`;
  $('#back').onclick = () => { S.playlist = null; render(); };
  $('#pl-play').onclick = () => play(tracks, 0);
  $('#pl-shuf').onclick = () => { const t = [...tracks]; shuffle(t); play(t, 0); };
  $('#pl-add').onclick = () => enqueue(tracks);
  $('#pl-mx').onclick = () => toMixtape(async () => tracks);
  trackTable($('#pl-table'), tracks, { compact: false });
}

function renderEmpty() {
  view().innerHTML = `<div class="empty"><div>
    <h2>Add your music</h2>
    <p>Point Wavedeck at the folders where your music lives. Local drives, USB drives and network shares (like <code>\\\\NAS\\Music</code>) all work. Wavedeck reads the tags and sorts everything by artist, album and song.</p>
    <div class="btns"><button class="btn primary" id="e-add">Add music folder</button><button class="btn" id="e-srv">Connect a music server</button></div>
  </div></div>`;
  $('#e-add').onclick = async () => { await R.lib.addFolder(); };
  $('#e-srv').onclick = serversDialog;
}

function renderError(src) {
  view().innerHTML = `<div class="empty"><div><h2>Can't reach ${esc(src.name)}</h2><p>${esc(src.error || '')}</p><div class="btns"><button class="btn primary" id="e-retry">Try again</button><button class="btn" id="e-edit">Edit servers</button></div></div></div>`;
  $('#e-retry').onclick = async () => { try { await src.load(); } catch { /* shown */ } renderSources(); render(); };
  $('#e-edit').onclick = serversDialog;
}

function loading(where) { where.innerHTML = '<div class="loading">Loading…</div>'; }

async function renderArtists() {
  const v = view();
  v.innerHTML = '<div class="split"><div class="list" id="alist"></div><div class="pane" id="apane"></div></div>';
  const list = $('#alist');
  loading(list);
  let artists;
  try { artists = await S.source.artists(); } catch (e) { return renderError(S.source); }
  list.innerHTML = '';
  const frag = document.createDocumentFragment();
  for (const a of artists) {
    const b = document.createElement('button');
    b.dataset.key = a.key;
    b.innerHTML = `<span class="avatar" style="background:hsl(${hue(a.name)} 30% 20%)">${esc(initials(a.name))}</span><span class="name">${esc(a.name)}</span><span class="n">${a.albumCount || ''}</span>`;
    b.onclick = () => { S.artist = a; list.querySelectorAll('button.on').forEach((x) => x.classList.remove('on')); b.classList.add('on'); renderArtistPane(a); };
    b.oncontextmenu = (e) => ctx(e, [['Play artist', async () => play(await S.source.artistTracks(a.key), 0)], ['Add to playlist', async () => enqueue(await S.source.artistTracks(a.key))], ['Add to mixtape…', () => toMixtape(() => S.source.artistTracks(a.key))]]);
    b.ondblclick = async () => play(await S.source.artistTracks(a.key), 0);
    frag.appendChild(b);
  }
  list.appendChild(frag);
  const pick = (S.artist && artists.find((a) => a.key === S.artist.key)) || artists[0];
  if (pick) list.querySelector(`button[data-key="${CSS.escape(pick.key)}"]`)?.click();
}

async function renderArtistPane(a) {
  const pane = $('#apane');
  loading(pane);
  const albums = (await S.source.albums(a.key)).sort((x, y) => (y.year || 0) - (x.year || 0) || x.title.localeCompare(y.title));
  if (S.artist !== a) return;
  const tracks = albums.reduce((s, x) => s + (x.trackCount || 0), 0);
  pane.innerHTML = `<h1>${esc(a.name)}</h1><div class="sub">${albums.length} album${albums.length === 1 ? '' : 's'}${tracks ? ` · ${tracks} songs` : ''}</div>
    <div class="row-actions"><button class="btn primary" id="ap-play">▶ Play</button><button class="btn" id="ap-shuf">⤮ Shuffle</button><button class="btn" id="ap-add">+ Add to playlist</button></div>
    <div class="grid" id="ap-grid"></div>`;
  $('#ap-play').onclick = async () => play(await S.source.artistTracks(a.key), 0);
  $('#ap-shuf').onclick = async () => { const t = await S.source.artistTracks(a.key); shuffle(t); play(t, 0); };
  $('#ap-add').onclick = async () => enqueue(await S.source.artistTracks(a.key));
  albumGrid($('#ap-grid'), albums, { showArtist: false });
}

function sortAlbums(albums) {
  const k = S.sort.albums;
  const cmp = {
    artist: (a, b) => a.artist.localeCompare(b.artist, undefined, { sensitivity: 'base' }) || (a.year || 0) - (b.year || 0),
    title: (a, b) => a.title.localeCompare(b.title, undefined, { sensitivity: 'base' }),
    year: (a, b) => (b.year || 0) - (a.year || 0),
    added: (a, b) => (b.added || 0) - (a.added || 0),
  }[k] || (() => 0);
  return albums.sort(cmp);
}

async function renderAllAlbums() {
  setSortOptions([['artist', 'Sort: Artist'], ['title', 'Sort: Album title'], ['year', 'Sort: Newest'], ['added', 'Sort: Recently added']]);
  const v = view();
  v.innerHTML = '<div class="pane" style="height:100%"><div class="grid" id="all-grid"></div></div>';
  loading($('#all-grid'));
  const albums = sortAlbums(await S.source.albums());
  albumGrid($('#all-grid'), albums, { showArtist: true });
}

async function renderGenres() {
  if (!S.source.genres()) { view().innerHTML = '<div class="empty"><div><h2>Genres</h2><p>Genre browsing is available for your local library. Use search to find music on this server.</p></div></div>'; return; }
  const v = view();
  v.innerHTML = '<div class="split"><div class="list" id="glist"></div><div class="pane" id="gpane"></div></div>';
  const list = $('#glist');
  for (const g of S.source.genres()) {
    const b = document.createElement('button');
    b.innerHTML = `<span class="name">${esc(g.name)}</span><span class="n">${g.albumCount}</span>`;
    b.onclick = () => {
      S.genre = g; list.querySelectorAll('.on').forEach((x) => x.classList.remove('on')); b.classList.add('on');
      const pane = $('#gpane');
      pane.innerHTML = `<h1>${esc(g.name)}</h1><div class="sub">${g.albumCount} albums · ${g.trackCount} songs</div><div class="grid" id="g-grid"></div>`;
      albumGrid($('#g-grid'), sortAlbums(S.source.albumsForGenre(g.key)), { showArtist: true });
    };
    list.appendChild(b);
  }
  list.querySelector('button')?.click();
}

function albumGrid(container, albums, { showArtist }) {
  container.innerHTML = '';
  const frag = document.createDocumentFragment();
  for (const al of albums) {
    const card = document.createElement('div');
    card.className = 'card';
    card.innerHTML = `<div class="cover" style="background:linear-gradient(135deg,hsl(${hue(al.title + al.artist)} 32% 22%),hsl(${(hue(al.artist) + 40) % 360} 28% 12%))"><span class="ph">${esc(initials(al.title))}</span><button class="play" title="Play">▶</button></div>
      <div class="t" title="${esc(al.title)}">${esc(al.title)}</div><div class="a">${showArtist ? esc(al.artist) : ''}${showArtist && al.year ? ' · ' : ''}${al.year || ''}</div>`;
    card.onclick = (e) => { if (e.target.closest('.play')) return; S.album = al; render(); };
    card.querySelector('.play').onclick = async (e) => { e.stopPropagation(); play(await S.source.albumTracks(al.key), 0); };
    card.oncontextmenu = (e) => ctx(e, [['Play', async () => play(await S.source.albumTracks(al.key), 0)], ['Add to playlist', async () => enqueue(await S.source.albumTracks(al.key))], ['Play next', async () => playNext(await S.source.albumTracks(al.key))], ['Add to mixtape…', () => toMixtape(() => S.source.albumTracks(al.key))], null, ['Go to artist', () => goArtist(al)]]);
    card.draggable = true;
    card.ondragstart = async (e) => { e.dataTransfer.setData('application/x-wavedeck-tracks', JSON.stringify(await S.source.albumTracks(al.key))); };
    card._album = al;
    frag.appendChild(card);
  }
  container.appendChild(frag);
  lazyCovers(container);
}

let coverObserver = null;
function lazyCovers(container) {
  if (coverObserver) coverObserver.disconnect();
  coverObserver = new IntersectionObserver((entries) => {
    for (const en of entries) {
      if (!en.isIntersecting) continue;
      coverObserver.unobserve(en.target);
      const card = en.target, al = card._album;
      S.source.cover(al).then((url) => {
        if (!url) return;
        const img = new Image();
        img.onload = () => { const c = card.querySelector('.cover'); c.querySelector('.ph')?.remove(); c.prepend(img); };
        img.src = url;
      }).catch(() => {});
    }
  }, { root: container.closest('.pane'), rootMargin: '300px' });
  container.querySelectorAll('.card').forEach((c) => coverObserver.observe(c));
}

async function renderAlbum(al) {
  const v = view();
  v.innerHTML = '<div class="pane" style="height:100%" id="alpane"></div>';
  const pane = $('#alpane');
  loading(pane);
  const tracks = await S.source.albumTracks(al.key);
  const dur = tracks.reduce((s, t) => s + (t.duration || 0), 0);
  const fmts = [...new Set(tracks.map((t) => codecName(t.codec)).filter(Boolean))].join(' / ');
  pane.innerHTML = `<button class="back" id="back">← Back</button>
    <div class="album-head"><div class="cover" id="al-cover" style="background:linear-gradient(135deg,hsl(${hue(al.title + al.artist)} 32% 22%),hsl(${(hue(al.artist) + 40) % 360} 28% 12%))"><span class="ph">${esc(initials(al.title))}</span></div>
      <div class="meta"><div class="kind">Album${fmts ? ' · ' + esc(fmts) : ''}</div><h1>${esc(al.title)}</h1>
      <div class="sub"><a href="#" id="al-artist" style="color:inherit">${esc(al.artist)}</a>${al.year ? ' · ' + al.year : ''} · ${tracks.length} songs · ${fmtLong(dur)}</div>
      <div class="row-actions" style="margin:0"><button class="btn primary" id="al-play">▶ Play</button><button class="btn" id="al-shuf">⤮ Shuffle</button><button class="btn" id="al-add">+ Add to playlist</button><button class="btn" id="al-next">Play next</button></div></div></div>
    <div class="table album-table" id="al-table"></div>`;
  $('#back').onclick = () => { S.album = null; render(); };
  $('#al-artist').onclick = (e) => { e.preventDefault(); goArtist(al); };
  $('#al-play').onclick = () => play(tracks, 0);
  $('#al-shuf').onclick = () => { const t = [...tracks]; shuffle(t); play(t, 0); };
  $('#al-add').onclick = () => enqueue(tracks);
  $('#al-next').onclick = () => playNext(tracks);
  const mxBtn = document.createElement('button'); mxBtn.className = 'btn'; mxBtn.textContent = 'Add to mixtape'; mxBtn.onclick = () => toMixtape(async () => tracks);
  $('#al-next').after(mxBtn);
  S.source.cover(al).then((url) => { if (url) { const c = $('#al-cover'); if (c) c.innerHTML = `<img src="${esc(url)}">`; } }).catch(() => {});
  trackTable($('#al-table'), tracks, { compact: true });
}

function goArtist(al) {
  S.view = 'artists'; S.album = null; S.query = ''; $('#search').value = '';
  S.artist = { key: al.artistKey || al.artist.toLowerCase(), name: al.artist };
  for (const b of document.querySelectorAll('#tabs button')) b.classList.toggle('on', b.dataset.view === 'artists');
  render();
}

// Track table (non-virtual, for albums and search results)
function trackTable(container, tracks, { compact, mixtape = null }) {
  S.rows = tracks; S.rowsMixtape = mixtape;
  const cur = trackKey(P()?.getCurrent());
  container.innerHTML = compact
    ? '<div class="thead"><span>#</span><span>Title</span><span>Format</span><span style="text-align:right">Time</span></div>'
    : '<div class="thead"><span>#</span><span>Title</span><span>Artist</span><span>Album</span><span>Year</span><span>Genre</span><span>Format</span><span style="text-align:right">Time</span></div>';
  const frag = document.createDocumentFragment();
  tracks.forEach((t, i) => frag.appendChild(trackRow(t, i, compact, cur)));
  container.appendChild(frag);
}

function trackRow(t, i, compact, cur) {
  const row = document.createElement('div');
  row.className = 'tr' + (trackKey(t) === cur ? ' playing' : '') + (S.selected.has(i) ? ' sel' : '') + (t.missing ? ' missing' : '');
  row.dataset.i = i;
  const fmtCls = t.lossless ? 'c-fmt lossless' : 'c-fmt';
  const fmtTxt = esc(codecName(t.codec)) + (t.bitrate && !t.lossless ? ` ${t.bitrate}` : '');
  const title = esc(t.title || (t.path || t.url || '').split(/[\\/]/).pop());
  row.innerHTML = compact
    ? `<span class="c-num">${t.track || i + 1}</span><span class="c-title">${title}</span><span class="${fmtCls}">${fmtTxt}</span><span class="c-dur">${fmt(t.duration)}</span>`
    : `<span class="c-num">${i + 1}</span><span class="c-title">${title}</span><span>${esc(t.artist)}</span><span>${esc(t.album)}</span><span class="c-year">${t.year || ''}</span><span>${esc(t.genre)}</span><span class="${fmtCls}">${fmtTxt}</span><span class="c-dur">${fmt(t.duration)}</span>`;
  row.onmousedown = (e) => selectRow(e, i);
  row.ondblclick = () => play(S.rows, i);
  row.oncontextmenu = (e) => {
    if (!S.selected.has(i)) { S.selected = new Set([i]); paintSelection(); }
    const sel = selectedTracks();
    const mxId = S.rowsMixtape;
    const idx = [...S.selected];
    ctx(e, [['Play', () => play(sel, 0)], ['Add to playlist', () => enqueue(sel)], ['Play next', () => playNext(sel)], ['Add to mixtape…', () => toMixtape(async () => sel)], null,
      ...(mxId ? [['Remove from this mixtape', async () => { await P().removeFromMixtape(mxId, idx); render(); }]] : []),
      ...(sel[0]?.path ? [['Show in folder', () => R.showInFolder(sel[0].path)]] : [])]);
  };
  row.draggable = true;
  row.ondragstart = (e) => { if (!S.selected.has(i)) { S.selected = new Set([i]); paintSelection(); } e.dataTransfer.setData('application/x-wavedeck-tracks', JSON.stringify(selectedTracks())); };
  return row;
}

let anchor = null;
function selectRow(e, i) {
  if (e.button !== 0) return;
  if (e.shiftKey && anchor !== null) { const a = Math.min(anchor, i), b = Math.max(anchor, i); S.selected = new Set(Array.from({ length: b - a + 1 }, (_, k) => a + k)); }
  else if (e.ctrlKey || e.metaKey) { S.selected.has(i) ? S.selected.delete(i) : S.selected.add(i); anchor = i; }
  else { if (!S.selected.has(i) || S.selected.size > 1) S.selected = new Set([i]); anchor = i; }
  paintSelection();
}
function paintSelection() { document.querySelectorAll('.tr').forEach((r) => r.classList.toggle('sel', S.selected.has(+r.dataset.i))); }
function selectedTracks() { return [...S.selected].sort((a, b) => a - b).map((i) => S.rows[i]).filter(Boolean); }
function markPlaying() { const cur = trackKey(P()?.getCurrent()); document.querySelectorAll('.tr').forEach((r) => r.classList.toggle('playing', trackKey(S.rows[+r.dataset.i]) === cur)); }

// Songs view: virtualised so 100k-track libraries stay fast
function renderSongs() {
  const all = S.source.songs();
  if (!all) { view().innerHTML = '<div class="empty"><div><h2>Songs</h2><p>Type in the search box to find songs on this server, or browse by artist or album.</p></div></div>'; return; }
  const { key, dir } = S.sort.songs;
  const val = (t) => key === 'title' ? (t.title || '') : key === 'album' ? `${t.album || ''}|${String(t.disc || 1).padStart(3, '0')}|${String(t.track || 0).padStart(4, '0')}` : key === 'year' ? String(t.year || 0).padStart(5, '0') : key === 'duration' ? String(Math.round(t.duration || 0)).padStart(7, '0') : key === 'genre' ? (t.genre || '') : `${(t.albumartist || t.artist || '').replace(/^the\s+/i, '')}|${t.album || ''}|${String(t.disc || 1).padStart(3, '0')}|${String(t.track || 0).padStart(4, '0')}`;
  const rows = all.map((t) => [val(t).toLowerCase(), t]).sort((a, b) => a[0].localeCompare(b[0], undefined, { numeric: true }) * dir).map((x) => x[1]);
  S.rows = rows;
  const v = view();
  const cols = [['', 'num'], ['Title', 'title'], ['Artist', 'artist'], ['Album', 'album'], ['Year', 'year'], ['Genre', 'genre'], ['Format', ''], ['Time', 'duration']];
  v.innerHTML = `<div class="songs-wrap" id="sw"><div class="thead">${cols.map(([l, k]) => `<span data-k="${k}" class="${k === key ? 'sorted' : ''}" ${k === 'duration' ? 'style="text-align:right"' : ''}>${l}${k === key ? (dir > 0 ? ' ↑' : ' ↓') : ''}</span>`).join('')}</div><div class="vspacer" id="vs"></div></div>`;
  v.querySelectorAll('.thead span[data-k]').forEach((s) => { if (!s.dataset.k || s.dataset.k === 'num') return; s.onclick = () => { S.sort.songs = { key: s.dataset.k, dir: S.sort.songs.key === s.dataset.k ? -S.sort.songs.dir : 1 }; renderSongs(); }; });
  const wrap = $('#sw'), spacer = $('#vs');
  const RH = 32;
  spacer.style.height = rows.length * RH + 'px';
  const cur = trackKey(P()?.getCurrent());
  let last = '';
  const paint = () => {
    const top = Math.max(0, wrap.scrollTop - 34), h = wrap.clientHeight;
    const a = Math.max(0, Math.floor(top / RH) - 10), b = Math.min(rows.length, Math.ceil((top + h) / RH) + 10);
    const k = `${a}-${b}`;
    if (k === last) return; last = k;
    const frag = document.createDocumentFragment();
    for (let i = a; i < b; i++) { const r = trackRow(rows[i], i, false, cur); r.style.position = 'absolute'; r.style.left = r.style.right = '0'; r.style.top = i * RH + 'px'; frag.appendChild(r); }
    spacer.replaceChildren(frag);
  };
  wrap.onscroll = paint;
  new ResizeObserver(() => { last = ''; paint(); }).observe(wrap);
  paint();
}

async function renderSearch(q) {
  const v = view();
  v.innerHTML = '<div class="pane" style="height:100%" id="spane"><div class="loading">Searching…</div></div>';
  let r;
  try { r = await S.source.search(q); } catch (e) { $('#spane').innerHTML = `<div class="loading">${esc(e.message)}</div>`; return; }
  if (S.query !== q) return;
  const pane = $('#spane');
  if (!r.artists.length && !r.albums.length && !r.songs.length) { pane.innerHTML = `<div class="empty"><div><h2>No results for “${esc(q)}”</h2></div></div>`; return; }
  pane.innerHTML = `${r.artists.length ? '<div class="section-title">Artists</div><div class="list" id="s-art" style="border:0;display:flex;flex-wrap:wrap;gap:6px;padding:0"></div>' : ''}
    ${r.albums.length ? '<div class="section-title">Albums</div><div class="grid" id="s-alb"></div>' : ''}
    ${r.songs.length ? `<div class="section-title">Songs <span style="text-transform:none;letter-spacing:0">(${r.songs.length})</span></div><div class="table" id="s-songs"></div>` : ''}`;
  if (r.artists.length) {
    const box = $('#s-art');
    for (const a of r.artists) {
      const b = document.createElement('button');
      b.style.width = 'auto';
      b.innerHTML = `<span class="avatar" style="background:hsl(${hue(a.name)} 30% 20%)">${esc(initials(a.name))}</span><span class="name">${esc(a.name)}</span>`;
      b.onclick = () => goArtist({ artistKey: a.key, artist: a.name });
      box.appendChild(b);
    }
  }
  if (r.albums.length) albumGrid($('#s-alb'), r.albums, { showArtist: true });
  if (r.songs.length) trackTable($('#s-songs'), r.songs, { compact: false });
}

// ---------------- player actions ----------------
function shuffle(a) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } }
async function play(tracks, start) {
  const p = P(); if (!p || !tracks.length) return;
  await p.addTracks(tracks, { replace: true });
  p.playIndex(start || 0);
}
async function enqueue(tracks) { const p = P(); if (!p || !tracks.length) return; await p.addTracks(tracks); toast(`Added ${tracks.length} song${tracks.length === 1 ? '' : 's'} to the playlist`); }
// Add to mixtape: native menu listing the player's mixtapes, plus "New mixtape…".
async function toMixtape(getTracks, { newOnly = false } = {}) {
  const p = P(); if (!p) return;
  const tapes = p.mixtapes();
  const id = newOnly ? '__new' : await R.popupMenu([...tapes.map((m) => ({ id: m.id, label: `${m.name}  (${m.count})` })), ...(tapes.length ? [{ type: 'separator' }] : []), { id: '__new', label: 'New mixtape…' }]);
  if (!id) return;
  const tracks = await getTracks();
  if (id !== '__new') { await p.addToMixtape(id, tracks); toast(`Added to ${tapes.find((m) => m.id === id)?.name}`); return; }
  const d = modal(`<h2>Name your mixtape</h2>${tracks.length ? `<p class="hint">${tracks.length} song${tracks.length === 1 ? '' : 's'} will be added.</p>` : ''}<div class="row"><input id="mx-name" spellcheck="false"></div><div class="foot"><button class="btn" id="mx-cancel">Cancel</button><button class="btn primary" id="mx-ok">Create mixtape</button></div>`);
  const inp = d.querySelector('#mx-name'); inp.placeholder = 'Name your mixtape, e.g. Road Trip'; inp.focus();
  const ok = async () => { const m = await p.createMixtape(inp.value || p.nextMixtapeName(), tracks); closeModal(); toast(`Created ${m.name}`); };
  d.querySelector('#mx-ok').onclick = ok; d.querySelector('#mx-cancel').onclick = closeModal;
  inp.onkeydown = (e) => { if (e.key === 'Enter') ok(); };
}

async function playNext(tracks) {
  const p = P(); if (!p || !tracks.length) return;
  const st = p.getState();
  await p.addTracks(tracks, { at: Math.max(0, st.current + 1) });
  toast(`${tracks.length} song${tracks.length === 1 ? '' : 's'} will play next`);
}

// ---------------- context menu, toast, modal ----------------
function ctx(e, items) {
  e.preventDefault(); e.stopPropagation();
  const m = $('#ctx');
  m.innerHTML = '';
  for (const it of items) {
    if (!it) { m.appendChild(document.createElement('hr')); continue; }
    const b = document.createElement('button'); b.textContent = it[0]; b.onclick = () => { hideCtx(); it[1](); }; m.appendChild(b);
  }
  m.hidden = false;
  const r = m.getBoundingClientRect();
  m.style.left = Math.min(e.clientX, innerWidth - r.width - 6) + 'px';
  m.style.top = Math.min(e.clientY, innerHeight - r.height - 6) + 'px';
}
function hideCtx() { $('#ctx').hidden = true; }
let toastT;
function toast(msg) { const t = $('#toast'); t.textContent = msg; t.hidden = false; clearTimeout(toastT); toastT = setTimeout(() => { t.hidden = true; }, 2600); }
function modal(html) { const m = $('#modal'); m.innerHTML = `<div class="dialog">${html}</div>`; m.hidden = false; m.onclick = (e) => { if (e.target === m) closeModal(); }; return m.firstElementChild; }
function closeModal() { $('#modal').hidden = true; $('#modal').innerHTML = ''; }

async function foldersDialog() {
  const lib = await R.lib.get();
  const d = modal(`<h2>Music folders</h2><p class="hint">Wavedeck watches these folders and organizes everything it finds by artist, album and song. Network shares work too: use a path like <code>\\\\NAS\\Music</code> or a mapped drive letter.</p>
    <div class="items" id="f-items"></div>
    <div class="row"><input id="f-path" placeholder="\\\\server\\share\\Music  or  Z:\\Music"><button class="btn" id="f-addpath">Add path</button></div>
    <div class="foot"><span class="msg" id="f-msg"></span><button class="btn" id="f-browse">Browse…</button><button class="btn primary" id="f-done">Done</button></div>`);
  const paint = (folders) => {
    const box = d.querySelector('#f-items');
    box.innerHTML = folders.length ? '' : '<div class="item"><span class="p" style="font-family:inherit;color:var(--muted)">No folders yet</span></div>';
    for (const f of folders) {
      const it = document.createElement('div'); it.className = 'item';
      it.innerHTML = `<span class="p" title="${esc(f)}">${esc(f)}</span><span class="s">${f.startsWith('\\\\') ? 'network' : 'local'}</span><button class="btn small danger">Remove</button>`;
      it.querySelector('button').onclick = async () => paint(await R.lib.removeFolder(f));
      box.appendChild(it);
    }
  };
  paint(lib.folders);
  d.querySelector('#f-browse').onclick = async () => paint(await R.lib.addFolder());
  d.querySelector('#f-addpath').onclick = async () => {
    const p = d.querySelector('#f-path').value.trim(); if (!p) return;
    const r = await R.lib.addFolderPath(p);
    const msg = d.querySelector('#f-msg');
    if (r.error) { msg.textContent = r.error; msg.className = 'msg err'; } else { msg.textContent = 'Added, scanning…'; msg.className = 'msg ok'; paint(r.folders); d.querySelector('#f-path').value = ''; }
  };
  d.querySelector('#f-done').onclick = closeModal;
}

async function serversDialog() {
  const lib = await R.lib.get();
  let servers = [...(lib.servers || [])];
  const d = modal(`<h2>Network music servers</h2><p class="hint">Stream from a server on your network. Wavedeck speaks the Subsonic API, which Navidrome, Gonic, Airsonic, Ampache and Jellyfin (with its Subsonic plugin) all support. Your password is stored on this PC only.</p>
    <div class="items" id="s-items"></div>
    <div class="grid2"><div><label>Name</label><input id="s-name" placeholder="Living room NAS"></div><div><label>Server URL</label><input id="s-url" placeholder="http://192.168.1.20:4533"></div>
    <div><label>Username</label><input id="s-user"></div><div><label>Password</label><input id="s-pass" type="password"></div></div>
    <div class="foot"><span class="msg" id="s-msg"></span><button class="btn" id="s-test">Test</button><button class="btn primary" id="s-add">Add server</button><button class="btn" id="s-done">Done</button></div>`);
  const paint = () => {
    const box = d.querySelector('#s-items');
    box.innerHTML = servers.length ? '' : '<div class="item"><span class="p" style="font-family:inherit;color:var(--muted)">No servers yet</span></div>';
    servers.forEach((s, i) => {
      const it = document.createElement('div'); it.className = 'item';
      it.innerHTML = `<span class="p">${esc(s.name)} — ${esc(s.url)}</span><span class="s">${esc(s.user)}</span><button class="btn small danger">Remove</button>`;
      it.querySelector('button').onclick = async () => { servers.splice(i, 1); await save(); paint(); };
      box.appendChild(it);
    });
  };
  const form = () => ({ id: Date.now().toString(36), name: d.querySelector('#s-name').value.trim() || d.querySelector('#s-url').value.trim(), url: d.querySelector('#s-url').value.trim(), user: d.querySelector('#s-user').value.trim(), pass: d.querySelector('#s-pass').value });
  const msg = (t, cls) => { const m = d.querySelector('#s-msg'); m.textContent = t; m.className = 'msg ' + (cls || ''); };
  const test = async () => {
    const cfg = form();
    if (!/^https?:\/\//.test(cfg.url)) { msg('URL must start with http:// or https://', 'err'); return null; }
    msg('Connecting…');
    try { await new SubsonicSource(cfg).load(); msg('Connected', 'ok'); return cfg; } catch (e) { msg(`Couldn't connect: ${e.message}`, 'err'); return null; }
  };
  const save = async () => {
    await R.lib.setServers(servers);
    S.sources = [S.sources[0], ...servers.map((c) => S.sources.find((s) => s.id === 'ss:' + c.id) || new SubsonicSource(c))];
    for (const s of S.sources) if (s.kind === 'subsonic' && s.ok === null) s.load().catch(() => {}).finally(renderSources);
    if (!S.sources.includes(S.source)) S.source = S.sources[0];
    renderSources();
  };
  d.querySelector('#s-test').onclick = test;
  d.querySelector('#s-add').onclick = async () => { const cfg = await test(); if (!cfg) return; servers.push(cfg); await save(); paint(); ['#s-name', '#s-url', '#s-user', '#s-pass'].forEach((s) => { d.querySelector(s).value = ''; }); };
  d.querySelector('#s-done').onclick = () => { closeModal(); render(); };
  paint();
}

init();
