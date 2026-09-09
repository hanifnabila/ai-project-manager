const DB_NAME = 'apm-local';
const DB_VERSION = 1;
const STORE = 'kv';

let dbPromise = null;

function openDB() {
  if (typeof indexedDB === 'undefined') {
    return Promise.reject(new Error('IndexedDB tidak didukung di browser ini.'));
  }
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        if (!req.result.objectStoreNames.contains(STORE)) {
          req.result.createObjectStore(STORE);
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }
  return dbPromise;
}

function tx(store, mode) {
  return openDB().then((db) => {
    const t = db.transaction(store, mode);
    return { t, store: t.objectStore(store) };
  });
}

export async function kvGet(key) {
  const { store } = await tx(STORE, 'readonly');
  return new Promise((resolve, reject) => {
    const req = store.get(key);
    req.onsuccess = () => resolve(req.result === undefined ? null : req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function kvSet(key, value) {
  const { store } = await tx(STORE, 'readwrite');
  return new Promise((resolve, reject) => {
    const req = store.put(value, key);
    req.onsuccess = () => resolve(true);
    req.onerror = () => reject(req.error);
  });
}

export async function kvDel(key) {
  const { store, t } = await tx(STORE, 'readwrite');
  return new Promise((resolve, reject) => {
    const req = store.delete(key);
    req.onsuccess = () => resolve(true);
    req.onerror = () => reject(req.error);
  });
}

export async function kvAll() {
  const { store } = await tx(STORE, 'readonly');
  return new Promise((resolve, reject) => {
    const req = store.getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
  });
}