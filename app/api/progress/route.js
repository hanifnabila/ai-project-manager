import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

function getSupabase() {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return null;
  }
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isValidUuid(id) {
  return typeof id === 'string' && UUID_RE.test(id);
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
      return NextResponse.json({ success: false, error: 'ID catatan tidak valid' }, { status: 400 });
    }

    const updates = {};
    if (typeof body.project_name === 'string' && body.project_name.trim()) {
      updates.project_name = body.project_name.trim();
    }
    if (typeof body.status === 'string' && body.status) {
      updates.status = body.status;
    }
    if (typeof body.summary === 'string' && body.summary.trim()) {
      updates.summary = body.summary.trim();
    }
    if (body.tasks !== undefined) {
      let tasks = body.tasks;
      if (typeof tasks === 'string') {
        tasks = tasks.split('\n').map(t => t.trim()).filter(Boolean);
      }
      updates.tasks = Array.isArray(tasks) ? tasks : [];
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ success: false, error: 'Tidak ada field yang diubah' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('progress_logs')
      .update(updates)
      .eq('id', id)
      .select();

    if (error) throw error;

    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error('Error updating progress:', error);
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
      return NextResponse.json({ success: false, error: 'ID catatan tidak valid' }, { status: 400 });
    }

    const { error } = await supabase
      .from('progress_logs')
      .delete()
      .eq('id', id);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting progress:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}