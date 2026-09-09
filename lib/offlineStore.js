// IndexedDB: cache data offline + outbox sinkronisasi (entitas AGPM Offline)
const DB_NAME = 'apm-offline';
const DB_VERSION = 1;

export const T_PROGRESS = 'progress_logs';
export const T_JADWAL_ACT = 'jadwal_activities';
export const T_JADWAL_LOG = 'jadwal_logs';

const ROW_STORES = [T_PROGRESS, T_JADWAL_ACT, T_JADWAL_LOG];
const OUTBOX = 'outbox';
const META = 'meta';

let dbPromise = null;

function openDB() {
  if (typeof indexedDB === 'undefined') {
    return Promise.reject(new Error('IndexedDB tidak didukung di browser ini.'));
  }
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        for (const name of ROW_STORES) {
          if (!db.objectStoreNames.contains(name)) {
            const os = db.createObjectStore(name, { keyPath: 'id' });
            os.createIndex('updated_at', 'updated_at');
          }
        }
        if (!db.objectStoreNames.contains(OUTBOX)) {
          db.createObjectStore(OUTBOX, { keyPath: 'seq', autoIncrement: true });
        }
        if (!db.objectStoreNames.contains(META)) {
          db.createObjectStore(META, { keyPath: 'key' });
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

function run(req) {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

// ── Cache baris ──────────────────────────────────────────────────────
export async function dbGet(table, id) {
  const { store } = await tx(table, 'readonly');
  const res = await run(store.get(id));
  return res === undefined ? null : res;
}

export async function dbPut(table, row) {
  if (!row || !row.id) return false;
  const { store, t } = await tx(table, 'readwrite');
  await run(store.put(row));
  await new Promise((resolve) => { t.oncomplete = resolve; });
  return true;
}

export async function dbBulkPut(table, rows) {
  if (!Array.isArray(rows) || rows.length === 0) return;
  const { store, t } = await tx(table, 'readwrite');
  rows.forEach((row) => { if (row && row.id) store.put(row); });
  await new Promise((resolve) => { t.oncomplete = resolve; });
}

export async function dbAll(table) {
  const { store } = await tx(table, 'readonly');
  return (await run(store.getAll())) || [];
}

export async function dbRemove(table, id) {
  const { store, t } = await tx(table, 'readwrite');
  await run(store.delete(id));
  await new Promise((resolve) => { t.oncomplete = resolve; });
  return true;
}

export async function dbClear(table) {
  const { store, t } = await tx(table, 'readwrite');
  await run(store.clear());
  await new Promise((resolve) => { t.oncomplete = resolve; });
  return true;
}

// ── Outbox sinkronisasi ──────────────────────────────────────────────
// op: { table, endpoint, method, body, localUpdatedAt }
export async function outboxPush(op) {
  const { store, t } = await tx(OUTBOX, 'readwrite');
  await run(store.add({ ...op, queuedAt: new Date().toISOString() }));
  await new Promise((resolve) => { t.oncomplete = resolve; });
  return true;
}

export async function outboxAll() {
  const { store } = await tx(OUTBOX, 'readonly');
  return (await run(store.getAll())) || [];
}

export async function outboxRemove(seqs) {
  if (!Array.isArray(seqs) || seqs.length === 0) return;
  const { store, t } = await tx(OUTBOX, 'readwrite');
  seqs.forEach((seq) => store.delete(seq));
  await new Promise((resolve) => { t.oncomplete = resolve; });
  return true;
}

// ── Meta (device id, lastSync cursor) ────────────────────────────────
export async function metaGet(key) {
  const { store } = await tx(META, 'readonly');
  const res = await run(store.get(key));
  return res === undefined ? null : res;
}

export async function metaSet(key, value) {
  const { store, t } = await tx(META, 'readwrite');
  await run(store.put({ key, value }));
  await new Promise((resolve) => { t.oncomplete = resolve; });
  return true;
}

export async function getDeviceId() {
  let rec = await metaGet('deviceId');
  if (rec && rec.value) return rec.value;
  const id = globalThis.crypto?.randomUUID?.() || `dev-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  await metaSet('deviceId', id);
  return id;
}