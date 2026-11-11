// Cadran+ : les fonctions payantes (fond par onglet, images qui changent seules), l'offre faite
// aux premiers utilisateurs et les clés de licence vendues via Polar. La clé n'est vérifiée
// qu'une fois, à l'activation : rien d'autre ne quitte le navigateur.
import { PLUS_CONFIG as CONFIG } from './plus-config.js';
import { LOCALE } from './i18n.js';

const EMPTY = { installedAt: null, license: null };
let state = { ...EMPTY };
let previewing = false;
const listeners = new Set();

// ---------- État ----------
export async function loadPlus() {
  const { plus } = await chrome.storage.local.get('plus');
  state = { ...EMPTY, ...plus };
  // Date d'installation (notée par sw.js) : c'est elle qui décide de l'offre aux premiers utilisateurs.
  if (!state.installedAt) await save({ installedAt: Date.now() });

  // Clé activée ou retirée depuis un autre onglet Cadran : on suit.
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local' || !changes.plus) return;
    const next = { ...EMPTY, ...changes.plus.newValue };
    if (JSON.stringify(next) === JSON.stringify(state)) return;
    state = next;
    emit();
  });
}

function save(patch) {
  state = { ...state, ...patch };
  emit();
  return chrome.storage.local.set({ plus: state });
}

function emit() {
  for (const fn of listeners) {
    try { fn(); } catch (e) { console.error(e); }
  }
}

export function onPlusChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

// ---------- Droits ----------
const salesDate = () => Date.parse(CONFIG.salesOpenAt || '');

/**
 * Essai de la vente sur son propre navigateur, avant l'ouverture : dans la console de la page Cadran,
 * localStorage.setItem('cadran.plusTest', '1') puis recharger (removeItem pour revenir). Cadran se
 * comporte alors comme pour un nouvel utilisateur après l'ouverture : cela ne peut que retirer Cadran+.
 */
const testing = () => {
  try { return localStorage.getItem('cadran.plusTest') === '1'; } catch { return false; }
};

/** Ventes ouvertes : lien de paiement et organisation Polar renseignés, et date atteinte (ou essai). */
export const salesOpen = () => !!CONFIG.checkoutUrl && !!CONFIG.organizationId && (testing() || Date.now() >= salesDate());

/** Installé avant l'ouverture des ventes : Cadran+ est offert, à vie. */
const isFounder = () => !salesOpen() || (!testing() && state.installedAt < salesDate());

export const hasPlus = () => previewing || isFounder() || !!state.license;

/** 'licensed' (clé activée), 'founder' (offert), 'preview' (essai sur cette page) ou 'free'. */
export function plusStatus() {
  if (state.license) return 'licensed';
  if (isFounder()) return 'founder';
  return previewing ? 'preview' : 'free';
}

export const isPreviewing = () => plusStatus() === 'preview';

/** Essai : les fonctions Cadran+ s'appliquent sur cette page, jusqu'à sa fermeture. */
export function startPreview() {
  previewing = true;
  emit();
}

// ---------- Ce qui s'affiche ----------
/** Fond propre d'un onglet, s'il s'affiche : sans Cadran+, tous les onglets prennent le fond par défaut. */
export const ownWallpaper = (g) => (hasPlus() && g?.wallpaper) || null;

/** Réglages de fond tels qu'ils s'affichent : sans Cadran+, l'image ne change pas toute seule. */
export const shownWallpaper = (ws) => (ws.rotate === 'off' || hasPlus() ? ws : { ...ws, rotate: 'off' });

// ---------- Achat ----------
export function priceLabel() {
  const { amount, currency } = CONFIG.price;
  return new Intl.NumberFormat(LOCALE, { style: 'currency', currency, minimumFractionDigits: Number.isInteger(amount) ? 0 : 2 }).format(amount);
}

export const openCheckout = () => chrome.tabs.create({ url: CONFIG.checkoutUrl });
export const portalUrl = () => CONFIG.portalUrl || null;

/** Clé activée, telle qu'on peut l'afficher (masquée). */
export function licenseLabel() {
  const lic = state.license;
  if (!lic) return '';
  return lic.displayKey || (lic.key.length > 10 ? `${lic.key.slice(0, 4)}…${lic.key.slice(-4)}` : lic.key);
}

// ---------- Clés de licence (API publique de Polar, sans authentification) ----------
export class PlusError extends Error {
  constructor(code) {
    super(code);
    this.code = code; // 'invalid' | 'limit' | 'network' (et 'refused', traité ici)
  }
}

async function polar(action, body) {
  const base = CONFIG.sandbox ? 'https://sandbox-api.polar.sh' : 'https://api.polar.sh';
  let res;
  try {
    res = await fetch(`${base}/v1/customer-portal/license-keys/${action}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ organization_id: CONFIG.organizationId, ...body }),
      credentials: 'omit',
      referrerPolicy: 'no-referrer',
      signal: AbortSignal.timeout(15000),
    });
  } catch {
    throw new PlusError('network');
  }
  if (res.ok) return res.status === 204 ? null : res.json();
  // 403 : activation refusée ; 404, 422 : clé inconnue, révoquée, expirée ou mal saisie.
  throw new PlusError(res.status === 403 ? 'refused' : res.status === 404 || res.status === 422 ? 'invalid' : 'network');
}

/** Nom de l'appareil, visible par l'acheteur dans son espace client Polar. */
function deviceLabel() {
  const ua = navigator.userAgentData;
  const brand = ua?.brands?.map((b) => b.brand).find((b) => !/brand|chromium/i.test(b)) || 'Chromium';
  return ['Cadran', brand, ua?.platform].filter(Boolean).join(' · ');
}

/** Active une clé sur cet appareil ; en cas d'échec, lève une PlusError (invalid, limit ou network). */
export async function activateLicense(input) {
  const key = String(input || '').trim();
  if (!key || !CONFIG.organizationId) throw new PlusError('invalid');
  let activationId = null;
  let info;
  try {
    const activation = await polar('activate', { key, label: deviceLabel() });
    activationId = activation.id;
    info = activation.license_key;
  } catch (e) {
    if (e.code !== 'refused') throw e;
    // Activation refusée : soit la clé n'en demande pas (on la valide simplement), soit elle a
    // atteint son nombre d'appareils, soit elle est révoquée (la validation échoue alors aussi).
    info = await polar('validate', { key });
    if (info.limit_activations) throw new PlusError('limit');
  }
  await save({ license: { key, activationId, displayKey: info?.display_key || null, activatedAt: Date.now() } });
}

/** Retire Cadran+ de cet appareil et libère son activation chez Polar. */
export async function removeLicense() {
  const lic = state.license;
  if (!lic) return;
  if (lic.activationId) {
    try {
      await polar('deactivate', { key: lic.key, activation_id: lic.activationId });
    } catch (e) {
      // Réseau coupé : on garde la clé pour réessayer. Activation introuvable : rien à libérer.
      if (e.code === 'network') throw e;
    }
  }
  await save({ license: null });
}

// ---------- Sauvegarde ----------
/**
 * Ce que la sauvegarde emporte : la date d'installation, qui garde l'offre aux premiers
 * utilisateurs sur un autre appareil. Pas la clé : l'acheteur la retrouve dans son e-mail.
 */
export const plusBackup = () => ({ since: state.installedAt });

export async function restorePlusBackup(data) {
  const since = Number(data?.since);
  if (since > 0 && since < state.installedAt) await save({ installedAt: since });
}
