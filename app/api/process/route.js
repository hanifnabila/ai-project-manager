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

    Catatan Mentah: "${rawText}"
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-3.6-flash',
      contents: prompt,
    });

    let cleanText = response.text.trim();
    cleanText = cleanText.replace(/^```json\s*/, '').replace(/^```\s*/, '').replace(/\s*```$/, '');
    const parsedData = JSON.parse(cleanText);

    // SIMPAN KE SUPABASE
    const { data, error } = await supabase
      .from('progress_logs')
      .insert([
        {
          project_name: parsedData.project_name,
          status: parsedData.status,
          summary: parsedData.summary,
          tasks: parsedData.tasks, raw_text: rawText,
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