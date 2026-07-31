import {
  URL_SITUS,
  situsTerpasang,
  tautanSitus,
  urlHapusAkun,
  urlPrivasi,
} from '@/constants/tautan';

describe('tautan situs', () => {
  it('sudah dipasang — halaman web pendamping hidup di GitHub Pages', () => {
    expect(situsTerpasang()).toBe(true);
  });

  it('kedua alamatnya utuh dan berbeda', () => {
    // Diverifikasi HTTP 200 pada 31 Juli 2026. Kalau salah satu berubah jadi
    // sama, satu di antaranya salah ketik.
    expect(urlPrivasi()).toBe('https://andireumato.github.io/teman-lupus/');
    expect(urlHapusAkun()).toBe('https://andireumato.github.io/teman-lupus/hapus-akun.html');
    expect(urlPrivasi()).not.toBe(urlHapusAkun());
  });

  it('memakai https, bukan http', () => {
    // Kebijakan privasi yang disajikan tanpa TLS akan ditolak peninjau Play.
    for (const u of [urlPrivasi(), urlHapusAkun()]) expect(u.startsWith('https://')).toBe(true);
  });

  it('tidak ada garis miring ganda di tengah alamat', () => {
    // Cacat penyambungan yang paling sering lolos mata: `.../teman-lupus//hapus-akun.html`.
    for (const u of [urlPrivasi(), urlHapusAkun()]) {
      expect(u.slice('https://'.length)).not.toContain('//');
    }
  });

  it('konstanta dasarnya string, bukan undefined', () => {
    expect(typeof URL_SITUS).toBe('string');
  });
});

describe('tautanSitus', () => {
  // Diuji lewat fungsi murninya karena URL_SITUS sengaja masih kosong.
  const sambung = (dasar: string, berkas = '') => {
    if (dasar.trim() === '') return '';
    return dasar.trim().replace(/\/+$/, '') + '/' + berkas.replace(/^\/+/, '');
  };

  it('cocok dengan implementasinya saat dasarnya kosong', () => {
    expect(tautanSitus('hapus-akun.html')).toBe(sambung(URL_SITUS, 'hapus-akun.html'));
  });

  it('menormalkan garis miring di kedua sisi', () => {
    // Alamat GitHub Pages disalin orang kadang dengan garis miring, kadang
    // tanpa. Tanpa normalisasi hasilnya `.../teman-lupushapus-akun.html`.
    expect(sambung('https://a.github.io/tl/', 'hapus-akun.html')).toBe(
      'https://a.github.io/tl/hapus-akun.html'
    );
    expect(sambung('https://a.github.io/tl', 'hapus-akun.html')).toBe(
      'https://a.github.io/tl/hapus-akun.html'
    );
    expect(sambung('https://a.github.io/tl///', '/hapus-akun.html')).toBe(
      'https://a.github.io/tl/hapus-akun.html'
    );
  });

  it('tanpa nama berkas menghasilkan alamat dasar berakhir garis miring', () => {
    expect(sambung('https://a.github.io/tl')).toBe('https://a.github.io/tl/');
  });

  it('dasar kosong tetap kosong, bukan garis miring sendirian', () => {
    // '/' akan terbuka sebagai tautan rusak; string kosong bisa dideteksi.
    expect(sambung('')).toBe('');
    expect(sambung('   ', 'hapus-akun.html')).toBe('');
  });
});
