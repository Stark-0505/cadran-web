// Point d'entrée : état de la vue, rendu, événements.
import { $, h, icon, isTyping, same, uid, hostOf } from './util.js';
import { t, tp, localizePage } from './i18n.js';
import { loadSettings, getSettings, updateSettings, onSettingsChange, saveBoot, groupsLayout } from './store.js';
import {
  loadTree, watchBookmarks, onBookmarksChange, getNode, pathOf, pathTitles, findByPath, isInside,
  isFolder, isLocked, isTopLevel, allFolders, countLinks, looksImported, moveBookmark, createBookmark,
} from './bookmarks.js';
import { initIcons, setFetchEnabled, isPermitted, requestSitePermission } from './icons.js';
import { applyWallpaper, importImage, onGalleryChange, pinSessionImage, systemScheme, variantOf } from './wallpaper.js';
import { linkTile, folderTile, addTile, enableSorting, makeDropTarget } from './grid.js';
import { createPager, prefersReducedMotion } from './pager.js';
import { initSearch, applySearchSettings, focusSearch, hasQuery, clearSearch } from './search.js';
import { renderClock, renderExtras } from './widgets.js';
import { initPanel, openPanel, closePanel, isPanelOpen, togglePanel, refreshPanel } from './panel.js';
import { pickFolders } from './picker.js';
import { showMenu, toast, openDialog, isDialogOpen, isMenuOpen } from './ui.js';
import {
  openUrl, openAll, addBookmarkDialog, addFolderDialog, editBookmarkDialog, renameFolderDialog,
  deleteWithUndo, copyLink, iconDialog,
} from './actions.js';

const S = getSettings;
const ownWallpaper = (group) => group?.wallpaper || null;
/** Onglet affiché, et dossier ouvert dans chaque onglet (absent = sa racine). */
const view = { groupId: null, folders: {} };
/** Variante de fond montrée pendant son réglage dans le panneau ('light' | 'dark'), sinon celle du système. */
let wallPreview = null;

const content = $('#content');
const groupsNav = $('#groups');
const notice = $('#notice');
const extras = $('#extras');

const pager = createPager({
  nav: groupsNav,
  onActive: (id) => {
    view.groupId = id;
    markActiveTab();
    syncWallpaper();
  },
  onSettle: (id) => {
    if (S().activeGroup !== id) updateSettings((st) => { st.activeGroup = id; });
  },
});
let pagerShown = false;

const onError = (e) => toast(e?.message || t('actionFailed'));
const groupById = (id) => S().groups.find((g) => g.id === id) || null;
const currentGroup = () => groupById(view.groupId);
const groupLabel = (g) => g.label || getNode(g.folderId)?.title || g.path?.at(-1) || t('defaultFolderName');
const linkCount = (node) => (node?.children || []).filter((c) => c.url).length;

/** Dossier affiché dans un onglet : le sous-dossier ouvert, sinon sa racine. */
function folderOf(gid) {
  const f = view.folders[gid];
  if (f && getNode(f)) return f;
  return groupById(gid)?.folderId ?? null;
}
const currentFolderId = () => folderOf(view.groupId);

localizePage();
main().catch((e) => {
  console.error(e);
  content.replaceChildren(h('div', { class: 'empty' }, h('h2', null, t('errorTitle')), h('p', null, String(e?.message || e))));
});

async function main() {
  await loadSettings();
  await Promise.all([loadTree(), initIcons({ fetchSites: S().icons.fetchSites })]);
  watchBookmarks();
  resolveGroups();
  applyAppearance();

  const s = S();
  view.groupId = (s.groups.find((x) => x.id === s.activeGroup) || s.groups[0])?.id ?? null;
  restoreFolders();
  syncWallpaper();

  $('#btn-settings').append(icon('sliders', 20));
  initSearch({ openUrl, openFolder: showFolder });
  initPanel({ addGroups, changeGroupFolder, removeGroup, importWallpapers, previewWallScheme, activeGroupId: () => view.groupId });
  renderClock();
  bindEvents();
  render();
  renderExtrasNow();

  onBookmarksChange(() => {
    resolveGroups();
    render();
    refreshPanel();
  });
  onSettingsChange(onSettings);
  onGalleryChange(syncWallpaper);
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    applyAppearance();
    syncWallpaper();
  });
}

/** Thème dont la variante de fond s'affiche. */
const wallScheme = () => wallPreview || systemScheme();

function previewWallScheme(scheme) {
  if (scheme === wallPreview) return;
  wallPreview = scheme;
  syncWallpaper();
}

