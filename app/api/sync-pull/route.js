import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const TABLE_MAP = {
  'progress_logs': 'progress_logs',
  'jadwal_activities': 'jadwal_activities',
  'jadwal_logs': 'jadwal_logs',
};

export async function GET(request) {
  try {
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
      return NextResponse.json({ success: false, error: 'Supabase environment variables not configured' }, { status: 500 });
    }

    const { searchParams } = new URL(request.url);
    const table = searchParams.get('table');
    const since = searchParams.get('since') || '';

    if (!table || !TABLE_MAP[table]) {
      return NextResponse.json({ success: false, error: 'Tabel tidak dikenal' }, { status: 400 });
    }

    const sinceDate = typeof since === 'string' && !Number.isNaN(Date.parse(since))
      ? new Date(since).toISOString()
      : new Date(0).toISOString();

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    );

    const { data, error } = await supabase
      .from(table)
      .select('*')
      .gt('updated_at', sinceDate)
      .order('updated_at', { ascending: true })
      .limit(5000);

    if (error) throw error;

    return NextResponse.json({
      success: true,
      rows: data || [],
      cursor: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error in sync-pull:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}