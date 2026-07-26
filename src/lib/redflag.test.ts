import { EMPTY_INPUT, evaluateRedFlags, type RedFlagInput } from './redflag';

const input = (over: Partial<RedFlagInput> = {}): RedFlagInput => ({ ...EMPTY_INPUT, ...over });

describe('red-flag engine — deterministik', () => {
  it('tidak mengeskalasi bila tidak ada keluhan', () => {
    const v = evaluateRedFlags(input());
    expect(v.level).toBe('aman');
    expect(v.hasil).toBe('green');
    expect(v.rules).toHaveLength(0);
  });

  it('memberi hasil identik untuk input identik', () => {
    const i = input({ kejang: true, urin_berbusa: true });
    expect(evaluateRedFlags(i)).toEqual(evaluateRedFlags(i));
  });

  describe('DARURAT', () => {
    it('nyeri dada + sesak napas → darurat', () => {
      const v = evaluateRedFlags(input({ nyeri_dada: true, sesak_napas: true }));
      expect(v.level).toBe('darurat');
      expect(v.hasil).toBe('red');
    });

    it('nyeri dada saja tidak memicu aturan kombinasi', () => {
      expect(evaluateRedFlags(input({ nyeri_dada: true })).level).toBe('aman');
    });

    it('sesak napas berat sendiri sudah cukup', () => {
      expect(evaluateRedFlags(input({ sesak_napas_berat: true })).level).toBe('darurat');
    });

    it.each([
      ['kejang', { kejang: true }],
      ['penurunan kesadaran', { bingung_atau_penurunan_kesadaran: true }],
      ['lemah satu sisi', { lemah_kebas_satu_sisi: true }],
      ['bicara pelo', { bicara_pelo: true }],
      ['gangguan penglihatan', { gangguan_penglihatan_mendadak: true }],
      ['perdarahan', { perdarahan_signifikan: true }],
      ['memar luas', { memar_luas_mendadak: true }],
    ])('%s → darurat', (_label, over) => {
      expect(evaluateRedFlags(input(over)).level).toBe('darurat');
    });

    it('demam tinggi + imunosupresan → darurat', () => {
      expect(evaluateRedFlags(input({ demam_tinggi: true, imunosupresan_aktif: true })).level).toBe(
        'darurat'
      );
    });

    it('demam tinggi tanpa imunosupresan turun ke mendesak, bukan aman', () => {
      const v = evaluateRedFlags(input({ demam_tinggi: true }));
      expect(v.level).toBe('mendesak');
      expect(v.hasil).toBe('yellow');
    });
  });

  describe('MENDESAK', () => {
    it('bengkak + urin berbusa → mendesak', () => {
      expect(
        evaluateRedFlags(input({ bengkak_kaki_atau_wajah_baru: true, urin_berbusa: true })).level
      ).toBe('mendesak');
    });

    it('bengkak + jumlah urin menurun → mendesak', () => {
      expect(
        evaluateRedFlags(input({ bengkak_kaki_atau_wajah_baru: true, jumlah_urin_menurun: true }))
          .level
      ).toBe('mendesak');
    });

    it('bengkak saja belum memicu aturan ginjal', () => {
      expect(evaluateRedFlags(input({ bengkak_kaki_atau_wajah_baru: true })).level).toBe('aman');
    });

    it.each([
      ['demam tanpa sebab', { demam_tanpa_sebab_jelas: true }],
      ['betis satu sisi', { nyeri_bengkak_betis_satu_sisi: true }],
      ['memburuk beruntun', { memburuk_beruntun: true }],
    ])('%s → mendesak', (_label, over) => {
      expect(evaluateRedFlags(input(over)).level).toBe('mendesak');
    });
  });

  describe('prioritas & fail-safe', () => {
    it('darurat menang atas mendesak bila keduanya terpicu', () => {
      const v = evaluateRedFlags(input({ kejang: true, nyeri_bengkak_betis_satu_sisi: true }));
      expect(v.level).toBe('darurat');
      expect(v.rules.some((r) => r.level === 'mendesak')).toBe(true);
    });

    it('semua aturan yang terpicu ikut tercatat untuk ringkasan dokter', () => {
      const v = evaluateRedFlags(
        input({ kejang: true, perdarahan_signifikan: true, memburuk_beruntun: true })
      );
      expect(v.rules.map((r) => r.id)).toEqual(
        expect.arrayContaining([
          'darurat.kejang',
          'darurat.perdarahan',
          'mendesak.perburukan_beruntun',
        ])
      );
    });

    it('hasil aman tidak pernah membawa aturan', () => {
      expect(evaluateRedFlags(input()).rules).toEqual([]);
    });

    it('pesan eskalasi selalu menyebut bahwa keputusan medis di tangan tenaga kesehatan', () => {
      for (const i of [
        input(),
        input({ kejang: true }),
        input({ demam_tanpa_sebab_jelas: true }),
      ]) {
        const v = evaluateRedFlags(i);
        expect(v.pesan.length).toBeGreaterThan(0);
      }
      expect(evaluateRedFlags(input({ kejang: true })).pesan).toContain('IGD');
      expect(evaluateRedFlags(input({ nyeri_bengkak_betis_satu_sisi: true })).pesan).toContain(
        '24 jam'
      );
    });
  });
});
