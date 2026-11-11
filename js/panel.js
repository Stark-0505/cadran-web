// Panneau de réglages (tiroir latéral).
import { h, icon, $, same, downloadBlob, blobToDataURL, dataURLToBlob } from './util.js';
import { t, tp } from './i18n.js';
import { getSettings, updateSettings, replaceSettings, onSettingsChange, groupsLayout } from './store.js';
import { getNode, pathTitles } from './bookmarks.js';
import { GRADIENTS, COLORS, listImages, deleteImage, putImages, onGalleryChange, systemScheme, variantOf, newDarkVariant } from './wallpaper.js';
import { ENGINES, engineName } from './search.js';
import { TOP_SITES_PERMS, RECENT_PERMS } from './widgets.js';
import {
  hasSitePermission, requestSitePermission, removeSitePermission, siteIconCount,
  clearSiteIcons, exportCustomIcons, importCustomIcons,
} from './icons.js';
import { toast, confirmDialog } from './ui.js';
import {
  hasPlus, plusStatus, isPreviewing, onPlusChange, ownWallpaper, priceLabel, openCheckout, portalUrl,
  licenseLabel, activateLicense, removeLicense, startPreview, plusBackup, restorePlusBackup,
} from './plus.js';

const TABS = [
  ['folders', 'tabFolders'],
  ['look', 'tabAppearance'],
  ['wall', 'tabWallpaper'],
  ['home', 'tabHome'],
  ['more', 'tabMore'],
];

let panel;
let body;
let tabsEl;
let tab = 'folders';
let ctx;
let thumbUrls = [];
let wallScope = 'default'; // fond en cours de réglage : 'default' ou l'identifiant d'un onglet
let wallScheme = 'light'; // variante réglée quand ce fond a une variante sombre : 'light' | 'dark'
let plusPill;
let plusFrom = 'folders'; // onglet où revient le bouton « Retour » de la page Cadran+
let plusReason = null; // fonction qui a mené à la page Cadran+ : 'tabWallpaper', 'rotation' ou 'analogClock'
const set = (fn) => updateSettings(fn);

const groupLabel = (g) => g.label || getNode(g.folderId)?.title || g.path?.at(-1) || t('defaultFolderName');

/** Fond réglé par défaut : celui qu'on voit (l'onglet actif s'il a un fond propre). */
function visibleScope() {
  const g = getSettings().groups.find((x) => x.id === ctx.activeGroupId?.());
  return ownWallpaper(g) ? g.id : 'default';
}

/** Réglages de fond de la portée choisie (ceux de l'onglet, ou le fond par défaut). */
function scopedBase(s) {
  if (wallScope === 'default') return s.wallpaper;
  return s.groups.find((g) => g.id === wallScope)?.wallpaper || null;
}

/** Variante en cours de réglage du fond choisi (la sombre, s'il en a une et qu'elle est choisie). */
function scopedWallpaper(s) {
  const base = scopedBase(s);
  return base && variantOf(base, wallScheme);
}

/** Pendant le réglage d'une variante, c'est elle qui s'affiche, quel que soit le thème du système. */
function syncPreview() {
  ctx.previewWallScheme(isPanelOpen() && tab === 'wall' && scopedBase(getSettings())?.dark ? wallScheme : null);
}

export function initPanel(context) {
  ctx = context;
  panel = $('#panel');
  tabsEl = h('div', { class: 'panel-tabs', role: 'tablist' });
  body = h('div', { class: 'panel-body' });
  plusPill = h('button', { class: 'plus-pill', type: 'button', onclick: () => showPlus() }, icon('sparkle', 13, 2), 'Cadran+');
  panel.append(
    h('div', { class: 'panel-head' },
      h('h2', null, t('panelTitle')),
      plusPill,
      h('button', { class: 'icon-btn', type: 'button', title: t('close'), 'aria-label': t('close'), onclick: closePanel }, icon('close', 18))),
    tabsEl,
    body,
  );
  onGalleryChange(() => { if (isPanelOpen() && tab === 'wall') render(); });
  onPlusChange(() => { if (isPanelOpen()) render(); });
  onSettingsChange((s, prev, source) => {
    if (!isPanelOpen()) return;
    // On ne redessine pas pendant un réglage continu (curseur, couleur) : seulement si la structure change.
    const w = scopedWallpaper(s);
    const pw = scopedWallpaper(prev);
    if (source === 'external'
      || !same(groupsLayout(s.groups), groupsLayout(prev.groups))
      || w?.type !== pw?.type || w?.rotate !== pw?.rotate || w?.imageId !== pw?.imageId
      || !scopedBase(s)?.dark !== !scopedBase(prev)?.dark
      || s.clock.style !== prev.clock.style) render();
  });
}

