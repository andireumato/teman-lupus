import {
  JUMLAH_BUTIR,
  LUPUSQOL_BUTIR,
  LUPUSQOL_DOMAIN,
  domainButir,
  naskahTerpasang,
} from '@/constants/lupusqol';

import {
  butirBelumDijawab,
  nilaiSah,
  selisihDomain,
  skorLupusQol,
  type JawabanLupusQol,
} from './lupusqol';

/** Semua butir dijawab dengan nilai yang sama. */
const semua = (v: number): JawabanLupusQol => Object.fromEntries(LUPUSQOL_BUTIR.map((k) => [k, v]));

const domain = (h: ReturnType<typeof skorLupusQol>, key: string) =>
  h.domain.find((d) => d.key === key)!;

describe('struktur instrumen', () => {
  it('34 butir dalam 8 domain, sesuai publikasi aslinya', () => {
    expect(LUPUSQOL_DOMAIN).toHaveLength(8);
    expect(JUMLAH_BUTIR).toBe(34);
  });

  it('jumlah butir tiap domain sesuai McElhone 2007', () => {
    const per = Object.fromEntries(LUPUSQOL_DOMAIN.map((d) => [d.key, d.jumlah]));
    expect(per).toEqual({
      fisik: 8,
      nyeri: 3,
      perencanaan: 3,
      intim: 2,
      beban: 3,
      emosi: 6,
      citra_tubuh: 5,
      kelelahan: 4,
    });
  });

  it('kunci butirnya unik', () => {
    expect(new Set(LUPUSQOL_BUTIR).size).toBe(JUMLAH_BUTIR);
  });

  it('tiap kunci butir menemukan domainnya kembali', () => {
    for (const k of LUPUSQOL_BUTIR) expect(domainButir(k)).not.toBeNull();
    expect(domainButir('fisik_3')?.key).toBe('fisik');
    // `citra_tubuh` mengandung garis bawah — pemotongan kunci yang naif akan
    // salah membacanya sebagai domain `citra`.
    expect(domainButir('citra_tubuh_5')?.key).toBe('citra_tubuh');
  });

  it('hanya domain hubungan intim yang boleh "tidak berlaku"', () => {
    const boleh = LUPUSQOL_DOMAIN.filter((d) => d.bolehTakBerlaku).map((d) => d.key);
    expect(boleh).toEqual(['intim']);
  });

  it('naskah resminya BELUM terpasang — hak cipta belum dilisensikan', () => {
    // Test ini akan gagal begitu teks butir diisi, dan itu memang tandanya:
    // ubah harapannya jadi `true` bersamaan dengan memasang naskah resminya.
    expect(naskahTerpasang()).toBe(false);
  });
});

