// Browse tab: drill through Mixtapes, This PC and network servers by
// Artist → Album → Song, right inside the playlist window.
import { LocalSource, SubsonicSource } from './sources.js';

const R = window.wavedeck;
const fmt = (sec) => { if (!sec) return ''; sec = Math.round(sec); const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60; return h ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}` : `${m}:${String(s).padStart(2, '0')}`; };

// ---------------------------------------------------------------- sources
export class SourceManager {
  constructor() { this.local = null; this.servers = []; this.ready = null; }
  load() {
    if (!this.ready) this.ready = this.refresh();
    return this.ready;
  }
  async refresh() {
    const local = new LocalSource();
    await local.load();
    this.local = local;
    const lib = await R.lib.get();
    const old = new Map(this.servers.map((s) => [s.cfg.id, s]));
    this.servers = (lib.servers || []).map((cfg) => {
      const prev = old.get(cfg.id);
      return prev && prev.cfg.url === cfg.url && prev.cfg.user === cfg.user && prev.cfg.pass === cfg.pass ? prev : new SubsonicSource(cfg);
    });
    this.ready = Promise.resolve();
  }
  server(id) { return this.servers.find((s) => s.cfg.id === id) || null; }
  async connect(s) { if (s.ok !== true) { try { await s.load(); } catch { /* s.error set */ } } return s.ok; }
  all() { return [this.local, ...this.servers].filter(Boolean); }
  byId(id) { return this.all().find((s) => s.id === id); }
}

// ---------------------------------------------------------------- items
// kind: up | folder | action | song | info
const up = () => ({ kind: 'up', label: '..' });
const info = (label) => ({ kind: 'info', label });

export class Browser {
  constructor(app) {
    this.app = app;
    this.stack = [];       // levels: { title, path, load, items, sel, scroll }
    this.version = 0;
    this.loading = false;
    this.sel = 0;
    this.scroll = 0;
  }
  get level() { return this.stack[this.stack.length - 1]; }
  get items() { return this.level ? this.level.items : []; }
  get crumb() { return this.stack.slice(1).map((l) => l.title).join(' › ') || 'Library'; }

  async open() { if (!this.stack.length) await this.push(this.rootLevel()); }
  async push(level) {
    if (this.level) { this.level.sel = this.sel; this.level.scroll = this.scroll; }
    this.stack.push(level);
    this.sel = 0; this.scroll = 0;
    await this.reload();
  }
  back() {
    if (this.stack.length <= 1) return false;
    this.stack.pop();
    this.sel = this.level.sel || 0; this.scroll = this.level.scroll || 0;
    this.reload(true);
    return true;
  }
  home() { this.stack = this.stack.slice(0, 1); this.sel = 0; this.scroll = 0; this.reload(); }
  async reload(keep) {
    const lvl = this.level;
    if (!lvl) return;
    if (!keep || !lvl.items) {
      this.loading = true; lvl.items = [...(this.stack.length > 1 ? [up()] : []), info('Loading…')]; this.changed();
      let items;
      try { items = await lvl.load(); } catch (e) { items = [info(`Couldn't load: ${e.message || e}`)]; }
      if (this.level !== lvl) return;
      lvl.items = [...(this.stack.length > 1 ? [up()] : []), ...items];
      this.loading = false;
    }
    this.sel = Math.min(this.sel, Math.max(0, lvl.items.length - 1));
    this.changed();
  }
  // re-run the current level's loader, keeping position (after edits)
  async refreshLevel() { const s = this.sel, sc = this.scroll; await this.reload(); this.sel = Math.min(s, this.items.length - 1); this.scroll = sc; this.changed(); }
  changed() { this.version++; this.app.pl && this.app.pl.renderList(); }

  // ---------------- levels
  rootLevel() {
    const app = this.app, sm = app.sources;
    return {
      title: 'Library',
      load: async () => {
        await sm.load();
        const tapes = app.mixtapes.list;
        const items = [
          { kind: 'folder', label: 'Mixtapes', right: tapes.length ? String(tapes.length) : '', open: () => this.mixtapesLevel() },
        ];
        if (sm.local && sm.local.count) items.push({ kind: 'folder', label: 'This PC', right: sm.local.count.toLocaleString(), open: () => this.sourceLevel(sm.local) });
        for (const s of sm.servers) items.push({ kind: 'folder', label: s.name, right: s.ok === false ? 'offline' : 'server', open: () => this.sourceLevel(s) });
        if (!sm.local?.count && !sm.servers.length) {
          items.push(info(''), { kind: 'action', label: 'Add music folders or a server…', run: () => app.openLibrary() });
        }
        return items;
      },
    };
  }

  sourceLevel(src) {
    return {
      title: src.name,
      load: async () => {
        if (src.kind === 'subsonic' && !(await this.app.sources.connect(src))) {
          return [info(`Can't reach ${src.name}`), info(src.error || ''), { kind: 'action', label: 'Try again', run: () => this.refreshLevel() }];
        }
        const items = [
          { kind: 'action', label: '⤮ Shuffle all songs', strong: true, run: () => this.app.startEndless(src) },
          { kind: 'folder', label: 'Artists', open: () => this.artistsLevel(src) },
          { kind: 'folder', label: 'Albums', open: () => this.albumsLevel(src, 'Albums', async () => (await src.albums()).sort((a, b) => a.title.localeCompare(b.title, undefined, { sensitivity: 'base' }))) },
          { kind: 'folder', label: 'Recently added', open: () => this.albumsLevel(src, 'Recently added', () => src.recentAlbums()) },
        ];
        const pls = await src.playlists().catch(() => null);
        if (pls) items.push({ kind: 'folder', label: 'Server playlists', right: pls.length ? String(pls.length) : '', open: () => this.serverPlaylistsLevel(src) });
        return items;
      },
    };
  }

  artistsLevel(src) {
    return {
      title: 'Artists',
      load: async () => (await src.artists()).map((a) => ({
        kind: 'folder', label: a.name, right: a.albumCount ? String(a.albumCount) : '',
        open: () => this.artistLevel(src, a), tracks: () => src.artistTracks(a.key),
      })),
    };
  }

  artistLevel(src, a) {
    return {
      title: a.name,
      load: async () => {
        const albums = (await src.albums(a.key)).sort((x, y) => (y.year || 0) - (x.year || 0) || x.title.localeCompare(y.title));
        const all = () => src.artistTracks(a.key);
        return [
          { kind: 'action', label: '▶ Play all', strong: true, run: async () => this.app.playList(await all(), 0) },
          { kind: 'action', label: '⤮ Shuffle artist', run: async () => this.app.playList(await all(), 0, { shuffle: true }) },
          ...albums.map((al) => this.albumItem(src, al, false)),
        ];
      },
    };
  }

  albumItem(src, al, showArtist) {
    const label = `${showArtist ? `${al.artist} - ` : ''}${al.title}${al.year ? ` (${al.year})` : ''}`;
    return { kind: 'folder', label, right: al.trackCount ? String(al.trackCount) : '', open: () => this.albumLevel(src, al), tracks: () => src.albumTracks(al.key) };
  }

  albumsLevel(src, title, loader) {
    return { title, load: async () => (await loader()).map((al) => this.albumItem(src, al, true)) };
  }

  albumLevel(src, al) {
    return {
      title: al.title,
      load: async () => {
        const tracks = await src.albumTracks(al.key);
        return [
          { kind: 'action', label: '▶ Play album', strong: true, run: () => this.app.playList(tracks, 0) },
          { kind: 'action', label: '⤮ Shuffle album', run: () => this.app.playList(tracks, 0, { shuffle: true }) },
          ...tracks.map((t, i) => this.songItem(t, tracks, i, `${t.track || i + 1}. ${t.title || t.path}`)),
        ];
      },
    };
  }

  serverPlaylistsLevel(src) {
    return {
      title: 'Server playlists',
      load: async () => {
        const pls = await src.playlists();
        if (!pls.length) return [info('No playlists on this server yet')];
        return pls.map((p) => ({
          kind: 'folder', label: p.name, right: p.songCount ? String(p.songCount) : '',
          tracks: () => src.playlistTracks(p.key),
          open: () => ({
            title: p.name,
            load: async () => {
              const tracks = await src.playlistTracks(p.key);
              return [
                { kind: 'action', label: '▶ Play', strong: true, run: () => this.app.playList(tracks, 0) },
                { kind: 'action', label: '⤮ Shuffle', run: () => this.app.playList(tracks, 0, { shuffle: true }) },
                ...tracks.map((t, i) => this.songItem(t, tracks, i, `${t.artist ? `${t.artist} - ` : ''}${t.title}`)),
              ];
            },
          }),
        }));
      },
    };
  }

  songItem(t, list, i, label, extra = {}) {
    return { kind: 'song', label, right: fmt(t.duration), track: t, list, index: i, ...extra };
  }

  // ---------------- mixtapes
  mixtapesLevel() {
    const app = this.app;
    return {
      title: 'Mixtapes',
      load: async () => {
        const tapes = app.mixtapes.list;
        const items = [{ kind: 'action', label: '+ New mixtape…', strong: true, run: () => app.newMixtape() }];
        if (!tapes.length) items.push(info('No mixtapes yet. Right-click any song,'), info('album or artist and pick “Add to mixtape”.'));
        for (const m of tapes) {
          const dur = m.tracks.reduce((s, t) => s + (t.duration || 0), 0);
          items.push({
            kind: 'folder', mixtape: m.id, label: m.name, right: `${m.tracks.length}${dur ? ` · ${fmt(dur)}` : ''}`,
            open: () => this.mixtapeLevel(m.id), tracks: () => app.resolveRefs(app.mixtapes.get(m.id)?.tracks || []),
          });
        }
        return items;
      },
    };
  }

  mixtapeLevel(id) {
    const app = this.app;
    return {
      title: app.mixtapes.get(id)?.name || 'Mixtape',
      mixtape: id,
      load: async () => {
        const m = app.mixtapes.get(id);
        if (!m) return [info('This mixtape was deleted')];
        this.level.title = m.name;
        const tracks = await app.resolveRefs(m.tracks);
        const items = [
          { kind: 'action', label: '▶ Play mixtape', strong: true, run: () => app.playList(tracks, 0) },
          { kind: 'action', label: '⤮ Shuffle mixtape', run: () => app.playList(tracks, 0, { shuffle: true }) },
        ];
        if (!tracks.length) items.push(info('Empty. Right-click songs anywhere and'), info('choose “Add to mixtape” to fill it.'));
        tracks.forEach((t, i) => items.push(this.songItem(t, tracks, i, `${i + 1}. ${t.artist ? `${t.artist} - ` : ''}${t.title || t.displayTitle || (t.path || '').split(/[\\/]/).pop()}`, { mixtape: id, missing: t.missing })));
        return items;
      },
    };
  }

  // ---------------- activation
  async activate(i = this.sel) {
    const it = this.items[i];
    if (!it) return;
    if (it.kind === 'up') this.back();
    else if (it.kind === 'folder') await this.push(it.open());
    else if (it.kind === 'action') await it.run();
    else if (it.kind === 'song') {
      if (it.missing) { this.app.main.flash('SERVER NOT CONNECTED'); setTimeout(() => this.app.main.flash(null), 1500); return; }
      await this.app.playList(it.list, it.index);
    }
  }
}
