-- Tabel agenda kegiatan pribadi (jadwal harian/mingguan/bulanan)
-- Jalankan di Supabase SQL Editor

create table if not exists public.jadwal_activities (
  id uuid primary key default gen_random_uuid(),
  judul text not null,
  keterangan text,
  tipe text not null default 'harian' check (tipe in ('harian', 'mingguan', 'bulanan', 'sekali')),
  hari text[] default '{}',          -- mingguan: ['Senin', 'Rabu']
  hari_bulan integer[] default '{}', -- bulanan: [1, 15, 31]
  tanggal date,                      -- sekali: tanggal pasti
  jam text,                          -- opsional, format HH:MM
  aktif boolean not null default true,
  created_at timestamptz not null default now()
);

-- Checklist per tanggal untuk tiap kegiatan
create table if not exists public.jadwal_logs (
  id uuid primary key default gen_random_uuid(),
  activity_id uuid not null references public.jadwal_activities(id) on delete cascade,
  tanggal date not null,
  selesai boolean not null default false,
  catatan text,
  created_at timestamptz not null default now(),
  unique (activity_id, tanggal)
);

-- Aplikasi memakai anon key tanpa auth: matikan RLS agar tabel bisa
-- dibaca/ditulis dari klien (izin sama seperti tabel progress_logs).
-- Jalankan dua perintah ini juga jika tabel sudah terlanjur dibuat.
alter table public.jadwal_activities disable row level security;
alter table public.jadwal_logs disable row level security;