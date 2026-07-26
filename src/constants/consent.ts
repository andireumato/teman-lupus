/**
 * Naskah informed consent.
 *
 * Setiap kali naskah berubah, NAIKKAN CONSENT_VERSION. Pasien yang sudah
 * menyetujui versi lama akan diminta menyetujui ulang — ini syarat audit etik,
 * jangan diubah tanpa menaikkan versi.
 */

export const CONSENT_VERSION = '2026-07-03';

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
    judul: 'Sukarela',
    isi: 'Keikutsertaan bersifat sukarela. Anda boleh berhenti kapan saja tanpa memengaruhi pelayanan medis yang Anda terima.',
  },
  {
    judul: 'Risiko & manfaat',
    isi: 'Risiko minimal. Manfaatnya: pemantauan kondisi yang lebih teratur dan komunikasi lebih baik dengan dokter.',
  },
];

export const DISCLAIMER =
  'Bukan alat diagnosis. Untuk keadaan darurat, hubungi layanan gawat darurat.';
