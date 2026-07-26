import { labAbnormal, labRef, SISTEM_GEJALA, SKALA_LELAH, SKALA_NYERI_SENDI } from './lupus';

describe.each([
  ['kelelahan', SKALA_LELAH],
  ['nyeri sendi', SKALA_NYERI_SENDI],
])('skala %s', (_nama, skala) => {
  it('bernilai 0–3 berurutan', () => {
    expect(skala.map((o) => o.v)).toEqual([0, 1, 2, 3]);
  });

  it('setiap tingkat di atas "Tidak ada" punya patokan', () => {
    // Tingkat tanpa patokan membuat pasien menebak bedanya, dan hitungan hari
    // di bagian 3 ringkasan pra-kunjungan jadi tidak sebanding antar pasien.
    for (const o of skala.filter((x) => x.v > 0)) {
      expect(o.ket?.trim()).toBeTruthy();
    }
  });

  it('patokannya menyebut dampak pada kegiatan, bukan sekadar rasa', () => {
    const semua = skala.map((o) => o.ket ?? '').join(' ');
    expect(semua).toMatch(/kegiatan|aktivitas|pekerjaan|mengurus diri/);
  });

  it('punya kode warna dan tidak memakai emoji', () => {
    // Emoji tidak dijamin punya glyph di aplikasi native — lihat catatan di
    // components/mood-scale.tsx. Kode warna dipakai sebagai gantinya.
    for (const o of skala) {
      expect(o.warna).toMatch(/^#[0-9a-f]{6}$/i);
      expect(`${o.label} ${o.ket ?? ''}`).not.toMatch(/\p{Extended_Pictographic}/u);
    }
  });
});

it('kedua skala keluhan sama panjang', () => {
  expect(SKALA_LELAH).toHaveLength(SKALA_NYERI_SENDI.length);
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