export const isPanelOpen = () => panel?.classList.contains('open');

/** Ouvre le panneau, éventuellement sur un onglet précis ; opts.scope : fond à régler. */
export function openPanel(which, opts = {}) {
  if (which) tab = which;
  wallScope = opts.scope || visibleScope();
  wallScheme = systemScheme();
  panel.classList.add('open');
  render();
  document.body.classList.add('panel-open');
}

export function closePanel() {
  panel.classList.remove('open');
  document.body.classList.remove('panel-open');
  syncPreview();
}

export const togglePanel = () => (isPanelOpen() ? closePanel() : openPanel());
export function refreshPanel() { if (isPanelOpen()) render(); }

/** Affiche la page Cadran+ ; reason : la fonction qui y a mené, mise en avant. */
function showPlus(reason = null) {
  if (tab !== 'plus') plusFrom = tab;
  plusReason = reason;
  tab = 'plus';
  body.scrollTop = 0;
  render();
}

function render() {
  syncPreview();
  plusPill.classList.toggle('on', hasPlus() && !isPreviewing());
  plusPill.setAttribute('aria-pressed', String(tab === 'plus'));
  plusPill.title = plusStatusText();
  tabsEl.replaceChildren(...TABS.map(([id, key]) => h('button', {
    type: 'button',
    role: 'tab',
    'aria-selected': String(id === tab),
    onclick: () => {
      tab = id;
      body.scrollTop = 0;
      render();
    },
  }, t(key))));
  const scroll = body.scrollTop;
  for (const u of thumbUrls) URL.revokeObjectURL(u);
  thumbUrls = [];
  const build = { folders: foldersTab, look: lookTab, wall: wallTab, home: homeTab, more: moreTab, plus: plusTab }[tab];
  body.replaceChildren(...build());
  body.scrollTop = scroll;
}

// ---------- Contrôles ----------
/** Marque un élément comme sélectionné parmi ses frères. */
function pressOne(el) {
  for (const sib of el.parentElement.children) {
    if (sib.hasAttribute('aria-pressed')) sib.setAttribute('aria-pressed', String(sib === el));
  }
}

function row(label, control, hint) {
  return h('div', { class: 'row' }, h('div', { class: 'row-label' }, h('span', null, label), hint && h('small', null, hint)), control);
}

function toggle(value, onChange) {
  return h('label', { class: 'switch' },
    h('input', { type: 'checkbox', checked: !!value, onchange: (e) => onChange(e.target.checked, e) }),
    h('span'));
}

function segmented(options, value, onChange) {
  const wrap = h('div', { class: 'segmented', role: 'group' });
  for (const [v, label] of options) {
    const btn = h('button', { type: 'button', 'aria-pressed': String(v === value) }, label);
    btn.addEventListener('click', () => {
      for (const b of wrap.children) b.setAttribute('aria-pressed', String(b === btn));
      onChange(v);
    });
    wrap.append(btn);
  }
  return wrap;
}

function range({ min, max, step = 1, value, format = String, onInput }) {
  const out = h('output', null, format(value));
  const input = h('input', {
    type: 'range', min: String(min), max: String(max), step: String(step), value: String(value),
    oninput: (e) => {
      const v = Number(e.target.value);
      out.textContent = format(v);
      onInput(v);
    },
  });
  return h('div', { class: 'range' }, input, out);
}

