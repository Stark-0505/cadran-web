// Icônes des tuiles. Ordre de priorité :
//  1. icône personnalisée (image ou lettre/emoji choisie par l'utilisateur)
//  2. icône haute définition récupérée sur le site (apple-touch-icon, manifeste…)
//  3. favicon du cache de Brave (API _favicon)
//  4. monogramme : première lettre sur un dégradé de couleur
import { db } from './db.js';
import { hash, hostOf, originOf, relLum, isWebUrl, idle } from './util.js';
import { t, LOCALE } from './i18n.js';

const SITE_PERMS = { origins: ['https://*/*', 'http://*/*'] };
const RETRY_MS = 7 * 864e5;
const CONCURRENCY = 4;

const site = new Map(); // origine -> { ok, src, full, bg, small, at }
const custom = new Map(); // url -> { type: 'image', src, … } | { type: 'mono', text, color }
let favStatus = {}; // url -> 1 (favicon présent dans Brave) | 0
const checked = new Set();
let permitted = false;
let fetchEnabled = true;

export const PALETTE = [
  ['#ff6b6b', '#e03131'], ['#ffa94d', '#f76707'], ['#fcc419', '#f08c00'], ['#51cf66', '#2b8a3e'],
  ['#38d9a9', '#0c8599'], ['#4dabf7', '#1971c2'], ['#748ffc', '#3b5bdb'], ['#9775fa', '#6741d9'],
  ['#e599f7', '#ae3ec9'], ['#f783ac', '#c2255c'], ['#a9a9b3', '#5c5f66'], ['#63e6be', '#099268'],
];
export const gradientFor = (i) => {
  const [a, b] = PALETTE[((i % PALETTE.length) + PALETTE.length) % PALETTE.length];
  return `linear-gradient(160deg, ${a}, ${b})`;
};

export function monogram(title, url) {
  const host = hostOf(url);
  const src = (title || host || '?').trim();
  const ch = [...src].find((c) => /[\p{L}\p{N}]/u.test(c)) || '•';
  return { text: ch.toLocaleUpperCase(LOCALE), color: hash(host || src) % PALETTE.length };
}

export async function initIcons({ fetchSites = true } = {}) {
  fetchEnabled = fetchSites;
  try { favStatus = JSON.parse(localStorage.getItem('cadran.fav') || '{}'); } catch { favStatus = {}; }
  const [siteEntries, customEntries, perm] = await Promise.all([
    db.entries('siteIcons').catch(() => []),
    db.entries('customIcons').catch(() => []),
    hasSitePermission(),
  ]);
  permitted = perm;
  for (const [k, rec] of siteEntries) site.set(k, runtimeSite(rec));
  for (const [k, rec] of customEntries) custom.set(k, runtimeCustom(rec));
  chrome.permissions?.onAdded?.addListener(refreshPermission);
  chrome.permissions?.onRemoved?.addListener(refreshPermission);
}

async function refreshPermission() {
  const was = permitted;
  permitted = await hasSitePermission();
  if (permitted && !was) repaint(() => true);
}

function runtimeSite(rec) {
  if (!rec?.ok || !rec.blob) return { ok: false, at: rec?.at || 0 };
  return { ok: true, src: URL.createObjectURL(rec.blob), full: rec.full, bg: rec.bg, small: rec.small, at: rec.at };
}
function runtimeCustom(rec) {
  if (rec.type === 'mono') return { type: 'mono', text: rec.text, color: rec.color };
  return { type: 'image', src: URL.createObjectURL(rec.blob), full: rec.full, bg: rec.bg, small: rec.small };
}

// ---------- Rendu d'une plaque ----------
const KEEP = new Set(['plate', 'mini']);

