-- ============================================================
-- JAM MINUM OBAT — dasar pengingat
--
-- `medications.jadwal` yang sudah ada berisi teks bebas ("pagi & malam,
-- sesudah makan"). Itu berguna dibaca manusia tetapi tidak bisa menjalankan
-- penjadwal apa pun, jadi kolom baru ini menyimpan jam yang sebenarnya.
--
-- SATU JAM PER DOSIS, urut sesuai `slot` di `med_logs` (berbasis 0): jam[1]
-- untuk dosis pertama, jam[2] untuk dosis kedua, dan seterusnya. Panjangnya
-- mengikuti `frekuensi`. (Larik Postgres dimulai dari 1; kode aplikasi yang
-- memetakan slot 0 → jam[1].)
--
-- Disimpan di database, bukan hanya di ponsel, dengan alasan yang sama seperti
-- pertanyaan pra-kunjungan: jadwalnya tidak boleh hilang ketika aplikasi
-- dipasang ulang atau pasien ganti ponsel. Yang memang tinggal di ponsel hanya
-- saklar hidup/mati pengingatnya — itu urusan perangkat, bukan data medis.
--
-- Jalankan di Supabase → SQL Editor. Aman dijalankan ulang.
-- ============================================================

alter table public.medications
  add column if not exists jam text[];

-- Format 'HH:MM' 24 jam, dijaga di database supaya baris yang tidak bisa
-- dijadwalkan tidak pernah tersimpan diam-diam. Larik kosong disamakan dengan
-- NULL oleh aplikasi: keduanya berarti "obat ini tanpa pengingat".
--
-- Diperiksa dengan regex atas seluruh larik yang sudah digabung, bukan dengan
-- subquery per elemen: Postgres menolak subquery di dalam CHECK constraint.
-- `array_to_string` bersifat immutable, jadi bentuk ini sah.
alter table public.medications drop constraint if exists medications_jam_check;
alter table public.medications
  add constraint medications_jam_check
  check (
    jam is null
    or cardinality(jam) = 0
    or (
      cardinality(jam) <= 6
      and array_to_string(jam, ',') ~
          '^([01][0-9]|2[0-3]):[0-5][0-9](,([01][0-9]|2[0-3]):[0-5][0-9])*$'
    )
  );
