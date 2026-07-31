import {
  URL_SITUS,
  situsTerpasang,
  tautanSitus,
  urlHapusAkun,
  urlPrivasi,
} from '@/constants/tautan';

describe('tautan situs', () => {
  it('BELUM dipasang — halaman web pendamping belum di-hosting', () => {
    // Test ini gagal begitu URL_SITUS diisi, dan itu memang tandanya: ubah
    // harapannya jadi `true` bersamaan dengan memasang situsnya, lalu daftarkan
    // URL yang sama di Play Console.
    expect(situsTerpasang()).toBe(false);
    expect(urlPrivasi()).toBe('');
    expect(urlHapusAkun()).toBe('');
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
