import { ruasGrafik, titikGrafik } from './grafik';

const HARI = ['2026-07-01', '2026-07-02', '2026-07-03', '2026-07-04', '2026-07-05'];

const titik = (nilai: Map<string, number>, max = 4) =>
  titikGrafik({ hari: HARI, nilai, max, lebar: 100, tinggi: 80 });

describe('titikGrafik', () => {
  it('membentangkan sumbu X dari tepi ke tepi', () => {
    const p = titik(
      new Map([
        [HARI[0], 0],
        [HARI[4], 0],
      ])
    );
    expect(p[0].x).toBe(0);
    expect(p[1].x).toBe(100);
  });

  it('nilai tertinggi di atas, nol di dasar', () => {
    const p = titik(
      new Map([
        [HARI[0], 4],
        [HARI[1], 0],
        [HARI[2], 2],
      ])
    );
    expect(p[0].y).toBe(0);
    expect(p[1].y).toBe(80);
    expect(p[2].y).toBe(40);
  });

  it('nilai di luar skala dipotong, tidak digambar keluar kotak', () => {
    // Kelelahan 4 dari versi lama, sekarang skalanya 0–3.
    const p = titikGrafik({
      hari: HARI,
      nilai: new Map([
        [HARI[0], 4],
        [HARI[1], -1],
      ]),
      max: 3,
      lebar: 100,
      tinggi: 80,
    });
    expect(p[0].y).toBe(0);
    expect(p[1].y).toBe(80);
  });

  it('hari tanpa nilai dilewati, indeksnya tetap sesuai tanggal', () => {
    const p = titik(
      new Map([
        [HARI[0], 1],
        [HARI[3], 1],
      ])
    );
    expect(p.map((x) => x.i)).toEqual([0, 3]);
  });

  it('satu hari saja diletakkan di tengah', () => {
    const p = titikGrafik({
      hari: [HARI[0]],
      nilai: new Map([[HARI[0], 2]]),
      max: 4,
      lebar: 100,
      tinggi: 80,
    });
    expect(p[0].x).toBe(50);
  });
});

describe('ruasGrafik', () => {
  it('menyambung hari yang bersebelahan', () => {
    const p = titik(
      new Map([
        [HARI[0], 2],
        [HARI[1], 2],
      ])
    );
    const r = ruasGrafik(p);
    expect(r).toHaveLength(1);
    expect(r[0].width).toBe(25);
    expect(r[0].sudut).toBe('0deg');
  });

  it('memutus garis pada hari yang tidak diisi', () => {
    // Menyambung 1 Juli ke 4 Juli akan mengarang nilai untuk 2 & 3 Juli.
    const p = titik(
      new Map([
        [HARI[0], 1],
        [HARI[3], 3],
      ])
    );
    expect(ruasGrafik(p)).toEqual([]);
  });

  it('menyambung hanya potongan yang bersambung', () => {
    const p = titik(
      new Map([
        [HARI[0], 1],
        [HARI[1], 1],
        [HARI[3], 1],
        [HARI[4], 1],
      ])
    );
    const r = ruasGrafik(p);
    expect(r.map((x) => x.key)).toEqual(['2026-07-01-2026-07-02', '2026-07-04-2026-07-05']);
  });

  it('nilai naik berarti sudut negatif — sumbu Y layar ke bawah', () => {
    const p = titik(
      new Map([
        [HARI[0], 0],
        [HARI[1], 4],
      ])
    );
    const r = ruasGrafik(p);
    expect(Number.parseFloat(r[0].sudut)).toBeLessThan(0);
    // Panjangnya sisi miring: dx 25, dy 80.
    expect(r[0].width).toBeCloseTo(Math.hypot(25, 80), 5);
  });

  it('titik tunggal tidak menghasilkan ruas', () => {
    expect(ruasGrafik(titik(new Map([[HARI[2], 2]])))).toEqual([]);
  });
});
