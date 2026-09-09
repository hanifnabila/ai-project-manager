-- Progres sub-tugas per catatan: simpan daftar teks sub-tugas yang telah selesai.
-- Progres = completed_tasks.length / tasks.length. Kolom ikut tersinkron via
-- updated_at (LWW) seperti kolom lain. Jalankan di Supabase SQL Editor (sekali).

alter table public.progress_logs
  add column if not exists completed_tasks text[] not null default '{}';