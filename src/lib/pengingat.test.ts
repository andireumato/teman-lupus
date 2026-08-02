import {
  diagnosaPengingat,
  bacaJam,
  JAM_BAWAAN,
  MAKS_DOSIS,
  KEJADIAN_SELANG_DI_MUKA,
  pengingatBerikutnya,
  rencanaPengingat,
  sesuaikanJam,
  tulisJam,
  waktuBerikutnya,
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
    pola: 'harian',
    hari_minggu: null,
    selang_hari: null,
    mulai_tanggal: null,
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

describe('diagnosaPengingat', () => {
  it('tidak berkata apa-apa saat memang tidak ada yang perlu dipasang', () => {
    // Pasien tanpa obat berjam tidak boleh melihat peringatan "pengingat
    // hilang" — tidak ada yang hilang.
    const d = diagnosaPengingat(0, 0);
    expect(d.status).toBe('tak-relevan');
    expect(d.pesan).toBeNull();
  });

  it('diam saat semuanya terpasang', () => {
    const d = diagnosaPengingat(3, 3);
    expect(d.status).toBe('sehat');
    expect(d.pesan).toBeNull();
  });

  it('tetap sehat bila sistem memegang LEBIH banyak', () => {
    // Bisa terjadi sesaat setelah jadwal dikurangi. Bukan kegagalan, dan
    // memperingatkan pasien untuk itu hanya membuat bising.
    expect(diagnosaPengingat(2, 3).status).toBe('sehat');
  });

  it('nol terpasang padahal direncanakan = hilang, dengan sebab yang disebut', () => {
    const d = diagnosaPengingat(3, 0);
    expect(d.status).toBe('hilang');
    expect(d.pesan).toContain('Tidak ada satu pun');
    expect(d.pesan).toContain('saat aplikasi ditutup');
  });

  it('sebagian terpasang disebut angkanya', () => {
    const d = diagnosaPengingat(3, 1);
    expect(d.status).toBe('sebagian');
    expect(d.pesan).toContain('1 dari 3');
  });

  it('selalu membawa kedua angkanya untuk ditampilkan', () => {
    const d = diagnosaPengingat(5, 2);
    expect(d.direncanakan).toBe(5);
    expect(d.terpasang).toBe(2);
  });
});

describe('rencanaPengingat — pola mingguan', () => {
  // 3 Agustus 2026 adalah hari Senin.
  const seninPagi = new Date(2026, 7, 3, 6, 0);

  it('memasang satu pengingat berulang per hari yang dipilih', () => {
    const r = rencanaPengingat(
      [med({ pola: 'mingguan', hari_minggu: [1, 4], jam: ['08:00'] })],
      seninPagi
    );
    expect(r).toHaveLength(2);
    expect(r.map((p) => p.pemicu)).toEqual([
      { jenis: 'mingguan', hariISO: 1 },
      { jenis: 'mingguan', hariISO: 4 },
    ]);
  });

  it('tidak memasang apa pun bila harinya belum dipilih', () => {
    const r = rencanaPengingat(
      [med({ pola: 'mingguan', hari_minggu: [], jam: ['08:00'] })],
      seninPagi
    );
    expect(r).toHaveLength(0);
  });

  it('kuncinya berbeda per hari, supaya tidak saling menimpa', () => {
    const r = rencanaPengingat(
      [med({ id: 'mtx', pola: 'mingguan', hari_minggu: [1, 7], jam: ['08:00'] })],
      seninPagi
    );
    expect(new Set(r.map((p) => p.kunci)).size).toBe(2);
  });
});

describe('rencanaPengingat — pola selang', () => {
  const seninPagi = new Date(2026, 7, 3, 6, 0);
  const selang = () =>
    med({ pola: 'selang', selang_hari: 2, mulai_tanggal: '2026-08-03', jam: ['08:00'] });

  it('memasang kejadian bertanggal sebanyak KEJADIAN_SELANG_DI_MUKA', () => {
    const r = rencanaPengingat([selang()], seninPagi);
    expect(r).toHaveLength(KEJADIAN_SELANG_DI_MUKA);
    expect(r.every((p) => p.pemicu.jenis === 'tanggal')).toBe(true);
  });

  it('jaraknya benar-benar dua hari', () => {
    const r = rencanaPengingat([selang()], seninPagi);
    const tanggal = r.map((p) => (p.pemicu as { tanggal: Date }).tanggal);
    expect(tanggal[0].getDate()).toBe(3);
    expect(tanggal[1].getDate()).toBe(5);
    expect(tanggal[2].getDate()).toBe(7);
  });

  it('melewati kejadian yang jamnya sudah lewat hari ini', () => {
    // Menjadwalkan notifikasi ke masa lalu membuatnya berbunyi seketika.
    const seninSore = new Date(2026, 7, 3, 20, 0);
    const r = rencanaPengingat([selang()], seninSore);
    expect((r[0].pemicu as { tanggal: Date }).tanggal.getDate()).toBe(5);
    expect(r.every((p) => (p.pemicu as { tanggal: Date }).tanggal > seninSore)).toBe(true);
  });

  it('tidak memasang apa pun sebelum tanggal mulai terlampaui mundur', () => {
    const r = rencanaPengingat([selang()], new Date(2026, 6, 1, 6, 0));
    expect(r).toHaveLength(KEJADIAN_SELANG_DI_MUKA);
    expect((r[0].pemicu as { tanggal: Date }).tanggal.getMonth()).toBe(7); // Agustus
  });
});

describe('waktuBerikutnya', () => {
  const seninPagi = new Date(2026, 7, 3, 6, 0);

  it('pola mingguan pada hari yang salah menunjuk ke pekan yang benar', () => {
    // Inilah yang dulu salah: layar mengumumkan "berikutnya 08:00" pada hari Rabu.
    const [p] = rencanaPengingat(
      [med({ pola: 'mingguan', hari_minggu: [1], jam: ['08:00'] })],
      seninPagi
    );
    const rabu = new Date(2026, 7, 5, 9, 0);
    const w = waktuBerikutnya(p, rabu)!;
    expect(w.getDate()).toBe(10); // Senin berikutnya
    expect(w.getHours()).toBe(8);
  });

  it('pola mingguan pada harinya tetapi jamnya sudah lewat: pekan depan', () => {
    const [p] = rencanaPengingat(
      [med({ pola: 'mingguan', hari_minggu: [1], jam: ['08:00'] })],
      seninPagi
    );
    const w = waktuBerikutnya(p, new Date(2026, 7, 3, 20, 0))!;
    expect(w.getDate()).toBe(10);
  });

  it('pola harian berputar ke besok bila jamnya sudah lewat', () => {
    const [p] = rencanaPengingat([med({ jam: ['08:00'] })], seninPagi);
    expect(waktuBerikutnya(p, new Date(2026, 7, 3, 20, 0))!.getDate()).toBe(4);
  });

  it('pengingat bertanggal yang sudah lewat tidak punya waktu berikutnya', () => {
    const [p] = rencanaPengingat(
      [med({ pola: 'selang', selang_hari: 2, mulai_tanggal: '2026-08-03', jam: ['08:00'] })],
      seninPagi
    );
    expect(waktuBerikutnya(p, new Date(2026, 8, 30))).toBeNull();
  });

  it('pengingatBerikutnya memilih yang paling dekat lintas pola', () => {
    const daftar = rencanaPengingat(
      [
        med({ id: 'mtx', pola: 'mingguan', hari_minggu: [1], jam: ['08:00'] }),
        med({ id: 'hcq', jam: ['07:00'] }),
      ],
      seninPagi
    );
    // Pukul 06.00 Senin: HCQ 07.00 lebih dekat daripada MTX 08.00.
    expect(pengingatBerikutnya(daftar, seninPagi)!.medicationId).toBe('hcq');
  });
});
