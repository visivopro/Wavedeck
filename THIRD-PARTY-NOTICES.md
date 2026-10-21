# Third-party software

Wavedeck is MIT licensed (see `LICENSE`). It includes or is built on these
open-source projects, all under permissive licenses:

| Component | Used for | License |
|---|---|---|
| [Electron](https://github.com/electron/electron) | App runtime (bundles Chromium and Node.js; their notices ship as `LICENSES.chromium.html` in the install folder) | MIT |
| [Webamp Modern](https://github.com/captbaritone/webamp) (`packages/webamp-modern`) | Modern skin engine, modified, see `vendor/webamp-modern` | MIT |
| [Butterchurn](https://github.com/jberg/butterchurn) and [butterchurn-presets](https://github.com/jberg/butterchurn-presets) | Milkdrop visualizations | MIT |
| [JSZip](https://github.com/Stuk/jszip) | Reading skin archives | MIT (dual MIT / GPLv3; used under MIT) |
| [music-metadata](https://github.com/Borewit/music-metadata) and its dependencies | Reading tags and cover art | MIT (one helper, `ieee754`, is BSD-3-Clause) |
| [@rgrove/parse-xml](https://github.com/rgrove/parse-xml), [id3-parser](https://github.com/creeperyang/id3-parser) | Bundled inside the skin engine | ISC / MIT |
| [electron-builder](https://github.com/electron-userland/electron-builder) | Building the installer (build tool only) | MIT |

## Skins

Wavedeck does not ship any third-party skins. The built-in theme and every
Theme Studio preset are original. Skins pictured on the website belong to their
artists and are shown running in Wavedeck with credit.
