/**
 * Geometri grafik garis, dipisahkan dari komponennya supaya bisa diuji.
 *
 * Proyek ini tidak memakai react-native-svg; garisnya digambar sebagai `View`
 * tipis yang diputar. Perhitungan posisi & sudutnya ada di sini, murni tanpa
 * React, jadi kesalahan skala atau sudut ketahuan lewat test — bukan lewat
 * memelototi layar.
 */

export interface TitikGrafik {
  tanggal: string;
  /** Indeks pada sumbu X (hari ke berapa dalam rentang). */
  i: number;
  nilai: number;
  x: number;
  y: number;
}

export interface RuasGrafik {
  key: string;
  left: number;
  top: number;
  width: number;
  /** Sudut putar siap pakai, mis. "-26.57deg". */
  sudut: string;
}

/**
 * Titik untuk tiap tanggal yang punya nilai.
 *
 * Nilai dipotong ke rentang 0–max: baris lama bisa memakai skala yang sudah
 * dipendekkan (mis. kelelahan 4 sebelum tingkat "Sangat berat" dihapus) dan
 * tanpa ini akan tergambar di luar kotak grafik.
 */
export function titikGrafik({
  hari,
  nilai,
  max,
  lebar,
  tinggi,
}: {
  hari: string[];
  nilai: Map<string, number>;
  max: number;
  lebar: number;
  tinggi: number;
}): TitikGrafik[] {
  const x = (i: number) => (hari.length < 2 ? lebar / 2 : (i / (hari.length - 1)) * lebar);
  const y = (v: number) => tinggi - (Math.min(max, Math.max(0, v)) / max) * tinggi;

  const out: TitikGrafik[] = [];
  hari.forEach((tanggal, i) => {
    const v = nilai.get(tanggal);
    if (v == null) return;
    out.push({ tanggal, i, nilai: v, x: x(i), y: y(v) });
  });
  return out;
}

/**
 * Ruas penghubung antar titik.
 *
 * HANYA hari yang benar-benar bersebelahan yang disambung. Menyambung dua
 * titik yang terpaut beberapa hari akan mengarang nilai untuk hari yang
 * pasien memang tidak mencatat apa pun.
 */
export function ruasGrafik(titik: TitikGrafik[]): RuasGrafik[] {
  const out: RuasGrafik[] = [];
  for (let k = 1; k < titik.length; k++) {
    const a = titik[k - 1];
    const b = titik[k];
    if (b.i - a.i !== 1) continue;

    const dx = b.x - a.x;
    const dy = b.y - a.y;
    out.push({
      key: `${a.tanggal}-${b.tanggal}`,
      left: a.x,
      top: a.y,
      width: Math.hypot(dx, dy),
      sudut: `${(Math.atan2(dy, dx) * 180) / Math.PI}deg`,
    });
  }
  return out;
}