/** Remplit une plaque (.plate) avec la meilleure icône disponible pour { url, title }. */
export function paintPlate(plate, item) {
  const url = item.url || '';
  plate.dataset.url = url;
  plate.dataset.title = item.title || '';
  plate.className = [...plate.classList].filter((c) => KEEP.has(c)).join(' ') || 'plate';
  plate.style.background = '';
  plate.replaceChildren();

  if (/^javascript:/i.test(url)) return paintMono(plate, 'JS', 10);

  const c = custom.get(url);
  if (c) return c.type === 'mono' ? paintMono(plate, c.text, c.color) : paintImage(plate, c, item);

  // A hosted web app cannot request Chrome extension host permissions. Use a
  // high-resolution favicon endpoint by default instead of showing a dead permission prompt.
  if (window.CADRAN_WEB_MODE && isWebUrl(url)) return paintWebFavicon(plate, item);

  const origin = originOf(url);
  const s = origin ? site.get(origin) : null;
  if (s?.ok) return paintImage(plate, s, item);

  if (favStatus[url] === 1) paintFavicon(plate, item);
  else {
    const m = monogram(item.title, url);
    paintMono(plate, m.text, m.color);
  }
  // Vérifie (une fois par session) si Brave connaît le favicon de cette page.
  if (isWebUrl(url) && favStatus[url] !== 1 && !checked.has(url)) {
    checked.add(url);
    idle(() => verifyFavicon(url));
  }
  if (origin && wantsFetch(origin)) enqueue(url);
}

function paintMono(plate, text, color) {
  const t = String(text || '•');
  plate.classList.add('mono');
  if (/\p{Extended_Pictographic}/u.test(t)) plate.classList.add('emoji');
  else if ([...t].length > 1) plate.classList.add('two');
  plate.style.background = typeof color === 'number' ? gradientFor(color) : color || gradientFor(10);
  plate.textContent = t;
}

function fallbackToMono(plate, item) {
  plate.className = [...plate.classList].filter((c) => KEEP.has(c)).join(' ');
  plate.replaceChildren();
  const m = monogram(item.title, item.url);
  paintMono(plate, m.text, m.color);
}

function paintImage(plate, rec, item) {
  plate.classList.add(rec.full ? 'full' : rec.small ? 'fav' : 'pad');
  plate.style.background = rec.bg || '#fff';
  const img = new Image();
  img.alt = '';
  img.draggable = false;
  img.decoding = 'async';
  img.onerror = () => fallbackToMono(plate, item);
  img.src = rec.src;
  plate.append(img);
}


function paintWebFavicon(plate, item) {
  plate.classList.add('web-favicon');
  plate.style.background = '#fff';
  const img = new Image();
  img.alt = '';
  img.draggable = false;
  img.decoding = 'async';
  img.loading = 'lazy';
  img.referrerPolicy = 'no-referrer';
  img.onerror = () => fallbackToMono(plate, item);
  // Google S2 supports larger requested sizes where the origin has them.
  img.src = faviconUrl(item.url, 256);
  plate.append(img);
}

function paintFavicon(plate, item) {
  plate.classList.add('fav');
  plate.style.background = '#fff';
  const img = new Image();
  img.alt = '';
  img.draggable = false;
  img.onerror = () => fallbackToMono(plate, item);
  img.src = faviconUrl(item.url);
  plate.append(img);
}

/** Redessine les plaques visibles dont l'URL satisfait le prédicat. */
function repaint(pred) {
  for (const p of document.querySelectorAll('.plate[data-url]')) {
    if (pred(p.dataset.url)) paintPlate(p, { url: p.dataset.url, title: p.dataset.title });
  }
}
export const repaintAll = () => repaint(() => true);

// ---------- Cache de favicons de Brave ----------
export function faviconUrl(pageUrl, size = 32) {
  if (window.CADRAN_WEB_MODE) {
    const u = new URL('https://www.google.com/s2/favicons');
    u.searchParams.set('domain_url', pageUrl);
    u.searchParams.set('sz', String(size));
    return u.href;
  }
  const u = new URL(chrome.runtime.getURL('/_favicon/'));
  u.searchParams.set('pageUrl', pageUrl);
  u.searchParams.set('size', String(size));
  return u.href;
}

async function imageHash(src) {
  const img = new Image();
  img.src = src;
  await img.decode();
  const c = document.createElement('canvas');
  c.width = c.height = 16;
  const ctx = c.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(img, 0, 0, 16, 16);
  const d = ctx.getImageData(0, 0, 16, 16).data;
  let x = 0x811c9dc5;
  for (let i = 0; i < d.length; i++) {
    x ^= d[i];
    x = Math.imul(x, 0x01000193);
  }
  return x >>> 0;
}

let defaultHash = null;
let saveFavTimer = null;
function saveFav() {
  clearTimeout(saveFavTimer);
  saveFavTimer = setTimeout(() => {
    try { localStorage.setItem('cadran.fav', JSON.stringify(favStatus)); } catch { /* quota */ }
  }, 600);
}

