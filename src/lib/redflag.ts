/**
 * RED-FLAG ENGINE — [DETERMINISTIK]
 *
 * Implementasi Bagian 6 "Spesifikasi MVP — Teman Lupus".
 * Keputusan eskalasi ditentukan HANYA oleh aturan eksplisit di bawah ini.
 * Tidak ada model bahasa, tidak ada heuristik, tidak ada skor probabilistik.
 *
 * Prinsip fail-safe: bila ragu, eskalasi ke tingkat yang lebih tinggi.
 *
 * ⚠️ Ambang dan definisi di file ini adalah KERANGKA AWAL dan wajib direview
 * oleh reumatolog penanggung jawab sebelum dipakai ke pasien nyata.
 */

import type { FlareResult } from '@/types/database';

/** Jawaban pasien: satu boolean per tanda. Tidak ada nilai "mungkin". */
export interface RedFlagInput {
  // --- Tanda bahaya (ditanya di layar Cek Flare) ---
  nyeri_dada: boolean;
  sesak_napas: boolean;
  sesak_napas_berat: boolean;
  kejang: boolean;
  bingung_atau_penurunan_kesadaran: boolean;
  lemah_kebas_satu_sisi: boolean;
  bicara_pelo: boolean;
  gangguan_penglihatan_mendadak: boolean;
  demam_tinggi: boolean;
  perdarahan_signifikan: boolean;
  memar_luas_mendadak: boolean;

  // --- Tanda mendesak ---
  bengkak_kaki_atau_wajah_baru: boolean;
  urin_berbusa: boolean;
  jumlah_urin_menurun: boolean;
  demam_tanpa_sebab_jelas: boolean;
  nyeri_bengkak_betis_satu_sisi: boolean;

  // --- Konteks, bukan gejala ---
  /** Pasien sedang memakai imunosupresan / steroid dosis signifikan. */
  imunosupresan_aktif: boolean;
  /** Gejala memburuk beberapa hari berturut-turut (dihitung dari riwayat check-in). */
  memburuk_beruntun: boolean;
}

export type RedFlagLevel = 'darurat' | 'mendesak' | 'aman';

export interface FiredRule {
  id: string;
  level: Exclude<RedFlagLevel, 'aman'>;
  /** Kalimat yang ditampilkan ke pasien & masuk ke ringkasan pra-kunjungan. */
  alasan: string;
}

export interface RedFlagVerdict {
  level: RedFlagLevel;
  /** Dipetakan ke kolom flare_checks.hasil */
  hasil: FlareResult;
  rules: FiredRule[];
  pesan: string;
}

type Rule = {
  id: string;
  level: Exclude<RedFlagLevel, 'aman'>;
  alasan: string;
  test: (i: RedFlagInput) => boolean;
};

/** Urutan penting hanya untuk keterbacaan laporan; semua aturan selalu dievaluasi. */
const RULES: Rule[] = [
  // ---------- DARURAT → IGD sekarang ----------
  {
    id: 'darurat.nyeri_dada_dengan_sesak',
    level: 'darurat',
    alasan: 'Nyeri dada disertai sesak napas',
    test: (i) => i.nyeri_dada && i.sesak_napas,
  },
  {
    id: 'darurat.sesak_berat',
    level: 'darurat',
    alasan: 'Sesak napas berat / sulit bernapas',
    test: (i) => i.sesak_napas_berat,
  },
  {
    id: 'darurat.kejang',
    level: 'darurat',
    alasan: 'Kejang',
    test: (i) => i.kejang,
  },
  {
    id: 'darurat.kesadaran_menurun',
    level: 'darurat',
    alasan: 'Bingung baru atau penurunan kesadaran',
    test: (i) => i.bingung_atau_penurunan_kesadaran,
  },
  {
    id: 'darurat.defisit_neurologis_mendadak',
    level: 'darurat',
    alasan: 'Kelemahan/kebas satu sisi, bicara pelo, atau gangguan penglihatan mendadak',
    test: (i) => i.lemah_kebas_satu_sisi || i.bicara_pelo || i.gangguan_penglihatan_mendadak,
  },
  {
    id: 'darurat.demam_pada_imunosupresi',
    level: 'darurat',
    alasan: 'Demam tinggi saat memakai imunosupresan/steroid (risiko infeksi serius)',
    test: (i) => i.demam_tinggi && i.imunosupresan_aktif,
  },
  {
    id: 'darurat.perdarahan',
    level: 'darurat',
    alasan: 'Perdarahan signifikan atau memar luas mendadak',
    test: (i) => i.perdarahan_signifikan || i.memar_luas_mendadak,
  },

  // ---------- MENDESAK → hubungi tim ≤24 jam ----------
  {
    id: 'mendesak.dugaan_keterlibatan_ginjal',
    level: 'mendesak',
    alasan: 'Bengkak baru di kaki/wajah disertai urin berbusa atau jumlah urin menurun',
    test: (i) => i.bengkak_kaki_atau_wajah_baru && (i.urin_berbusa || i.jumlah_urin_menurun),
  },
  {
    id: 'mendesak.demam_tanpa_sebab',
    level: 'mendesak',
    alasan: 'Demam tanpa penyebab yang jelas',
    test: (i) => i.demam_tanpa_sebab_jelas || (i.demam_tinggi && !i.imunosupresan_aktif),
  },
  {
    id: 'mendesak.dugaan_trombosis',
    level: 'mendesak',
    alasan: 'Nyeri/bengkak betis satu sisi',
    test: (i) => i.nyeri_bengkak_betis_satu_sisi,
  },
  {
    id: 'mendesak.perburukan_beruntun',
    level: 'mendesak',
    alasan: 'Gejala memburuk beberapa hari berturut-turut',
    test: (i) => i.memburuk_beruntun,
  },
];

