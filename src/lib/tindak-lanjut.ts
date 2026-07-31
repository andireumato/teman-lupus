/**
 * Perhitungan murni untuk tindak lanjut peringatan red-flag.
 *
 * Dipisah dari layarnya dengan alasan yang sama seperti `redflag.ts` dan
 * `ringkasan.ts`: apa pun yang ikut dibaca dokter saat mengambil keputusan —
 * dan apa pun yang nanti jadi variabel penelitian — harus bisa diuji baris per
 * baris, tanpa perlu menjalankan aplikasi.
 *
 * Yang TIDAK ada di sini: keputusan eskalasinya sendiri. Itu tetap milik
 * `redflag.ts` dan tidak berubah sedikit pun oleh berkas ini. Yang dicatat di
 * sini adalah apa yang terjadi SESUDAH eskalasi, bukan apakah eskalasinya
 * terjadi.
 */

import {
  KONDISI_TIDAK_DIKETAHUI,
  TINDAKAN_TANPA_KONTAK,
  labelKondisi,
  labelTindakan,
} from '@/constants/tindak-lanjut';

/**
 * Apakah sumbu kondisi harus dikunci ke "tidak diketahui".
 *
 * Dokter yang tidak berhasil menghubungi pasien tidak mungkin tahu kondisinya.
 * Dikunci di antarmuka, dan dijaga lagi oleh CHECK constraint di database —
 * data penelitian yang telanjur tidak konsisten tidak bisa diperbaiki
 * belakangan.
 */
export function kondisiTerkunci(tindakan: string | null): boolean {
  return tindakan === TINDAKAN_TANPA_KONTAK;
}

/**
 * Kondisi yang seharusnya tersimpan untuk sebuah tindakan.
 *
 * Dipakai layar saat dokter mengganti pilihan sumbu pertama, supaya kombinasi
 * yang mustahil tidak pernah sempat terbentuk.
 */
export function sesuaikanKondisi(tindakan: string | null, kondisi: string | null): string | null {
  return kondisiTerkunci(tindakan) ? KONDISI_TIDAK_DIKETAHUI : kondisi;
}

export type HasilPeriksa = { ok: true } | { ok: false; pesan: string };

/** Memeriksa isian sebelum dikirim, supaya galatnya berbahasa manusia. */
export function periksaTindakLanjut(tindakan: string | null, kondisi: string | null): HasilPeriksa {
  if (!tindakan) return { ok: false, pesan: 'Pilih dulu apa yang Anda lakukan.' };
  if (!kondisi) return { ok: false, pesan: 'Pilih dulu kondisi pasien saat dihubungi.' };
  if (kondisiTerkunci(tindakan) && kondisi !== KONDISI_TIDAK_DIKETAHUI) {
    return {
      ok: false,
      pesan: 'Pasien yang tidak bisa dihubungi tidak mungkin diketahui kondisinya.',
    };
  }
  return { ok: true };
}

/**
 * Jam antara peringatan terbit dan tindak lanjut tercatat.
 *
 * Ini variabel penelitian, jadi bentuk gagalnya harus jelas: null bila salah
 * satu waktunya kosong atau tidak terbaca, dan null pula bila tindak lanjutnya
 * tercatat SEBELUM peringatannya terbit. Angka negatif akan tampak seperti
 * respons luar biasa cepat, padahal artinya jam yang salah.
 */
export function jamRespons(
  peringatan: string | null | undefined,
  tindakLanjut: string | null | undefined
): number | null {
  const a = Date.parse(peringatan ?? '');
  const b = Date.parse(tindakLanjut ?? '');
  if (Number.isNaN(a) || Number.isNaN(b)) return null;
  const jam = (b - a) / 3_600_000;
  return jam < 0 ? null : jam;
}

/**
 * Jeda dalam bahasa manusia: "<1 jam", "4 jam", "3 hari".
 *
 * Dibulatkan ke bawah, bukan ke terdekat: "2 jam" yang sebenarnya 2 jam 50
 * menit tetap jujur sebagai "sudah lewat 2 jam", sedangkan pembulatan ke atas
 * jadi "3 jam" mengklaim waktu yang belum berlalu.
 */
export function labelJeda(jam: number | null): string | null {
  if (jam == null) return null;
  if (jam < 1) return '<1 jam';
  if (jam < 48) return `${Math.floor(jam)} jam`;
  return `${Math.floor(jam / 24)} hari`;
}

export interface TindakLanjutRingkas {
  waktu: string;
  jam: number | null;
  tindakan: string;
  kondisi: string;
}

/**
 * Baris tindak lanjut untuk ringkasan pra-kunjungan.
 *
 * Mengembalikan null bila belum ada tindak lanjutnya, supaya pemanggilnya yang
 * memutuskan kalimat penggantinya.
 *
 * `catatan` dokter SENGAJA tidak ikut. Ringkasan ini disalin, ditempel, dan
 * dibagikan — dan catatan itu ditulis untuk dokternya sendiri, bukan untuk
 * dibaca pasien. Ia hanya tampil di kartu peringatan milik dokter.
 */
export function barisTindakLanjut(t: TindakLanjutRingkas | null): string | null {
  if (!t) return null;
  const jeda = labelJeda(t.jam);
  const isi = isiTindakLanjut(t);
  return jeda ? `${jeda}: ${isi}` : isi;
}

/**
 * Hanya isinya — "masih bergejala, obat disesuaikan" — tanpa jeda waktunya.
 *
 * Dipisah dari `barisTindakLanjut` karena ringkasan pra-kunjungan menyisipkan
 * tanggal di antara keduanya: "30 Jul (4 jam): masih bergejala, …".
 */
export function isiTindakLanjut(t: TindakLanjutRingkas): string {
  const kondisi = labelKondisi(t.kondisi) ?? t.kondisi;
  const tindakan = labelTindakan(t.tindakan) ?? t.tindakan;
  // Huruf kecil di awal karena keduanya menyambung jadi satu kalimat.
  return `${kecilkanAwal(kondisi)}, ${kecilkanAwal(tindakan)}`;
}

/** "Masih bergejala" → "masih bergejala"; "Dirujuk IGD" tetap utuh setelahnya. */
function kecilkanAwal(s: string): string {
  return s.charAt(0).toLowerCase() + s.slice(1);
}