// ---------- Onglet « Dossiers » ----------
function foldersTab() {
  const s = getSettings();
  const list = h('div', { class: 'group-list' });
  s.groups.forEach((g, i) => {
    const node = getNode(g.folderId);
    const move = (dir) => set((st) => {
      const [item] = st.groups.splice(i, 1);
      st.groups.splice(i + dir, 0, item);
    });
    list.append(h('div', { class: 'group-item' },
      h('div', { class: 'g-text' },
        h('input', {
          value: g.label || node?.title || g.path?.at(-1) || '',
          placeholder: node?.title || t('tabName'),
          'aria-label': t('tabName'),
          title: t('tabNameHint'),
          onchange: (e) => set((st) => {
            const v = e.target.value.trim();
            st.groups[i].label = !v || v === node?.title ? null : v;
          }),
          onkeydown: (e) => { if (e.key === 'Enter') e.target.blur(); },
        }),
        h('small', null, node ? pathTitles(node.id).join(' › ') : `⚠︎ ${t('folderNotFound')}`)),
      h('button', { class: 'icon-btn', type: 'button', title: t('moveUp'), disabled: i === 0, onclick: () => move(-1) }, icon('up', 16)),
      h('button', { class: 'icon-btn', type: 'button', title: t('moveDown'), disabled: i === s.groups.length - 1, onclick: () => move(1) }, icon('down', 16)),
      h('button', {
        class: 'icon-btn' + (ownWallpaper(g) ? ' on' : ''), type: 'button',
        title: ownWallpaper(g) ? t('ownWallpaper') : t('tabWallpaperStillDefault'),
        onclick: () => openPanel('wall', { scope: g.id }),
      }, icon('image', 16)),
      h('button', { class: 'icon-btn', type: 'button', title: t('chooseAnotherFolder'), onclick: () => ctx.changeGroupFolder(g.id) }, icon('folder', 16)),
      h('button', { class: 'icon-btn', type: 'button', title: t('removeTabHint'), onclick: () => ctx.removeGroup(g.id) }, icon('close', 16))));
  });
  return [
    h('h3', null, t('foldersAsTabs')),
    s.groups.length ? list : h('p', { class: 'hint' }, t('noFoldersYet')),
    h('div', { class: 'button-row' },
      h('button', { class: 'btn primary', type: 'button', onclick: () => ctx.addGroups() }, icon('plus', 15, 2.2), t('addFolders'))),
    h('p', { class: 'hint' }, t('foldersHint')),
  ];
}

// ---------- Onglet « Apparence » ----------
function lookTab() {
  const a = getSettings().appearance;
  const setA = (k) => (v) => set((st) => { st.appearance[k] = v; });
  const autoLightDark = [['auto', t('auto')], ['light', t('light')], ['dark', t('dark')]];
  return [
    h('h3', null, t('tiles')),
    h('div', { class: 'card' },
      row(t('tileStyle'), segmented([['icons', t('styleIcons')], ['cards', t('styleCards')]], a.tileStyle, setA('tileStyle'))),
      row(t('iconSize'), range({ min: 24, max: 128, step: 4, value: a.iconSize, format: (v) => `${v} px`, onInput: setA('iconSize') })),
      row(t('maxColumns'), range({ min: 3, max: 14, value: a.maxColumns, onInput: setA('maxColumns') })),
      row(t('showNames'), toggle(a.showTitles, setA('showTitles'))),
      row(t('addTileSetting'), toggle(a.showAddTile, setA('showAddTile'))),
      row(t('folderPreview'), segmented([[4, '2 × 2'], [9, '3 × 3']], a.folderPreview, setA('folderPreview')))),
    h('h3', null, t('behavior')),
    h('div', { class: 'card' },
      row(t('openLinks'), segmented([['current', t('openSameTab')], ['tab', t('openNewTab')]], a.openIn, setA('openIn')),
        t('openLinksHint')),
      row(t('hoverFolderTabs'), toggle(a.tabsOnHover, setA('tabsOnHover')), t('hoverFolderTabsHint'))),
    h('h3', null, t('colors')),
    h('div', { class: 'card' },
      row(t('textOnWallpaper'), segmented(autoLightDark, a.textColor, setA('textColor'))),
      row(t('menusAndPanels'), segmented(autoLightDark, a.theme, setA('theme')))),
  ];
}

