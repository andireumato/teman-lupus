/**
 * LupusQoL — struktur instrumen, TANPA teks butirnya.
 *
 * ⚠️ HAK CIPTA. LupusQoL dimiliki University of Central Lancashire dan East
 * Lancashire Hospitals NHS Trust, dan dilisensikan lewat RWS Life Sciences
 * (LupusQoL@rws.com). Ketentuannya: *"may not be reproduced or translated in
 * whole or in part without the express written permission of the copyright
 * holder."* GRATIS untuk peneliti akademik, tetapi izin tertulis tetap wajib
 * diminta lebih dulu.
 *
 * Karena itu berkas ini TIDAK memuat satu pun kalimat butir maupun pilihan
 * jawabannya. Yang ada di sini hanya METADATA yang sudah terbit di literatur
 * dan bukan objek hak cipta: berapa domainnya, berapa butir per domain, rentang
 * skalanya, dan cara menghitung skornya.
 *
 * Sumber metadata:
 * - McElhone K, dkk. Arthritis Rheum 2007;57(6):972–9 (PMID 17665467) — instrumen asli
 * - Hosseini N, dkk. Int J Rheumatol 2014 (PMID 25313310) — rincian domain & skoring
 * - Anindito B, Hidayat R, Koesnoe S, Dewianty E. Indonesian Journal of
 *   Rheumatology 2016;8(2):38–44 — validasi versi Indonesia (LupusQoL-ID)
 *
 * CARA MENGAKTIFKANNYA setelah izin turun: isi `TEKS_BUTIR` dan `TEKS_PILIHAN`
 * di bawah dengan naskah resmi LupusQoL-ID. Tidak ada berkas lain yang perlu
 * disentuh — layar dan penghitung skornya sudah siap dan teruji.
 *
 * Catatan yang perlu ikut ditanyakan saat meminta izin:
 * 1. Bahasa Indonesia TIDAK tercantum di 77 bahasa/51 negara yang terdaftar di
 *    RWS. Validasi Anindito 2016 tampaknya terjemahan akademik independen.
 * 2. Versi aslinya divalidasi untuk KERTAS. Pemberian lewat layar adalah
 *    adaptasi cara pemberian dan perlu dibicarakan terpisah.
 */

export interface DomainLupusQol {
  key: string;
  label: string;
  /** Jumlah butir dalam domain ini. Totalnya harus 34. */
  jumlah: number;
  /**
   * Butir yang boleh dijawab "tidak berlaku".
   *
   * Domain hubungan intim satu-satunya yang punya pilihan itu di instrumen
   * aslinya — pasien tanpa pasangan tidak bisa menjawabnya, dan memaksa mereka
   * memilih angka akan mengarang data.
   */
  bolehTakBerlaku: boolean;
}

/** Delapan domain, 34 butir. Urutannya mengikuti publikasi aslinya. */
export const LUPUSQOL_DOMAIN: DomainLupusQol[] = [
  { key: 'fisik', label: 'Kesehatan fisik', jumlah: 8, bolehTakBerlaku: false },
  { key: 'nyeri', label: 'Nyeri', jumlah: 3, bolehTakBerlaku: false },
  { key: 'perencanaan', label: 'Perencanaan', jumlah: 3, bolehTakBerlaku: false },
  { key: 'intim', label: 'Hubungan intim', jumlah: 2, bolehTakBerlaku: true },
  { key: 'beban', label: 'Beban bagi orang lain', jumlah: 3, bolehTakBerlaku: false },
  { key: 'emosi', label: 'Kesehatan emosional', jumlah: 6, bolehTakBerlaku: false },
  { key: 'citra_tubuh', label: 'Citra tubuh', jumlah: 5, bolehTakBerlaku: false },
  { key: 'kelelahan', label: 'Kelelahan', jumlah: 4, bolehTakBerlaku: false },
];

/** Skala Likert 5 titik, 0–4. Nol = kondisi terburuk. */
export const NILAI_MIN = 0;
export const NILAI_MAKS = 4;

/** Periode ingat instrumen, dalam minggu. Ikut dicatat di ekspor. */
export const PERIODE_INGAT_MINGGU = 4;

/**
 * Kunci butir, mis. `fisik_1` … `kelelahan_4`.
 *
 * Diturunkan dari `LUPUSQOL_DOMAIN`, bukan diketik satu per satu: daftar yang
 * diketik ulang akan meleset dari jumlah domainnya tanpa ada yang menyadari.
 */
export const LUPUSQOL_BUTIR: string[] = LUPUSQOL_DOMAIN.flatMap((d) =>
  Array.from({ length: d.jumlah }, (_, i) => `${d.key}_${i + 1}`)
);

/** Jumlah butir seluruhnya. 34 menurut instrumen aslinya. */
export const JUMLAH_BUTIR = LUPUSQOL_BUTIR.length;

/**
 * Teks butir resmi LupusQoL-ID — KOSONG sampai izin tertulis diperoleh.
 *
 * Kuncinya harus sama persis dengan `LUPUSQOL_BUTIR`. Jangan mengisinya dengan
 * terjemahan buatan sendiri: yang membuat skornya sebanding dengan literatur
 * adalah kata-kata yang sudah divalidasi, bukan strukturnya.
 */
export const TEKS_BUTIR: Record<string, string> = {};

/**
 * Teks lima pilihan jawaban, urut dari nilai 0 sampai 4 — KOSONG sampai izin
 * tertulis diperoleh. Pilihan jawaban adalah bagian dari instrumen, jadi
 * tercakup ketentuan hak cipta yang sama.
 */
export const TEKS_PILIHAN: string[] = [];

/** Label "tidak berlaku" bukan bagian instrumen, jadi boleh ditulis di sini. */
export const LABEL_TAK_BERLAKU = 'Tidak berlaku bagi saya';

/**
 * Apakah naskah resminya sudah dipasang.
 *
 * Layar pengisian memakai ini untuk memutuskan menampilkan kuesioner atau
 * penjelasan bahwa lisensinya belum ada. Diperiksa di sini, sekali, supaya
 * tidak ada layar yang lupa memeriksanya dan menampilkan 34 baris kosong.
 */
export function naskahTerpasang(): boolean {
  return (
    TEKS_PILIHAN.length === NILAI_MAKS - NILAI_MIN + 1 &&
    LUPUSQOL_BUTIR.every((k) => (TEKS_BUTIR[k] ?? '').trim().length > 0)
  );
}

const PETA_DOMAIN = new Map(LUPUSQOL_DOMAIN.map((d) => [d.key, d]));

export function labelDomain(key: string): string {
  return PETA_DOMAIN.get(key)?.label ?? key;
}

/** Domain pemilik sebuah kunci butir, mis. `fisik_3` → domain `fisik`. */
export function domainButir(butir: string): DomainLupusQol | null {
  return PETA_DOMAIN.get(butir.slice(0, butir.lastIndexOf('_'))) ?? null;
}
