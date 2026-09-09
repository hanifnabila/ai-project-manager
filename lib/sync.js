// Sinkronisasi offline-first: push outbox (LWW server) + pull inkremental
import {
  dbGet,
  dbPut,
  metaGet,
  metaSet,
  outboxAll,
  outboxRemove,
  T_PROGRESS,
  T_JADWAL_ACT,
  T_JADWAL_LOG,
} from './offlineStore';

export function isOnline() {
  return typeof navigator !== 'undefined' ? navigator.onLine !== false : true;
}

export function nowISO() {
  return new Date().toISOString();
}

// ── Push: kirim keluar antrean outbox berurutan ─────────────────────
async function pushOutbox() {
  const ops = (await outboxAll()).sort((a, b) => a.seq - b.seq);
  if (ops.length === 0) return { pushed: 0 };

  let pushed = 0;
  for (const op of ops) {
    try {
      const res = await fetch(op.endpoint, {
        method: op.method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(op.body),
      });
      if (!res.ok) {
        // 4xx = invalid, buang agar tidak macet selamanya; 5xx = coba lagi
        if (res.status >= 500) break;
        await outboxRemove([op.seq]);
        continue;
      }
      const json = await res.json().catch(() => null);
      if (json && json.success && json.data) {
        await dbPut(op.table, Array.isArray(json.data) ? json.data[0] : json.data);
      }
      await outboxRemove([op.seq]);
      pushed++;
    } catch {
      break; // offline/network error -> hentikan, sisakan antrean
    }
  }
  return { pushed };
}

// ── Pull: ambil perubahan sejak kursor per tabel ────────────────────
async function pullTable(table) {
  const last = (await metaGet(`lastSync_${table}`))?.value || '';
  let res;
  try {
    res = await fetch(`/api/sync-pull?table=${table}&since=${encodeURIComponent(last)}`);
  } catch {
    return 0; // offline
  }
  if (!res.ok) return 0;

  const json = await res.json().catch(() => null);
  if (!json || !json.success) return 0;

  const rows = Array.isArray(json.rows) ? json.rows : [];
  const pendingIds = new Set(
    (await outboxAll())
      .filter((o) => o.table === table && o.body && o.body.id)
      .map((o) => o.body.id)
  );

  let changed = 0;
  for (const row of rows) {
    if (pendingIds.has(row.id)) continue; // jangan timpa yang masih menunggu push
    const local = await dbGet(table, row.id);
    if (
      local &&
      local.updated_at &&
      row.updated_at &&
      new Date(local.updated_at) > new Date(row.updated_at)
    ) {
      continue; // perubahan lokal lebih baru (LWW)
    }
    await dbPut(table, row);
    changed++;
  }

  if (json.cursor) {
    await metaSet(`lastSync_${table}`, json.cursor);
  }
  return changed;
}

// ── Sinkronisasi penuh ───────────────────────────────────────────────
export async function syncAll() {
  if (!isOnline()) {
    return { ok: false, online: false, error: 'offline' };
  }
  try {
    const { pushed } = await pushOutbox();
    const changed = {};
    for (const table of [T_PROGRESS, T_JADWAL_ACT, T_JADWAL_LOG]) {
      changed[table] = await pullTable(table);
    }
    return { ok: true, online: true, pushed, changed };
  } catch (err) {
    return { ok: false, online: true, error: err.message };
  }
}

export async function pendingCount() {
  try {
    return (await outboxAll()).length;
  } catch {
    return 0;
  }
}