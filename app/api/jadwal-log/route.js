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

function isValidUuid(id) {
  return typeof id === 'string' && UUID_RE.test(id);
}

export async function POST(request) {
  try {
    const supabase = getSupabase();
    if (!supabase) {
      return NextResponse.json({ success: false, error: 'Supabase environment variables not configured' }, { status: 500 });
    }

    const body = await request.json();
    const { activity_id, tanggal } = body;

    if (!isValidUuid(activity_id)) {
      return NextResponse.json({ success: false, error: 'ID kegiatan tidak valid' }, { status: 400 });
    }
    if (typeof tanggal !== 'string' || !DATE_RE.test(tanggal)) {
      return NextResponse.json({ success: false, error: 'Tanggal tidak valid' }, { status: 400 });
    }

    const selesai = body.selesai ? true : false;
    const catatan = typeof body.catatan === 'string' && body.catatan.trim() ? body.catatan.trim() : null;

    const { data, error } = await supabase
      .from('jadwal_logs')
      .upsert({ activity_id, tanggal, selesai, catatan, updated_at: new Date().toISOString() }, { onConflict: 'activity_id,tanggal' })
      .select();

    if (error) throw error;

    return NextResponse.json({ success: true, data: data[0] });
  } catch (error) {
    console.error('Error updating jadwal log:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}