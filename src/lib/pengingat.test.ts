import {
  bacaJam,
  JAM_BAWAAN,
  MAKS_DOSIS,
  pengingatBerikutnya,
  rencanaPengingat,
  sesuaikanJam,
  tulisJam,
} from '@/lib/pengingat';
import type { Medication } from '@/types/database';

let seq = 0;
function med(p: Partial<Medication> = {}): Medication {
  return {
    id: `m-${++seq}`,
    patient_id: 'p1',
    nama_obat: 'Hidroksiklorokuin',
    dosis: null,
    jadwal: null,
    frekuensi: 1,
    jam: null,
    aktif: true,
    created_at: '2026-01-01T00:00:00+07:00',
    ...p,
  };
}

describe('bacaJam & tulisJam', () => {
  it('menerima HH:MM 24 jam', () => {
    expect(bacaJam('08:00')).toEqual({ hour: 8, minute: 0 });
    expect(bacaJam('23:59')).toEqual({ hour: 23, minute: 59 });
    expect(bacaJam(' 00:00 ')).toEqual({ hour: 0, minute: 0 });
  });

  it('menolak jam yang tidak ada', () => {
    expect(bacaJam('24:00')).toBeNull();
    expect(bacaJam('08:60')).toBeNull();
    expect(bacaJam('8:00')).toBeNull();
    expect(bacaJam('pagi')).toBeNull();
    expect(bacaJam(null)).toBeNull();
  });

  it('bolak-balik tanpa berubah', () => {
    expect(tulisJam(bacaJam('07:05')!)).toBe('07:05');
  });
});

describe('JAM_BAWAAN', () => {
  it('panjangnya sama dengan frekuensinya', () => {
    for (let n = 1; n <= MAKS_DOSIS; n++) {
      expect(JAM_BAWAAN[n]).toHaveLength(n);
    }
  });

  it('semuanya jam yang sah dan urut naik', () => {
    for (let n = 1; n <= MAKS_DOSIS; n++) {
      const menit = JAM_BAWAAN[n].map((j) => {
        const p = bacaJam(j);
        expect(p).not.toBeNull();
        return p!.hour * 60 + p!.minute;
      });
      expect([...menit].sort((a, b) => a - b)).toEqual(menit);
    }
  });

  it('tidak ada bawaan yang jatuh di jam tidur', () => {
    // Pengingat pukul 02.00 hanya akan dimatikan pasien — dan sekali saklarnya
    // dimatikan, SELURUH pengingatnya ikut hilang, termasuk yang berguna.
    for (let n = 1; n <= MAKS_DOSIS; n++) {
      for (const j of JAM_BAWAAN[n]) {
        expect(bacaJam(j)!.hour).toBeGreaterThanOrEqual(6);
      }
    }
  });
});

describe('sesuaikanJam', () => {
  it('mengisi dari bawaan bila belum pernah diatur', () => {
    expect(sesuaikanJam(null, 2)).toEqual(['08:00', '20:00']);
  });

  it('mempertahankan jam yang sudah dipilih pasien saat frekuensi naik', () => {
    // Tanpa ini, mengubah 2x → 3x menghapus jam yang sudah disetel dengan susah payah.
    expect(sesuaikanJam(['06:30', '18:30'], 3)).toEqual(['06:30', '18:30', '20:00']);
  });

  it('memotong dari belakang saat frekuensi turun', () => {
    expect(sesuaikanJam(['06:30', '12:00', '18:30'], 2)).toEqual(['06:30', '12:00']);
  });

  it('membuang jam rusak lalu menambalnya', () => {
    expect(sesuaikanJam(['pagi', '19:00'], 2)).toEqual(['19:00', '20:00']);
  });

  it('menjaga frekuensi di luar batas tetap masuk akal', () => {
    expect(sesuaikanJam(null, 0)).toHaveLength(1);
    expect(sesuaikanJam(null, 99)).toHaveLength(MAKS_DOSIS);
  });
});