/** Brave renvoie un globe générique quand il n'a pas de favicon : on le détecte par comparaison. */
async function verifyFavicon(url) {
  try {
    defaultHash ??= imageHash(faviconUrl('https://cadran-sans-icone.invalid/'));
    const [def, mine] = await Promise.all([defaultHash, imageHash(faviconUrl(url))]);
    const has = mine !== def ? 1 : 0;
    const before = favStatus[url];
    favStatus[url] = has;
    saveFav();
    if (has !== before) repaint((u) => u === url);
  } catch {
    /* favicon indisponible */
  }
}

// ---------- Icônes haute définition récupérées sur les sites ----------
export async function hasSitePermission() {
  if (window.CADRAN_WEB_MODE) return true;
  try { return await chrome.permissions.contains(SITE_PERMS); } catch { return false; }
}
/** À appeler directement dans un gestionnaire de clic (geste utilisateur requis). */
export async function requestSitePermission() {
  if (window.CADRAN_WEB_MODE) { permitted = true; repaint(() => true); return true; }
  const ok = await chrome.permissions.request(SITE_PERMS);
  if (ok) {
    permitted = true;
    repaint(() => true);
  }
  return ok;
}
export async function removeSitePermission() {
  await chrome.permissions.remove(SITE_PERMS);
  permitted = false;
}
export const isPermitted = () => permitted;
export function setFetchEnabled(v) {
  fetchEnabled = v;
  if (v) repaint(() => true);
}

const queue = [];
const queued = new Set();
let active = 0;

function wantsFetch(origin) {
  if (window.CADRAN_WEB_MODE || !fetchEnabled || !permitted || queued.has(origin)) return false;
  const s = site.get(origin);
  return !s || (!s.ok && Date.now() - s.at > RETRY_MS);
}

function enqueue(url) {
  const origin = originOf(url);
  if (!origin || queued.has(origin)) return;
  queued.add(origin);
  queue.push(url);
  pump();
}

function pump() {
  while (active < CONCURRENCY && queue.length) {
    const url = queue.shift();
    const origin = originOf(url);
    active++;
    fetchSiteIcon(url)
      .catch(() => ({ ok: false, at: Date.now() }))
      .then(async (rec) => {
        await db.put('siteIcons', origin, rec).catch(() => {});
        const old = site.get(origin);
        if (old?.src) URL.revokeObjectURL(old.src);
        site.set(origin, runtimeSite(rec));
        if (rec.ok) repaint((u) => originOf(u) === origin);
      })
      .finally(() => {
        active--;
        queued.delete(origin);
        pump();
      });
  }
}

async function timedFetch(url, ms = 8000) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try {
    return await fetch(url, { credentials: 'omit', referrerPolicy: 'no-referrer', signal: ctrl.signal });
  } finally {
    clearTimeout(t);
  }
}

/** Lit la page jusqu'à </head> seulement. */
async function readHead(res, limit = 400_000) {
  if (!res.body) return (await res.text()).slice(0, limit);
  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let html = '';
  try {
    while (html.length < limit) {
      const { done, value } = await reader.read();
      if (done) break;
      html += dec.decode(value, { stream: true });
      const end = html.search(/<\/head\s*>/i);
      if (end !== -1) {
        html = html.slice(0, end);
        break;
      }
    }
  } finally {
    reader.cancel().catch(() => {});
  }
  return html;
}

function parseSizes(s) {
  if (!s) return 0;
  if (/any/i.test(s)) return 256;
  let max = 0;
  for (const m of s.matchAll(/(\d+)\s*x\s*(\d+)/gi)) max = Math.max(max, Math.min(+m[1], +m[2]));
  return max;
}

async function manifestIcons(href) {
  const res = await timedFetch(href, 6000);
  if (!res.ok) return [];
  const json = await res.json();
  return (json.icons || [])
    .filter((i) => i && i.src)
    .map((i) => {
      const size = parseSizes(i.sizes);
      return { href: new URL(i.src, res.url || href).href, size, rank: size >= 120 ? 0 : 2 };
    });
}

