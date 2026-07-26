/** Tanggal lokal dalam format YYYY-MM-DD (kolom `date` di Postgres). */
export function todayISO(d: Date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Selisih hari antara dua tanggal YYYY-MM-DD (b − a). */
export function selisihHari(a: string, b: string): number {
  const ms = new Date(`${b}T00:00:00`).getTime() - new Date(`${a}T00:00:00`).getTime();
  return Math.round(ms / 86_400_000);
}

/** Tanggal YYYY-MM-DD, n hari sebelum `iso`. */
export function mundurHari(iso: string, n: number): string {
  const d = new Date(`${iso}T00:00:00`);
  d.setDate(d.getDate() - n);
  return todayISO(d);
}

/** Deret tanggal berurutan `dari` → `sampai`, inklusif di kedua ujung. */
export function deretHari(dari: string, sampai: string): string[] {
  const n = selisihHari(dari, sampai);
  if (n < 0) return [];
  return Array.from({ length: n + 1 }, (_, i) => mundurHari(sampai, n - i));
}

const BULAN = [
  'Januari',
  'Februari',
  'Maret',
  'April',
  'Mei',
  'Juni',
  'Juli',
  'Agustus',
  'September',
  'Oktober',
  'November',
  'Desember',
];

const HARI = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];

/** "Senin, 26 Juli 2026" */
export function tanggalPanjang(iso: string): string {
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  return `${HARI[d.getDay()]}, ${d.getDate()} ${BULAN[d.getMonth()]} ${d.getFullYear()}`;
}

/** "26 Jul 2026" */
export function tanggalPendek(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso.length > 10 ? iso : `${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  return `${d.getDate()} ${BULAN[d.getMonth()].slice(0, 3)} ${d.getFullYear()}`;
}

/**
 * Jumlah hari check-in berturut-turut sampai hari ini (streak).
 * `tanggalList` berisi tanggal YYYY-MM-DD, boleh tidak urut dan boleh duplikat.
 */
export function hitungStreak(tanggalList: string[], hariIni: string = todayISO()): number {
  const set = new Set(tanggalList);
  let streak = 0;
  const cursor = new Date(`${hariIni}T00:00:00`);

  // Streak boleh dimulai kemarin bila hari ini belum mengisi.
  if (!set.has(todayISO(cursor))) {
    cursor.setDate(cursor.getDate() - 1);
    if (!set.has(todayISO(cursor))) return 0;
  }

  while (set.has(todayISO(cursor))) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}
