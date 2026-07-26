import type {
  DailyCheckin,
  FlareCheck,
  LabResult,
  MarsAssessment,
  MedLog,
  Medication,
  MedicationEvent,
} from '@/types/database';

import {
  buatRingkasan,
  idPendek,
  inisialNama,
  ringkasanTeks,
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

function med(nama: string, medId = id(), p: Partial<Medication> = {}): Medication {
  return {
    id: medId,
    patient_id: 'p1',
    nama_obat: nama,
    dosis: null,
    jadwal: null,
    frekuensi: 1,
    aktif: true,
    created_at: '2026-01-01T00:00:00+07:00',
    ...p,
  };
}

function medEvent(
  medicationId: string,
  jenis: MedicationEvent['jenis'],
  tanggal: string,
  catatan: string | null = null
): MedicationEvent {
  return {
    id: id(),
    patient_id: 'p1',
    medication_id: medicationId,
    jenis,
    tanggal,
    catatan,
    created_at: `${tanggal}T08:00:00+07:00`,
  };
}

function medLog(p: Partial<MedLog> & { tanggal: string }): MedLog {
  return {
    id: id(),
    patient_id: 'p1',
    medication_id: null,
    slot: 0,
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
    medEvents: [],
    mars: [],
    flares: [],
    labs: [],
    pertanyaan: [],
    ...p,
  };
}

// ---------- Identitas pasien ----------

describe('identitas pasien', () => {
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

// ---------- 3. Perubahan & waktunya ----------
//
// Periode uji 1–30 Juli → jendela 14 hari: terkini 17–30 Juli,
// pembanding 3–16 Juli.

describe('perubahan & waktunya', () => {
  const cari = (r: ReturnType<typeof buatRingkasan>, potongan: string) =>
    r.perubahan.find((p) => p.includes(potongan));

  it('menghitung hari dalam skala asli, bukan skor gabungan', () => {
    const r = buatRingkasan(
      input({
        checkins: [
          checkin({ tanggal: '2026-07-05', nyeri_sendi: 2 }),
          checkin({ tanggal: '2026-07-20', nyeri_sendi: 2 }),
          checkin({ tanggal: '2026-07-21', nyeri_sendi: 3 }),
          checkin({ tanggal: '2026-07-22', nyeri_sendi: 2 }),
        ],
      })
    );
    // Penyebutnya hari yang tercatat, bukan hari kalender — pasien yang jarang
    // mengisi tidak boleh terbaca lebih ringan daripada keadaannya.
    expect(cari(r, 'Nyeri sendi sedang–berat')).toBe(
      'Nyeri sendi sedang–berat (2–3 dari skala 0–3): 3 dari 3 hari yang tercatat (dalam 14 hari terakhir), sebelumnya 1 dari 1.'
    );
    // Skala kelelahan & nyeri tidak boleh dijumlahkan jadi angka karangan.
    expect(r.perubahan.some((p) => /beban/i.test(p))).toBe(false);
  });

  it('jendela pembanding tanpa satu pun check-in dikatakan apa adanya', () => {
    const r = buatRingkasan(
      input({
        checkins: [
          checkin({ tanggal: '2026-07-20', nyeri_sendi: 3 }),
          checkin({ tanggal: '2026-07-21', nyeri_sendi: 2 }),
        ],
      })
    );
    expect(cari(r, 'Nyeri sendi sedang–berat')).toBe(
      'Nyeri sendi sedang–berat (2–3 dari skala 0–3): 2 dari 2 hari yang tercatat (dalam 14 hari terakhir), sebelumnya tidak ada catatan.'
    );
  });

  it('jendela terkini tanpa check-in tidak dilaporkan sebagai nol', () => {
    const r = buatRingkasan(
      input({ checkins: [checkin({ tanggal: '2026-07-05', nyeri_sendi: 3 })] })
    );
    expect(cari(r, 'Nyeri sendi sedang–berat')).toBe(
      'Nyeri sendi sedang–berat (2–3 dari skala 0–3): tidak ada catatan dalam 14 hari terakhir, sebelumnya 1 dari 1.'
    );
  });

  it('kelelahan dan nyeri sendi memakai ambang yang sama', () => {
    // "Sedang" pada kedua skala sama-sama berarti kegiatan harus dikurangi,
    // jadi keduanya dihitung mulai dari 2.
    const r = buatRingkasan(
      input({ checkins: [checkin({ tanggal: '2026-07-20', lelah: 2, nyeri_sendi: 2 })] })
    );
    expect(cari(r, 'Kelelahan')).toContain('Kelelahan sedang–berat (2–3 dari skala 0–3): 1 dari 1');
    expect(cari(r, 'Nyeri sendi')).toContain(
      'Nyeri sendi sedang–berat (2–3 dari skala 0–3): 1 dari 1'
    );
  });

  it('metrik yang nol di kedua jendela tidak ditampilkan', () => {
    const r = buatRingkasan(
      input({ checkins: [checkin({ tanggal: '2026-07-20', mood: 5, nyeri_sendi: 0, lelah: 0 })] })
    );
    expect(r.perubahan.some((p) => p.startsWith('Mood buruk'))).toBe(false);
    expect(r.perubahan.some((p) => p.startsWith('Nyeri sendi'))).toBe(false);
  });

  it('menyebut tanggal mulai memberat dari hari berturut-turut', () => {
    const r = buatRingkasan(
      input({
        checkins: [
          checkin({ tanggal: '2026-07-19', nyeri_sendi: 1 }),
          checkin({ tanggal: '2026-07-20', nyeri_sendi: 2 }),
          checkin({ tanggal: '2026-07-21', nyeri_sendi: 2 }),
          checkin({ tanggal: '2026-07-22', nyeri_sendi: 3 }),
        ],
      })
    );
    expect(cari(r, 'Mulai memberat')).toBe(
      'Mulai memberat sekitar 20 Jul 2026 — hari pertama dari 3 hari berturut-turut dengan nyeri sendi sedang–berat (2–3 dari skala 0–3).'
    );
  });

  it('rentetan dihitung per hari kalender, bukan per check-in', () => {
    // Tiga check-in dengan nyeri berat, tetapi terpaut seminggu — bukan
    // "3 hari berturut-turut".
    const r = buatRingkasan(
      input({
        checkins: [
          checkin({ tanggal: '2026-07-10', nyeri_sendi: 3 }),
          checkin({ tanggal: '2026-07-17', nyeri_sendi: 3 }),
          checkin({ tanggal: '2026-07-24', nyeri_sendi: 3 }),
        ],
      })
    );
    expect(cari(r, 'Mulai memberat')).toBeUndefined();
  });

  it('rentetan yang dilaporkan adalah yang terakhir', () => {
    const r = buatRingkasan(
      input({
        checkins: [
          checkin({ tanggal: '2026-07-03', nyeri_sendi: 2 }),
          checkin({ tanggal: '2026-07-04', nyeri_sendi: 2 }),
          checkin({ tanggal: '2026-07-05', nyeri_sendi: 2 }),
          checkin({ tanggal: '2026-07-06', nyeri_sendi: 0 }),
          checkin({ tanggal: '2026-07-20', nyeri_sendi: 2 }),
          checkin({ tanggal: '2026-07-21', nyeri_sendi: 2 }),
          checkin({ tanggal: '2026-07-22', nyeri_sendi: 2 }),
          checkin({ tanggal: '2026-07-23', nyeri_sendi: 2 }),
        ],
      })
    );
    expect(cari(r, 'Mulai memberat')).toContain('20 Jul 2026');
    expect(cari(r, 'Mulai memberat')).toContain('4 hari berturut-turut');
  });

  it('menyebut gejala yang muncul bersamaan dari sistem organ berbeda', () => {
    const r = buatRingkasan(
      input({
        checkins: [
          checkin({ tanggal: '2026-07-02', gejala: [] }),
          checkin({ tanggal: '2026-07-20', gejala: [gejala('ginjal', 'Urin berbusa')] }),
          checkin({
            tanggal: '2026-07-22',
            gejala: [gejala('ginjal', 'Urin berbusa'), gejala('saraf', 'Sakit kepala hebat')],
          }),
        ],
      })
    );
    const baris = cari(r, 'Muncul bersamaan')!;
    expect(baris).toContain('20 Jul 2026');
    expect(baris).toContain('Urin berbusa (Ginjal)');
    expect(baris).toContain('Sakit kepala hebat (Saraf)');
  });

  it('gejala yang sudah ada sejak check-in pertama tidak disebut muncul', () => {
    // Tanpa hari pembanding yang menunjukkan gejalanya belum ada, "muncul"
    // tidak terbukti.
    const r = buatRingkasan(
      input({
        checkins: [
          checkin({
            tanggal: '2026-07-02',
            gejala: [gejala('ginjal', 'Urin berbusa'), gejala('saraf', 'Sakit kepala hebat')],
          }),
          checkin({
            tanggal: '2026-07-22',
            gejala: [gejala('ginjal', 'Urin berbusa'), gejala('saraf', 'Sakit kepala hebat')],
          }),
        ],
      })
    );
    expect(cari(r, 'Muncul bersamaan')).toBeUndefined();
  });

  it('gejala baru dari satu sistem organ saja belum disebut bersamaan', () => {
    const r = buatRingkasan(
      input({
        checkins: [
          checkin({ tanggal: '2026-07-02', gejala: [] }),
          checkin({
            tanggal: '2026-07-22',
            gejala: [gejala('sendi', 'Nyeri sendi'), gejala('sendi', 'Bengkak sendi')],
          }),
        ],
      })
    );
    expect(cari(r, 'Muncul bersamaan')).toBeUndefined();
  });

  it('menyebut hari yang tidak terpantau', () => {
    const r = buatRingkasan(
      input({
        checkins: [
          checkin({ tanggal: '2026-07-20', nyeri_sendi: 2 }),
          checkin({ tanggal: '2026-07-21', nyeri_sendi: 2 }),
        ],
      })
    );
    expect(cari(r, 'tanpa check-in')).toBe(
      '12 dari 14 hari terakhir tanpa check-in — hari itu tidak terpantau, bukan berarti tanpa gejala.'
    );
  });

  it('tidak mengulang event Cek Flare yang sudah jadi bagian 5', () => {
    const r = buatRingkasan(
      input({
        checkins: [checkin({ tanggal: '2026-07-20', nyeri_sendi: 2 })],
        flares: [flare('2026-07-20T10:00:00+07:00', 'red')],
      })
    );
    expect(r.perubahan.some((p) => /flare/i.test(p))).toBe(false);
    expect(r.redflag).toHaveLength(1);
  });

  it('periode terlalu pendek untuk dua jendela setara → kosong', () => {
    const r = buatRingkasan(
      input({
        dari: '2026-07-26',
        sampai: '2026-07-30',
        checkins: [checkin({ tanggal: '2026-07-29', nyeri_sendi: 3 })],
      })
    );
    expect(r.perubahan).toEqual([]);
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
    expect(r.obat.daftar).toEqual([
      {
        id: 'm1',
        nama: 'Hidroksiklorokuin',
        frekuensi: 1,
        aktif: true,
        perubahan: '',
        terlewat: 2,
        diminum: 1,
      },
    ]);
    expect(r.obat.hariTanpaCatatan).toBe(27);
  });

  it('tanpa obat terdaftar, hari tanpa catatan tidak dihitung', () => {
    const r = buatRingkasan(input());
    expect(r.obat.daftar).toEqual([]);
    expect(r.obat.hariTanpaCatatan).toBe(0);
  });

  it('menghitung per dosis, bukan per hari', () => {
    // Obat 3x sehari: satu hari bisa punya tiga catatan.
    const m = med('Metilprednisolon', 'm3', { frekuensi: 3 });
    const r = buatRingkasan(
      input({
        meds: [m],
        medLogs: [
          medLog({ tanggal: '2026-07-10', medication_id: 'm3', slot: 0, diminum: true }),
          medLog({ tanggal: '2026-07-10', medication_id: 'm3', slot: 1, diminum: true }),
          medLog({ tanggal: '2026-07-10', medication_id: 'm3', slot: 2, diminum: false }),
        ],
      })
    );
    expect(r.obat.daftar[0]).toEqual({
      id: 'm3',
      nama: 'Metilprednisolon',
      frekuensi: 3,
      aktif: true,
      perubahan: '',
      terlewat: 1,
      diminum: 2,
    });
  });

  it('mencatat tanggal berhenti & lanjut obat', () => {
    const r = buatRingkasan(
      input({
        meds: [med('Prednison', 'm4')],
        medEvents: [
          medEvent('m4', 'stop', '2026-07-12', 'perut perih'),
          medEvent('m4', 'lanjut', '2026-07-20'),
        ],
      })
    );
    // Perubahan menempel pada obatnya, bukan jadi daftar terpisah.
    expect(r.obat.daftar[0].perubahan).toBe('stop 12 Jul 2026 (perut perih), lanjut 20 Jul 2026');
  });

  it('obat yang dihentikan tetap dilaporkan bila ada jejaknya di periode ini', () => {
    const r = buatRingkasan(
      input({
        meds: [med('Prednison', 'm5', { aktif: false })],
        medEvents: [medEvent('m5', 'stop', '2026-07-12')],
      })
    );
    expect(r.obat.daftar).toHaveLength(1);
    expect(r.obat.daftar[0].aktif).toBe(false);
  });

  it('dua obat bernama sama tetap dibedakan oleh id', () => {
    // Obat yang dihentikan lalu didaftarkan ulang dengan nama sama. Layar
    // ringkasan memakai id ini sebagai kunci React; memakai namanya membuat
    // React menemukan dua anak dengan kunci sama.
    const r = buatRingkasan(
      input({
        meds: [med('Myfortic', 'm7', { aktif: false }), med('Myfortic', 'm8')],
        medEvents: [medEvent('m7', 'stop', '2026-07-10'), medEvent('m8', 'mulai', '2026-07-10')],
      })
    );
    expect(r.obat.daftar).toHaveLength(2);
    expect(new Set(r.obat.daftar.map((o) => o.id)).size).toBe(2);
  });

  it('obat lama tanpa jejak di periode ini tidak ikut dilaporkan', () => {
    const r = buatRingkasan(
      input({
        meds: [med('Obat lama', 'm6', { aktif: false })],
        medEvents: [medEvent('m6', 'stop', '2026-05-01')],
      })
    );
    expect(r.obat.daftar).toEqual([]);
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
    expect(r.obat.alasan.map(({ tanggal, teks }) => ({ tanggal, teks }))).toEqual([
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

  it('dua event pada waktu sama tetap dibedakan oleh id', () => {
    const r = buatRingkasan(
      input({
        flares: [
          flare('2026-07-05T10:00:00+07:00', 'red'),
          flare('2026-07-05T10:00:00+07:00', 'yellow'),
        ],
      })
    );
    expect(new Set(r.redflag.map((e) => e.id)).size).toBe(2);
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
      '3. PERUBAHAN & WAKTUNYA',
      '4. OBAT',
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
