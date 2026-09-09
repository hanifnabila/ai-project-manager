import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function GET() {
  try {
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
      return NextResponse.json({ success: false, error: 'Supabase environment variables not configured' }, { status: 500 });
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    );

    const { data, error } = await supabase
      .from('app_lock')
      .select('code_salt, code_hash, code_iterations, qa_question, qa_salt, qa_hash, qa_iterations, updated_at')
      .eq('id', true)
      .maybeSingle();

    if (error) throw error;

    const row = data || {};
    const code =
      row.code_salt && row.code_hash
        ? { salt: row.code_salt, hash: row.code_hash, iterations: row.code_iterations }
        : null;
    const qa =
      row.qa_salt && row.qa_hash
        ? { question: row.qa_question || null, salt: row.qa_salt, hash: row.qa_hash, iterations: row.qa_iterations }
        : null;

    return NextResponse.json({
      success: true,
      done: !!(code || qa),
      hasCode: !!code,
      hasQA: !!qa,
      question: qa ? qa.question : null,
      code,
      qa,
      updatedAt: row.updated_at || null,
    });
  } catch (error) {
    console.error('Error in auth-state:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}