// ---------- Onglet « Fond » ----------
function wallTab() {
  const s = getSettings();
  const plus = hasPlus();
  if (wallScope !== 'default' && !s.groups.some((g) => g.id === wallScope)) wallScope = 'default';
  const group = s.groups.find((g) => g.id === wallScope) || null;
  const out = [];
  if (isPreviewing()) out.push(previewNote());

  // Portée : fond par défaut, ou fond propre à un onglet (Cadran+).
  if (s.groups.length) {
    const select = h('select', {
      class: 'input',
      'aria-label': t('wallpaperToSet'),
      onchange: (e) => {
        wallScope = e.target.value;
        wallScheme = systemScheme();
        render();
      },
    },
    h('option', { value: 'default', selected: wallScope === 'default' }, t('defaultWallpaperAllTabs')),
    s.groups.map((g) => h('option', { value: g.id, selected: g.id === wallScope }, ownWallpaper(g) ? t('tabWithOwnWallpaper', groupLabel(g)) : groupLabel(g))));
    out.push(
      h('h3', null, t('tabSection'), !plus && plusMark()),
      h('div', { class: 'card' },
        h('div', { class: 'row stack' },
          h('div', { class: 'row-label' }, h('span', null, t('setWallpaperOf')), h('small', null, t('setWallpaperOfHint'))),
          select),
        group && row(t('ownWallpaper'), toggle(!!group.wallpaper, (on, e) => {
          if (on && !hasPlus()) {
            e.target.checked = false;
            return showPlus('tabWallpaper');
          }
          set((st) => {
            const g = st.groups.find((x) => x.id === group.id);
            if (g) g.wallpaper = on ? structuredClone(st.wallpaper) : null;
          });
        }), !group.wallpaper ? t('usesDefaultForNow') : plus ? null : t('plusInactive'))),
    );
    if (group && !ownWallpaper(group)) return out;
  }

  // Fond différent quand le système est en thème sombre.
  const base = scopedBase(s);
  if (!base.dark) wallScheme = 'light';
  out.push(h('h3', null, t('lightAndDark')),
    h('div', { class: 'card' },
      row(t('darkWallpaper'), toggle(!!base.dark, (on) => {
        wallScheme = on ? 'dark' : 'light';
        set((st) => {
          const b = scopedBase(st);
          if (b) b.dark = on ? newDarkVariant(b) : null;
        });
      }), t('darkWallpaperHint')),
      base.dark && row(t('variantToSet'), segmented([['light', t('light')], ['dark', t('dark')]], wallScheme, (v) => {
        wallScheme = v;
        render();
      }))));

  const w = scopedWallpaper(s);
  // Sans Cadran+, l'image ne change pas toute seule (le réglage enregistré est conservé).
  const rotate = plus ? w.rotate : 'off';
  const setW = (patch) => set((st) => {
    const target = scopedWallpaper(st);
    if (target) Object.assign(target, patch);
  });
  out.push(
    h('h3', null, t('wallpaper')),
    h('div', { class: 'row stack' }, segmented([['gradient', t('gradients')], ['color', t('colors')], ['image', t('images')]], w.type, (type) => setW({ type }))),
  );

  if (w.type === 'gradient') {
    out.push(h('div', { class: 'swatches' }, GRADIENTS.map((g) => h('button', {
      type: 'button', class: 'swatch', title: t(`grad_${g.id}`), 'aria-label': t(`grad_${g.id}`),
      'aria-pressed': String(g.id === w.gradient),
      style: { background: g.css },
      onclick: (e) => {
        pressOne(e.currentTarget);
        setW({ gradient: g.id });
      },
    }))));
  } else if (w.type === 'color') {
    const custom = !COLORS.includes(w.color);
    out.push(h('div', { class: 'swatches' },
      COLORS.map((c) => h('button', {
        type: 'button', class: 'swatch', title: c, 'aria-pressed': String(c === w.color),
        style: { background: c },
        onclick: (e) => {
          pressOne(e.currentTarget);
          setW({ color: c });
        },
      })),
      h('label', { class: 'swatch custom', title: t('customColor'), 'aria-pressed': String(custom), style: { background: custom ? w.color : 'conic-gradient(red, yellow, lime, aqua, blue, magenta, red)' } },
        h('input', {
          type: 'color', value: w.color,
          oninput: (e) => {
            const swatch = e.target.parentElement;
            swatch.style.background = e.target.value;
            pressOne(swatch);
            setW({ color: e.target.value });
          },
        }))));
  } else {
    const gallery = h('div', { class: 'swatches' });
    const file = h('input', { type: 'file', accept: 'image/*', multiple: true, hidden: true });
    file.addEventListener('change', async () => {
      const files = [...file.files];
      file.value = '';
      await ctx.importWallpapers(files, wallScope, wallScheme);
    });
    listImages().then((imgs) => {
      for (const rec of imgs) {
        const url = URL.createObjectURL(rec.thumb || rec.blob);
        thumbUrls.push(url);
        const selected = rotate === 'off' && (w.imageId ? rec.id === w.imageId : rec === imgs.at(-1));
        gallery.append(h('div', {
          class: 'swatch', role: 'button', tabindex: 0, 'aria-pressed': String(selected),
          style: { background: `url("${url}")` },
          onclick: () => setW({ imageId: rec.id, rotate: 'off' }),
        }, h('button', {
          type: 'button', class: 'del', title: t('deleteImage'),
          onclick: async (e) => {
            e.stopPropagation();
            if (await confirmDialog({ title: t('deleteImageConfirm'), confirmLabel: t('delete'), danger: true })) await deleteImage(rec.id);
          },
        }, icon('close', 12, 2.4))));
      }
      gallery.append(h('button', { type: 'button', class: 'swatch add', title: t('importImages'), onclick: () => file.click() }, icon('plus', 20, 2)));
    });
    out.push(gallery, file,
      h('p', { class: 'hint' }, t('dropImagesHint')),
      h('div', { class: 'card' },
        h('div', { class: 'row stack' },
          h('div', { class: 'row-label' }, h('span', null, t('rotateImages'), !plus && plusMark())),
          segmented([['off', t('rotateNever')], ['tab', t('rotateEachOpening')], ['day', t('rotateDaily')]], rotate, (v) => {
            if (v !== 'off' && !hasPlus()) return showPlus('rotation');
            setW({ rotate: v });
          }))));
  }

  out.push(
    h('h3', null, t('wallpaperSettings')),
    h('div', { class: 'card' },
      row(t('blur'), range({ min: 0, max: 40, value: w.blur, format: (v) => `${v} px`, onInput: (blur) => setW({ blur }) })),
      row(t('dim'), range({ min: 0, max: 80, value: w.dim, format: (v) => `${v} %`, onInput: (dim) => setW({ dim }) }))),
  );
  return out;
}

