# Making skins

## Where to find skins

You don't have to make one. Thousands of existing skins work in Wavedeck:

- **[Winamp Skin Museum](https://skins.webamp.org/)**: tens of thousands of classic `.wsz` skins, searchable, with previews. Created by [Jordan Eldredge](https://jordaneldredge.com/), who also made Webamp, the engine behind Wavedeck's modern skins.
- **[WinCustomize](https://www.wincustomize.com/explore/winamp)**: a long-running Winamp skin archive, including modern `.wal` skins. Run by [Stardock](https://www.stardock.com/) and its community of skin artists.

Download a skin and drop the file on the player. To keep it in the Skins menu, put it in the skins folder (right-click → Skins → Open skins folder).

> Wavedeck also **loads** modern Winamp 5 skins (`.wal`) and Windows Media Player, Sonique, K-Jofol, Audion, Cowon and JetAudio skins. Just drop one on the player. This guide covers making Wavedeck's own classic-layout skins.

Most people should use **Theme Studio** (right-click the player → Theme Studio). It builds a complete theme from design choices, with no drawing needed. Themes made there contain a `recipe.json` and are redrawn at the player's current size, so they stay sharp when scaled. They also include ordinary sprite sheets, so everything below still applies if you want to hand-edit one: use *Export the sprite sheets* at the bottom of Theme Studio.

The rest of this page is for artists who want full pixel control.

Wavedeck reads two skin formats with the same renderer:

| Format | What it is |
|---|---|
| `.wsz` | A classic Winamp 2.x skin: a zip of `.bmp` sprite sheets plus `viscolor.txt` and `pledit.txt`. |
| `.wdskin` | Wavedeck's format: the same sprite sheets as PNG (transparency allowed), plus `skin.json` and an optional `library.css`. |

The quickest start: right-click the player → **Skins → Export skin template (.wdskin)**. Rename the file to `.zip`, unzip it, edit the PNGs, zip the files back up (files at the root of the zip, not inside a folder) and rename to `.wdskin`. Drop it on the player to try it. Put finished skins in the Skins folder (Skins → Open skins folder) to have them listed in the menu.

Any sheet you leave out falls back to the built-in skin, so you can restyle one piece at a time.

## Sprite sheets

All coordinates are in pixels, `x,y width×height`.

**main** (275×116): the main window background. Things drawn on top of it: time digits at 48/60/78/90, y 26; visualizer 24,43 76×16; song title 111,27 154×6; kbps 111,43; kHz 156,43.

**titlebar** (344×87)
- Title bar active 27,0 275×14 · inactive 27,15
- Windowshade background active 27,29 · inactive 27,42
- Buttons 9×9 (normal / pressed): menu 0,0 / 0,9 · minimize 9,0 / 9,9 · close 18,0 / 18,9 · shade 0,18 / 9,18 · unshade 0,27 / 9,27
- Clutter bar 304,0 8×43; lit letters O 304,47 · A 312,55 · I 320,62 · D 328,69 · V 336,77

**cbuttons** (136×36): previous 0,0 · play 23,0 · pause 46,0 · stop 69,0 (all 23×18) · next 92,0 22×18 · eject 114,0 22×16. Pressed versions are directly below (y 18, eject y 16).

**numbers** (99×13): digits 0–9, each 9×13, left to right; blank at 90. The minus sign is the 5×1 strip at 20,6 (the middle bar of the "2"). **nums_ex** (108×13) adds blank at 90 and a full minus at 99.

**text** (155×18): 5×6 font. Row 0: `a–z " @` with space at column 30. Row 1: `0–9 … . : ( ) - ' ! _ + \ / [ ] ^ & % , = $ #`. Row 2: `Å Ö Ä ? *`. The top-left pixel color of the space glyph is used as the text background.

**posbar** (307×10): track 0,0 248×10 · thumb 248,0 29×10 · pressed thumb 278,0.

**volume** (68×433): 28 backgrounds stacked every 15 px (68×13, quietest first) · thumb pressed 0,422 · thumb 15,422 (14×11).
**balance** (47×433): same as volume, backgrounds start at x 9 and are 38 wide; frame 0 is centered.

**shufrep** (92×85): repeat 0,0 28×15 · shuffle 28,0 47×15, with rows for off, off-pressed, on, on-pressed at y 0/15/30/45. EQ button 0,61 and playlist button 23,61 (23×12), lit versions at y 73, pressed at x 46 and 69.

**monoster** (56×24): stereo lit 0,0 / off 0,12 (29×12) · mono lit 29,0 / off 29,12 (27×12).
**playpaus** (42×9): playing 0 · paused 9 · stopped 18.

**eqmain** (275×315)
- Background 0,0 275×116; title bar active 0,134 · inactive 0,149
- Close 0,116 / pressed 0,125
- ON 10,119 (pressed 128) · ON lit 69,119 (pressed 187), 26×12
- AUTO 36,119 (pressed 154) · AUTO lit 95,119 (pressed 213), 32×12
- Slider backgrounds: 28 frames 14×63, from 13,164, 14 per row, 15 px apart, rows 65 px apart (frame 0 = −12 dB)
- Slider thumb 0,164 · pressed 0,176 (11×11)
- Presets button 224,164 / pressed 224,176 (44×12)
- Graph background 0,294 113×19 · graph line colors 115,294 1×19 · preamp line 0,314 113×1

**pledit** (280×186): playlist frame.
- Top (active / inactive at y 0 / 21): left corner 0 25×20 · title 26 100×20 · tile 127 25×20 · right corner 153 25×20
- Sides: left 0,42 12×29 · right 31,42 20×29 (holds the scrollbar groove)
- Scroll handle 52,53 / pressed 61,53 (8×18)
- Bottom: left 0,72 125×38 (ADD REM SEL MISC buttons at x 14, 43, 72, 101) · right 126,72 150×38 (LIST button 22 px from the right)

## Text files

**viscolor.txt**: 24 lines of `r,g,b`. Line 1 background, 2 grid dots, 3–18 spectrum colors from top to bottom, 19–23 oscilloscope, 24 peak dots.

**region.txt** (optional): cuts windows to a custom outline, in the same format Winamp uses. Sections `[Normal]` (main window), `[Equalizer]` and `[WindowShade]`, each with `NumPoints=` (points per polygon) and `PointList=` (x,y pairs in skin pixels). Anything outside the polygons is transparent and clicks pass through.

**pledit.txt**
```
[Text]
Normal=#8FA3B8
Current=#2DE2C5
NormalBG=#0C0E14
SelectedBG=#1D3A46
Font=Segoe UI
```

**skin.json** (.wdskin only)
```json
{ "name": "My Skin", "author": "You", "version": "1.0", "format": "wdskin/1" }
```

**library.css** (.wdskin only): CSS injected into the Media Library window. The easiest approach is overriding its color variables:
```css
:root { --bg: #101418; --panel: #161b21; --accent: #ff7a59; --text: #e8ecf1; }
```
