/**
 * PENGINGAT OBAT — bagian yang murni.
 *
 * Memutuskan pengingat APA yang harus ada; tidak menyentuh sistem notifikasi
 * sama sekali. Pemisahan yang sama seperti `redflag.ts`: apa pun yang bisa
 * membuat pasien meminum obat pada waktu yang salah harus bisa diuji baris per
 * baris, tanpa perlu ponsel.
 *
 * ⚠️ Batas yang sengaja dijaga:
 * - Pengingat hanya MENGINGATKAN. Ia tidak pernah menyebut dosis, tidak
 *   menyarankan menambah atau melewatkan, dan tidak menyimpulkan apa pun.
 * - Obat yang dihentikan TIDAK punya pengingat. Ini aturan keselamatan, bukan
 *   kerapian: pengingat yang terus berbunyi untuk obat yang baru dihentikan
 *   dokter adalah dorongan aktif untuk melanggar instruksi.
 */

import { awalHari, hariISO, jatuhPada, polaObat } from '@/lib/pola-minum';
import type { Medication } from '@/types/database';

/** Batas dosis per hari yang didukung layar obat. */
export const MAKS_DOSIS = 6;

/**
 * Jam bawaan per frekuensi.
 *
 * Dipilih agar jarak antar dosis merata dan tidak ada yang jatuh di jam tidur
 * — pengingat pukul 02.00 hanya akan dimatikan pasien, dan sekali dimatikan
 * seluruh pengingatnya ikut hilang. Pasien tetap bisa mengubah tiap jamnya.
 *
 * ⚠️ Ini kenyamanan, bukan anjuran klinis. Obat yang harus diminum sebelum
 * makan, atau steroid yang sebaiknya pagi, tetap diatur pasien dan dokternya.
 */
export const JAM_BAWAAN: Record<number, string[]> = {
  1: ['08:00'],
  2: ['08:00', '20:00'],
  3: ['08:00', '14:00', '20:00'],
  4: ['07:00', '12:00', '17:00', '22:00'],
  5: ['07:00', '11:00', '15:00', '19:00', '23:00'],
  6: ['06:00', '10:00', '14:00', '18:00', '21:00', '23:00'],
};

export interface Jam {
  hour: number;
  minute: number;
}

/** 'HH:MM' 24 jam → {hour, minute}. null bila tidak terbaca. */
export function bacaJam(teks: string | null | undefined): Jam | null {
  const m = /^([01]\d|2[0-3]):([0-5]\d)$/.exec((teks ?? '').trim());
  if (!m) return null;
  return { hour: Number(m[1]), minute: Number(m[2]) };
}

export function tulisJam(j: Jam): string {
  return `${String(j.hour).padStart(2, '0')}:${String(j.minute).padStart(2, '0')}`;
}

/**
 * Menyesuaikan daftar jam dengan frekuensi baru.
 *
 * Jam yang sudah diisi pasien dipertahankan sejauh masih terpakai; kekurangan
 * ditambal dari bawaan. Tanpa ini, mengubah "2x sehari" jadi "3x" akan
 * menghapus jam yang sudah disetel pasien dengan susah payah.
 */
export function sesuaikanJam(jam: string[] | null | undefined, frekuensi: number): string[] {
  const n = Math.max(1, Math.min(MAKS_DOSIS, Math.floor(frekuensi) || 1));
  const bawaan = JAM_BAWAAN[n] ?? JAM_BAWAAN[1];
  const ada = (jam ?? []).filter((j) => bacaJam(j) != null);
  return Array.from({ length: n }, (_, i) => ada[i] ?? bawaan[i] ?? bawaan[bawaan.length - 1]);
}

/**
 * Kapan sebuah pengingat berbunyi.
 *
 * Tiga bentuk karena Android hanya menyediakan pengulangan otomatis untuk dua
 * di antaranya. Harian dan mingguan punya pemicu berulang sendiri dan bertahan
 * tanpa aplikasi dibuka. Pola selang TIDAK punya padanannya — tidak ada pemicu
 * "tiap N hari" — sehingga harus dipasang satu per satu per tanggal dan diisi
 * ulang setiap pasien membuka layar Obat.
 */
export type PemicuPengingat =
  | { jenis: 'harian' }
  | { jenis: 'mingguan'; hariISO: number }
  | { jenis: 'tanggal'; tanggal: Date };

