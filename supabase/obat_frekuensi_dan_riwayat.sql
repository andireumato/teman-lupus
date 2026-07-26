-- ============================================================
-- TEMAN LUPUS — frekuensi dosis & riwayat berhenti/lanjut obat
--
-- Dua hal yang ditambahkan:
--   1. medications.frekuensi   — berapa kali obat diminum per hari
--   2. tabel medication_events — riwayat mulai / stop / lanjut
--
-- Ditambah pembersihan: kolom `med_logs.dosis_ke` yang sempat dibuat
-- 27 Juli 2026 dibuang lagi — lihat catatan di bagian 2.
--
-- Sebelum ini, obat 3x sehari hanya bisa ditandai satu kali per hari, dan
-- obat yang dihentikan hilang tanpa jejak tanggal.
--
-- Jalankan di Supabase Dashboard → SQL Editor. Aman dijalankan ulang.
-- ============================================================

-- ---------- 1. Frekuensi dosis per hari ----------

alter table public.medications
  add column if not exists frekuensi int not null default 1;

alter table public.medications
  drop constraint if exists medications_frekuensi_check;

alter table public.medications
  add constraint medications_frekuensi_check check (frekuensi between 1 and 6);

-- ---------- 2. Dosis ke berapa dalam sehari: pakai `slot` ----------

-- ⚠️ Pelajaran mahal: `med_logs` di database SUDAH punya kolom `slot`
-- (integer not null default 0) beserta unique index
-- `med_logs_unik_slot (medication_id, tanggal, slot)` sejak prototipe web,
-- meskipun keduanya TIDAK tercantum di teman-lupus-supabase-schema.sql.
--
-- Versi pertama file ini menambah kolom `dosis_ke` yang gunanya sama persis.
-- Akibatnya aplikasi menulis dosis ke-2 dengan slot tetap 0, bentrok dengan
-- baris dosis pertama, dan tanda dosis ke-2 selalu ditolak database —
-- sementara dosis pertama tampak normal karena barisnya hanya di-update.
--
-- Jadi: `slot` yang dipakai, `dosis_ke` dibuang. `slot` berbasis 0
-- (0 = dosis pertama), mengikuti baris lama yang memakai nilai default 0.

-- Untuk project baru yang skemanya belum punya `slot`:
alter table public.med_logs
  add column if not exists slot int not null default 0;

alter table public.med_logs
  drop constraint if exists med_logs_slot_check;

alter table public.med_logs
  add constraint med_logs_slot_check check (slot between 0 and 5);

-- Aplikasi memakai upsert dengan onConflict ini; tanpa unique index,
-- menandai dosis yang sama dua kali akan menambah baris baru dan hitungan
-- kepatuhan jadi salah.
--
-- Periksa dulu apakah sudah ada duplikat:
--
--   select medication_id, tanggal, slot, count(*)
--   from public.med_logs
--   group by 1,2,3 having count(*) > 1;
--
-- Bila ada, sisakan baris terbaru:
--
--   delete from public.med_logs d using public.med_logs lain
--   where d.medication_id = lain.medication_id
--     and d.tanggal       = lain.tanggal
--     and d.slot          = lain.slot
--     and d.created_at    < lain.created_at;

create unique index if not exists med_logs_unik_slot
  on public.med_logs (medication_id, tanggal, slot);

-- Buang kolom & index bikinan versi pertama. Isinya seragam (semua bernilai
-- default 1), jadi tidak ada informasi yang hilang.
drop index if exists public.med_logs_dosis_unik;
alter table public.med_logs drop column if exists dosis_ke;

-- ---------- 3. Riwayat mulai / stop / lanjut ----------

-- Kolom `aktif` di medications hanya menyimpan keadaan SEKARANG. Tabel ini
-- menyimpan riwayatnya, supaya ringkasan pra-kunjungan bisa menyebutkan
-- "berhenti sejak tanggal sekian" — termasuk bila obat yang sama sempat
-- dihentikan dan dilanjutkan beberapa kali.
create table if not exists public.medication_events (
  id            uuid primary key default gen_random_uuid(),
  patient_id    uuid not null references public.patients(id) on delete cascade,
  medication_id uuid not null references public.medications(id) on delete cascade,
  jenis         text not null check (jenis in ('mulai', 'stop', 'lanjut')),
  tanggal       date not null default current_date,
  catatan       text,
  created_at    timestamptz not null default now()
);

create index if not exists medication_events_patient_tanggal_idx
  on public.medication_events (patient_id, tanggal desc);

alter table public.medication_events enable row level security;

-- Pasien CRUD miliknya sendiri; dokter penanggung jawab boleh membaca.
drop policy if exists medication_events_patient on public.medication_events;
create policy medication_events_patient on public.medication_events
  for all using (patient_id in (select public.my_patient_ids()))
  with check (patient_id in (select public.my_patient_ids()));

drop policy if exists medication_events_doctor_read on public.medication_events;
create policy medication_events_doctor_read on public.medication_events
  for select using (patient_id in (select public.my_doctor_patient_ids()));
