// Actions sur les favoris : ouvrir, ajouter, modifier, supprimer (avec annulation), icône.
import { h, icon, normalizeUrl, hostOf, isWebUrl, debounce } from './util.js';
import { t, tp } from './i18n.js';
import { getNode, createBookmark, updateBookmark, removeNode, isLocked, countLinks } from './bookmarks.js';
import { openDialog, confirmDialog, toast } from './ui.js';
import {
  paintPlate, getCustom, setCustomImage, setCustomImageFromUrl, setCustomMono, clearCustom,
  refetchSite, isPermitted, PALETTE, gradientFor, monogram,
} from './icons.js';

/** where : 'current' | 'tab' | 'background' | 'window' | 'private' */
export function openUrl(url, where = 'current') {
  if (!url) return;
  if (/^javascript:/i.test(url)) {
    toast(t('bookmarkletsBlocked'));
    return;
  }
  const fail = () => toast(t('cantOpenLink'));
  switch (where) {
    case 'private':
      chrome.windows.create({ url, incognito: true }).catch(() => toast(t('cantOpenPrivate')));
      break;
    case 'window':
      chrome.windows.create({ url }).catch(fail);
      break;
    case 'tab':
    case 'background':
      chrome.tabs.create({ url, active: where === 'tab' }).catch(fail);
      break;
    default:
      if (isWebUrl(url)) location.href = url;
      else chrome.tabs.update({ url }).catch(() => chrome.tabs.create({ url }).catch(fail));
  }
}

/** Ouvre tous les liens directs d'un dossier. mode : 'tabs' | 'group' | 'window' | 'private' */
export async function openAll(folderId, mode = 'tabs') {
  const node = getNode(folderId);
  const urls = (node?.children || []).filter((c) => c.url && !/^javascript:/i.test(c.url)).map((c) => c.url);
  if (!urls.length) return toast(t('noDirectLinks'));
  if (urls.length > 12) {
    const ok = await confirmDialog({
      title: tp('openTabsConfirm', urls.length),
      text: t('openAllText', node.title),
      confirmLabel: t('open'),
    });
    if (!ok) return;
  }
  if (mode === 'window') return chrome.windows.create({ url: urls });
  if (mode === 'private') return chrome.windows.create({ url: urls, incognito: true }).catch(() => toast(t('cantOpenPrivate')));
  const tabs = [];
  for (const url of urls) tabs.push(await chrome.tabs.create({ url, active: false }));
  if (mode === 'group') {
    try {
      const groupId = await chrome.tabs.group({ tabIds: tabs.map((tab) => tab.id) });
      await chrome.tabGroups?.update(groupId, { title: node.title || '', collapsed: false });
    } catch {
      /* groupes d'onglets indisponibles : les onglets restent ouverts */
    }
  }
  if (tabs[0]) chrome.tabs.update(tabs[0].id, { active: true });
}

/** Titre de la page (seulement si l'accès aux sites est autorisé). */
async function fetchTitle(url) {
  if (!isPermitted() || !isWebUrl(url)) return '';
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 4000);
  try {
    const res = await fetch(url, { credentials: 'omit', signal: ctrl.signal });
    const doc = new DOMParser().parseFromString((await res.text()).slice(0, 300000), 'text/html');
    const name = doc.querySelector('meta[property="og:site_name"]')?.getAttribute('content') || doc.title || '';
    return name.trim().slice(0, 120);
  } catch {
    return '';
  } finally {
    clearTimeout(timer);
  }
}

export function addBookmarkDialog(parentId, index) {
  return openDialog({
    title: t('addSiteTitle'),
    fields: [
      { name: 'url', label: t('address'), placeholder: t('addressPlaceholder'), required: true },
      { name: 'title', label: t('name'), placeholder: t('namePlaceholder') },
    ],
    submitLabel: t('add'),
    onSubmit: async ({ url, title }) => {
      const u = normalizeUrl(url);
      if (!u) throw new Error(t('invalidAddress'));
      const name = title || (await fetchTitle(u)) || hostOf(u) || u;
      await createBookmark({ parentId, index, url: u, title: name });
    },
  });
}

export function addFolderDialog(parentId, index) {
  return openDialog({
    title: t('newFolderTitle'),
    fields: [{ name: 'title', label: t('folderName'), required: true }],
    submitLabel: t('create'),
    onSubmit: ({ title }) => createBookmark({ parentId, index, title }),
  });
}

async function moveCustomIcon(oldUrl, newUrl) {
  const c = getCustom(oldUrl);
  if (!c || oldUrl === newUrl) return;
  if (c.type === 'mono') await setCustomMono(newUrl, c.text, c.color);
  else await setCustomImage(newUrl, await (await fetch(c.src)).blob());
  await clearCustom(oldUrl);
}

