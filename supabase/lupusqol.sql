-- ============================================================
-- TEMAN LUPUS — LupusQoL (kualitas hidup khusus SLE)
--
-- Instrumen PRO tervalidasi Bahasa Indonesia:
--   Anindito B, Hidayat R, Koesnoe S, Dewianty E. Validity and reliability of
--   lupus quality of life questionnaire in patients with systemic lupus
--   erythematosus in Indonesia. Indonesian Journal of Rheumatology
--   2016;8(2):38-44.
--
-- ⚠️ HAK CIPTA. LupusQoL milik University of Central Lancashire dan East
-- Lancashire Hospitals NHS Trust, dilisensikan lewat RWS Life Sciences.
-- Gratis untuk peneliti akademik TETAPI butuh izin tertulis lebih dulu. Tabel
-- ini hanya menyimpan JAWABAN dan nomor butir; tidak ada satu pun teks butir
-- di sini maupun di kode aplikasi sampai izinnya turun.
--
-- Jalankan di Supabase Dashboard → SQL Editor. Aman dijalankan ulang.
-- ============================================================

create table if not exists public.lupusqol_assessments (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patients(id) on delete cascade,
  tanggal date not null default current_date,

  -- Kunci butir → nilai 0-4, mis. {"fisik_1": 3, "nyeri_2": 0}.
  --
  -- Yang disimpan HANYA jawaban mentahnya; skor kedelapan domain TIDAK ikut
  -- disimpan. Skor adalah turunan murni dari jawaban ini, dan menyimpan
  -- keduanya berarti keduanya bisa berselisih — persis yang terjadi pada baris
  -- `sledai_assessments` warisan prototipe web, yang `total`-nya harus
  -- dicocokkan ulang dengan `deskriptor` satu per satu. Perhitungannya ada di
  -- src/lib/lupusqol.ts dan diuji baris per baris.
  jawaban jsonb not null default '{}'::jsonb,

  -- Butir yang pasien tandai "tidak berlaku" — hanya ada di domain hubungan
  -- intim. Dipisah dari butir yang sekadar terlewat: keduanya sama-sama tidak
  -- ikut rata-rata, tapi "tidak punya pasangan" dan "lupa menjawab" adalah dua
  -- temuan yang berbeda saat menilai kelengkapan data.
  tak_berlaku text[] not null default '{}',

  created_at timestamptz not null default now()
);

create index if not exists lupusqol_patient_tanggal_idx
  on public.lupusqol_assessments (patient_id, tanggal desc);

-- Satu penilaian per pasien per hari. LupusQoL menanyakan 4 MINGGU terakhir,
-- jadi dua pengisian pada hari yang sama tidak menambah informasi apa pun —
-- yang kedua hanya membuat tren bergerigi tanpa sebab klinis.
create unique index if not exists lupusqol_unik_harian
  on public.lupusqol_assessments (patient_id, tanggal);

alter table public.lupusqol_assessments enable row level security;

-- Pasien CRUD miliknya sendiri; dokter penanggung jawab boleh membaca.
-- Bentuk yang sama dengan med_side_effects — lihat supabase/efek_samping.sql.
drop policy if exists lupusqol_patient on public.lupusqol_assessments;
create policy lupusqol_patient on public.lupusqol_assessments
  for all using (patient_id in (select public.my_patient_ids()))
  with check (patient_id in (select public.my_patient_ids()));

drop policy if exists lupusqol_doctor_read on public.lupusqol_assessments;
create policy lupusqol_doctor_read on public.lupusqol_assessments
  for select using (patient_id in (select public.my_doctor_patient_ids()));
