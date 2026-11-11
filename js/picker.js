// Sélecteur de dossiers de favoris (arborescence avec filtre).
import { h, icon } from './util.js';
import { t, tp, LOCALE } from './i18n.js';
import { getRoot, countLinks, looksImported, pathTitles } from './bookmarks.js';
import { openDialog } from './ui.js';

/**
 * Ouvre le sélecteur. Résout avec la liste des identifiants choisis, ou null.
 *  multiple : sélection multiple (cases à cocher) ou simple.
 *  disabledIds : dossiers déjà affichés (grisés).
 */
export async function pickFolders({ title = t('chooseFolders'), multiple = true, disabledIds = [], selectedIds = [], submitLabel = t('add') } = {}) {
  const selected = new Set(selectedIds.map(String));
  const disabled = new Set(disabledIds.map(String));
  const expanded = new Set();

  // Déplie par défaut les dossiers de premier niveau et le chemin des dossiers déjà choisis.
  for (const top of getRoot().children || []) expanded.add(top.id);

  const filter = h('input', { class: 'input picker-filter', type: 'search', placeholder: t('filterFolders'), autocomplete: 'off', spellcheck: 'false' });
  const tree = h('div', { class: 'tree', role: 'tree' });
  const body = h('div', null, filter, tree);

  const hasSubfolders = (n) => (n.children || []).some((c) => !c.url);

  function row(n, depth, showPath = false) {
    const isDisabled = disabled.has(n.id);
    const isChecked = selected.has(n.id) || isDisabled;
    const count = countLinks(n.id);
    const twisty = h('button', {
      type: 'button',
      class: 'twisty' + (expanded.has(n.id) ? ' open' : '') + (hasSubfolders(n) && !showPath ? '' : ' none'),
      tabindex: -1,
      'aria-label': t('expand'),
      onclick: (e) => {
        e.stopPropagation();
        expanded.has(n.id) ? expanded.delete(n.id) : expanded.add(n.id);
        render();
      },
    }, icon('chevron', 14, 2.2));
    const titleBox = h('span', { class: 't-title' }, n.title || t('untitled'),
      showPath && h('span', { class: 't-path' }, pathTitles(n.parentId).join(' › ')));
    const el = h('div', {
      class: 'tree-row' + (isChecked ? ' checked' : '') + (isDisabled ? ' disabled' : ''),
      role: 'treeitem',
      style: { '--depth': showPath ? 0 : depth },
      title: isDisabled ? t('alreadyShown') : '',
    },
    twisty,
    h('input', { type: multiple ? 'checkbox' : 'radio', checked: isChecked, disabled: isDisabled, tabindex: -1 }),
    h('span', { class: 'folder-ico' }, icon('folder', 17)),
    titleBox,
    looksImported(n) && h('span', { class: 'tag' }, t('importedTag')),
    h('span', { class: 't-count' }, count ? tp('links', count) : t('emptyFolderShort')));
    el.addEventListener('click', () => {
      if (isDisabled) return;
      if (multiple) selected.has(n.id) ? selected.delete(n.id) : selected.add(n.id);
      else {
        selected.clear();
        selected.add(n.id);
      }
      render();
    });
    el.addEventListener('dblclick', () => {
      if (!multiple && !isDisabled) body.closest('form')?.requestSubmit();
    });
    return el;
  }

  function render() {
    const scroll = tree.scrollTop;
    tree.replaceChildren();
    const q = filter.value.trim().toLocaleLowerCase(LOCALE);
    if (q) {
      (function walk(n) {
        for (const c of n.children || []) {
          if (c.url) continue;
          if ((c.title || '').toLocaleLowerCase(LOCALE).includes(q)) tree.append(row(c, 0, true));
          walk(c);
        }
      })(getRoot());
      if (!tree.childElementCount) tree.append(h('p', { class: 'hint' }, t('noMatchingFolder')));
    } else {
      (function walk(n, depth) {
        for (const c of n.children || []) {
          if (c.url) continue;
          tree.append(row(c, depth));
          if (expanded.has(c.id)) walk(c, depth + 1);
        }
      })(getRoot(), 0);
    }
    tree.scrollTop = scroll;
  }

  filter.addEventListener('input', render);
  filter.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') e.preventDefault();
  });
  render();

  const ok = await openDialog({
    title,
    body,
    wide: true,
    submitLabel,
    onSubmit: () => {
      if (!selected.size) throw new Error(multiple ? t('selectAtLeastOneFolder') : t('selectAFolder'));
    },
  });
  return ok ? [...selected] : null;
}
