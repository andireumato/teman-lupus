-- ============================================================
-- TEMAN LUPUS — efek samping obat yang dilaporkan pasien
--
-- Sebelum ini efek samping hanya bisa ditulis sebagai alasan bebas pada
-- catatan minum obat, sehingga bagian 4 ringkasan pra-kunjungan selalu
-- berkata "efek samping belum dikumpulkan secara terstruktur".
--
-- Sengaja TABEL SENDIRI, bukan kolom baru di daily_checkins.gejala:
-- beberapa keluhan (ruam, rambut rontok, sariawan, demam) bisa datang dari
-- lupusnya atau dari obatnya. Menggabungkannya membuat bagian 2 ringkasan
-- menghitung efek obat sebagai aktivitas penyakit. Yang membedakan keduanya
-- penilaian dokter, bukan tebakan aplikasi.
--
-- Jalankan di Supabase Dashboard → SQL Editor. Aman dijalankan ulang.
-- ============================================================

create table if not exists public.med_side_effects (
  id            uuid primary key default gen_random_uuid(),
  patient_id    uuid not null references public.patients(id) on delete cascade,
  -- Boleh NULL: pasien belum tentu tahu obat mana penyebabnya, dan menebak
  -- lebih buruk daripada mengosongkan.
  medication_id uuid references public.medications(id) on delete set null,
  -- Kunci dari constants/efek-samping.ts, mis. 'mual'.
  jenis         text not null,
  tanggal       date not null default current_date,
  catatan       text,
  created_at    timestamptz not null default now()
);

create index if not exists med_side_effects_patient_tanggal_idx
  on public.med_side_effects (patient_id, tanggal desc);

-- Satu laporan per jenis per obat per hari. Tanpa ini, pasien yang mengetuk
-- dua kali menghasilkan dua baris dan hitungan di ringkasan menggelembung.
-- medication_id yang NULL tidak ikut unique index (NULL selalu berbeda di
-- Postgres), jadi dipisah jadi dua index parsial.
create unique index if not exists med_side_effects_unik
  on public.med_side_effects (patient_id, medication_id, jenis, tanggal)
  where medication_id is not null;

create unique index if not exists med_side_effects_unik_tanpa_obat
  on public.med_side_effects (patient_id, jenis, tanggal)
  where medication_id is null;

alter table public.med_side_effects enable row level security;

-- Pasien CRUD miliknya sendiri; dokter penanggung jawab boleh membaca.
drop policy if exists med_side_effects_patient on public.med_side_effects;
create policy med_side_effects_patient on public.med_side_effects
  for all using (patient_id in (select public.my_patient_ids()))
  with check (patient_id in (select public.my_patient_ids()));

drop policy if exists med_side_effects_doctor_read on public.med_side_effects;
create policy med_side_effects_doctor_read on public.med_side_effects
  for select using (patient_id in (select public.my_doctor_patient_ids()));
