-- ============================================================
-- TANGGAL LAHIR & JENIS KELAMIN — diisi PASIEN sendiri
--
-- Ditaruh di `patients`, bukan `profiles`, karena `profiles` dipakai dokter
-- juga: kolom tanggal lahir di sana akan selalu null untuk baris dokter dan
-- tidak berarti apa-apa. `patients` juga sudah punya kebijakan
-- `patients_patient_write`, jadi pasien bisa mengisi sendiri tanpa perlu
-- fungsi `security definer` seperti data klinis dasar yang diisi dokter.
--
-- TANGGAL LAHIR, BUKAN USIA. Usia yang disimpan sebagai angka akan basi
-- diam-diam — pasien 34 tahun tetap tertulis 34 tahun tiga tahun kemudian,
-- dan tidak ada yang menyadarinya. Usianya dihitung saat ditampilkan, lihat
-- `usiaTahun()` di src/lib/klinis.ts.
--
-- Jalankan di Supabase → SQL Editor. Aman dijalankan ulang.
-- ============================================================

alter table public.patients
  add column if not exists tgl_lahir     date,
  add column if not exists jenis_kelamin text;

-- Dua pilihan saja: kolom ini untuk keperluan epidemiologi, bukan untuk
-- keputusan terapi. Kalau nanti dibutuhkan penilaian risiko kehamilan
-- (mikofenolat, siklofosfamid), itu pertanyaan yang berbeda dan butuh
-- kolomnya sendiri — jangan dibebankan ke kolom ini.
alter table public.patients drop constraint if exists patients_jenis_kelamin_check;
alter table public.patients
  add constraint patients_jenis_kelamin_check
  check (jenis_kelamin is null or jenis_kelamin in ('perempuan', 'laki-laki'));

-- Hanya batas bawah yang masuk akal. "Tidak boleh di masa depan" TIDAK BISA
-- dijadikan CHECK: Postgres menolak fungsi non-immutable seperti current_date
-- di dalam constraint. Penjagaan itu ada di sisi aplikasi —
-- `periksaTanggalLahir()` di src/lib/klinis.ts, lengkap dengan tesnya.
alter table public.patients drop constraint if exists patients_tgl_lahir_check;
alter table public.patients
  add constraint patients_tgl_lahir_check
  check (tgl_lahir is null or tgl_lahir > date '1900-01-01');
