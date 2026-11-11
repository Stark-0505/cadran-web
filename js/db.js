// Mini-surcouche IndexedDB : icônes des sites, icônes personnalisées, fonds d'écran.

const DB_NAME = 'cadran';
const DB_VERSION = 1;
const STORES = ['siteIcons', 'customIcons', 'wallpapers'];

let dbPromise = null;

function open() {
  dbPromise ??= new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      for (const name of STORES) if (!db.objectStoreNames.contains(name)) db.createObjectStore(name);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

async function run(store, mode, fn) {
  const db = await open();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, mode);
    const req = fn(tx.objectStore(store));
    tx.oncomplete = () => resolve(req ? req.result : undefined);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

export const db = {
  get: (store, key) => run(store, 'readonly', (s) => s.get(key)),
  put: (store, key, value) => run(store, 'readwrite', (s) => s.put(value, key)),
  del: (store, key) => run(store, 'readwrite', (s) => s.delete(key)),
  clear: (store) => run(store, 'readwrite', (s) => s.clear()),
  keys: (store) => run(store, 'readonly', (s) => s.getAllKeys()),
  count: (store) => run(store, 'readonly', (s) => s.count()),
  /** Toutes les paires [clé, valeur] d'un magasin. */
  async entries(store) {
    const d = await open();
    return new Promise((resolve, reject) => {
      const out = [];
      const tx = d.transaction(store, 'readonly');
      const req = tx.objectStore(store).openCursor();
      req.onsuccess = () => {
        const cur = req.result;
        if (cur) {
          out.push([cur.key, cur.value]);
          cur.continue();
        }
      };
      tx.oncomplete = () => resolve(out);
      tx.onerror = () => reject(tx.error);
    });
  },
};
