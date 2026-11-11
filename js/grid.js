// Construction des tuiles et glisser-déposer (synchronisé avec les vrais favoris).
import { h, icon, hostOf } from './util.js';
import { t, tp } from './i18n.js';
import { paintPlate } from './icons.js';
import { countLinks } from './bookmarks.js';
import { hideMenu } from './ui.js';

export const DRAG_MIME = 'application/x-cadran-bookmark';

/** Tuile de lien. item : { id?, url, title } */
export function linkTile(item, { draggable = true, newTab = false, badge } = {}) {
  const isJs = /^javascript:/i.test(item.url);
  const tile = h('a', {
    class: 'tile item link',
    href: isJs ? '#' : item.url,
    draggable: draggable ? 'true' : 'false',
    title: `${item.title || hostOf(item.url)}\n${item.url.length > 120 ? item.url.slice(0, 118) + '…' : item.url}`,
    target: newTab && !isJs ? '_blank' : null,
    rel: newTab ? 'noopener' : null,
    dataset: { id: item.id ?? '', url: item.url },
  });
  const plate = h('div', { class: 'plate' });
  paintPlate(plate, item);
  tile.append(plate, h('span', { class: 'label' }, item.title || hostOf(item.url) || item.url));
  if (badge) tile.append(h('span', { class: 'badge' }, badge));
  return tile;
}

/** Tuile de dossier avec aperçu des premiers éléments (façon iOS). */
export function folderTile(node, { previewCount = 4, draggable = true } = {}) {
  const tile = h('a', {
    class: 'tile item folder',
    href: '#',
    draggable: draggable ? 'true' : 'false',
    title: node.title || t('untitled'),
    dataset: { id: node.id, folder: '1' },
  });
  const plate = h('div', { class: 'plate folder-plate' });
  const kids = (node.children || []).slice(0, previewCount);
  if (!kids.length) plate.append(h('div', { class: 'folder-empty' }, icon('folder', 24, 1.6)));
  for (const k of kids) {
    const mini = h('div', { class: 'plate mini' });
    if (k.url) paintPlate(mini, k);
    else {
      mini.classList.add('mini-folder');
      mini.append(icon('folder', 12, 2));
    }
    plate.append(mini);
  }
  const n = countLinks(node.id);
  tile.append(plate, h('span', { class: 'label' }, node.title || t('untitled')), h('span', { class: 'count', title: tp('links', n) }, n));
  return tile;
}

export function addTile() {
  return h('button', { class: 'tile add', type: 'button', title: t('addSiteOrFolder'), dataset: { action: 'add' } },
    h('div', { class: 'plate add-plate' }, icon('plus', 26, 2)),
    h('span', { class: 'label' }, t('add')));
}

// ---------- Glisser-déposer ----------
let current = null; // glisser en cours, partagé avec les cibles externes (onglets, fil d'Ariane)
export const currentDrag = () => current;
const dropZones = new WeakMap(); // cibles externes → { folderId, onDrop }, pour le glisser au doigt

const items = (grid) => [...grid.querySelectorAll(':scope > .tile.item')];

/** Anime le réarrangement (technique FLIP). */
function flip(grid, mutate) {
  const els = items(grid);
  const before = new Map(els.map((el) => [el, [el.offsetLeft, el.offsetTop]]));
  mutate();
  for (const el of els) {
    const [x, y] = before.get(el);
    const dx = x - el.offsetLeft;
    const dy = y - el.offsetTop;
    if (dx || dy) {
      el.animate([{ transform: `translate(${dx}px, ${dy}px)` }, { transform: 'none' }], { duration: 220, easing: 'cubic-bezier(.2,.8,.2,1)' });
    }
  }
}

/** Élément avant lequel insérer, d'après la position du pointeur (null = à la fin). */
function slotAt(grid, x, y, skip) {
  const rect = grid.getBoundingClientRect();
  let best = null;
  let bestDist = Infinity;
  for (const t of items(grid)) {
    if (t === skip) continue;
    const cx = rect.left + t.offsetLeft + t.offsetWidth / 2;
    const cy = rect.top + t.offsetTop + t.offsetHeight / 2;
    const d = Math.hypot(cx - x, (cy - y) * 1.6);
    if (d < bestDist) {
      bestDist = d;
      best = { t, cx };
    }
  }
  if (!best) return null;
  if (x < best.cx) return best.t;
  let next = best.t.nextElementSibling;
  if (next === skip) next = next.nextElementSibling;
  return next?.classList.contains('item') ? next : null;
}

