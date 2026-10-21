// Skin loading. One engine renders both classic Winamp 2.x skins (.wsz) and
// Wavedeck skins (.wdskin). A .wdskin is the same sprite-sheet layout, but sheets
// may be PNG (with transparency), plus an optional skin.json and library.css.
import { buildDefaultSheets, DEFAULT_VISCOLORS, DEFAULT_PLEDIT } from './defaultskin.js';
import { buildTheme, buildSheetsSync, DEFAULT_RECIPE, normalizeRecipe, themeColors } from './themegen.js';

export const SHEETS = ['main', 'titlebar', 'cbuttons', 'numbers', 'nums_ex', 'text', 'posbar', 'volume', 'balance', 'shufrep', 'monoster', 'playpaus', 'pledit', 'eqmain'];

let defaults = null;
function defaultSheets() { if (!defaults) defaults = buildDefaultSheets(); return defaults; }

function toUrl(canvas) { return canvas.toDataURL('image/png'); }

function finalize(name, sheets, extra = {}) {
  const res = extra.res || 1;
  const urls = {}, size = {};
  for (const k of Object.keys(sheets)) { urls[k] = toUrl(sheets[k]); size[k] = [Math.round(sheets[k].width / res), Math.round(sheets[k].height / res)]; }
  return {
    name,
    sheets,
    urls,
    size,
    res,
    recipe: extra.recipe || null,
    viscolors: extra.viscolors || DEFAULT_VISCOLORS,
    pledit: { ...DEFAULT_PLEDIT, ...(extra.pledit || {}) },
    meta: extra.meta || { name },
    libraryCss: extra.libraryCss || '',
    hasNumsEx: !!extra.hasNumsEx,
    builtin: !!extra.builtin,
  };
}

// A skin generated from a theme recipe, drawn natively at `res` screen pixels per skin pixel.
export async function recipeSkin(recipeIn, res = 1, { builtin = false } = {}) {
  const t = await buildTheme(recipeIn, res);
  return finalize(t.recipe.name || 'Untitled theme', t.sheets, {
    res, recipe: t.recipe, viscolors: t.vis, pledit: t.pledit, libraryCss: t.libraryCss, hasNumsEx: true, builtin,
    meta: { name: t.recipe.name, author: t.recipe.author },
  });
}

export function defaultSkin(res = 1) {
  const r = normalizeRecipe(DEFAULT_RECIPE);
  const c = themeColors(r);
  return finalize(r.name, buildSheetsSync(r, res), { res, recipe: r, builtin: true, hasNumsEx: true, viscolors: c.vis, pledit: { ...c.pledit, font: DEFAULT_PLEDIT.font }, libraryCss: '', meta: { name: r.name, author: r.author } });
}

function parseViscolor(text) {
  const out = [];
  for (const line of text.split(/\r?\n/)) {
    const m = line.match(/^\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/);
    if (m) out.push(`rgb(${m[1]},${m[2]},${m[3]})`);
    if (out.length === 24) break;
  }
  return out.length >= 18 ? out.concat(DEFAULT_VISCOLORS.slice(out.length)) : null;
}

