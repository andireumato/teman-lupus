import { bacaUvMax, uvCategory } from './uv';

describe('uvCategory', () => {
  it.each([
    [0, 'Rendah'],
    [2.9, 'Rendah'],
    [3, 'Sedang'],
    [5.9, 'Sedang'],
    [6, 'Tinggi'],
    [7.9, 'Tinggi'],
    [8, 'Sangat tinggi'],
    [10.9, 'Sangat tinggi'],
    [11, 'Ekstrem'],
    [15, 'Ekstrem'],
  ])('UV %s → %s', (v, label) => {
    expect(uvCategory(v).label).toBe(label);
  });

  it('selalu memberi saran yang tidak kosong', () => {
    for (let v = 0; v <= 15; v += 0.5) {
      expect(uvCategory(v).saran.length).toBeGreaterThan(0);
    }
  });

  it('menyebut lupus pada tingkat yang berbahaya', () => {
    expect(uvCategory(9).saran).toMatch(/lupus/i);
  });
});

describe('bacaUvMax', () => {
  it('membaca nilai pertama', () => {
    expect(bacaUvMax({ daily: { uv_index_max: [7.35, 8.1] } })).toBe(7.35);
  });

  it('menerima nol sebagai nilai sah', () => {
    expect(bacaUvMax({ daily: { uv_index_max: [0] } })).toBe(0);
  });

  it.each([
    ['null', null],
    ['string', 'bukan objek'],
    ['objek kosong', {}],
    ['daily null', { daily: null }],
    ['tanpa uv_index_max', { daily: {} }],
    ['array kosong', { daily: { uv_index_max: [] } }],
    ['nilai bukan angka', { daily: { uv_index_max: ['7'] } }],
    ['nilai null', { daily: { uv_index_max: [null] } }],
    ['NaN', { daily: { uv_index_max: [NaN] } }],
    ['Infinity', { daily: { uv_index_max: [Infinity] } }],
  ])('menolak %s', (_label, json) => {
    expect(bacaUvMax(json)).toBeNull();
  });
});
