/**
 * Efek samping obat yang dilaporkan PASIEN.
 *
 * ⚠️ DRAF — wajib direview reumatolog penanggung jawab. Daftar ini saya susun
 * dari efek samping yang lazim pada obat lupus (hidroksiklorokuin, steroid,
 * mikofenolat, azatioprin, metotreksat). Menambah, membuang, atau mengubah
 * kata-katanya adalah keputusan Anda.
 *
 * Kenapa TERPISAH dari gejala check-in harian, bukan digabung:
 *
 * Beberapa keluhan bisa datang dari lupusnya atau dari obatnya — ruam, rambut
 * rontok, sariawan, demam. Kalau keduanya dicampur dalam satu daftar, bagian 2
 * ringkasan ("gejala menonjol per sistem organ") akan menghitung efek obat
 * sebagai aktivitas penyakit. Yang membedakan keduanya adalah penilaian dokter,
 * bukan tebakan aplikasi — jadi aplikasi mencatat keduanya apa adanya, di
 * tempat berbeda, dan menyerahkan penafsirannya kepada Anda.
 */

export interface EfekSamping {
  key: string;
  label: string;
  kelompok: string;
  /**
   * True bila keluhan ini juga bisa menjadi tanda bahaya. Aplikasi TIDAK
   * mengeskalasi sendiri — ia hanya mengarahkan pasien ke Cek Flare, satu-
   * satunya jalur eskalasi (lihat lib/redflag.ts).
   */
  arahkanCekFlare?: boolean;
}

export const EFEK_SAMPING: EfekSamping[] = [
  // ---- Saluran cerna: paling sering pada MMF, AZA, MTX, steroid ----
  { key: 'mual', label: 'Mual atau muntah', kelompok: 'Saluran cerna' },
  { key: 'perut_perih', label: 'Nyeri ulu hati / perut perih', kelompok: 'Saluran cerna' },
  { key: 'diare', label: 'Diare', kelompok: 'Saluran cerna' },
  { key: 'nafsu_makan_naik', label: 'Nafsu makan meningkat', kelompok: 'Saluran cerna' },

  // ---- Kulit & rambut ----
  { key: 'ruam_gatal', label: 'Ruam atau gatal setelah minum obat', kelompok: 'Kulit & rambut' },
  { key: 'rambut_rontok', label: 'Rambut rontok', kelompok: 'Kulit & rambut' },
  { key: 'sariawan', label: 'Sariawan', kelompok: 'Kulit & rambut' },
  { key: 'mudah_memar', label: 'Mudah memar', kelompok: 'Kulit & rambut' },

  // ---- Saraf & penglihatan ----
  {
    key: 'gangguan_penglihatan',
    label: 'Pandangan kabur atau berubah',
    kelompok: 'Saraf & penglihatan',
    arahkanCekFlare: true,
  },
  { key: 'sakit_kepala', label: 'Sakit kepala', kelompok: 'Saraf & penglihatan' },
  { key: 'pusing', label: 'Pusing atau berkunang-kunang', kelompok: 'Saraf & penglihatan' },

  // ---- Steroid ----
  { key: 'sulit_tidur', label: 'Sulit tidur', kelompok: 'Efek steroid' },
  { key: 'mood_berubah', label: 'Suasana hati mudah berubah', kelompok: 'Efek steroid' },
  { key: 'wajah_membulat', label: 'Wajah tampak membulat', kelompok: 'Efek steroid' },
  { key: 'berat_naik', label: 'Berat badan naik', kelompok: 'Efek steroid' },

  // ---- Tanda infeksi: penting pada imunosupresan ----
  {
    key: 'demam',
    label: 'Demam',
    kelompok: 'Tanda infeksi',
    arahkanCekFlare: true,
  },
  { key: 'sering_infeksi', label: 'Lebih sering sakit / infeksi', kelompok: 'Tanda infeksi' },
];

/** Urutan kelompok saat ditampilkan. */
export const EFEK_KELOMPOK = [
  'Saluran cerna',
  'Kulit & rambut',
  'Saraf & penglihatan',
  'Efek steroid',
  'Tanda infeksi',
];

export const LABEL_EFEK = new Map(EFEK_SAMPING.map((e) => [e.key, e.label]));
