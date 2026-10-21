// Library sources. Each source exposes the same shape so the library UI can
// browse a local collection and a network server the same way:
//   artists() albums(artistKey?) albumTracks(albumKey) songs() genres() search(q) cover(album)

const R = window.wavedeck;
const norm = (s) => (s || '').trim().toLowerCase();
const byText = (a, b) => a.localeCompare(b, undefined, { sensitivity: 'base', numeric: true });
const sortName = (s) => s.replace(/^the\s+/i, '');

export class LocalSource {
  constructor() { this.id = 'local'; this.name = 'This PC'; this.kind = 'local'; this.tracks = []; this.coverCache = new Map(); }

  async load() {
    const lib = await R.lib.get();
    this.folders = lib.folders;
    this.tracks = Object.entries(lib.tracks).map(([path, t]) => ({ path, ...t }));
    this.index();
  }

  index() {
    const artists = new Map(), albums = new Map(), genres = new Map();
    for (const t of this.tracks) {
      const artistName = t.albumartist || t.artist || 'Unknown Artist';
      const albumName = t.album || 'Unknown Album';
      const aKey = norm(artistName);
      const alKey = aKey + '\u0000' + norm(albumName);
      if (!artists.has(aKey)) artists.set(aKey, { key: aKey, name: artistName, albums: new Set(), tracks: 0 });
      const ar = artists.get(aKey); ar.albums.add(alKey); ar.tracks++;
      if (!albums.has(alKey)) albums.set(alKey, { key: alKey, title: albumName, artist: artistName, artistKey: aKey, year: t.year || null, tracks: [], added: 0, lossless: false });
      const al = albums.get(alKey);
      al.tracks.push(t);
      al.added = Math.max(al.added, t.added || 0);
      if (t.year && (!al.year || t.year < al.year)) al.year = t.year;
      if (t.lossless) al.lossless = true;
      const g = t.genre || 'Unknown';
      const gk = norm(g);
      if (!genres.has(gk)) genres.set(gk, { key: gk, name: g, albums: new Set(), tracks: 0 });
      genres.get(gk).albums.add(alKey); genres.get(gk).tracks++;
    }
    for (const al of albums.values()) al.tracks.sort((a, b) => (a.disc || 1) - (b.disc || 1) || (a.track || 0) - (b.track || 0) || byText(a.title || a.path, b.title || b.path));
    this.artistMap = artists; this.albumMap = albums; this.genreMap = genres;
  }

  get count() { return this.tracks.length; }
  artists() { return [...this.artistMap.values()].map((a) => ({ key: a.key, name: a.name, albumCount: a.albums.size, trackCount: a.tracks })).sort((a, b) => byText(sortName(a.name), sortName(b.name))); }
  albums(artistKey) {
    let list = [...this.albumMap.values()];
    if (artistKey) list = list.filter((a) => a.artistKey === artistKey);
    return list.map((a) => this.albumInfo(a));
  }
  albumInfo(a) { return { key: a.key, title: a.title, artist: a.artist, artistKey: a.artistKey, year: a.year, trackCount: a.tracks.length, added: a.added, lossless: a.lossless, duration: a.tracks.reduce((s, t) => s + (t.duration || 0), 0) }; }
  albumsForGenre(gk) { const g = this.genreMap.get(gk); return g ? [...g.albums].map((k) => this.albumInfo(this.albumMap.get(k))) : []; }
  async albumTracks(albumKey) { return (this.albumMap.get(albumKey)?.tracks || []).map(toPlayer); }
  async artistTracks(artistKey) { return this.albums(artistKey).sort((a, b) => (a.year || 0) - (b.year || 0)).flatMap((a) => this.albumMap.get(a.key).tracks.map(toPlayer)); }
  songs() { return this.tracks.map(toPlayer); }
  genres() { return [...this.genreMap.values()].map((g) => ({ key: g.key, name: g.name, albumCount: g.albums.size, trackCount: g.tracks })).sort((a, b) => byText(a.name, b.name)); }
  async search(q) {
    const n = norm(q);
    return {
      artists: this.artists().filter((a) => norm(a.name).includes(n)).slice(0, 30),
      albums: this.albums().filter((a) => norm(a.title).includes(n) || norm(a.artist).includes(n)).slice(0, 60),
      songs: this.tracks.filter((t) => norm(t.title).includes(n) || norm(t.artist).includes(n) || norm(t.album).includes(n) || (!t.title && norm(t.path).includes(n))).slice(0, 500).map(toPlayer),
    };
  }
  async cover(album) {
    if (this.coverCache.has(album.key)) return this.coverCache.get(album.key);
    const first = this.albumMap.get(album.key)?.tracks[0];
    const p = first ? R.cover(first.path) : Promise.resolve(null);
    this.coverCache.set(album.key, p);
    return p;
  }
}

