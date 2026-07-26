-- ============================================================
-- TEMAN LUPUS — satu check-in per pasien per hari
--
-- Aplikasi menyimpan check-in harian dengan upsert
-- (onConflict: patient_id,tanggal). Tanpa unique constraint ini,
-- upsert akan gagal dan pasien bisa membuat banyak baris untuk
-- tanggal yang sama.
--
-- Jalankan SETELAH memastikan tidak ada duplikat (lihat query di bawah).
-- Aman dijalankan ulang.
-- ============================================================

-- 1. Periksa dulu apakah sudah ada duplikat:
--
--   select patient_id, tanggal, count(*)
--   from public.daily_checkins
--   group by 1,2 having count(*) > 1;
--
-- 2. Bila ada, sisakan baris terbaru per (patient_id, tanggal):
--
--   delete from public.daily_checkins d using public.daily_checkins lain
--   where d.patient_id = lain.patient_id
--     and d.tanggal   = lain.tanggal
--     and d.created_at < lain.created_at;

alter table public.daily_checkins
  drop constraint if exists daily_checkins_patient_tanggal_key;

alter table public.daily_checkins
  add constraint daily_checkins_patient_tanggal_key unique (patient_id, tanggal);
