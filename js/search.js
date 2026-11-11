// Barre de recherche : recherche web + filtre instantané de tous les favoris.
import { h, icon, looksLikeUrl, normalizeUrl, prettyUrl, debounce, $ } from './util.js';
import { t, tp, LOCALE } from './i18n.js';
import { searchBookmarks, pathTitles, countLinks } from './bookmarks.js';
import { paintPlate } from './icons.js';
import { getSettings, updateSettings } from './store.js';
import { showMenu } from './ui.js';

export const ENGINES = [
  { id: 'browser' },
  { id: 'brave', name: 'Brave Search', url: 'https://search.brave.com/search?q=%s' },
  { id: 'duckduckgo', name: 'DuckDuckGo', url: 'https://duckduckgo.com/?q=%s' },
  { id: 'google', name: 'Google', url: 'https://www.google.com/search?q=%s' },
  { id: 'qwant', name: 'Qwant', url: 'https://www.qwant.com/?q=%s' },
  { id: 'ecosia', name: 'Ecosia', url: 'https://www.ecosia.org/search?q=%s' },
  { id: 'startpage', name: 'Startpage', url: 'https://www.startpage.com/sp/search?query=%s' },
  { id: 'bing', name: 'Bing', url: 'https://www.bing.com/search?q=%s' },
  { id: 'kagi', name: 'Kagi', url: 'https://kagi.com/search?q=%s' },
  { id: 'perplexity', name: 'Perplexity', url: 'https://www.perplexity.ai/search?q=%s' },
];

export const engineName = (e) => (e.id === 'browser' ? t('engineBrowserDefault') : e.name);
const engine = () => ENGINES.find((e) => e.id === getSettings().search.engine) || ENGINES[0];
const lower = (s) => s.toLocaleLowerCase(LOCALE);

let els;
let results = []; // [{ el, run(newTab) }]
let resultsQuery = '';
let selected = 0;
let seq = 0;
let ctx; // { openUrl, openFolder }

export function initSearch(context) {
  ctx = context;
  const root = $('#search');
  els = {
    root,
    form: $('.search-box', root),
    input: $('input', root),
    list: $('.search-results', root),
    engineBtn: $('.engine-btn', root),
  };
  els.engineBtn.append(icon('search', 19, 2));
  els.engineBtn.addEventListener('click', () => {
    const r = els.engineBtn.getBoundingClientRect();
    showMenu(r.left, r.bottom + 6, [
      { header: t('searchEngineHeader') },
      ...ENGINES.map((e) => ({
        label: engineName(e),
        checked: e.id === engine().id,
        onClick: () => {
          updateSettings((s) => { s.search.engine = e.id; });
          els.input.focus();
        },
      })),
    ]);
  });

  const update = debounce(refresh, 70);
  els.input.addEventListener('input', update);
  els.input.addEventListener('focus', () => { if (els.input.value.trim()) refresh(); });
  els.input.addEventListener('keydown', onKey);
  els.form.addEventListener('submit', (e) => e.preventDefault());
  document.addEventListener('pointerdown', (e) => {
    if (!els.root.contains(e.target)) hideResults();
  });
  applySearchSettings();
}

export function applySearchSettings() {
  const s = getSettings().search;
  els.root.hidden = !s.show;
  const e = engine();
  els.input.placeholder = e.id === 'browser' ? t('searchPlaceholder') : t('searchPlaceholderWith', e.name);
}

export const focusSearch = () => {
  if (els.root.hidden) return false;
  els.input.focus();
  els.input.select();
  return true;
};
export const hasQuery = () => !!els?.input.value.trim();
export function clearSearch() {
  els.input.value = '';
  hideResults();
}

function hideResults() {
  els.list.hidden = true;
  els.list.replaceChildren();
  results = [];
}

function webSearch(q, newTab) {
  const e = engine();
  if (e.id === 'browser' && chrome.search?.query) {
    return chrome.search.query({ text: q, disposition: newTab ? 'NEW_TAB' : 'CURRENT_TAB' });
  }
  const url = (e.url || ENGINES[1].url).replace('%s', encodeURIComponent(q));
  ctx.openUrl(url, newTab ? 'tab' : 'current');
}

/** Surligne les occurrences de la requête. */
function highlight(text, q) {
  const out = h('span', { class: 'r-title' });
  const haystack = lower(text);
  const needle = lower(q);
  let i = 0;
  let at = needle ? haystack.indexOf(needle) : -1;
  while (at !== -1 && needle) {
    out.append(text.slice(i, at), h('mark', null, text.slice(at, at + needle.length)));
    i = at + needle.length;
    at = haystack.indexOf(needle, i);
  }
  out.append(text.slice(i));
  return out;
}