/**
 * Berapa kali ke depan pengingat pola selang dipasang di muka.
 *
 * Dipilih 8, bukan sebanyak-banyaknya. iOS hanya memegang 64 notifikasi
 * terjadwal sekaligus dan membuang sisanya diam-diam; satu obat selang-sehari
 * dengan 8 kejadian sudah menutupi lebih dari dua pekan, dan jadwalnya diisi
 * ulang tiap layar Obat dibuka.
 */
export const KEJADIAN_SELANG_DI_MUKA = 8;

export interface Pengingat {
  /** Kunci stabil, dipakai sebagai pembanding saat menjadwal ulang. */
  kunci: string;
  medicationId: string;
  /** Berbasis 0, sama seperti `med_logs.slot`. */
  slot: number;
  hour: number;
  minute: number;
  judul: string;
  isi: string;
  pemicu: PemicuPengingat;
}

/**
 * Daftar pengingat yang seharusnya aktif untuk sekumpulan obat.
 *
 * Dihitung ulang dari nol setiap kali, bukan ditambal sedikit-sedikit: obat
 * bisa dihentikan, dilanjutkan, dihapus, atau berubah frekuensinya, dan
 * penambalan bertahap adalah cara paling mudah meninggalkan pengingat yatim
 * untuk obat yang sudah tidak diminum.
 */
export function rencanaPengingat(meds: Medication[], sekarang: Date = new Date()): Pengingat[] {
  const out: Pengingat[] = [];

  for (const m of meds) {
    // Obat yang dihentikan tidak pernah mengingatkan. Lihat catatan di kepala.
    if (!m.aktif) continue;

    const n = Math.max(1, Math.min(MAKS_DOSIS, m.frekuensi ?? 1));
    const jam = m.jam ?? [];
    const pola = polaObat(m);

    for (let slot = 0; slot < n; slot++) {
      const j = bacaJam(jam[slot]);
      // Jam yang kosong atau rusak dilewati diam-diam, bukan diganti tebakan:
      // pengingat pada jam yang tidak pernah dipilih pasien lebih buruk
      // daripada tidak ada pengingat sama sekali.
      if (!j) continue;

      const dasar = {
        medicationId: m.id,
        slot,
        hour: j.hour,
        minute: j.minute,
        judul: `Waktunya ${m.nama_obat}`,
        // Tidak menyebut dosis, tidak menyuruh. Menyebut dosis di sini berarti
        // aplikasi ikut menentukan takaran — itu wewenang dokter, dan teks
        // notifikasi tidak ikut berubah ketika dosisnya diubah.
        isi:
          n > 1
            ? `Dosis ke-${slot + 1} hari ini. Ketuk untuk mencentang.`
            : 'Ketuk untuk mencentang.',
      };

      if (pola === 'harian') {
        out.push({ ...dasar, kunci: `${m.id}|${slot}`, pemicu: { jenis: 'harian' } });
        continue;
      }

      if (pola === 'mingguan') {
        const hari = (m.hari_minggu ?? []).filter((h) => h >= 1 && h <= 7);
        for (const h of hari) {
          out.push({
            ...dasar,
            kunci: `${m.id}|${slot}|h${h}`,
            pemicu: { jenis: 'mingguan', hariISO: h },
          });
        }
        continue;
      }

      // Pola selang: dipasang per tanggal karena Android tidak punya pemicu
      // "tiap N hari". Kejadian yang jamnya sudah lewat hari ini dilewati —
      // menjadwalkan notifikasi ke masa lalu membuatnya berbunyi seketika.
      const mulaiCek = awalHari(sekarang);
      let dipasang = 0;
      for (let i = 0; i < 366 && dipasang < KEJADIAN_SELANG_DI_MUKA; i++) {
        const tanggal = new Date(
          mulaiCek.getFullYear(),
          mulaiCek.getMonth(),
          mulaiCek.getDate() + i
        );
        if (!jatuhPada(m, tanggal)) continue;

        const saat = new Date(tanggal);
        saat.setHours(j.hour, j.minute, 0, 0);
        if (saat.getTime() <= sekarang.getTime()) continue;

        // Tanggalnya diberi angka nol di depan. Kunci ikut jadi kunci
        // pengurutan di bawah, dan tanpa itu 't2026-8-11' mendahului
        // 't2026-8-3' secara alfabet — daftar pengingat jadi tidak urut waktu.
        const bulan = String(tanggal.getMonth() + 1).padStart(2, '0');
        const hariKe = String(tanggal.getDate()).padStart(2, '0');

        out.push({
          ...dasar,
          kunci: `${m.id}|${slot}|t${tanggal.getFullYear()}-${bulan}-${hariKe}`,
          pemicu: { jenis: 'tanggal', tanggal: saat },
        });
        dipasang++;
      }
    }
  }

  return out.sort(
    (a, b) => a.hour - b.hour || a.minute - b.minute || a.kunci.localeCompare(b.kunci)
  );
}

