// Accès à l'arbre des favoris : cache en mémoire, chemins, suivi des changements.
import { debounce } from './util.js';

const nodes = new Map();
let root = null;
let importing = false;
const listeners = new Set();

export async function loadTree() {
  const [tree] = await chrome.bookmarks.getTree();
  nodes.clear();
  (function walk(n) {
    nodes.set(n.id, n);
    n.children?.forEach(walk);
  })(tree);
  root = tree;
  return tree;
}

export const getRoot = () => root;
export const getNode = (id) => (id == null ? null : nodes.get(String(id)) || null);
export const isFolder = (n) => !!n && !n.url;
export const children = (id) => getNode(id)?.children || [];

/** Dossiers de premier niveau (Barre de favoris, Autres favoris…) : non modifiables. */
export const isTopLevel = (n) => !!n && (!n.parentId || n.parentId === root?.id);
export const isLocked = (n) => !n || isTopLevel(n) || !!n.unmodifiable;

/** Nœuds du dossier de premier niveau jusqu'au nœud (racine exclue). */
export function pathOf(id) {
  const out = [];
  let n = getNode(id);
  while (n && n.parentId) {
    out.unshift(n);
    n = getNode(n.parentId);
  }
  return out;
}
export const pathTitles = (id) => pathOf(id).map((n) => n.title);

/** Retrouve un dossier par sa suite de titres (utile si son identifiant a changé). */
export function findByPath(titles) {
  if (!titles?.length) return null;
  let n = root;
  for (const t of titles) {
    n = n?.children?.find((c) => !c.url && c.title === t);
    if (!n) return null;
  }
  return n;
}

export function isInside(id, ancestorId) {
  let n = getNode(id);
  while (n) {
    if (n.id === ancestorId) return true;
    n = getNode(n.parentId);
  }
  return false;
}

/** Nombre de liens contenus (récursif). */
export function countLinks(id) {
  let c = 0;
  (function walk(n) {
    for (const ch of n?.children || []) ch.url ? c++ : walk(ch);
  })(getNode(id));
  return c;
}

/** Liste à plat de tous les dossiers, avec leur profondeur. */
export function allFolders() {
  const out = [];
  (function walk(n, depth) {
    for (const ch of n.children || []) {
      if (ch.url) continue;
      out.push({ node: ch, depth });
      walk(ch, depth + 1);
    }
  })(root, 0);
  return out;
}

const IMPORT_RE = /import|safari|chrome|firefox|vivaldi|edge|opera|arc\b|explorer/i;
export const looksImported = (n) => !!n && IMPORT_RE.test(n.title || '');

// ---------- Suivi des changements ----------
export function onBookmarksChange(fn) {
  listeners.add(fn);
}

const reload = debounce(async () => {
  if (importing) return;
  await loadTree();
  for (const fn of listeners) {
    try { fn(); } catch (e) { console.error(e); }
  }
}, 80);

export function watchBookmarks() {
  const b = chrome.bookmarks;
  for (const ev of [b.onCreated, b.onRemoved, b.onChanged, b.onMoved, b.onChildrenReordered]) ev?.addListener(reload);
  b.onImportBegan?.addListener(() => { importing = true; });
  b.onImportEnded?.addListener(() => {
    importing = false;
    reload();
  });
}

// ---------- Modifications ----------
function clean(o) {
  return Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined && v !== null));
}
export const createBookmark = (o) => chrome.bookmarks.create(clean(o));
export const updateBookmark = (id, o) => chrome.bookmarks.update(id, clean(o));
export const moveBookmark = (id, o) => chrome.bookmarks.move(id, clean(o));
export const searchBookmarks = (q) => chrome.bookmarks.search(q);

/** Supprime un favori ou un dossier et renvoie une fonction d'annulation. */
export async function removeNode(id) {
  const n = getNode(id);
  if (!n) return null;
  const snap = JSON.parse(JSON.stringify(n));
  if (n.url) await chrome.bookmarks.remove(id);
  else await chrome.bookmarks.removeTree(id);
  return () => restore(snap, snap.parentId, snap.index);
}

async function restore(snap, parentId, index, nested = false) {
  let parent = parentId;
  let idx = index;
  if (!nested) {
    // Le dossier d'origine a pu disparaître entre-temps : repli sur « Autres favoris ».
    if (!getNode(parent)) {
      parent = '2';
      idx = undefined;
    } else if (idx != null) {
      idx = Math.min(idx, children(parent).length);
    }
  }
  const created = await chrome.bookmarks.create(clean({ parentId: parent, index: idx, title: snap.title, url: snap.url }));
  if (!snap.url) {
    for (const ch of snap.children || []) await restore(ch, created.id, undefined, true);
  }
  return created;
}
