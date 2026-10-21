# Wavedeck

A free, classic-style music player for Windows. It's a FLAC and MP3 player first, with the three-window layout, skins and visualizer people loved in Winamp 2, plus a modern media library and network streaming.

**[Download the latest version](https://github.com/visivopro/Wavedeck/releases/latest)** · **[Website](https://visivopro.github.io/Wavedeck/)** · **[What's new](CHANGELOG.md)**

## Features

**Classic player**
- Plays FLAC, MP3, OGG/Opus, WAV, M4A/AAC. Reads ID3, Vorbis and MP4 tags.
- Main window, 10-band equalizer and playlist editor stacked in one window. Windowshade mode, always on top.
- Scalable: drag any edge or corner to resize the whole player with proportions locked. Sizes snap to whole-pixel steps so skins stay razor sharp at any Windows display scaling, and it stops growing once it would no longer fit the screen. Ctrl+= / Ctrl+- / Ctrl+0, Ctrl+D for double size, or right-click → Options → Size. Double-click an edge to reset.
- Scrolling title, elapsed/remaining time, kbps / kHz / mono-stereo display, seek bar, volume and balance.
- Equalizer: preamp, 10 bands (60 Hz – 16 kHz), ON/AUTO, 18 built-in presets, save your own presets. AUTO remembers EQ settings per song.
- Playlist: add files / folders / URLs, drag & drop, drag to reorder, multi-select, sort, randomize, reverse, crop, remove duplicates, M3U/M3U8/PLS load & save, jump-to-file (J), file info.
- Built-in visualizer: spectrum analyzer and oscilloscope, colored by the skin.
- Visualization window with thousands of Milkdrop presets (butterchurn), fullscreen with F.
- All the classic hotkeys: Z X C V B, L, J, R, S, arrows, Ctrl+D, Ctrl+T, Ctrl+W, Alt+G, Alt+E. Keyboard media keys work globally.
- Remembers playlist, position, skin, EQ and window placement.

**Theme Studio** (right-click → Theme Studio, or Ctrl+Shift+T)
- Make great-looking themes without drawing anything. Start from a style (Midnight, Brushed Steel, Y2K Chrome, Synthwave, Walnut Hi-Fi, Paper Minimal, Cassette, Carbon Racing), then adjust.
- Colors: pick an accent, highlight and body color, or pull a matching palette from any picture. Text contrast is kept readable automatically.
- Finish: flat, brushed metal, chrome, wood, carbon fiber, leather or frosted glass. Square, rounded or pill buttons. Pixel-retro or clean modern lettering.
- Display type (green LCD, blue VFD, amber, white OLED, red LED), bevel depth, roundness, glow and texture sliders, plus an optional background picture with darken and blur.
- "Describe it" turns words like *neon pink tokyo night* or *walnut 70s stereo* into a starting point. "Surprise me" shuffles within tasteful limits. Full undo.
- Every change previews live on the player. Themes save as small `.wdskin` files you can share.
- Studio themes are drawn natively at whatever size the player is scaled to, so they stay sharp at 2×, 3× and 4×. The Media Library window picks up the theme's colors too.

**Skins**
- Loads classic Winamp 2.x skins (`.wsz`), so thousands of existing skins work. Drag one onto the player to apply it.
- Also loads **modern skins**: Winamp 5 / Winamp3 freeform skins (`.wal`), plus Windows Media Player (`.wmz`), Sonique (`.sgf`), K-Jofol (`.kjofol`), Audion (`.face`), Cowon (`.uib`) and JetAudio (`.jsk`) skins. They float on the desktop in their own shapes, their scripts run, and they control Wavedeck's playback, EQ, playlist and visualizer, so the library, Browse tab, mixtapes and server streaming keep working. Pick *Back to classic skin* in the Skins menu to return. Powered by the open-source Webamp Modern engine.
- Wavedeck's own `.wdskin` format: same sprite-sheet layout, but PNG with transparency, plus `skin.json` metadata and an optional `library.css` that themes the Media Library.
- Options → Skins → *Export skin template* writes the built-in skin as a ready-to-edit `.wdskin`. See [docs/SKINS.md](docs/SKINS.md).

**Browse tab and Mixtapes**
- The playlist window has a **Browse** tab (or press Tab): drill through your music by Artist → Album → Song without leaving the player. Works with your local library and Navidrome / Subsonic servers, including server playlists and recently added albums.
- **Shuffle all songs** plays random songs from your whole library or server and keeps topping up the queue as you listen.
- **Mixtapes** are your own playlists, saved in the player. Mix local files and server songs on the same tape. Right-click any song, album, artist or playlist selection → Add to mixtape, or LIST → Save as mixtape. Rename, reorder and delete them from Browse → Mixtapes.

**Media Library** (Alt+L)
- Organizes your music by **Artist → Album → Song**, plus Albums, Songs and Genres views, and search across everything.
- Watches any folders you add: local drives, USB drives, **network shares** (`\\NAS\Music` or a mapped drive). Incremental rescans only re-read changed files.
- Album pages with cover art (embedded or `cover.jpg`/`folder.jpg`), Play / Shuffle / Add to playlist / Play next, drag albums or songs into the playlist.
- **Network servers**: connects to any Subsonic-compatible server (Navidrome, Gonic, Airsonic, Ampache, Jellyfin with its Subsonic plugin) and streams from it.

**Plugins**
- JavaScript plugins can control playback, react to track changes, add visualizer modes, insert Web Audio effects (DSP), add menu items and write output files. See [docs/PLUGINS.md](docs/PLUGINS.md).
- Two bundled examples: *Now Playing file* (writes `nowplaying.txt` for OBS) and *VU Meter*.

## Building

Requires Node.js 20+.

```
npm install
npm start            # run in development
npm run dist         # build the Windows installer and portable exe into dist/
```

Building the Windows installer on Linux or macOS also needs Wine.

## Notes

Wavedeck is an independent project. It is not affiliated with Winamp or its owners; it only reads the publicly documented classic skin format. The built-in skin and all artwork are original.
