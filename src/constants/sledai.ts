/**
 * SLEDAI-2K — 24 deskriptor aktivitas penyakit, diisi DOKTER.
 *
 * Bobot di bawah adalah bagian dari instrumennya, bukan pilihan rancangan:
 * mengubahnya berarti bukan SLEDAI-2K lagi. Skor total 0–105.
 *
 * ⚠️ WAJIB DIVERIFIKASI reumatolog penanggung jawab sebelum dipakai ke pasien
 * nyata — baik daftar deskriptornya, terjemahannya, maupun bobotnya. Saya
 * menyusunnya dari definisi instrumen yang lazim dipakai, dan salah satu salah
 * ketik pada bobot akan menggeser skor tanpa terlihat.
 *
 * Catatan SLEDAI-2K vs SLEDAI asli: pada versi 2K, gejala yang MENETAP
 * (ruam, alopesia, ulkus mukosa, proteinuria) tetap dihitung — bukan hanya
 * yang baru muncul atau kambuh. Ini perbedaan yang menentukan skor.
 */

export interface DeskriptorSledai {
  key: string;
  label: string;
  /** Bobot poin bila deskriptor ini ada. */
  bobot: number;
  /** Kelompok organ, hanya untuk pengelompokan tampilan. */
  kelompok: string;
}

export const SLEDAI_DESKRIPTOR: DeskriptorSledai[] = [
  // ---- Bobot 8 ----
  { key: 'kejang', label: 'Kejang', bobot: 8, kelompok: 'Saraf' },
  { key: 'psikosis', label: 'Psikosis', bobot: 8, kelompok: 'Saraf' },
  { key: 'sindrom_otak_organik', label: 'Sindrom otak organik', bobot: 8, kelompok: 'Saraf' },
  { key: 'gangguan_penglihatan', label: 'Gangguan penglihatan', bobot: 8, kelompok: 'Saraf' },
  { key: 'gangguan_saraf_kranial', label: 'Gangguan saraf kranial', bobot: 8, kelompok: 'Saraf' },
  { key: 'nyeri_kepala_lupus', label: 'Nyeri kepala lupus', bobot: 8, kelompok: 'Saraf' },
  { key: 'cva', label: 'Cerebrovascular accident (stroke)', bobot: 8, kelompok: 'Saraf' },
  { key: 'vaskulitis', label: 'Vaskulitis', bobot: 8, kelompok: 'Vaskular' },

  // ---- Bobot 4 ----
  { key: 'artritis', label: 'Artritis', bobot: 4, kelompok: 'Muskuloskeletal' },
  { key: 'miositis', label: 'Miositis', bobot: 4, kelompok: 'Muskuloskeletal' },
  { key: 'silinder_urin', label: 'Silinder urin', bobot: 4, kelompok: 'Ginjal' },
  { key: 'hematuria', label: 'Hematuria', bobot: 4, kelompok: 'Ginjal' },
  { key: 'proteinuria', label: 'Proteinuria', bobot: 4, kelompok: 'Ginjal' },
  { key: 'piuria', label: 'Piuria', bobot: 4, kelompok: 'Ginjal' },

  // ---- Bobot 2 ----
  { key: 'ruam', label: 'Ruam', bobot: 2, kelompok: 'Kulit & mukosa' },
  { key: 'alopesia', label: 'Alopesia', bobot: 2, kelompok: 'Kulit & mukosa' },
  { key: 'ulkus_mukosa', label: 'Ulkus mukosa', bobot: 2, kelompok: 'Kulit & mukosa' },
  { key: 'pleuritis', label: 'Pleuritis', bobot: 2, kelompok: 'Serosa' },
  { key: 'perikarditis', label: 'Perikarditis', bobot: 2, kelompok: 'Serosa' },
  { key: 'komplemen_rendah', label: 'Komplemen rendah', bobot: 2, kelompok: 'Imunologi' },
  { key: 'dna_meningkat', label: 'Peningkatan ikatan DNA', bobot: 2, kelompok: 'Imunologi' },

  // ---- Bobot 1 ----
  { key: 'demam', label: 'Demam', bobot: 1, kelompok: 'Konstitusional' },
  { key: 'trombositopenia', label: 'Trombositopenia', bobot: 1, kelompok: 'Hematologi' },
  { key: 'leukopenia', label: 'Leukopenia', bobot: 1, kelompok: 'Hematologi' },
];

/** Urutan kelompok saat ditampilkan; deskriptor berbobot besar lebih dulu. */
export const SLEDAI_KELOMPOK = [
  'Saraf',
  'Vaskular',
  'Muskuloskeletal',
  'Ginjal',
  'Kulit & mukosa',
  'Serosa',
  'Imunologi',
  'Konstitusional',
  'Hematologi',
];

/**
 * Ambang kategori aktivitas penyakit.
 *
 * ⚠️ Berbeda dengan bobot deskriptor, ambang ini TIDAK baku — sumber berbeda
 * memakai potongan berbeda. Wajib dicocokkan dengan rujukan yang dipakai di
 * protokol penelitian sebelum dipakai sebagai luaran formal.
 */
export const SLEDAI_KATEGORI: { min: number; label: string }[] = [
  { min: 20, label: 'Sangat tinggi' },
  { min: 11, label: 'Tinggi' },
  { min: 6, label: 'Sedang' },
  { min: 1, label: 'Ringan' },
  { min: 0, label: 'Tidak ada aktivitas' },
];
