-- ============================================================
-- TEMAN LUPUS — kolom persetujuan pada profiles (pelengkap skema MVP)
--
-- Prototipe web menyimpan persetujuan di profiles.consent_at /
-- profiles.consent_version, tetapi kolom ini tidak ada di
-- teman-lupus-supabase-schema.sql. Jalankan bila belum ada.
-- Aman dijalankan ulang.
-- ============================================================

alter table public.profiles
  add column if not exists consent_at      timestamptz,
  add column if not exists consent_version text;

comment on column public.profiles.consent_at is
  'Waktu pasien menyetujui informed consent. NULL = belum menyetujui.';
comment on column public.profiles.consent_version is
  'Versi teks consent yang disetujui, agar perubahan naskah dapat dilacak.';
