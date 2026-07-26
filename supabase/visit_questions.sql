-- ============================================================
-- TEMAN LUPUS — tabel visit_questions (pelengkap skema MVP)
--
-- Pertanyaan yang pasien siapkan untuk kunjungan berikutnya, dipakai di
-- bagian 6 ringkasan pra-kunjungan (layar /ringkasan).
--
-- Sebelumnya pertanyaan hanya disimpan di perangkat (AsyncStorage), jadi
-- hilang bila aplikasi dihapus dan tidak ikut pindah antar perangkat.
--
-- Jalankan di Supabase Dashboard → SQL Editor. Aman dijalankan ulang.
-- ============================================================

create table if not exists public.visit_questions (
  id         uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patients(id) on delete cascade,
  teks       text not null,
  created_at timestamptz not null default now()
);

create index if not exists visit_questions_patient_idx
  on public.visit_questions (patient_id, created_at);

alter table public.visit_questions enable row level security;

-- Pasien CRUD miliknya sendiri; dokter penanggung jawab boleh membaca.
-- Memakai fungsi bantu yang sudah dibuat di skema utama.
drop policy if exists visit_questions_patient on public.visit_questions;
create policy visit_questions_patient on public.visit_questions
  for all using (patient_id in (select public.my_patient_ids()))
  with check (patient_id in (select public.my_patient_ids()));

drop policy if exists visit_questions_doctor_read on public.visit_questions;
create policy visit_questions_doctor_read on public.visit_questions
  for select using (patient_id in (select public.my_doctor_patient_ids()));
