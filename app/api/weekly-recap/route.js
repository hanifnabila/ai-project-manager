import { GoogleGenAI } from '@google/genai';
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getFriendlyGeminiError } from '@/lib/geminiError';

const ai = new GoogleGenAI();

export async function POST() {
  try {
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
      return NextResponse.json({ success: false, error: 'Supabase environment variables not configured' }, { status: 500 });
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    );

    const since = new Date();
    since.setDate(since.getDate() - 7);

    const { data, error } = await supabase
      .from('progress_logs')
      .select('project_name, status, summary, tasks, raw_text, created_at')
      .gte('created_at', since.toISOString())
      .order('created_at', { ascending: false });

    if (error) throw error;

    if (!data || data.length === 0) {
      return NextResponse.json(
        { success: true, summary: 'Belum ada data dalam 7 hari terakhir. Catat progress harian Anda terlebih dahulu.' },
        { status: 200 }
      );
    }

    const records = data.map(item => ({
      project_name: item.project_name,
      status: item.status,
      summary: item.summary,
      tasks: typeof item.tasks === 'string' ? JSON.parse(item.tasks) : item.tasks,
      created_at: item.created_at,
    }));

    const prompt = `
    Berikut adalah data progress harian selama seminggu terakhir dari aplikasi manajemen proyek pribadi:

    ${JSON.stringify(records, null, 2)}

    Buatlah sebuah ringkasan mingguan profesional dalam Bahasa Indonesia dengan struktur:
    1. **Ringkasan Eksekutif** - ringkasan keseluruhan minggu ini dalam 2-3 kalimat.
    2. **Pencapaian** - bullet points semua yang telah diselesaikan.
    3. **Kendala** - bullet points hambatan/blocker yang ditemui.
    4. **Rencana Minggu Depan** - bullet points rekomendasi pekerjaan untuk minggu depan.

    Gunakan bahasa formal namun mudah dipahami. Jangan gunakan format markdown block, langsung berikan teks naratifnya.
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-3.6-flash',
      contents: prompt,
    });

    return NextResponse.json({ success: true, summary: response.text.trim(), records });
  } catch (error) {
    console.error('Error generating weekly recap:', error);
    return NextResponse.json({ success: false, error: getFriendlyGeminiError(error) }, { status: 500 });
  }
}