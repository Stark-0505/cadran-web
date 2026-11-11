// Horloge analogique : index en bâtons, aiguilles noires, et trotteuse rouge qui fait
// le tour en 58,5 s puis attend la minute pile pour repartir, au moment où l'aiguille des minutes
// saute d'un cran.
import { h } from './util.js';

const NS = 'http://www.w3.org/2000/svg';
const INK = '#161616';
const RED = '#e2231a';

function svg(tag, attrs = {}, ...children) {
  const el = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  el.append(...children);
  return el;
}

// Chaque aiguille est un calque à part (même repère 200 × 200) que l'on fait tourner en entier :
// la rotation est alors confiée au compositeur, sans redessiner la page.
const layer = (cls, ...children) => svg('svg', { class: cls, viewBox: '0 0 200 200', 'aria-hidden': 'true' }, ...children);

function face() {
  const ticks = [];
  for (let i = 0; i < 60; i++) {
    const hour = i % 5 === 0;
    const w = hour ? 7 : 2.2;
    ticks.push(svg('rect', { x: 100 - w / 2, y: 9, width: w, height: hour ? 24 : 7, transform: `rotate(${i * 6} 100 100)` }));
  }
  return layer('face',
    svg('circle', { cx: 100, cy: 100, r: 100, fill: '#1e1e20' }),
    svg('circle', { cx: 100, cy: 100, r: 95, fill: '#fbfbf9' }),
    svg('g', { fill: INK }, ...ticks));
}

/** Balayage de la trotteuse : un tour en 58,5 s, arrêt sur 12 jusqu'à la minute suivante. */
const SWEEP = [{ transform: 'rotate(0deg)' }, { transform: 'rotate(360deg)', offset: 58.5 / 60 }, { transform: 'rotate(360deg)' }];

/** Angle qui ne recule jamais : en passant 12, l'aiguille continue au lieu de refaire un tour à l'envers. */
function ahead(prev, deg) {
  if (prev == null) return deg;
  let a = deg + 360 * Math.floor(prev / 360);
  if (a < prev - 0.01) a += 360;
  return a;
}

export function createAnalogClock() {
  const hourHand = layer('hand hour', svg('path', { d: 'M94.5 122 L105.5 122 L104.2 38 L95.8 38 Z', fill: INK }));
  const minuteHand = layer('hand minute', svg('path', { d: 'M95.3 122 L104.7 122 L103.3 11 L96.7 11 Z', fill: INK }));
  // Trotteuse : une simple aiguille rouge, de la piste des minutes à son contrepoids.
  const secondHand = layer('hand second', svg('g', { fill: RED },
    svg('rect', { x: 99, y: 14, width: 2, height: 117 }),
    svg('circle', { cx: 100, cy: 100, r: 3.2 })));
  const el = h('div', { class: 'analog', role: 'img' }, face(), hourHand, minuteHand, secondHand);
  let hourDeg = null;
  let minuteDeg = null;
  let sweep = null;

  /**
   * Place les aiguilles. animate : la minute vient de changer, l'aiguille saute d'un cran
   * (sinon, premier affichage ou retour sur l'onglet : elles se placent sans bouger).
   */
  function update(now, { seconds = true, animate = false } = {}) {
    const m = now.getMinutes();
    minuteDeg = ahead(minuteDeg, m * 6);
    hourDeg = ahead(hourDeg, (now.getHours() % 12) * 30 + m * 0.5);
    el.toggleAttribute('data-jump', animate);
    minuteHand.style.transform = `rotate(${minuteDeg}deg)`;
    hourHand.style.transform = `rotate(${hourDeg}deg)`;

    secondHand.toggleAttribute('hidden', !seconds);
    if (!seconds) return stop();
    sweep ??= secondHand.animate(SWEEP, { duration: 60000, iterations: Infinity });
    // Recalée sur l'horloge du système à chaque mise à jour : elle ne dérive jamais.
    sweep.currentTime = Date.now() % 60000;
  }

  /** Arrête la trotteuse (horloge masquée ou autre style) : plus aucune image à calculer. */
  function stop() {
    sweep?.cancel();
    sweep = null;
  }

  return { el, update, stop };
}