export function editBookmarkDialog(node) {
  return openDialog({
    title: t('editBookmarkTitle'),
    fields: [
      { name: 'title', label: t('name'), value: node.title },
      { name: 'url', label: t('address'), value: node.url, required: true },
    ],
    onSubmit: async ({ title, url }) => {
      const u = normalizeUrl(url);
      if (!u) throw new Error(t('invalidAddress'));
      await updateBookmark(node.id, { title, url: u });
      await moveCustomIcon(node.url, u).catch(() => {});
    },
  });
}

export function renameFolderDialog(node) {
  return openDialog({
    title: t('renameFolderTitle'),
    fields: [{ name: 'title', label: t('name'), value: node.title, required: true }],
    onSubmit: ({ title }) => updateBookmark(node.id, { title }),
  });
}

export async function deleteWithUndo(node) {
  if (!node || isLocked(node)) return;
  const name = node.title || hostOf(node.url) || t('untitled');
  if (!node.url) {
    const n = countLinks(node.id);
    if (n > 0) {
      const ok = await confirmDialog({
        title: t('deleteConfirmTitle', name),
        text: tp('deleteFolderText', n),
        confirmLabel: t('delete'),
        danger: true,
      });
      if (!ok) return;
    }
  }
  try {
    const undo = await removeNode(node.id);
    toast(t('deletedToast', name), {
      action: t('undo'),
      timeout: 8000,
      onAction: () => undo?.().catch(() => toast(t('cantUndo'))),
    });
  } catch (e) {
    toast(t('deleteFailed', e.message));
  }
}

export async function copyLink(url) {
  try {
    await navigator.clipboard.writeText(url);
    toast(t('linkCopied'));
  } catch {
    toast(t('copyFailed'));
  }
}

/** Éditeur d'icône : image importée, image depuis une URL, lettre / emoji, ou automatique. */
export async function iconDialog(node) {
  const url = node.url;
  const preview = h('div', { class: 'plate' });
  paintPlate(preview, node);
  const status = h('small', { class: 'hint' });
  const run = async (fn) => {
    status.textContent = '';
    try { await fn(); } catch (e) { status.textContent = e.message; }
  };

  const fileInput = h('input', { type: 'file', accept: 'image/*', hidden: true });
  fileInput.addEventListener('change', () => {
    const f = fileInput.files[0];
    if (f) run(() => setCustomImage(url, f));
    fileInput.value = '';
  });

  const cur = getCustom(url);
  const auto = monogram(node.title, url);
  let color = cur?.type === 'mono' ? cur.color : auto.color;
  const monoText = h('input', { class: 'input', maxlength: '4', value: cur?.type === 'mono' ? cur.text : '', placeholder: auto.text, 'aria-label': t('letterOrEmoji') });
  const applyMono = () => run(() => setCustomMono(url, monoText.value.trim() || auto.text, color));
  monoText.addEventListener('input', debounce(applyMono, 250));
  const dots = h('div', { class: 'color-dots' });
  const renderDots = () => dots.replaceChildren(...PALETTE.map((_, i) => h('button', {
    type: 'button',
    class: 'color-dot',
    style: { background: gradientFor(i) },
    'aria-pressed': String(i === color),
    'aria-label': t('colorN', i + 1),
    onclick: () => {
      color = i;
      renderDots();
      applyMono();
    },
  })));
  renderDots();

  const urlInput = h('input', { class: 'input', type: 'url', placeholder: 'https://…/logo.png', style: 'flex:1', 'aria-label': t('imageAddress') });
  const refetch = () => run(async () => {
    if (!isPermitted()) throw new Error(t('allowSiteAccessFirst'));
    await clearCustom(url);
    await refetchSite(url);
  });

  const body = h('div', { class: 'icon-editor' },
    h('div', { class: 'preview' }, preview),
    h('div', { class: 'options' },
      h('div', { class: 'button-row' },
        h('button', { type: 'button', class: 'btn', onclick: () => fileInput.click() }, icon('upload', 15), t('importImageEllipsis')),
        isWebUrl(url) && h('button', { type: 'button', class: 'btn', onclick: refetch }, icon('refresh', 15), t('redownload')),
        h('button', { type: 'button', class: 'btn', onclick: () => run(() => clearCustom(url)) }, icon('sparkle', 15), t('automatic'))),
      h('div', { class: 'field' }, h('span', null, t('fromImageAddress')),
        h('div', { class: 'mono-row' }, urlInput,
          h('button', { type: 'button', class: 'btn', onclick: () => run(() => setCustomImageFromUrl(url, normalizeUrl(urlInput.value) || '')) }, t('use')))),
      h('div', { class: 'field' }, h('span', null, t('letterOrEmoji')), h('div', { class: 'mono-row' }, monoText, dots)),
      status,
      fileInput));

  await openDialog({ title: t('iconOfTitle', node.title || hostOf(url)), body, submitLabel: t('done'), cancelLabel: null, wide: true });
}
