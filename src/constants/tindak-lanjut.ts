/**
 * TINDAK LANJUT PERINGATAN RED-FLAG — pilihan yang diisi dokter saat menutup
 * peringatan di `/dokter/peringatan`.
 *
 * Dua sumbu yang sengaja DIPISAH:
 *
 *   1. `TINDAKAN` — apa yang dokter lakukan
 *   2. `KONDISI`  — keadaan pasien saat dihubungi
 *
 * Digabung jadi satu daftar, keduanya saling menutupi: "obat disesuaikan"
 * tidak memberi tahu apakah pasiennya membaik atau memburuk, dan "sudah ke
 * IGD sendiri" tidak memberi tahu apa yang dokter putuskan sesudahnya. Dipisah,
 * keduanya bisa disilangkan — mis. berapa persen peringatan DARURAT yang
 * ternyata sudah membaik sendiri sebelum dokter sempat menghubungi. Angka itu
 * yang menunjukkan apakah ambang red-flag terlalu sensitif.
 *
 * Kodenya (`v`) yang masuk database dan ekspor CSV, bukan labelnya. Label boleh
 * diperbaiki kapan saja tanpa memutus data yang sudah terkumpul — nilai `v`
 * TIDAK boleh diubah, karena ia harus tetap sama dengan CHECK constraint di
 * supabase/tindak_lanjut_alert.sql.
 */

export interface PilihanTindakLanjut {
  v: string;
  label: string;
}

/** Sumbu 1 — apa yang dokter lakukan. */
export const TINDAKAN: PilihanTindakLanjut[] = [
  { v: 'edukasi', label: 'Cukup edukasi / observasi' },
  { v: 'obat_disesuaikan', label: 'Obat disesuaikan' },
  { v: 'kunjungan_dipercepat', label: 'Kunjungan dipercepat' },
  { v: 'dirujuk', label: 'Dirujuk IGD / rawat inap' },
  { v: 'tak_terhubung', label: 'Pasien tidak bisa dihubungi' },
];

/** Sumbu 2 — kondisi pasien saat dihubungi. */
export const KONDISI: PilihanTindakLanjut[] = [
  { v: 'membaik_sendiri', label: 'Sudah membaik sendiri' },
  { v: 'masih_bergejala', label: 'Masih bergejala' },
  { v: 'sudah_ke_igd', label: 'Sudah ke IGD sendiri' },
  { v: 'dirawat_inap', label: 'Sedang dirawat inap' },
  { v: 'tidak_diketahui', label: 'Tidak diketahui' },
];

/**
 * Tindakan yang berarti pasiennya TIDAK pernah tersambung.
 *
 * Dipakai untuk mengunci sumbu kedua: dokter yang tidak berhasil menghubungi
 * pasien tidak mungkin tahu kondisinya, dan membiarkan kombinasi itu terisi
 * bebas menghasilkan data penelitian yang tidak konsisten. Dijaga juga oleh
 * CHECK constraint di database — lihat `tak_terhubung_berarti_tak_diketahui`.
 */
export const TINDAKAN_TANPA_KONTAK = 'tak_terhubung';

/** Kondisi yang dipaksakan saat pasien tidak bisa dihubungi. */
export const KONDISI_TIDAK_DIKETAHUI = 'tidak_diketahui';

const cari = (daftar: PilihanTindakLanjut[], v: string | null | undefined): string | null => {
  if (!v) return null;
  // Nilai yang tidak dikenal dikembalikan APA ADANYA, bukan jadi null: baris
  // dari versi yang lebih baru harus tetap terbaca, meski tanpa label rapi.
  return daftar.find((d) => d.v === v)?.label ?? v;
};

export const labelTindakan = (v: string | null | undefined): string | null => cari(TINDAKAN, v);
export const labelKondisi = (v: string | null | undefined): string | null => cari(KONDISI, v);
