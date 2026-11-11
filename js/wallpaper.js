// Fond d'écran : dégradés, couleurs unies ou images importées (stockées dans IndexedDB).
import { db } from './db.js';
import { hexToRgb, relLum, rgbToHex, uid } from './util.js';
import { saveBoot } from './store.js';
import { t } from './i18n.js';

export const GRADIENTS = [
  { id: 'aurore', ink: 'light', css: 'radial-gradient(at 12% 18%, #6d4aff 0, transparent 55%), radial-gradient(at 88% 12%, #1e90ff 0, transparent 50%), radial-gradient(at 78% 88%, #ff4f8b 0, transparent 55%), radial-gradient(at 20% 92%, #00c2a8 0, transparent 50%), #0f1224' },
  { id: 'crepuscule', ink: 'light', css: 'radial-gradient(at 50% 115%, #ffb36b 0, transparent 55%), radial-gradient(at 12% 75%, #ff5e7e 0, transparent 50%), linear-gradient(180deg, #1f1147 0%, #6b2c70 55%, #d9546b 100%)' },
  { id: 'lagon', ink: 'light', css: 'radial-gradient(at 18% 20%, #00d2ff 0, transparent 50%), radial-gradient(at 82% 28%, #3a7bd5 0, transparent 55%), radial-gradient(at 50% 105%, #00c9a7 0, transparent 55%), #0b3d5c' },
  { id: 'foret', ink: 'light', css: 'radial-gradient(at 82% 18%, #9be15d 0, transparent 45%), radial-gradient(at 10% 85%, #0ba360 0, transparent 55%), linear-gradient(160deg, #0c3b2e 0%, #145a41 100%)' },
  { id: 'sierra', ink: 'light', css: 'radial-gradient(at 28% 105%, #ff7e5f 0, transparent 50%), radial-gradient(at 82% 92%, #feb47b 0, transparent 45%), radial-gradient(at 50% 0%, #1e3c72 0, transparent 70%), linear-gradient(180deg, #2a5298 0%, #6a3093 100%)' },
  { id: 'ocean', ink: 'light', css: 'linear-gradient(160deg, #0f2027 0%, #203a43 50%, #2c5364 100%)' },
  { id: 'nuit', ink: 'light', css: 'radial-gradient(at 72% 18%, #2b4468 0, transparent 60%), radial-gradient(at 15% 90%, #1d2b4a 0, transparent 55%), linear-gradient(180deg, #0a0e18 0%, #131c2e 100%)' },
  { id: 'graphite', ink: 'light', css: 'radial-gradient(at 50% -10%, #45454d 0, transparent 70%), #151518' },
  { id: 'brume', ink: 'dark', css: 'radial-gradient(at 15% 15%, #ffffff 0, transparent 50%), radial-gradient(at 85% 25%, #c9d6ff 0, transparent 55%), radial-gradient(at 50% 105%, #e8e2f5 0, transparent 60%), #dde6f1' },
  { id: 'peche', ink: 'dark', css: 'radial-gradient(at 20% 20%, #ffe0bd 0, transparent 55%), radial-gradient(at 85% 30%, #ff9a8b 0, transparent 60%), radial-gradient(at 60% 105%, #fff1e0 0, transparent 60%), #fdc3a8' },
  { id: 'lavande', ink: 'dark', css: 'linear-gradient(135deg, #e0c3fc 0%, #b8d3fc 100%)' },
  { id: 'menthe', ink: 'dark', css: 'radial-gradient(at 80% 10%, #f4ffc7 0, transparent 55%), linear-gradient(160deg, #c8f7a8 0%, #8fe3b6 100%)' },
];

export const COLORS = ['#1c1c1e', '#2c2c2e', '#48484a', '#f2f2f7', '#12263f', '#1f4d3a', '#4a1f3d', '#0a84ff', '#5e5ce6', '#bf5af2', '#ff375f', '#ff9f0a', '#30d158', '#64d2ff'];

// ---------- Galerie d'images ----------
let galleryVersion = 0;
const listeners = new Set();
export const onGalleryChange = (fn) => listeners.add(fn);
function bump() {
  galleryVersion++;
  for (const fn of listeners) fn();
}

/** Liste des images, de la plus ancienne à la plus récente. */
export async function listImages() {
  const entries = await db.entries('wallpapers').catch(() => []);
  return entries.map(([, v]) => v).sort((a, b) => a.added - b.added);
}

async function drawScaled(bitmap, width, type = 'image/jpeg', quality = 0.9) {
  const w = Math.max(1, Math.round(width));
  const hgt = Math.max(1, Math.round((bitmap.height / bitmap.width) * w));
  const c = document.createElement('canvas');
  c.width = w;
  c.height = hgt;
  const ctx = c.getContext('2d', { willReadFrequently: true });
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(bitmap, 0, 0, w, hgt);
  const blob = await new Promise((r) => c.toBlob(r, type, quality));
  return { blob, ctx, w, h: hgt, canvas: c };
}

