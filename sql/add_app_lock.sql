-- Pusat pengaman akses lintas perangkat: kode akses & pertanyaan-jawaban
-- disimpan di database (hash PBKDF2 + salt dari client), bukan per-perangkat.
-- Jalankan di Supabase SQL Editor (sekali).

create table if not exists public.app_lock (
  id boolean primary key default true,
  code_salt text,
  code_hash text,
  code_iterations integer,
  qa_question text,
  qa_salt text,
  qa_hash text,
  qa_iterations integer,
  updated_at timestamptz not null default now()
);

insert into public.app_lock (id) values (true)
  on conflict (id) do nothing;

-- Aplikasi memakai anon key tanpa auth, konsisten dengan tabel lain.
alter table public.app_lock disable row level security;