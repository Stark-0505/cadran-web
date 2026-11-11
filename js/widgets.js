// Horloge + salutation, et sections « Sites fréquents » / « Récemment fermés ».
import { h, icon, $ } from './util.js';
import { t, tp, LOCALE } from './i18n.js';
import { getSettings } from './store.js';
import { linkTile } from './grid.js';
import { createAnalogClock } from './analog-clock.js';
import { hasPlus } from './plus.js';

// ---------- Horloge ----------
let clockTimer = null;
let dial = null; // horloge analogique, créée au premier affichage

function greeting(hour) {
  if (hour >= 5 && hour < 12) return t('greetingMorning');
  if (hour >= 12 && hour < 18) return t('greetingAfternoon');
  if (hour >= 18 && hour < 23) return t('greetingEvening');
  return t('greetingNight');
}

/** Heure au format de la langue (ou 12 h / 24 h si choisi) ; « AM / PM » en plus petit. */
function formatTime(now, hour12) {
  const pref = hour12 == null ? {} : { hour12 };
  const is12 = new Intl.DateTimeFormat(LOCALE, { hour: 'numeric', ...pref }).resolvedOptions().hour12;
  const fmt = new Intl.DateTimeFormat(LOCALE, { hour: is12 ? 'numeric' : '2-digit', minute: '2-digit', hour12: !!is12 });
  return fmt.formatToParts(now).map((p) => (p.type === 'dayPeriod' ? h('span', { class: 'ampm' }, p.value) : p.value));
}

/** Affiche l'horloge ; tick : appel de la minute pile (l'aiguille des minutes saute alors d'un cran). */
export function renderClock({ tick = false } = {}) {
  const c = getSettings().clock;
  const root = $('#clock');
  // Horloge analogique : Cadran+ (sans lui, l'horloge numérique reprend sa place).
  const analog = c.show && c.style === 'analog' && hasPlus();
  root.hidden = !c.show;
  clearTimeout(clockTimer);
  if (!analog) dial?.stop();
  if (!c.show) return;
  const now = new Date();
  const time = formatTime(now, c.hour12);
  $('.time', root).hidden = analog;
  if (analog) {
    if (!dial) {
      dial = createAnalogClock();
      root.prepend(dial.el);
    }
    dial.el.hidden = false;
    dial.el.setAttribute('aria-label', time.map((p) => (typeof p === 'string' ? p : p.textContent)).join(''));
    dial.update(now, { seconds: c.seconds, animate: tick });
  } else {
    if (dial) dial.el.hidden = true;
    $('.time', root).replaceChildren(...time);
  }
  const date = new Intl.DateTimeFormat(LOCALE, { weekday: 'long', day: 'numeric', month: 'long' }).format(now);
  $('.date', root).textContent = c.showDate ? date.charAt(0).toLocaleUpperCase(LOCALE) + date.slice(1) : '';
  const name = c.name.trim();
  const hello = greeting(now.getHours());
  $('.greeting', root).textContent = c.greeting ? (name ? t('greetingWithName', hello, name) : hello) : '';
  // Mise à jour à la minute pile.
  clockTimer = setTimeout(() => renderClock({ tick: true }), 60000 - (now.getSeconds() * 1000 + now.getMilliseconds()) + 50);
}

// ---------- Sections complémentaires ----------
export const TOP_SITES_PERMS = { permissions: ['topSites'] };
export const RECENT_PERMS = { permissions: ['sessions', 'tabs'] };

const has = (perms) => chrome.permissions.contains(perms).catch(() => false);
let sessionsHooked = false;

function section(title, tiles) {
  const grid = h('div', { class: 'grid compact' }, tiles);
  return h('div', { class: 'extra-section' }, h('h2', { class: 'section-title' }, title), grid);
}

export async function renderExtras(container, { onRestore } = {}) {
  const s = getSettings();
  const out = [];
  const newTab = s.appearance.openIn === 'tab';
  const max = Math.max(4, Math.min(12, s.appearance.maxColumns + 2));

  if (s.sections.topSites && chrome.topSites && (await has(TOP_SITES_PERMS))) {
    const sites = (await chrome.topSites.get().catch(() => [])).slice(0, max);
    if (sites.length) out.push(section(t('topSites'), sites.map((x) => linkTile({ url: x.url, title: x.title }, { newTab }))));
  }

  if (s.sections.recentlyClosed && chrome.sessions && (await has(RECENT_PERMS))) {
    if (!sessionsHooked) {
      sessionsHooked = true;
      chrome.sessions.onChanged?.addListener(() => renderExtras(container, { onRestore }));
    }
    const entries = await chrome.sessions.getRecentlyClosed({ maxResults: 25 }).catch(() => []);
    const tiles = [];
    for (const e of entries) {
      if (tiles.length >= max) break;
      if (e.tab?.url && /^https?:/i.test(e.tab.url)) {
        const tile = linkTile({ url: e.tab.url, title: e.tab.title }, { newTab });
        tile.dataset.session = e.tab.sessionId;
        tiles.push(tile);
      } else if (e.window?.tabs?.length) {
        const count = tp('tabsCount', e.window.tabs.length);
        tiles.push(h('a', { class: 'tile item', href: '#', draggable: 'false', title: t('reopenWindow', count), dataset: { session: e.window.sessionId } },
          h('div', { class: 'plate window-plate' }, icon('window', 26, 1.8)),
          h('span', { class: 'label' }, count)));
      }
    }
    if (tiles.length) {
      const sec = section(t('recentlyClosed'), tiles);
      sec.addEventListener('click', (ev) => {
        const tile = ev.target.closest('[data-session]');
        if (!tile || ev.metaKey || ev.ctrlKey || ev.shiftKey) return;
        ev.preventDefault();
        onRestore?.(tile.dataset.session);
      });
      out.push(sec);
    }
  }
  container.replaceChildren(...out);
}
