import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const MIN_ITERATIONS = 10_000;

const isValidRecord = (rec) =>
  rec &&
  typeof rec.salt === 'string' &&
  rec.salt.length > 0 &&
  typeof rec.hash === 'string' &&
  rec.hash.length > 0 &&
  Number.isInteger(rec.iterations) &&
  rec.iterations >= MIN_ITERATIONS;

export async function POST(request) {
  try {
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
      return NextResponse.json({ success: false, error: 'Supabase environment variables not configured' }, { status: 500 });
    }

    const body = await request.json().catch(() => null);
    if (!body || typeof body !== 'object') {
      return NextResponse.json({ success: false, error: 'Body tidak valid' }, { status: 400 });
    }

    const { code, qa } = body;

    const patch = {};
    if (code) {
      if (!isValidRecord(code)) {
        return NextResponse.json({ success: false, error: 'Record kode akses tidak valid' }, { status: 400 });
      }
      patch.code_salt = code.salt;
      patch.code_hash = code.hash;
      patch.code_iterations = code.iterations;
    }
    if (qa) {
      if (!isValidRecord(qa) || typeof qa.question !== 'string' || !qa.question.trim()) {
        return NextResponse.json({ success: false, error: 'Record pertanyaan tidak valid' }, { status: 400 });
      }
      patch.qa_question = qa.question.trim();
      patch.qa_salt = qa.salt;
      patch.qa_hash = qa.hash;
      patch.qa_iterations = qa.iterations;
    }

    if (Object.keys(patch).length === 0) {
      return NextResponse.json({ success: false, error: 'Tidak ada kredensial dikirim' }, { status: 400 });
    }

    patch.updated_at = new Date().toISOString();

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    );

    const { data, error } = await supabase
      .from('app_lock')
      .upsert({ id: true, ...patch }, { onConflict: 'id' })
      .select('code_salt, code_hash, code_iterations, qa_question, qa_salt, qa_hash, qa_iterations, updated_at')
      .maybeSingle();

    if (error) throw error;

    const row = data || {};
    const codeRes =
      row.code_salt && row.code_hash
        ? { salt: row.code_salt, hash: row.code_hash, iterations: row.code_iterations }
        : null;
    const qaRes =
      row.qa_salt && row.qa_hash
        ? { question: row.qa_question || null, salt: row.qa_salt, hash: row.qa_hash, iterations: row.qa_iterations }
        : null;

    return NextResponse.json({
      success: true,
      done: !!(codeRes || qaRes),
      hasCode: !!codeRes,
      hasQA: !!qaRes,
      question: qaRes ? qaRes.question : null,
      code: codeRes,
      qa: qaRes,
      updatedAt: row.updated_at || null,
    });
  } catch (error) {
    console.error('Error in auth-setup:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}