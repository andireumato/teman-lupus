-- ============================================================
-- TEMAN LUPUS — memisahkan persetujuan PENGGUNAAN dari persetujuan PENELITIAN
--
-- Sebelum ini keduanya menyatu dalam satu centang: pasien yang tidak mau ikut
-- penelitian tidak bisa memakai aplikasi ini untuk perawatannya sendiri.
-- Keikutsertaan seperti itu tidak benar-benar sukarela, dan itu justru syarat
-- yang paling dijaga komite etik.
--
-- Sesudah ini:
--   - `consent_at` / `consent_version`  → persetujuan PENGGUNAAN, wajib
--   - `consent_penelitian`              → persetujuan PENELITIAN, opsional
--
-- Pasien yang menolak penelitian tetap memakai seluruh fitur aplikasi. Datanya
-- tidak pernah ikut ekspor penelitian, dan penolakan itu boleh diubah kapan
-- saja dari layar Profil.
--
-- Jalankan di Supabase Dashboard → SQL Editor. Aman dijalankan ulang.
-- ============================================================

alter table public.profiles
  -- Tiga keadaan yang sengaja dibedakan:
  --   NULL  = belum menjawab (naskah baru, belum lewat layar persetujuan)
  --   true  = ikut penelitian
  --   false = menolak, dan itu jawaban yang sah
  --
  -- Boolean nullable, bukan `not null default false`: "menolak" dan "belum
  -- ditanya" adalah dua hal berbeda, dan menyamakannya membuat pasien yang
  -- belum sempat ditanya terhitung sebagai penolak dalam laporan kepatuhan
  -- etik.
  add column if not exists consent_penelitian boolean,

  -- Kapan jawabannya diberikan. Dipisah dari `consent_at` karena pasien boleh
  -- mengubah pendiriannya soal penelitian tanpa menyentuh persetujuan
  -- penggunaan — dan kapan ia mencabut adalah fakta yang harus bisa
  -- ditunjukkan saat audit.
  add column if not exists consent_penelitian_at timestamptz;

comment on column public.profiles.consent_penelitian is
  'NULL = belum menjawab, true = ikut penelitian, false = menolak. Menolak TIDAK membatasi pemakaian aplikasi.';

-- Baris yang sudah ada sengaja TIDAK diisi apa pun.
--
-- Menandai mereka `true` berarti mengarang persetujuan yang tidak pernah
-- diberikan — pertanyaan penelitian belum pernah ditanyakan terpisah kepada
-- siapa pun. Menandai `false` juga keliru, karena mereka belum menolak.
-- Keduanya dibiarkan NULL, dan `CONSENT_VERSION` di aplikasi dinaikkan
-- sehingga semua pasien melewati layar persetujuan yang baru dan menjawab
-- sendiri.
