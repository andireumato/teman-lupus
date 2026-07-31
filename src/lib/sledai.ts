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

/**
 * Bentuk kolom `deskriptor` SEBAGAIMANA BENAR-BENAR ADA di database.
 *
 * Tipe di `types/database.ts` menjanjikan `Record<string, boolean>`, dan itu
 * benar untuk baris yang dibuat aplikasi ini. Tetapi baris warisan prototipe
 * web menyimpan LARIK LABEL — `["Artritis", "Ruam"]`. Union ini memaksa
 * pemanggil melewati `pisahkanDeskriptor()`, bukan mengasumsikan bentuknya.
 */
export type DeskriptorTersimpan = Record<string, boolean> | string[] | null | undefined;

/**
 * Memisahkan deskriptor yang dikenal dari yang tidak.
 *
 * `scoreSledai` sengaja MELEMPAR pada kunci asing, dan itu benar untuk jalur
 * PENGISIAN: kuncinya datang dari `SLEDAI_DESKRIPTOR`, jadi kunci asing berarti
 * ada yang rusak dan lebih baik ketahuan keras.
 *
 * Jalur PEMBACAAN berbeda, dan ada dua bentuk warisan yang harus ditangani:
 *
 *   objek berlabel  { "Ruam": true }        — kunci asing bernilai true
 *   LARIK label     ["Artritis", "Ruam"]    — bentuk prototipe web
 *
 * Larik itu yang paling berbahaya. `Object.entries(["Ruam"])` menghasilkan
 * `[["0", "Ruam"]]` — nilainya STRING, bukan `true`. Penanganan naif akan
 * membuang seluruh isinya diam-diam, barisnya terbaca kosong, dan DORIS
 * melaporkan "remisi tercapai" untuk pasien yang sebenarnya vaskulitis.
 *
 * Yang tidak dikenal dikembalikan apa adanya, bukan dibuang: yang memanggilnya
 * wajib memutuskan apa artinya, dan diam adalah jawaban terburuk.
 */
export function pisahkanDeskriptor(raw: DeskriptorTersimpan): {
  dipilih: SledaiDeskriptorSet;
  asing: string[];
} {
  const dipilih: SledaiDeskriptorSet = {};
  const asing: string[] = [];

  if (Array.isArray(raw)) {
    // Tiap elemen berarti "deskriptor ini ada", diidentifikasi lewat label
    // maupun kunci.
    for (const item of raw) {
      if (typeof item !== 'string') continue;
      if (PETA.has(item)) dipilih[item] = true;
      else asing.push(item);
    }
  } else {
    for (const [k, v] of Object.entries(raw ?? {})) {
      if (PETA.has(k)) dipilih[k] = v;
      else if (v === true) asing.push(k);
    }
  }

  return { dipilih, asing: asing.sort() };
}
