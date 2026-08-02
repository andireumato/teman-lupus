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
}

/**
 * Daftar pengingat yang seharusnya aktif untuk sekumpulan obat.
 *
 * Dihitung ulang dari nol setiap kali, bukan ditambal sedikit-sedikit: obat
 * bisa dihentikan, dilanjutkan, dihapus, atau berubah frekuensinya, dan
 * penambalan bertahap adalah cara paling mudah meninggalkan pengingat yatim
 * untuk obat yang sudah tidak diminum.
 */
export function rencanaPengingat(meds: Medication[]): Pengingat[] {
  const out: Pengingat[] = [];

  for (const m of meds) {
    // Obat yang dihentikan tidak pernah mengingatkan. Lihat catatan di kepala.
    if (!m.aktif) continue;

    const n = Math.max(1, Math.min(MAKS_DOSIS, m.frekuensi ?? 1));
    const jam = m.jam ?? [];

    for (let slot = 0; slot < n; slot++) {
      const j = bacaJam(jam[slot]);
      // Jam yang kosong atau rusak dilewati diam-diam, bukan diganti tebakan:
      // pengingat pada jam yang tidak pernah dipilih pasien lebih buruk
      // daripada tidak ada pengingat sama sekali.
      if (!j) continue;

      out.push({
        kunci: `${m.id}|${slot}`,
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
      });
    }
  }

  return out.sort(
    (a, b) => a.hour - b.hour || a.minute - b.minute || a.kunci.localeCompare(b.kunci)
  );
}

/**
 * Pengingat berikutnya sesudah `sekarang`, untuk ditampilkan di layar.
 *
 * Membandingkan menit-dalam-hari, lalu berputar ke hari berikutnya bila semua
 * jam hari ini sudah lewat.
 */
export function pengingatBerikutnya(daftar: Pengingat[], sekarang: Date): Pengingat | null {
  if (daftar.length === 0) return null;
  const kini = sekarang.getHours() * 60 + sekarang.getMinutes();
  const menit = (p: Pengingat) => p.hour * 60 + p.minute;
  return daftar.find((p) => menit(p) > kini) ?? daftar[0];
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

/** Dosis yang sudah dijawab pasien hari ini, diminum maupun tidak. */
export interface DosisDijawab {
  medicationId: string;
  slot: number;
}

/**
 * Dosis hari ini yang waktunya SUDAH LEWAT tetapi belum dijawab pasien.
 *
 * Inilah angka yang pantas muncul di ikon aplikasi. Tiga keputusan di dalamnya:
 *
 * 1. Hanya yang waktunya sudah lewat. Dosis pukul 19.00 bukan tunggakan pada
 *    pukul 09.00, dan ikon yang sejak pagi menunjukkan angka tiga hanya
 *    mengajari pasien mengabaikannya.
 *
 * 2. "Dijawab", bukan "diminum". Pasien yang menandai TIDAK meminum obatnya
 *    sudah menjawab, dan menagihnya lagi lewat ikon adalah menegur orang yang
 *    justru sudah jujur.
 *
 * 3. Dihitung dari rencana, bukan dari notifikasi yang menumpuk. Notifikasi
 *    bisa tersapu tanpa dosisnya dijawab, dan bisa pula tertinggal padahal
 *    dosisnya sudah dicentang.
 */
export function dosisBelumDijawab(
  rencana: Pengingat[],
  dijawab: DosisDijawab[],
  sekarang: Date
): number {
  const menitSekarang = sekarang.getHours() * 60 + sekarang.getMinutes();
  const sudah = new Set(dijawab.map((d) => `${d.medicationId}|${d.slot}`));

  return rencana.filter((p) => {
    const lewat = p.hour * 60 + p.minute <= menitSekarang;
    return lewat && !sudah.has(`${p.medicationId}|${p.slot}`);
  }).length;
}
