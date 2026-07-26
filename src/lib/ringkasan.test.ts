import type {
  DailyCheckin,
  FlareCheck,
  LabResult,
  MarsAssessment,
  MedLog,
  Medication,
} from '@/types/database';

import {
  buatRingkasan,
  idPendek,
  inisialNama,
  mundurHari,
  ringkasanTeks,
  selisihHari,
  type RingkasanInput,
} from './ringkasan';

// ---------- Pembantu pembuat data ----------

let seq = 0;
const id = () => `id-${++seq}`;

function checkin(p: Partial<DailyCheckin> & { tanggal: string }): DailyCheckin {
  return {
    id: id(),
    patient_id: 'p1',
    mood: null,
    lelah: null,
    nyeri_sendi: null,
    gejala: null,
    foto_url: null,
    catatan: null,
    created_at: `${p.tanggal}T08:00:00+07:00`,
    ...p,
  };
}

function gejala(system: string, item: string) {
  return { system, item, present: true };
}

function med(nama: string, medId = id()): Medication {
  return {
    id: medId,
    patient_id: 'p1',
    nama_obat: nama,
    dosis: null,
    jadwal: null,
    aktif: true,
    created_at: '2026-01-01T00:00:00+07:00',
  };
}

function medLog(p: Partial<MedLog> & { tanggal: string }): MedLog {
  return {
    id: id(),
    patient_id: 'p1',
    medication_id: null,
    diminum: null,
    alasan: null,
    created_at: `${p.tanggal}T08:00:00+07:00`,
    ...p,
  };
}

function flare(waktu: string, hasil: FlareCheck['hasil'], p: Partial<FlareCheck> = {}): FlareCheck {
  return {
    id: id(),
    patient_id: 'p1',
    waktu,
    tanda_bahaya: null,
    gejala: null,
    hasil,
    ...p,
  };
}

function input(p: Partial<RingkasanInput> = {}): RingkasanInput {
  return {
    dari: '2026-07-01',
    sampai: '2026-07-30',
    pasien: { inisial: 'S.R.', id: 'abc12345' },
    checkins: [],
    meds: [],
    medLogs: [],
    mars: [],
    flares: [],
    labs: [],
    pertanyaan: [],
    ...p,
  };
}

// ---------- Pembantu tanggal ----------

describe('pembantu tanggal', () => {
  it('selisihHari menghitung jarak inklusif-eksklusif', () => {
    expect(selisihHari('2026-07-01', '2026-07-30')).toBe(29);
    expect(selisihHari('2026-07-30', '2026-07-30')).toBe(0);
  });

  it('mundurHari melintasi batas bulan', () => {
    expect(mundurHari('2026-07-03', 5)).toBe('2026-06-28');
  });

  it('mundurHari melintasi batas tahun', () => {
    expect(mundurHari('2026-01-02', 3)).toBe('2025-12-30');
  });

  it('inisialNama & idPendek menjaga identitas tetap ringkas', () => {
    expect(inisialNama('Siti Rahma Dewi')).toBe('S.R.D.');
    expect(inisialNama('  budi ')).toBe('B.');
    expect(inisialNama(null)).toBe('—');
    expect(idPendek('0f8c1a2b-3d4e-5f60-7181-92a3b4c5d6e7')).toBe('0f8c1a2b');
    expect(idPendek(null)).toBe('—');
  });
});

// ---------- Kepala ----------

describe('kepala ringkasan', () => {
  it('menghitung jumlah check-in setelah duplikat per tanggal dirapikan', () => {
    const r = buatRingkasan(
      input({
        checkins: [
          checkin({ tanggal: '2026-07-10', mood: 2 }),
          checkin({ tanggal: '2026-07-10', mood: 4 }), // pembaruan di hari yang sama
          checkin({ tanggal: '2026-07-11', mood: 3 }),
        ],
      })
    );
    expect(r.kepala.jumlahCheckin).toBe(2);
    expect(r.kepala.jumlahHari).toBe(30);
  });

  it('mengabaikan check-in di luar periode', () => {
    const r = buatRingkasan(
      input({
        checkins: [
          checkin({ tanggal: '2026-06-30', mood: 5 }),
          checkin({ tanggal: '2026-07-15', mood: 3 }),
          checkin({ tanggal: '2026-07-31', mood: 1 }),
        ],
      })
    );
    expect(r.kepala.jumlahCheckin).toBe(1);
  });
});

