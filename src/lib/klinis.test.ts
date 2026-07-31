import { sistemDariOrgan, labelOrgan, ORGAN_TERLIBAT } from '@/constants/klinis';
import { SISTEM_GEJALA } from '@/constants/lupus';
import { lamaSakit, periksaTanggalDiagnosis, periksaTanggalLahir, usiaTahun } from '@/lib/klinis';

describe('lamaSakit', () => {
  it('menyebut tahun dan bulan', () => {
    expect(lamaSakit('2022-05-10', '2026-07-29')).toBe('4 tahun 2 bulan');
  });

  it('menghilangkan bagian yang nol', () => {
    expect(lamaSakit('2022-07-29', '2026-07-29')).toBe('4 tahun');
    expect(lamaSakit('2026-04-29', '2026-07-29')).toBe('3 bulan');
  });

  it('tidak membulatkan bulan yang belum genap', () => {
    // Sehari sebelum ulang tahun keempat masih 3 tahun 11 bulan, bukan 4 tahun.
    expect(lamaSakit('2022-07-30', '2026-07-29')).toBe('3 tahun 11 bulan');
  });

  it('menyebut rentang di bawah sebulan apa adanya', () => {
    expect(lamaSakit('2026-07-20', '2026-07-29')).toBe('kurang dari 1 bulan');
  });

  it('tidak terpengaruh tahun kabisat', () => {
    expect(lamaSakit('2024-02-29', '2026-02-28')).toBe('1 tahun 11 bulan');
    expect(lamaSakit('2024-02-29', '2026-03-01')).toBe('2 tahun');
  });

  it('mengembalikan null untuk masukan kosong, rusak, atau di masa depan', () => {
    expect(lamaSakit(null, '2026-07-29')).toBeNull();
    expect(lamaSakit('', '2026-07-29')).toBeNull();
    expect(lamaSakit('kemarin', '2026-07-29')).toBeNull();
    expect(lamaSakit('2027-01-01', '2026-07-29')).toBeNull();
  });
});

describe('usiaTahun', () => {
  it('menghitung tahun penuh', () => {
    expect(usiaTahun('1991-09-14', '2026-07-29')).toBe(34);
  });

  it('belum bertambah sehari sebelum ulang tahun', () => {
    // Inilah alasan usia dihitung dari komponen tanggal, bukan selisih hari
    // dibagi 365 — pembagian itu menaikkan usianya lebih awal.
    expect(usiaTahun('1991-09-14', '2026-09-13')).toBe(34);
    expect(usiaTahun('1991-09-14', '2026-09-14')).toBe(35);
  });

  it('bayi di bawah setahun bernilai 0, bukan null', () => {
    expect(usiaTahun('2026-01-10', '2026-07-29')).toBe(0);
  });

  it('null untuk kosong, rusak, atau tanggal lahir di masa depan', () => {
    expect(usiaTahun(null, '2026-07-29')).toBeNull();
    expect(usiaTahun('bukan tanggal', '2026-07-29')).toBeNull();
    expect(usiaTahun('2027-01-01', '2026-07-29')).toBeNull();
  });
});

describe('periksaTanggalLahir', () => {
  const HARI_INI = '2026-07-29';

  it('menyebut "Tanggal lahir" pada pesan galatnya, bukan "Tanggal diagnosis"', () => {
    const hasil = periksaTanggalLahir('2027-01-01', HARI_INI);
    expect(hasil.ok).toBe(false);
    if (!hasil.ok) expect(hasil.pesan).toBe('Tanggal lahir tidak boleh di masa depan.');
  });

  it('memakai pemeriksaan yang sama dengan tanggal diagnosis', () => {
    expect(periksaTanggalLahir('', HARI_INI)).toEqual({ ok: true, nilai: null });
    expect(periksaTanggalLahir('1991-02-30', HARI_INI).ok).toBe(false);
    expect(periksaTanggalLahir('1991-09-14', HARI_INI)).toEqual({
      ok: true,
      nilai: '1991-09-14',
    });
  });
});

describe('periksaTanggalDiagnosis', () => {
  const HARI_INI = '2026-07-29';

  it('menerima kosong sebagai jawaban sah', () => {
    expect(periksaTanggalDiagnosis('   ', HARI_INI)).toEqual({ ok: true, nilai: null });
  });

  it('menerima tanggal yang benar', () => {
    expect(periksaTanggalDiagnosis(' 2019-03-15 ', HARI_INI)).toEqual({
      ok: true,
      nilai: '2019-03-15',
    });
  });

  it('menolak format lain', () => {
    expect(periksaTanggalDiagnosis('15/03/2019', HARI_INI).ok).toBe(false);
    expect(periksaTanggalDiagnosis('2019-3-5', HARI_INI).ok).toBe(false);
  });

  it('menolak tanggal yang tidak ada di kalender', () => {
    // Tanpa pemeriksaan ini, JavaScript diam-diam menggeser ke 3 Maret.
    expect(periksaTanggalDiagnosis('2019-02-31', HARI_INI).ok).toBe(false);
    expect(periksaTanggalDiagnosis('2019-02-28', HARI_INI).ok).toBe(true);
  });

  it('menolak masa depan tetapi menerima hari ini', () => {
    expect(periksaTanggalDiagnosis('2026-07-30', HARI_INI).ok).toBe(false);
    expect(periksaTanggalDiagnosis(HARI_INI, HARI_INI).ok).toBe(true);
  });

  it('menolak tahun yang jelas salah ketik', () => {
    expect(periksaTanggalDiagnosis('0219-03-15', HARI_INI).ok).toBe(false);
  });
});

describe('pemetaan organ ke sistem gejala', () => {
  it('setiap padanan menunjuk sistem yang benar-benar ada di SISTEM_GEJALA', () => {
    // Kalau salah satu meleset, penandaan "sistem organ baru" di ringkasan
    // diam-diam berhenti bekerja untuk domain itu — tanpa galat apa pun.
    const sah = new Set(SISTEM_GEJALA.map((s) => s.system));
    for (const o of ORGAN_TERLIBAT) {
      if (o.sistem) expect(sah.has(o.sistem)).toBe(true);
    }
  });

  it('tidak ada kunci organ yang kembar', () => {
    const keys = ORGAN_TERLIBAT.map((o) => o.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('menerjemahkan kunci organ jadi kumpulan sistem gejala', () => {
    expect(sistemDariOrgan(['ginjal', 'mukokutan'])).toEqual(new Set(['ginjal', 'kulit']));
  });

  it('mengabaikan domain tanpa padanan gejala pasien', () => {
    expect(sistemDariOrgan(['oftalmik', 'antifosfolipid'])).toEqual(new Set());
    expect(sistemDariOrgan(null)).toEqual(new Set());
  });

  it('menampilkan kunci tak dikenal apa adanya, tidak membuangnya', () => {
    expect(labelOrgan('domain_lama_yang_sudah_dihapus')).toBe('domain_lama_yang_sudah_dihapus');
  });
});
