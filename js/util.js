// Petits utilitaires partagés : DOM, icônes SVG, URL, couleurs.

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

/** Crée un élément : h('a', { class: 'x', href, onclick }, enfant, 'texte', ...) */
export function h(tag, props, ...children) {
  const el = document.createElement(tag);
  if (props) {
    for (const [k, v] of Object.entries(props)) {
      if (v == null || v === false) continue;
      if (k === 'class') el.className = v;
      else if (k === 'dataset') Object.assign(el.dataset, v);
      else if (k === 'style' && typeof v === 'object') {
        for (const [p, val] of Object.entries(v)) el.style.setProperty(p, val);
      } else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
      else if (typeof v !== 'string' && k in el) el[k] = v;
      else el.setAttribute(k, v === true ? '' : v);
    }
  }
  for (const c of children.flat(Infinity)) {
    if (c == null || c === false) continue;
    el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
  return el;
}

// Icônes au trait (24×24), dessinées avec currentColor.
const circle = (cx, cy, r) => `M${cx - r} ${cy}a${r} ${r} 0 1 0 ${2 * r} 0a${r} ${r} 0 1 0 ${-2 * r} 0`;
const PATHS = {
  sliders: ['M4 7h9M18 7h2M4 17h3M12 17h8', circle(15.5, 7, 2.5), circle(9.5, 17, 2.5)],
  search: [circle(11, 11, 7), 'M20.5 20.5l-4.6-4.6'],
  plus: ['M12 5v14M5 12h14'],
  back: ['M15 18l-6-6 6-6'],
  chevron: ['M9 6l6 6-6 6'],
  close: ['M6 6l12 12M18 6L6 18'],
  folder: ['M3.5 7.5a2 2 0 0 1 2-2h3.6l2 2h7.4a2 2 0 0 1 2 2v7.5a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2z'],
  folderPlus: ['M3.5 7.5a2 2 0 0 1 2-2h3.6l2 2h7.4a2 2 0 0 1 2 2v7.5a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2z', 'M12 10.5v5M9.5 13h5'],
  edit: ['M4 20h4.2L19 9.2a2.1 2.1 0 0 0-3-3L5.2 17v3z', 'M14.5 7.7l3 3'],
  image: ['M5 4h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z', circle(8.5, 9.5, 1.6), 'M21 15.5l-5-5-10 9.5'],
  trash: ['M4 7h16M9.5 7V4.5h5V7M6.5 7l1 13h9l1-13M10 11v5.5M14 11v5.5'],
  tab: ['M14 4h6v6M20 4l-8.5 8.5', 'M18 14v4.5a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 4 18.5v-11A1.5 1.5 0 0 1 5.5 6H10'],
  window: ['M5 4.5h14a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-11a2 2 0 0 1 2-2z', 'M3 9h18'],
  private: ['M3 11h18M6 11l1.8-5.5h8.4L18 11', circle(7.5, 16, 2.8), circle(16.5, 16, 2.8), 'M10.3 16h3.4'],
  link: ['M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1', 'M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1'],
  layers: ['M12 3.5l8.5 4.5-8.5 4.5L3.5 8z', 'M3.5 12.5l8.5 4.5 8.5-4.5'],
  globe: [circle(12, 12, 8.5), 'M3.5 12h17M12 3.5c2.5 2.6 3.6 5.4 3.6 8.5s-1.1 5.9-3.6 8.5c-2.5-2.6-3.6-5.4-3.6-8.5s1.1-5.9 3.6-8.5z'],
  arrow: ['M7 17L17 7M8.5 7H17v8.5'],
  refresh: ['M20 12a8 8 0 1 1-2.3-5.7', 'M20 4.5V9h-4.5'],
  up: ['M12 19V5M6 11l6-6 6 6'],
  down: ['M12 5v14M6 13l6 6 6-6'],
  pin: ['M9 4h6l-1 5 3.5 3.5v1.5h-11v-1.5L10 9z', 'M12 14v6'],
  upload: ['M12 16V4M7 9l5-5 5 5M5 20h14'],
  download: ['M12 4v12M7 11l5 5 5-5M5 20h14'],
  clock: [circle(12, 12, 8.5), 'M12 7.5V12l3 2'],
  grid: ['M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z'],
  sparkle: ['M12 3.5l1.8 5.2 5.2 1.8-5.2 1.8-1.8 5.2-1.8-5.2L5 10.5l5.2-1.8z'],
  palette: [circle(12, 12, 8.5), circle(8.5, 10, 1.1), circle(12, 7.5, 1.1), circle(15.5, 10, 1.1), 'M12 20.5c1.5 0 1.5-2 .5-3s-.5-3 1.5-3h2.5c2.2 0 4-1.8 4-3'],
};

export function icon(name, size = 18, stroke = 1.8) {
  const NS = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('width', size);
  svg.setAttribute('height', size);
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', stroke);
  svg.setAttribute('stroke-linecap', 'round');
  svg.setAttribute('stroke-linejoin', 'round');
  svg.setAttribute('aria-hidden', 'true');
  for (const d of PATHS[name] || []) {
    const p = document.createElementNS(NS, 'path');
    p.setAttribute('d', d);
    svg.append(p);
  }
  return svg;
}

export function debounce(fn, ms) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
}