// ---------- 1. Skor ----------

describe('tren skor harian', () => {
  it('membandingkan paruh awal dan paruh akhir periode', () => {
    const r = buatRingkasan(
      input({
        checkins: [
          checkin({ tanggal: '2026-07-02', mood: 2 }),
          checkin({ tanggal: '2026-07-05', mood: 2 }),
          checkin({ tanggal: '2026-07-25', mood: 4 }),
          checkin({ tanggal: '2026-07-28', mood: 4 }),
        ],
      })
    );
    const mood = r.skor.find((s) => s.label.startsWith('Mood'))!;
    expect(mood.awal).toBe(2);
    expect(mood.akhir).toBe(4);
    expect(mood.arah).toBe('naik');
  });

  it('perubahan di bawah 0,5 dianggap stabil', () => {
    const r = buatRingkasan(
      input({
        checkins: [
          checkin({ tanggal: '2026-07-02', mood: 3 }),
          checkin({ tanggal: '2026-07-28', mood: 3 }),
        ],
      })
    );
    expect(r.skor.find((s) => s.label.startsWith('Mood'))!.arah).toBe('stabil');
  });

  it('minggu tanpa check-in bernilai null, urut lama → baru', () => {
    const r = buatRingkasan(
      input({
        dari: '2026-07-17',
        sampai: '2026-07-30', // 2 minggu
        checkins: [checkin({ tanggal: '2026-07-29', nyeri_sendi: 3 })],
      })
    );
    const nyeri = r.skor.find((s) => s.label.startsWith('Nyeri'))!;
    expect(nyeri.mingguan).toEqual([null, 3]);
  });

  it('tanpa data sama sekali, skor kosong dan arah stabil', () => {
    const r = buatRingkasan(input());
    for (const s of r.skor) {
      expect(s.awal).toBeNull();
      expect(s.akhir).toBeNull();
      expect(s.arah).toBe('stabil');
    }
  });
});

// ---------- 2. Gejala ----------

