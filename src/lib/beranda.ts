/**
 * Logika layar Beranda: salam, konten harian, tingkatan streak, dan insight.
 *
 * Semua fungsi di sini murni (tanpa I/O) supaya bisa diuji. Insight bersifat
 * refleksi atas data yang pasien catat sendiri — BUKAN penilaian klinis dan
 * BUKAN pengganti red-flag engine, yang tetap satu-satunya jalur eskalasi.
 */

import { QUOTES, TIPS } from '@/constants/edukasi';

export function salamWaktu(jam: number): string {
  if (jam < 11) return 'Selamat pagi';
  if (jam < 15) return 'Selamat siang';
  if (jam < 18) return 'Selamat sore';
  return 'Selamat malam';
}

/** Hari ke-berapa dalam setahun (1 Januari = 1), memakai tanggal lokal. */
export function hariKe(d: Date): number {
  const awal = new Date(d.getFullYear(), 0, 0);
  const kini = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  return Math.round((kini.getTime() - awal.getTime()) / 86_400_000);
}

function putar<T>(list: readonly T[], d: Date): T {
  const i = hariKe(d) % list.length;
  return list[(i + list.length) % list.length];
}

export function quoteHariIni(d: Date = new Date()): string {
  return putar(QUOTES, d);
}

export function tipHariIni(d: Date = new Date()): string {
  return putar(TIPS, d);
}

// ---------- Tingkatan streak ----------

/** Nama ikon Ionicons — disempitkan agar tidak perlu cast di sisi komponen. */
export type TierIkon =
  | 'leaf-outline'
  | 'star-outline'
  | 'barbell-outline'
  | 'medal-outline'
  | 'trophy-outline'
  | 'diamond-outline';

export interface Tier {
  n: number;
  ikon: TierIkon;
  label: string;
}

/** Ikon vektor, bukan emoji — lihat catatan di components/mood-scale.tsx. */
export const TIERS: Tier[] = [
  { n: 3, ikon: 'leaf-outline', label: '3 hari' },
  { n: 7, ikon: 'star-outline', label: '7 hari' },
  { n: 14, ikon: 'barbell-outline', label: '2 minggu' },
  { n: 30, ikon: 'medal-outline', label: '1 bulan' },
  { n: 60, ikon: 'trophy-outline', label: '2 bulan' },
  { n: 100, ikon: 'diamond-outline', label: '100 hari' },
];

export interface StreakInfo {
  /** Tingkatan tertinggi yang sudah dicapai; null bila streak < 3. */
  earned: Tier | null;
  /** Tingkatan berikutnya; null bila semua sudah tercapai. */
  next: Tier | null;
}

export function streakInfo(n: number): StreakInfo {
  let earned: Tier | null = null;
  let next: Tier | null = null;
  for (const t of TIERS) {
    if (n >= t.n) earned = t;
    else {
      next = t;
      break;
    }
  }
  return { earned, next };
}

/** True bila streak tepat menyentuh sebuah tingkatan hari ini. */
export function tepatMilestone(n: number): Tier | null {
  return TIERS.find((t) => t.n === n) ?? null;
}

// ---------- Insight ----------

export interface CheckinRingkas {
  tanggal: string;
  mood: number | null;
  nyeri_sendi: number | null;
}

export type InsightNada = 'netral' | 'baik' | 'perhatian';

export interface Insight {
  teks: string;
  nada: InsightNada;
}

const rata = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;

/**
 * Umpan balik personal dari riwayat check-in.
 *
 * Duplikat per tanggal dirapikan lebih dulu (entri terakhir menang), karena
 * pasien bisa memperbarui check-in di hari yang sama.
 */
export function insightText(rows: CheckinRingkas[]): Insight | null {
  if (rows.length === 0) return null;

  const perTanggal = new Map<string, CheckinRingkas>();
  for (const r of rows) {
    if (r.tanggal) perTanggal.set(r.tanggal, r);
  }
  const arr = [...perTanggal.keys()].sort().map((k) => perTanggal.get(k)!);

  if (arr.length < 2) {
    return { teks: 'Terima kasih sudah memulai. Konsistensi kecil sangat berarti.', nada: 'baik' };
  }

  const moods = arr.map((c) => c.mood).filter((v): v is number => v != null);
  const pains = arr.map((c) => c.nyeri_sendi).filter((v): v is number => v != null);
  const last = arr[arr.length - 1];

  let painRise = 1;
  for (let i = pains.length - 1; i > 0; i--) {
    if (pains[i] > pains[i - 1]) painRise++;
    else break;
  }
  if (painRise >= 3) {
    return {
      teks: `Nyeri sendimu meningkat ${painRise} hari terakhir. Bila terus memberat, coba Cek Flare atau hubungi dokter.`,
      nada: 'perhatian',
    };
  }

  let moodUp = 1;
  for (let i = moods.length - 1; i > 0; i--) {
    if (moods[i] > moods[i - 1]) moodUp++;
    else break;
  }
  if (moodUp >= 3) {
    return { teks: `Mood-mu membaik ${moodUp} hari berturut — pertahankan!`, nada: 'baik' };
  }

  const mingguIni = moods.slice(-7);
  const mingguLalu = moods.slice(-14, -7);
  if (mingguIni.length >= 3 && mingguLalu.length >= 3) {
    const a = rata(mingguIni);
    const b = rata(mingguLalu);
    if (a - b >= 0.5) {
      return { teks: 'Rata-rata mood-mu minggu ini lebih baik dari minggu lalu.', nada: 'baik' };
    }
    if (b - a >= 0.5) {
      return {
        teks: 'Minggu ini terasa lebih berat. Beri dirimu waktu & istirahat lebih.',
        nada: 'perhatian',
      };
    }
  }

  if (last.nyeri_sendi != null && last.nyeri_sendi >= 3) {
    return {
      teks: 'Nyeri sendimu cukup tinggi hari ini. Istirahatkan sendi & pantau ya.',
      nada: 'perhatian',
    };
  }

  // Tidak menyebut "rutin": pasien bisa punya riwayat panjang tetapi sedang
  // terputus streak-nya, dan kartu streak di atasnya sudah bilang sebaliknya.
  return {
    teks: 'Setiap catatanmu membantu dokter memantau kondisimu. Terima kasih.',
    nada: 'netral',
  };
}
