// Theme Studio: edit a theme recipe with friendly controls; every change is
// previewed live on the real player.
import { PRESETS, DISPLAYS, MATERIALS, DEFAULT_RECIPE, normalizeRecipe, previewMain, paletteFromImage, describe, surprise } from './themegen.js';

const app = window.opener.wavedeckPlayer.app;
const $ = (id) => document.getElementById(id);

let recipe = (() => {
  const cur = app.currentRecipe();
  if (cur && !app.skin.builtin) return normalizeRecipe(cur);
  return normalizeRecipe({ ...(cur || DEFAULT_RECIPE), name: 'My theme', author: '' });
})();
const history = [];
let dirty = false, saved = false, lastPicture = null;

// ---------------- live preview ----------------
let previewT = null;
function preview() { clearTimeout(previewT); previewT = setTimeout(() => app.previewRecipe(recipe), 70); }
function set(patch, { push = true, quiet = false } = {}) {
  if (push) { history.push(JSON.stringify(recipe)); if (history.length > 100) history.shift(); }
  recipe = normalizeRecipe({ ...recipe, ...patch });
  dirty = true;
  if (!quiet) render();
  preview();
}

// ---------------- presets ----------------
function buildPresets() {
  const box = $('presets');
  for (const p of PRESETS) {
    const b = document.createElement('button');
    b.className = 'preset'; b.dataset.id = p.id;
    const c = previewMain(p, 2);
    c.style.aspectRatio = '275 / 116';
    b.append(c);
    const s = document.createElement('span'); s.textContent = p.name; b.append(s);
    b.onclick = () => set({ ...p, id: undefined, name: recipe.name, author: recipe.author, titleText: recipe.titleText, bg: recipe.bg, preset: p.id });
    box.append(b);
  }
}

// ---------------- chips ----------------
function chips(id, options, key, { dot } = {}) {
  const box = $(id); box.innerHTML = '';
  for (const [value, label] of options) {
    const b = document.createElement('button');
    b.dataset.value = value;
    b.innerHTML = (dot ? `<i style="background:${dot(value)}"></i>` : '') + label;
    b.onclick = () => set({ [key]: value });
    box.append(b);
  }
}
const displayDot = (v) => (v === 'match' ? recipe.accent : DISPLAYS[v].fg);

const ACCENTS = ['#2de2c5', '#29e7ff', '#3fa9ff', '#6a5cff', '#b26bff', '#ff2e97', '#e5484d', '#f26b1d', '#ffb547', '#ffd400', '#7ccf5a', '#eef2fa'];
function buildSwatches() {
  const box = $('swatches');
  for (const c of ACCENTS) {
    const b = document.createElement('button');
    b.style.background = c; b.title = c; b.dataset.c = c;
    b.onclick = () => set({ accent: c });
    box.append(b);
  }
}

// ---------------- render controls from recipe ----------------
function render() {
  $('name').value = recipe.name || '';
  $('author').value = recipe.author || '';
  $('titleText').value = recipe.titleText || '';
  for (const k of ['accent', 'accent2', 'base']) $(k).value = recipe[k];
  document.querySelectorAll('#swatches button').forEach((b) => b.classList.toggle('on', b.dataset.c.toLowerCase() === recipe.accent.toLowerCase()));
  document.querySelectorAll('.preset').forEach((b) => b.classList.toggle('on', b.dataset.id === recipe.preset));
  chips('display', Object.entries(DISPLAYS).map(([k, v]) => [k, v.name]), 'display', { dot: displayDot });
  for (const [id, key] of [['display', 'display'], ['material', 'material'], ['buttons', 'buttons'], ['labels', 'labels']]) {
    document.querySelectorAll(`#${id} button`).forEach((b) => b.classList.toggle('on', b.dataset.value === recipe[key]));
  }
  for (const k of ['bevel', 'roundness', 'glow', 'texture']) { $(k).value = recipe[k]; $(k).nextElementSibling.textContent = k === 'glow' || k === 'texture' ? Math.round(recipe[k] * 100) + '%' : recipe[k]; }
  $('texture-row').classList.toggle('disabled', recipe.material === 'flat');
  const bg = recipe.bg;
  $('bg-thumb').style.backgroundImage = bg && bg.src ? `url(${bg.src})` : '';
  $('bg-thumb').textContent = bg && bg.src ? '' : 'None';
  $('bg-remove').disabled = !(bg && bg.src);
  for (const [id, k] of [['bg-dim', 'dim'], ['bg-blur', 'blur']]) {
    const v = bg ? (bg[k] ?? (k === 'dim' ? 0.35 : 0)) : (k === 'dim' ? 0.35 : 0);
    $(id).value = v; $(id).disabled = !(bg && bg.src);
    $(id).nextElementSibling.textContent = Math.round(v * 100) + '%';
    $(id).closest('.slider').classList.toggle('disabled', !(bg && bg.src));
  }
  $('undo').disabled = !history.length;
}