describe('pengelompokan gejala', () => {
  it('gejala yang belum pernah ada di paruh awal ditandai baru', () => {
    const r = buatRingkasan(
      input({
        checkins: [
          checkin({ tanggal: '2026-07-02', gejala: [gejala('sendi', 'Nyeri sendi')] }),
          checkin({ tanggal: '2026-07-25', gejala: [gejala('ginjal', 'Urin berbusa')] }),
        ],
      })
    );
    expect(r.gejala.baru.map((g) => g.item)).toEqual(['Urin berbusa']);
    expect(r.gejala.baru[0].sistemLabel).toBe('Ginjal');
  });

  it('gejala yang hilang di paruh akhir ditandai membaik', () => {
    const r = buatRingkasan(
      input({
        checkins: [
          checkin({ tanggal: '2026-07-02', gejala: [gejala('kulit', 'Sariawan')] }),
          checkin({ tanggal: '2026-07-05', gejala: [gejala('kulit', 'Sariawan')] }),
          checkin({ tanggal: '2026-07-25', gejala: [] }),
        ],
      })
    );
    expect(r.gejala.membaik.map((g) => g.item)).toEqual(['Sariawan']);
  });

  it('frekuensi dibandingkan sebagai proporsi, bukan jumlah mentah', () => {
    // Paruh awal: 1 dari 4 hari. Paruh akhir: 1 dari 1 hari → makin sering,
    // meskipun jumlah mentahnya sama.
    const r = buatRingkasan(
      input({
        checkins: [
          checkin({ tanggal: '2026-07-02', gejala: [gejala('sendi', 'Nyeri sendi')] }),
          checkin({ tanggal: '2026-07-03', gejala: [] }),
          checkin({ tanggal: '2026-07-04', gejala: [] }),
          checkin({ tanggal: '2026-07-05', gejala: [] }),
          checkin({ tanggal: '2026-07-25', gejala: [gejala('sendi', 'Nyeri sendi')] }),
        ],
      })
    );
    expect(r.gejala.memburuk.map((g) => g.item)).toEqual(['Nyeri sendi']);
  });

  it('gejala dengan frekuensi setara masuk menetap', () => {
    const r = buatRingkasan(
      input({
        checkins: [
          checkin({ tanggal: '2026-07-02', gejala: [gejala('sendi', 'Nyeri sendi')] }),
          checkin({ tanggal: '2026-07-25', gejala: [gejala('sendi', 'Nyeri sendi')] }),
        ],
      })
    );
    expect(r.gejala.menetap.map((g) => g.item)).toEqual(['Nyeri sendi']);
  });

  it('tanpa pembanding di salah satu paruh, gejala tidak diklaim baru', () => {
    // Semua check-in ada di paruh akhir — "baru muncul" tidak bisa dibuktikan.
    const r = buatRingkasan(
      input({
        checkins: [
          checkin({ tanggal: '2026-07-25', gejala: [gejala('kulit', 'Rambut rontok')] }),
          checkin({ tanggal: '2026-07-26', gejala: [gejala('kulit', 'Rambut rontok')] }),
        ],
      })
    );
    expect(r.gejala.baru).toHaveLength(0);
    expect(r.gejala.menetap.map((g) => g.item)).toEqual(['Rambut rontok']);
  });

  it('gejala dengan present: false tidak dihitung', () => {
    const r = buatRingkasan(
      input({
        checkins: [
          checkin({
            tanggal: '2026-07-25',
            gejala: [{ system: 'sendi', item: 'Bengkak sendi', present: false }],
          }),
        ],
      })
    );
    expect(Object.values(r.gejala).flat()).toHaveLength(0);
  });

  it('diurutkan dari yang paling sering tercatat', () => {
    const r = buatRingkasan(
      input({
        checkins: [
          checkin({
            tanggal: '2026-07-25',
            gejala: [gejala('sendi', 'Nyeri sendi'), gejala('kulit', 'Sariawan')],
          }),
          checkin({ tanggal: '2026-07-26', gejala: [gejala('sendi', 'Nyeri sendi')] }),
        ],
      })
    );
    expect(r.gejala.menetap.map((g) => g.item)).toEqual(['Nyeri sendi', 'Sariawan']);
  });
});

// ---------- 3. Indikator ----------

describe('indikator (pengamatan)', () => {
  it('mencatat kenaikan beban beruntun', () => {
    const r = buatRingkasan(
      input({
        checkins: [
          checkin({ tanggal: '2026-07-20', lelah: 0, nyeri_sendi: 0 }),
          checkin({ tanggal: '2026-07-21', lelah: 1, nyeri_sendi: 0 }),
          checkin({ tanggal: '2026-07-22', lelah: 2, nyeri_sendi: 1 }),
          checkin({ tanggal: '2026-07-23', lelah: 3, nyeri_sendi: 2 }),
        ],
      })
    );
    expect(r.indikator.some((i) => i.includes('4 check-in berturut-turut'))).toBe(true);
  });

  it('beban yang naik-turun tidak dianggap beruntun', () => {
    const r = buatRingkasan(
      input({
        checkins: [
          checkin({ tanggal: '2026-07-20', lelah: 2, nyeri_sendi: 1 }),
          checkin({ tanggal: '2026-07-21', lelah: 1, nyeri_sendi: 1 }),
          checkin({ tanggal: '2026-07-22', lelah: 2, nyeri_sendi: 1 }),
        ],
      })
    );
    expect(r.indikator.some((i) => i.includes('berturut-turut'))).toBe(false);
  });

  it('menyebut jumlah sistem organ ketika gejala memberat bersamaan', () => {
    const r = buatRingkasan(
      input({
        checkins: [
          checkin({ tanggal: '2026-07-02', gejala: [] }),
          checkin({
            tanggal: '2026-07-25',
            gejala: [gejala('ginjal', 'Urin berbusa'), gejala('saraf', 'Sakit kepala hebat')],
          }),
        ],
      })
    );
    expect(r.indikator.some((i) => i.includes('2 sistem organ'))).toBe(true);
  });

  it('merangkum jumlah peringatan Cek Flare', () => {
    const r = buatRingkasan(
      input({
        flares: [
          flare('2026-07-10T10:00:00+07:00', 'red'),
          flare('2026-07-12T10:00:00+07:00', 'yellow'),
        ],
      })
    );
    expect(r.indikator.some((i) => i.includes('1 tingkat darurat dan 1 tingkat mendesak'))).toBe(
      true
    );
  });

  it('tanpa pola apa pun, daftar indikator kosong', () => {
    const r = buatRingkasan(
      input({ checkins: [checkin({ tanggal: '2026-07-15', lelah: 1, nyeri_sendi: 1 })] })
    );
    expect(r.indikator).toEqual([]);
  });
});

