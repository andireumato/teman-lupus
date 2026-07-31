/**
 * Penulisan CSV.
 *
 * Murni tanpa I/O. Terpisah dari perakit tabelnya (`ekspor.ts`) karena
 * pelolosan karakter adalah tempat kesalahan yang paling mudah lolos: satu
 * koma di dalam catatan pasien menggeser seluruh kolom, dan datanya tampak
 * baik-baik saja sampai dianalisis.
 *
 * KEPUTUSAN FORMAT
 * - Pemisah KOMA dan desimal TITIK. Itu CSV baku, dan yang dibaca R, pandas,
 *   maupun SPSS tanpa disetel. Excel berlokal Indonesia memakai titik koma
 *   sebagai pemisah daftar, jadi berkas ini perlu dibuka lewat
 *   Data → From Text/CSV di sana, bukan diklik dua kali.
 * - BOM UTF-8 di awal berkas. Tanpa itu Excel membaca "Ulkus mukosa" dan nama
 *   obat berhuruf non-ASCII sebagai karakter rusak.
 * - Akhir baris CRLF, sesuai RFC 4180.
 */

/** Nilai yang boleh masuk sel. `null`/`undefined` menjadi sel kosong. */
export type NilaiSel = string | number | boolean | null | undefined;

const BOM = '﻿';
const EOL = '\r\n';

/**
 * Karakter pembuka yang membuat Excel dan LibreOffice memperlakukan isi sel
 * sebagai RUMUS, bukan teks.
 *
 * Catatan pasien dan nama obat diketik bebas. Sel yang diawali `=` atau `+`
 * akan dijalankan saat berkas dibuka — dari sekadar menampilkan nilai yang
 * salah sampai memanggil isi sel lain. Karena itu isinya diawali kutip
 * tunggal, cara baku menandai "ini teks" pada kedua program.
 */
const PEMBUKA_RUMUS = /^[=+\-@\t\r]/;

/** Satu sel, sudah diloloskan. */
export function sel(v: NilaiSel): string {
  if (v == null) return '';
  if (typeof v === 'boolean') return v ? '1' : '0';
  if (typeof v === 'number') return Number.isFinite(v) ? String(v) : '';

  const aman = PEMBUKA_RUMUS.test(v) ? `'${v}` : v;
  // Dikutip hanya bila perlu — berkasnya jadi lebih mudah dibaca manusia saat
  // diperiksa sekilas, dan pembacanya tidak peduli.
  if (/[",\r\n]/.test(aman)) return `"${aman.replace(/"/g, '""')}"`;
  return aman;
}

export function barisCsv(nilai: NilaiSel[]): string {
  return nilai.map(sel).join(',');
}

/** Satu kolom: judulnya, dan cara mengambil nilainya dari satu baris data. */
export interface Kolom<T> {
  judul: string;
  ambil: (r: T) => NilaiSel;
}

/**
 * Merakit satu berkas CSV lengkap.
 *
 * Tetap menulis baris judul meski datanya kosong: berkas kosong tanpa judul
 * tidak bisa dibedakan dari ekspor yang gagal, dan alat analisis akan menolak
 * memuatnya alih-alih melaporkan nol baris.
 */
export function buatCsv<T>(kolom: Kolom<T>[], baris: T[]): string {
  const isi = [
    barisCsv(kolom.map((k) => k.judul)),
    ...baris.map((r) => barisCsv(kolom.map((k) => k.ambil(r)))),
  ];
  return BOM + isi.join(EOL) + EOL;
}

/**
 * Membersihkan nama berkas dari karakter yang ditolak sistem berkas.
 * Dipakai untuk nama berkas ekspor yang mengandung tanggal.
 */
export function namaBerkasAman(nama: string): string {
  return nama.replace(/[^A-Za-z0-9._-]+/g, '_').replace(/^_+|_+$/g, '') || 'ekspor';
}
