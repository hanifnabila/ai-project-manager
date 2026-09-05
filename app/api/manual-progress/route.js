import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function POST(request) {
  try {
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
      return NextResponse.json({ success: false, error: 'Supabase environment variables not configured' }, { status: 500 });
    }

    const body = await request.json();
    const { project_name, status, summary } = body || {};

    if (!project_name?.trim() || !status || !summary?.trim()) {
      return NextResponse.json(
        { success: false, error: 'Kolom Proyek, Status, dan Ringkasan wajib diisi.' },
        { status: 400 }
      );
    }

    let tasks = body.tasks;
    if (typeof tasks === 'string') {
      tasks = tasks.split('\n').map(t => t.trim()).filter(Boolean);
    }
    if (!Array.isArray(tasks)) tasks = [];

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    );

    const { data, error } = await supabase
      .from('progress_logs')
      .insert([
        {
          project_name: project_name.trim(),
          status,
          summary: summary.trim(),
          tasks,
          raw_text: body.raw_text?.trim() || '',
        }
      ])
      .select();

    if (error) throw error;

    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error('Error saving manual progress:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}