import { GoogleGenAI } from '@google/genai';
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { isQuotaOrTempError } from '@/lib/geminiError';

const ai = new GoogleGenAI();
const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function sendTelegramMessage(chatId, text) {
    await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            chat_id: chatId,
            text: text,
            parse_mode: 'Markdown'
        }),
    });
}

export async function POST(request) {
    let chatId = null;
    try {
        const body = await request.json();
        if (!body.message || !body.message.text) {
            return NextResponse.json({ success: true });
        }

        chatId = body.message.chat.id;
        const userText = body.message.text.trim();

        // 1. Deteksi apakah user ingin melihat laporan/tanya (mengandung kata kunci laporan, rekap, ringkasan, dll)
        const isAskingReport = /laporan|rekap|ringkasan|progressku|tugas apa|proyek apa/i.test(userText);

        if (isAskingReport) {
            // Ambil data dari Supabase (misal 10 catatan terakhir)
            const { data: logs, error } = await supabase
                .from('progress_logs')
                .select('*')
                .order('created_at', { ascending: false })
                .limit(10);

            if (error || !logs || logs.length === 0) {
                await sendTelegramMessage(chatId, "📭 Belum ada catatan progress yang tersimpan di database.");
                return NextResponse.json({ success: true });
            }

            // Format data untuk dikirim ke Gemini
            const logsContext = JSON.stringify(logs);

            const prompt = `
      Anda adalah AI Project Manager Assistant. Pengguna bertanya atau meminta laporan dengan kalimat: "${userText}"
      
      Berikut adalah data riwayat catatan progress dari database:
      ${logsContext}

      Tolong buatkan jawaban atau laporan ringkas, rapi, dan profesional dalam bahasa Indonesia berdasarkan data di atas untuk menjawab pertanyaan pengguna.
      `;

            const response = await ai.models.generateContent({
                model: 'gemini-3.6-flash',
                contents: prompt,
            });

            await sendTelegramMessage(chatId, response.text);
            return NextResponse.json({ success: true });
        }

        // 2. Jika bukan bertanya laporan, anggap sebagai CATATAN PROGRESS BARU (seperti biasa)
        const promptAnalyze = `
    Analisis teks catatan progress harian berikut dan ubah menjadi format JSON murni (TANPA markdown block) dengan struktur key:
    - project_name (string)
    - tasks (array of strings)
    - status ("In Progress" | "Completed" | "Blocked")
    - summary (string)

    Catatan: "${userText}"
    `;

        const responseAnalyze = await ai.models.generateContent({
            model: 'gemini-3.6-flash',
            contents: promptAnalyze,
        });

        let cleanText = responseAnalyze.text.trim().replace(/^```json\s*/, '').replace(/^```\s*/, '').replace(/\s*```$/, '');
        const parsedData = JSON.parse(cleanText);

        // Simpan ke Supabase
        await supabase.from('progress_logs').insert([
            {
                project_name: parsedData.project_name,
                status: parsedData.status,
                summary: parsedData.summary,
                tasks: JSON.stringify(parsedData.tasks),
                raw_text: userText,
            }
        ]);

        const replyMessage = `✅ *Berhasil Dicatat!*\n\n📌 *Proyek:* ${parsedData.project_name}\n📊 *Status:* ${parsedData.status}\n📝 *Ringkasan:* ${parsedData.summary}`;
        await sendTelegramMessage(chatId, replyMessage);

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Telegram Webhook Error:', error);
        if (isQuotaOrTempError(error) && chatId) {
            try {
                await sendTelegramMessage(chatId, "⚠️ Sedang terkendala di sisi AI (kuota/antrean server). Mohon coba lagi beberapa menit lagi ya.");
            } catch (err) {
                console.error('Failed to notify user about AI outage:', err);
            }
            return NextResponse.json({ success: true });
        }
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}