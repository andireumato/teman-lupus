import { hitungStreak, tanggalPanjang, tanggalPendek, todayISO } from './dates';

describe('todayISO', () => {
  it('memakai tanggal lokal, bukan UTC', () => {
    // 1 Januari 2026 pukul 06:00 waktu lokal tetap 2026-01-01,
    // meskipun di UTC bisa jadi masih 31 Desember.
    expect(todayISO(new Date(2026, 0, 1, 6, 0, 0))).toBe('2026-01-01');
  });

  it('memberi padding pada bulan & tanggal satu digit', () => {
    expect(todayISO(new Date(2026, 6, 5))).toBe('2026-07-05');
  });
});

describe('format tanggal', () => {
  it('tanggalPanjang menyertakan nama hari', () => {
    expect(tanggalPanjang('2026-07-26')).toBe('Minggu, 26 Juli 2026');
  });

  it('tanggalPendek memendekkan nama bulan', () => {
    expect(tanggalPendek('2026-07-26')).toBe('26 Jul 2026');
  });

  it('tanggalPendek menangani null', () => {
    expect(tanggalPendek(null)).toBe('—');
  });
});

describe('hitungStreak', () => {
  const hariIni = '2026-07-26';

  it('nol bila belum pernah check-in', () => {
    expect(hitungStreak([], hariIni)).toBe(0);
  });

  it('menghitung hari berturut-turut sampai hari ini', () => {
    expect(hitungStreak(['2026-07-26', '2026-07-25', '2026-07-24'], hariIni)).toBe(3);
  });

  it('masih berjalan bila hari ini belum diisi tetapi kemarin sudah', () => {
    expect(hitungStreak(['2026-07-25', '2026-07-24'], hariIni)).toBe(2);
  });

  it('putus bila ada hari bolong', () => {
    expect(hitungStreak(['2026-07-26', '2026-07-24', '2026-07-23'], hariIni)).toBe(1);
  });

  it('nol bila check-in terakhir dua hari lalu', () => {
    expect(hitungStreak(['2026-07-24', '2026-07-23'], hariIni)).toBe(0);
  });

  it('tahan terhadap duplikat dan urutan acak', () => {
    expect(hitungStreak(['2026-07-24', '2026-07-26', '2026-07-25', '2026-07-26'], hariIni)).toBe(3);
  });

  it('menyeberangi pergantian bulan', () => {
    expect(hitungStreak(['2026-08-01', '2026-07-31', '2026-07-30'], '2026-08-01')).toBe(3);
  });
});
