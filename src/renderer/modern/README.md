# Modern skin engine

`webamp-modern.js` is a build of the open-source **Webamp Modern** engine
(https://github.com/captbaritone/webamp, MIT license, see `LICENSE-webamp-modern.txt`)
with a small patch. The patch, and a script that rebuilds this file from source,
are in [`vendor/webamp-modern`](../../../vendor/webamp-modern).

`bridge.js` connects the engine to Wavedeck's player (playback, volume, balance,
EQ, visualizer data, text fields). `../modern.html` hosts the engine in a
transparent, click-through window and mirrors Wavedeck's playlist into the skin.