// ---------- Onglet « Accueil » ----------
async function withPermission(on, e, perms) {
  if (!on) return true;
  const ok = await chrome.permissions.request(perms).catch(() => false);
  if (!ok) e.target.checked = false;
  return ok;
}

function homeTab() {
  const s = getSettings();
  const setC = (k) => (v) => set((st) => { st.clock[k] = v; });
  const engineSelect = h('select', { class: 'input', onchange: (e) => set((st) => { st.search.engine = e.target.value; }) },
    ENGINES.map((en) => h('option', { value: en.id, selected: en.id === s.search.engine }, engineName(en))));
  // Format de l'heure : null = celui de la langue.
  const hourFormat = s.clock.hour12 == null ? 'auto' : s.clock.hour12 ? '12' : '24';
  // Horloge analogique : Cadran+ (sans lui, le réglage enregistré est conservé mais l'horloge reste numérique).
  const plus = hasPlus();
  const analog = plus && s.clock.style === 'analog';
  return [
    h('h3', null, t('clock')),
    h('div', { class: 'card' },
      row(t('showTime'), toggle(s.clock.show, setC('show'))),
      row(t('clockStyle'), segmented([['digital', t('clockDigital')], ['analog', [t('clockAnalog'), !plus && plusMark()]]],
        analog ? 'analog' : 'digital', (v) => {
          if (v === 'analog' && !hasPlus()) return showPlus('analogClock');
          set((st) => { st.clock.style = v; });
        })),
      // Le format 12 h / 24 h ne concerne que l'horloge numérique ; la trotteuse, que l'analogique.
      analog
        ? row(t('clockSeconds'), toggle(s.clock.seconds, setC('seconds')), t('clockSecondsHint'))
        : row(t('timeFormat'), segmented([['auto', t('auto')], ['12', t('format12h')], ['24', t('format24h')]], hourFormat,
          (v) => set((st) => { st.clock.hour12 = v === 'auto' ? null : v === '12'; }))),
      row(t('date'), toggle(s.clock.showDate, setC('showDate'))),
      row(t('greeting'), toggle(s.clock.greeting, setC('greeting')), t('greetingHint')),
      row(t('yourName'), h('input', {
        class: 'input', value: s.clock.name, placeholder: t('optional'),
        oninput: (e) => set((st) => { st.clock.name = e.target.value; }),
      }))),
    h('h3', null, t('search')),
    h('div', { class: 'card' },
      row(t('searchBar'), toggle(s.search.show, (v) => set((st) => { st.search.show = v; })), t('searchBarHint')),
      row(t('searchEngine'), engineSelect)),
    h('h3', null, t('sections')),
    h('div', { class: 'card' },
      row(t('topSites'), toggle(s.sections.topSites, async (on, e) => {
        if (await withPermission(on, e, TOP_SITES_PERMS)) set((st) => { st.sections.topSites = on; });
      }), t('topSitesHint')),
      row(t('recentlyClosed'), toggle(s.sections.recentlyClosed, async (on, e) => {
        if (await withPermission(on, e, RECENT_PERMS)) set((st) => { st.sections.recentlyClosed = on; });
      }), t('recentlyClosedHint'))),
    h('p', { class: 'hint' }, t('sectionsPermissionHint')),
  ];
}

