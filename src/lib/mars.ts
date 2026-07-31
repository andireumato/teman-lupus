/**
 * MARS-5 — Medication Adherence Report Scale (5 item).
 *
 * Setiap item dinilai 1 (Selalu) sampai 5 (Tidak pernah); makin tinggi skor
 * makin patuh. Total 5–25.
 *
 * SUMBER KATA-KATANYA — jangan disunting tanpa membaca ini.
 *
 * Kelima butir di bawah disalin PERSIS dari versi Indonesia yang divalidasi:
 *
 *   Alfian R, Putra AMP. Uji validitas dan reliabilitas kuesioner Medication
 *   Adherence Report Scale (MARS) terhadap pasien diabetes mellitus.
 *   J Ilm Ibnu Sina. 2017;2(2):176-83.
 *   (n=25; korelasi butir-total 0,583-0,829; Cronbach's alpha 0,803)
 *
 * Sampai 31 Juli 2026 berkas ini memuat terjemahan buatan sendiri, dan butir
 * ke-4 berbunyi "Saya sengaja melewatkan satu dosis" — perilaku yang BERBEDA
 * dari "minum dosis lebih kecil". Selama kata-katanya tidak sama persis,
 * validasi Alfian tidak berlaku bagi skor yang dihasilkan di sini.
 *
 * Catatan untuk protokol: butir ke-4 versi Indonesia menerjemahkan
 * "I decide to miss out a dose" menjadi pernyataan tentang MENGURANGI dosis,
 * sehingga isinya mendekati butir ke-5. Keterbatasan itu ada pada versi
 * tervalidasinya, bukan pada penerapan di sini — dan justru karena itu
 * kata-katanya tidak boleh "diperbaiki" sendiri.
 *
 * ⚠️ HAK CIPTA. MARS dimiliki Prof. Robert Horne (Centre for Behavioural
 * Medicine, UCL School of Pharmacy) dan pemakaiannya menuntut perjanjian
 * lisensi. Izin tertulis belum diperoleh — lihat penelitian/proposal.md Lampiran 3.
 *
 * ⚠️ AMBANG KATEGORI. Tinggi >= 23 dan Sedang >= 18 diwarisi dari prototipe web
 * tanpa rujukan. Alfian 2017 menyebut tiga tingkat kepatuhan mengutip Farmer
 * dkk. 2006, tetapi tidak mencantumkan angka potongnya. Sebelum dipakai sebagai
 * luaran formal, ambang ini harus dicocokkan dengan rujukan yang dinyatakan di
 * protokol — atau skornya diperlakukan sebagai variabel kontinu tanpa kategori.
 */

export const MARS_ITEMS = [
  'Saya lupa minum obat',
  'Saya mengubah dosis minum obat',
  'Saya berhenti minum obat sementara',
  'Saya memutuskan untuk minum obat dengan dosis lebih kecil',
  'Saya minum obat kurang dari petunjuk sebenarnya',
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