/**
 * Affiche le fond de l'onglet actif : le sien s'il en a un, sinon le fond par défaut ;
 * dans sa variante sombre s'il en a une et que le système est en thème sombre.
 */
function syncWallpaper() {
  const s = S();
  const g = currentGroup();
  const own = ownWallpaper(g);
  const ws = own || s.wallpaper;
  const scheme = ws.dark ? wallScheme() : null;
  applyWallpaper(variantOf(ws, scheme), s.appearance.textColor, {
    // La variante sombre tire ses images au sort de son côté.
    scope: (own ? g.id : 'default') + (scheme === 'dark' ? ':dark' : ''),
    scheme,
    // Store the background of the active group for the next page load.
    persist: !g || g.id === s.activeGroup,
  }).catch(() => {});
}

/** Recale les onglets sur leurs dossiers (identifiant ou, à défaut, chemin). */
function resolveGroups() {
  let changed = false;
  const groups = S().groups.map((g) => {
    const n = getNode(g.folderId);
    if (n && isFolder(n)) {
      const path = pathTitles(n.id);
      if (same(path, g.path)) return g;
      changed = true;
      return { ...g, path };
    }
    const found = findByPath(g.path);
    if (!found) return g;
    changed = true;
    return { ...g, folderId: found.id };
  });
  if (changed) updateSettings((st) => { st.groups = groups; });
}

