-- Bersihkan sisa baris yang pernah di-soft-delete (deleted_at ter-set)
-- sebelum fitur hard-delete aktif. Hapus permanen dari database.
-- Jalankan di Supabase SQL Editor (sekali).

delete from public.progress_logs where deleted_at is not null;
delete from public.jadwal_activities where deleted_at is not null;
delete from public.jadwal_logs where deleted_at is not null;