/**
 * Penghitung skor LupusQoL — murni, tanpa I/O.
 *
 * Dipisah dari layarnya dengan alasan yang sama seperti `sledai.ts` dan
 * `target.ts`: angka yang masuk analisis penelitian harus bisa diuji baris per
 * baris. Berkas ini TIDAK memuat teks butir mana pun — lihat catatan hak cipta
 * di `constants/lupusqol.ts`.
 *
 * ATURAN SKOR (McElhone 2007; rinciannya di Hosseini 2014, PMID 25313310):
 * tiap butir bernilai 0–4, skor domain adalah RATA-RATA butirnya, lalu
 * ditransformasi ke 0–100 dengan dikali 25. Makin tinggi makin BAIK — kebalikan
 * dari SLEDAI-2K, dan kebalikan itu gampang tertukar saat menafsirkan grafik.
 */

import { LUPUSQOL_DOMAIN, NILAI_MAKS, NILAI_MIN, type DomainLupusQol } from '@/constants/lupusqol';

/**
 * Jawaban satu penilaian: kunci butir → nilai.
 *
 * `null` berarti dilewati; kunci yang tidak ada sama saja. Butir "tidak
 * berlaku" juga disimpan `null` — keduanya sengaja tidak dibedakan di sini
 * karena keduanya sama-sama TIDAK boleh ikut rata-rata, dan membedakannya di
 * penghitung hanya menambah cabang yang tidak mengubah hasil. Bedanya dicatat
 * di layar dan di kolom `tak_berlaku`, tempat perbedaan itu memang berarti.
 */
export type JawabanLupusQol = Record<string, number | null | undefined>;

export interface SkorDomain {
  key: string;
  label: string;
  /** 0–100, makin tinggi makin baik. null bila tidak satu pun butir dijawab. */
  skor: number | null;
  terjawab: number;
  total: number;
}

export interface HasilLupusQol {
  domain: SkorDomain[];
  /**
   * Rata-rata kedelapan skor domain, 0–100.
   *
   * Sengaja rata-rata ANTAR DOMAIN, bukan antar butir: kalau dihitung per
   * butir, domain "kesehatan fisik" (8 butir) berbobot empat kali domain
   * "hubungan intim" (2 butir) tanpa dasar apa pun. Domain yang kosong
   * dilewati, bukan dianggap nol — nol berarti kualitas hidup terburuk.
   *
   * CATATAN: instrumen aslinya melaporkan delapan skor domain dan TIDAK
   * mendefinisikan skor total resmi. Angka ini kemudahan tampilan, bukan
   * keluaran baku — jangan dilaporkan sebagai "skor LupusQoL" dalam publikasi.
   */
  rerata: number | null;
  /** Butir terjawab dari seluruh 34. */
  terjawab: number;
  total: number;
}

/** Apakah sebuah nilai sah sebagai jawaban butir. */
export function nilaiSah(v: unknown): v is number {
  return typeof v === 'number' && Number.isInteger(v) && v >= NILAI_MIN && v <= NILAI_MAKS;
}

function kunciButir(d: DomainLupusQol): string[] {
  return Array.from({ length: d.jumlah }, (_, i) => `${d.key}_${i + 1}`);
}

/**
 * Menghitung kedelapan skor domain.
 *
 * Butir yang tidak dijawab DIKELUARKAN dari rata-rata, bukan dianggap nol.
 * Menganggapnya nol berarti melaporkan kualitas hidup terburuk untuk pertanyaan
 * yang tidak pernah dijawab.
 *
 * Jumlah butir terjawab per domain ikut dikembalikan supaya penganalisis bisa
 * menerapkan aturan data hilangnya sendiri. Manual resmi LupusQoL tidak bisa
 * saya akses, jadi berkas ini sengaja TIDAK memutuskan ambang minimal butir —
 * ia melaporkan apa adanya dan membiarkan keputusan itu di tangan peneliti.
 */
export function skorLupusQol(jawaban: JawabanLupusQol): HasilLupusQol {
  const domain: SkorDomain[] = LUPUSQOL_DOMAIN.map((d) => {
    const nilai = kunciButir(d)
      .map((k) => jawaban[k])
      .filter(nilaiSah);

    return {
      key: d.key,
      label: d.label,
      skor: nilai.length === 0 ? null : bulatSatu(rata(nilai) * 25),
      terjawab: nilai.length,
      total: d.jumlah,
    };
  });

  const terisi = domain.map((d) => d.skor).filter((s): s is number => s != null);

  return {
    domain,
    rerata: terisi.length === 0 ? null : bulatSatu(rata(terisi)),
    terjawab: domain.reduce((n, d) => n + d.terjawab, 0),
    total: domain.reduce((n, d) => n + d.total, 0),
  };
}

/**
 * Butir yang belum dijawab, urut sesuai urutan kuesioner.
 *
 * Dipakai layar untuk memberi tahu pasien apa yang tersisa, alih-alih hanya
 * mematikan tombol Simpan tanpa penjelasan.
 */
export function butirBelumDijawab(jawaban: JawabanLupusQol): string[] {
  return LUPUSQOL_DOMAIN.flatMap(kunciButir).filter((k) => !nilaiSah(jawaban[k]));
}

/**
 * Selisih skor domain antara dua penilaian, untuk melihat arah perubahan.
 *
 * Positif = membaik, karena skor LupusQoL makin tinggi makin baik. Domain yang
 * salah satu sisinya kosong menghasilkan `null`, bukan nol: "tidak berubah" dan
 * "tidak bisa dibandingkan" adalah dua hal yang berbeda.
 */
export function selisihDomain(
  sekarang: HasilLupusQol,
  sebelumnya: HasilLupusQol | null
): Record<string, number | null> {
  const out: Record<string, number | null> = {};
  const lama = new Map((sebelumnya?.domain ?? []).map((d) => [d.key, d.skor]));
  for (const d of sekarang.domain) {
    const a = lama.get(d.key);
    out[d.key] = d.skor == null || a == null || a === undefined ? null : bulatSatu(d.skor - a);
  }
  return out;
}

const rata = (xs: number[]): number => xs.reduce((a, b) => a + b, 0) / xs.length;

/**
 * Satu angka di belakang koma.
 *
 * Skor domain adalah rata-rata beberapa bilangan bulat dikali 25, jadi hasilnya
 * kerap tak berujung dalam biner (mis. 8 butir → kelipatan 3,125). Tanpa
 * pembulatan, dua penilaian yang isinya sama bisa tampil berbeda di digit ke-15
 * dan tidak lolos perbandingan.
 */
const bulatSatu = (n: number): number => Math.round(n * 10) / 10;
