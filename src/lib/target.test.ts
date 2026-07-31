import { SLEDAI_DESKRIPTOR, SLEDAI_ORGAN_MAYOR, SLEDAI_SEROLOGI } from '@/constants/sledai';
import { scoreSledai } from '@/lib/sledai';
import {
  bacaAngka,
  deskriptorAktif,
  kelengkapanTarget,
  nilaiDoris,
  nilaiLldas,
  organMayorAktif,
  penilaianSebelum,
  skorKlinis,
  type PenilaianTarget,
} from '@/lib/target';

/** Penilaian yang MEMENUHI keduanya; tiap tes merusak satu syarat saja. */
function dasar(p: Partial<PenilaianTarget> = {}): PenilaianTarget {
  return {
    deskriptor: {},
    pga: 0,
    gcMg: 0,
    terapiStabil: true,
    sebelumnya: null,
    ...p,
  };
}

describe('daftar kunci di constants', () => {
  it('semua kunci serologi & organ mayor benar-benar ada sebagai deskriptor', () => {
    // Kunci yang salah ketik tidak akan pernah cocok, dan syaratnya diam-diam
    // berhenti bekerja tanpa satu pun galat.
    const sah = new Set(SLEDAI_DESKRIPTOR.map((d) => d.key));
    for (const k of [...SLEDAI_SEROLOGI, ...SLEDAI_ORGAN_MAYOR]) {
      expect(sah.has(k)).toBe(true);
    }
  });

  it('serologi tepat dua: komplemen & ikatan DNA', () => {
    expect([...SLEDAI_SEROLOGI].sort()).toEqual(['dna_meningkat', 'komplemen_rendah']);
  });

  it('organ mayor tidak memuat deskriptor yang bukan organ mayor menurut LLDAS', () => {
    for (const k of ['artritis', 'miositis', 'ruam', 'alopesia', 'ulkus_mukosa', 'leukopenia']) {
      expect(SLEDAI_ORGAN_MAYOR.has(k)).toBe(false);
    }
  });
});

describe('skorKlinis (cSLEDAI-2K)', () => {
  it('mengeluarkan bobot serologi dari total', () => {
    const d = { komplemen_rendah: true, dna_meningkat: true };
    expect(scoreSledai(d).total).toBe(4);
    expect(skorKlinis(d)).toBe(0);
  });

  it('mempertahankan bobot klinis apa adanya', () => {
    expect(skorKlinis({ artritis: true, demam: true })).toBe(5);
  });

  it('nol untuk penilaian kosong', () => {
    expect(skorKlinis({})).toBe(0);
  });

  it('deskriptor bernilai false tidak dihitung', () => {
    expect(skorKlinis({ artritis: false })).toBe(0);
  });
});

describe('organMayorAktif', () => {
  it('mengenali ginjal, SSP, kardiopulmoner, vaskulitis, dan demam', () => {
    expect(organMayorAktif({ proteinuria: true })).toEqual(['Proteinuria > 0,5 g/hari']);
    expect(organMayorAktif({ kejang: true })).toEqual(['Kejang']);
    expect(organMayorAktif({ pleuritis: true })).toEqual(['Pleuritis']);
    expect(organMayorAktif({ vaskulitis: true })).toEqual(['Vaskulitis']);
    expect(organMayorAktif({ demam: true })).toEqual(['Demam']);
  });

  it('artritis dan ruam bukan organ mayor', () => {
    expect(organMayorAktif({ artritis: true, ruam: true })).toEqual([]);
  });
});

describe('DORIS 2021', () => {
  it('tercapai saat semua syarat terpenuhi', () => {
    const r = nilaiDoris(dasar());
    expect(r.status).toBe('tercapai');
    expect(r.gagal).toEqual([]);
    expect(r.kurang).toEqual([]);
    expect(r.kriteria.every((k) => k.status === 'ya')).toBe(true);
  });

  it('aktivitas serologis saja TIDAK menggagalkan remisi', () => {
    // Inti cSLEDAI-2K: pasien boleh remisi meski komplemen rendah dan
    // anti-dsDNA meningkat, asalkan tidak ada gejala klinis.
    const r = nilaiDoris(dasar({ deskriptor: { komplemen_rendah: true, dna_meningkat: true } }));
    expect(r.status).toBe('tercapai');
  });

  it('satu gejala klinis sekecil apa pun menggagalkan', () => {
    const r = nilaiDoris(dasar({ deskriptor: { leukopenia: true } }));
    expect(r.status).toBe('tidak');
    expect(r.gagal[0]).toBe('clinical SLEDAI-2K = 0 (sekarang 1)');
  });

  it('PGA tepat 0,5 menggagalkan — syaratnya < 0,5, bukan ≤', () => {
    expect(nilaiDoris(dasar({ pga: 0.4 })).status).toBe('tercapai');
    expect(nilaiDoris(dasar({ pga: 0.5 })).status).toBe('tidak');
  });

  it('glukokortikoid tepat 5 mg masih memenuhi — syaratnya ≤ 5', () => {
    expect(nilaiDoris(dasar({ gcMg: 5 })).status).toBe('tercapai');
    expect(nilaiDoris(dasar({ gcMg: 5.1 })).status).toBe('tidak');
  });

  it('terapi yang belum stabil menggagalkan', () => {
    expect(nilaiDoris(dasar({ terapiStabil: false })).status).toBe('tidak');
  });
});