/** Importe une image : redimensionnée (≤ 3200 px), miniature, aperçu flou et luminosité moyenne. */
export async function importImage(file) {
  let bitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    throw new Error(t('unsupportedFormat', file.name || 'image'));
  }
  const MAX = 3200;
  const scale = Math.min(1, MAX / Math.max(bitmap.width, bitmap.height));
  const keepOriginal = scale === 1 && file.size < 5e6 && /jpeg|png|webp/.test(file.type);
  const full = keepOriginal ? file : (await drawScaled(bitmap, bitmap.width * scale)).blob;
  const thumb = (await drawScaled(bitmap, 360, 'image/jpeg', 0.8)).blob;
  const tiny = await drawScaled(bitmap, 48, 'image/jpeg', 0.6);
  const lqip = tiny.canvas.toDataURL('image/jpeg', 0.6);

  // Luminosité moyenne, en privilégiant le centre (là où se trouvent les icônes).
  const d = tiny.ctx.getImageData(0, 0, tiny.w, tiny.h).data;
  let r = 0, g = 0, b = 0, wsum = 0, lum = 0;
  for (let y = 0; y < tiny.h; y++) {
    for (let x = 0; x < tiny.w; x++) {
      const i = (y * tiny.w + x) * 4;
      const dx = x / tiny.w - 0.5;
      const dy = y / tiny.h - 0.45;
      const wgt = 1.2 - Math.min(1, Math.hypot(dx, dy) * 1.6);
      r += d[i] * wgt; g += d[i + 1] * wgt; b += d[i + 2] * wgt;
      lum += relLum([d[i], d[i + 1], d[i + 2]]) * wgt;
      wsum += wgt;
    }
  }
  bitmap.close?.();
  const rec = {
    id: uid(),
    blob: full,
    thumb,
    lqip,
    avg: rgbToHex(r / wsum, g / wsum, b / wsum),
    lum: lum / wsum,
    added: Date.now(),
  };
  await db.put('wallpapers', rec.id, rec);
  bump();
  return rec;
}

export async function deleteImage(id) {
  await db.del('wallpapers', id);
  bump();
}

/** Réintègre des images (restauration d'une sauvegarde). */
export async function putImages(records) {
  for (const rec of records) if (rec?.id && rec.blob) await db.put('wallpapers', rec.id, rec);
  bump();
}

// ---------- Variante claire / sombre ----------
const darkQuery = matchMedia('(prefers-color-scheme: dark)');
export const systemScheme = () => (darkQuery.matches ? 'dark' : 'light');

/** Réglages de fond pour un thème : la variante sombre (ws.dark) si elle existe, sinon le fond lui-même. */
export const variantOf = (ws, scheme = systemScheme()) => (scheme === 'dark' && ws.dark) || ws;

/** Copie d'un fond pour en faire la variante sombre. */
export function newDarkVariant(ws) {
  const { dark, ...rest } = ws;
  return structuredClone(rest);
}

// ---------- Choix de l'image à afficher ----------
function dayNumber() {
  const now = new Date();
  return Math.floor((now.getTime() - now.getTimezoneOffset() * 60000) / 864e5);
}

// Image tirée au sort pour chaque portée (fond par défaut ou onglet) tant que la page reste ouverte.
const sessionPick = new Map();

/** Choisit l'image ; `next` est celle qui s'affichera à la prochaine ouverture (pour le premier rendu). */
function chooseImage(ws, images, scope) {
  if (!images.length) return { current: null, next: null };
  const byId = (id) => images.find((i) => i.id === id) || null;
  if (ws.rotate === 'day') return { current: images[dayNumber() % images.length], next: null };
  if (ws.rotate === 'tab') {
    const key = `cadran.nextImage.${scope}`;
    const kept = byId(sessionPick.get(scope));
    if (kept) return { current: kept, next: byId(localStorage.getItem(key)) };
    // L'image de cette ouverture a été tirée au sort lors de la précédente.
    const current = byId(localStorage.getItem(key)) || images[Math.floor(Math.random() * images.length)];
    const others = images.filter((i) => i.id !== current.id);
    const next = others.length ? others[Math.floor(Math.random() * others.length)] : current;
    sessionPick.set(scope, current.id);
    try { localStorage.setItem(key, next.id); } catch { /* ignore */ }
    return { current, next };
  }
  return { current: byId(ws.imageId) || images[images.length - 1], next: null };
}

/** Affiche tout de suite une image précise (par exemple celle qu'on vient d'importer). */
export function pinSessionImage(scope, id) {
  sessionPick.set(scope, id);
  appliedKey = null;
}