// ---------- 4. Obat ----------

describe('kepatuhan obat', () => {
  it('menghitung hari terlewat per obat', () => {
    const m = med('Hidroksiklorokuin', 'm1');
    const r = buatRingkasan(
      input({
        meds: [m],
        medLogs: [
          medLog({ tanggal: '2026-07-10', medication_id: 'm1', diminum: true }),
          medLog({ tanggal: '2026-07-11', medication_id: 'm1', diminum: false }),
          medLog({ tanggal: '2026-07-12', medication_id: 'm1', diminum: false }),
        ],
      })
    );
    expect(r.obat.daftar).toEqual([{ nama: 'Hidroksiklorokuin', terlewat: 2, diminum: 1 }]);
    expect(r.obat.hariTanpaCatatan).toBe(27);
  });

  it('tanpa obat terdaftar, hari tanpa catatan tidak dihitung', () => {
    const r = buatRingkasan(input());
    expect(r.obat.daftar).toEqual([]);
    expect(r.obat.hariTanpaCatatan).toBe(0);
  });

  it('mengambil MARS-5 terbaru di dalam periode saja', () => {
    const mars = (tanggal: string, total: number): MarsAssessment => ({
      id: id(),
      patient_id: 'p1',
      tanggal,
      item1: null,
      item2: null,
      item3: null,
      item4: null,
      item5: null,
      total,
      kategori: total >= 23 ? 'Tinggi' : 'Sedang',
      created_at: `${tanggal}T08:00:00+07:00`,
    });
    const r = buatRingkasan(
      input({ mars: [mars('2026-06-20', 25), mars('2026-07-05', 20), mars('2026-07-20', 24)] })
    );
    expect(r.obat.mars).toEqual({ tanggal: '2026-07-20', total: 24, kategori: 'Tinggi' });
  });

  it('alasan bebas dibawa apa adanya beserta nama obat', () => {
    const r = buatRingkasan(
      input({
        meds: [med('Metilprednisolon', 'm2')],
        medLogs: [
          medLog({
            tanggal: '2026-07-09',
            medication_id: 'm2',
            diminum: false,
            alasan: 'perut perih',
          }),
        ],
      })
    );
    expect(r.obat.alasan).toEqual([
      { tanggal: '2026-07-09', teks: 'Metilprednisolon: perut perih' },
    ]);
  });
});

// ---------- 5. Red-flag ----------

describe('event red-flag', () => {
  it('hanya mengambil hasil kuning & merah, urut lama → baru', () => {
    const r = buatRingkasan(
      input({
        flares: [
          flare('2026-07-20T10:00:00+07:00', 'yellow'),
          flare('2026-07-05T10:00:00+07:00', 'red'),
          flare('2026-07-06T10:00:00+07:00', 'green'),
        ],
      })
    );
    expect(r.redflag.map((e) => e.level)).toEqual(['darurat', 'mendesak']);
  });

  it('menerjemahkan kunci tanda menjadi label bahasa awam', () => {
    const r = buatRingkasan(
      input({
        flares: [
          flare('2026-07-05T10:00:00+07:00', 'red', {
            tanda_bahaya: { kejang: true, nyeri_dada: false },
            gejala: { urin_berbusa: true },
          }),
        ],
      })
    );
    expect(r.redflag[0].tanda).toEqual(['Kejang', 'Urin berbusa']);
  });

  it('event di luar periode diabaikan', () => {
    const r = buatRingkasan(input({ flares: [flare('2026-08-01T10:00:00+07:00', 'red')] }));
    expect(r.redflag).toEqual([]);
  });
});