function toPlayer(t) {
  return {
    path: t.path, title: t.title, artist: t.artist, albumartist: t.albumartist, album: t.album, track: t.track, disc: t.disc,
    year: t.year, genre: t.genre, duration: t.duration, bitrate: t.bitrate, sampleRate: t.sampleRate, channels: t.channels,
    codec: t.codec, lossless: t.lossless,
  };
}

// ---------------- Subsonic / OpenSubsonic (Navidrome, Gonic, Airsonic, Jellyfin plugin…) ----------------
export class SubsonicSource {
  constructor(cfg) {
    this.cfg = cfg;
    this.id = 'ss:' + cfg.id;
    this.name = cfg.name || cfg.url;
    this.kind = 'subsonic';
    this.ok = null;
  }
  base() { return this.cfg.url.replace(/\/+$/, ''); }
  async auth() {
    const salt = Math.random().toString(36).slice(2, 10);
    const token = await R.md5(this.cfg.pass + salt);
    return `u=${encodeURIComponent(this.cfg.user)}&t=${token}&s=${salt}&v=1.16.1&c=Wavedeck&f=json`;
  }
  async call(method, params = {}) {
    const qs = Object.entries(params).map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join('&');
    const url = `${this.base()}/rest/${method}.view?${await this.auth()}${qs ? '&' + qs : ''}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    const r = json['subsonic-response'];
    if (!r || r.status !== 'ok') throw new Error(r?.error?.message || 'Server error');
    return r;
  }
  async load() {
    try { await this.call('ping'); this.ok = true; } catch (e) { this.ok = false; this.error = e.message; throw e; }
  }
  get count() { return null; }
  async artists() {
    const r = await this.call('getArtists');
    const out = [];
    for (const idx of r.artists?.index || []) for (const a of idx.artist || []) out.push({ key: a.id, name: a.name, albumCount: a.albumCount || 0, coverArt: a.coverArt });
    return out.sort((a, b) => byText(sortName(a.name), sortName(b.name)));
  }
  albumInfo(a) { return { key: a.id, title: a.name || a.title, artist: a.artist, artistKey: a.artistId, year: a.year, trackCount: a.songCount, duration: a.duration, coverArt: a.coverArt, added: a.created ? Date.parse(a.created) : 0 }; }
  async albums(artistKey) {
    if (artistKey) { const r = await this.call('getArtist', { id: artistKey }); return (r.artist?.album || []).map((a) => this.albumInfo(a)); }
    const out = [];
    for (let offset = 0; offset < 5000; offset += 500) {
      const r = await this.call('getAlbumList2', { type: 'alphabeticalByName', size: 500, offset });
      const list = r.albumList2?.album || [];
      out.push(...list.map((a) => this.albumInfo(a)));
      if (list.length < 500) break;
    }
    return out;
  }
  async albumTracks(albumKey) { const r = await this.call('getAlbum', { id: albumKey }); return Promise.all((r.album?.song || []).map((s) => this.toPlayer(s))); }
  async artistTracks(artistKey) { const albums = await this.albums(artistKey); const all = []; for (const a of albums) all.push(...(await this.albumTracks(a.key))); return all; }
  songs() { return null; }
  genres() { return null; }
  async search(q) {
    const r = await this.call('search3', { query: q, artistCount: 30, albumCount: 60, songCount: 300 });
    const s = r.searchResult3 || {};
    return {
      artists: (s.artist || []).map((a) => ({ key: a.id, name: a.name, albumCount: a.albumCount || 0 })),
      albums: (s.album || []).map((a) => this.albumInfo(a)),
      songs: await Promise.all((s.song || []).map((x) => this.toPlayer(x))),
    };
  }
  async toPlayer(s) {
    return {
      url: `${this.base()}/rest/stream.view?id=${encodeURIComponent(s.id)}&${await this.auth()}`,
      title: s.title, artist: s.artist, album: s.album, track: s.track, disc: s.discNumber, year: s.year, genre: s.genre,
      duration: s.duration, bitrate: s.bitRate, sampleRate: s.samplingRate, channels: s.channelCount || 2,
      codec: s.suffix, lossless: /flac|alac|wav|aiff/i.test(s.suffix || ''), source: this.name,
    };
  }
  async cover(album) {
    if (!album.coverArt) return null;
    return `${this.base()}/rest/getCoverArt.view?id=${encodeURIComponent(album.coverArt)}&size=300&${await this.auth()}`;
  }
}