/**
 * Kapan sebuah pengingat berbunyi untuk pertama kalinya sesudah `sekarang`.
 *
 * Dulu layar cukup membandingkan menit-dalam-hari, karena semua obat harian.
 * Sejak ada pola mingguan dan selang, cara itu akan mengumumkan metotreksat
 * hari Senin sebagai "berikutnya 08:00" pada hari Rabu.
 */
export function waktuBerikutnya(p: Pengingat, sekarang: Date): Date | null {
  switch (p.pemicu.jenis) {
    case 'tanggal':
      return p.pemicu.tanggal.getTime() > sekarang.getTime() ? p.pemicu.tanggal : null;

    case 'harian': {
      const d = new Date(sekarang);
      d.setHours(p.hour, p.minute, 0, 0);
      if (d.getTime() <= sekarang.getTime()) d.setDate(d.getDate() + 1);
      return d;
    }

    case 'mingguan': {
      const hari = p.pemicu.hariISO;
      // Delapan, bukan tujuh: kalau hari ini memang harinya tetapi jamnya sudah
      // lewat, jawabannya ada di putaran pekan berikutnya.
      for (let i = 0; i < 8; i++) {
        const d = new Date(
          sekarang.getFullYear(),
          sekarang.getMonth(),
          sekarang.getDate() + i,
          p.hour,
          p.minute
        );
        if (hariISO(d) === hari && d.getTime() > sekarang.getTime()) return d;
      }
      return null;
    }
  }
}

/**
 * Pengingat yang paling dekat akan berbunyi, untuk ditampilkan di layar.
 *
 * Membandingkan waktu nyalanya yang sebenarnya, bukan jamnya saja — lihat
 * `waktuBerikutnya`.
 */
export function pengingatBerikutnya(daftar: Pengingat[], sekarang: Date): Pengingat | null {
  let terbaik: Pengingat | null = null;
  let paling = Infinity;

  for (const p of daftar) {
    const w = waktuBerikutnya(p, sekarang);
    if (w && w.getTime() < paling) {
      paling = w.getTime();
      terbaik = p;
    }
  }
  return terbaik;
}

export type StatusPemasangan = 'sehat' | 'sebagian' | 'hilang' | 'tak-relevan';

export interface DiagnosaPengingat {
  status: StatusPemasangan;
  direncanakan: number;
  terpasang: number;
  /** Kalimat siap tampil; null bila tidak ada yang perlu dikatakan. */
  pesan: string | null;
}

/**
 * Membandingkan pengingat yang DIRENCANAKAN dengan yang benar-benar dipegang
 * sistem.
 *
 * Murni supaya bisa diuji tanpa Android. Dipanggil setelah pemasangan ulang,
 * sehingga selisih apa pun berarti sistem menolak atau membuang alarmnya —
 * bukan sekadar belum sempat terpasang.
 *
 * `tak-relevan` ketika memang tidak ada yang perlu dipasang. Tanpa keadaan itu,
 * pasien tanpa obat berjam akan melihat peringatan "pengingat hilang" yang
 * tidak ada artinya.
 */
export function diagnosaPengingat(direncanakan: number, terpasang: number): DiagnosaPengingat {
  if (direncanakan === 0) {
    return { status: 'tak-relevan', direncanakan, terpasang, pesan: null };
  }
  if (terpasang >= direncanakan) {
    return { status: 'sehat', direncanakan, terpasang, pesan: null };
  }
  if (terpasang === 0) {
    return {
      status: 'hilang',
      direncanakan,
      terpasang,
      pesan: `Tidak ada satu pun dari ${direncanakan} pengingat yang tersimpan di sistem. Ponselmu kemungkinan menghapusnya saat aplikasi ditutup.`,
    };
  }
  return {
    status: 'sebagian',
    direncanakan,
    terpasang,
    pesan: `Baru ${terpasang} dari ${direncanakan} pengingat yang tersimpan di sistem.`,
  };
}
