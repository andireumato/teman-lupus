/**
 * Skoring SLEDAI-2K.
 *
 * Murni tanpa I/O, sama seperti red-flag engine dan perakit ringkasan: skor
 * yang salah diam-diam lebih berbahaya daripada layar yang error, jadi
 * aturannya harus bisa diuji baris per baris.
 *
 * Deskriptor & bobotnya ada di `constants/sledai.ts`.
 */

import { SLEDAI_DESKRIPTOR, SLEDAI_KATEGORI } from '@/constants/sledai';

export type SledaiDeskriptorSet = Record<string, boolean>;

export interface SkorSledai {
  total: number;
  kategori: string;
  /** Deskriptor yang bernilai true, urut dari bobot terbesar. */
  aktif: { key: string; label: string; bobot: number }[];
}

export class SledaiKeyTidakDikenalError extends Error {
  constructor(key: string) {
    super(`Deskriptor SLEDAI tidak dikenal: ${key}`);
    this.name = 'SledaiKeyTidakDikenalError';
  }
}

const PETA = new Map(SLEDAI_DESKRIPTOR.map((d) => [d.key, d]));

/** Skor tertinggi yang mungkin — dipakai untuk konteks pembacaan. */
export const SLEDAI_MAKS = SLEDAI_DESKRIPTOR.reduce((n, d) => n + d.bobot, 0);

export function kategoriSledai(total: number): string {
  return SLEDAI_KATEGORI.find((k) => total >= k.min)?.label ?? SLEDAI_KATEGORI[0].label;
}

/**
 * Jumlahkan bobot deskriptor yang dicentang.
 *
 * Melempar bila ada kunci yang tidak dikenal — lebih baik gagal keras
 * daripada diam-diam menjumlahkan skor yang kehilangan satu deskriptor
 * karena namanya berubah.
 */
export function scoreSledai(dipilih: SledaiDeskriptorSet): SkorSledai {
  for (const key of Object.keys(dipilih)) {
    if (!PETA.has(key)) throw new SledaiKeyTidakDikenalError(key);
  }

  const aktif = SLEDAI_DESKRIPTOR.filter((d) => dipilih[d.key] === true).map((d) => ({
    key: d.key,
    label: d.label,
    bobot: d.bobot,
  }));

  const total = aktif.reduce((n, d) => n + d.bobot, 0);
  return { total, kategori: kategoriSledai(total), aktif };
}