// ---------- 6 & 7 ----------

describe('pertanyaan & pemantauan', () => {
  it('menggabungkan pertanyaan pasien dan catatan check-in', () => {
    const r = buatRingkasan(
      input({
        pertanyaan: ['Boleh berjemur pagi?', '   ', ''],
        checkins: [checkin({ tanggal: '2026-07-12', catatan: '  Rambut rontok banyak  ' })],
      })
    );
    expect(r.pertanyaan.pasien).toEqual(['Boleh berjemur pagi?']);
    expect(r.pertanyaan.catatan).toEqual([{ tanggal: '2026-07-12', teks: 'Rambut rontok banyak' }]);
  });

  it('menyebut lab terakhir beserta umurnya', () => {
    const lab: LabResult = {
      id: id(),
      patient_id: 'p1',
      jenis: 'Komplemen C3',
      nilai_num: 70,
      nilai_teks: null,
      satuan: 'mg/dL',
      tanggal: '2026-07-10',
      catatan: null,
      created_at: '2026-07-10T08:00:00+07:00',
    };
    const r = buatRingkasan(input({ labs: [lab] }));
    expect(r.pemantauan[0]).toContain('Komplemen C3');
    expect(r.pemantauan[0]).toContain('20 hari');
  });

  it('menandai pemakaian hidroksiklorokuin tanpa memberi anjuran', () => {
    const r = buatRingkasan(input({ meds: [med('Hydroxychloroquine 200mg')] }));
    const baris = r.pemantauan.find((p) => p.includes('hidroksiklorokuin'))!;
    expect(baris).toContain('fase 2');
  });
});

// ---------- Teks ----------

describe('ringkasanTeks', () => {
  it('memuat ketujuh bagian kerangka spesifikasi', () => {
    const teks = ringkasanTeks(buatRingkasan(input()));
    for (const judul of [
      'RINGKASAN PRA-KUNJUNGAN',
      '1. SKOR HARIAN',
      '2. GEJALA MENONJOL',
      '3. INDIKATOR',
      '4. KEPATUHAN & EFEK SAMPING OBAT',
      '5. EVENT RED-FLAG',
      '6. PERTANYAAN / KEKHAWATIRAN PASIEN',
      '7. PEMANTAUAN',
    ]) {
      expect(teks).toContain(judul);
    }
  });

  it('tidak pernah menyebut diagnosis atau anjuran terapi', () => {
    const teks = ringkasanTeks(
      buatRingkasan(
        input({
          checkins: [
            checkin({ tanggal: '2026-07-20', lelah: 1, nyeri_sendi: 1 }),
            checkin({ tanggal: '2026-07-21', lelah: 2, nyeri_sendi: 2 }),
            checkin({ tanggal: '2026-07-22', lelah: 3, nyeri_sendi: 3 }),
          ],
          flares: [flare('2026-07-22T10:00:00+07:00', 'red')],
        })
      )
    );
    expect(teks).not.toMatch(/flare aktif|naikkan dosis|turunkan dosis|sebaiknya diberi/i);
    // Kata "diagnosis" hanya boleh muncul dalam kalimat penyangkalan.
    for (const baris of teks.split('\n').filter((b) => /diagnosis/i.test(b))) {
      expect(baris).toMatch(/bukan/i);
    }
    expect(teks).toContain('bukan alat diagnosis');
  });

  it('memakai inisial & ID pendek, bukan nama lengkap', () => {
    const teks = ringkasanTeks(buatRingkasan(input()));
    expect(teks).toContain('S.R. · ID abc12345');
  });

  it('menyatakan skor harian bukan PRO tervalidasi', () => {
    expect(ringkasanTeks(buatRingkasan(input()))).toContain('bukan PRO tervalidasi');
  });
});
