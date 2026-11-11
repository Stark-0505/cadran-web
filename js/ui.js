// Composants d'interface génériques : notifications, menu contextuel, boîtes de dialogue.
import { h, icon } from './util.js';
import { t } from './i18n.js';

const layer = () => document.getElementById('layer');

// ---------- Notification ----------
let toastEl = null;
let toastTimer = null;

export function toast(message, { action, onAction, timeout = 5000 } = {}) {
  hideToast(true);
  const el = h('div', { class: 'toast', role: 'status' }, h('span', null, message));
  if (action) {
    el.append(h('button', {
      class: 'toast-action',
      type: 'button',
      onclick: () => {
        hideToast();
        onAction?.();
      },
    }, action));
  }
  layer().append(el);
  toastEl = el;
  requestAnimationFrame(() => el.classList.add('show'));
  toastTimer = setTimeout(hideToast, timeout);
}

function hideToast(immediate = false) {
  clearTimeout(toastTimer);
  const el = toastEl;
  toastEl = null;
  if (!el) return;
  if (immediate) return el.remove();
  el.classList.remove('show');
  setTimeout(() => el.remove(), 250);
}

// ---------- Menu contextuel ----------
let menuEl = null;

/** items : [{ label, icon, hint, danger, disabled, checked, onClick } | '-' | { header }] */
export function showMenu(x, y, items) {
  hideMenu();
  const el = h('div', { class: 'menu glass-panel', role: 'menu' });
  for (const it of items) {
    if (!it) continue;
    if (it === '-') {
      if (el.lastElementChild && !el.lastElementChild.classList.contains('menu-sep')) el.append(h('div', { class: 'menu-sep' }));
      continue;
    }
    if (it.header) {
      el.append(h('div', { class: 'menu-header' }, it.header));
      continue;
    }
    const btn = h('button', {
      type: 'button',
      class: 'menu-item' + (it.danger ? ' danger' : '') + (it.checked ? ' checked' : ''),
      role: 'menuitem',
      disabled: !!it.disabled,
    }, it.icon ? icon(it.icon, 16) : h('i', { style: 'width:16px' }), h('span', null, it.label), it.hint && h('span', { class: 'menu-hint' }, it.hint));
    btn.addEventListener('click', (e) => {
      hideMenu();
      it.onClick?.(e);
    });
    el.append(btn);
  }
  if (el.lastElementChild?.classList.contains('menu-sep')) el.lastElementChild.remove();
  layer().append(el);

  const r = el.getBoundingClientRect();
  el.style.left = `${Math.max(8, Math.min(x, innerWidth - r.width - 8))}px`;
  el.style.top = `${y + r.height > innerHeight - 8 ? Math.max(8, y - r.height) : y}px`;
  menuEl = el;
  el.querySelector('.menu-item:not(:disabled)')?.focus({ preventScroll: true });

  setTimeout(() => {
    if (menuEl !== el) return;
    addEventListener('pointerdown', onOutside, true);
    addEventListener('keydown', onMenuKey, true);
    addEventListener('blur', hideMenu);
    addEventListener('resize', hideMenu);
    addEventListener('wheel', hideMenu, { passive: true });
  });
}

function onOutside(e) {
  if (menuEl && !menuEl.contains(e.target)) hideMenu();
}

function onMenuKey(e) {
  if (!menuEl) return;
  const items = [...menuEl.querySelectorAll('.menu-item:not(:disabled)')];
  const i = items.indexOf(document.activeElement);
  if (e.key === 'Escape') {
    e.preventDefault();
    e.stopPropagation();
    hideMenu();
  } else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
    e.preventDefault();
    e.stopPropagation();
    const n = items.length;
    const next = e.key === 'ArrowDown' ? (i + 1) % n : (i - 1 + n) % n;
    items[next]?.focus();
  }
}

export function hideMenu() {
  if (!menuEl) return;
  menuEl.remove();
  menuEl = null;
  removeEventListener('pointerdown', onOutside, true);
  removeEventListener('keydown', onMenuKey, true);
  removeEventListener('blur', hideMenu);
  removeEventListener('resize', hideMenu);
  removeEventListener('wheel', hideMenu);
}

export const isMenuOpen = () => !!menuEl;

// ---------- Boîtes de dialogue ----------
let openDialogs = 0;
export const isDialogOpen = () => openDialogs > 0;

/**
 * Ouvre une boîte de dialogue. Résout avec les valeurs des champs (ou true),
 * ou null si elle est annulée.
 *  fields : [{ name, label, type, value, placeholder, help, required }]
 *  onSubmit(values) : peut lever une erreur (affichée) ou renvoyer false pour rester ouverte.
 */
export function openDialog({ title, text, body, fields = [], submitLabel = t('save'), cancelLabel = t('cancel'), danger = false, wide = false, onSubmit }) {
  return new Promise((resolve) => {
    const form = h('form', { class: 'dialog glass-panel' + (wide ? ' wide' : ''), novalidate: true });
    form.append(h('h2', null, title));
    if (text) form.append(h('p', { class: 'dialog-text' }, text));
    const inputs = {};
    const content = h('div', { class: 'dialog-body' });
    for (const f of fields) {
      const input = h('input', {
        name: f.name,
        type: f.type || 'text',
        value: f.value ?? '',
        placeholder: f.placeholder || '',
        autocomplete: 'off',
        spellcheck: 'false',
      });
      inputs[f.name] = input;
      content.append(h('label', { class: 'field' }, h('span', null, f.label), input, f.help && h('small', null, f.help)));
    }
    if (body) content.append(body);
    if (content.childNodes.length) form.append(content);

    const error = h('div', { class: 'dialog-error', hidden: true });
    const submit = h('button', { type: 'submit', class: 'btn ' + (danger ? 'danger' : 'primary') }, submitLabel);
    form.append(error, h('div', { class: 'dialog-actions' },
      cancelLabel && h('button', { type: 'button', class: 'btn', onclick: () => close(null) }, cancelLabel),
      submit));

    const backdrop = h('div', { class: 'backdrop' }, form);
    backdrop.addEventListener('pointerdown', (e) => {
      if (e.target === backdrop) close(null);
    });
    form.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        close(null);
      }
    });
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const values = Object.fromEntries(Object.entries(inputs).map(([k, el]) => [k, el.value.trim()]));
      for (const f of fields) {
        if (f.required && !values[f.name]) {
          showError(t('fieldRequired', f.label));
          inputs[f.name].focus();
          return;
        }
      }
      if (onSubmit) {
        submit.disabled = true;
        try {
          if ((await onSubmit(values)) === false) {
            submit.disabled = false;
            return;
          }
        } catch (err) {
          submit.disabled = false;
          showError(err.message || String(err));
          return;
        }
      }
      close(fields.length ? values : true);
    });

    function showError(msg) {
      error.textContent = msg;
      error.hidden = false;
    }
    let closed = false;
    function close(v) {
      if (closed) return;
      closed = true;
      openDialogs--;
      backdrop.classList.remove('show');
      setTimeout(() => backdrop.remove(), 170);
      resolve(v);
    }

    openDialogs++;
    hideMenu();
    layer().append(backdrop);
    requestAnimationFrame(() => backdrop.classList.add('show'));
    const first = form.querySelector('input:not([type=hidden]):not([type=file]), textarea');
    (first || submit).focus();
    if (first?.select) first.select();
  });
}

export async function confirmDialog({ title, text, confirmLabel = t('confirm'), danger = false }) {
  return !!(await openDialog({ title, text, submitLabel: confirmLabel, danger }));
}
