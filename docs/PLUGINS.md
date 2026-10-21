# Writing plugins

A plugin is a folder with a `plugin.json` and a JavaScript module. Put it in the Plugins folder (right-click the player → Plugins → Open plugins folder) and restart Wavedeck.

```
Plugins/
  my-plugin/
    plugin.json
    index.js
```

**plugin.json**
```json
{
  "name": "My Plugin",
  "version": "1.0.0",
  "author": "You",
  "description": "What it does.",
  "main": "index.js"
}
```

**index.js** exports a default function that receives the plugin API:
```js
export default function activate(api) {
  api.player.on('trackchange', (track) => {
    api.ui.notify(`Now: ${track.displayTitle}`);
  });
}
```

## API

### `api.player`
| | |
|---|---|
| `play()` `pause()` `stop()` `next()` `prev()` | Transport controls |
| `seek(seconds)` `setVolume(0–100)` | |
| `getCurrentTrack()` | Track object or `null` |
| `getState()` | `{ status, time, duration, volume }`; status is `playing`, `paused` or `stopped` |
| `getPlaylist()` | Array of track objects |
| `addTracks(items, { play, replace, at })` | Items are file paths, URLs or track objects |
| `on(event, fn)` | Events: `trackchange` (track), `statechange` (status), `tick` ({time, duration}, every frame while playing), `skinchange`. Returns an unsubscribe function. |

A track object has `path` or `url`, `displayTitle`, and when known `title`, `artist`, `album`, `albumartist`, `track`, `disc`, `year`, `genre`, `duration`, `bitrate`, `sampleRate`, `channels`, `codec`, `lossless`.

### `api.audio`
| | |
|---|---|
| `context()` | The Web Audio `AudioContext` |
| `getSpectrum()` | `Uint8Array` frequency data |
| `getWaveform()` | `Uint8Array` time-domain data |
| `setEffectChain((ctx, input, output) => { … })` | Insert your own DSP between the EQ and the volume stage. Connect `input` through your nodes to `output`. Pass `null` to remove. |

```js
// A simple echo
api.audio.setEffectChain((ctx, input, output) => {
  const delay = ctx.createDelay(); delay.delayTime.value = 0.25;
  const fb = ctx.createGain(); fb.gain.value = 0.3;
  input.connect(output);
  input.connect(delay).connect(fb).connect(delay);
  fb.connect(output);
});
```

### `api.vis.register({ id, name, draw(ctx, engine, colors, w, h) })`
Adds a mode to the main window visualizer (click it to cycle modes). `ctx` is a 2D canvas context (76×16 in the main window). `colors` is the skin's 24 visualizer colors. `engine.spectrum()`, `engine.waveform()` and `engine.levels()` give you audio data.

### `api.ui`
| | |
|---|---|
| `addMenuItem(label, fn)` | Adds an entry under the Plugins menu |
| `notify(text, ms)` | Shows text in the song title display |

### `api.storage`
`get(key)` and `set(key, value)` save JSON-serializable settings for your plugin.

### `api.files.writeText(name, text)`
Writes a text file into your plugin's data folder and resolves to its full path. Useful for stream overlays.

## Examples
The bundled `now-playing` and `vu-meter` plugins in the app's `plugins` folder are short, complete examples.
