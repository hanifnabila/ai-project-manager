import { GoogleGenAI } from '@google/genai';
import { NextResponse } from 'next/server';

const ai = new GoogleGenAI(); // Membaca process.env.GEMINI_API_KEY secara otomatis

export async function POST(request) {
  try {
    const { rawText } = await request.json();

    if (!rawText) {
      return NextResponse.json({ success: false, error: 'Catatan tidak boleh kosong' }, { status: 400 });
    }

    const prompt = `
    Analisis teks catatan progress harian berikut dan ubah menjadi format JSON murni (TANPA markdown block seperti \`\`\`json, langsung teks JSON mentah) dengan struktur key berikut:
    - project_name (string: nama proyek yang dikerjakan)
    - tasks (array of strings: daftar pekerjaan yang diselesaikan atau sedang dikerjakan)
    - status ("In Progress" | "Completed" | "Blocked")
    - summary (string: ringkasan singkat dalam 1 kalimat)

    Catatan Mentah: "${rawText}"
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-3.6-flash',
      contents: prompt,
    });

    // Membersihkan format teks jaga-jaga jika AI menyertakan markdown backticks
    let cleanText = response.text.trim();
    cleanText = cleanText.replace(/^```json\s*/, '').replace(/^```\s*/, '').replace(/\s*```$/, '');

    const parsedData = JSON.parse(cleanText);

    return NextResponse.json({ success: true, data: parsedData });
  } catch (error) {
    console.error('Error processing note:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}