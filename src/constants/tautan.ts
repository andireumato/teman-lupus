/**
 * Alamat halaman web pendamping aplikasi.
 *
 * Berkasnya ada di `docs/` dan siap dipasang di GitHub Pages (Settings → Pages
 * → Source: Deploy from a branch → main → /docs). Isi `URL_SITUS` di bawah
 * dengan alamat hasilnya, lalu tautannya muncul sendiri di layar Profil.
 *
 * ⚠️ Google Play menuntut URL kebijakan privasi yang SAMA PERSIS di tiga
 * tempat: Play Console, di dalam aplikasi, dan di situsnya. Karena itu semuanya
 * diturunkan dari satu konstanta ini — tiga string yang diketik terpisah pasti
 * berselisih suatu saat, dan yang menemukannya adalah peninjau Play.
 *
 * Selama masih kosong, tautannya disembunyikan: tombol yang membuka halaman
 * kosong lebih buruk daripada tidak ada tombol. Kosongkan hanya selama pilot
 * lewat distribusi internal — sebelum kirim ke Play, ini WAJIB terisi.
 */

/**
 * Alamat dasar situs.
 *
 * Dipasang 31 Juli 2026 di GitHub Pages dari `docs/` pada branch `main` repo
 * `andireumato/teman-lupus`. Mengubah nama repo atau memindahkan foldernya akan
 * memutus alamat ini — dan Play menolak aplikasi yang tautan kebijakan
 * privasinya mati.
 */
export const URL_SITUS = 'https://andireumato.github.io/teman-lupus/';

/**
 * Menyambung alamat dasar dengan nama berkas.
 *
 * Garis miring di ujung `URL_SITUS` dinormalkan: alamat GitHub Pages disalin
 * orang kadang dengan garis miring, kadang tanpa, dan `.../teman-lupushapus-akun.html`
 * adalah tautan rusak yang hanya ketahuan saat diklik.
 */
export function tautanSitus(berkas = ''): string {
  const dasar = URL_SITUS.trim();
  if (dasar === '') return '';
  return dasar.replace(/\/+$/, '') + '/' + berkas.replace(/^\/+/, '');
}

/** Kebijakan privasi. String kosong berarti situsnya belum dipasang. */
export const urlPrivasi = (): string => tautanSitus();

/** Halaman permintaan hapus akun, untuk yang tidak bisa membuka aplikasi. */
export const urlHapusAkun = (): string => tautanSitus('hapus-akun.html');

/** Apakah situsnya sudah dipasang dan tautannya layak ditampilkan. */
export const situsTerpasang = (): boolean => URL_SITUS.trim() !== '';
