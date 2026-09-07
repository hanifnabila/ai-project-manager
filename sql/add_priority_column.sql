-- Tambahkan kolom priority ke tabel progress_logs
-- Jalankan perintah ini di Supabase SQL Editor (Dashboard > SQL > New query)

ALTER TABLE progress_logs
ADD COLUMN IF NOT EXISTS priority text DEFAULT 'Sedang';