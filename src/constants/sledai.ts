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
  /**
   * Definisi baku deskriptor — yang menentukan boleh atau tidaknya dicentang.
   *
   * ⚠️ BELUM DIVERIFIKASI KATA-PER-KATA. Berbeda dengan struktur, bobot, dan
   * kategori di atas — yang dicocokkan ke sumber yang bisa dibaca — definisi
   * ini ditulis dari pengetahuan baku SLEDAI (Bombardier dkk. 1992) karena
   * tabel definisinya ada di lampiran yang tidak tersedia sebagai teks
   * terbuka. Mohon dicocokkan dengan naskah aslinya sebelum dipakai ke pasien.
   */
  definisi: string;
}

export const SLEDAI_DESKRIPTOR: DeskriptorSledai[] = [
  // ---- Bobot 8 ----
  {
    key: 'kejang',
    label: 'Kejang',
    bobot: 8,
    kelompok: 'Saraf',
    definisi: 'Awitan baru. Singkirkan sebab metabolik, infeksi, dan obat.',
  },
  {
    key: 'psikosis',
    label: 'Psikosis',
    bobot: 8,
    kelompok: 'Saraf',
    definisi:
      'Gangguan berat kemampuan menjalankan aktivitas normal akibat gangguan persepsi realitas: halusinasi, inkoherensi, asosiasi longgar yang nyata, isi pikir miskin, pikiran sangat tidak logis, atau perilaku aneh/disorganisasi/katatonik. Singkirkan uremia dan sebab obat.',
  },
  {
    key: 'sindrom_otak_organik',
    label: 'Sindrom otak organik',
    bobot: 8,
    kelompok: 'Saraf',
    definisi:
      'Gangguan fungsi mental dengan gangguan orientasi, memori, atau fungsi intelektual lain; awitan cepat dan gambaran klinis berfluktuasi; tidak mampu mempertahankan perhatian terhadap lingkungan; ditambah ≥2 dari: gangguan persepsi, bicara inkoheren, insomnia atau mengantuk sepanjang siang, aktivitas psikomotor meningkat atau menurun. Singkirkan sebab metabolik, infeksi, dan obat.',
  },
  {
    key: 'gangguan_penglihatan',
    label: 'Gangguan penglihatan',
    bobot: 8,
    kelompok: 'Saraf',
    definisi:
      'Perubahan retina akibat SLE: cytoid bodies, perdarahan retina, eksudat serosa atau perdarahan di koroid, atau neuritis optik. Singkirkan hipertensi, infeksi, dan sebab obat.',
  },
  {
    key: 'gangguan_saraf_kranial',
    label: 'Gangguan saraf kranial',
    bobot: 8,
    kelompok: 'Saraf',
    definisi: 'Awitan baru neuropati sensorik atau motorik yang melibatkan saraf kranial.',
  },
  {
    key: 'nyeri_kepala_lupus',
    label: 'Nyeri kepala lupus',
    bobot: 8,
    kelompok: 'Saraf',
    definisi:
      'Nyeri kepala berat dan menetap; boleh bersifat migrainosa, tetapi harus tidak responsif terhadap analgesik narkotik.',
  },
  {
    key: 'cva',
    label: 'Cerebrovascular accident (stroke)',
    bobot: 8,
    kelompok: 'Saraf',
    definisi: 'Awitan baru kejadian serebrovaskular. Singkirkan aterosklerosis.',
  },
  {
    key: 'vaskulitis',
    label: 'Vaskulitis',
    bobot: 8,
    kelompok: 'Vaskular',
    definisi:
      'Ulserasi, gangren, nodul jari yang nyeri, infark periungual, splinter hemorrhage; atau bukti vaskulitis pada biopsi maupun angiogram.',
  },

  // ---- Bobot 4 ----
  {
    key: 'artritis',
    label: 'Artritis',
    bobot: 4,
    kelompok: 'Muskuloskeletal',
    definisi:
      'Lebih dari 2 sendi dengan nyeri disertai tanda radang: nyeri tekan, bengkak, atau efusi.',
  },
  {
    key: 'miositis',
    label: 'Miositis',
    bobot: 4,
    kelompok: 'Muskuloskeletal',
    definisi:
      'Nyeri atau kelemahan otot proksimal, disertai peningkatan kreatin fosfokinase/aldolase, perubahan elektromiogram, atau biopsi yang menunjukkan miositis.',
  },
  {
    key: 'silinder_urin',
    label: 'Silinder urin',
    bobot: 4,
    kelompok: 'Ginjal',
    definisi: 'Silinder heme-granular atau silinder eritrosit.',
  },
  {
    key: 'hematuria',
    label: 'Hematuria',
    bobot: 4,
    kelompok: 'Ginjal',
    definisi:
      'Lebih dari 5 eritrosit per lapang pandang besar. Singkirkan batu, infeksi, dan sebab lain.',
  },
  {
    key: 'proteinuria',
    label: 'Proteinuria > 0,5 g/hari',
    bobot: 4,
    kelompok: 'Ginjal',
    definisi: 'Lebih dari 0,5 gram per 24 jam.',
  },
  {
    key: 'piuria',
    label: 'Piuria',
    bobot: 4,
    kelompok: 'Ginjal',
    definisi: 'Lebih dari 5 leukosit per lapang pandang besar. Singkirkan infeksi.',
  },

  // ---- Bobot 2 ----
  {
    key: 'ruam',
    label: 'Ruam',
    bobot: 2,
    kelompok: 'Kulit & mukosa',
    definisi: 'Ruam bertipe inflamasi. Pada SLEDAI-2K tetap dihitung meski menetap.',
  },
  {
    key: 'alopesia',
    label: 'Alopesia',
    bobot: 2,
    kelompok: 'Kulit & mukosa',
    definisi:
      'Kerontokan rambut abnormal, berbercak maupun difus. Pada SLEDAI-2K tetap dihitung meski menetap.',
  },
  {
    key: 'ulkus_mukosa',
    label: 'Ulkus mukosa',
    bobot: 2,
    kelompok: 'Kulit & mukosa',
    definisi: 'Ulserasi di mulut atau hidung. Pada SLEDAI-2K tetap dihitung meski menetap.',
  },
  {
    key: 'pleuritis',
    label: 'Pleuritis',
    bobot: 2,
    kelompok: 'Serosa',
    definisi: 'Nyeri dada pleuritik disertai pleural rub, efusi, atau penebalan pleura.',
  },
  {
    key: 'perikarditis',
    label: 'Perikarditis',
    bobot: 2,
    kelompok: 'Serosa',
    definisi:
      'Nyeri perikardial disertai ≥1 dari: rub, efusi, atau konfirmasi elektrokardiogram maupun ekokardiogram.',
  },
  {
    key: 'komplemen_rendah',
    label: 'Komplemen rendah',
    bobot: 2,
    kelompok: 'Imunologi',
    definisi: 'Penurunan CH50, C3, atau C4 di bawah batas bawah normal laboratorium pemeriksa.',
  },
  {
    key: 'dna_meningkat',
    label: 'Peningkatan ikatan DNA',
    bobot: 2,
    kelompok: 'Imunologi',
    definisi: 'Ikatan >25% pada Farr assay, atau di atas rentang normal laboratorium pemeriksa.',
  },

  // ---- Bobot 1 ----
  {
    key: 'demam',
    label: 'Demam',
    bobot: 1,
    kelompok: 'Konstitusional',
    definisi: 'Suhu di atas 38 °C. Singkirkan sebab infeksi.',
  },
  {
    key: 'trombositopenia',
    label: 'Trombositopenia',
    bobot: 1,
    kelompok: 'Hematologi',
    definisi: 'Trombosit kurang dari 100.000/mm³.',
  },
  {
    key: 'leukopenia',
    label: 'Leukopenia',
    bobot: 1,
    kelompok: 'Hematologi',
    definisi: 'Leukosit kurang dari 3.000/mm³. Singkirkan sebab obat.',
  },
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
