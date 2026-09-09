-- Offline-first PWA: kolom sinkronisasi (updated_at, deleted_at, soft-delete)
-- Jalankan di Supabase SQL Editor.

-- 1. progress_logs
alter table if exists public.progress_logs
  add column if not exists updated_at timestamptz not null default now();
alter table if exists public.progress_logs
  add column if not exists deleted_at timestamptz;

-- 2. jadwal_activities
alter table if exists public.jadwal_activities
  add column if not exists updated_at timestamptz not null default now();
alter table if exists public.jadwal_activities
  add column if not exists deleted_at timestamptz;

-- 3. jadwal_logs
alter table if exists public.jadwal_logs
  add column if not exists updated_at timestamptz not null default now();
alter table if exists public.jadwal_logs
  add column if not exists deleted_at timestamptz;

-- Trigger otomatis: set updated_at = now() saat baris di-update
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists trg_progress_logs_updated on public.progress_logs;
create trigger trg_progress_logs_updated
  before update on public.progress_logs
  for each row execute function public.set_updated_at();

drop trigger if exists trg_jadwal_activities_updated on public.jadwal_activities;
create trigger trg_jadwal_activities_updated
  before update on public.jadwal_activities
  for each row execute function public.set_updated_at();

drop trigger if exists trg_jadwal_logs_updated on public.jadwal_logs;
create trigger trg_jadwal_logs_updated
  before update on public.jadwal_logs
  for each row execute function public.set_updated_at();

-- Pastikan RLS tetap off (aplikasi memakai anon key tanpa auth)
alter table public.progress_logs disable row level security;
alter table public.jadwal_activities disable row level security;
alter table public.jadwal_logs disable row level security;