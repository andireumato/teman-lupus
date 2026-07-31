import { keBase64 } from './base64';

/**
 * Diuji silang terhadap `Buffer` milik Node — yang tersedia di Jest tapi TIDAK
 * di Hermes, jadi ia hanya boleh jadi alat uji, bukan alat produksi.
 *
 * Dideklarasikan setempat, bukan lewat `@types/node`: mengaktifkan tipe Node
 * untuk seluruh project akan membuat `Buffer`, `process`, dan `require` tampak
 * sah dipakai di kode aplikasi, padahal tidak ada satu pun di Hermes.
 */
declare const Buffer: { from(b: Uint8Array): { toString(enc: 'base64'): string } };

const acuan = (b: Uint8Array) => Buffer.from(b).toString('base64');

describe('keBase64', () => {
  it('kosong menghasilkan string kosong', () => {
    expect(keBase64(new Uint8Array([]))).toBe('');
  });

  it('cocok dengan vektor RFC 4648', () => {
    const teks = (s: string) => keBase64(Uint8Array.from(s, (c) => c.charCodeAt(0)));
    expect(teks('')).toBe('');
    expect(teks('f')).toBe('Zg==');
    expect(teks('fo')).toBe('Zm8=');
    expect(teks('foo')).toBe('Zm9v');
    expect(teks('foob')).toBe('Zm9vYg==');
    expect(teks('fooba')).toBe('Zm9vYmE=');
    expect(teks('foobar')).toBe('Zm9vYmFy');
  });

  it('padding benar untuk setiap sisa panjang', () => {
    for (let n = 0; n <= 32; n++) {
      const data = new Uint8Array(n).map((_, i) => (i * 7 + 3) & 0xff);
      expect(keBase64(data)).toBe(acuan(data));
    }
  });

  it('menangani byte tinggi tanpa meluap tanda', () => {
    // 0x80..0xff naik ke bit ke-16 saat digeser; salah pakai `>>` alih-alih
    // `>>>` atau lupa `& 63` akan terlihat di sini.
    const data = new Uint8Array(256).map((_, i) => i);
    expect(keBase64(data)).toBe(acuan(data));
  });

  it('benar melewati batas potongan 8192 karakter', () => {
    // Panjang sengaja bukan kelipatan 3 maupun kelipatan potongan, supaya
    // pemotongan buffer dan padding diuji bersamaan.
    const data = new Uint8Array(20_000).map((_, i) => (i * 31) & 0xff);
    expect(keBase64(data)).toBe(acuan(data));
  });

  it('hanya memakai abjad base64 baku', () => {
    const data = new Uint8Array(300).map((_, i) => (i * 13) & 0xff);
    expect(keBase64(data)).toMatch(/^[A-Za-z0-9+/]*={0,2}$/);
  });
});
