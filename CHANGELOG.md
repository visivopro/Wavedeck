# Changelog

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