// ---------- Onglet « Plus » ----------
function moreTab() {
  const s = getSettings();
  const status = h('span', null, '…');
  const permBox = h('div', { class: 'button-row' });
  const count = h('small', null, tp('iconsCached', siteIconCount()));
  const webMode = !!window.CADRAN_WEB_MODE;

  if (!webMode) hasSitePermission().then((ok) => {
    status.replaceChildren(h('i', { class: 'status-dot' + (ok ? ' on' : '') }), ok ? t('siteAccessGranted') : t('siteAccessNotGranted'));
    permBox.replaceChildren(ok
      ? h('button', {
        class: 'btn small', type: 'button',
        onclick: async () => { await removeSitePermission(); render(); },
      }, t('revokeSiteAccess'))
      : h('button', {
        class: 'btn small primary', type: 'button',
        onclick: () => requestSitePermission().then((granted) => { if (granted) toast(t('fetchingIcons')); render(); }),
      }, t('allowSiteAccess')));
  });

  const importInput = h('input', { type: 'file', accept: 'application/json,.json', hidden: true });
  importInput.addEventListener('change', async () => {
    const f = importInput.files[0];
    importInput.value = '';
    if (f) await importBackup(f);
  });
  const withImages = h('input', { type: 'checkbox', checked: true });

  return [
    ...(webMode ? [
      h('h3', null, t('hdIcons')),
      h('div', { class: 'card' }, h('p', null, 'High-resolution speed-dial icons are enabled automatically. Cadran uses a public favicon service where available. No site-access permission or toggle is needed.')),
      h('p', { class: 'hint' }, 'Some sites only publish small favicons, so a high-resolution version may not exist.'),
    ] : [
      h('h3', null, t('hdIcons')),
      h('div', { class: 'card' },
        row(status, toggle(s.icons.fetchSites, (v) => set((st) => { st.icons.fetchSites = v; })), t('fetchSiteIconsHint')),
        h('div', { class: 'row stack' }, permBox,
          h('div', { class: 'button-row' },
            count,
            h('button', { class: 'btn small', type: 'button', onclick: async () => { await clearSiteIcons(); toast(t('iconsWillRedownload')); render(); } }, icon('refresh', 14), t('redownloadAll'))))),
      h('p', { class: 'hint' }, t('hdIconsHint')),
    ]),

    h('h3', null, t('backup')),
    h('div', { class: 'card' },
      row(t('exportSettings'), h('button', { class: 'btn small', type: 'button', onclick: () => exportBackup(withImages.checked) }, icon('download', 14), t('export')),
        t('exportHint')),
      row(t('includeWallpapers'), h('label', { class: 'switch' }, withImages, h('span'))),
      row(t('importBackup'), h('button', { class: 'btn small', type: 'button', onclick: () => importInput.click() }, icon('upload', 14), t('importEllipsis'))),
      row(t('reset'), h('button', {
        class: 'btn small danger', type: 'button',
        onclick: async () => {
          if (await confirmDialog({ title: t('resetConfirmTitle'), text: t('resetConfirmText'), confirmLabel: t('reset'), danger: true })) replaceSettings({});
        },
      }, t('reset')))),
    importInput,

    h('h3', null, 'Cadran+'),
    h('div', { class: 'card' },
      row(plusStatusText(), h('button', { class: 'btn small', type: 'button', onclick: () => showPlus() },
        ['free', 'preview'].includes(plusStatus()) ? t('plusDiscover') : t('plusManage')))),

    h('h3', null, t('shortcuts')),
    h('div', { class: 'kbd-list' },
      h('kbd', null, '/'), t('kbSearch'),
      h('kbd', null, '← →'), t('kbPrevNextTab'),
      h('kbd', null, t('kbTwoFingers')), t('kbSwipeTabs'),
      h('kbd', null, t('kbEscape')), t('kbParentFolder'),
      h('kbd', null, t('kbCmdClick')), t('openInNewTab'),
      h('kbd', null, t('kbRightClick')), t('kbActions')),
    h('p', { class: 'hint' }, t('footer', chrome.runtime.getManifest?.().version || ''), h('br'),
      // Signature, la même dans toutes les langues.
      'Made in 🇨🇭 with ❤️'),
  ];
}