async function iconLinks(html, pageUrl) {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const base = new URL(doc.querySelector('base[href]')?.getAttribute('href') || pageUrl, pageUrl).href;
  const abs = (href) => {
    try {
      const u = new URL(href, base);
      return ['https:', 'http:', 'data:'].includes(u.protocol) ? u.href : null;
    } catch { return null; }
  };
  const out = [];
  for (const link of doc.querySelectorAll('link[rel][href]')) {
    const rel = link.getAttribute('rel').toLowerCase().split(/\s+/);
    const href = abs(link.getAttribute('href'));
    if (!href) continue;
    const size = parseSizes(link.getAttribute('sizes'));
    if (rel.includes('apple-touch-icon') || rel.includes('apple-touch-icon-precomposed')) {
      out.push({ href, size: size || 180, rank: 0 });
    } else if (rel.includes('icon')) {
      const type = (link.getAttribute('type') || '').toLowerCase();
      if (type.includes('svg') || /\.svg([?#]|$)/i.test(href)) out.push({ href, size: 256, rank: 1, svg: true });
      else out.push({ href, size: size || 32, rank: size >= 64 ? 2 : 3 });
    } else if (rel.includes('manifest')) {
      out.push(...(await manifestIcons(href).catch(() => [])));
    }
  }
  return out;
}

async function fetchSiteIcon(pageUrl) {
  const origin = new URL(pageUrl).origin;
  const cands = [];
  try {
    const res = await timedFetch(pageUrl);
    if (res.ok && (res.headers.get('content-type') || '').includes('html')) {
      cands.push(...(await iconLinks(await readHead(res), res.url || pageUrl)));
    }
  } catch {
    /* page inaccessible : on tente les emplacements conventionnels */
  }
  cands.push({ href: origin + '/apple-touch-icon.png', size: 180, rank: 1 });
  cands.push({ href: origin + '/favicon.ico', size: 32, rank: 4 });
  cands.sort((a, b) => a.rank - b.rank || Math.min(b.size, 256) - Math.min(a.size, 256));

  const seen = new Set();
  let best = null;
  for (const c of cands) {
    if (seen.has(c.href)) continue;
    seen.add(c.href);
    const got = await loadCandidate(c).catch(() => null);
    if (!got) continue;
    if (!best || got.size > best.size) best = got;
    if (got.size >= 96) break;
  }
  return best ? { ok: true, at: Date.now(), ...best } : { ok: false, at: Date.now() };
}

async function loadCandidate(c) {
  const res = await timedFetch(c.href);
  if (!res.ok) return null;
  const type = (res.headers.get('content-type') || '').toLowerCase();
  if (/html|json|text\/plain|javascript/.test(type)) return null; // page d'erreur déguisée
  const blob = await res.blob();
  if (blob.size < 60 || blob.size > 3e6) return null;
  const svg = c.svg || type.includes('svg') || /\.svg([?#]|$)/i.test(c.href);
  return processImage(blob, { svg });
}

/** Normalise une image (carré ≤ 192 px) et analyse ses bords et sa couleur. */
async function processImage(blob, { svg = false, maxSize = 192 } = {}) {
  const typed = svg && blob.type !== 'image/svg+xml' ? new Blob([blob], { type: 'image/svg+xml' }) : blob;
  const src = URL.createObjectURL(typed);
  try {
    const img = new Image();
    img.src = src;
    await img.decode();
    let w = img.naturalWidth;
    let hh = img.naturalHeight;
    if (svg && (!w || !hh)) w = hh = 256;
    if (!w || !hh || Math.min(w, hh) < 16) return null;
    const size = svg ? 256 : Math.min(w, hh);
    const S = Math.min(maxSize, size);
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = S;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    ctx.imageSmoothingQuality = 'high';
    const scale = Math.min(S / w, S / hh);
    const dw = Math.round(w * scale);
    const dh = Math.round(hh * scale);
    ctx.drawImage(img, Math.round((S - dw) / 2), Math.round((S - dh) / 2), dw, dh);
    let info = { full: false, bg: '#fff' };
    try { info = analyze(ctx, S); } catch { /* lecture impossible */ }
    const out = await new Promise((r) => canvas.toBlob(r, 'image/png'));
    return { blob: out || blob, size, full: size >= 64 && info.full, bg: info.bg, small: size < 48 };
  } finally {
    URL.revokeObjectURL(src);
  }
}

function analyze(ctx, S) {
  const d = ctx.getImageData(0, 0, S, S).data;
  const px = (x, y) => {
    const i = (y * S + x) * 4;
    return [d[i], d[i + 1], d[i + 2], d[i + 3]];
  };
  const m = Math.max(1, Math.round(S * 0.04));
  const e = S - 1 - m;
  const mid = S >> 1;
  const opaque = ([x, y]) => px(x, y)[3] > 245;
  const corners = [[m, m], [e, m], [m, e], [e, e]].every(opaque);
  const edges = [[mid, m], [mid, e], [m, mid], [e, mid]].every(opaque);

  let r = 0, g = 0, b = 0, n = 0, total = 0;
  for (let i = 0; i < d.length; i += 16) {
    total++;
    if (d[i + 3] > 200) {
      r += d[i]; g += d[i + 1]; b += d[i + 2]; n++;
    }
  }
  let bg;
  if (corners || edges) {
    const [cr, cg, cb] = corners ? px(m, m) : px(mid, m);
    bg = `rgb(${cr}, ${cg}, ${cb})`;
  } else {
    // Logo blanc sur fond transparent : on le pose sur une plaque sombre.
    const lum = n ? relLum([r / n, g / n, b / n]) : 0;
    bg = lum > 0.8 && n / total < 0.9 ? '#2c2c2e' : '#ffffff';
  }
  return { full: corners || edges, bg };
}

// ---------- Icônes personnalisées ----------
function setCustomRuntime(url, stored) {
  const old = custom.get(url);
  if (old?.src) URL.revokeObjectURL(old.src);
  custom.set(url, runtimeCustom(stored));
  repaint((u) => u === url);
}

export const getCustom = (url) => custom.get(url) || null;

export async function setCustomImage(url, blob) {
  const rec = await processImage(blob, { svg: /svg/i.test(blob.type) });
  if (!rec) throw new Error(t('imageUnreadable'));
  const stored = { type: 'image', blob: rec.blob, full: rec.full, bg: rec.bg, small: rec.small };
  await db.put('customIcons', url, stored);
  setCustomRuntime(url, stored);
}

export async function setCustomImageFromUrl(url, imageUrl) {
  const res = await timedFetch(imageUrl).catch(() => null);
  if (!res?.ok) throw new Error(t('imageDownloadFailed'));
  await setCustomImage(url, await res.blob());
}

export async function setCustomMono(url, text, color) {
  const stored = { type: 'mono', text, color };
  await db.put('customIcons', url, stored);
  setCustomRuntime(url, stored);
}

export async function clearCustom(url) {
  await db.del('customIcons', url);
  const old = custom.get(url);
  if (old?.src) URL.revokeObjectURL(old.src);
  custom.delete(url);
  repaint((u) => u === url);
}

// ---------- Cache ----------
export async function refetchSite(url) {
  const origin = originOf(url);
  if (!origin) return;
  await db.del('siteIcons', origin).catch(() => {});
  const old = site.get(origin);
  if (old?.src) URL.revokeObjectURL(old.src);
  site.delete(origin);
  repaint((u) => originOf(u) === origin);
}

export async function clearSiteIcons() {
  await db.clear('siteIcons');
  for (const s of site.values()) if (s.src) URL.revokeObjectURL(s.src);
  site.clear();
  repaint(() => true);
}

export const siteIconCount = () => [...site.values()].filter((s) => s.ok).length;

/** Pour la sauvegarde : icônes personnalisées sérialisables. */
export async function exportCustomIcons(toDataURL) {
  const out = [];
  for (const [url, rec] of await db.entries('customIcons')) {
    out.push(rec.type === 'mono' ? { url, ...rec } : { url, type: 'image', full: rec.full, bg: rec.bg, small: rec.small, data: await toDataURL(rec.blob) });
  }
  return out;
}

export async function importCustomIcons(list, fromDataURL) {
  for (const item of list || []) {
    if (!item?.url) continue;
    const stored = item.type === 'mono'
      ? { type: 'mono', text: item.text, color: item.color }
      : { type: 'image', blob: await fromDataURL(item.data), full: item.full, bg: item.bg, small: item.small };
    await db.put('customIcons', item.url, stored);
    setCustomRuntime(item.url, stored);
  }
}
