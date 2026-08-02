-- POLA HARI MINUM OBAT
--
-- Sampai sekarang aplikasi menganggap semua obat diminum SETIAP HARI, dan
-- `frekuensi` hanya mengatur berapa kali dalam satu hari. Asumsi itu salah untuk
-- dua kelompok obat yang justru lazim pada lupus:
--
--   metotreksat        — seminggu sekali, obat paling sering dipakai di
--                        reumatologi setelah steroid
--   prednison          — sebagian pasien memakai aturan selang-sehari
--
-- Akibatnya bukan sekadar tampilan. Penyebut kepatuhan dihitung sebagai
-- frekuensi × jumlah hari aktif, sehingga metotreksat mingguan tercatat punya
-- 30 dosis terjadwal dalam sebulan padahal sebenarnya 4 — dan kepatuhan peserta
-- terlihat runtuh hanya karena aritmetikanya salah.
--
-- Aman dijalankan berulang.

alter table public.medications
  add column if not exists pola text not null default 'harian',
  add column if not exists hari_minggu int[],
  add column if not exists selang_hari int,
  add column if not exists mulai_tanggal date;

comment on column public.medications.pola is
  'harian | mingguan | selang. Lihat src/lib/pola-minum.ts.';
comment on column public.medications.hari_minggu is
  'Pola mingguan: hari minum menurut ISO, 1=Senin s/d 7=Minggu. BUKAN penomoran JavaScript maupun expo-notifications.';
comment on column public.medications.selang_hari is
  'Pola selang: tiap berapa hari (2-30). 2 = selang sehari.';
comment on column public.medications.mulai_tanggal is
  'Pola selang: tanggal jangkar yang ikut dihitung sebagai hari minum.';

alter table public.medications drop constraint if exists medications_pola_check;
alter table public.medications
  add constraint medications_pola_check
  check (pola in ('harian', 'mingguan', 'selang'));

-- Tiap pola wajib membawa bahannya sendiri, dan TIDAK BOLEH membawa bahan pola
-- lain. Kolom sisa dari pola sebelumnya adalah cara termudah membuat jadwal
-- yang terbaca berbeda oleh aplikasi dan oleh analisis penelitian nanti.
alter table public.medications drop constraint if exists medications_pola_lengkap;
alter table public.medications
  add constraint medications_pola_lengkap
  check (
    (
      pola = 'harian'
      and hari_minggu is null
      and selang_hari is null
      and mulai_tanggal is null
    )
    or (
      pola = 'mingguan'
      and hari_minggu is not null
      and array_length(hari_minggu, 1) between 1 and 7
      -- Penjagaan penomoran hari. Nilai 0 akan lolos kalau dilupakan, dan 0
      -- adalah hari Minggu di JavaScript — persis kekeliruan yang paling
      -- mungkin terjadi.
      and hari_minggu <@ array[1, 2, 3, 4, 5, 6, 7]
      and selang_hari is null
      and mulai_tanggal is null
    )
    or (
      pola = 'selang'
      and selang_hari between 2 and 30
      and mulai_tanggal is not null
      and hari_minggu is null
    )
  );

-- Baris lama tidak perlu disentuh: default 'harian' sudah sesuai dengan
-- perilaku aplikasi sebelum perubahan ini, jadi tidak ada obat yang berubah
-- jadwalnya tanpa sepengetahuan pasien.