/** e : un événement ou simplement { clientX, clientY }. */
function inCenter(e, tile) {
  const r = tile.querySelector('.plate').getBoundingClientRect();
  const mx = r.width * 0.22;
  const my = r.height * 0.22;
  return e.clientX > r.left + mx && e.clientX < r.right - mx && e.clientY > r.top + my && e.clientY < r.bottom - my;
}

function linkFromTransfer(dt) {
  const uri = (dt.getData('text/uri-list') || '').split(/\r?\n/).find((l) => l && !l.startsWith('#'));
  const url = uri || (dt.getData('text/plain') || '').trim();
  if (!/^https?:\/\//i.test(url)) return null;
  let title = '';
  const html = dt.getData('text/html');
  if (html) title = new DOMParser().parseFromString(html, 'text/html').body.textContent.trim().slice(0, 200);
  return { url, title: title && title !== url ? title : hostOf(url) };
}

/**
 * Active le tri par glisser-déposer sur une grille de favoris.
 *  onMove(id, index)          – réordonne dans le dossier affiché (index au sens de chrome.bookmarks.move)
 *  onMoveInto(id, folderId)   – dépose dans un sous-dossier
 *  onDropLink({url, title}, index) – lien déposé depuis l'extérieur
 *  onLongPress(tile, x, y)    – appui long au doigt : menu de la tuile, à afficher en (x, y)
 */
export function enableSorting(grid, { onMove, onMoveInto, onDropLink, onCancel, onLongPress }) {
  let into = null;
  const setInto = (tile) => {
    if (into === tile) return;
    into?.classList.remove('drop-into');
    into = tile;
    into?.classList.add('drop-into');
  };

  grid.addEventListener('dragstart', (e) => {
    // Au doigt, c'est enableTouchSorting qui s'en charge.
    if (touchPress) {
      e.preventDefault();
      return;
    }
    const tile = e.target.closest?.('.tile.item');
    if (!tile || tile.parentElement !== grid || tile.getAttribute('draggable') !== 'true') return;
    const index = items(grid).indexOf(tile);
    current = { id: tile.dataset.id, el: tile, from: index, dropped: false, isFolder: !!tile.dataset.folder };
    e.dataTransfer.effectAllowed = 'all';
    e.dataTransfer.setData(DRAG_MIME, tile.dataset.id);
    if (tile.dataset.url) {
      e.dataTransfer.setData('text/uri-list', tile.dataset.url);
      e.dataTransfer.setData('text/plain', tile.dataset.url);
    }
    const plate = tile.querySelector('.plate');
    if (plate) e.dataTransfer.setDragImage(plate, plate.offsetWidth / 2, plate.offsetHeight / 2);
    requestAnimationFrame(() => tile.classList.add('dragging'));
    document.body.classList.add('is-dragging');
  });

  grid.addEventListener('dragover', (e) => {
    const types = [...e.dataTransfer.types];
    if (current && current.el.parentElement === grid) {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      const target = e.target.closest?.('.tile.item');
      if (target && target !== current.el && target.dataset.folder && inCenter(e, target)) {
        setInto(target);
        return;
      }
      setInto(null);
      const before = slotAt(grid, e.clientX, e.clientY, current.el);
      const ref = before || grid.querySelector(':scope > .tile.add');
      if (ref === current.el || current.el.nextElementSibling === ref) return;
      flip(grid, () => grid.insertBefore(current.el, ref));
    } else if (!current && !types.includes('Files') && (types.includes('text/uri-list') || types.includes('text/plain'))) {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'copy';
      grid.classList.add('drop-external');
    }
  });

  grid.addEventListener('dragleave', (e) => {
    if (!grid.contains(e.relatedTarget)) {
      grid.classList.remove('drop-external');
      setInto(null);
    }
  });

  grid.addEventListener('drop', (e) => {
    grid.classList.remove('drop-external');
    if (current && current.el.parentElement === grid) {
      e.preventDefault();
      current.dropped = true;
      const { id, el, from } = current;
      if (into) {
        const folderId = into.dataset.id;
        setInto(null);
        onMoveInto?.(id, folderId);
        return;
      }
      const to = items(grid).indexOf(el);
      // chrome.bookmarks.move attend la position avant retrait de l'élément.
      if (to !== from) onMove?.(id, to > from ? to + 1 : to);
      return;
    }
    if (!current && !e.dataTransfer.types.includes('Files')) {
      const link = linkFromTransfer(e.dataTransfer);
      if (!link) return;
      e.preventDefault();
      const before = slotAt(grid, e.clientX, e.clientY, null);
      onDropLink?.(link, before ? items(grid).indexOf(before) : undefined);
    }
  });

  grid.addEventListener('dragend', () => {
    const d = current;
    current = null;
    setInto(null);
    document.body.classList.remove('is-dragging');
    if (!d) return;
    d.el.classList.remove('dragging');
    if (!d.dropped) onCancel?.();
  });

  // ---------- Au doigt ----------
  // Le glisser-déposer du navigateur est absent ou peu fiable sur écran tactile, et un appui long
  // y ouvre le menu. On gère donc le geste nous-mêmes, comme sur l'écran d'accueil d'un téléphone :
  // l'appui long ouvre le menu de la tuile ; si le doigt bouge ensuite, le menu se ferme et la
  // tuile suit le doigt.
  let touchPress = null; // { tile, id, x, y, last, timer, armed, ghost, offX, offY, zone, raf }
  const LONG_PRESS = 400; // ms
  const SLOP = 10; // px tolérés avant l'appui long ; au-delà, c'est un défilement
  const LIFT = 8; // px à parcourir après l'appui long pour commencer à déplacer la tuile
  const EDGE = 72; // px près du haut ou du bas de la fenêtre où la page défile toute seule

  const ourTouch = (list) => [...list].find((p) => p.identifier === touchPress?.id);

  function arm() {
    if (!touchPress || touchPress.armed) return;
    clearTimeout(touchPress.timer);
    touchPress.armed = true;
    touchPress.tile.classList.add('pressed');
    const r = touchPress.tile.querySelector('.plate').getBoundingClientRect();
    onLongPress?.(touchPress.tile, r.left, r.bottom + 8);
  }

  function setZone(zone) {
    if (touchPress.zone === zone) return;
    touchPress.zone?.classList.remove('drop-target');
    touchPress.zone = zone;
    zone?.classList.add('drop-target');
  }

  function startTouchDrag() {
    const tile = touchPress.tile;
    hideMenu();
    tile.classList.remove('pressed');
    current = { id: tile.dataset.id, el: tile, from: items(grid).indexOf(tile), dropped: false, isFolder: !!tile.dataset.folder };
    const plate = tile.querySelector('.plate');
    // offsetWidth : la taille sans l'agrandissement de l'appui long, qui est encore en cours.
    const size = plate.offsetWidth;
    const r = plate.getBoundingClientRect();
    const ghost = plate.cloneNode(true);
    ghost.classList.add('touch-ghost');
    ghost.style.setProperty('--icon', `${size}px`);
    document.body.append(ghost);
    const offX = (touchPress.x - r.left) * (size / r.width);
    const offY = (touchPress.y - r.top) * (size / r.height);
    Object.assign(touchPress, { ghost, offX, offY });
    tile.classList.add('dragging');
    document.body.classList.add('is-dragging');
    touchPress.raf = requestAnimationFrame(autoScroll);
  }

  function moveTouchDrag(x, y) {
    touchPress.ghost.style.transform = `translate(${x - touchPress.offX}px, ${y - touchPress.offY}px) scale(1.08)`;
    const hit = document.elementFromPoint(x, y);
    // Onglet ou fil d'Ariane : on y range la tuile.
    const zone = hit?.closest('.drop-zone');
    if (zone && dropZones.get(zone)?.folderId !== current.id) {
      setInto(null);
      setZone(zone);
      return;
    }
    setZone(null);
    const target = hit?.closest('.tile.item');
    if (target && target !== current.el && target.parentElement === grid && target.dataset.folder && inCenter({ clientX: x, clientY: y }, target)) {
      setInto(target);
      return;
    }
    setInto(null);
    const g = grid.getBoundingClientRect();
    if (x < g.left - 40 || x > g.right + 40 || y < g.top - 40 || y > g.bottom + 40) return;
    const before = slotAt(grid, x, y, current.el);
    const ref = before || grid.querySelector(':scope > .tile.add');
    if (ref === current.el || current.el.nextElementSibling === ref) return;
    flip(grid, () => grid.insertBefore(current.el, ref));
  }

  // Doigt près du haut ou du bas de la fenêtre : la page défile, pour atteindre les tuiles cachées.
  function autoScroll() {
    if (!touchPress?.ghost) return;
    const [x, y] = touchPress.last;
    const v = y < EDGE ? -(EDGE - y) / 4 : y > innerHeight - EDGE ? (y - innerHeight + EDGE) / 4 : 0;
    if (v) {
      const before = scrollY;
      scrollBy(0, v);
      if (scrollY !== before) moveTouchDrag(x, y);
    }
    touchPress.raf = requestAnimationFrame(autoScroll);
  }

  function endTouchDrag(cancelled) {
    const d = current;
    const { ghost, zone } = touchPress;
    const folder = into;
    setZone(null);
    setInto(null);
    current = null;
    document.body.classList.remove('is-dragging');
    let landing = null;
    if (!cancelled && zone) {
      d.dropped = true;
      const { folderId, onDrop } = dropZones.get(zone);
      onDrop(d.id, folderId);
    } else if (!cancelled && folder) {
      d.dropped = true;
      onMoveInto?.(d.id, folder.dataset.id);
    } else if (!cancelled && d.el.parentElement === grid) {
      d.dropped = true;
      landing = d.el.querySelector('.plate').getBoundingClientRect();
      const to = items(grid).indexOf(d.el);
      // chrome.bookmarks.move attend la position avant retrait de l'élément.
      if (to !== d.from) onMove?.(d.id, to > d.from ? to + 1 : to);
    }
    // La copie rejoint la place de la tuile, ou s'efface si la tuile a quitté la grille.
    const end = landing
      ? { transform: `translate(${landing.left}px, ${landing.top}px)` }
      : { transform: `${ghost.style.transform} scale(.6)`, opacity: 0 };
    ghost.animate([end], { duration: 180, easing: 'cubic-bezier(.2,.8,.2,1)', fill: 'forwards' }).finished
      .catch(() => {})
      .then(() => {
        ghost.remove();
        d.el.classList.remove('dragging');
      });
    if (!d.dropped) onCancel?.();
  }

  function releaseTouch() {
    if (!touchPress) return;
    clearTimeout(touchPress.timer);
    cancelAnimationFrame(touchPress.raf);
    touchPress.tile.classList.remove('pressed');
    touchPress = null;
  }

  grid.addEventListener('touchstart', (e) => {
    if (touchPress || e.touches.length > 1) {
      // Second doigt : ce n'est plus un appui long (zoom, par exemple).
      if (touchPress && !current) releaseTouch();
      return;
    }
    const tile = e.target.closest?.('.tile.item');
    if (!tile || tile.parentElement !== grid) return;
    const p = e.changedTouches[0];
    touchPress = { tile, id: p.identifier, x: p.clientX, y: p.clientY, last: [p.clientX, p.clientY], armed: false };
    touchPress.timer = setTimeout(arm, LONG_PRESS);
  }, { passive: true });

  // Sur Android, l'appui long déclenche aussi le menu contextuel : c'est le nôtre qui s'affiche.
  grid.addEventListener('contextmenu', (e) => {
    if (!touchPress) return;
    e.preventDefault();
    e.stopPropagation();
    arm();
  });

  // Non passif : une fois l'appui long reconnu, le doigt déplace la tuile au lieu de faire défiler la page.
  grid.addEventListener('touchmove', (e) => {
    const p = ourTouch(e.changedTouches);
    if (!p) return;
    const x = p.clientX;
    const y = p.clientY;
    touchPress.last = [x, y];
    const moved = Math.hypot(x - touchPress.x, y - touchPress.y);
    if (!touchPress.armed) {
      if (moved > SLOP) releaseTouch();
      return;
    }
    if (e.cancelable) e.preventDefault();
    if (!current) {
      if (moved < LIFT || touchPress.tile.getAttribute('draggable') !== 'true') return;
      startTouchDrag();
    }
    moveTouchDrag(x, y);
  }, { passive: false });

  const onTouchEnd = (e) => {
    if (!ourTouch(e.changedTouches)) return;
    // Après un appui long, lever le doigt n'ouvre pas le lien.
    if (touchPress.armed && e.cancelable) e.preventDefault();
    if (current) endTouchDrag(e.type === 'touchcancel');
    releaseTouch();
  };
  grid.addEventListener('touchend', onTouchEnd, { passive: false });
  grid.addEventListener('touchcancel', onTouchEnd);
}

/** Fait d'un élément (onglet, fil d'Ariane) une cible de dépôt vers un dossier. */
export function makeDropTarget(el, folderId, onDrop) {
  if (folderId) {
    el.classList.add('drop-zone');
    dropZones.set(el, { folderId, onDrop });
  }
  el.addEventListener('dragover', (e) => {
    if (!current || !folderId || current.id === folderId) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    el.classList.add('drop-target');
  });
  el.addEventListener('dragleave', () => el.classList.remove('drop-target'));
  el.addEventListener('drop', (e) => {
    el.classList.remove('drop-target');
    if (!current || !folderId) return;
    e.preventDefault();
    current.dropped = true;
    onDrop(current.id, folderId);
  });
}
