import { QUOTES, TIPS } from '@/constants/edukasi';

import {
  hariKe,
  insightText,
  quoteHariIni,
  salamWaktu,
  streakInfo,
  tepatMilestone,
  tipHariIni,
  type CheckinRingkas,
} from './beranda';

describe('salamWaktu', () => {
  it.each([
    [0, 'Selamat pagi'],
    [10, 'Selamat pagi'],
    [11, 'Selamat siang'],
    [14, 'Selamat siang'],
    [15, 'Selamat sore'],
    [17, 'Selamat sore'],
    [18, 'Selamat malam'],
    [23, 'Selamat malam'],
  ])('jam %i → %s', (jam, expected) => {
    expect(salamWaktu(jam)).toBe(expected);
  });
});

describe('konten harian', () => {
  it('hariKe memakai tanggal lokal, bukan UTC', () => {
    // Pukul 01:00 WIB masih 1 Januari meskipun di UTC sudah/masih 31 Desember.
    expect(hariKe(new Date(2026, 0, 1, 1, 0))).toBe(1);
    expect(hariKe(new Date(2026, 0, 1, 23, 0))).toBe(1);
  });

  it('konten sama sepanjang hari yang sama', () => {
    const pagi = new Date(2026, 6, 26, 7, 0);
    const malam = new Date(2026, 6, 26, 22, 0);
    expect(quoteHariIni(pagi)).toBe(quoteHariIni(malam));
    expect(tipHariIni(pagi)).toBe(tipHariIni(malam));
  });

  it('konten berganti saat hari berganti', () => {
    const a = new Date(2026, 6, 26, 9, 0);
    const b = new Date(2026, 6, 27, 9, 0);
    expect(quoteHariIni(a)).not.toBe(quoteHariIni(b));
    expect(tipHariIni(a)).not.toBe(tipHariIni(b));
  });

  it('selalu mengembalikan konten yang ada di daftar', () => {
    for (let hari = 0; hari < 400; hari++) {
      const d = new Date(2026, 0, 1 + hari);
      expect(QUOTES).toContain(quoteHariIni(d));
      expect(TIPS).toContain(tipHariIni(d));
    }
  });
});

describe('streakInfo', () => {
  it('belum ada tingkatan sebelum 3 hari', () => {
    expect(streakInfo(0).earned).toBeNull();
    expect(streakInfo(2).earned).toBeNull();
    expect(streakInfo(2).next?.n).toBe(3);
  });

  it('mengambil tingkatan tertinggi yang tercapai', () => {
    expect(streakInfo(3).earned?.n).toBe(3);
    expect(streakInfo(6).earned?.n).toBe(3);
    expect(streakInfo(7).earned?.n).toBe(7);
    expect(streakInfo(45).earned?.n).toBe(30);
  });

  it('menunjuk tingkatan berikutnya', () => {
    expect(streakInfo(7).next?.n).toBe(14);
    expect(streakInfo(60).next?.n).toBe(100);
  });

  it('tidak ada tingkatan berikutnya setelah yang terakhir', () => {
    expect(streakInfo(100).next).toBeNull();
    expect(streakInfo(365).earned?.n).toBe(100);
    expect(streakInfo(365).next).toBeNull();
  });

  it('tepatMilestone hanya pada angka persis', () => {
    expect(tepatMilestone(7)?.label).toBe('7 hari');
    expect(tepatMilestone(8)).toBeNull();
  });
});