// ---------------- pictures ----------------
function pickImage() {
  return new Promise((resolve) => {
    const f = $('file'); f.value = '';
    f.onchange = () => {
      const file = f.files[0]; if (!file) return resolve(null);
      const rd = new FileReader();
      rd.onload = () => { const img = new Image(); img.onload = () => resolve(img); img.onerror = () => resolve(null); img.src = rd.result; };
      rd.readAsDataURL(file);
    };
    f.click();
  });
}
// Keep themes small: downscale pictures to what the player can show.
function toBgSrc(img) {
  const max = 1400, s = Math.min(1, max / Math.max(img.width, img.height));
  const c = document.createElement('canvas'); c.width = Math.round(img.width * s); c.height = Math.round(img.height * s);
  c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
  return c.toDataURL('image/jpeg', 0.86);
}

// ---------------- wire up ----------------
function bind() {
  $('name').oninput = (e) => set({ name: e.target.value || 'My theme' }, { push: false, quiet: true });
  $('author').oninput = (e) => set({ author: e.target.value }, { push: false, quiet: true });
  $('titleText').oninput = (e) => set({ titleText: e.target.value || 'WAVEDECK' }, { push: false, quiet: true });
  for (const k of ['accent', 'accent2', 'base']) {
    $(k).addEventListener('input', (e) => set({ [k]: e.target.value }, { push: false }));
    $(k).addEventListener('change', () => { history.push(JSON.stringify(recipe)); render(); });
  }
  for (const k of ['bevel', 'roundness', 'glow', 'texture']) {
    $(k).addEventListener('pointerdown', () => history.push(JSON.stringify(recipe)));
    $(k).addEventListener('input', (e) => set({ [k]: +e.target.value }, { push: false }));
  }
  for (const [id, k] of [['bg-dim', 'dim'], ['bg-blur', 'blur']]) {
    $(id).addEventListener('pointerdown', () => history.push(JSON.stringify(recipe)));
    $(id).addEventListener('input', (e) => set({ bg: { ...recipe.bg, [k]: +e.target.value } }, { push: false }));
  }
  $('from-image').onclick = async () => {
    const img = await pickImage(); if (!img) return;
    lastPicture = img;
    set({ ...paletteFromImage(img), display: recipe.display });
    $('use-as-bg').hidden = false;
    toast('Colors pulled from your picture');
  };
  $('use-as-bg').onclick = () => { if (lastPicture) set({ bg: { src: toBgSrc(lastPicture), dim: 0.4, blur: 0.25 } }); $('use-as-bg').hidden = true; };
  $('bg-pick').onclick = async () => { const img = await pickImage(); if (img) set({ bg: { src: toBgSrc(img), dim: recipe.bg?.dim ?? 0.4, blur: recipe.bg?.blur ?? 0.2 } }); };
  $('bg-remove').onclick = () => set({ bg: null });

  const doDescribe = () => {
    const text = $('describe').value.trim(); if (!text) return;
    const r = describe(text, recipe);
    if (!r.understood.length) { $('describe-msg').textContent = 'No style words recognized. Try colors (pink, gold, teal), moods (sunset, ocean, matrix) or styles (neon, wood, chrome, minimal).'; return; }
    set(r.recipe);
    $('describe-msg').textContent = `Used: ${r.understood.join(', ')}`;
  };
  $('describe-go').onclick = doDescribe;
  $('describe').onkeydown = (e) => { if (e.key === 'Enter') doDescribe(); };

  $('surprise').onclick = () => set(surprise(recipe));
  $('undo').onclick = undo;
  addEventListener('keydown', (e) => { if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && e.target.tagName !== 'INPUT') { e.preventDefault(); undo(); } });

  $('save').onclick = async () => {
    $('save').disabled = true;
    try {
      const file = await app.studioSave(recipe);
      dirty = false; saved = true;
      toast(`Saved “${recipe.name}”. It's now your active theme and is listed under Skins.`);
      if (!file) throw new Error('not saved');
    } catch (e) { toast('Could not save the theme.'); console.error(e); }
    $('save').disabled = false;
  };
  $('export').onclick = async () => { const f = await app.studioExport(recipe, false); if (f) toast('Exported. Share the .wdskin file with anyone.'); };
  $('export-sheets').onclick = async (e) => { e.preventDefault(); const f = await app.studioExport(recipe, true); if (f) toast('Sprite sheets exported. Rename to .zip to edit the PNGs.'); };

  addEventListener('beforeunload', () => { if (dirty) app.studioCancel(); });
}

function undo() {
  if (!history.length) return;
  recipe = normalizeRecipe(JSON.parse(history.pop()));
  dirty = true; render(); preview();
}

let toastT;
function toast(msg) { const t = $('toast'); t.textContent = msg; t.hidden = false; clearTimeout(toastT); toastT = setTimeout(() => { t.hidden = true; }, 3200); }

chips('material', Object.entries(MATERIALS), 'material');
chips('buttons', [['square', 'Square'], ['rounded', 'Rounded'], ['pill', 'Pill']], 'buttons');
chips('labels', [['pixel', 'Pixel retro'], ['modern', 'Clean modern']], 'labels');
buildPresets();
buildSwatches();
bind();
render();