describe('skorLupusQol', () => {
  it('semua butir bernilai 4 menghasilkan 100 di setiap domain', () => {
    const h = skorLupusQol(semua(4));
    for (const d of h.domain) expect(d.skor).toBe(100);
    expect(h.rerata).toBe(100);
    expect(h.terjawab).toBe(34);
  });

  it('semua butir bernilai 0 menghasilkan 0, bukan null', () => {
    // Nol adalah jawaban, bukan ketiadaan jawaban.
    const h = skorLupusQol(semua(0));
    for (const d of h.domain) expect(d.skor).toBe(0);
    expect(h.rerata).toBe(0);
    expect(h.terjawab).toBe(34);
  });

  it('nilai tengah 2 menghasilkan 50', () => {
    expect(skorLupusQol(semua(2)).rerata).toBe(50);
  });

  it('skor domain adalah rata-rata butirnya dikali 25', () => {
    const j: JawabanLupusQol = { nyeri_1: 4, nyeri_2: 2, nyeri_3: 0 };
    // rata-rata 2 → 50
    expect(domain(skorLupusQol(j), 'nyeri').skor).toBe(50);
  });

  it('butir tak terjawab dikeluarkan dari rata-rata, tidak dianggap nol', () => {
    // Dianggap nol, skornya jadi 25 — melaporkan kualitas hidup terburuk untuk
    // pertanyaan yang tidak pernah dijawab.
    const j: JawabanLupusQol = { nyeri_1: 4, nyeri_2: null };
    const d = domain(skorLupusQol(j), 'nyeri');
    expect(d.skor).toBe(100);
    expect(d.terjawab).toBe(1);
    expect(d.total).toBe(3);
  });

  it('domain tanpa satu pun jawaban bernilai null', () => {
    const d = domain(skorLupusQol({}), 'intim');
    expect(d.skor).toBeNull();
    expect(d.terjawab).toBe(0);
  });

  it('rerata melewati domain kosong, bukan menganggapnya nol', () => {
    // "Tidak berlaku" di hubungan intim tidak boleh menyeret rerata ke bawah.
    const j = { ...semua(4), intim_1: null, intim_2: null };
    const h = skorLupusQol(j);
    expect(domain(h, 'intim').skor).toBeNull();
    expect(h.rerata).toBe(100);
  });

  it('rerata dihitung antar DOMAIN, bukan antar butir', () => {
    // fisik (8 butir) semua 4, kelelahan (4 butir) semua 0, sisanya kosong.
    // Antar domain: (100 + 0) / 2 = 50.
    // Antar butir keliru jadi (8×4 + 4×0) / 12 × 25 ≈ 66,7 — fisik berbobot
    // dua kali lipat hanya karena butirnya lebih banyak.
    const j: JawabanLupusQol = {};
    for (let i = 1; i <= 8; i++) j[`fisik_${i}`] = 4;
    for (let i = 1; i <= 4; i++) j[`kelelahan_${i}`] = 0;
    expect(skorLupusQol(j).rerata).toBe(50);
  });

  it('nilai di luar 0–4 diabaikan, tidak merusak skornya', () => {
    const j: JawabanLupusQol = { nyeri_1: 4, nyeri_2: 9, nyeri_3: -1 };
    const d = domain(skorLupusQol(j), 'nyeri');
    expect(d.skor).toBe(100);
    expect(d.terjawab).toBe(1);
  });

  it('kunci asing tidak ikut terhitung', () => {
    const h = skorLupusQol({ ...semua(4), butir_karangan: 0 });
    expect(h.terjawab).toBe(34);
    expect(h.rerata).toBe(100);
  });

  it('dibulatkan satu desimal, jadi dua penilaian yang sama tampil sama', () => {
    // 8 butir → kelipatan 3,125; tanpa pembulatan hasilnya bisa berbeda di
    // digit paling belakang.
    const j: JawabanLupusQol = {};
    for (let i = 1; i <= 8; i++) j[`fisik_${i}`] = i % 5;
    const s = domain(skorLupusQol(j), 'fisik').skor!;
    expect(Number(s.toFixed(1))).toBe(s);
  });
});

describe('nilaiSah', () => {
  it('menerima 0 sampai 4 saja', () => {
    expect([0, 1, 2, 3, 4].every(nilaiSah)).toBe(true);
    for (const v of [-1, 5, 2.5, null, undefined, '3', NaN]) expect(nilaiSah(v)).toBe(false);
  });
});

describe('butirBelumDijawab', () => {
  it('kosong bila semua terjawab', () => {
    expect(butirBelumDijawab(semua(1))).toEqual([]);
  });

  it('menyebut butir yang tersisa, urut sesuai kuesioner', () => {
    const j = { ...semua(1), fisik_2: null, kelelahan_4: undefined };
    expect(butirBelumDijawab(j)).toEqual(['fisik_2', 'kelelahan_4']);
  });
});

describe('selisihDomain', () => {
  it('positif berarti membaik — skor LupusQoL makin tinggi makin baik', () => {
    const s = selisihDomain(skorLupusQol(semua(4)), skorLupusQol(semua(2)));
    expect(s.fisik).toBe(50);
  });

  it('null bila salah satu sisinya tidak ada, bukan nol', () => {
    // "Tidak berubah" dan "tidak bisa dibandingkan" dua hal berbeda.
    const s = selisihDomain(skorLupusQol(semua(4)), skorLupusQol({}));
    expect(s.fisik).toBeNull();
  });

  it('tanpa pembanding, semuanya null', () => {
    const s = selisihDomain(skorLupusQol(semua(4)), null);
    expect(Object.values(s).every((v) => v === null)).toBe(true);
  });
});
