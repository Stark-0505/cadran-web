// Pages côte à côte (un onglet = une page), avec défilement horizontal aimanté façon Vivaldi.
// Le trackpad fait défiler nativement ; un clic sur un onglet (ou les flèches) lance une animation
// maîtrisée. La pastille de l'onglet actif et la hauteur de la zone suivent le défilement.
import { h } from './util.js';

const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');
export const prefersReducedMotion = () => reduceMotion.matches;

/** Courbe CSS cubic-bezier(x1, y1, x2, y2) en JavaScript (x est inversé par dichotomie). */
function cubicBezier(x1, y1, x2, y2) {
  const at = (a, b, t) => ((1 + 3 * a - 3 * b) * t + 3 * b - 6 * a) * t * t + 3 * a * t;
  return (p) => {
    let lo = 0;
    let hi = 1;
    for (let k = 0; k < 20; k++) {
      const mid = (lo + hi) / 2;
      if (at(x1, x2, mid) < p) lo = mid;
      else hi = mid;
    }
    return at(y1, y2, (lo + hi) / 2);
  };
}

// Changement d'onglet : départ souple mais rapide, arrivée tout en douceur, sans rebond.
const ease = cubicBezier(0.25, 0.1, 0.25, 1);
/** Durée selon le nombre de pages à traverser (le défilement natif prenait plus d'une seconde). */
const durationFor = (pages) => Math.min(700, 350 + 100 * pages);

/**
 *  nav      : barre des onglets (on y fait glisser la pastille de l'onglet actif)
 *  onActive : la page affichée change (dès la mi-parcours d'un glissement)
 *  onSettle : le défilement est terminé
 */
