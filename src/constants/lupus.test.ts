import { labAbnormal, labRef, SISTEM_GEJALA, SKALA_LELAH, SKALA_NYERI_SENDI } from './lupus';

describe('skala kelelahan', () => {
  it('bernilai 0–3 berurutan, sama panjang dengan nyeri sendi', () => {
    expect(SKALA_LELAH.map((o) => o.v)).toEqual([0, 1, 2, 3]);
    expect(SKALA_LELAH).toHaveLength(SKALA_NYERI_SENDI.length);
  });

  it('setiap tingkat di atas "Tidak ada" punya patokan fungsional', () => {
    // Tingkat tanpa patokan membuat pasien menebak bedanya, dan hitungan hari
    // di bagian 3 ringkasan pra-kunjungan jadi tidak sebanding antar pasien.
    for (const o of SKALA_LELAH.filter((x) => x.v > 0)) {
      expect(o.ket?.trim()).toBeTruthy();
    }
  });

  it('patokannya menyebut fungsi, bukan sekadar rasa capek', () => {
    const semua = SKALA_LELAH.map((o) => o.ket ?? '').join(' ');
    expect(semua).toMatch(/istirahat/);
    expect(semua).toMatch(/aktivitas|pekerjaan|mengurus diri/);
  });
});

describe('nilai rujukan lab', () => {
  it('menandai di luar rentang pada kedua sisi', () => {
    expect(labAbnormal('Komplemen C3', 70)).toBe(true);
    expect(labAbnormal('Komplemen C3', 120)).toBe(false);
    expect(labAbnormal('Komplemen C3', 200)).toBe(true);
  });

  it('nilai kosong atau panel tanpa rujukan tidak ditandai', () => {
    expect(labAbnormal('Komplemen C3', null)).toBe(false);
    expect(labAbnormal('Panel yang tidak ada', 999)).toBe(false);
    expect(labRef('Panel yang tidak ada')).toBeUndefined();
  });
});

describe('daftar gejala', () => {
  it('tidak ada item ganda dalam satu sistem organ', () => {
    for (const s of SISTEM_GEJALA) {
      expect(new Set(s.items).size).toBe(s.items.length);
    }
  });
});