/** Hachage FNV-1a 32 bits. */
export function hash(str) {
  let x = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    x ^= str.charCodeAt(i);
    x = Math.imul(x, 0x01000193);
  }
  return x >>> 0;
}

export const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
export const clamp = (v, min, max) => Math.min(max, Math.max(min, v));
export const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

// ---------- URL ----------
export function hostOf(url) {
  try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return ''; }
}
export function originOf(url) {
  try {
    const u = new URL(url);
    return u.protocol === 'https:' || u.protocol === 'http:' ? u.origin : null;
  } catch { return null; }
}
export const isWebUrl = (url) => /^https?:\/\//i.test(url || '');

/** Transforme une saisie (« lemonde.fr ») en URL valide, ou null. */
export function normalizeUrl(input) {
  let s = (input || '').trim();
  if (!s) return null;
  if (!/^[a-z][a-z0-9+.-]*:/i.test(s)) s = 'https://' + s;
  try {
    const u = new URL(s);
    if ((u.protocol === 'https:' || u.protocol === 'http:') && !u.hostname) return null;
    return u.href;
  } catch { return null; }
}

/** La saisie ressemble-t-elle à une adresse plutôt qu'à une recherche ? */
export function looksLikeUrl(q) {
  const s = q.trim();
  if (!s || /\s/.test(s)) return false;
  if (/^(https?|chrome|brave|file|ftp):\/\//i.test(s)) return true;
  if (/^localhost(:\d+)?(\/|$)/i.test(s)) return true;
  return /^[\w-]+(\.[\w-]+)*\.[a-z]{2,}(:\d+)?([/?#].*)?$/i.test(s);
}

/** Libellé lisible d'une URL : domaine + chemin court. */
export function prettyUrl(url) {
  try {
    const u = new URL(url);
    if (!isWebUrl(url)) return url;
    const path = (u.pathname + u.search).replace(/\/$/, '');
    return u.hostname.replace(/^www\./, '') + (path.length > 40 ? path.slice(0, 38) + '…' : path);
  } catch { return url; }
}

// ---------- Couleurs ----------
export function hexToRgb(hex) {
  let s = String(hex).replace('#', '').trim();
  if (s.length === 3) s = [...s].map((c) => c + c).join('');
  const n = parseInt(s.slice(0, 6), 16);
  return Number.isNaN(n) ? [0, 0, 0] : [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
export const rgbToHex = (r, g, b) => '#' + [r, g, b].map((v) => Math.round(v).toString(16).padStart(2, '0')).join('');

/** Luminance relative (0 = noir, 1 = blanc). */
export function relLum([r, g, b]) {
  const f = (c) => {
    c /= 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}

// ---------- Divers ----------
export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = h('a', { href: url, download: filename });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

export function blobToDataURL(blob) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = () => reject(r.error);
    r.readAsDataURL(blob);
  });
}

export const dataURLToBlob = (dataURL) => fetch(dataURL).then((r) => r.blob());

export function isTyping(e) {
  const t = e.target;
  return !!t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName));
}

export const idle = (fn) => (window.requestIdleCallback ? requestIdleCallback(fn, { timeout: 1500 }) : setTimeout(fn, 200));
