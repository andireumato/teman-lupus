/**
 * SLEDAI-2K — 24 deskriptor aktivitas penyakit, diisi DOKTER.
 *
 * RUJUKAN
 * - Gladman DD, Ibañez D, Urowitz MB. Systemic lupus erythematosus disease
 *   activity index 2000. J Rheumatol 2002;29(2):288–91. PMID 11838846.
 * - Bombardier C, Gladman DD, Urowitz MB, et al. Derivation of the SLEDAI.
 *   Arthritis Rheum 1992;35:630–40. PMID 1599520. (asal bobotnya)
 * - Suszek D, dkk. Reumatologia 2024;62(3):187–95. PMID 39055730 — tinjauan
 *   akses terbuka yang dipakai memverifikasi struktur & kategori di bawah.
 *
 * YANG SUDAH DIVERIFIKASI terhadap rujukan itu (27 Juli 2026):
 * - 24 deskriptor: 16 klinis + 8 berbasis laboratorium. Daftar di bawah
 *   memang 16 + 8 (silinder urin, hematuria, proteinuria, piuria, komplemen
 *   rendah, DNA meningkat, trombositopenia, leukopenia).
 * - Skor maksimum 105. Ini juga pemeriksaan aritmetika atas bobotnya:
 *   8×8 + 6×4 + 7×2 + 3×1 = 105 hanya benar bila komposisi bobotnya benar.
 * - SLEDAI-2K memberi poin pada ruam, alopesia, ulkus mukosa, dan proteinuria
 *   meski MENETAP — bukan hanya saat baru muncul atau kambuh. Inilah yang
 *   membedakannya dari SLEDAI asli.
 *
 * JENDELA WAKTU: deskriptor dihitung bila ada dalam **30 hari terakhir**,
 * bukan hanya saat pemeriksaan. Versi pertama layar ini keliru menulis "saat
 * ini" dan sudah diperbaiki.
 *
 * ⚠️ Terjemahan Indonesianya tetap perlu disahkan reumatolog penanggung jawab.
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
  { key: 'proteinuria', label: 'Proteinuria > 0,5 g/hari', bobot: 4, kelompok: 'Ginjal' },
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
 * Mengikuti pembagian yang dikutip Suszek dkk. (Reumatologia 2024) dari
 * Carter EE, Barr SG, Clarke AE. The global burden of SLE. Nat Rev Rheumatol
 * 2016;12:605–620 (PMID 27558659):
 *
 *   remisi   SLEDAI-2K = 0
 *   ringan   0 < SLEDAI-2K ≤ 6
 *   sedang   6 < SLEDAI-2K ≤ 12
 *   berat    SLEDAI-2K > 12
 *
 * ⚠️ Versi pertama file ini memakai potongan 1–5 / 6–10 / 11–19 / ≥20 yang
 * saya susun dari ingatan dan TIDAK cocok dengan rujukan mana pun yang bisa
 * ditelusuri. Sudah diganti. Berbeda dengan bobot deskriptor, potongan ini
 * memang bukan bagian instrumen — sumber lain memakai pembagian lain, jadi
 * tetap cocokkan dengan rujukan yang dipakai protokol penelitian Anda.
 *
 * Sebagai pembanding, ambang lain yang lazim dikutip untuk keperluan berbeda:
 * aktivitas rendah (LDA) SLEDAI-2K < 3, aktivitas tinggi (HDA) > 6.
 */
export const SLEDAI_KATEGORI: { min: number; label: string }[] = [
  { min: 13, label: 'Berat' },
  { min: 7, label: 'Sedang' },
  { min: 1, label: 'Ringan' },
  { min: 0, label: 'Remisi' },
];