const PESAN_DARURAT =
  'Beberapa keluhan yang Anda sampaikan termasuk yang sebaiknya tidak ditunda. ' +
  'Mohon segera ke IGD terdekat atau hubungi layanan gawat darurat. ' +
  'Saya bukan pengganti penilaian dokter, jadi keputusan medis tetap di tangan tenaga kesehatan. ' +
  'Keluhan ini sudah saya catat.';

const PESAN_MENDESAK =
  'Beberapa keluhan yang Anda sampaikan sebaiknya tidak menunggu jadwal kontrol. ' +
  'Mohon hubungi tim dokter Anda dalam 24 jam ke depan. ' +
  'Saya bukan pengganti penilaian dokter, jadi keputusan medis tetap di tangan tenaga kesehatan. ' +
  'Keluhan ini sudah saya catat.';

const PESAN_AMAN =
  'Keluhan Anda sudah dicatat untuk dibahas saat kontrol nanti. ' +
  'Bila keluhan memburuk atau muncul keluhan baru, jangan menunggu jadwal — hubungi tim dokter Anda.';

/** Semua field bernilai false. Dipakai sebagai titik awal form. */
export const EMPTY_INPUT: RedFlagInput = {
  nyeri_dada: false,
  sesak_napas: false,
  sesak_napas_berat: false,
  kejang: false,
  bingung_atau_penurunan_kesadaran: false,
  lemah_kebas_satu_sisi: false,
  bicara_pelo: false,
  gangguan_penglihatan_mendadak: false,
  demam_tinggi: false,
  perdarahan_signifikan: false,
  memar_luas_mendadak: false,
  bengkak_kaki_atau_wajah_baru: false,
  urin_berbusa: false,
  jumlah_urin_menurun: false,
  demam_tanpa_sebab_jelas: false,
  nyeri_bengkak_betis_satu_sisi: false,
  imunosupresan_aktif: false,
  memburuk_beruntun: false,
};

/**
 * Evaluasi seluruh aturan. Murni, tanpa efek samping, tanpa I/O —
 * sehingga bisa diuji ulang dan diaudit baris per baris.
 */
export function evaluateRedFlags(input: RedFlagInput): RedFlagVerdict {
  const fired = RULES.filter((r) => r.test(input)).map(({ id, level, alasan }) => ({
    id,
    level,
    alasan,
  }));

  const adaDarurat = fired.some((r) => r.level === 'darurat');
  const adaMendesak = fired.some((r) => r.level === 'mendesak');

  if (adaDarurat) {
    return { level: 'darurat', hasil: 'red', rules: fired, pesan: PESAN_DARURAT };
  }
  if (adaMendesak) {
    return { level: 'mendesak', hasil: 'yellow', rules: fired, pesan: PESAN_MENDESAK };
  }
  return { level: 'aman', hasil: 'green', rules: [], pesan: PESAN_AMAN };
}

/** Label pertanyaan dalam bahasa awam, dipakai layar Cek Flare. */
export const PERTANYAAN_TANDA_BAHAYA: { key: keyof RedFlagInput; label: string }[] = [
  { key: 'nyeri_dada', label: 'Nyeri dada' },
  { key: 'sesak_napas', label: 'Sesak napas' },
  { key: 'sesak_napas_berat', label: 'Sesak napas berat / sulit bernapas' },
  { key: 'kejang', label: 'Kejang' },
  { key: 'bingung_atau_penurunan_kesadaran', label: 'Bingung atau kesadaran menurun' },
  { key: 'lemah_kebas_satu_sisi', label: 'Lemah atau kebas mendadak di satu sisi tubuh' },
  { key: 'bicara_pelo', label: 'Bicara tiba-tiba pelo' },
  { key: 'gangguan_penglihatan_mendadak', label: 'Penglihatan terganggu mendadak' },
  { key: 'demam_tinggi', label: 'Demam tinggi' },
  { key: 'perdarahan_signifikan', label: 'Perdarahan yang tidak biasa' },
  { key: 'memar_luas_mendadak', label: 'Memar luas yang muncul mendadak' },
];

export const PERTANYAAN_MENDESAK: { key: keyof RedFlagInput; label: string }[] = [
  { key: 'bengkak_kaki_atau_wajah_baru', label: 'Bengkak baru di kaki atau kelopak mata/wajah' },
  { key: 'urin_berbusa', label: 'Urin berbusa' },
  { key: 'jumlah_urin_menurun', label: 'Jumlah buang air kecil berkurang' },
  { key: 'demam_tanpa_sebab_jelas', label: 'Demam tanpa sebab yang jelas' },
  { key: 'nyeri_bengkak_betis_satu_sisi', label: 'Nyeri atau bengkak di betis satu sisi' },
];
