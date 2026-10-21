# Changelog

## 1.4.0 (October 21, 2026)

**Modern skins**

- Load Winamp 5 / Winamp3 freeform skins (`.wal`), including skins with MAKI scripts, color themes, drawers and custom shapes.
- Also loads Windows Media Player (`.wmz`), Sonique (`.sgf`), K-Jofol (`.kjofol`), Audion (`.face`), Cowon (`.uib`) and JetAudio (`.jsk`) skins.
- Modern skins float on the desktop in their own shapes; empty areas click through to whatever is behind them.
- The skin's buttons, sliders, EQ, visualizer and playlist window all drive Wavedeck, so your library, Browse tab, mixtapes and Navidrome streaming keep working.
- Skins open where your player was and remember their position, and the last skin you used comes back on startup.
- Right-click opens Wavedeck's menu; choose *Skins → Back to classic skin* to return.
- Windows you close on a skin (an About or welcome window, say) stay closed next time, and windows you open stay open.
- Song length, bitrate and playlist totals show real values on the skin.
- Side windows open clear of a skin's slide-out drawers.
- Modern skins scale: Ctrl + / Ctrl −, Ctrl+D, Ctrl + mouse wheel or *Options → Size*, in the same sharp whole-pixel steps as classic skins.
- Like Winamp, a skin's transparent areas don't catch the mouse, and windows drag from any part of their artwork that isn't a control. Fixes drawers whose controls couldn't be clicked (D-Reliction's EQ, Config and Colors) and windows that wouldn't drag.
- Fixed skin scripts mis-evaluating `&&` and `||`, which broke knobs and other scripted controls (WooHoo-FER's volume knob), and right-clicks being treated as left-clicks by skin scripts.
- A skin's Library button opens Wavedeck's Media Library; right-click always opens Wavedeck's menu; prompts such as naming a mixtape appear over the skin.

**Media Library**

- New *Mixtapes* section: play, shuffle, rename, delete and remove songs from your mixtapes.
- Music servers get a *Playlists* tab for their own playlists, and every source has a *Shuffle all* button, so everything from the Browse tab is reachable while a modern skin is showing.
- The right-click menu has *Play a mixtape* for one-click access.

**Shaped classic skins**

- Classic `.wsz` skins with a `region.txt` are now cut to their outline, so rounded and odd-shaped classic skins no longer show colored corners.

**Open source**

- Every change to the bundled skin engine is in `vendor/webamp-modern` (a patch plus a rebuild script). `THIRD-PARTY-NOTICES.md` lists every bundled component and its license.
- Powered by the open-source Webamp Modern engine (MIT license). Very script-heavy skins may not work perfectly yet.

## 1.3.0 (October 21, 2026)

**Browse tab, Shuffle all and Mixtapes**

- **Browse tab** in the playlist window (click *Browse* or press Tab). Step through your music by artist, album and song without opening the Media Library. Works with local music and with Navidrome and other Subsonic-compatible servers, including server playlists and recently added albums. Arrow keys, Enter and Backspace to get around.
- **Shuffle all songs** plays random songs from your whole library or server and keeps topping up the queue as you listen.
- **Mixtapes**: your own named playlists, saved in the player. One tape can mix local files and server songs. Add to a mixtape by right-clicking songs, albums, artists or playlist rows (in the player or the Media Library), or save the whole playlist with *LIST → Save as mixtape*. Rename, reorder, shuffle and delete them under *Browse → Mixtapes*. Server logins are never stored in mixtape files.
- The Media Library album page gets an *Add to mixtape* button.

## 1.2.0 (October 20, 2026)

**Theme Studio**

- Build a full theme without drawing: start from 8 styles (Midnight, Brushed Steel, Y2K Chrome, Synthwave, Walnut Hi-Fi, Paper Minimal, Cassette, Carbon Racing), then adjust colors, finish (flat, brushed metal, chrome, wood, carbon fiber, leather, frosted glass), button shape, lettering, display type, bevel, roundness, glow and texture.
- Pull a color palette from any picture, or use a picture as the background with darken and blur.
- *Describe it* turns words like "walnut 70s stereo" into a starting point; *Surprise me* shuffles within tasteful limits; full undo.
- Every change previews live on the player. Themes save as small `.wdskin` files.
- Studio themes are drawn natively at the player's current size, so they stay sharp at 2×, 3× and 4×. The Media Library picks up the theme's colors.

## 1.1.0 (October 20, 2026)

**Scalable player**

- Drag any edge or corner to scale the whole player with proportions locked.
- Sizes snap to whole pixels so skins stay sharp at any Windows display scaling, and it stops growing once it would no longer fit the screen.
- Ctrl+= / Ctrl+- / Ctrl+0, Ctrl+D for double size, or right-click → Options → Size.

## 1.0.0 (October 20, 2026)

**First release**

- Classic three-window player: main window, 10-band equalizer and playlist editor.
- Plays FLAC, MP3, OGG, Opus, WAV and M4A; reads ID3, Vorbis and MP4 tags.
- Equalizer with preamp, 18 presets, your own presets and per-song EQ memory.
- Playlist editing: drag and drop, reorder, sort, crop, remove duplicates, jump to file, M3U/M3U8/PLS.
- Spectrum and oscilloscope visualizer, plus a Milkdrop visualization window.
- Loads classic Winamp 2.x `.wsz` skins.
- Media Library: browse by artist, album, song and genre; local folders and network shares; streaming from Subsonic-compatible servers.
- JavaScript plugins, with Now Playing file and VU meter examples.
- Classic keyboard shortcuts and global media keys.
