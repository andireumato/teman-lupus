import { rakitEkspor, type BerkasCsv, type DataEkspor } from '@/lib/ekspor';
import type {
  Alert,
  AlertTindakLanjut,
  DailyCheckin,
  FlareCheck,
  LupusQolAssessment,
  Patient,
  SledaiAssessment,
} from '@/types/database';

const P1 = '0f8c1a2b-3d4e-5f60-7181-92a3b4c5d6e7'; // kode 0f8c1a2b
const P2 = 'aaaabbbb-cccc-dddd-eeee-ffff00001111'; // kode aaaabbbb

function pasien(p: Partial<Patient> = {}): Patient {
  return {
    id: P1,
    profile_id: 'prof-1',
    doctor_id: 'dok-1',
    tgl_lahir: '1991-09-14',
    jenis_kelamin: 'perempuan',
    tgl_diagnosis: '2022-05-10',
    klasifikasi: 'EULAR/ACR 2019',
    organ_terlibat: ['ginjal', 'mukokutan'],
    created_at: '2026-01-01T00:00:00+07:00',
    ...p,
  };
}

let seq = 0;
function sledai(p: Partial<SledaiAssessment> = {}): SledaiAssessment {
  return {
    id: `s-${++seq}`,
    patient_id: P1,
    doctor_id: 'dok-1',
    tanggal: '2026-07-30',
    deskriptor: {},
    total: 0,
    kategori: 'Remisi',
    pga: 0,
    gc_mg: 0,
    terapi_stabil: true,
    created_at: '2026-07-30T08:00:00+07:00',
    ...p,
  };
}

