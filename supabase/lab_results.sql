-- ============================================================
-- TEMAN LUPUS — tabel lab_results (pelengkap skema MVP)
--
-- Tabel ini dipakai prototipe web tetapi tidak ada di
-- teman-lupus-supabase-schema.sql. Jalankan di Supabase Dashboard →
-- SQL Editor bila tabelnya belum ada di project Anda.
-- Aman dijalankan ulang.
-- ============================================================

create table if not exists public.lab_results (
  id         uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patients(id) on delete cascade,
  jenis      text not null,
  nilai_num  double precision,
  nilai_teks text,
  satuan     text,
  tanggal    date,
  catatan    text,
  created_at timestamptz not null default now()
);

create index if not exists lab_results_patient_tanggal_idx
  on public.lab_results (patient_id, tanggal desc);

alter table public.lab_results enable row level security;

-- Pasien CRUD miliknya sendiri; dokter penanggung jawab boleh membaca.
-- Memakai fungsi bantu yang sudah dibuat di skema utama.
drop policy if exists lab_results_patient on public.lab_results;
create policy lab_results_patient on public.lab_results
  for all using (patient_id in (select public.my_patient_ids()))
  with check (patient_id in (select public.my_patient_ids()));

drop policy if exists lab_results_doctor_read on public.lab_results;
create policy lab_results_doctor_read on public.lab_results
  for select using (patient_id in (select public.my_doctor_patient_ids()));
