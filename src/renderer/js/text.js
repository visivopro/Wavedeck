// Bitmap text drawn from the skin's text.bmp sheet.
import { lookupChar } from './font.js';

export function drawSkinText(ctx, skin, str, x, y) {
  const img = skin.sheets.text, r = skin.res || 1;
  let cx = x;
  for (const ch of String(str)) {
    const [row, col] = lookupChar(ch);
    ctx.drawImage(img, col * 5 * r, row * 6 * r, 5 * r, 6 * r, cx, y, 5, 6);
    cx += 5;
  }
  return cx - x;
}

// Fill a canvas with the text sheet's background colour (the colour of the space glyph).
export function textBg(ctx, skin, w, h) {
  const [row, col] = lookupChar(' ');
  const r = skin.res || 1;
  ctx.drawImage(skin.sheets.text, col * 5 * r + r / 2, row * 6 * r + r / 2, 1, 1, 0, 0, w, h);
}

export function fmtTime(sec, pad = true) {
  if (!isFinite(sec) || sec < 0) sec = 0;
  sec = Math.floor(sec);
  const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60;
  if (h) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${pad ? String(m).padStart(2, '0') : m}:${String(s).padStart(2, '0')}`;
}