function checkin(p: Partial<DailyCheckin> & { tanggal: string }): DailyCheckin {
  return {
    id: `c-${++seq}`,
    patient_id: P1,
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

function data(d: Partial<DataEkspor> = {}): DataEkspor {
  return {
    pasien: [pasien()],
    sledai: [],
    checkins: [],
    meds: [],
    medLogs: [],
    efekSamping: [],
    alerts: [],
    tindakLanjut: [],
    lupusqol: [],
    mars: [],
    flares: [],
    labs: [],
    visits: [],
    tanggal: '2026-07-30',
    ...d,
  };
}

const ambil = (berkas: BerkasCsv[], nama: string) => berkas.find((b) => b.nama === nama)!;
/** Baris tanpa BOM, tanpa baris kosong di ujung. */
const baris = (b: BerkasCsv) => b.isi.replace('﻿', '').trimEnd().split('\r\n');

describe('privasi — apa yang TIDAK boleh keluar', () => {
  it('tidak ada nama pasien di berkas mana pun', () => {
    const berkas = rakitEkspor(
      data({
        sledai: [sledai()],
        checkins: [checkin({ tanggal: '2026-07-29', catatan: 'ditemani Ibu Sri ke IGD' })],
      })
    );
    for (const b of berkas) {
      expect(b.isi).not.toMatch(/nama_pasien|profile_id/);
    }
  });

  it('tanggal lahir & tanggal diagnosis TIDAK diekspor, hanya durasinya', () => {
    const p = ambil(rakitEkspor(data()), 'pasien.csv');
    expect(p.isi).not.toContain('1991-09-14');
    expect(p.isi).not.toContain('2022-05-10');
    expect(baris(p)[0]).toBe(
      'kode,jenis_kelamin,usia_tahun,lama_sakit_bulan,klasifikasi,organ_terlibat'
    );
    expect(baris(p)[1]).toBe('0f8c1a2b,perempuan,34,50,EULAR/ACR 2019,ginjal;mukokutan');
  });

  it('teks catatan pasien tidak ikut, hanya penandanya', () => {
    // Catatan bebas sering menyebut nama orang, tempat, dan peristiwa.
    const c = ambil(
      rakitEkspor(
        data({ checkins: [checkin({ tanggal: '2026-07-29', catatan: 'ditemani Ibu Sri' })] })
      ),
      'checkin.csv'
    );
    expect(c.isi).not.toContain('Ibu Sri');
    expect(baris(c)[1]).toMatch(/,1$/); // ada_catatan = 1
  });

  it('catatan kosong ditandai 0, bukan 1', () => {
    const c = ambil(
      rakitEkspor(data({ checkins: [checkin({ tanggal: '2026-07-29', catatan: '   ' })] })),
      'checkin.csv'
    );
    expect(baris(c)[1]).toMatch(/,0$/);
  });
});

describe('kode pasien', () => {
  it('delapan karakter pertama UUID, sama dengan yang tampil di ringkasan', () => {
    const p = ambil(rakitEkspor(data()), 'pasien.csv');
    expect(baris(p)[1].startsWith('0f8c1a2b,')).toBe(true);
  });

  it('konsisten antar berkas untuk pasien yang sama', () => {
    const berkas = rakitEkspor(
      data({ sledai: [sledai()], checkins: [checkin({ tanggal: '2026-07-29' })] })
    );
    for (const nama of ['pasien.csv', 'sledai.csv', 'checkin.csv']) {
      expect(baris(ambil(berkas, nama))[1].startsWith('0f8c1a2b,')).toBe(true);
    }
  });

  it('konsisten antar dua ekspor yang dijalankan terpisah', () => {
    // Kode diturunkan dari id yang tidak pernah berubah, jadi konsistensinya
    // akibat, bukan janji — tidak ada tabel pemetaan yang bisa hilang.
    const a = ambil(rakitEkspor(data()), 'pasien.csv').isi;
    const b = ambil(rakitEkspor(data()), 'pasien.csv').isi;
    expect(a).toBe(b);
  });
});

describe('sledai.csv', () => {
  it('memuat satu kolom 0/1 per deskriptor, plus skor & target', () => {
    const b = ambil(
      rakitEkspor(data({ sledai: [sledai({ deskriptor: { artritis: true } })] })),
      'sledai.csv'
    );
    const judul = baris(b)[0].split(',');
    expect(judul.slice(0, 10)).toEqual([
      'kode',
      'tanggal',
      'sledai_2k',
      'kategori',
      'csledai_2k',
      'pga',
      'gc_mg_setara_prednison',
      'terapi_stabil',
      'doris_2021',
      'lldas',
    ]);
    expect(judul).toContain('d_artritis');
    expect(judul).toContain('d_kejang');
    const nilai = baris(b)[1].split(',');
    expect(nilai[judul.indexOf('d_artritis')]).toBe('1');
    expect(nilai[judul.indexOf('d_kejang')]).toBe('0');
  });

  it('csledai mengeluarkan deskriptor serologi', () => {
    const b = ambil(
      rakitEkspor(data({ sledai: [sledai({ deskriptor: { komplemen_rendah: true }, total: 2 })] })),
      'sledai.csv'
    );
    const judul = baris(b)[0].split(',');
    const nilai = baris(b)[1].split(',');
    expect(nilai[judul.indexOf('sledai_2k')]).toBe('2');
    expect(nilai[judul.indexOf('csledai_2k')]).toBe('0');
  });

  it('penilaian PERTAMA tiap pasien dinilai tanpa pembanding, bukan "belum diambil"', () => {
    // Kalau ketiadaan pembanding dianggap data kurang, tidak ada penilaian
    // pertama yang pernah bisa berstatus tercapai.
    const b = ambil(rakitEkspor(data({ sledai: [sledai()] })), 'sledai.csv');
    const judul = baris(b)[0].split(',');
    expect(baris(b)[1].split(',')[judul.indexOf('lldas')]).toBe('tercapai');
  });

  it('penilaian kedua dibandingkan dengan yang sebelumnya, per pasien', () => {
    const b = ambil(
      rakitEkspor(
        data({
          sledai: [
            sledai({ tanggal: '2026-07-01', deskriptor: {} }),
            sledai({ tanggal: '2026-07-30', deskriptor: { ruam: true }, total: 2 }),
          ],
        })
      ),
      'sledai.csv'
    );
    const judul = baris(b)[0].split(',');
    // Ruam baru sejak kunjungan lalu → LLDAS gagal meski skornya hanya 2.
    expect(baris(b)[2].split(',')[judul.indexOf('lldas')]).toBe('tidak');
  });

  it('pembanding tidak bocor antar pasien', () => {
    const b = ambil(
      rakitEkspor(
        data({
          pasien: [pasien(), pasien({ id: P2 })],
          sledai: [
            sledai({ patient_id: P1, tanggal: '2026-07-01', deskriptor: { ruam: true }, total: 2 }),
            sledai({ patient_id: P2, tanggal: '2026-07-30', deskriptor: { ruam: true }, total: 2 }),
          ],
        })
      ),
      'sledai.csv'
    );
    const judul = baris(b)[0].split(',');
    // Keduanya penilaian PERTAMA bagi pasiennya masing-masing.
    for (const r of baris(b).slice(1)) {
      expect(r.split(',')[judul.indexOf('lldas')]).toBe('tercapai');
    }
  });

  it('baris warisan berformat larik tidak melempar dan tidak diklaim tercapai', () => {
    const b = ambil(
      rakitEkspor(data({ sledai: [sledai({ deskriptor: ['Ruam', 'Artritis'], total: 6 })] })),
      'sledai.csv'
    );
    const judul = baris(b)[0].split(',');
    expect(baris(b)[1].split(',')[judul.indexOf('doris_2021')]).toBe('belum-lengkap');
  });
});

describe('gejala.csv — bentuk panjang', () => {
  it('satu baris per gejala per hari', () => {
    const b = ambil(
      rakitEkspor(
        data({
          checkins: [
            checkin({
              tanggal: '2026-07-29',
              gejala: [
                { system: 'sendi', item: 'Nyeri sendi', present: true },
                { system: 'kulit', item: 'Sariawan', present: true },
                { system: 'kulit', item: 'Rambut rontok', present: false },
              ],
            }),
          ],
        })
      ),
      'gejala.csv'
    );
    expect(b.baris).toBe(2);
    expect(baris(b)).toContain('0f8c1a2b,2026-07-29,kulit,Sariawan');
    expect(b.isi).not.toContain('Rambut rontok');
  });
});

describe('berkas & urutan', () => {
  it('semua tabel selalu ada, bahkan saat kosong', () => {
    // Berkas yang hilang tidak bisa dibedakan dari ekspor yang gagal separuh.
    const nama = rakitEkspor(data({ pasien: [] })).map((b) => b.nama);
    expect(nama).toEqual([
      'pasien.csv',
      'sledai.csv',
      'checkin.csv',
      'gejala.csv',
      'obat.csv',
      'dosis.csv',
      'efek_samping.csv',
      'mars.csv',
      'cek_flare.csv',
      'lab.csv',
      'kunjungan.csv',
      'lupusqol.csv',
      'keterangan.csv',
    ]);
    for (const b of rakitEkspor(data({ pasien: [] }))) {
      expect(baris(b)[0]).toBeTruthy();
    }
  });

  it('urutan barisnya stabil, supaya dua ekspor bisa dibandingkan', () => {
    const acak = data({
      pasien: [pasien({ id: P2 }), pasien()],
      checkins: [checkin({ tanggal: '2026-07-30' }), checkin({ tanggal: '2026-07-01' })],
    });
    const b = ambil(rakitEkspor(acak), 'checkin.csv');
    expect(
      baris(b)
        .slice(1)
        .map((r) => r.split(',')[1])
    ).toEqual(['2026-07-01', '2026-07-30']);
  });

  it('keterangan.csv mencatat asal-usul yang tidak boleh diingat-ingat', () => {
    const k = ambil(rakitEkspor(data()), 'keterangan.csv').isi;
    expect(k).toContain('jendela_sledai');
    expect(k).toContain('10 hari terakhir');
    expect(k).toContain('tanpa nama');
    expect(k).toMatch(/PMID 34819388/);
  });
});

describe('dosis.csv', () => {
  it('dosis_ke dinaikkan jadi berbasis 1 — "dosis ke-0" tak berarti bagi pembaca', () => {
    const b = ambil(
      rakitEkspor(
        data({
          medLogs: [
            {
              id: 'l1',
              patient_id: P1,
              medication_id: 'm1',
              tanggal: '2026-07-30',
              slot: 0,
              diminum: true,
              alasan: null,
              created_at: '2026-07-30T08:00:00+07:00',
            },
          ],
        })
      ),
      'dosis.csv'
    );
    expect(baris(b)[1].split(',')[4]).toBe('1');
  });
});

describe('cek_flare.csv — keluaran sesudah red-flag', () => {
  const flare = (id: string, waktu: string, hasil: FlareCheck['hasil']): FlareCheck => ({
    id,
    patient_id: P1,
    waktu,
    tanda_bahaya: null,
    gejala: null,
    hasil,
  });

  const peringatan = (id: string, flareId: string, dibuat: string): Alert => ({
    id,
    patient_id: P1,
    flare_check_id: flareId,
    jenis: 'flare_darurat',
    pesan: null,
    selesai: true,
    created_at: dibuat,
  });

  const lanjut = (
    alertId: string,
    dibuat: string,
    p: Partial<AlertTindakLanjut> = {}
  ): AlertTindakLanjut => ({
    id: `tl-${alertId}`,
    alert_id: alertId,
    doctor_id: 'd1',
    tindakan: 'obat_disesuaikan',
    kondisi: 'masih_bergejala',
    catatan: null,
    dibuat_pada: dibuat,
    ...p,
  });

  /** Sel-sel tindak lanjut: tindakan, kondisi, jam. */
  const keluaran = (b: BerkasCsv) =>
    baris(b)
      .slice(1)
      .map((r) => r.split(',').slice(5, 8));

  it('mengisi tiga kolom keluaran dari tindak lanjut yang tertaut', () => {
    const b = ambil(
      rakitEkspor(
        data({
          flares: [flare('f1', '2026-07-05T10:00:00+07:00', 'red')],
          alerts: [peringatan('a1', 'f1', '2026-07-05T10:00:00+07:00')],
          tindakLanjut: [lanjut('a1', '2026-07-05T14:30:00+07:00')],
        })
      ),
      'cek_flare.csv'
    );
    expect(baris(b)[0]).toContain('tindakan_dokter,kondisi_pasien,jam_ke_tindak_lanjut');
    expect(keluaran(b)).toEqual([['obat_disesuaikan', 'masih_bergejala', '4.5']]);
  });

  it('cek flare tanpa tindak lanjut menyisakan sel kosong, bukan nol', () => {
    // Nol berarti "ditindaklanjuti seketika". Kosong berarti belum sama sekali.
    const b = ambil(
      rakitEkspor(data({ flares: [flare('f1', '2026-07-05T10:00:00+07:00', 'red')] })),
      'cek_flare.csv'
    );
    expect(keluaran(b)).toEqual([['', '', '']]);
  });

  it('menautkan lewat id, bukan waktu, saat dua cek flare berbarengan', () => {
    // Dua cek flare pada detik yang sama. Pasangan yang tertukar akan
    // mengarang keluaran klinis di data penelitian.
    const b = ambil(
      rakitEkspor(
        data({
          flares: [
            flare('f1', '2026-07-05T10:00:00+07:00', 'red'),
            flare('f2', '2026-07-05T10:00:00+07:00', 'yellow'),
          ],
          alerts: [
            peringatan('a1', 'f1', '2026-07-05T10:00:00+07:00'),
            peringatan('a2', 'f2', '2026-07-05T10:00:00+07:00'),
          ],
          tindakLanjut: [
            lanjut('a1', '2026-07-05T11:00:00+07:00', { tindakan: 'dirujuk' }),
            lanjut('a2', '2026-07-05T12:00:00+07:00', { tindakan: 'edukasi' }),
          ],
        })
      ),
      'cek_flare.csv'
    );
    const perHasil = new Map(
      baris(b)
        .slice(1)
        .map((r) => r.split(','))
        .map((sel) => [sel[2], sel[5]])
    );
    expect(perHasil.get('red')).toBe('dirujuk');
    expect(perHasil.get('yellow')).toBe('edukasi');
  });

  it('tidak pernah mengekspor catatan pribadi dokter', () => {
    const berkas = rakitEkspor(
      data({
        flares: [flare('f1', '2026-07-05T10:00:00+07:00', 'red')],
        alerts: [peringatan('a1', 'f1', '2026-07-05T10:00:00+07:00')],
        tindakLanjut: [
          lanjut('a1', '2026-07-05T11:00:00+07:00', { catatan: 'RAHASIA curiga tidak patuh' }),
        ],
      })
    );
    for (const b of berkas) expect(b.isi).not.toContain('RAHASIA');
  });

  it('jam negatif jadi kosong, bukan angka yang tampak sah', () => {
    // Tindak lanjut tercatat SEBELUM peringatannya terbit hanya mungkin kalau
    // jamnya salah; "-3.0" akan terbaca seperti respons luar biasa cepat.
    const b = ambil(
      rakitEkspor(
        data({
          flares: [flare('f1', '2026-07-05T10:00:00+07:00', 'red')],
          alerts: [peringatan('a1', 'f1', '2026-07-05T13:00:00+07:00')],
          tindakLanjut: [lanjut('a1', '2026-07-05T10:00:00+07:00')],
        })
      ),
      'cek_flare.csv'
    );
    expect(keluaran(b)[0][2]).toBe('');
  });
});

describe('lupusqol.csv', () => {
  const qol = (
    jawaban: Record<string, number> | null,
    p: Partial<LupusQolAssessment> = {}
  ): LupusQolAssessment => ({
    id: `q-${++seq}`,
    patient_id: P1,
    tanggal: '2026-07-30',
    jawaban,
    tak_berlaku: [],
    created_at: '2026-07-30T08:00:00+07:00',
    ...p,
  });

  const kolom = (b: BerkasCsv) => baris(b)[0].split(',');
  const sel = (b: BerkasCsv, judul: string, r = 1) =>
    baris(b)[r].split(',')[kolom(b).indexOf(judul)];

  it('satu kolom skor dan satu kolom kelengkapan per domain', () => {
    const b = ambil(rakitEkspor(data({ lupusqol: [qol({})] })), 'lupusqol.csv');
    const j = kolom(b);
    for (const d of ['fisik', 'nyeri', 'perencanaan', 'intim', 'beban', 'emosi', 'kelelahan']) {
      expect(j).toContain(d);
      expect(j).toContain(`${d}_terjawab`);
    }
    expect(j).toContain('citra_tubuh');
    expect(j).toContain('citra_tubuh_terjawab');
  });

  it('skor domain 0-100 dihitung dari jawaban, bukan dibaca dari kolom tersimpan', () => {
    // Skor sengaja TIDAK disimpan di database; kalau perhitungannya lepas dari
    // jawabannya, kolom ini yang pertama menunjukkannya.
    const b = ambil(
      rakitEkspor(data({ lupusqol: [qol({ nyeri_1: 4, nyeri_2: 2, nyeri_3: 0 })] })),
      'lupusqol.csv'
    );
    expect(sel(b, 'nyeri')).toBe('50');
    expect(sel(b, 'nyeri_terjawab')).toBe('3');
  });

  it('domain tanpa jawaban kosong, bukan nol', () => {
    // Nol berarti kualitas hidup terburuk; kosong berarti tidak ditanyakan.
    const b = ambil(rakitEkspor(data({ lupusqol: [qol({ nyeri_1: 4 })] })), 'lupusqol.csv');
    expect(sel(b, 'intim')).toBe('');
    expect(sel(b, 'intim_terjawab')).toBe('0');
  });

  it('penyebutnya ikut, jadi 100 dari satu butir bisa dibedakan dari 100 dari tiga', () => {
    const b = ambil(rakitEkspor(data({ lupusqol: [qol({ nyeri_1: 4 })] })), 'lupusqol.csv');
    expect(sel(b, 'nyeri')).toBe('100');
    expect(sel(b, 'nyeri_terjawab')).toBe('1');
  });

  it('jawaban null tidak melempar', () => {
    // Baris yang tersimpan sebelum kolomnya terisi.
    const b = ambil(rakitEkspor(data({ lupusqol: [qol(null)] })), 'lupusqol.csv');
    expect(sel(b, 'butir_terjawab')).toBe('0');
  });

  it('mencatat berapa butir ditandai tidak berlaku', () => {
    const b = ambil(
      rakitEkspor(data({ lupusqol: [qol({}, { tak_berlaku: ['intim_1', 'intim_2'] })] })),
      'lupusqol.csv'
    );
    expect(sel(b, 'jumlah_tak_berlaku')).toBe('2');
  });

  it('keterangan.csv mencatat arah skalanya', () => {
    // Arah LupusQoL berlawanan dengan SLEDAI-2K; tanpa dicatat, grafiknya
    // gampang dibaca terbalik enam bulan kemudian.
    const k = ambil(rakitEkspor(data()), 'keterangan.csv').isi;
    expect(k).toContain('makin tinggi makin BAIK');
    expect(k).toContain('Anindito');
    expect(k).toContain('lupusqol_tanpa_skor_total');
  });
});