describe('rencanaPengingat', () => {
  it('satu pengingat per dosis, urut menurut jam', () => {
    const r = rencanaPengingat([
      med({ nama_obat: 'Metilprednisolon', frekuensi: 1, jam: ['08:00'] }),
      med({ nama_obat: 'Mikofenolat', frekuensi: 2, jam: ['07:00', '19:00'] }),
    ]);
    expect(r.map((p) => `${tulisJam(p)} ${p.judul}`)).toEqual([
      '07:00 Waktunya Mikofenolat',
      '08:00 Waktunya Metilprednisolon',
      '19:00 Waktunya Mikofenolat',
    ]);
  });

  it('OBAT YANG DIHENTIKAN TIDAK PERNAH MENGINGATKAN', () => {
    // Aturan keselamatan, bukan kerapian: pengingat yang terus berbunyi untuk
    // obat yang baru dihentikan dokter adalah dorongan melanggar instruksi.
    const r = rencanaPengingat([
      med({ nama_obat: 'Siklofosfamid', aktif: false, frekuensi: 2, jam: ['08:00', '20:00'] }),
    ]);
    expect(r).toEqual([]);
  });

  it('jam yang kosong atau rusak dilewati, tidak diganti tebakan', () => {
    // Pengingat pada jam yang tidak pernah dipilih pasien lebih buruk daripada
    // tidak ada pengingat sama sekali.
    const r = rencanaPengingat([med({ frekuensi: 3, jam: ['08:00', 'entah', ''] })]);
    expect(r).toHaveLength(1);
    expect(r[0].slot).toBe(0);
  });

  it('obat tanpa jam sama sekali tidak menghasilkan pengingat', () => {
    expect(rencanaPengingat([med({ frekuensi: 2, jam: null })])).toEqual([]);
  });

  it('jam berlebih di luar frekuensi diabaikan', () => {
    const r = rencanaPengingat([med({ frekuensi: 1, jam: ['08:00', '20:00'] })]);
    expect(r).toHaveLength(1);
  });

  it('kuncinya unik per dosis, supaya penjadwalan ulang tidak bertumpuk', () => {
    const r = rencanaPengingat([
      med({ frekuensi: 2, jam: ['08:00', '20:00'] }),
      med({ frekuensi: 2, jam: ['08:00', '20:00'] }),
    ]);
    expect(new Set(r.map((p) => p.kunci)).size).toBe(4);
  });

  it('dua obat bernama sama tetap dibedakan oleh id', () => {
    const a = med({ nama_obat: 'Kalsium', frekuensi: 1, jam: ['08:00'] });
    const b = med({ nama_obat: 'Kalsium', frekuensi: 1, jam: ['08:00'] });
    const r = rencanaPengingat([a, b]);
    expect(r.map((p) => p.medicationId).sort()).toEqual([a.id, b.id].sort());
  });

  it('teksnya tidak pernah menyebut dosis atau menyuruh', () => {
    // Menyebut takaran di notifikasi berarti aplikasi ikut menentukannya — dan
    // teks itu tidak ikut berubah ketika dokter mengubah dosisnya.
    const r = rencanaPengingat([
      med({ nama_obat: 'Prednison', dosis: '5 mg', frekuensi: 2, jam: ['08:00', '20:00'] }),
    ]);
    for (const p of r) {
      expect(`${p.judul} ${p.isi}`).not.toMatch(/mg|tablet|naikkan|turunkan|harus|jangan lupa/i);
    }
  });

  it('menyebut nomor dosis hanya bila lebih dari sekali sehari', () => {
    const sekali = rencanaPengingat([med({ frekuensi: 1, jam: ['08:00'] })]);
    expect(sekali[0].isi).not.toMatch(/Dosis ke-/);
    const dua = rencanaPengingat([med({ frekuensi: 2, jam: ['08:00', '20:00'] })]);
    expect(dua[0].isi).toMatch(/Dosis ke-1/);
  });
});

describe('pengingatBerikutnya', () => {
  const daftar = rencanaPengingat([med({ frekuensi: 3, jam: ['08:00', '14:00', '20:00'] })]);
  const jam = (h: number, m = 0) => new Date(2026, 6, 30, h, m);

  it('memilih jam terdekat yang belum lewat', () => {
    expect(tulisJam(pengingatBerikutnya(daftar, jam(9))!)).toBe('14:00');
  });

  it('berputar ke hari berikutnya bila semua sudah lewat', () => {
    expect(tulisJam(pengingatBerikutnya(daftar, jam(23))!)).toBe('08:00');
  });

  it('jam yang sama persis dianggap sudah lewat', () => {
    expect(tulisJam(pengingatBerikutnya(daftar, jam(14, 0))!)).toBe('20:00');
  });

  it('null bila tidak ada pengingat', () => {
    expect(pengingatBerikutnya([], jam(9))).toBeNull();
  });
});
