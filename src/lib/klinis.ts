/**
 * Perhitungan murni untuk data klinis dasar.
 *
 * Dipisah dari layarnya dengan alasan yang sama seperti `redflag.ts` dan
 * `ringkasan.ts`: apa pun yang ikut dibaca dokter saat mengambil keputusan
 * harus bisa diuji baris per baris, tanpa perlu menjalankan aplikasi.
 */

/** Tahun paling awal yang dianggap masuk akal untuk tanggal diagnosis. */
const TAHUN_MIN = 1900;

/**
 * Lama sejak diagnosis, mis. "4 tahun 2 bulan".
 *
 * Dihitung dari komponen tahun/bulan/tanggal, bukan dari selisih hari dibagi
 * 365: pembagian itu meleset sehari-dua di sekitar tahun kabisat, dan "3 tahun
 * 11 bulan" yang terbaca "4 tahun" mengubah arti kalimat di ringkasan.
 *
 * Mengembalikan null bila tanggalnya kosong, tidak terbaca, atau berada
 * SETELAH tanggal acuan — angka negatif lebih menyesatkan daripada kosong.
 */
export function lamaSakit(diagnosis: string | null | undefined, sampai: string): string | null {
  const bulan = selisihBulanPenuh(diagnosis, sampai);
  if (bulan == null) return null;

  const tahun = Math.floor(bulan / 12);
  const sisa = bulan % 12;

  if (tahun === 0 && sisa === 0) return 'kurang dari 1 bulan';
  if (tahun === 0) return `${sisa} bulan`;
  if (sisa === 0) return `${tahun} tahun`;
  return `${tahun} tahun ${sisa} bulan`;
}

/**
 * Usia dalam tahun penuh.
 *
 * Dihitung, tidak disimpan: usia yang tersimpan sebagai angka akan basi
 * diam-diam saat pasien berulang tahun, dan tidak ada yang menyadarinya.
 */
export function usiaTahun(tglLahir: string | null | undefined, sampai: string): number | null {
  const bulan = selisihBulanPenuh(tglLahir, sampai);
  return bulan == null ? null : Math.floor(bulan / 12);
}

/**
 * Lama sakit dalam BULAN penuh — bentuk angka dari `lamaSakit`, untuk ekspor.
 *
 * Ekspor penelitian sengaja memuat durasi, bukan tanggal diagnosis mentah:
 * tanggal lahir dan tanggal diagnosis adalah dua pengenal semu yang, digabung
 * dengan usia dan jenis kelamin, bisa mempersempit identitas seseorang.
 * Durasinya membawa seluruh nilai analitiknya tanpa itu.
 */
export function lamaSakitBulan(
  diagnosis: string | null | undefined,
  sampai: string
): number | null {
  return selisihBulanPenuh(diagnosis, sampai);
}

export type HasilTanggal = { ok: true; nilai: string | null } | { ok: false; pesan: string };

/**
 * Memeriksa tanggal diagnosis yang diketik dokter.
 *
 * Kosong adalah jawaban yang sah — tanggal diagnosis tidak selalu diketahui,
 * dan memaksa mengisi hanya menghasilkan tebakan yang tampak seperti fakta.
 */
export function periksaTanggalDiagnosis(teks: string, hariIni: string): HasilTanggal {
  return periksaTanggal(teks, hariIni, 'Tanggal diagnosis');
}

/**
 * Memeriksa tanggal lahir yang diketik pasien.
 *
 * Pemeriksaan "tidak boleh di masa depan" HANYA ada di sini: Postgres menolak
 * fungsi non-immutable seperti `current_date` di dalam CHECK constraint, jadi
 * database hanya bisa menjaga batas bawahnya (lihat
 * supabase/data_dasar_pasien.sql).
 */
export function periksaTanggalLahir(teks: string, hariIni: string): HasilTanggal {
  return periksaTanggal(teks, hariIni, 'Tanggal lahir');
}

function periksaTanggal(teks: string, hariIni: string, apa: string): HasilTanggal {
  const t = teks.trim();
  if (t === '') return { ok: true, nilai: null };

  if (!/^\d{4}-\d{2}-\d{2}$/.test(t)) {
    return { ok: false, pesan: 'Tulis tanggal dengan format TTTT-BB-HH, contoh 1990-03-15.' };
  }

  const p = pecahISO(t)!;
  if (p.y < TAHUN_MIN) {
    return { ok: false, pesan: `Tahun ${p.y} sepertinya salah ketik.` };
  }
  // Menangkap 2019-02-31: JavaScript menggulungnya jadi 3 Maret tanpa mengeluh.
  const asli = new Date(Date.UTC(p.y, p.m - 1, p.d));
  if (asli.getUTCMonth() !== p.m - 1 || asli.getUTCDate() !== p.d) {
    return { ok: false, pesan: 'Tanggal itu tidak ada di kalender.' };
  }
  if (t > hariIni) {
    return { ok: false, pesan: `${apa} tidak boleh di masa depan.` };
  }

  return { ok: true, nilai: t };
}

/**
 * Jumlah bulan penuh antara dua tanggal ISO.
 *
 * Dihitung dari komponen tahun/bulan/tanggal, bukan dari selisih hari dibagi
 * 30 atau 365: pembagian itu meleset sehari-dua di sekitar tahun kabisat, dan
 * "3 tahun 11 bulan" yang terbaca "4 tahun" mengubah arti kalimat di ringkasan
 * — juga membuat usia bertambah sehari sebelum ulang tahunnya.
 *
 * null bila salah satu tanggal kosong/rusak, atau `dari` ada SETELAH `sampai`.
 */
function selisihBulanPenuh(dari: string | null | undefined, sampai: string): number | null {
  const a = pecahISO(dari);
  const b = pecahISO(sampai);
  if (!a || !b) return null;

  let bulan = (b.y - a.y) * 12 + (b.m - a.m);
  // Bulan berjalan belum genap bila harinya belum sampai.
  if (b.d < a.d) bulan -= 1;
  return bulan < 0 ? null : bulan;
}

function pecahISO(iso: string | null | undefined): { y: number; m: number; d: number } | null {
  if (!iso) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!m) return null;
  return { y: Number(m[1]), m: Number(m[2]), d: Number(m[3]) };
}
