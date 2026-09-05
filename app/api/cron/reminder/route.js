import { NextResponse } from 'next/server';

export async function GET(request) {
    try {
        const token = process.env.TELEGRAM_BOT_TOKEN;
        const chatId = process.env.TELEGRAM_CHAT_ID;

        if (!token || !chatId) {
            throw new Error('Token atau Chat ID Telegram belum diset di environment variables');
        }

        const message = "Halo! ☀️ Waktunya mengisi progress dan menyiapkan catatan tugas yang akan dikerjakan hari ini. Yuk buka web AI Project Manager!";

        const url = `https://api.telegram.org/bot${token}/sendMessage`;

        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                chat_id: chatId,
                text: message,
            }),
        });

        const result = await response.json();
        if (!result.ok) throw new Error(result.description);

        return NextResponse.json({ success: true, message: 'Pengingat Telegram berhasil dikirim!' });
    } catch (error) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}