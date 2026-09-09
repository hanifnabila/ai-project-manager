import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

function getSupabase() {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return null;
  }
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
const TYPES = ['harian', 'mingguan', 'bulanan', 'sekali'];
const DAYS = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu'];

function isValidUuid(id) {
  return typeof id === 'string' && UUID_RE.test(id);
}

function normalizeBody(body) {
  const updates = {};

  if (typeof body.judul === 'string' && body.judul.trim()) {
    updates.judul = body.judul.trim();
  }
  if (body.keterangan !== undefined) {
    updates.keterangan = typeof body.keterangan === 'string' ? body.keterangan.trim() : null;
  }
  if (typeof body.tipe === 'string' && TYPES.includes(body.tipe)) {
    updates.tipe = body.tipe;
  }
  if (body.hari !== undefined) {
    updates.hari = Array.isArray(body.hari)
      ? body.hari.filter(h => DAYS.includes(h))
      : [];
  }
  if (body.hari_bulan !== undefined) {
    updates.hari_bulan = Array.isArray(body.hari_bulan)
      ? [...new Set(body.hari_bulan.map(Number).filter(n => Number.isInteger(n) && n >= 1 && n <= 31))]
      : [];
  }
  if (body.tanggal !== undefined) {
    updates.tanggal =
      typeof body.tanggal === 'string' && DATE_RE.test(body.tanggal)
        ? body.tanggal
        : null;
  }
  if (body.jam !== undefined) {
    updates.jam =
      typeof body.jam === 'string' && TIME_RE.test(body.jam)
        ? body.jam
        : null;
  }
  if (typeof body.aktif === 'boolean') {
    updates.aktif = body.aktif;
  }

  return updates;
}

export async function POST(request) {
  try {
    const supabase = getSupabase();
    if (!supabase) {
      return NextResponse.json({ success: false, error: 'Supabase environment variables not configured' }, { status: 500 });
    }

    const body = await request.json();
    const updates = normalizeBody(body);

    if (!updates.judul) {
      return NextResponse.json({ success: false, error: 'Judul kegiatan wajib diisi' }, { status: 400 });
    }

    // id & created_at boleh datang dari klien (dibuat saat offline)
    if (isValidUuid(body.id)) updates.id = body.id;
    if (typeof body.created_at === 'string' && !Number.isNaN(Date.parse(body.created_at))) {
      updates.created_at = body.created_at;
    }

    const { data, error } = await supabase.from('jadwal_activities').insert(updates).select();

    if (error) throw error;

    return NextResponse.json({ success: true, data: data[0] });
  } catch (error) {
    console.error('Error creating jadwal activity:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function PATCH(request) {
  try {
    const supabase = getSupabase();
    if (!supabase) {
      return NextResponse.json({ success: false, error: 'Supabase environment variables not configured' }, { status: 500 });
    }

    const body = await request.json();
    const { id } = body;

    if (!isValidUuid(id)) {
      return NextResponse.json({ success: false, error: 'ID kegiatan tidak valid' }, { status: 400 });
    }

    const updates = normalizeBody(body);

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ success: false, error: 'Tidak ada field yang diubah' }, { status: 400 });
    }

    updates.updated_at = new Date().toISOString();
    updates.deleted_at = null;

    const { data, error } = await supabase
      .from('jadwal_activities')
      .update(updates)
      .eq('id', id)
      .select();

    if (error) throw error;

    return NextResponse.json({ success: true, data: data[0] });
  } catch (error) {
    console.error('Error updating jadwal activity:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function DELETE(request) {
  try {
    const supabase = getSupabase();
    if (!supabase) {
      return NextResponse.json({ success: false, error: 'Supabase environment variables not configured' }, { status: 500 });
    }

    const { id } = await request.json();
    if (!isValidUuid(id)) {
      return NextResponse.json({ success: false, error: 'ID kegiatan tidak valid' }, { status: 400 });
    }

    // Hapus permanen dari database (dan jadwal_logs terkait)
    const { error } = await supabase
      .from('jadwal_activities')
      .delete()
      .eq('id', id);

    if (!error) {
      await supabase.from('jadwal_logs').delete().eq('activity_id', id);
    }

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting jadwal activity:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}