import { MarsIncompleteError, scoreMars } from './mars';

describe('MARS-5', () => {
  it('menjumlahkan kelima item', () => {
    expect(scoreMars([1, 2, 3, 4, 5]).total).toBe(15);
  });

  it('skor maksimum = kepatuhan tinggi', () => {
    expect(scoreMars([5, 5, 5, 5, 5])).toEqual({ total: 25, kategori: 'Tinggi' });
  });

  it('skor minimum = kepatuhan rendah', () => {
    expect(scoreMars([1, 1, 1, 1, 1])).toEqual({ total: 5, kategori: 'Rendah' });
  });

  it.each([
    [[5, 5, 5, 4, 4], 23, 'Tinggi'],
    [[5, 5, 4, 4, 4], 22, 'Sedang'],
    [[4, 4, 4, 3, 3], 18, 'Sedang'],
    [[4, 3, 3, 3, 4], 17, 'Rendah'],
  ])('%p → total %i, kategori %s', (items, total, kategori) => {
    expect(scoreMars(items as number[])).toEqual({ total, kategori });
  });

  it('menolak jawaban yang belum lengkap', () => {
    expect(() => scoreMars([1, 2, 3, null, 5])).toThrow(MarsIncompleteError);
    expect(() => scoreMars([1, 2, 3, 4])).toThrow(MarsIncompleteError);
  });

  it('menolak nilai di luar 1–5', () => {
    expect(() => scoreMars([0, 2, 3, 4, 5])).toThrow(RangeError);
    expect(() => scoreMars([1, 2, 3, 4, 6])).toThrow(RangeError);
    expect(() => scoreMars([1.5, 2, 3, 4, 5])).toThrow(RangeError);
  });
});