describe('LLDAS', () => {
  it('tercapai saat semua syarat terpenuhi', () => {
    expect(nilaiLldas(dasar()).status).toBe('tercapai');
  });

  it('SLEDAI-2K sampai 4 masih memenuhi', () => {
    // Artritis berbobot 4 dan bukan organ mayor: kasus batas yang tepat.
    expect(nilaiLldas(dasar({ deskriptor: { artritis: true } })).status).toBe('tercapai');
  });

  it('SLEDAI-2K 5 tidak memenuhi', () => {
    const r = nilaiLldas(dasar({ deskriptor: { artritis: true, leukopenia: true } }));
    expect(r.status).toBe('tidak');
    expect(r.gagal[0]).toBe('SLEDAI-2K ≤ 4 (sekarang 5)');
  });

  it('organ mayor menggagalkan meski skornya rendah', () => {
    // Demam hanya berbobot 1 — jauh di bawah ambang 4 — tetapi ia organ mayor.
    // Tanpa pemeriksaan terpisah ini, pasien demam akan lolos LLDAS.
    const r = nilaiLldas(dasar({ deskriptor: { demam: true } }));
    expect(r.status).toBe('tidak');
    expect(r.gagal).toContain('Tanpa aktivitas organ mayor (Demam)');
  });

  it('PGA tepat 1 masih memenuhi — syaratnya ≤ 1', () => {
    expect(nilaiLldas(dasar({ pga: 1 })).status).toBe('tercapai');
    expect(nilaiLldas(dasar({ pga: 1.1 })).status).toBe('tidak');
  });

  it('glukokortikoid tepat 7,5 mg masih memenuhi', () => {
    expect(nilaiLldas(dasar({ gcMg: 7.5 })).status).toBe('tercapai');
    expect(nilaiLldas(dasar({ gcMg: 8 })).status).toBe('tidak');
  });

  it('deskriptor baru sejak kunjungan lalu menggagalkan', () => {
    const r = nilaiLldas(
      dasar({ deskriptor: { artritis: true }, sebelumnya: { ruam: true, alopesia: true } })
    );
    expect(r.status).toBe('tidak');
    expect(r.gagal).toContain('Tanpa aktivitas baru sejak kunjungan lalu (Artritis)');
  });

  it('deskriptor yang MENETAP dari kunjungan lalu tidak dianggap baru', () => {
    const r = nilaiLldas(dasar({ deskriptor: { artritis: true }, sebelumnya: { artritis: true } }));
    expect(r.status).toBe('tercapai');
  });

  it('deskriptor yang HILANG sejak kunjungan lalu jelas tidak menggagalkan', () => {
    const r = nilaiLldas(dasar({ deskriptor: {}, sebelumnya: { artritis: true } }));
    expect(r.status).toBe('tercapai');
  });

  it('penilaian pertama tidak dihukum karena tidak punya pembanding', () => {
    // Kalau ketiadaan pembanding dianggap gagal, tidak akan ada pasien baru
    // yang pernah bisa masuk LLDAS.
    expect(nilaiLldas(dasar({ sebelumnya: null })).status).toBe('tercapai');
  });

  it('pembanding yang belum diambil dilaporkan kurang, bukan gagal', () => {
    const r = nilaiLldas(dasar({ sebelumnya: undefined }));
    expect(r.status).toBe('belum-lengkap');
    expect(r.kurang).toContain(
      'Tanpa aktivitas baru sejak kunjungan lalu (penilaian sebelumnya belum diambil)'
    );
  });
});

