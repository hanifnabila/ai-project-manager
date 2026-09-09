import { GoogleGenAI } from '@google/genai';
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getFriendlyGeminiError, getGeminiErrorCode } from '@/lib/geminiError';

const ai = new GoogleGenAI();

// Inisialisasi Supabase Server Client


export async function POST(request) {
  try {
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
      return NextResponse.json({ success: false, error: 'Supabase environment variables not configured' }, { status: 500 });
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    );
    const { rawText } = await request.json();

    if (!rawText) {
      return NextResponse.json({ success: false, error: 'Catatan tidak boleh kosong' }, { status: 400 });
    }

    const prompt = `
    Analisis teks catatan progress harian berikut dan ubah menjadi format JSON murni (TANPA markdown block seperti \`\`\`json) dengan struktur key berikut:
    - project_name (string: nama proyek yang dikerjakan)
    - tasks (array of strings: daftar pekerjaan)
    - status ("In Progress" | "Completed" | "Blocked")
    - summary (string: ringkasan singkat dalam 1 kalimat)
    - tags (array of strings: 1-3 tag/kategori/label singkat untuk mengelompokkan catatan, misalnya nama klien, jenis pekerjaan seperti "Backend", "Frontend", "Bug Fix", atau nama modul)
    - priority (string: salah satu dari "Rendah" | "Sedang" | "Tinggi" | "Kritis", nilai prioritas pekerjaan ini)
    - deadline (string: tanggal tenggat waktu/deadline dalam format "YYYY-MM-DD", atau null jika catatan tidak menyebutkan deadline secara eksplisit)

    Catatan Mentah: "${rawText}"
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-3.6-flash',
      contents: prompt,
    });

    let cleanText = response.text.trim();
    cleanText = cleanText.replace(/^```json\s*/, '').replace(/^```\s*/, '').replace(/\s*```$/, '');
    const parsedData = JSON.parse(cleanText);

    const rawDeadline = parsedData.deadline;
    const deadline =
      typeof rawDeadline === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(rawDeadline) ? rawDeadline : null;

    // SIMPAN KE SUPABASE
    const { data, error } = await supabase
      .from('progress_logs')
      .insert([
        {
          project_name: parsedData.project_name,
          status: parsedData.status,
          summary: parsedData.summary,
          tasks: parsedData.tasks,
          tags: Array.isArray(parsedData.tags) ? parsedData.tags : [],
          priority: (parsedData.priority || 'sedang').toLowerCase(),
          deadline,
          raw_text: rawText,
        }
      ])
      .select();

    if (error) throw error;

    return NextResponse.json({ success: true, data: parsedData });
  } catch (error) {
    console.error('Error processing note:', error);
    return NextResponse.json({ success: false, error: getFriendlyGeminiError(error), code: getGeminiErrorCode(error) }, { status: 500 });
  }
}