function parsePledit(text) {
  const out = {};
  for (const line of text.split(/\r?\n/)) {
    const m = line.match(/^\s*(\w+)\s*=\s*(.+?)\s*$/);
    if (!m) continue;
    const k = m[1].toLowerCase();
    let v = m[2];
    if (['normal', 'current', 'normalbg', 'selectedbg', 'mbbg', 'mbfg'].includes(k)) {
      v = v.replace(/^#?/, '#').slice(0, 7);
      if (!/^#[0-9a-f]{6}$/i.test(v)) continue;
    }
    out[k] = v;
  }
  return out;
}

async function decodeImage(bytes, ext) {
  const type = ext === 'png' ? 'image/png' : ext === 'gif' ? 'image/gif' : 'image/bmp';
  const bmp = await createImageBitmap(new Blob([bytes], { type }));
  const c = document.createElement('canvas');
  c.width = bmp.width; c.height = bmp.height;
  c.getContext('2d').drawImage(bmp, 0, 0);
  return c;
}

// Draw a skin's sheet over the default sheet so partial/undersized images still work.
function overlay(base, img) {
  const c = document.createElement('canvas');
  c.width = Math.max(base.width, img.width); c.height = Math.max(base.height, img.height);
  const x = c.getContext('2d');
  x.drawImage(base, 0, 0);
  x.clearRect(0, 0, img.width, img.height);
  x.drawImage(img, 0, 0);
  return c;
}

export async function loadSkinArchive(bytes, fallbackName, { res = 1 } = {}) {
  const zip = await window.JSZip.loadAsync(bytes);
  // Recipe themes (made in Theme Studio) are rebuilt from their recipe so they render sharp at any size.
  const recipeFile = Object.values(zip.files).find((f) => !f.dir && /(^|\/)recipe\.json$/i.test(f.name));
  if (recipeFile) {
    try {
      const recipe = JSON.parse(await recipeFile.async('string'));
      if (recipe.bg && recipe.bg.file) {
        const bgf = Object.values(zip.files).find((f) => f.name.split('/').pop() === recipe.bg.file);
        if (bgf) {
          const ext = recipe.bg.file.split('.').pop().toLowerCase();
          recipe.bg.src = `data:image/${ext === 'png' ? 'png' : 'jpeg'};base64,` + await bgf.async('base64');
        }
      }
      return await recipeSkin(recipe, res);
    } catch (e) { console.warn('recipe theme failed, falling back to sheets', e); }
  }
  const index = {};
  zip.forEach((rel, entry) => {
    if (entry.dir) return;
    const base = rel.split('/').pop();
    const dot = base.lastIndexOf('.');
    if (dot < 0) return;
    const key = base.slice(0, dot).toLowerCase();
    const ext = base.slice(dot + 1).toLowerCase();
    const existing = index[key];
    // prefer png > bmp, and shallower paths
    if (!existing || (ext === 'png' && existing.ext !== 'png')) index[key] = { entry, ext };
    if (ext === 'txt' || ext === 'json' || ext === 'css') index[`${key}.${ext}`] = { entry, ext };
  });

  const d = defaultSheets();
  const sheets = {};
  let hasNumsEx = false;
  for (const name of SHEETS) {
    const f = index[name];
    if (f && ['bmp', 'png', 'gif'].includes(f.ext)) {
      try {
        const img = await decodeImage(await f.entry.async('uint8array'), f.ext);
        sheets[name] = overlay(d[name], img);
        if (name === 'nums_ex') hasNumsEx = true;
        continue;
      } catch (e) { console.warn('Skin sheet failed', name, e); }
    }
  }
  // Classic fallbacks: balance borrows volume; numbers <-> nums_ex
  if (!sheets.balance && sheets.volume) {
    const c = document.createElement('canvas'); c.width = 47; c.height = 433;
    c.getContext('2d').drawImage(sheets.volume, 9, 0); sheets.balance = c;
  }
  if (!sheets.numbers && sheets.nums_ex) sheets.numbers = sheets.nums_ex;
  for (const name of SHEETS) if (!sheets[name]) sheets[name] = d[name];
  if (!hasNumsEx) sheets.nums_ex = null;

  const readText = async (key) => (index[key] ? index[key].entry.async('string') : null);
  const vis = await readText('viscolor.txt');
  const pl = await readText('pledit.txt');
  const json = await readText('skin.json');
  const css = await readText('library.css');
  let meta = { name: fallbackName };
  if (json) { try { meta = { ...meta, ...JSON.parse(json) }; } catch { /* ignore */ } }

  if (!hasNumsEx) delete sheets.nums_ex;
  return finalize(meta.name || fallbackName, sheets, {
    viscolors: vis ? parseViscolor(vis) : null,
    pledit: pl ? parsePledit(pl) : (meta.playlist || null),
    meta, libraryCss: css || '', hasNumsEx,
  });
}

// Export the built-in skin as a template archive skin authors can edit.
export async function exportTemplate() {
  const zip = new window.JSZip();
  const sheets = defaultSheets();
  for (const [k, c] of Object.entries(sheets)) {
    const blob = await new Promise((r) => c.toBlob(r, 'image/png'));
    zip.file(`${k}.png`, blob);
  }
  zip.file('viscolor.txt', DEFAULT_VISCOLORS.map((c) => {
    const m = c.match(/\d+/g); if (m && c.startsWith('rgb')) return m.slice(0, 3).join(',');
    const h = c.replace('#', ''); return [0, 2, 4].map((i) => parseInt(h.substr(i, 2), 16)).join(',');
  }).join('\r\n'));
  zip.file('pledit.txt', `[Text]\r\nNormal=${DEFAULT_PLEDIT.normal}\r\nCurrent=${DEFAULT_PLEDIT.current}\r\nNormalBG=${DEFAULT_PLEDIT.normalbg}\r\nSelectedBG=${DEFAULT_PLEDIT.selectedbg}\r\nFont=Segoe UI\r\n`);
  zip.file('skin.json', JSON.stringify({ name: 'My Wavedeck Skin', author: '', version: '1.0', format: 'wdskin/1' }, null, 2));
  zip.file('library.css', '/* Optional: restyle the Media Library window.\n   Override any of these variables. */\n:root {\n  /* --bg: #0d0f14; --panel: #141720; --accent: #2de2c5; --text: #d7deef; */\n}\n');
  zip.file('README.txt', [
    'Wavedeck skin template',
    '====================',
    'Each PNG is a sprite sheet in the classic layout (same as Winamp 2.x .bmp files).',
    'Edit them in any image editor; PNG transparency is supported.',
    'viscolor.txt  - 24 visualizer colours (r,g,b per line)',
    'pledit.txt    - playlist text colours and font',
    'skin.json     - name / author / version',
    'library.css   - optional CSS variables for the Media Library window',
    '',
    'Zip the files (no folder inside) and rename to .wdskin, then drop it on Wavedeck.',
  ].join('\r\n'));
  return zip.generateAsync({ type: 'uint8array' });
}

// Package a Theme Studio recipe as a .wdskin: the recipe (for sharp re-rendering and
// re-editing) plus 1x sprite sheets so any classic-format reader can still use it.
export async function packRecipeTheme(recipeIn) {
  const t = await buildTheme(recipeIn, 1);
  const recipe = { ...t.recipe };
  const zip = new window.JSZip();
  if (recipe.bg && recipe.bg.src) {
    const m = recipe.bg.src.match(/^data:image\/(\w+);base64,(.*)$/);
    if (m) { const file = `background.${m[1] === 'png' ? 'png' : 'jpg'}`; zip.file(file, m[2], { base64: true }); recipe.bg = { ...recipe.bg, file }; delete recipe.bg.src; }
  }
  zip.file('recipe.json', JSON.stringify(recipe, null, 2));
  for (const [k, c] of Object.entries(t.sheets)) zip.file(`${k}.png`, await new Promise((r) => c.toBlob(r, 'image/png')));
  const rgb = (c) => { const h = c.replace('#', ''); return [0, 2, 4].map((i) => parseInt(h.substr(i, 2), 16)).join(','); };
  zip.file('viscolor.txt', t.vis.map(rgb).join('\r\n'));
  zip.file('pledit.txt', `[Text]\r\nNormal=${t.pledit.normal}\r\nCurrent=${t.pledit.current}\r\nNormalBG=${t.pledit.normalbg}\r\nSelectedBG=${t.pledit.selectedbg}\r\nFont=${t.pledit.font}\r\n`);
  zip.file('library.css', t.libraryCss);
  zip.file('skin.json', JSON.stringify({ name: recipe.name, author: recipe.author || '', version: '1.0', format: 'wdskin/1', generator: 'Wavedeck Theme Studio' }, null, 2));
  return zip.generateAsync({ type: 'uint8array', compression: 'DEFLATE' });
}

// Export just the sprite sheets of a recipe for hand editing in an image editor.
export async function packRecipeSheets(recipeIn, res = 1) {
  const t = await buildTheme(recipeIn, res);
  const zip = new window.JSZip();
  for (const [k, c] of Object.entries(t.sheets)) zip.file(`${k}.png`, await new Promise((r) => c.toBlob(r, 'image/png')));
  zip.file('skin.json', JSON.stringify({ name: t.recipe.name + ' (edited)', author: t.recipe.author || '', version: '1.0', format: 'wdskin/1' }, null, 2));
  return zip.generateAsync({ type: 'uint8array', compression: 'DEFLATE' });
}