async function refresh() {
  const q = els.input.value.trim();
  const mySeq = ++seq;
  if (!q) return hideResults();

  let found = [];
  try { found = await searchBookmarks(q); } catch { found = []; }
  if (mySeq !== seq) return; // une frappe plus récente a pris le relais

  const ql = lower(q);
  const score = (n) => {
    const title = lower(n.title || '');
    if (title.startsWith(ql)) return 0;
    if (title.includes(ql)) return 1;
    return 2;
  };
  const folders = found.filter((n) => !n.url).sort((a, b) => score(a) - score(b)).slice(0, 3);
  const links = found.filter((n) => n.url && !/^javascript:/i.test(n.url)).sort((a, b) => score(a) - score(b)).slice(0, 8);

  results = [];
  const frag = document.createDocumentFragment();
  const add = (el, run) => {
    const index = results.length;
    results.push({ el, run });
    el.addEventListener('mousemove', () => select(index));
    el.addEventListener('click', (e) => {
      e.preventDefault();
      run(e.metaKey || e.ctrlKey || e.button === 1);
    });
    frag.append(el);
  };

  const e = engine();
  const searchRow = h('div', { class: 'result', role: 'option' },
    h('span', { class: 'r-glyph' }, icon('search', 17, 2)),
    h('span', { class: 'r-text' }, h('span', { class: 'r-title' }, t('searchFor', q)), h('span', { class: 'r-sub' }, e.id === 'browser' ? t('defaultEngineShort') : e.name)),
    h('span', { class: 'r-key' }, '↵'));
  const goRow = looksLikeUrl(q) && h('div', { class: 'result', role: 'option' },
    h('span', { class: 'r-glyph' }, icon('arrow', 17, 2)),
    h('span', { class: 'r-text' }, h('span', { class: 'r-title' }, t('goTo', q)), h('span', { class: 'r-sub' }, t('openThisAddress'))));

  if (goRow) add(goRow, (nt) => ctx.openUrl(normalizeUrl(q), nt ? 'tab' : 'current'));
  add(searchRow, (nt) => webSearch(q, nt));

  if (folders.length || links.length) frag.append(h('div', { class: 'results-label' }, t('bookmarks')));
  for (const f of folders) {
    const row = h('div', { class: 'result', role: 'option' },
      h('span', { class: 'r-glyph' }, icon('folder', 17, 2)),
      h('span', { class: 'r-text' }, highlight(f.title || t('untitled'), q),
        h('span', { class: 'r-sub' }, [pathTitles(f.parentId).join(' › '), tp('links', countLinks(f.id))].filter(Boolean).join(' · '))));
    add(row, () => {
      clearSearch();
      ctx.openFolder(f.id);
    });
  }
  for (const n of links) {
    const plate = h('div', { class: 'plate' });
    paintPlate(plate, n);
    const row = h('a', { class: 'result', role: 'option', href: n.url, draggable: 'false' },
      h('span', { class: 'r-icon' }, plate),
      h('span', { class: 'r-text' }, highlight(n.title || prettyUrl(n.url), q),
        h('span', { class: 'r-sub' }, [prettyUrl(n.url), pathTitles(n.parentId).slice(-1)[0]].filter(Boolean).join(' · '))));
    add(row, (nt) => ctx.openUrl(n.url, nt ? 'tab' : 'current'));
  }

  els.list.replaceChildren(frag);
  els.list.hidden = false;
  resultsQuery = q;
  select(0);
}

function select(i) {
  if (!results.length) return;
  selected = (i + results.length) % results.length;
  results.forEach((r, j) => r.el.classList.toggle('selected', j === selected));
  results[selected].el.scrollIntoView({ block: 'nearest' });
}

function onKey(e) {
  if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
    if (els.list.hidden) return;
    e.preventDefault();
    select(selected + (e.key === 'ArrowDown' ? 1 : -1));
  } else if (e.key === 'Enter') {
    e.preventDefault();
    const q = els.input.value.trim();
    if (!q) return;
    const newTab = e.metaKey || e.ctrlKey;
    // Résultats pas encore à jour (frappe rapide) : action par défaut sur la saisie actuelle.
    if (results[selected] && resultsQuery === q) results[selected].run(newTab);
    else if (looksLikeUrl(q)) ctx.openUrl(normalizeUrl(q), newTab ? 'tab' : 'current');
    else webSearch(q, newTab);
  } else if (e.key === 'Escape') {
    e.preventDefault();
    e.stopPropagation();
    if (els.input.value) clearSearch();
    else els.input.blur();
  }
}