function applyAppearance() {
  const a = S().appearance;
  const root = document.documentElement;
  const theme = a.theme === 'auto' ? (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light') : a.theme;
  const attrs = {
    'data-theme': theme,
    'data-tile-style': a.tileStyle,
    'data-titles': a.showTitles ? 'on' : 'off',
    'data-add': a.showAddTile ? 'on' : 'off',
    'data-tabs': a.tabsOnHover ? 'hover' : 'on',
    'data-fp': String(a.folderPreview),
  };
  const vars = { '--icon-base': `${a.iconSize}px`, '--cols': String(a.maxColumns) };
  for (const [k, v] of Object.entries(attrs)) root.setAttribute(k, v);
  for (const [k, v] of Object.entries(vars)) root.style.setProperty(k, v);
  saveBoot({ attrs, vars });
  pager.layout();
}

function onSettings(s, prev) {
  const changed = (k) => !same(s[k], prev[k]);
  const a = s.appearance;
  const pa = prev.appearance;
  if (changed('appearance')) applyAppearance();
  if (changed('clock')) renderClock();
  if (changed('search')) applySearchSettings();
  if (s.icons.fetchSites !== prev.icons.fetchSites) setFetchEnabled(s.icons.fetchSites);
  if (changed('icons')) renderNotice();

  // Un fond propre à un onglet change sans que les onglets eux-mêmes soient à redessiner.
  if (!same(groupsLayout(s.groups), groupsLayout(prev.groups))) {
    if (!currentGroup()) view.groupId = s.groups[0]?.id ?? null;
    // Onglet rattaché à un autre dossier : il repart de sa racine.
    for (const g of s.groups) {
      const before = prev.groups.find((x) => x.id === g.id);
      if (before && before.folderId !== g.folderId) delete view.folders[g.id];
    }
    render();
  } else if (a.folderPreview !== pa.folderPreview || a.openIn !== pa.openIn) {
    renderContent();
  }
  if (changed('sections') || a.maxColumns !== pa.maxColumns || a.openIn !== pa.openIn) renderExtrasNow();
  if (changed('wallpaper') || changed('groups') || a.textColor !== pa.textColor || s.activeGroup !== prev.activeGroup) syncWallpaper();
}

// ---------- Rendu ----------
function render() {
  renderGroups();
  renderNotice();
  renderContent();
}

function renderExtrasNow() {
  renderExtras(extras, { onRestore: (id) => chrome.sessions.restore(id).catch(onError) }).catch(() => {});
}

function renderGroups() {
  const s = S();
  groupsNav.hidden = !s.groups.length;
  groupsNav.replaceChildren();
  for (const g of s.groups) {
    const node = getNode(g.folderId);
    const btn = h('button', {
      type: 'button',
      class: 'group-tab' + (g.id === view.groupId ? ' active' : '') + (node ? '' : ' missing'),
      title: node ? pathTitles(node.id).join(' › ') : t('folderNotFound'),
      dataset: { group: g.id },
      onclick: () => openGroup(g.id),
    }, groupLabel(g));
    if (node) makeDropTarget(btn, node.id, moveInto);
    groupsNav.append(btn);
  }
  groupsNav.append(h('button', {
    type: 'button', class: 'group-tab add', title: t('showAnotherFolder'), 'aria-label': t('showAnotherFolder'), onclick: addGroups,
  }, icon('plus', 16, 2.2)));
}

function markActiveTab() {
  for (const b of groupsNav.querySelectorAll('.group-tab[data-group]')) b.classList.toggle('active', b.dataset.group === view.groupId);
}

function renderNotice() {
  const s = S();
  notice.replaceChildren();
  if (!s.groups.length || isPermitted() || !s.icons.fetchSites || s.icons.promptDismissed) return;
  notice.append(h('div', { class: 'notice' },
    icon('sparkle', 22),
    h('p', null, h('strong', null, t('iconsNoticeTitle')), t('iconsNoticeText')),
    h('button', { type: 'button', class: 'btn ghost', onclick: () => updateSettings((st) => { st.icons.promptDismissed = true; }) }, t('later')),
    h('button', {
      type: 'button', class: 'btn primary',
      onclick: () => requestSitePermission().then((ok) => {
        renderNotice();
        if (ok) toast(t('fetchingIcons'));
      }).catch(onError),
    }, t('allow'))));
}

/** Une page par onglet, côte à côte ; on ne fait défiler que si l'onglet affiché a changé. */
function renderContent() {
  const s = S();
  if (!s.groups.length) {
    pagerShown = false;
    return renderWelcome();
  }
  if (pager.el.parentElement !== content) content.replaceChildren(pager.el);
  const reordered = pager.setPages(s.groups.map((g) => g.id));
  for (const g of s.groups) renderPage(g.id);
  pager.show(view.groupId, { smooth: pagerShown && !reordered });
  pagerShown = true;
  pager.layout();
}

/**
 * Redessine la page d'un onglet ; dir : 1 = on entre dans un dossier, -1 = on en sort ;
 * from : dossier affiché jusque-là (pour savoir par quelle tuile passe le zoom).
 */
function renderPage(gid, { dir = 0, from = null } = {}) {
  const page = pager.page(gid);
  if (!page) return;
  const inner = h('div', { class: 'page-inner' });
  fillPage(inner, gid);
  const old = page.querySelector(':scope > .page-inner:not(.leaving)');
  if (!old || !dir || prefersReducedMotion() || document.hidden) {
    page.replaceChildren(inner);
  } else {
    // Une navigation encore en cours s'achève d'un coup : on repart de son état final.
    for (const a of old.getAnimations({ subtree: true })) a.finish();
    old.classList.add('leaving');
    page.append(inner);
    zoomThrough(old, inner, dir, from, folderOf(gid));
  }
  if (gid === view.groupId) pager.layout({ animate: !!dir });
}

const ZOOM = { duration: 380, easing: 'cubic-bezier(.2, .8, .2, 1)' };
const FADE_OUT = { duration: 170, easing: 'ease-out', fill: 'forwards' };
const FADE_IN = { duration: 260, delay: 60, easing: 'ease-out', fill: 'backwards' };

/**
 * Zoom entre deux niveaux de dossiers, centré sur la tuile du dossier traversé : en entrant,
 * l'ancienne grille grossit et s'efface pendant que le contenu du dossier grandit depuis sa tuile ;
 * en sortant, l'inverse. Le fil d'Ariane, lui, se fond sur place.
 */
function zoomThrough(old, inner, dir, from, to) {
  const oldBody = old.querySelector('.page-body');
  const newBody = inner.querySelector('.page-body');
  const [outer, deeper, where] = dir > 0 ? [from, to, oldBody] : [to, from, newBody];
  const step = deeper && outer && pathOf(deeper).find((n) => n.parentId === outer);
  const plate = step && where?.querySelector(`.grid > .tile[data-id="${CSS.escape(step.id)}"] > .plate`);
  const anchor = plate?.getBoundingClientRect();
  const originIn = (body) => {
    if (!anchor) return '50% 0';
    const r = body.getBoundingClientRect();
    return `${anchor.left + anchor.width / 2 - r.left}px ${anchor.top + anchor.height / 2 - r.top}px`;
  };
  const big = 1.18;
  const small = 0.82;
  const done = [];
  if (oldBody) {
    oldBody.style.transformOrigin = originIn(oldBody);
    done.push(oldBody.animate([{ transform: 'none' }, { transform: `scale(${dir > 0 ? big : small})` }], { ...ZOOM, fill: 'forwards' }).finished);
    done.push(...fadeTargets(oldBody).map(fadeOut));
  }
  if (newBody) {
    newBody.style.transformOrigin = originIn(newBody);
    newBody.animate([{ transform: `scale(${dir > 0 ? small : big})` }, { transform: 'none' }], ZOOM);
    fadeTargets(newBody).forEach(fadeIn);
  }
  const oldCrumbs = old.querySelector(':scope > .crumbs');
  const newCrumbs = inner.querySelector(':scope > .crumbs');
  if (oldCrumbs) done.push(fadeOut(oldCrumbs));
  if (newCrumbs) fadeIn(newCrumbs);
  Promise.allSettled(done).then(() => old.remove());
}

/**
 * Ce qui se fond, tuile par tuile : un fondu sur toute la grille priverait les plaques « verre »
 * (dossiers, cartes) de leur flou d'arrière-plan, qui reviendrait d'un coup à la fin.
 */
function fadeTargets(body) {
  const cards = document.documentElement.dataset.tileStyle === 'cards';
  return [...body.querySelectorAll(cards ? ':scope > .empty, .grid > .tile' : ':scope > .empty, .grid > .tile > *')];
}

// Une seule image clé : l'autre bout est l'opacité propre de l'élément (tuile « Ajouter » à 70 %,
// pastille du nombre de liens cachée hors survol…), qui n'a donc pas à être répétée ici.
const fadeOut = (el) => el.animate([{ opacity: 0 }], FADE_OUT).finished;
const fadeIn = (el) => el.animate([{ opacity: 0, offset: 0 }], FADE_IN).finished;

function fillPage(inner, gid) {
  const g = groupById(gid);
  const node = getNode(folderOf(gid));
  if (!g) return;
  if (!node || !isFolder(node)) {
    inner.append(h('div', { class: 'page-body' }, h('div', { class: 'empty' },
      h('h2', null, t('folderNotFound')),
      h('p', null, t('folderMissingText', g.label || g.path?.at(-1) || '')),
      h('button', { class: 'btn primary', type: 'button', onclick: () => changeGroupFolder(g.id) }, t('chooseAnotherFolder')))));
    return;
  }

  const crumbs = crumbsFor(g, node);
  if (crumbs) inner.append(crumbs);

  const a = S().appearance;
  const newTab = a.openIn === 'tab';
  const grid = h('div', { class: 'grid', dataset: { folder: node.id } });
  for (const c of node.children || []) {
    grid.append(c.url
      ? linkTile(c, { newTab, draggable: !c.unmodifiable })
      : folderTile(c, { previewCount: a.folderPreview, draggable: !c.unmodifiable }));
  }
  grid.append(addTile());
  // Tout sauf le fil d'Ariane : c'est ce qui zoome quand on entre dans un dossier ou qu'on en sort.
  const body = h('div', { class: 'page-body' });
  if (!(node.children || []).length) {
    body.append(h('div', { class: 'empty' },
      h('h2', null, t('emptyFolderTitle')),
      h('p', null, t('emptyFolderText'))));
  }
  body.append(grid);
  inner.append(body);

  enableSorting(grid, {
    onMove: (id, index) => moveBookmark(id, { parentId: node.id, index }).catch(onError),
    onMoveInto: moveInto,
    onDropLink: (link, index) => createBookmark({ parentId: node.id, index, url: link.url, title: link.title })
      .then(() => toast(t('linkAdded', link.title)))
      .catch(onError),
    onCancel: () => renderPage(gid),
    onLongPress: (tile, x, y) => {
      const items = tileMenu(tile);
      if (items) showMenu(x, y, items);
    },
  });
}

/** Fil d'Ariane d'une page, quand un sous-dossier y est ouvert. */
function crumbsFor(g, n) {
  if (n.id === g.folderId) return null;
  const inGroup = isInside(n.id, g.folderId);
  const chain = inGroup ? pathOf(n.id).slice(pathOf(g.folderId).length - 1) : pathOf(n.id);
  const nav = h('nav', { class: 'crumbs', 'aria-label': t('location') });
  nav.append(h('button', {
    type: 'button', class: 'crumb crumb-back', title: t('parentFolderHint'), 'aria-label': t('parentFolder'),
    disabled: !inGroup && isTopLevel(n), onclick: () => goUp(g.id),
  }, icon('back', 16, 2.2)));
  chain.forEach((c, i) => {
    const last = i === chain.length - 1;
    if (i) nav.append(h('span', { class: 'crumb-sep' }, icon('chevron', 14, 2)));
    const label = inGroup && i === 0 ? g.label || c.title : c.title || t('untitled');
    const b = h('button', {
      type: 'button', class: 'crumb' + (last ? ' current' : ''), 'aria-current': last ? 'page' : null,
      onclick: last ? null : () => navigate(g.id, c.id),
    }, label);
    if (!last) makeDropTarget(b, c.id, moveInto);
    nav.append(b);
  });
  if (!inGroup) nav.append(h('button', { type: 'button', class: 'crumb crumb-pin', onclick: () => pinAsGroup(n.id) }, t('showAsTab')));
  return nav;
}

function renderWelcome() {
  const candidates = allFolders()
    .filter(({ node, depth }) => depth <= 2 && countLinks(node.id) > 0)
    .sort((x, y) => (looksImported(y.node) - looksImported(x.node)) || (countLinks(y.node.id) - countLinks(x.node.id)))
    .slice(0, 8);
  const chosen = new Set(candidates.filter((c) => looksImported(c.node)).map((c) => c.node.id));
  const list = h('div', { class: 'suggestions' });
  const showBtn = h('button', { class: 'btn primary', type: 'button', onclick: () => addGroupsByIds([...chosen]) });
  const update = () => {
    showBtn.disabled = !chosen.size;
    showBtn.textContent = tp('showFolders', Math.max(1, chosen.size));
  };
  const renderList = () => list.replaceChildren(...candidates.map(({ node }) => {
    const checked = chosen.has(node.id);
    return h('div', {
      class: 'tree-row' + (checked ? ' checked' : ''),
      onclick: () => {
        checked ? chosen.delete(node.id) : chosen.add(node.id);
        renderList();
        update();
      },
    },
    h('input', { type: 'checkbox', checked, tabindex: -1 }),
    h('span', { class: 'folder-ico' }, icon('folder', 17)),
    h('span', { class: 't-title' }, node.title || t('untitled'), h('span', { class: 't-path' }, pathTitles(node.parentId).join(' › '))),
    looksImported(node) && h('span', { class: 'tag' }, t('importedTag')),
    h('span', { class: 't-count' }, tp('links', countLinks(node.id))));
  }));
  renderList();
  update();

  content.replaceChildren(h('div', { class: 'welcome' },
    h('h1', null, t('welcomeTitle')),
    h('p', null, t('welcomeText')),
    candidates.length ? list : h('p', { class: 'hint' }, t('noBookmarkFolders')),
    h('div', { class: 'actions' },
      h('button', { class: 'btn', type: 'button', onclick: addGroups }, t('browseAllFolders')),
      candidates.length && showBtn)));
}

// ---------- Navigation ----------
function openGroup(id) {
  const g = groupById(id);
  if (!g) return;
  if (id !== view.groupId) return pager.show(id);
  // Clic sur l'onglet déjà affiché : retour à sa racine.
  if (folderOf(id) !== g.folderId) setFolder(id, g.folderId, -1);
}

/** Onglet voisin (sans boucler, comme des pages). */
function switchGroup(dir) {
  const gs = S().groups;
  const j = gs.findIndex((g) => g.id === view.groupId) + dir;
  if (j >= 0 && j < gs.length) pager.show(gs[j].id);
}

/** Affiche un dossier : dans l'onglet qui le contient s'il y en a un, sinon dans l'onglet courant. */
function showFolder(id) {
  if (!getNode(id)) return;
  const groups = S().groups;
  if (!groups.length) return addGroupsByIds([id]);
  const cur = currentGroup();
  if (cur && isInside(id, cur.folderId)) return navigate(cur.id, id);
  const owner = groups
    .filter((g) => isInside(id, g.folderId))
    .sort((x, y) => pathOf(y.folderId).length - pathOf(x.folderId).length)[0];
  if (owner) {
    setFolder(owner.id, id);
    pager.show(owner.id);
  } else if (cur) {
    navigate(cur.id, id);
  }
}

/** Change le dossier affiché dans un onglet, avec un zoom dans le bon sens. */
function navigate(gid, folderId) {
  const from = folderOf(gid);
  if (from === folderId) return;
  setFolder(gid, folderId, from && isInside(from, folderId) ? -1 : 1);
}

function setFolder(gid, folderId, dir = 0) {
  const from = folderOf(gid);
  if (folderId === groupById(gid)?.folderId) delete view.folders[gid];
  else view.folders[gid] = folderId;
  rememberFolder(gid);
  renderPage(gid, { dir, from });
}

/**
 * Mémorise le sous-dossier ouvert dans un onglet, pour y revenir au prochain nouvel onglet.
 * Un dossier ouvert hors de l'onglet (depuis la recherche) n'est pas retenu : l'onglet repartira de sa racine.
 */
function rememberFolder(gid) {
  const g = groupById(gid);
  const f = view.folders[gid];
  updateSettings((st) => {
    if (g && f && isInside(f, g.folderId)) st.openFolders[gid] = f;
    else delete st.openFolders[gid];
  });
}

/** Rouvre dans chaque onglet le sous-dossier de la dernière visite, s'il y est toujours. */
function restoreFolders() {
  const s = S();
  for (const g of s.groups) {
    const f = s.openFolders[g.id];
    if (f && f !== g.folderId && isFolder(getNode(f)) && isInside(f, g.folderId)) view.folders[g.id] = f;
  }
}

function goUp(gid = view.groupId) {
  const g = groupById(gid);
  const n = getNode(folderOf(gid));
  if (!g || !n || n.id === g.folderId || isTopLevel(n)) return false;
  navigate(gid, n.parentId);
  return true;
}

// ---------- Onglets (groupes) ----------
async function addGroups() {
  const ids = await pickFolders({
    title: t('showFoldersTitle'),
    disabledIds: S().groups.map((g) => g.folderId),
    submitLabel: t('show'),
  });
  if (ids) addGroupsByIds(ids);
}

/** Ajoute des onglets ; la page du premier arrive en glissant. */
function addGroupsByIds(ids) {
  if (!ids.length) return;
  const created = ids.map((id) => ({ id: uid(), folderId: id, path: pathTitles(id), label: null }));
  view.groupId = created[0].id;
  updateSettings((st) => {
    st.groups.push(...created);
    st.activeGroup = created[0].id;
  });
}

function pinAsGroup(folderId) {
  const existing = S().groups.find((g) => g.folderId === folderId);
  if (existing) return pager.show(existing.id);
  // Le dossier était ouvert « hors onglet » dans l'onglet courant : celui-ci revient à sa racine.
  const cur = currentGroup();
  if (cur && view.folders[cur.id] === folderId) delete view.folders[cur.id];
  addGroupsByIds([folderId]);
}

async function changeGroupFolder(groupId) {
  const g = groupById(groupId);
  if (!g) return;
  const ids = await pickFolders({
    title: t('chooseFolderForTab'),
    multiple: false,
    selectedIds: getNode(g.folderId) ? [g.folderId] : [],
    submitLabel: t('choose'),
  });
  if (!ids?.[0]) return;
  updateSettings((st) => {
    const x = st.groups.find((y) => y.id === groupId);
    if (x) {
      x.folderId = ids[0];
      x.path = pathTitles(ids[0]);
    }
    delete st.openFolders[groupId];
  });
}

function removeGroup(groupId) {
  const groups = S().groups;
  const idx = groups.findIndex((g) => g.id === groupId);
  if (idx < 0) return;
  const removed = groups[idx];
  const opened = S().openFolders[groupId];
  updateSettings((st) => {
    st.groups.splice(idx, 1);
    if (st.activeGroup === groupId) st.activeGroup = st.groups[0]?.id ?? null;
    delete st.openFolders[groupId];
  });
  toast(t('tabRemoved', removed.label || removed.path?.at(-1) || t('defaultFolderName')), {
    action: t('undo'),
    onAction: () => updateSettings((st) => {
      st.groups.splice(Math.min(idx, st.groups.length), 0, removed);
      if (opened) st.openFolders[groupId] = opened;
    }),
  });
}

function moveGroup(i, dir) {
  updateSettings((st) => {
    const [g] = st.groups.splice(i, 1);
    st.groups.splice(i + dir, 0, g);
  });
}

async function renameGroup(g) {
  const node = getNode(g.folderId);
  const res = await openDialog({
    title: t('renameTabTitle'),
    fields: [{ name: 'label', label: t('displayedName'), value: g.label || '', placeholder: node?.title || '', help: t('renameTabHelp') }],
  });
  if (res) updateSettings((st) => { const x = st.groups.find((y) => y.id === g.id); if (x) x.label = res.label || null; });
}

// ---------- Favoris ----------
async function moveInto(id, folderId) {
  if (id === folderId) return;
  if (isInside(folderId, id)) return toast(t('cantMoveIntoItself'));
  try {
    await moveBookmark(id, { parentId: folderId });
    toast(t('movedInto', getNode(folderId)?.title || t('defaultFolderName')));
  } catch (e) {
    onError(e);
  }
}

/**
 * Importe des images de fond. Sans portée précisée, c'est le fond visible qui change :
 * celui de l'onglet actif s'il en a un propre, sinon le fond par défaut.
 */
async function importWallpapers(files, scope, scheme) {
  if (!scope) {
    const g = currentGroup();
    scope = ownWallpaper(g) ? g.id : 'default';
  }
  // Sans précision, c'est la variante affichée (claire ou sombre) qui change.
  scheme ||= wallScheme();
  const imgs = files.filter((f) => f.type.startsWith('image/'));
  if (!imgs.length) return toast(t('dropImageHint'));
  toast(tp('importingImages', imgs.length), { timeout: 30000 });
  let last = null;
  let errors = 0;
  for (const f of imgs) {
    try { last = await importImage(f); } catch { errors++; }
  }
  if (last) {
    const base = (scope !== 'default' && S().groups.find((x) => x.id === scope)?.wallpaper) || S().wallpaper;
    pinSessionImage(scope + (scheme === 'dark' && base.dark ? ':dark' : ''), last.id);
    updateSettings((st) => {
      const target = variantOf((scope !== 'default' && st.groups.find((x) => x.id === scope)?.wallpaper) || st.wallpaper, scheme);
      target.type = 'image';
      target.imageId = last.id;
    });
  }
  toast(errors ? tp('imagesFailed', errors) : tp('imagesAdded', imgs.length));
}

// ---------- Menus contextuels ----------
function linkMenu(node) {
  const locked = isLocked(node);
  return [
    { label: t('openInNewTab'), icon: 'tab', onClick: () => openUrl(node.url, 'tab') },
    { label: t('openInNewWindow'), icon: 'window', onClick: () => openUrl(node.url, 'window') },
    { label: t('openInPrivateWindow'), icon: 'private', onClick: () => openUrl(node.url, 'private') },
    '-',
    { label: t('editMenu'), icon: 'edit', disabled: locked, onClick: () => editBookmarkDialog(node) },
    { label: t('changeIconMenu'), icon: 'image', onClick: () => iconDialog(node) },
    { label: t('copyLink'), icon: 'link', onClick: () => copyLink(node.url) },
    '-',
    { label: t('delete'), icon: 'trash', danger: true, disabled: locked, onClick: () => deleteWithUndo(node) },
  ];
}

function virtualLinkMenu(url, title) {
  const folder = getNode(currentFolderId());
  return [
    { label: t('openInNewTab'), icon: 'tab', onClick: () => openUrl(url, 'tab') },
    { label: t('openInNewWindow'), icon: 'window', onClick: () => openUrl(url, 'window') },
    { label: t('openInPrivateWindow'), icon: 'private', onClick: () => openUrl(url, 'private') },
    '-',
    folder && {
      label: t('addToFolder', folder.title), icon: 'plus',
      onClick: () => createBookmark({ parentId: folder.id, url, title: title || hostOf(url) }).then(() => toast(t('addedToBookmarks'))).catch(onError),
    },
    { label: t('copyLink'), icon: 'link', onClick: () => copyLink(url) },
  ];
}

function openAllItems(folderId, n) {
  return [
    { label: t('openAllInTabs'), hint: String(n), icon: 'tab', disabled: !n, onClick: () => openAll(folderId, 'tabs') },
    { label: t('openAllInGroup'), icon: 'layers', disabled: !n, onClick: () => openAll(folderId, 'group') },
    { label: t('openAllInWindow'), icon: 'window', disabled: !n, onClick: () => openAll(folderId, 'window') },
  ];
}

function folderMenu(node) {
  const locked = isLocked(node);
  const pinned = S().groups.some((g) => g.folderId === node.id);
  return [
    { label: t('open'), icon: 'folder', onClick: () => showFolder(node.id) },
    ...openAllItems(node.id, linkCount(node)),
    '-',
    { label: pinned ? t('alreadyShownAsTab') : t('showAsTab'), icon: 'pin', disabled: pinned, onClick: () => pinAsGroup(node.id) },
    { label: t('renameMenu'), icon: 'edit', disabled: locked, onClick: () => renameFolderDialog(node) },
    '-',
    { label: t('deleteFolderMenu'), icon: 'trash', danger: true, disabled: locked, onClick: () => deleteWithUndo(node) },
  ];
}

function backgroundMenu() {
  const node = getNode(currentFolderId());
  return [
    node && { label: t('addSiteMenu'), icon: 'plus', onClick: () => addBookmarkDialog(node.id) },
    node && { label: t('newFolderMenu'), icon: 'folderPlus', onClick: () => addFolderDialog(node.id) },
    '-',
    ...(node ? openAllItems(node.id, linkCount(node)) : []),
    '-',
    { label: t('changeWallpaperMenu'), icon: 'image', onClick: () => openPanel('wall') },
    { label: t('panelTitle'), icon: 'sliders', onClick: () => openPanel() },
  ];
}

function groupMenu(g) {
  const groups = S().groups;
  const i = groups.findIndex((x) => x.id === g.id);
  const node = getNode(g.folderId);
  return [
    { label: t('renameTabMenu'), icon: 'edit', onClick: () => renameGroup(g) },
    { label: t('chooseAnotherFolderMenu'), icon: 'folder', onClick: () => changeGroupFolder(g.id) },
    {
      label: t('tabWallpaperMenu'), icon: 'image',
      hint: ownWallpaper(g) ? t('ownHint') : null,
      onClick: () => openPanel('wall', { scope: g.id }),
    },
    { label: t('moveLeft'), icon: 'back', disabled: i === 0, onClick: () => moveGroup(i, -1) },
    { label: t('moveRight'), icon: 'chevron', disabled: i === groups.length - 1, onClick: () => moveGroup(i, 1) },
    '-',
    ...(node ? openAllItems(node.id, linkCount(node)).slice(0, 2) : []),
    '-',
    { label: t('removeTab'), icon: 'close', danger: true, onClick: () => removeGroup(g.id) },
  ];
}

function tileMenu(tile) {
  const node = tile.dataset.id ? getNode(tile.dataset.id) : null;
  if (node) return node.url ? linkMenu(node) : folderMenu(node);
  if (tile.dataset.url) return virtualLinkMenu(tile.dataset.url, tile.querySelector('.label')?.textContent);
  return null;
}

function onContextMenu(e) {
  if (isTyping(e) || e.target.closest('#panel, #layer, #search')) return;
  let items = null;
  const tab = e.target.closest('.group-tab[data-group]');
  const tile = e.target.closest('.tile');
  if (tab) {
    const g = groupById(tab.dataset.group);
    if (g) items = groupMenu(g);
  } else if (tile && !tile.classList.contains('add')) {
    items = tileMenu(tile);
  } else {
    items = backgroundMenu();
  }
  if (!items) return;
  e.preventDefault();
  showMenu(e.clientX, e.clientY, items);
}

// ---------- Événements ----------
function bindEvents() {
  $('#btn-settings').addEventListener('click', togglePanel);

  content.addEventListener('click', (e) => {
    const tile = e.target.closest('.tile');
    if (!tile) return;
    if (tile.classList.contains('add')) {
      e.preventDefault();
      const folderId = tile.closest('.grid')?.dataset.folder;
      const r = tile.querySelector('.plate').getBoundingClientRect();
      showMenu(r.left, r.bottom + 6, [
        { label: t('addSiteMenu'), icon: 'globe', onClick: () => addBookmarkDialog(folderId) },
        { label: t('newFolderMenu'), icon: 'folderPlus', onClick: () => addFolderDialog(folderId) },
      ]);
      return;
    }
    if (tile.dataset.folder) {
      e.preventDefault();
      showFolder(tile.dataset.id);
      return;
    }
    const url = tile.dataset.url;
    if (url && !/^https?:/i.test(url)) {
      e.preventDefault();
      openUrl(url, e.metaKey || e.ctrlKey ? 'background' : e.shiftKey ? 'window' : 'current');
    }
  });

  // Clic molette sur un dossier : tout ouvrir.
  content.addEventListener('auxclick', (e) => {
    const tile = e.target.closest('.tile.folder');
    if (!tile || e.button !== 1) return;
    e.preventDefault();
    openAll(tile.dataset.id, 'tabs');
  });

  document.addEventListener('contextmenu', onContextMenu);

  document.addEventListener('keydown', (e) => {
    if (isDialogOpen() || isMenuOpen()) return;
    if (e.key === 'Escape') {
      if (isPanelOpen()) closePanel();
      else if (hasQuery()) clearSearch();
      else goUp();
      return;
    }
    if (isTyping(e)) return;
    if ((e.key === '/' && !e.metaKey && !e.ctrlKey) || ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k')) {
      if (focusSearch()) e.preventDefault();
      return;
    }
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.key === 'Backspace') {
      if (goUp()) e.preventDefault();
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      e.preventDefault();
      switchGroup(e.key === 'ArrowRight' ? 1 : -1);
    }
  });

  // Bouton « précédent » de la souris : remonter d'un dossier.
  document.addEventListener('mouseup', (e) => {
    if (e.button === 3 && goUp()) e.preventDefault();
  });

  // Clic hors du panneau de réglages : on le ferme.
  document.addEventListener('pointerdown', (e) => {
    if (isPanelOpen() && !e.target.closest('#panel, #layer, #btn-settings')) closePanel();
  });

  // Images déposées sur la page : nouveau fond d'écran.
  document.addEventListener('dragover', (e) => {
    if (e.dataTransfer.types.includes('Files')) {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'copy';
    }
  });
  document.addEventListener('drop', (e) => {
    if (!e.dataTransfer.types.includes('Files')) return;
    e.preventDefault();
    importWallpapers([...e.dataTransfer.files]);
  });

  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) renderClock();
  });
}
