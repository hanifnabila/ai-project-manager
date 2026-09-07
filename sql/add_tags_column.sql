-- Tambahkan kolom tags ke tabel progress_logs
-- Jalankan perintah ini di Supabase SQL Editor (Dashboard > SQL > New query)

ALTER TABLE progress_logs
ADD COLUMN IF NOT EXISTS tags jsonb DEFAULT '[]'::jsonb;