/**
 * MARS-5 — Medication Adherence Report Scale (5 item).
 *
 * Setiap item dinilai 1 (Selalu) sampai 5 (Tidak pernah); makin tinggi skor
 * makin patuh. Total 5–25.
 *
 * Ambang kategori mengikuti prototipe web yang sudah dipakai
 * (Tinggi ≥ 23, Sedang ≥ 18, selain itu Rendah).
 * ⚠️ Ambang ini perlu dikonfirmasi terhadap rujukan MARS-5 yang dipakai
 * dalam protokol penelitian sebelum dipakai sebagai luaran formal.
 */

export const MARS_ITEMS = [
  'Saya lupa minum obat',
  'Saya mengubah dosis obat',
  'Saya berhenti minum obat sementara',
  'Saya sengaja melewatkan satu dosis',
  'Saya minum lebih sedikit dari anjuran',
] as const;

export const MARS_SKALA = [
  { v: 1, label: 'Selalu' },
  { v: 2, label: 'Sering' },
  { v: 3, label: 'Kadang' },
  { v: 4, label: 'Jarang' },
  { v: 5, label: 'Tidak pernah' },
] as const;

export type MarsKategori = 'Tinggi' | 'Sedang' | 'Rendah';

export interface MarsScore {
  total: number;
  kategori: MarsKategori;
}

export class MarsIncompleteError extends Error {
  constructor() {
    super('Kelima pertanyaan MARS-5 harus dijawab.');
    this.name = 'MarsIncompleteError';
  }
}

/**
 * Hitung total & kategori. Melempar bila ada item yang belum dijawab atau
 * di luar rentang 1–5 — lebih baik gagal keras daripada menyimpan skor
 * yang diam-diam salah ke database penelitian.
 */
export function scoreMars(items: (number | null | undefined)[]): MarsScore {
  if (items.length !== MARS_ITEMS.length) throw new MarsIncompleteError();

  const nilai: number[] = [];
  for (const it of items) {
    if (it == null) throw new MarsIncompleteError();
    if (!Number.isInteger(it) || it < 1 || it > 5) {
      throw new RangeError(`Nilai MARS-5 harus bilangan bulat 1–5, diterima: ${it}`);
    }
    nilai.push(it);
  }

  const total = nilai.reduce((a, b) => a + b, 0);
  const kategori: MarsKategori = total >= 23 ? 'Tinggi' : total >= 18 ? 'Sedang' : 'Rendah';
  return { total, kategori };
}
