// API offline: cache-first untuk baca, queue+lokal-apply untuk tulis
import { dbAll, dbBulkPut, dbGet, dbPut, dbRemove, outboxPush, metaSet } from './offlineStore';
import { isOnline, nowISO } from './sync';

export async function cacheRows(table, rows) {
  await dbBulkPut(table, rows);
  return rows;
}

export async function readCache(table) {
  const rows = await dbAll(table);
  return rows.filter((r) => !r.deleted_at);
}

// Coba jaringan bila online; fallback ke cache bila gagal/offline.
export async function networkOrCache(table, network, opts = {}) {
  if (isOnline()) {
    try {
      const rows = await network();
      if (Array.isArray(rows)) {
        await cacheRows(table, rows);
        return { rows, fromCache: false };
      }
    } catch {
      // jatuh ke cache
    }
  }
  const rows = await readCache(table);
  return { rows, fromCache: true };
}

export async function enqueue(table, endpoint, method, body) {
  await outboxPush({ table, endpoint, method, body, localUpdatedAt: nowISO() });
}

export async function applyLocal(table, row) {
  if (!row) return;
  await dbPut(table, row);
}

export async function localUpsert(table, id, fields) {
  const existing = (await dbGet(table, id)) || { id, created_at: nowISO() };
  const merged = { ...existing, ...fields, updated_at: nowISO() };
  await dbPut(table, merged);
  return merged;
}

export async function localSoftDelete(table, id) {
  const existing = (await dbGet(table, id)) || { id };
  const merged = { ...existing, deleted_at: nowISO(), updated_at: nowISO() };
  await dbPut(table, merged);
  return merged;
}

export async function evictLocal(table, id) {
  await dbRemove(table, id);
}

export async function rememberCursor(table, cursor) {
  if (cursor) await metaSet(`lastSync_${table}`, cursor);
}