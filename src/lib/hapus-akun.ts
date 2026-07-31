/**
 * Penghapusan akun — bagian yang murni dan bisa diuji.
 *
 * Yang ada di sini: menerjemahkan pratinjau dari database jadi kalimat yang
 * bisa dinilai pemakainya, dan memeriksa kata konfirmasi. Panggilan RPC dan
 * keluar sesi ada di layarnya.
 *
 * Dipisah karena ini satu-satunya jalur di aplikasi yang menghapus data pasien
 * secara permanen. Kalau angkanya salah, pemakai menyetujui sesuatu yang
 * berbeda dari yang terjadi — dan tidak ada cara membatalkannya.
 */

/** Yang harus diketik pemakai supaya tombolnya hidup. */
export const KATA_KONFIRMASI = 'HAPUS';

/**
 * Apakah ketikan konfirmasinya cocok.
 *
 * Spasi di ujung dimaafkan (papan ketik ponsel kerap menambahkannya sendiri),
 * huruf besar-kecil tidak — mengetik kata itu harus terasa disengaja.
 */
export function konfirmasiCocok(teks: string): boolean {
  return teks.trim() === KATA_KONFIRMASI;
}

export type Peran = 'patient' | 'doctor';

export interface Pratinjau {
  peran: Peran;
  /** Baris data yang akan hilang, hanya yang jumlahnya lebih dari nol. */
  rincian: { label: string; jumlah: number }[];
  /** Total seluruh baris. */
  total: number;
  /** Pasien yang akan terlepas — hanya diisi untuk dokter. */
  pasienTertaut: number;
}

/**
 * Label bahasa awam per tabel.
 *
 * Urutannya sengaja mengikuti apa yang paling sering pasien isi, bukan urutan
 * abjad: yang pertama dibaca harus yang paling dia kenali sebagai miliknya.
 */
const LABEL: [string, string][] = [
  ['daily_checkins', 'Check-in harian'],
  ['medications', 'Obat'],
  ['med_logs', 'Catatan minum obat'],
  ['med_side_effects', 'Laporan efek samping'],
  ['medication_events', 'Riwayat mulai/berhenti obat'],
  ['flare_checks', 'Cek Flare'],
  ['alerts', 'Peringatan ke dokter'],
  ['mars_assessments', 'Kuesioner MARS-5'],
  ['lupusqol_assessments', 'Kuesioner LupusQoL'],
  ['sledai_assessments', 'Penilaian SLEDAI-2K'],
  ['lab_results', 'Hasil lab'],
  ['visits', 'Catatan kunjungan'],
  ['visit_questions', 'Pertanyaan untuk dokter'],
];

/**
 * Membaca jsonb dari `pratinjau_hapus_akun()`.
 *
 * Kunci yang tidak dikenal DIABAIKAN, bukan ditampilkan mentah: fungsi database
 * bisa menambah tabel baru sebelum berkas ini menyusul, dan menampilkan
 * "med_logs_v2: 14" kepada pasien lebih buruk daripada tidak menampilkannya.
 * Tetapi jumlahnya tetap ikut `total` — angka besar di kalimat penutup lebih
 * jujur daripada rincian yang diam-diam kurang.
 */
export function bacaPratinjau(raw: unknown): Pratinjau {
  const o = (raw ?? {}) as Record<string, unknown>;
  const angka = (v: unknown): number => (typeof v === 'number' && v >= 0 ? v : 0);

  const rincian = LABEL.map(([k, label]) => ({ label, jumlah: angka(o[k]) })).filter(
    (r) => r.jumlah > 0
  );

  // Dijumlah dari SELURUH kunci angka, bukan hanya yang punya label.
  let total = 0;
  for (const [k, v] of Object.entries(o)) {
    if (k === 'pasien_tertaut') continue;
    total += angka(v);
  }

  return {
    peran: o.peran === 'doctor' ? 'doctor' : 'patient',
    rincian,
    total,
    pasienTertaut: angka(o.pasien_tertaut),
  };
}

/**
 * Kalimat penutup di layar konfirmasi.
 *
 * Dibuat di sini, bukan dirangkai di JSX, supaya bunyinya bisa dikunci test —
 * termasuk keadaan yang mudah terlewat: akun yang belum berisi apa-apa.
 */
export function kalimatRingkas(p: Pratinjau): string {
  if (p.peran === 'doctor') {
    if (p.pasienTertaut === 0) {
      return 'Akun dokter Anda akan dihapus. Tidak ada pasien yang tertaut.';
    }
    const n = p.pasienTertaut;
    return `${n} pasien akan terlepas dari Anda. Data mereka TIDAK ikut terhapus — mereka tetap memilikinya dan bisa menautkan diri ke dokter lain.`;
  }
  if (p.total === 0) {
    return 'Belum ada catatan yang tersimpan. Akun Anda akan dihapus.';
  }
  return `${p.total} catatan akan dihapus permanen dan tidak bisa dikembalikan.`;
}
