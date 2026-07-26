/**
 * Konstanta klinis Teman Lupus.
 *
 * Nilai rujukan lab di bawah disalin dari prototipe web dan bersifat
 * INDIKATIF untuk menandai "di luar rentang" pada tampilan pasien.
 * Rentang rujukan sebenarnya berbeda antar laboratorium — angka ini
 * wajib direview reumatolog sebelum dipakai ke pasien nyata.
 */

import { Brand } from '@/constants/brand';

export interface LabRef {
  /** Nama pemeriksaan, dipakai sebagai kolom `jenis` di lab_results. */
  k: string;
  /** Satuan default. */
  u: string;
  /** Batas bawah rujukan. */
  lo?: number;
  /** Batas atas rujukan. */
  hi?: number;
}

export const LABS: LabRef[] = [
  { k: 'Anti-dsDNA', u: 'IU/mL', hi: 30 },
  { k: 'Komplemen C3', u: 'mg/dL', lo: 90, hi: 180 },
  { k: 'Komplemen C4', u: 'mg/dL', lo: 10, hi: 40 },
  { k: 'CRP', u: 'mg/L', hi: 5 },
  { k: 'LED/ESR', u: 'mm/jam', hi: 20 },
  { k: 'Hemoglobin', u: 'g/dL', lo: 12, hi: 16 },
  { k: 'Leukosit', u: '/µL', lo: 4000, hi: 11000 },
  { k: 'Trombosit', u: '/µL', lo: 150000, hi: 400000 },
  { k: 'Kreatinin', u: 'mg/dL', lo: 0.6, hi: 1.2 },
  { k: 'Proteinuria 24 jam', u: 'mg/24jam', hi: 150 },
  { k: 'Rasio Protein/Kreatinin urin', u: 'mg/g', hi: 150 },
  { k: 'Vitamin D 25-OH', u: 'ng/mL', lo: 30, hi: 100 },
];

export const ANA_ANTIBODIES = [
  'dsDNA',
  'Sm',
  'U1-RNP',
  'SS-A (Ro)',
  'SS-B (La)',
  'Scl-70',
  'Jo-1',
  'Sentromer',
  'Nukleosom',
  'Histon',
  'Ribosomal-P',
  'PM-Scl',
  'AMA-M2',
  'PCNA',
] as const;

export const ANA_PROFILE = 'ANA Profile';

export function labRef(jenis: string): LabRef | undefined {
  return LABS.find((l) => l.k === jenis);
}

/** True bila nilai berada di luar rentang rujukan indikatif. */
export function labAbnormal(jenis: string, nilai: number | null): boolean {
  const r = labRef(jenis);
  if (!r || nilai == null) return false;
  return (r.lo != null && nilai < r.lo) || (r.hi != null && nilai > r.hi);
}

/**
 * Skrining gejala per sistem organ (Bagian 5 spesifikasi MVP).
 * Bahasa awam, bukan istilah medis.
 */
export const SISTEM_GEJALA: { system: string; label: string; items: string[] }[] = [
  {
    system: 'konstitusional',
    label: 'Umum',
    items: ['Kelelahan luar biasa', 'Demam', 'Berat badan turun'],
  },
  {
    system: 'kulit',
    label: 'Kulit & mulut',
    items: [
      'Ruam di wajah/pipi',
      'Ruam muncul setelah kena matahari',
      'Sariawan',
      'Rambut rontok',
      'Jari memutih/membiru saat dingin',
    ],
  },
  {
    system: 'sendi',
    label: 'Sendi & otot',
    items: ['Nyeri sendi', 'Bengkak sendi', 'Kaku saat bangun pagi', 'Nyeri otot'],
  },
  {
    system: 'ginjal',
    label: 'Ginjal',
    items: ['Bengkak di kaki/kelopak mata', 'Urin berbusa', 'Jumlah buang air kecil berubah'],
  },
  {
    system: 'kardiopulmoner',
    label: 'Jantung & paru',
    items: ['Nyeri dada', 'Sesak napas'],
  },
  {
    system: 'saraf',
    label: 'Saraf',
    items: [
      'Sakit kepala hebat',
      'Kejang',
      'Bingung / sulit fokus',
      'Gangguan penglihatan',
      'Kebas atau lemah satu sisi',
    ],
  },
  {
    system: 'darah',
    label: 'Darah',
    items: ['Mudah memar', 'Perdarahan tidak biasa', 'Tampak pucat/lemas'],
  },
];

export const PERUBAHAN_GEJALA = ['baru', 'membaik', 'sama', 'memburuk'] as const;

/** Skala check-in harian, mengikuti constraint kolom di Supabase. */
export const SKALA_MOOD = [
  { v: 1, label: 'Sangat buruk' },
  { v: 2, label: 'Buruk' },
  { v: 3, label: 'Biasa' },
  { v: 4, label: 'Baik' },
  { v: 5, label: 'Sangat baik' },
];

