import type {
  Alert,
  AlertTindakLanjut,
  DailyCheckin,
  FlareCheck,
  LabResult,
  MarsAssessment,
  MedLog,
  Medication,
  MedicationEvent,
  MedSideEffect,
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
    jam: null,
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

function efek(jenis: string, tanggal: string, p: Partial<MedSideEffect> = {}): MedSideEffect {
  return {
    id: id(),
    patient_id: 'p1',
    medication_id: null,
    jenis,
    tanggal,
    catatan: null,
    created_at: `${tanggal}T08:00:00+07:00`,
    ...p,
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

function peringatan(flareId: string, p: Partial<Alert> = {}): Alert {
  return {
    id: id(),
    patient_id: 'p1',
    flare_check_id: flareId,
    jenis: 'flare_darurat',
    pesan: null,
    selesai: false,
    created_at: '2026-07-05T10:05:00+07:00',
    ...p,
  };
}

function lanjut(alertId: string, p: Partial<AlertTindakLanjut> = {}): AlertTindakLanjut {
  return {
    id: id(),
    alert_id: alertId,
    doctor_id: 'd1',
    tindakan: 'obat_disesuaikan',
    kondisi: 'masih_bergejala',
    catatan: null,
    dibuat_pada: '2026-07-05T14:05:00+07:00',
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
    efekSamping: [],
    mars: [],
    flares: [],
    labs: [],
    pertanyaan: [],
    ...p,
  };
}

type Klinis = NonNullable<RingkasanInput['klinis']>;

/** Data klinis dasar dengan semua kolom kosong; isi hanya yang diuji. */
function klinis(p: Partial<Klinis> = {}): Klinis {
  return {
    tglLahir: null,
    jenisKelamin: null,
    tglDiagnosis: null,
    klasifikasi: null,
    organ: null,
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

  it('mengelompokkan per pertanyaan: sedang diminum, berubah, kepatuhan', () => {
    const r = buatRingkasan(
      input({
        meds: [
          med('Metilprednisolon', 'ma', { frekuensi: 3 }),
          med('Prednison', 'mb', { aktif: false }),
        ],
        medLogs: [
          medLog({ tanggal: '2026-07-10', medication_id: 'ma', slot: 0, diminum: true }),
          medLog({ tanggal: '2026-07-10', medication_id: 'ma', slot: 1, diminum: true }),
          medLog({ tanggal: '2026-07-10', medication_id: 'mb', slot: 0, diminum: false }),
        ],
        medEvents: [medEvent('mb', 'stop', '2026-07-12', 'perut perih')],
      })
    );

    // Obat yang dihentikan tidak masuk "sedang diminum"…
    expect(r.obat.sedangDiminum.map((o) => o.nama)).toEqual(['Metilprednisolon']);
    // …tetapi perubahannya tetap dilaporkan.
    expect(r.obat.perubahan).toEqual([
      { id: 'mb', nama: 'Prednison', teks: 'stop 12 Jul 2026 (perut perih)' },
    ]);
    // Penyebutnya dosis yang tercatat, bukan dosis yang seharusnya.
    expect(r.obat.dosis).toEqual({
      diminum: 2,
      tercatat: 3,
      terlewat: [{ id: 'mb', nama: 'Prednison', jumlah: 1 }],
    });
  });

  it('obat tanpa dosis terlewat tidak disebut namanya', () => {
    const r = buatRingkasan(
      input({
        meds: [med('Hidroksiklorokuin', 'mc')],
        medLogs: [medLog({ tanggal: '2026-07-10', medication_id: 'mc', slot: 0, diminum: true })],
      })
    );
    expect(r.obat.dosis.terlewat).toEqual([]);
    expect(r.obat.perubahan).toEqual([]);
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

  it('menggabungkan efek samping per jenis beserta tanggal terakhirnya', () => {
    const r = buatRingkasan(
      input({
        efekSamping: [
          efek('mual', '2026-07-10'),
          efek('mual', '2026-07-14'),
          efek('mual', '2026-07-12'),
          efek('sulit_tidur', '2026-07-20'),
        ],
      })
    );
    expect(r.obat.efekSamping).toEqual([
      { jenis: 'mual', label: 'Mual atau muntah', jumlah: 3, terakhir: '2026-07-14' },
      { jenis: 'sulit_tidur', label: 'Sulit tidur', jumlah: 1, terakhir: '2026-07-20' },
    ]);
  });

  it('efek samping di luar periode diabaikan', () => {
    const r = buatRingkasan(input({ efekSamping: [efek('mual', '2026-06-20')] }));
    expect(r.obat.efekSamping).toEqual([]);
  });

  it('jenis yang tidak dikenal tetap ditampilkan apa adanya', () => {
    // Daftar efek samping bisa berubah; laporan lama tidak boleh hilang.
    const r = buatRingkasan(input({ efekSamping: [efek('jenis_lama', '2026-07-10')] }));
    expect(r.obat.efekSamping[0].label).toBe('jenis_lama');
  });

  it('efek samping tidak ikut masuk gejala bagian 2', () => {
    // Keluhan yang sama bisa datang dari lupusnya atau dari obatnya; yang
    // membedakan penilaian dokter, bukan aplikasi.
    const r = buatRingkasan(
      input({
        efekSamping: [efek('rambut_rontok', '2026-07-10')],
        checkins: [checkin({ tanggal: '2026-07-10', gejala: [] })],
      })
    );
    expect(Object.values(r.gejala).flat()).toHaveLength(0);
    expect(r.obat.efekSamping).toHaveLength(1);
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

// ---------- 5b. Tindak lanjut sesudah red-flag ----------

describe('tindak lanjut peringatan', () => {
  it('menautkan tindak lanjut ke cek flare yang benar', () => {
    // Dua cek flare pada MENIT yang sama. Kalau penautannya memakai kecocokan
    // waktu dan bukan flare_check_id, keluaran klinis kedua pasien tertukar.
    const merah = flare('2026-07-05T10:00:00+07:00', 'red');
    const kuning = flare('2026-07-05T10:00:00+07:00', 'yellow');
    const aMerah = peringatan(merah.id);
    const aKuning = peringatan(kuning.id, { jenis: 'flare_mendesak' });

    const r = buatRingkasan(
      input({
        flares: [merah, kuning],
        alerts: [aMerah, aKuning],
        tindakLanjut: [
          lanjut(aMerah.id, { tindakan: 'dirujuk', kondisi: 'dirawat_inap' }),
          lanjut(aKuning.id, { tindakan: 'edukasi', kondisi: 'membaik_sendiri' }),
        ],
      })
    );

    const perLevel = new Map(r.redflag.map((e) => [e.level, e.tindakLanjut]));
    expect(perLevel.get('darurat')?.tindakan).toBe('dirujuk');
    expect(perLevel.get('mendesak')?.tindakan).toBe('edukasi');
  });

  it('menghitung jam respons dari terbitnya peringatan', () => {
    const f = flare('2026-07-05T10:00:00+07:00', 'red');
    // Peringatan terbit 10:05, tindak lanjut 14:05 → 4 jam, bukan 4 jam 5 menit
    // dari waktu cek flare-nya.
    const a = peringatan(f.id, { created_at: '2026-07-05T10:05:00+07:00' });
    const r = buatRingkasan(
      input({
        flares: [f],
        alerts: [a],
        tindakLanjut: [lanjut(a.id, { dibuat_pada: '2026-07-05T14:05:00+07:00' })],
      })
    );
    expect(r.redflag[0].tindakLanjut?.jam).toBe(4);
  });

  it('membedakan belum ditindaklanjuti dari ditutup tanpa rincian', () => {
    const baru = flare('2026-07-05T10:00:00+07:00', 'red');
    const lama = flare('2026-07-06T10:00:00+07:00', 'red');

    const r = buatRingkasan(
      input({
        flares: [baru, lama],
        alerts: [
          peringatan(baru.id, { selesai: false }),
          // Ditutup sebelum pencatatan tindak lanjut ada; rinciannya tidak
          // akan pernah datang.
          peringatan(lama.id, { selesai: true }),
        ],
        tindakLanjut: [],
      })
    );

    expect(r.redflag[0].selesaiTanpaRincian).toBe(false);
    expect(r.redflag[1].selesaiTanpaRincian).toBe(true);
  });

  it('tanpa data peringatan sama sekali, event tetap terbaca', () => {
    // Jalur PASIEN: `alert_tindak_lanjut` hanya bisa dibaca dokter, jadi layar
    // pasien tidak mengirim keduanya. Itu tidak boleh menggagalkan apa pun.
    const r = buatRingkasan(input({ flares: [flare('2026-07-05T10:00:00+07:00', 'red')] }));
    expect(r.redflag[0].tindakLanjut).toBeNull();
    expect(r.redflag[0].selesaiTanpaRincian).toBe(false);
  });

  it('teksnya menulis arahan lalu hasilnya', () => {
    const f = flare('2026-07-05T10:00:00+07:00', 'red', {
      tanda_bahaya: { kejang: true },
    });
    const a = peringatan(f.id, { created_at: '2026-07-05T10:00:00+07:00' });
    const teks = ringkasanTeks(
      buatRingkasan(
        input({
          flares: [f],
          alerts: [a],
          tindakLanjut: [
            lanjut(a.id, {
              dibuat_pada: '2026-07-05T14:00:00+07:00',
              tindakan: 'obat_disesuaikan',
              kondisi: 'masih_bergejala',
            }),
          ],
        })
      )
    );
    expect(teks).toContain('→ diarahkan ke IGD');
    expect(teks).toContain('(4 jam): masih bergejala, obat disesuaikan');
  });

  it('teksnya tidak pernah memuat catatan pribadi dokter', () => {
    // Ringkasan ini disalin, ditempel, dan dibagikan — termasuk kepada pasien.
    const f = flare('2026-07-05T10:00:00+07:00', 'red');
    const a = peringatan(f.id);
    const teks = ringkasanTeks(
      buatRingkasan(
        input({
          flares: [f],
          alerts: [a],
          tindakLanjut: [lanjut(a.id, { catatan: 'RAHASIA curiga tidak patuh' })],
        })
      )
    );
    expect(teks).not.toContain('RAHASIA');
    expect(teks).not.toContain('tidak patuh');
  });

  it('teksnya menandai event yang belum ditindaklanjuti', () => {
    const teks = ringkasanTeks(
      buatRingkasan(input({ flares: [flare('2026-07-05T10:00:00+07:00', 'red')] }))
    );
    expect(teks).toContain('→ belum ditindaklanjuti');
    expect(teks).not.toContain('belum tercatat');
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
    // Aplikasi tidak boleh MENYIMPULKAN diagnosis. Kata "diagnosis" karena itu
    // hanya boleh muncul dalam kalimat penyangkalan — kecuali pada baris data
    // klinis dasar, yang bukan kesimpulan aplikasi melainkan tanggal yang
    // diketikkan dokter sendiri di `/dokter/klinis/[id]`.
    const barisDiagnosis = teks
      .split('\n')
      .filter((b) => /diagnosis/i.test(b))
      .filter((b) => !b.startsWith('Sejak diagnosis:'));
    for (const baris of barisDiagnosis) {
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

// ---------- Data klinis dasar ----------

describe('data klinis dasar', () => {
  const KLINIS = klinis({
    tglLahir: '1991-09-14',
    jenisKelamin: 'perempuan',
    tglDiagnosis: '2022-05-10',
    klasifikasi: 'EULAR/ACR 2019',
    organ: ['ginjal', 'mukokutan'],
  });

  it('menghitung lama sakit sampai AKHIR PERIODE, bukan sampai hari ini', () => {
    // Ringkasan periode lama harus berbunyi sama kalau dibuka lagi bulan depan.
    const r = buatRingkasan(input({ klinis: KLINIS }));
    expect(r.kepala.lamaSakit).toBe('4 tahun 2 bulan');
    expect(r.kepala.klasifikasi).toBe('EULAR/ACR 2019');
    expect(r.kepala.organ).toEqual(['Ginjal', 'Mukokutan']);
  });

  it('kolom yang belum diisi tidak memunculkan baris kosong di teks', () => {
    const teks = ringkasanTeks(buatRingkasan(input()));
    expect(teks).not.toMatch(/Sejak diagnosis/);
    expect(teks).not.toMatch(/Organ terlibat/);
  });

  it('menempatkan data klinis di kepala teks, bukan tercecer di bagian lain', () => {
    const teks = ringkasanTeks(buatRingkasan(input({ klinis: KLINIS })));
    expect(teks).toContain('Sejak diagnosis: 4 tahun 2 bulan');
    expect(teks).toContain('EULAR/ACR 2019');
    expect(teks).toContain('Organ terlibat: Ginjal, Mukokutan');
  });

  it('usia & jenis kelamin menempel pada baris identitas, bukan baris klinis', () => {
    // Keduanya konteks untuk membaca SELURUH isi ringkasan, bukan salah satu
    // bagiannya.
    const teks = ringkasanTeks(buatRingkasan(input({ klinis: KLINIS })));
    expect(teks.split('\n')[0]).toBe(
      'RINGKASAN PRA-KUNJUNGAN — S.R. · Perempuan, 34 tahun · ID abc12345'
    );
  });

  it('usia dihitung sampai akhir periode, dan belum bertambah sebelum ulang tahun', () => {
    const sebelum = buatRingkasan(
      input({ sampai: '2026-09-13', klinis: klinis({ tglLahir: '1991-09-14' }) })
    );
    const tepat = buatRingkasan(
      input({ sampai: '2026-09-14', klinis: klinis({ tglLahir: '1991-09-14' }) })
    );
    expect(sebelum.kepala.usia).toBe(34);
    expect(tepat.kepala.usia).toBe(35);
  });

  it('identitas tetap utuh bila usia & jenis kelamin belum diisi', () => {
    // Tanpa penjagaan, yang tersisa adalah pemisah "·" menggantung.
    const teks = ringkasanTeks(buatRingkasan(input()));
    expect(teks.split('\n')[0]).toBe('RINGKASAN PRA-KUNJUNGAN — S.R. · ID abc12345');
  });

  it('salah satu terisi saja tetap terbaca wajar', () => {
    const hanyaJk = ringkasanTeks(
      buatRingkasan(input({ klinis: klinis({ jenisKelamin: 'laki-laki' }) }))
    );
    expect(hanyaJk.split('\n')[0]).toBe('RINGKASAN PRA-KUNJUNGAN — S.R. · Laki-laki · ID abc12345');

    const hanyaUsia = ringkasanTeks(
      buatRingkasan(input({ klinis: klinis({ tglLahir: '1991-09-14' }) }))
    );
    expect(hanyaUsia.split('\n')[0]).toBe(
      'RINGKASAN PRA-KUNJUNGAN — S.R. · 34 tahun · ID abc12345'
    );
  });

  it('tanggal diagnosis rusak diperlakukan seperti belum diisi', () => {
    const r = buatRingkasan(input({ klinis: klinis({ tglDiagnosis: 'tidak tahu' }) }));
    expect(r.kepala.lamaSakit).toBeNull();
  });
});

describe('gejala di luar organ terlibat yang tercatat', () => {
  const checkins = [
    checkin({ tanggal: '2026-07-05', gejala: [gejala('kulit', 'Sariawan')] }),
    checkin({ tanggal: '2026-07-25', gejala: [gejala('kulit', 'Sariawan')] }),
    checkin({
      tanggal: '2026-07-27',
      gejala: [gejala('saraf', 'Kejang'), gejala('ginjal', 'Urin berbusa')],
    }),
  ];

  it('menandai sistem organ yang gejalanya tercatat tapi tidak ada di daftar organ', () => {
    const r = buatRingkasan(
      input({
        checkins,
        klinis: klinis({ organ: ['mukokutan'] }),
      })
    );
    expect(r.sistemBelumTercatat).toEqual([
      { sistemLabel: 'Ginjal', items: ['Urin berbusa'] },
      { sistemLabel: 'Saraf', items: ['Kejang'] },
    ]);
  });

  it('sistem yang sudah tercatat terlibat tidak ikut ditandai', () => {
    const r = buatRingkasan(
      input({
        checkins,
        klinis: klinis({ organ: ['mukokutan', 'ginjal', 'neuropsikiatri'] }),
      })
    );
    expect(r.sistemBelumTercatat).toEqual([]);
  });

  it('tanpa daftar organ, tidak ada yang ditandai — tak ada pembandingnya', () => {
    const kosong = buatRingkasan(input({ checkins }));
    expect(kosong.sistemBelumTercatat).toEqual([]);

    const larikKosong = buatRingkasan(input({ checkins, klinis: klinis({ organ: [] }) }));
    expect(larikKosong.sistemBelumTercatat).toEqual([]);
  });

  it('domain tanpa padanan gejala pasien tidak menghapus penandaan yang lain', () => {
    // 'oftalmik' tidak memetakan ke sistem gejala mana pun; ia tidak boleh
    // membuat daftar organ terhitung "sudah diisi untuk semua sistem".
    const r = buatRingkasan(
      input({
        checkins,
        klinis: klinis({ organ: ['oftalmik'] }),
      })
    );
    expect(r.sistemBelumTercatat.map((s) => s.sistemLabel)).toEqual([
      'Ginjal',
      'Kulit & mulut',
      'Saraf',
    ]);
  });

  it('gejala menetap ikut ditandai, bukan hanya yang baru muncul', () => {
    // Kalau hanya kategori "baru" yang dihitung, keluhan yang sudah berbulan-
    // bulan pada organ yang belum tercatat justru tidak akan pernah terlihat.
    const r = buatRingkasan(
      input({
        checkins: [
          checkin({ tanggal: '2026-07-05', gejala: [gejala('darah', 'Mudah memar')] }),
          checkin({ tanggal: '2026-07-25', gejala: [gejala('darah', 'Mudah memar')] }),
        ],
        klinis: klinis({ organ: ['mukokutan'] }),
      })
    );
    expect(r.gejala.menetap.map((g) => g.item)).toContain('Mudah memar');
    expect(r.sistemBelumTercatat).toEqual([{ sistemLabel: 'Darah', items: ['Mudah memar'] }]);
  });

  it('muncul di teks bagian 2 sebagai satu baris, bukan penanda per gejala', () => {
    const teks = ringkasanTeks(
      buatRingkasan(input({ checkins, klinis: klinis({ organ: ['mukokutan'] }) }))
    );
    expect(teks).toContain(
      'Di luar organ terlibat yang tercatat: Ginjal (Urin berbusa); Saraf (Kejang)'
    );
  });
});

// ---------- 2b. Gejala yang berhenti dilaporkan ----------

describe('gejala yang berhenti dilaporkan', () => {
  /** Check-in tanpa gejala apa pun pada tanggal tertentu. */
  const kosong = (tanggal: string) => checkin({ tanggal, gejala: [] });
  /** Check-in dengan satu gejala. */
  const dengan = (tanggal: string, system: string, item: string) =>
    checkin({ tanggal, gejala: [{ system, item, present: true }] });

  const cari = (r: ReturnType<typeof buatRingkasan>, item: string) =>
    [...r.gejala.baru, ...r.gejala.memburuk, ...r.gejala.menetap, ...r.gejala.membaik].find(
      (g) => g.item === item
    );

  it('gejala paruh kedua yang berhenti masuk Berkurang, bukan Baru muncul', () => {
    // Inilah cacatnya: `h.awal === 0` diperiksa sebelum perbandingan frekuensi,
    // sehingga gejala yang pertama muncul di paruh kedua tidak pernah bisa
    // keluar dari "Baru muncul" berapa lama pun sudah berhenti.
    const r = buatRingkasan(
      input({
        checkins: [
          kosong('2026-07-05'),
          kosong('2026-07-10'),
          dengan('2026-07-18', 'kulit', 'Ruam'),
          kosong('2026-07-22'),
          kosong('2026-07-25'),
          kosong('2026-07-28'),
          kosong('2026-07-30'),
        ],
      })
    );
    expect(r.gejala.baru.map((g) => g.item)).not.toContain('Ruam');
    expect(r.gejala.membaik.map((g) => g.item)).toContain('Ruam');
  });

  it('gejala paruh kedua yang MASIH dilaporkan tetap Baru muncul', () => {
    const r = buatRingkasan(
      input({
        checkins: [
          kosong('2026-07-05'),
          kosong('2026-07-10'),
          dengan('2026-07-29', 'konstitusional', 'Demam'),
          dengan('2026-07-30', 'konstitusional', 'Demam'),
        ],
      })
    );
    expect(r.gejala.baru.map((g) => g.item)).toContain('Demam');
  });

  it('berhenti check-in TIDAK membuat gejala dianggap berkurang', () => {
    // Tidak adanya data bukan tidak adanya gejala. Pasien yang berhenti
    // mengisi harus tetap tampil dengan keluhan terakhirnya.
    const r = buatRingkasan(
      input({
        checkins: [
          kosong('2026-07-05'),
          kosong('2026-07-10'),
          dengan('2026-07-18', 'kulit', 'Ruam'),
        ],
      })
    );
    expect(r.gejala.membaik.map((g) => g.item)).not.toContain('Ruam');
    expect(cari(r, 'Ruam')?.checkinSesudahnya).toBe(0);
  });

  it('butuh tiga check-in tanpa keluhan, dua belum cukup', () => {
    // Ambang tiga menahan kategori berpindah-pindah antar-kunjungan tanpa
    // sebab klinis.
    const dua = buatRingkasan(
      input({
        checkins: [
          kosong('2026-07-05'),
          kosong('2026-07-10'),
          dengan('2026-07-20', 'kulit', 'Ruam'),
          kosong('2026-07-25'),
          kosong('2026-07-28'),
        ],
      })
    );
    expect(dua.gejala.baru.map((g) => g.item)).toContain('Ruam');
    expect(cari(dua, 'Ruam')?.checkinSesudahnya).toBe(2);
  });

  it('mencatat tanggal terakhir dilaporkan, bukan tanggal pertama', () => {
    const r = buatRingkasan(
      input({
        checkins: [
          dengan('2026-07-03', 'sendi', 'Nyeri sendi'),
          dengan('2026-07-11', 'sendi', 'Nyeri sendi'),
          dengan('2026-07-26', 'sendi', 'Nyeri sendi'),
        ],
      })
    );
    expect(cari(r, 'Nyeri sendi')?.terakhir).toBe('2026-07-26');
  });

  it('tanggal terakhir benar walau urutan barisnya acak', () => {
    const r = buatRingkasan(
      input({
        checkins: [
          dengan('2026-07-26', 'sendi', 'Nyeri sendi'),
          dengan('2026-07-03', 'sendi', 'Nyeri sendi'),
          dengan('2026-07-11', 'sendi', 'Nyeri sendi'),
        ],
      })
    );
    expect(cari(r, 'Nyeri sendi')?.terakhir).toBe('2026-07-26');
  });

  it('teksnya menyebut tanggal terakhir dan jumlah check-in sesudahnya', () => {
    const teks = ringkasanTeks(
      buatRingkasan(
        input({
          checkins: [
            kosong('2026-07-05'),
            kosong('2026-07-10'),
            dengan('2026-07-18', 'kulit', 'Ruam'),
            kosong('2026-07-25'),
            kosong('2026-07-28'),
            kosong('2026-07-30'),
          ],
        })
      )
    );
    expect(teks).toContain('terakhir 18 Jul 2026');
    expect(teks).toContain('3 check-in sesudahnya tanpa keluhan ini');
  });

  it('gejala yang masih berlangsung tidak diberi embel-embel sesudahnya', () => {
    const teks = ringkasanTeks(
      buatRingkasan(
        input({
          checkins: [
            dengan('2026-07-05', 'sendi', 'Nyeri sendi'),
            dengan('2026-07-30', 'sendi', 'Nyeri sendi'),
          ],
        })
      )
    );
    expect(teks).toContain('terakhir 30 Jul 2026');
    expect(teks).not.toContain('check-in sesudahnya');
  });
});
