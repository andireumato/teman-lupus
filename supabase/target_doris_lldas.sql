-- ============================================================
-- DORIS 2021 & LLDAS — data tambahan yang dibutuhkan
--
-- Keduanya BUKAN skor SLEDAI. Keduanya definisi gabungan: skor klinis + PGA +
-- dosis glukokortikoid + keadaan terapi. Tiga dari empat sudah bisa dihitung
-- dari `deskriptor` jsonb yang selama ini disimpan; yang belum ada hanya PGA,
-- dosis steroid, dan pernyataan dokter soal kestabilan terapi.
--
-- MENGAPA DOSIS STEROID DISIMPAN DI BARIS PENILAIAN, BUKAN DIHITUNG DARI
-- DAFTAR OBAT PASIEN:
--   1. Definisinya menuntut dosis SAAT penilaian. Daftar obat pasien bisa
--      tertinggal dari resep terakhir.
--   2. `medications.dosis` adalah teks bebas ("5 mg", "1 tablet pagi").
--   3. Menghitungnya berarti aplikasi melakukan konversi setara-prednison
--      (metilprednisolon 4 mg, deksametason 0,75 mg, ...). Itu perhitungan
--      klinis; menyembunyikannya di dalam kode tanpa pengesahan reumatolog
--      adalah persis yang kita hindari sepanjang proyek ini.
-- Dokter memasukkan satu angka setara prednison, dan angka itulah yang
-- diaudit bila hasilnya dipertanyakan.
--
-- Jalankan di Supabase → SQL Editor. Aman dijalankan ulang.
-- ============================================================

alter table public.sledai_assessments
  add column if not exists pga           numeric(3, 1),
  add column if not exists gc_mg         numeric(6, 2),
  add column if not exists terapi_stabil boolean;

comment on column public.sledai_assessments.pga is
  'Physician Global Assessment, skala 0-3. NULL = belum dinilai, BUKAN nol.';
comment on column public.sledai_assessments.gc_mg is
  'Dosis glukokortikoid harian, setara prednison, mg. NULL = belum dicatat.';
comment on column public.sledai_assessments.terapi_stabil is
  'Pernyataan dokter: imunosupresan/biologik pada dosis pemeliharaan stabil '
  'yang ditoleransi. Tidak bisa disimpulkan aplikasi. NULL = belum dinyatakan.';

-- PGA memakai skala 0-3 (van Vollenhoven dkk. 2021, PMID 34819388). Skala 0-10
-- juga dipakai di tempat lain; membiarkan keduanya masuk ke satu kolom membuat
-- PGA 2 berarti "ringan" pada satu baris dan "berat" pada baris lain.
alter table public.sledai_assessments drop constraint if exists sledai_pga_check;
alter table public.sledai_assessments
  add constraint sledai_pga_check check (pga is null or (pga >= 0 and pga <= 3));

-- Dosis negatif tidak ada artinya; batas atas dibuat longgar sekadar menangkap
-- salah ketik koma (500 mg/hari masih mungkin pada pulse, 5000 tidak).
alter table public.sledai_assessments drop constraint if exists sledai_gc_mg_check;
alter table public.sledai_assessments
  add constraint sledai_gc_mg_check check (gc_mg is null or (gc_mg >= 0 and gc_mg <= 1000));
