import {
  awalHari,
  bacaTanggal,
  hariISO,
  hariISOKeExpo,
  jatuhPada,
  jumlahHariMinum,
  labelPola,
  polaObat,
  selisihHari,
  tanggalMinumBerikutnya,
} from '@/lib/pola-minum';
import type { Medication } from '@/types/database';

function obat(p: Partial<Medication> = {}): Medication {
  return {
    id: 'm1',
    patient_id: 'p1',
    nama_obat: 'Obat',
    dosis: null,
    jadwal: null,
    frekuensi: 1,
    jam: ['08:00'],
    pola: 'harian',
    hari_minggu: null,
    selang_hari: null,
    mulai_tanggal: null,
    aktif: true,
    created_at: '2026-08-01T00:00:00Z',
    ...p,
  };
}

/** Bulan berbasis 0 seperti Date. 3 Agustus 2026 adalah hari Senin. */
const tgl = (y: number, m: number, d: number) => new Date(y, m - 1, d);

describe('penomoran hari', () => {
  it('memakai ISO: Senin=1 sampai Minggu=7', () => {
    expect(hariISO(tgl(2026, 8, 3))).toBe(1); // Senin
    expect(hariISO(tgl(2026, 8, 4))).toBe(2);
    expect(hariISO(tgl(2026, 8, 8))).toBe(6); // Sabtu
    expect(hariISO(tgl(2026, 8, 9))).toBe(7); // Minggu
  });

  it('menerjemahkan ke penomoran expo yang dimulai dari Minggu', () => {
    expect(hariISOKeExpo(1)).toBe(2); // Senin
    expect(hariISOKeExpo(6)).toBe(7); // Sabtu
    expect(hariISOKeExpo(7)).toBe(1); // Minggu
  });
});

describe('selisihHari', () => {
  it('menghitung hari kalender, bukan selisih 24 jam', () => {
    // Beda 30 menit tetapi menyeberangi tengah malam: satu hari, bukan nol.
    const a = new Date(2026, 7, 3, 23, 45);
    const b = new Date(2026, 7, 4, 0, 15);
    expect(selisihHari(a, b)).toBe(1);
  });

  it('bernilai negatif bila mundur, dan nol pada hari yang sama', () => {
    expect(selisihHari(tgl(2026, 8, 10), tgl(2026, 8, 3))).toBe(-7);
    expect(selisihHari(new Date(2026, 7, 3, 1), new Date(2026, 7, 3, 23))).toBe(0);
  });

  it('benar melintasi pergantian bulan dan tahun', () => {
    expect(selisihHari(tgl(2026, 1, 31), tgl(2026, 2, 1))).toBe(1);
    expect(selisihHari(tgl(2026, 12, 31), tgl(2027, 1, 1))).toBe(1);
  });
});

describe('bacaTanggal', () => {
  it('menolak tanggal yang tidak ada', () => {
    expect(bacaTanggal('2026-02-30')).toBeNull();
    expect(bacaTanggal('2026-13-01')).toBeNull();
    expect(bacaTanggal('')).toBeNull();
    expect(bacaTanggal(null)).toBeNull();
  });

  it('membaca tanggal sah sebagai tengah malam setempat', () => {
    const d = bacaTanggal('2026-08-03');
    expect(d).toEqual(awalHari(tgl(2026, 8, 3)));
  });
});

describe('jatuhPada — harian', () => {
  it('jatuh setiap hari', () => {
    const m = obat();
    expect(jatuhPada(m, tgl(2026, 8, 3))).toBe(true);
    expect(jatuhPada(m, tgl(2026, 8, 4))).toBe(true);
  });

  it('tidak pernah jatuh untuk obat yang dihentikan', () => {
    expect(jatuhPada(obat({ aktif: false }), tgl(2026, 8, 3))).toBe(false);
  });
});