describe('data yang belum lengkap tidak sama dengan target yang gagal', () => {
  it('PGA kosong → belum-lengkap, bukan tidak tercapai', () => {
    // Menyamakan keduanya akan meremehkan angka pencapaian di seluruh kohort.
    const r = nilaiDoris(dasar({ pga: null }));
    expect(r.status).toBe('belum-lengkap');
    expect(r.kurang).toEqual(['PGA < 0,5']);
    expect(r.gagal).toEqual([]);
  });

  it('semua data tambahan kosong → tiga hal yang kurang disebutkan', () => {
    const r = nilaiLldas(dasar({ pga: null, gcMg: null, terapiStabil: null }));
    expect(r.status).toBe('belum-lengkap');
    expect(r.kurang).toEqual([
      'PGA ≤ 1',
      'Glukokortikoid ≤ 7,5 mg/hari',
      'Imunosupresan & biologik dosis pemeliharaan',
    ]);
  });

  it('syarat yang sudah pasti gagal mengalahkan data yang belum lengkap', () => {
    // cSLEDAI-2K 8 tidak akan memenuhi DORIS berapa pun PGA-nya, jadi
    // menyebutnya "belum bisa dinilai" menyembunyikan jawaban yang sudah jelas.
    const r = nilaiDoris(dasar({ deskriptor: { kejang: true }, pga: null, gcMg: null }));
    expect(r.status).toBe('tidak');
    expect(r.gagal[0]).toBe('clinical SLEDAI-2K = 0 (sekarang 8)');
  });
});

describe('deskriptorAktif', () => {
  it('hanya yang true, urut, supaya bisa dibandingkan antar kunjungan', () => {
    expect(deskriptorAktif({ ruam: true, artritis: true, demam: false })).toEqual([
      'artritis',
      'ruam',
    ]);
  });

  it('aman untuk null & undefined', () => {
    expect(deskriptorAktif(null)).toEqual([]);
    expect(deskriptorAktif(undefined)).toEqual([]);
  });
});

describe('bacaAngka', () => {
  it('menerima koma desimal — papan ketik Indonesia memberi koma', () => {
    // Number('0,5') adalah NaN. Tanpa penanganan ini, PGA 0,5 tersimpan
    // kosong dan pasien tampak "belum dinilai" padahal sudah.
    expect(bacaAngka('0,5')).toBe(0.5);
    expect(bacaAngka('0.5')).toBe(0.5);
    expect(bacaAngka('7,5')).toBe(7.5);
  });

  it('kosong berarti belum diisi, bukan nol', () => {
    expect(bacaAngka('')).toBeNull();
    expect(bacaAngka('   ')).toBeNull();
  });

  it('membedakan salah ketik dari kosong', () => {
    expect(bacaAngka('dua')).toBeUndefined();
    expect(bacaAngka('0,5,1')).toBeUndefined();
    expect(bacaAngka('-1')).toBeUndefined();
  });

  it('bilangan bulat tetap terbaca', () => {
    expect(bacaAngka('0')).toBe(0);
    expect(bacaAngka(' 12 ')).toBe(12);
  });
});

describe('baris warisan prototipe web (label dipakai sebagai kunci)', () => {
  // Empat baris di database menyimpan 'Ruam' alih-alih 'ruam'. Sebelum ini,
  // scoreSledai melempar dan seluruh layar detail pasien ikut jatuh.
  const warisan = { Ruam: true, Artritis: true };

  it('tidak melempar — satu baris lama tidak boleh menjatuhkan layar', () => {
    expect(() => nilaiDoris(dasar({ deskriptor: warisan }))).not.toThrow();
    expect(() => nilaiLldas(dasar({ deskriptor: warisan }))).not.toThrow();
    expect(() => skorKlinis(warisan)).not.toThrow();
  });

  it('TIDAK pernah dilaporkan tercapai — kunci asing bisa saja vaskulitis', () => {
    const d = nilaiDoris(dasar({ deskriptor: warisan }));
    expect(d.status).toBe('belum-lengkap');
    expect(d.kurang).toContain('deskriptor format lama: Artritis, Ruam');

    const l = nilaiLldas(dasar({ deskriptor: warisan }));
    expect(l.status).toBe('belum-lengkap');
  });

  it('kegagalan yang sudah pasti tetap dilaporkan gagal', () => {
    // Kunci asing hanya bisa MENAMBAH aktivitas. Kalau yang dikenal saja sudah
    // menggagalkan, hasilnya benar berapa pun isi kunci asingnya.
    const r = nilaiDoris(dasar({ deskriptor: { ...warisan, kejang: true } }));
    expect(r.status).toBe('tidak');
    expect(r.gagal[0]).toBe('clinical SLEDAI-2K = 0 (sekarang 8)');
  });

  it('kunci asing bernilai false diabaikan, bukan dilaporkan', () => {
    expect(nilaiDoris(dasar({ deskriptor: { Ruam: false } })).status).toBe('tercapai');
  });

  it('pembanding kunjungan lalu yang berformat lama tidak melempar', () => {
    const r = nilaiLldas(dasar({ deskriptor: { artritis: true }, sebelumnya: warisan }));
    expect(r.status).toBe('tidak');
    expect(r.gagal).toContain('Tanpa aktivitas baru sejak kunjungan lalu (Artritis)');
  });
});

