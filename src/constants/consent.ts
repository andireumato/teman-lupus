/**
 * Naskah informed consent.
 *
 * Setiap kali naskah berubah, NAIKKAN CONSENT_VERSION. Pasien yang sudah
 * menyetujui versi lama akan diminta menyetujui ulang — ini syarat audit etik,
 * jangan diubah tanpa menaikkan versi.
 */

/**
 * Riwayat versi — supaya alasan setiap permintaan setuju-ulang bisa ditelusuri
 * saat audit etik.
 *
 * - `2026-07-03` — naskah awal.
 * - `2026-07-31` — menambah paragraf "Lokasi & layanan luar". Naskah sebelumnya
 *   tidak menyebut bahwa data disimpan di Singapura, dan tidak menyebut bahwa
 *   koordinat dikirim ke Open-Meteo saat izin lokasi diberikan. Keduanya aliran
 *   data yang nyata dan seharusnya ada sejak awal.
 * - `2026-07-31b` — memisahkan persetujuan PENGGUNAAN dari persetujuan
 *   PENELITIAN. Sebelumnya keduanya satu centang, sehingga pasien yang menolak
 *   penelitian tidak bisa memakai aplikasi untuk perawatannya sendiri —
 *   keikutsertaan seperti itu tidak benar-benar sukarela.
 */
export const CONSENT_VERSION = '2026-07-31b';

export const CONSENT = {
  judul: 'Aplikasi & Penelitian "Teman Lupus"',
  peneliti: 'Dr. dr. Andi Raga Ginting, M.Ked(PD), Sp.PD, Subsp.R(K)',
  institusi: 'Fakultas Kedokteran USU / RSUP H. Adam Malik, Medan',
  etik: 'Dalam proses pengajuan (nomor menyusul)',
  kontak: 'andi.raga@usu.ac.id · 0881082105864',
} as const;

export const CONSENT_PARAGRAF: { judul: string; isi: string }[] = [
  {
    judul: 'Tujuan',
    isi: 'Aplikasi ini membantu memantau kondisi lupus (SLE) Anda — check-in harian, gejala, kepatuhan obat, dan hasil pemeriksaan — untuk mendukung perawatan bersama dokter serta penelitian.',
  },
  {
    judul: 'Yang Anda lakukan',
    isi: 'Mengisi check-in harian, kuesioner (mis. MARS-5), dan catatan obat. Dokter yang terhubung mengisi penilaian klinis.',
  },
  {
    judul: 'Data yang dikumpulkan',
    isi: 'Identitas dasar (nama, tanggal lahir, jenis kelamin) dan data kesehatan terkait lupus yang Anda masukkan.',
  },
  {
    judul: 'Kerahasiaan',
    isi: 'Data disimpan pada server aman. Hanya Anda dan dokter yang Anda hubungkan yang dapat mengaksesnya. Untuk publikasi ilmiah, data disajikan tanpa identitas (anonim).',
  },
  {
    judul: 'Lokasi & layanan luar',
    isi: 'Aplikasi menyimpan data Anda pada layanan Supabase dengan server di Singapura. Bila Anda mengizinkan akses lokasi, koordinat perkiraan (ketelitian sekitar 1 km) dikirim ke layanan cuaca Open-Meteo semata-mata untuk menampilkan indeks UV harian; koordinat itu tidak disimpan dan tidak digabungkan dengan data medis Anda. Izin lokasi boleh ditolak tanpa memengaruhi fungsi lain.',
  },
  {
    judul: 'Dua persetujuan yang terpisah',
    isi: 'Persetujuan PEMAKAIAN aplikasi bersifat wajib — tanpa itu data Anda tidak bisa disimpan dan aplikasi tidak dapat digunakan. Persetujuan PENELITIAN terpisah dan sepenuhnya pilihan Anda: menolaknya tidak mengurangi satu pun fitur, dan tidak memengaruhi pelayanan medis yang Anda terima.',
  },
  {
    judul: 'Sukarela',
    isi: 'Keikutsertaan penelitian bersifat sukarela dan boleh dihentikan kapan saja lewat layar Profil, tanpa perlu memberi alasan. Data yang sudah terlanjur ikut analisis sebelum Anda berhenti tidak dapat ditarik kembali dari berkas yang sudah dibuat — di sana Anda hanya diwakili kode, tanpa nama.',
  },
  {
    judul: 'Risiko & manfaat',
    isi: 'Risiko minimal. Manfaatnya: pemantauan kondisi yang lebih teratur dan komunikasi lebih baik dengan dokter.',
  },
];

export const DISCLAIMER =
  'Bukan alat diagnosis. Untuk keadaan darurat, hubungi layanan gawat darurat.';