describe('jatuhPada — mingguan', () => {
  const mtx = obat({ pola: 'mingguan', hari_minggu: [1] }); // Senin

  it('hanya jatuh pada hari yang dipilih', () => {
    expect(jatuhPada(mtx, tgl(2026, 8, 3))).toBe(true); // Senin
    expect(jatuhPada(mtx, tgl(2026, 8, 4))).toBe(false);
    expect(jatuhPada(mtx, tgl(2026, 8, 10))).toBe(true); // Senin berikutnya
  });

  it('mendukung beberapa hari dalam seminggu', () => {
    const m = obat({ pola: 'mingguan', hari_minggu: [1, 4] }); // Senin & Kamis
    expect(jatuhPada(m, tgl(2026, 8, 3))).toBe(true);
    expect(jatuhPada(m, tgl(2026, 8, 6))).toBe(true);
    expect(jatuhPada(m, tgl(2026, 8, 5))).toBe(false);
  });

  it('hari Minggu tidak tertukar dengan Senin', () => {
    const m = obat({ pola: 'mingguan', hari_minggu: [7] });
    expect(jatuhPada(m, tgl(2026, 8, 9))).toBe(true); // Minggu
    expect(jatuhPada(m, tgl(2026, 8, 3))).toBe(false); // Senin
  });

  it('tidak jatuh sama sekali bila harinya belum dipilih', () => {
    // Sengaja BUKAN jatuh kembali ke harian: metotreksat tujuh kali seminggu
    // adalah bahaya nyata.
    const m = obat({ pola: 'mingguan', hari_minggu: [] });
    expect(jatuhPada(m, tgl(2026, 8, 3))).toBe(false);
    expect(jatuhPada(obat({ pola: 'mingguan', hari_minggu: null }), tgl(2026, 8, 3))).toBe(false);
  });
});

describe('jatuhPada — selang', () => {
  const selangSehari = obat({
    pola: 'selang',
    selang_hari: 2,
    mulai_tanggal: '2026-08-03',
  });

  it('jatuh pada tanggal mulai lalu setiap dua hari', () => {
    expect(jatuhPada(selangSehari, tgl(2026, 8, 3))).toBe(true);
    expect(jatuhPada(selangSehari, tgl(2026, 8, 4))).toBe(false);
    expect(jatuhPada(selangSehari, tgl(2026, 8, 5))).toBe(true);
    expect(jatuhPada(selangSehari, tgl(2026, 8, 7))).toBe(true);
  });

  it('bergeser melintasi hari dalam seminggu — inilah yang tidak bisa ditiru pola mingguan', () => {
    // Mulai Senin: Sen, Rab, Jum, Min, Sel, ...
    expect(hariISO(tgl(2026, 8, 3))).toBe(1);
    expect(jatuhPada(selangSehari, tgl(2026, 8, 9))).toBe(true); // Minggu
    expect(jatuhPada(selangSehari, tgl(2026, 8, 11))).toBe(true); // Selasa
  });

  it('tidak jatuh sebelum tanggal mulai', () => {
    // Modulo bilangan negatif di JavaScript ikut negatif; tanpa penjagaan
    // eksplisit, 1 Agustus akan terbaca sebagai hari minum.
    expect(selisihHari(tgl(2026, 8, 3), tgl(2026, 8, 1)) % 2).toBe(-0);
    expect(jatuhPada(selangSehari, tgl(2026, 8, 1))).toBe(false);
    expect(jatuhPada(selangSehari, tgl(2026, 8, 2))).toBe(false);
  });

  it('menolak selang di luar batas dan tanggal mulai yang hilang', () => {
    expect(
      jatuhPada(
        obat({ pola: 'selang', selang_hari: 1, mulai_tanggal: '2026-08-03' }),
        tgl(2026, 8, 3)
      )
    ).toBe(false);
    expect(
      jatuhPada(
        obat({ pola: 'selang', selang_hari: 99, mulai_tanggal: '2026-08-03' }),
        tgl(2026, 8, 3)
      )
    ).toBe(false);
    expect(
      jatuhPada(obat({ pola: 'selang', selang_hari: 2, mulai_tanggal: null }), tgl(2026, 8, 3))
    ).toBe(false);
  });

  it('tetap benar melintasi pergantian bulan', () => {
    const m = obat({ pola: 'selang', selang_hari: 3, mulai_tanggal: '2026-08-30' });
    expect(jatuhPada(m, tgl(2026, 8, 30))).toBe(true);
    expect(jatuhPada(m, tgl(2026, 9, 2))).toBe(true);
    expect(jatuhPada(m, tgl(2026, 9, 1))).toBe(false);
  });
});