describe('insightText', () => {
  const c = (tanggal: string, mood: number | null, nyeri: number | null): CheckinRingkas => ({
    tanggal,
    mood,
    nyeri_sendi: nyeri,
  });

  it('null bila belum ada data', () => {
    expect(insightText([])).toBeNull();
  });

  it('menyambut pasien yang baru mengisi sekali', () => {
    expect(insightText([c('2026-07-20', 3, 1)])?.nada).toBe('baik');
  });

  it('nyeri naik 3 hari berturut → perhatian, dan mengarahkan ke Cek Flare', () => {
    const r = insightText([
      c('2026-07-20', 3, 0),
      c('2026-07-21', 3, 1),
      c('2026-07-22', 3, 2),
      c('2026-07-23', 3, 3),
    ]);
    expect(r?.nada).toBe('perhatian');
    expect(r?.teks).toContain('Cek Flare');
  });

  // painRise menghitung jumlah HARI yang terlibat, jadi ambang 3 tercapai
  // setelah 2 kenaikan berturut-turut (= 3 hari data). Dua hari data belum cukup.
  it('nyeri naik hanya 2 hari belum memicu peringatan', () => {
    const r = insightText([c('2026-07-22', 3, 0), c('2026-07-23', 3, 1)]);
    expect(r?.teks).not.toContain('Cek Flare');
  });

  it('3 hari data dengan nyeri terus naik sudah memicu peringatan', () => {
    const r = insightText([c('2026-07-21', 3, 0), c('2026-07-22', 3, 1), c('2026-07-23', 3, 2)]);
    expect(r?.teks).toContain('Cek Flare');
  });

  it('mood naik 3 hari berturut → baik', () => {
    const r = insightText([
      c('2026-07-20', 1, 0),
      c('2026-07-21', 2, 0),
      c('2026-07-22', 3, 0),
      c('2026-07-23', 4, 0),
    ]);
    expect(r?.nada).toBe('baik');
    expect(r?.teks).toContain('membaik');
  });

  it('nyeri diprioritaskan di atas mood ketika keduanya terpicu', () => {
    const r = insightText([
      c('2026-07-20', 1, 0),
      c('2026-07-21', 2, 1),
      c('2026-07-22', 3, 2),
      c('2026-07-23', 4, 3),
    ]);
    expect(r?.nada).toBe('perhatian');
  });

  it('membandingkan rata-rata mood minggu ini dengan minggu lalu', () => {
    const hari = (i: number) => `2026-07-${String(10 + i).padStart(2, '0')}`;
    // Minggu lalu mood 2, minggu ini mood 4 — tanpa tren naik beruntun.
    const rows = [
      ...[2, 2, 2, 2, 2, 2, 2].map((m, i) => c(hari(i), m, 0)),
      ...[4, 3, 4, 3, 4, 3, 4].map((m, i) => c(hari(7 + i), m, 0)),
    ];
    const r = insightText(rows);
    expect(r?.nada).toBe('baik');
    expect(r?.teks).toContain('minggu lalu');
  });

  it('nyeri tinggi hari ini tetap disorot', () => {
    const r = insightText([c('2026-07-22', 3, 0), c('2026-07-23', 3, 3)]);
    expect(r?.nada).toBe('perhatian');
    expect(r?.teks).toContain('Nyeri sendimu cukup tinggi');
  });

  it('duplikat tanggal dirapikan — entri terakhir yang dipakai', () => {
    const r = insightText([
      c('2026-07-22', 3, 0),
      c('2026-07-23', 3, 0),
      c('2026-07-23', 3, 3), // pembaruan check-in hari yang sama
    ]);
    expect(r?.teks).toContain('Nyeri sendimu cukup tinggi');
  });

  it('tahan terhadap urutan masukan yang acak', () => {
    const urut = [c('2026-07-22', 3, 0), c('2026-07-23', 3, 3)];
    const acak = [c('2026-07-23', 3, 3), c('2026-07-22', 3, 0)];
    expect(insightText(acak)).toEqual(insightText(urut));
  });

  it('tidak pernah mengklaim diagnosis atau menyuruh mengubah obat', () => {
    const semua = [
      insightText([c('2026-07-23', 3, 1)]),
      insightText([c('2026-07-22', 3, 0), c('2026-07-23', 3, 3)]),
      insightText([c('2026-07-21', 1, 0), c('2026-07-22', 2, 0), c('2026-07-23', 3, 0)]),
    ];
    for (const r of semua) {
      expect(r!.teks).not.toMatch(/flare aktif|kambuh|diagnos|dosis|tambah obat|hentikan obat/i);
    }
  });
});