export interface OpsiSkala {
  v: number;
  label: string;
  /** Keterangan pendek di bawah label, bila ada. */
  ket?: string;
  /**
   * Titik berwarna di kiri label.
   *
   * Reumatolog menuliskan tingkatannya dengan emoji (⚪🟢🟡🔴). Emoji tidak
   * dipakai di aplikasi native — tidak dijamin punya glyph dan bisa tampil
   * sebagai kotak kosong, lihat catatan di `components/mood-scale.tsx` —
   * jadi kode warnanya diwujudkan sebagai titik.
   */
  warna?: string;
}

/** Abu → hijau → kuning → merah, untuk skala 0–3 yang makin berat. */
const WARNA_TINGKAT = [Brand.teksLembut, Brand.hijau, Brand.kuning, Brand.merah];

/**
 * Patokan tiap tingkat kelelahan ditulis reumatolog penanggung jawab
 * (27 Juli 2026). Sengaja berbasis FUNGSI — apa yang masih bisa dikerjakan —
 * bukan seberapa "capek" rasanya, supaya penilaian pasien konsisten antar
 * hari dan antar pasien.
 *
 * Kalimatnya diseragamkan dengan `SKALA_NYERI_SENDI`: sudut pandang pasien
 * ("saya"), pola Terasa… → mengganggu, harus dikurangi → tidak bisa mengurus
 * diri. Isinya tidak berubah, hanya suaranya.
 *
 * Tingkat "Sangat berat" (nilai 4) DIHAPUS 27 Juli 2026: patokan "Berat" sudah
 * mencakup pasien yang sebagian besar harinya berbaring, jadi tidak ada ruang
 * bermakna di atasnya — dan tingkat tanpa patokan membuat data antar pasien
 * tidak sebanding. Skalanya kini 0–3, sama panjang dengan nyeri sendi.
 *
 * Constraint database sengaja dibiarkan `between 0 and 4`: 0–3 tetap sah, dan
 * baris lama bernilai 4 tidak perlu diubah. Yang menanganinya ada di sisi
 * aplikasi — lihat `checkin.tsx` (nilai di luar skala dikosongkan agar tidak
 * tersimpan ulang diam-diam) dan `BarChart` di `tren.tsx` (tinggi bar dibatasi).
 */
export const SKALA_LELAH: OpsiSkala[] = [
  {
    v: 0,
    label: 'Tidak ada',
    ket: 'Tidak ada rasa lelah yang mengganggu sama sekali.',
    warna: WARNA_TINGKAT[0],
  },
  {
    v: 1,
    label: 'Ringan',
    ket: 'Terasa lelah, tetapi hilang setelah istirahat; kegiatan sehari-hari tetap berjalan seperti biasa.',
    warna: WARNA_TINGKAT[1],
  },
  {
    v: 2,
    label: 'Sedang',
    ket: 'Lelah tidak hilang meski sudah istirahat; saya harus mengurangi pekerjaan rumah/kantor, belanja, atau ibadah.',
    warna: WARNA_TINGKAT[2],
  },
  {
    v: 3,
    label: 'Berat',
    ket: 'Lelah membuat saya kesulitan mengurus diri sendiri (mandi, berpakaian, makan); sebagian besar hari saya habiskan berbaring.',
    warna: WARNA_TINGKAT[3],
  },
];

/**
 * Patokan tiap tingkat nyeri sendi, ditulis reumatolog penanggung jawab
 * (27 Juli 2026). Sama seperti `SKALA_LELAH`, patokannya berbasis dampak pada
 * kegiatan — bukan seberapa "sakit" rasanya — supaya penilaian pasien
 * konsisten antar hari dan antar pasien.
 */
export const SKALA_NYERI_SENDI: OpsiSkala[] = [
  {
    v: 0,
    label: 'Tidak ada',
    ket: 'Tidak ada nyeri sendi sama sekali.',
    warna: WARNA_TINGKAT[0],
  },
  {
    v: 1,
    label: 'Ringan',
    ket: 'Terasa nyeri, tetapi bisa saya abaikan; kegiatan sehari-hari tetap berjalan seperti biasa.',
    warna: WARNA_TINGKAT[1],
  },
  {
    v: 2,
    label: 'Sedang',
    ket: 'Nyeri mengganggu; saya harus mengurangi atau memperlambat kegiatan.',
    warna: WARNA_TINGKAT[2],
  },
  {
    v: 3,
    label: 'Berat',
    ket: 'Nyeri membuat sendi hampir tidak bisa digunakan, atau membuat saya terbangun di malam hari.',
    warna: WARNA_TINGKAT[3],
  },
];