// ---------- Application ----------
let appliedKey = null;
let objectUrl = null;
let baseLum = 0.1;
let bootBg = null;
let bootLum = null;

function sourceKey(ws, scope) {
  if (ws.type === 'image') {
    const which = ws.rotate === 'off' ? ws.imageId : ws.rotate === 'tab' ? scope : '';
    return `img:${ws.rotate}:${which}:${galleryVersion}`;
  }
  if (ws.type === 'color') return `color:${ws.color}`;
  return `gradient:${ws.gradient}`;
}

const inkFor = (lum, dim, pref) => {
  if (pref === 'light' || pref === 'dark') return pref;
  return lum * (1 - dim / 100) > 0.42 ? 'dark' : 'light';
};

/** Remplace le fond en fondu enchaîné : une copie de l'ancien s'efface au-dessus du nouveau. */
function swapBackground(el, bg) {
  const before = el.style.background;
  const ghost = el.cloneNode(false);
  el.style.background = bg;
  if (!before || el.style.background === before) return;
  ghost.removeAttribute('id');
  ghost.className = 'wallpaper-ghost';
  el.after(ghost);
  void ghost.offsetWidth; // valide l'état de départ avant la transition
  ghost.style.opacity = '0';
  setTimeout(() => ghost.remove(), 600);
}

/**
 * Applique un fond ; ne recharge l'image que si la source a changé.
 *  scope   : 'default' ou l'identifiant de l'onglet dont c'est le fond propre
 *  persist : mémoriser ce fond pour le premier affichage du prochain onglet
 *  scheme  : 'light' | 'dark' si le fond a une variante sombre (celle des deux qui est affichée), sinon null
 */
export async function applyWallpaper(ws, textColor = 'auto', { scope = 'default', persist = true, scheme = null } = {}) {
  const el = document.getElementById('wallpaper');
  const dimEl = document.getElementById('dim');
  const key = sourceKey(ws, scope);

  if (key !== appliedKey) {
    appliedKey = key;
    let bg = null;
    let lum = 0.1;
    let url = null;
    let forBoot = null;
    if (ws.type === 'image') {
      const images = await listImages();
      if (appliedKey !== key) return;
      const { current, next } = chooseImage(ws, images, scope);
      if (current) {
        url = URL.createObjectURL(current.blob);
        await preload(url);
        if (appliedKey !== key) {
          URL.revokeObjectURL(url);
          return;
        }
        bg = `url("${url}") center / cover no-repeat, ${current.avg}`;
        lum = current.lum;
        forBoot = next || current;
      }
    }
    if (!bg && ws.type === 'color') {
      bg = ws.color;
      lum = relLum(hexToRgb(ws.color));
    }
    if (!bg) {
      const g = GRADIENTS.find((x) => x.id === ws.gradient) || GRADIENTS[0];
      bg = g.css;
      lum = g.ink === 'dark' ? 0.8 : 0.08;
    }
    swapBackground(el, bg);
    // L'ancienne image sert encore pendant le fondu.
    const oldUrl = objectUrl;
    objectUrl = url;
    if (oldUrl) setTimeout(() => URL.revokeObjectURL(oldUrl), 1500);
    baseLum = lum;
    bootBg = forBoot ? `url("${forBoot.lqip}") center / cover no-repeat, ${forBoot.avg}` : bg;
    bootLum = forBoot ? forBoot.lum : null;
  }

  // Keep the wallpaper sharp. Large CSS filters can soften the entire page on mobile GPUs.
  el.style.filter = '';
  dimEl.style.opacity = String(ws.dim / 100);
  document.documentElement.dataset.ink = inkFor(baseLum, ws.dim, textColor);

  // Mémorise de quoi redessiner instantanément le prochain onglet.
  if (!persist) return;
  const isImage = bootBg.startsWith('url("data:');
  const boot = {
    bg: bootBg,
    filter: '',
    dim: ws.dim / 100,
    ink: inkFor(bootLum ?? baseLum, ws.dim, textColor),
  };
  // Avec une variante sombre, chaque thème garde la sienne : boot.js choisit selon le thème du système.
  const patch = { split: !!scheme };
  if (scheme) patch.byScheme = { [scheme]: boot };
  // Pendant le réglage de l'autre variante (aperçu dans le panneau), le fond par défaut ne change pas.
  if (!scheme || scheme === systemScheme()) {
    Object.assign(patch, { bg: boot.bg, filter: boot.filter, dim: boot.dim, attrs: { 'data-ink': boot.ink } });
  }
  saveBoot(patch);
}

function preload(url) {
  const img = new Image();
  img.src = url;
  return img.decode().catch(() => {});
}

/** Force le rechargement de la source (après ajout / suppression d'image). */
export function invalidateWallpaper() {
  appliedKey = null;
}
