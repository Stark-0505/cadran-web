// Réglages : stockés dans chrome.storage.local, synchronisés entre onglets ouverts.

export const DEFAULTS = {
  version: 1,
  /** Dossiers affichés en onglets : { id, folderId, path: [titres], label } */
  groups: [],
  activeGroup: null,
  /** Sous-dossier ouvert dans chaque onglet, retrouvé au prochain nouvel onglet : { [id d'onglet]: id de dossier } */
  openFolders: {},
  appearance: {
    tileStyle: 'icons', // 'icons' | 'cards'
    iconSize: 72,
    maxColumns: 8,
    showTitles: true,
    showAddTile: true,
    tabsOnHover: false, // onglets de dossiers visibles seulement au survol
    folderPreview: 4, // 4 (2×2) | 9 (3×3)
    openIn: 'current', // 'current' | 'tab'
    textColor: 'auto', // 'auto' | 'light' | 'dark'
    theme: 'auto', // thème des panneaux : 'auto' | 'light' | 'dark'
  },
  wallpaper: {
    type: 'gradient', // 'gradient' | 'color' | 'image'
    gradient: 'aurore',
    color: '#1c1c1e',
    imageId: null,
    rotate: 'off', // 'off' | 'tab' | 'day'
    blur: 0,
    dim: 10,
    dark: null, // variante affichée quand le système est en thème sombre (mêmes champs), ou null
  },
  /**
   * hour12 : null = format de la langue, true = 12 h, false = 24 h
   * style : 'digital' (digits) | 'analog' (hands) ; seconds : second hand on the analog clock
   */
  clock: { show: true, hour12: null, showDate: true, greeting: true, name: '', style: 'digital', seconds: true },
  search: { show: true, engine: 'browser' },
  sections: { topSites: false, recentlyClosed: false },
  icons: { fetchSites: true, promptDismissed: false },
};

let settings = structuredClone(DEFAULTS);
let lastJson = JSON.stringify(settings);
const listeners = new Set();

const isPlain = (v) => v && typeof v === 'object' && !Array.isArray(v);

/** Fusion profonde : les objets sont fusionnés, les tableaux remplacés. */
export function merge(base, over) {
  if (!isPlain(over)) return over === undefined ? base : over;
  const out = { ...base };
  for (const [k, v] of Object.entries(over)) {
    out[k] = isPlain(base?.[k]) && isPlain(v) ? merge(base[k], v) : v;
  }
  return out;
}

const withDefaults = (stored) => merge(structuredClone(DEFAULTS), stored || {});

export async function loadSettings() {
  const { settings: stored } = await chrome.storage.local.get('settings');
  settings = withDefaults(stored);
  lastJson = JSON.stringify(settings);

  // Un autre onglet Cadran a modifié les réglages : on suit.
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local' || !changes.settings) return;
    const next = withDefaults(changes.settings.newValue);
    const json = JSON.stringify(next);
    if (json === lastJson) return;
    const prev = settings;
    settings = next;
    lastJson = json;
    emit(prev, 'external');
  });
  return settings;
}

export const getSettings = () => settings;

/** Fond à afficher pour un onglet : le sien s'il en a un, sinon le fond par défaut. */
export function wallpaperFor(s, groupId) {
  return s.groups.find((g) => g.id === groupId)?.wallpaper || s.wallpaper;
}

/** Les onglets sans leur fond : pour savoir si l'affichage des onglets doit être refait. */
export const groupsLayout = (groups) => groups.map(({ wallpaper, ...rest }) => ({ ...rest, ownWallpaper: !!wallpaper }));

let saveTimer = null;
function flushSave() {
  if (saveTimer === null) return;
  clearTimeout(saveTimer);
  saveTimer = null;
  chrome.storage.local.set({ settings });
}
function scheduleSave() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(flushSave, 250);
}
// Onglet fermé ou masqué juste après une modification : on enregistre tout de suite.
addEventListener('pagehide', flushSave);
document.addEventListener('visibilitychange', () => { if (document.hidden) flushSave(); });

/** Modifie les réglages via une fonction qui reçoit une copie modifiable. */
export function updateSettings(mutate) {
  const prev = settings;
  const next = structuredClone(settings);
  mutate(next);
  const json = JSON.stringify(next);
  if (json === lastJson) return;
  settings = next;
  lastJson = json;
  emit(prev, 'local');
  scheduleSave();
}

/** Remplace tous les réglages (import d'une sauvegarde, réinitialisation). */
export function replaceSettings(data) {
  updateSettings((s) => {
    for (const k of Object.keys(s)) delete s[k];
    Object.assign(s, withDefaults(data));
  });
}

function emit(prev, source) {
  for (const fn of listeners) {
    try { fn(settings, prev, source); } catch (e) { console.error(e); }
  }
}

export function onSettingsChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

// ---------- Cache de premier affichage (lu par boot.js) ----------
export function saveBoot(patch) {
  try {
    const cur = JSON.parse(localStorage.getItem('cadran.boot') || '{}');
    const next = { ...cur, ...patch };
    if (patch.attrs) next.attrs = { ...cur.attrs, ...patch.attrs };
    if (patch.vars) next.vars = { ...cur.vars, ...patch.vars };
    if (patch.byScheme) next.byScheme = { ...cur.byScheme, ...patch.byScheme };
    localStorage.setItem('cadran.boot', JSON.stringify(next));
  } catch {
    /* quota ou stockage indisponible : sans conséquence */
  }
}
