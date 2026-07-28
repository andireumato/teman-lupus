import { SLEDAI_DESKRIPTOR, SLEDAI_KATEGORI, SLEDAI_KELOMPOK } from '@/constants/sledai';

import { kategoriSledai, scoreSledai, SLEDAI_MAKS, SledaiKeyTidakDikenalError } from './sledai';

describe('daftar deskriptor', () => {
  it('berjumlah 24 dengan kunci unik', () => {
    expect(SLEDAI_DESKRIPTOR).toHaveLength(24);
    expect(new Set(SLEDAI_DESKRIPTOR.map((d) => d.key)).size).toBe(24);
  });

  it('bobotnya hanya 8, 4, 2, atau 1 — sesuai instrumen', () => {
    for (const d of SLEDAI_DESKRIPTOR) {
      expect([8, 4, 2, 1]).toContain(d.bobot);
    }
  });

  it('komposisi bobotnya sesuai SLEDAI-2K: 8×8, 6×4, 7×2, 3×1', () => {
    const hitung = (b: number) => SLEDAI_DESKRIPTOR.filter((d) => d.bobot === b).length;
    expect(hitung(8)).toBe(8);
    expect(hitung(4)).toBe(6);
    expect(hitung(2)).toBe(7);
    expect(hitung(1)).toBe(3);
  });

  it('setiap deskriptor punya definisi bakunya', () => {
    // Definisi inilah yang menentukan boleh atau tidaknya sebuah deskriptor
    // dicentang; tanpa itu penilai hanya menebak dari judulnya.
    for (const d of SLEDAI_DESKRIPTOR) {
      expect(d.definisi.trim().length).toBeGreaterThan(20);
    }
  });

  it('skor maksimumnya 105', () => {
    expect(SLEDAI_MAKS).toBe(105);
  });

  it('setiap kelompok organ punya urutan tampilan', () => {
    for (const d of SLEDAI_DESKRIPTOR) {
      expect(SLEDAI_KELOMPOK).toContain(d.kelompok);
    }
  });
});

describe('scoreSledai', () => {
  it('tanpa deskriptor apa pun bernilai nol', () => {
    expect(scoreSledai({})).toEqual({ total: 0, kategori: 'Remisi', aktif: [] });
  });

  it('menjumlahkan bobot deskriptor yang dicentang', () => {
    // 8 (kejang) + 4 (artritis) + 2 (ruam) + 1 (demam) = 15
    const s = scoreSledai({ kejang: true, artritis: true, ruam: true, demam: true });
    expect(s.total).toBe(15);
    expect(s.kategori).toBe('Berat');
  });

  it('nilai false tidak ikut dihitung', () => {
    expect(scoreSledai({ kejang: false, artritis: true }).total).toBe(4);
  });

  it('deskriptor aktif diurutkan dari bobot terbesar', () => {
    const s = scoreSledai({ demam: true, kejang: true, artritis: true });
    expect(s.aktif.map((d) => d.bobot)).toEqual([8, 4, 1]);
  });

  it('mencentang semuanya menghasilkan skor maksimum', () => {
    const semua = Object.fromEntries(SLEDAI_DESKRIPTOR.map((d) => [d.key, true]));
    expect(scoreSledai(semua).total).toBe(105);
  });

  it('kunci yang tidak dikenal melempar, bukan diabaikan', () => {
    // Diam-diam mengabaikan berarti skor berkurang tanpa ada yang tahu.
    expect(() => scoreSledai({ kejang: true, gejala_karangan: true })).toThrow(
      SledaiKeyTidakDikenalError
    );
  });
});

describe('kategoriSledai', () => {
  // Batasnya mengikuti Carter dkk. 2016 sebagaimana dikutip Suszek dkk. 2024:
  // remisi 0 · ringan 0<x≤6 · sedang 6<x≤12 · berat x>12.
  it.each([
    [0, 'Remisi'],
    [1, 'Ringan'],
    [6, 'Ringan'],
    [7, 'Sedang'],
    [12, 'Sedang'],
    [13, 'Berat'],
    [105, 'Berat'],
  ])('skor %i → %s', (total, label) => {
    expect(kategoriSledai(total)).toBe(label);
  });

  it('ambangnya menurun sehingga pencarian pertama selalu benar', () => {
    const min = SLEDAI_KATEGORI.map((k) => k.min);
    expect([...min].sort((a, b) => b - a)).toEqual(min);
  });
});