// ---------- Page « Cadran+ » ----------
const plusMark = () => h('span', { class: 'plus-mark', title: 'Cadran+', 'aria-label': 'Cadran+' }, '+');
const previewNote = () => h('div', { class: 'plus-note' }, icon('sparkle', 16), h('span', null, t('plusPreviewNote')));

function plusStatusText() {
  return {
    licensed: t('plusStatusActive'),
    founder: t('plusFounderTitle'),
    preview: t('plusStatusPreview'),
    free: t('plusStatusFree'),
  }[plusStatus()];
}

function plusErrorText(e) {
  if (e?.code === 'invalid') return t('plusErrorInvalid');
  if (e?.code === 'limit') return t('plusErrorLimit');
  return t('plusErrorNetwork');
}

function plusTab() {
  const status = plusStatus();
  const out = [
    h('button', { class: 'btn small ghost back-btn', type: 'button', onclick: () => { tab = plusFrom; render(); } }, icon('back', 14, 2.2), t('back')),
    h('div', { class: 'plus-hero' },
      h('div', { class: 'plus-title' }, icon('sparkle', 20, 2), 'Cadran+'),
      plusReason === 'tabWallpaper' && h('p', { class: 'plus-reason' }, t('plusReasonTabWallpaper')),
      plusReason === 'rotation' && h('p', { class: 'plus-reason' }, t('plusReasonRotation')),
      plusReason === 'analogClock' && h('p', { class: 'plus-reason' }, t('plusReasonAnalogClock')),
      h('p', null, t('plusIntro')),
      h('ul', { class: 'plus-features' },
        h('li', null, icon('layers', 16), t('plusFeatureTabWallpapers')),
        h('li', null, icon('refresh', 16), t('plusFeatureRotation')),
        h('li', null, icon('clock', 16), t('plusFeatureAnalogClock')),
        h('li', null, icon('sparkle', 16), t('plusFeatureFuture'))),
      h('p', { class: 'plus-support' }, t('plusSupport'))),
  ];

  if (status === 'founder') {
    out.push(h('div', { class: 'card' },
      row(h('span', null, h('i', { class: 'status-dot on' }), t('plusFounderTitle')), null, t('plusFounderText'))));
    return out;
  }
  if (status === 'licensed') {
    out.push(
      h('div', { class: 'card' },
        row(h('span', null, h('i', { class: 'status-dot on' }), t('plusActiveTitle')),
          h('button', { class: 'btn small', type: 'button', onclick: removeFromDevice }, t('plusRemove')),
          t('plusKeyShown', licenseLabel()))),
      h('p', { class: 'hint' }, t('plusPrivacy')));
    return out;
  }

  // Pas encore acheté (éventuellement en essai sur cette page).
  const portal = portalUrl();
  if (status === 'preview') out.push(previewNote());
  out.push(
    h('div', { class: 'button-row plus-actions' },
      h('button', { class: 'btn primary', type: 'button', onclick: openCheckout }, t('plusBuy', priceLabel())),
      status === 'free' && h('button', { class: 'btn', type: 'button', onclick: tryPlus }, t('plusTry'))),
    h('p', { class: 'hint' }, t('plusOneTime')),
    h('h3', null, t('plusHaveKey')),
    keyForm(),
    h('p', { class: 'hint' }, t('plusKeyHint'), portal && [' ', h('a', { href: portal, target: '_blank', rel: 'noreferrer' }, t('plusFindKey'))]),
    h('p', { class: 'hint' }, t('plusPrivacy')),
  );
  return out;
}