describe('tanggalMinumBerikutnya', () => {
  it('mengembalikan hari ini bila hari ini memang hari minum', () => {
    const m = obat({ pola: 'mingguan', hari_minggu: [1] });
    expect(tanggalMinumBerikutnya(m, tgl(2026, 8, 3))).toEqual(tgl(2026, 8, 3));
  });

  it('melompat ke hari minum berikutnya', () => {
    const m = obat({ pola: 'mingguan', hari_minggu: [1] });
    expect(tanggalMinumBerikutnya(m, tgl(2026, 8, 4))).toEqual(tgl(2026, 8, 10));
  });

  it('null untuk obat yang dihentikan atau datanya rusak', () => {
    expect(tanggalMinumBerikutnya(obat({ aktif: false }), tgl(2026, 8, 3))).toBeNull();
    expect(
      tanggalMinumBerikutnya(obat({ pola: 'mingguan', hari_minggu: [] }), tgl(2026, 8, 3))
    ).toBeNull();
  });
});

describe('jumlahHariMinum — penyebut kepatuhan', () => {
  it('obat harian: satu per hari', () => {
    expect(jumlahHariMinum(obat(), tgl(2026, 8, 1), tgl(2026, 8, 30))).toBe(30);
  });

  it('metotreksat mingguan: 4 dalam 30 hari, bukan 30', () => {
    // Inilah kesalahan yang membuat kepatuhan pasien terlihat runtuh.
    const m = obat({ pola: 'mingguan', hari_minggu: [1] });
    expect(jumlahHariMinum(m, tgl(2026, 8, 1), tgl(2026, 8, 30))).toBe(4);
  });

  it('selang sehari: separuh dari jumlah hari', () => {
    const m = obat({ pola: 'selang', selang_hari: 2, mulai_tanggal: '2026-08-01' });
    expect(jumlahHariMinum(m, tgl(2026, 8, 1), tgl(2026, 8, 30))).toBe(15);
  });

  it('inklusif di kedua ujung, dan nol bila rentangnya terbalik', () => {
    expect(jumlahHariMinum(obat(), tgl(2026, 8, 3), tgl(2026, 8, 3))).toBe(1);
    expect(jumlahHariMinum(obat(), tgl(2026, 8, 10), tgl(2026, 8, 3))).toBe(0);
  });

  it('obat yang dihentikan tidak menyumbang dosis terjadwal', () => {
    expect(jumlahHariMinum(obat({ aktif: false }), tgl(2026, 8, 1), tgl(2026, 8, 30))).toBe(0);
  });
});

describe('polaObat', () => {
  it('menganggap nilai asing sebagai harian', () => {
    expect(polaObat(obat({ pola: 'entah' as never }))).toBe('harian');
    expect(polaObat(obat({ pola: null as never }))).toBe('harian');
  });
});

describe('labelPola', () => {
  it('menyebut pola dengan bahasa yang dipakai pasien', () => {
    expect(labelPola(obat())).toBe('setiap hari');
    expect(labelPola(obat({ frekuensi: 2 }))).toBe('2x sehari');
    expect(labelPola(obat({ pola: 'mingguan', hari_minggu: [1] }))).toBe('tiap Senin');
    expect(labelPola(obat({ pola: 'mingguan', hari_minggu: [4, 1] }))).toBe('tiap Senin, Kamis');
    expect(labelPola(obat({ pola: 'selang', selang_hari: 2 }))).toBe('selang sehari');
    expect(labelPola(obat({ pola: 'selang', selang_hari: 3 }))).toBe('tiap 3 hari');
  });

  it('mengatakan terus terang bila pengaturannya belum lengkap', () => {
    expect(labelPola(obat({ pola: 'mingguan', hari_minggu: [] }))).toBe(
      'mingguan, hari belum dipilih'
    );
    expect(labelPola(obat({ pola: 'selang', selang_hari: null }))).toBe('selang hari belum diatur');
  });
});
