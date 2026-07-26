/**
 * Indeks UV harian.
 *
 * Fotosensitivitas adalah pemicu flare utama pada lupus, jadi kartu ini
 * bersifat edukatif — bukan penilaian klinis dan tidak masuk red-flag engine.
 *
 * Sumber data: Open-Meteo (gratis, tanpa API key).
 */

export interface UvKategori {
  label: string;
  /** Warna teks utama. */
  warna: string;
  /** Warna latar kartu. */
  latar: string;
  /** Warna garis tepi. */
  garis: string;
  saran: string;
}

/** Ambang mengikuti kategori WHO Global Solar UV Index. */
export function uvCategory(v: number): UvKategori {
  if (v < 3)
    return {
      label: 'Rendah',
      warna: '#15803d',
      latar: '#f0fdf4',
      garis: '#bbf7d0',
      saran: 'Aman beraktivitas. Tetap sedia tabir surya bila keluar lama.',
    };
  if (v < 6)
    return {
      label: 'Sedang',
      warna: '#b45309',
      latar: '#fffbeb',
      garis: '#fde68a',
      saran: 'Pakai tabir surya SPF ≥30, topi, dan kacamata bila keluar.',
    };
  if (v < 8)
    return {
      label: 'Tinggi',
      warna: '#c2410c',
      latar: '#fff7ed',
      garis: '#fed7aa',
      saran: 'Batasi paparan pukul 10.00–16.00. Tabir surya, topi lebar, baju lengan panjang.',
    };
  if (v < 11)
    return {
      label: 'Sangat tinggi',
      warna: '#b91c1c',
      latar: '#fef2f2',
      garis: '#fecaca',
      saran: 'Hindari matahari siang. Lindungi kulit menyeluruh — penting bagi lupus.',
    };
  return {
    label: 'Ekstrem',
    warna: '#7e22ce',
    latar: '#faf5ff',
    garis: '#e9d5ff',
    saran: 'Sebisa mungkin di dalam ruangan siang hari. Proteksi maksimal bila terpaksa keluar.',
  };
}

/** Lokasi cadangan: RSUP H. Adam Malik, Medan. */
export const KOORDINAT_CADANGAN = { lat: 3.595, lon: 98.672 } as const;

export interface Koordinat {
  lat: number;
  lon: number;
  /** true bila memakai lokasi cadangan, bukan lokasi pasien sebenarnya. */
  perkiraan: boolean;
}

export interface UvHarian {
  uv: number;
  perkiraan: boolean;
}

const ENDPOINT = 'https://api.open-meteo.com/v1/forecast';

/**
 * Ambil UV maksimum hari ini. Melempar bila jaringan gagal atau respons
 * tidak berisi angka — pemanggil yang memutuskan cara menampilkannya.
 */
export async function ambilUv(koordinat: Koordinat, signal?: AbortSignal): Promise<UvHarian> {
  const url =
    `${ENDPOINT}?latitude=${koordinat.lat}&longitude=${koordinat.lon}` +
    `&daily=uv_index_max&timezone=auto&forecast_days=1`;

  const res = await fetch(url, { signal });
  if (!res.ok) throw new Error(`Open-Meteo membalas ${res.status}`);

  const json: unknown = await res.json();
  const uv = bacaUvMax(json);
  if (uv == null) throw new Error('Respons Open-Meteo tidak berisi uv_index_max');

  return { uv: Math.round(uv * 10) / 10, perkiraan: koordinat.perkiraan };
}

/** Membaca daily.uv_index_max[0] secara defensif dari respons yang tidak dipercaya. */
export function bacaUvMax(json: unknown): number | null {
  if (typeof json !== 'object' || json === null) return null;
  const daily = (json as { daily?: unknown }).daily;
  if (typeof daily !== 'object' || daily === null) return null;
  const arr = (daily as { uv_index_max?: unknown }).uv_index_max;
  if (!Array.isArray(arr) || arr.length === 0) return null;
  const v = arr[0];
  return typeof v === 'number' && Number.isFinite(v) ? v : null;
}