describe('bentuk warisan berupa LARIK label', () => {
  // Bentuk sebenarnya di database: ["Vaskulitis", "Alopesia", ...].
  // Object.entries(["Ruam"]) menghasilkan [["0","Ruam"]] — nilainya STRING,
  // bukan true. Penanganan naif membuang isinya diam-diam, barisnya terbaca
  // kosong, dan DORIS melaporkan remisi untuk pasien vaskulitis.
  const larik = ['Vaskulitis', 'Alopesia', 'Komplemen rendah'];

  it('TIDAK terbaca kosong, dan tidak pernah dilaporkan remisi', () => {
    const r = nilaiDoris(dasar({ deskriptor: larik }));
    expect(r.status).not.toBe('tercapai');
    expect(r.status).toBe('belum-lengkap');
    expect(r.kurang[0]).toMatch(/format lama: Alopesia, Komplemen rendah, Vaskulitis/);
  });

  it('elemen yang kebetulan sudah berupa kunci sah tetap dihitung', () => {
    expect(skorKlinis(['vaskulitis'])).toBe(8);
    expect(organMayorAktif(['vaskulitis'])).toEqual(['Vaskulitis']);
  });

  it('larik kosong sama dengan tidak ada aktivitas', () => {
    expect(nilaiDoris(dasar({ deskriptor: [] })).status).toBe('tercapai');
  });

  it('larik sebagai pembanding kunjungan lalu tidak melempar', () => {
    expect(() =>
      nilaiLldas(dasar({ deskriptor: { artritis: true }, sebelumnya: larik }))
    ).not.toThrow();
  });
});

describe('daftar syarat — yang otomatis vs yang diisi dokter', () => {
  it('DORIS punya 4 syarat, hanya cSLEDAI-2K yang otomatis', () => {
    const k = nilaiDoris(dasar()).kriteria;
    expect(k.map((x) => x.label)).toEqual([
      'clinical SLEDAI-2K = 0',
      'PGA < 0,5',
      'Glukokortikoid ≤ 5 mg/hari',
      'Imunosupresan & biologik pada dosis stabil',
    ]);
    expect(k.filter((x) => x.otomatis).map((x) => x.label)).toEqual(['clinical SLEDAI-2K = 0']);
  });

  it('LLDAS punya 6 syarat, tiga di antaranya dari SLEDAI-2K', () => {
    const k = nilaiLldas(dasar()).kriteria;
    expect(k).toHaveLength(6);
    expect(k.filter((x) => x.otomatis).map((x) => x.label)).toEqual([
      'SLEDAI-2K ≤ 4',
      'Tanpa aktivitas organ mayor',
      'Tanpa aktivitas baru sejak kunjungan lalu',
    ]);
  });

  it('syarat menampilkan nilai yang membuatnya begitu', () => {
    const k = nilaiDoris(dasar({ deskriptor: { artritis: true }, pga: 1.5, gcMg: 10 })).kriteria;
    expect(k[0]).toMatchObject({ nilai: 'sekarang 4', status: 'tidak' });
    // Koma desimal, bukan titik — pembacanya dokter Indonesia.
    expect(k[1]).toMatchObject({ nilai: 'sekarang 1,5', status: 'tidak' });
    expect(k[2]).toMatchObject({ nilai: 'sekarang 10 mg', status: 'tidak' });
  });

  it('yang belum diisi berstatus "belum", bukan "tidak"', () => {
    const k = nilaiDoris(dasar({ pga: null, gcMg: null, terapiStabil: null })).kriteria;
    expect(k.slice(1).map((x) => x.status)).toEqual(['belum', 'belum', 'belum']);
    expect(k.slice(1).every((x) => x.nilai === null)).toBe(true);
  });

  it('nol adalah nilai yang sah, bukan kekosongan', () => {
    // Pembedaan yang paling mudah rusak: PGA 0 dan PGA kosong tidak sama.
    const k = nilaiDoris(dasar({ pga: 0, gcMg: 0 })).kriteria;
    expect(k[1]).toMatchObject({ nilai: 'sekarang 0', status: 'ya' });
    expect(k[2]).toMatchObject({ nilai: 'sekarang 0 mg', status: 'ya' });
  });

  it('status keseluruhan konsisten dengan daftar syaratnya', () => {
    for (const p of [
      dasar(),
      dasar({ pga: null }),
      dasar({ deskriptor: { kejang: true } }),
      dasar({ deskriptor: { demam: true }, gcMg: null }),
    ]) {
      for (const r of [nilaiDoris(p), nilaiLldas(p)]) {
        const adaGagal = r.kriteria.some((k) => k.status === 'tidak');
        const adaBelum = r.kriteria.some((k) => k.status === 'belum');
        expect(r.status).toBe(adaGagal ? 'tidak' : adaBelum ? 'belum-lengkap' : 'tercapai');
      }
    }
  });
});

