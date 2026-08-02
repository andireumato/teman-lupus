/**
 * POLA MINUM OBAT — bagian yang murni.
 *
 * Menjawab satu pertanyaan: pada tanggal tertentu, obat ini diminum atau tidak.
 * Tidak menyentuh notifikasi, database, maupun layar.
 *
 * Tiga pola yang didukung, dan alasan klinis masing-masing ada:
 *
 * - `harian`   — hidroksiklorokuin, prednison dosis tetap. Pola bawaan.
 * - `mingguan` — metotreksat, obat paling lazim di reumatologi setelah steroid,
 *                dan bisfosfonat mingguan. Pasien mengingatnya sebagai "setiap
 *                Senin", bukan "tiap 7 hari", jadi disimpan sebagai hari.
 * - `selang`   — prednison selang-sehari. Ini TIDAK bisa dinyatakan sebagai
 *                hari dalam seminggu: polanya bergeser terus (Sen, Rab, Jum,
 *                Min, Sel, ...), jadi harus dihitung dari tanggal jangkar.
 *
 * ⚠️ PENOMORAN HARI. Di sini dipakai ISO: 1 = Senin … 7 = Minggu. Itu BUKAN
 * penomoran JavaScript (`getDay()`: 0 = Minggu) dan BUKAN penomoran
 * expo-notifications (1 = Minggu). Ketiganya berbeda, dan salah satu digit
 * berarti pasien diingatkan pada hari yang keliru. Semua penerjemahannya
 * dikurung di fungsi-fungsi di bawah dan dikunci oleh tes.
 */

import type { Medication } from '@/types/database';

export type PolaMinum = 'harian' | 'mingguan' | 'selang';

/** Selang terpendek dan terpanjang yang masuk akal untuk obat. */
export const SELANG_MIN = 2;
export const SELANG_MAKS = 30;

export const NAMA_HARI: Record<number, string> = {
  1: 'Senin',
  2: 'Selasa',
  3: 'Rabu',
  4: 'Kamis',
  5: 'Jumat',
  6: 'Sabtu',
  7: 'Minggu',
};

/** Hari dalam seminggu menurut ISO: 1 = Senin … 7 = Minggu. */
export function hariISO(d: Date): number {
  return ((d.getDay() + 6) % 7) + 1;
}

/**
 * ISO (1 = Senin) → penomoran expo-notifications (1 = Minggu).
 *
 * Dipisah jadi fungsi sendiri walau isinya satu baris, supaya ada satu tempat
 * yang bisa ditunjuk dan diuji ketika pengingat mingguan berbunyi di hari yang
 * salah.
 */
export function hariISOKeExpo(iso: number): number {
  return iso === 7 ? 1 : iso + 1;
}

/** Tengah malam waktu setempat. Membuang jam agar perbandingan tanggal bersih. */
export function awalHari(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

/**
 * Selisih hari kalender antara dua tanggal.
 *
 * Sengaja lewat `awalHari` lalu dibulatkan, bukan pembagian milidetik mentah.
 * Indonesia memang tidak mengenal daylight saving, tetapi ponsel pasien bisa
 * saja disetel ke zona waktu lain, dan hari yang panjangnya 23 jam akan membuat
 * pembagian mentah meleset satu hari — tepat pada obat selang-sehari.
 */
export function selisihHari(dari: Date, sampai: Date): number {
  const a = awalHari(dari).getTime();
  const b = awalHari(sampai).getTime();
  return Math.round((b - a) / 86_400_000);
}

/** 'YYYY-MM-DD' → Date tengah malam setempat. null bila tidak terbaca. */
export function bacaTanggal(teks: string | null | undefined): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec((teks ?? '').trim());
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  // Menolak tanggal yang "melimpah", misalnya 2026-02-30 yang oleh Date
  // diam-diam digeser jadi 2 Maret.
  return d.getMonth() === Number(m[2]) - 1 && d.getDate() === Number(m[3]) ? d : null;
}

/** Pola sebuah obat, sudah dibersihkan dari nilai yang tidak masuk akal. */
export function polaObat(m: Medication): PolaMinum {
  return m.pola === 'mingguan' || m.pola === 'selang' ? m.pola : 'harian';
}