export function createPager({ nav, onActive, onSettle }) {
  const el = h('div', { class: 'pager' });
  const indicator = h('span', { class: 'tab-indicator', 'aria-hidden': 'true' });
  const pages = new Map(); // identifiant d'onglet -> page
  let ids = [];
  let active = -1;
  let anim = null; // défilement animé en cours : { id, raf }
  let settleTimer = null;
  let lastWidth = 0;

  // Largeur exacte (au sous-pixel près) : c'est aussi le pas entre deux pages aimantées.
  const width = () => el.getBoundingClientRect().width || 1;
  const position = () => el.scrollLeft / width();

  // Une page change de hauteur (dossier ouvert, favori ajouté…) : on réajuste.
  const resizeObserver = new ResizeObserver(() => layout());

  // La zone change de largeur (fenêtre redimensionnée, barre de défilement qui apparaît…) :
  // on recale tout de suite la page affichée, pour que l'aimantation n'ait rien à rattraper.
  new ResizeObserver(() => {
    const w = width();
    if (!el.isConnected || w <= 1 || Math.abs(w - lastWidth) < 0.5) return;
    lastWidth = w;
    if (anim || active < 0) return;
    el.scrollLeft = active * w;
    layout();
  }).observe(el);

  /** Crée, retire et ordonne les pages. Renvoie true si des pages existantes ont changé de place. */
  function setPages(next) {
    const reordered = ids.some((id, i) => next.includes(id) && next.indexOf(id) !== i);
    for (const [id, page] of pages) {
      if (next.includes(id)) continue;
      resizeObserver.unobserve(page);
      page.remove();
      pages.delete(id);
    }
    next.forEach((id, i) => {
      let page = pages.get(id);
      if (!page) {
        page = h('div', { class: 'page', dataset: { group: id } });
        pages.set(id, page);
        resizeObserver.observe(page);
      }
      if (el.children[i] !== page) el.insertBefore(page, el.children[i] || null);
    });
    ids = [...next];
    if (active >= ids.length) active = ids.length - 1;
    return reordered;
  }

  function markActive() {
    ids.forEach((id, i) => { pages.get(id).inert = i !== active; });
  }

  function setActive(i) {
    if (i === active || ids[i] === undefined) return;
    active = i;
    markActive();
    onActive(ids[i]);
  }

  /** Hauteur et pastille, interpolées entre les deux pages visibles (défilement au trackpad). */
  function layout() {
    if (!ids.length || anim) return; // pendant une animation, c'est elle qui les place
    let x = Math.max(0, Math.min(position(), ids.length - 1));
    if (Math.abs(x - Math.round(x)) < 0.002) x = Math.round(x); // défilement arrondi au pixel
    const i = Math.floor(x);
    const t = x - i;
    const a = pages.get(ids[i]);
    const b = pages.get(ids[Math.min(i + 1, ids.length - 1)]);
    const ha = a.offsetHeight;
    const hb = b.offsetHeight;
    el.style.height = `${Math.round(ha + (hb - ha) * t)}px`;
    moveIndicator(x);
  }

  /** Place la pastille pour une position de défilement (en pages, fractions comprises). */
  function moveIndicator(x) {
    const tabs = nav.querySelectorAll('.group-tab[data-group]');
    if (!tabs.length) return;
    if (indicator.parentElement !== nav) nav.prepend(indicator);
    const i = Math.max(0, Math.min(Math.floor(x), tabs.length - 1));
    const t = Math.max(0, Math.min(x - i, 1));
    const a = tabs[i];
    const b = tabs[Math.min(i + 1, tabs.length - 1)];
    const lerp = (p, q) => p + (q - p) * t;
    indicator.style.width = `${lerp(a.offsetWidth, b.offsetWidth)}px`;
    indicator.style.height = `${a.offsetHeight}px`;
    indicator.style.transform = `translate(${lerp(a.offsetLeft, b.offsetLeft)}px, ${lerp(a.offsetTop, b.offsetTop)}px)`;
  }

  function settle() {
    clearTimeout(settleTimer);
    if (anim) return;
    const i = Math.round(position());
    if (ids[i] === undefined) return;
    setActive(i);
    layout();
    onSettle(ids[i]);
  }

  el.addEventListener('scroll', () => {
    if (anim) return;
    layout();
    // Glissement au trackpad : la page change à mi-parcours.
    setActive(Math.round(position()));
    clearTimeout(settleTimer);
    settleTimer = setTimeout(settle, 180);
  }, { passive: true });
  el.addEventListener('scrollend', () => { if (!anim) settle(); });

  /** Arrête l'animation en cours ; l'aimantation native reprend la main. */
  function stop() {
    if (!anim) return;
    cancelAnimationFrame(anim.raf);
    anim = null;
    el.classList.remove('animating');
  }

  /**
   * Fait défiler jusqu'à la page d'un onglet. L'aimantation est coupée pendant le trajet
   * (sinon elle se bat avec l'animation) et rétablie une fois la page exactement en place ;
   * la hauteur va directement de la page de départ à celle d'arrivée, au même rythme.
   */
  function show(id, { smooth = true } = {}) {
    const i = ids.indexOf(id);
    if (i < 0) return;
    setActive(i);
    markActive();
    if (anim?.id === id) return; // déjà en route vers cette page (double clic…)
    // Autre onglet choisi en cours de route : on repart d'où l'on est, l'aimantation restant coupée.
    if (anim) cancelAnimationFrame(anim.raf);
    clearTimeout(settleTimer);
    const from = position();
    const distance = Math.abs(i - from);
    if (distance < 0.002 || !smooth || reduceMotion.matches || document.hidden) {
      anim = null;
      el.scrollLeft = i * width();
      el.classList.remove('animating');
      layout();
      onSettle(id);
      return;
    }
    const heightFrom = el.offsetHeight;
    const duration = durationFor(distance);
    const start = performance.now();
    el.classList.remove('resizing');
    el.classList.add('animating');
    const step = (now) => {
      const p = Math.min(1, (now - start) / duration);
      const k = ease(p);
      const x = p < 1 ? from + (i - from) * k : i;
      // Lectures d'abord, écritures ensuite : pas de mise en page forcée à chaque image.
      const w = width();
      const heightTo = pages.get(id)?.offsetHeight ?? heightFrom;
      moveIndicator(x);
      el.scrollLeft = x * w;
      el.style.height = `${Math.round(heightFrom + (heightTo - heightFrom) * k)}px`;
      if (p < 1) {
        anim.raf = requestAnimationFrame(step);
        return;
      }
      stop();
      settle();
    };
    anim = { id, raf: requestAnimationFrame(step) };
  }

  // L'utilisateur reprend la main pendant un changement d'onglet (glissement horizontal) : on le laisse faire.
  el.addEventListener('wheel', (e) => { if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) stop(); }, { passive: true });
  el.addEventListener('touchstart', stop, { passive: true });

  /** La hauteur de la page affichée a changé : on suit, en douceur si demandé. */
  function refresh({ animate = false } = {}) {
    if (anim) return;
    if (animate && !reduceMotion.matches) {
      el.classList.add('resizing');
      clearTimeout(refresh.timer);
      refresh.timer = setTimeout(() => el.classList.remove('resizing'), 450);
    }
    layout();
  }

  return { el, setPages, show, layout: refresh, page: (id) => pages.get(id) };
}