describe('penilaianSebelum', () => {
  const r = (id: string, tanggal: string, created_at?: string) => ({ id, tanggal, created_at });

  const lima = [
    r('a', '2026-03-01'),
    r('b', '2026-04-01'),
    r('c', '2026-05-01'),
    r('d', '2026-06-01'),
    r('e', '2026-07-01'),
  ];

  it('mengambil tetangga yang benar untuk penilaian di TENGAH', () => {
    // Inilah yang rusak sebelum layar Target bisa memilih penilaian lama:
    // pembandingnya selalu yang terbaru, bukan tetangga sebenarnya.
    expect(penilaianSebelum(lima, 'c')?.id).toBe('b');
    expect(penilaianSebelum(lima, 'd')?.id).toBe('c');
  });

  it('null untuk penilaian paling awal — tanpa pembanding, bukan belum diambil', () => {
    expect(penilaianSebelum(lima, 'a')).toBeNull();
  });

  it('null bila id tidak ada di daftar', () => {
    expect(penilaianSebelum(lima, 'entah')).toBeNull();
  });

  it('tidak bergantung pada urutan larik masukan', () => {
    const acak = [lima[3], lima[0], lima[4], lima[2], lima[1]];
    expect(penilaianSebelum(acak, 'c')?.id).toBe('b');
  });

  it('tanggal kembar diputus created_at, hasilnya selalu sama', () => {
    const kembar = [
      r('x', '2026-05-01', '2026-05-01T08:00:00Z'),
      r('y', '2026-05-01', '2026-05-01T14:00:00Z'),
      r('w', '2026-04-01', '2026-04-01T08:00:00Z'),
    ];
    expect(penilaianSebelum(kembar, 'y')?.id).toBe('x');
    expect(penilaianSebelum(kembar, 'x')?.id).toBe('w');
  });

  it('tanpa created_at pun urutannya tetap tertentu', () => {
    // Diputus id, supaya dua pemuatan tidak menghasilkan pembanding berbeda.
    const kembar = [r('q', '2026-05-01'), r('p', '2026-05-01')];
    expect(penilaianSebelum(kembar, 'q')?.id).toBe('p');
    expect(penilaianSebelum(kembar, 'p')).toBeNull();
  });

  it('daftar satu baris tidak punya pembanding', () => {
    expect(penilaianSebelum([r('a', '2026-03-01')], 'a')).toBeNull();
  });
});

describe('kelengkapanTarget', () => {
  it('ketiganya terisi = lengkap', () => {
    expect(kelengkapanTarget({ pga: 0.5, gc_mg: 5, terapi_stabil: true })).toBe('lengkap');
  });

  it('nol dan false tetap dihitung terisi', () => {
    // Nol mg steroid dan "belum stabil" adalah jawaban, bukan ketiadaan.
    expect(kelengkapanTarget({ pga: 0, gc_mg: 0, terapi_stabil: false })).toBe('lengkap');
  });

  it('sebagian bila ada yang kosong', () => {
    expect(kelengkapanTarget({ pga: 0.5, gc_mg: null, terapi_stabil: null })).toBe('sebagian');
    expect(kelengkapanTarget({ pga: null, gc_mg: null, terapi_stabil: false })).toBe('sebagian');
  });

  it('kosong bila tak satu pun terisi', () => {
    expect(kelengkapanTarget({ pga: null, gc_mg: null, terapi_stabil: null })).toBe('kosong');
  });
});