/**
 * Apakah obat ini diminum pada tanggal tersebut.
 *
 * Obat yang sudah dihentikan menjawab `false` untuk tanggal apa pun. Itu aturan
 * keselamatan yang sama seperti di `pengingat.ts`: obat yang dihentikan dokter
 * tidak boleh muncul sebagai dosis yang menunggu dicentang.
 *
 * Pola yang datanya tidak lengkap juga menjawab `false`, bukan jatuh kembali ke
 * harian. Menebak "mungkin maksudnya setiap hari" pada obat mingguan berarti
 * mengingatkan metotreksat tujuh kali seminggu.
 */
export function jatuhPada(m: Medication, tanggal: Date): boolean {
  if (!m.aktif) return false;

  switch (polaObat(m)) {
    case 'harian':
      return true;

    case 'mingguan': {
      const hari = m.hari_minggu ?? [];
      return hari.includes(hariISO(tanggal));
    }

    case 'selang': {
      const selang = m.selang_hari ?? 0;
      const mulai = bacaTanggal(m.mulai_tanggal);
      if (!mulai || selang < SELANG_MIN || selang > SELANG_MAKS) return false;
      const beda = selisihHari(mulai, tanggal);
      // Sebelum tanggal mulai bukan hari minum. Sisa modulo pada bilangan
      // negatif di JavaScript ikut negatif, jadi ini harus dijaga di sini.
      return beda >= 0 && beda % selang === 0;
    }
  }
}

/**
 * Tanggal minum berikutnya, dihitung maju dari `dari` (inklusif).
 *
 * Mengembalikan null bila tidak ada dalam setahun ke depan — hanya mungkin
 * terjadi pada data yang rusak, dan lebih baik layar menampilkan "—" daripada
 * berputar selamanya.
 */
export function tanggalMinumBerikutnya(m: Medication, dari: Date): Date | null {
  const mulai = awalHari(dari);
  for (let i = 0; i < 366; i++) {
    const cek = new Date(mulai.getFullYear(), mulai.getMonth(), mulai.getDate() + i);
    if (jatuhPada(m, cek)) return cek;
  }
  return null;
}

/**
 * Berapa hari minum dalam satu rentang tanggal, ujung ke ujung inklusif.
 *
 * Inilah penyebut kepatuhan yang benar. Menghitungnya sebagai frekuensi × jumlah
 * hari — cara lama — membuat metotreksat mingguan terlihat punya 30 dosis
 * terjadwal dalam sebulan padahal hanya 4, dan kepatuhan pasien terlihat runtuh
 * hanya karena aritmetikanya salah.
 */
export function jumlahHariMinum(m: Medication, dari: Date, sampai: Date): number {
  const total = selisihHari(dari, sampai);
  if (total < 0) return 0;

  const awal = awalHari(dari);
  let n = 0;
  for (let i = 0; i <= total; i++) {
    if (jatuhPada(m, new Date(awal.getFullYear(), awal.getMonth(), awal.getDate() + i))) n++;
  }
  return n;
}

/**
 * Label pola untuk dibaca manusia, dipakai di ringkasan dan layar obat.
 *
 * Frekuensi harian ikut disebut karena obat mingguan pun bisa dibagi dua dosis
 * pada hari yang sama.
 */
export function labelPola(m: Medication): string {
  const n = Math.max(1, m.frekuensi ?? 1);
  const perHari = n > 1 ? `, ${n}x` : '';

  switch (polaObat(m)) {
    case 'harian':
      return n > 1 ? `${n}x sehari` : 'setiap hari';

    case 'mingguan': {
      const hari = (m.hari_minggu ?? []).filter((h) => h >= 1 && h <= 7).sort((a, b) => a - b);
      if (hari.length === 0) return 'mingguan, hari belum dipilih';
      return `tiap ${hari.map((h) => NAMA_HARI[h]).join(', ')}${perHari}`;
    }

    case 'selang': {
      const s = m.selang_hari ?? 0;
      if (s < SELANG_MIN) return 'selang hari belum diatur';
      return s === 2 ? `selang sehari${perHari}` : `tiap ${s} hari${perHari}`;
    }
  }
}