function keyForm() {
  const input = h('input', {
    class: 'input', type: 'text', placeholder: t('plusKeyPlaceholder'), 'aria-label': t('plusKeyLabel'),
    autocomplete: 'off', spellcheck: 'false',
  });
  const submit = h('button', { class: 'btn', type: 'submit' }, t('plusActivate'));
  const error = h('p', { class: 'plus-error', role: 'alert', hidden: true });
  const form = h('form', { class: 'plus-key' }, input, submit);
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!input.value.trim()) return input.focus();
    error.hidden = true;
    submit.disabled = true;
    submit.textContent = t('plusChecking');
    try {
      await activateLicense(input.value);
      toast(t('plusActivated'));
    } catch (err) {
      error.textContent = plusErrorText(err);
      error.hidden = false;
      submit.disabled = false;
      submit.textContent = t('plusActivate');
    }
  });
  return h('div', { class: 'card' }, h('div', { class: 'row stack' }, form, error));
}

/** Essai : Cadran+ s'applique sur cette page ; on revient là où l'utilisateur était. */
function tryPlus() {
  startPreview();
  toast(t('plusPreviewStarted'));
  tab = plusFrom;
  render();
}

async function removeFromDevice() {
  if (!(await confirmDialog({ title: t('plusRemoveConfirm'), text: t('plusRemoveText'), confirmLabel: t('plusRemove') }))) return;
  try {
    await removeLicense();
    toast(t('plusRemoved'));
  } catch (e) {
    toast(plusErrorText(e));
  }
}

// ---------- Sauvegarde ----------
async function exportBackup(includeImages) {
  // Les sous-dossiers ouverts désignent des favoris de ce navigateur : sans objet ailleurs.
  const { openFolders, ...settings } = getSettings();
  const data = {
    app: 'cadran',
    version: 1,
    exportedAt: new Date().toISOString(),
    settings,
    customIcons: await exportCustomIcons(blobToDataURL),
    plus: plusBackup(),
  };
  if (includeImages) {
    data.wallpapers = await Promise.all((await listImages()).map(async (r) => ({
      ...r,
      blob: await blobToDataURL(r.blob),
      thumb: r.thumb ? await blobToDataURL(r.thumb) : null,
    })));
  }
  const stamp = new Date().toISOString().slice(0, 10);
  downloadBlob(new Blob([JSON.stringify(data)], { type: 'application/json' }), `cadran-${stamp}.json`);
}

async function importBackup(file) {
  try {
    const data = JSON.parse(await file.text());
    if (data?.app !== 'cadran' || !data.settings) throw new Error(t('notABackup'));
    if (data.wallpapers?.length) {
      await putImages(await Promise.all(data.wallpapers.map(async (r) => ({
        ...r,
        blob: await dataURLToBlob(r.blob),
        thumb: r.thumb ? await dataURLToBlob(r.thumb) : null,
      }))));
    }
    await importCustomIcons(data.customIcons, dataURLToBlob);
    await restorePlusBackup(data.plus);
    replaceSettings(data.settings);
    ctx.afterImport?.();
    toast(t('backupImported'));
  } catch (e) {
    toast(e.message || t('importFailed'));
  }
}
