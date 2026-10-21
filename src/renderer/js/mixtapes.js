// Mixtapes: user-made playlists saved on this PC. A mixtape can hold local
// files and songs from network servers side by side. Server songs are stored
// by server id + song id (no passwords or tokens); the stream address is
// rebuilt when the song is played.
const R = window.wavedeck;

const META = ['title', 'artist', 'albumartist', 'album', 'track', 'disc', 'year', 'genre', 'duration', 'bitrate', 'sampleRate', 'channels', 'codec', 'lossless', 'source'];

export function toRef(t) {
  const ref = {};
  for (const k of META) if (t[k] !== undefined && t[k] !== null) ref[k] = t[k];
  if (t.server && t.songId) { ref.server = t.server; ref.songId = t.songId; }
  else if (t.path) ref.path = t.path;
  else if (t.url) { ref.url = t.url; if (t.displayTitle) ref.displayTitle = t.displayTitle; }
  return ref;
}
const refKey = (r) => (r.server ? `${r.server}:${r.songId}` : r.path || r.url);

export class Mixtapes {
  constructor() { this.list = []; this.listeners = new Set(); }
  async load() {
    const l = await R.mixtapes.get();
    this.list = Array.isArray(l) ? l : [];
    this.emit();
    return this.list;
  }
  onChange(fn) { this.listeners.add(fn); return () => this.listeners.delete(fn); }
  emit() { this.listeners.forEach((fn) => fn(this.list)); }
  async save() { await R.mixtapes.save(this.list); this.emit(); }
  get(id) { return this.list.find((m) => m.id === id); }
  nextName() {
    const used = new Set(this.list.map((m) => m.name));
    for (let i = this.list.length + 1; ; i++) { const n = `Mixtape ${i}`; if (!used.has(n)) return n; }
  }
  async create(name, tracks = []) {
    const m = { id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6), name: String(name).trim() || this.nextName(), created: Date.now(), updated: Date.now(), tracks: tracks.map(toRef) };
    this.list.unshift(m);
    await this.save();
    return m;
  }
  // Adds tracks, skipping ones already on the tape. Returns how many were added.
  async add(id, tracks) {
    const m = this.get(id); if (!m) return 0;
    const have = new Set(m.tracks.map(refKey));
    const fresh = tracks.map(toRef).filter((r) => { const k = refKey(r); if (!k || have.has(k)) return false; have.add(k); return true; });
    m.tracks.push(...fresh); m.updated = Date.now();
    await this.save();
    return fresh.length;
  }
  async removeAt(id, index) { const m = this.get(id); if (!m) return; m.tracks.splice(index, 1); m.updated = Date.now(); await this.save(); }
  async move(id, index, delta) {
    const m = this.get(id); if (!m) return;
    const j = index + delta; if (j < 0 || j >= m.tracks.length) return;
    [m.tracks[index], m.tracks[j]] = [m.tracks[j], m.tracks[index]]; m.updated = Date.now();
    await this.save();
  }
  async replaceTracks(id, tracks) { const m = this.get(id); if (!m) return; m.tracks = tracks.map(toRef); m.updated = Date.now(); await this.save(); }
  async rename(id, name) { const m = this.get(id); if (!m || !String(name).trim()) return; m.name = String(name).trim(); m.updated = Date.now(); await this.save(); }
  async remove(id) { this.list = this.list.filter((m) => m.id !== id); await this.save(); }
}
