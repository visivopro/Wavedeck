# Modern skin engine

`webamp-modern.js` is a build of the open-source **Webamp Modern** engine
(`packages/webamp-modern` in https://github.com/captbaritone/webamp, MIT license,
see `LICENSE-webamp-modern.txt`). It renders Winamp 5 / Winamp3 (`.wal`),
Windows Media Player (`.wmz`), Sonique (`.sgf`), K-Jofol (`.kjofol`),
Audion (`.face`), Cowon (`.uib`) and JetAudio (`.jsk`) skins.

## One change from upstream

In `src/skin/AudioPlayer.ts` the singleton is created through a hook so Wavedeck
can supply its own player:

```ts
const AUDIO_PLAYER: AudioPlayer = (window as any).__WAVEDECK_AUDIO__
  ? (window as any).__WAVEDECK_AUDIO__()
  : new AudioPlayer();
```

`bridge.js` defines that hook and routes playback, volume, balance, EQ and
visualizer data to Wavedeck's audio engine in the main window. `../modern.html`
hosts the engine in a transparent, click-through window and mirrors Wavedeck's
playlist into the skin.

## Rebuilding

From `packages/webamp-modern`, with an entry file that imports `./WebampModern`
and every `./skin/SkinEngine_*` module:

```
npm i esbuild jszip @rgrove/parse-xml@3 id3-parser@2 butterchurn butterchurn-presets
npx esbuild src/wavedeck-entry.ts --bundle --format=iife --target=chrome120 \
  --minify --keep-names --legal-comments=inline --outfile=webamp-modern.js
```

`--keep-names` is required: the engine looks up skin object classes by name.
