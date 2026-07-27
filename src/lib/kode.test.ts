import { ABJAD_KODE, buatKode, formatKode, kodeValid, normalkanKode, PANJANG_KODE } from './kode';

describe('abjad kode', () => {
  it('tidak memuat karakter yang mudah tertukar', () => {
    // 0/O, 1/I/L, 5/S, 8/B — pasangan yang paling sering salah salin.
    for (const c of ['0', 'O', '1', 'I', 'L', '5', 'S', '8', 'B']) {
      expect(ABJAD_KODE).not.toContain(c);
    }
  });

  it('tidak ada karakter kembar', () => {
    expect(new Set(ABJAD_KODE).size).toBe(ABJAD_KODE.length);
  });
});

describe('normalkanKode', () => {
  it.each([
    ['ra4-k7p', 'RA4K7P'],
    ['RA4 K7P', 'RA4K7P'],
    ['  ra4k7p  ', 'RA4K7P'],
    ['RA4K7P', 'RA4K7P'],
  ])('%s → %s', (masukan, harapan) => {
    expect(normalkanKode(masukan)).toBe(harapan);
  });
});

describe('formatKode', () => {
  it('memberi tanda hubung di tengah agar mudah dibacakan', () => {
    expect(formatKode('RA4K7P')).toBe('RA4-K7P');
    expect(formatKode('ra4k7p')).toBe('RA4-K7P');
  });

  it('kode dengan panjang tidak wajar dibiarkan apa adanya', () => {
    expect(formatKode('AB')).toBe('AB');
  });
});

describe('kodeValid', () => {
  it('menerima kode yang benar dalam berbagai penulisan', () => {
    expect(kodeValid('RA4K7P')).toBe(true);
    expect(kodeValid('ra4-k7p')).toBe(true);
  });

  it('menolak panjang yang salah', () => {
    expect(kodeValid('RA4K7')).toBe(false);
    expect(kodeValid('RA4K7PQ')).toBe(false);
  });

  it('menolak karakter di luar abjad', () => {
    // Huruf O dan angka 0 sengaja tidak dipakai.
    expect(kodeValid('RA4K7O')).toBe(false);
    expect(kodeValid('RA4K70')).toBe(false);
  });
});

describe('buatKode', () => {
  it('panjangnya tetap dan hanya memakai abjad yang diizinkan', () => {
    for (let i = 0; i < 200; i++) {
      const k = buatKode();
      expect(k).toHaveLength(PANJANG_KODE);
      expect(kodeValid(k)).toBe(true);
    }
  });

  it('memakai sumber acak yang diberikan', () => {
    // Selalu 0 → selalu karakter pertama abjad.
    expect(buatKode(() => 0)).toBe(ABJAD_KODE[0].repeat(PANJANG_KODE));
  });

  it('nilai acak mendekati 1 tidak keluar dari abjad', () => {
    expect(buatKode(() => 0.999999)).toBe(ABJAD_KODE[ABJAD_KODE.length - 1].repeat(PANJANG_KODE));
  });
});
