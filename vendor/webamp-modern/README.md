# Webamp Modern engine (modified)

Wavedeck's modern-skin support (`.wal`, `.wmz`, `.sgf`, `.kjofol`, `.face`, `.uib`, `.jsk`)
is a build of the **Webamp Modern** engine from
[captbaritone/webamp](https://github.com/captbaritone/webamp) (`packages/webamp-modern`, MIT license).

- `wavedeck.patch` holds every change made to upstream, against commit `7734cd3`.
- `build.sh` clones upstream, applies the patch and rebuilds
  `src/renderer/modern/webamp-modern.js`.

What the patch changes:

1. **AudioPlayer hook.** The engine's audio player is created through
   `window.__WAVEDECK_AUDIO__` when present, so skins drive Wavedeck's own player
   (see `src/renderer/modern/bridge.js`).
2. **Real text fields.** `songlength`, `songinfo`, `songbitrate`, `songsamplerate`
   and `pe_info` showed placeholder text upstream; they now ask the host player for real values.
3. **Unknown display names don't break a skin.** They log a warning and show nothing.
4. **`src/wavedeck-entry.ts`** (new) imports the engine and every skin format.

`--keep-names` is required when bundling: the engine looks up skin object classes by name.
