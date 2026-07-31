import {
  barisTindakLanjut,
  jamRespons,
  kondisiTerkunci,
  labelJeda,
  periksaTindakLanjut,
  sesuaikanKondisi,
} from './tindak-lanjut';

describe('kunci "tidak bisa dihubungi"', () => {
  it('mengunci sumbu kondisi', () => {
    expect(kondisiTerkunci('tak_terhubung')).toBe(true);
    expect(kondisiTerkunci('obat_disesuaikan')).toBe(false);
    expect(kondisiTerkunci(null)).toBe(false);
  });

  it('memaksa kondisi jadi tidak diketahui', () => {
    expect(sesuaikanKondisi('tak_terhubung', 'masih_bergejala')).toBe('tidak_diketahui');
    expect(sesuaikanKondisi('tak_terhubung', null)).toBe('tidak_diketahui');
  });

  it('tidak mengutak-atik tindakan lain', () => {
    expect(sesuaikanKondisi('dirujuk', 'dirawat_inap')).toBe('dirawat_inap');
    expect(sesuaikanKondisi('dirujuk', null)).toBeNull();
  });
});

describe('periksaTindakLanjut', () => {
  it('menolak isian kosong dengan pesan yang menunjuk sumbu yang mana', () => {
    expect(periksaTindakLanjut(null, 'masih_bergejala')).toEqual({
      ok: false,
      pesan: 'Pilih dulu apa yang Anda lakukan.',
    });
    expect(periksaTindakLanjut('edukasi', null)).toEqual({
      ok: false,
      pesan: 'Pilih dulu kondisi pasien saat dihubungi.',
    });
  });

  it('menolak kombinasi yang mustahil', () => {
    // Cerminan CHECK constraint `tak_terhubung_berarti_tak_diketahui`.
    const h = periksaTindakLanjut('tak_terhubung', 'membaik_sendiri');
    expect(h.ok).toBe(false);
  });

  it('meloloskan kombinasi yang sah', () => {
    expect(periksaTindakLanjut('tak_terhubung', 'tidak_diketahui')).toEqual({ ok: true });
    expect(periksaTindakLanjut('obat_disesuaikan', 'masih_bergejala')).toEqual({ ok: true });
  });
});

describe('jamRespons', () => {
  it('menghitung selisih jam', () => {
    expect(jamRespons('2026-07-30T08:00:00Z', '2026-07-30T12:00:00Z')).toBe(4);
    expect(jamRespons('2026-07-30T08:00:00Z', '2026-07-30T08:30:00Z')).toBe(0.5);
  });

  it('null bila waktunya kosong atau rusak', () => {
    expect(jamRespons(null, '2026-07-30T12:00:00Z')).toBeNull();
    expect(jamRespons('2026-07-30T08:00:00Z', undefined)).toBeNull();
    expect(jamRespons('bukan tanggal', '2026-07-30T12:00:00Z')).toBeNull();
  });

  it('null bila tindak lanjut mendahului peringatannya', () => {
    // Jam ponsel yang meleset akan menghasilkan angka negatif yang tampak
    // seperti respons luar biasa cepat.
    expect(jamRespons('2026-07-30T12:00:00Z', '2026-07-30T08:00:00Z')).toBeNull();
  });

  it('nol tetap nol, bukan null', () => {
    expect(jamRespons('2026-07-30T08:00:00Z', '2026-07-30T08:00:00Z')).toBe(0);
  });
});

describe('labelJeda', () => {
  it('membulatkan ke bawah, tidak pernah mengklaim waktu yang belum lewat', () => {
    expect(labelJeda(0.9)).toBe('<1 jam');
    expect(labelJeda(1)).toBe('1 jam');
    expect(labelJeda(2.83)).toBe('2 jam');
    expect(labelJeda(47.9)).toBe('47 jam');
    expect(labelJeda(48)).toBe('2 hari');
    expect(labelJeda(95)).toBe('3 hari');
  });

  it('null diteruskan', () => {
    expect(labelJeda(null)).toBeNull();
  });
});

describe('barisTindakLanjut', () => {
  it('null bila belum ada tindak lanjut', () => {
    expect(barisTindakLanjut(null)).toBeNull();
  });

  it('menyusun jeda, kondisi, lalu tindakan', () => {
    expect(
      barisTindakLanjut({
        waktu: '2026-07-30T12:00:00Z',
        jam: 4,
        tindakan: 'obat_disesuaikan',
        kondisi: 'masih_bergejala',
      })
    ).toBe('4 jam: masih bergejala, obat disesuaikan');
  });

  it('tanpa jeda saat jamnya tidak diketahui', () => {
    expect(
      barisTindakLanjut({
        waktu: '2026-07-30T12:00:00Z',
        jam: null,
        tindakan: 'dirujuk',
        kondisi: 'dirawat_inap',
      })
    ).toBe('sedang dirawat inap, dirujuk IGD / rawat inap');
  });

  it('kode tak dikenal tetap tampil, tidak jadi kosong', () => {
    // Baris dari versi aplikasi yang lebih baru harus tetap terbaca.
    expect(
      barisTindakLanjut({ waktu: 'x', jam: 1, tindakan: 'entah_apa', kondisi: 'entah_bagaimana' })
    ).toBe('1 jam: entah_bagaimana, entah_apa');
  });

  it('tidak pernah membocorkan catatan dokter', () => {
    // Ringkasan disalin dan dibagikan; catatan pribadi dokter tidak ikut.
    // Tipenya memang tidak punya medan catatan — test ini menjaga agar tidak
    // ada yang menambahkannya tanpa sengaja.
    const baris = barisTindakLanjut({
      waktu: '2026-07-30T12:00:00Z',
      jam: 2,
      tindakan: 'edukasi',
      kondisi: 'membaik_sendiri',
    });
    expect(baris).toBe('2 jam: sudah membaik sendiri, cukup edukasi / observasi');
  });
});
