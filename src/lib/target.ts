/**
 * TARGET TERAPI — DORIS 2021 & LLDAS.
 *
 * Murni tanpa I/O, sama seperti `redflag.ts` dan `sledai.ts`. Keduanya adalah
 * titik akhir yang dilaporkan dalam penelitian, jadi keliru sedikit saja
 * mengubah kesimpulan sebuah kohort — dan itu tidak boleh bergantung pada
 * layar yang tidak bisa diuji.
 *
 * RUJUKAN
 * - DORIS 2021: van Vollenhoven RF, dkk. 2021 DORIS definition of remission in
 *   SLE: final recommendations from an international task force. Lupus Sci Med
 *   2021;8:e000538. PMID 34819388.
 * - LLDAS: Franklyn K, dkk. Ann Rheum Dis 2016 — kriteria operasionalnya
 *   dikutip lewat tinjauan akses terbuka Parra Sánchez AR, dkk. Rheumatol Ther
 *   2023 (PMID 37798595, PMC10654283), yang memuat keduanya dalam satu tabel.
 * - Kaitannya dengan berkurangnya akrual kerusakan organ: Ugarte-Gil MF, dkk.
 *   Ann Rheum Dis 2022, kohort inception SLICC. PMID 35944946.
 *
 * ⚠️ BUKAN NILAI BENAR/SALAH BELAKA. Kedua definisi memuat butir yang hanya
 * bisa DINYATAKAN dokter, bukan disimpulkan dari data: apakah imunosupresan
 * dan biologik berada pada dosis pemeliharaan stabil yang ditoleransi. Selama
 * itu belum dinyatakan, hasilnya "belum bisa dinilai" — bukan "tidak
 * tercapai". Membedakan keduanya penting: data yang belum lengkap tidak sama
 * dengan target yang gagal, dan menyamakannya akan meremehkan angka
 * pencapaian di seluruh kohort.
 */

import { SLEDAI_ORGAN_MAYOR, SLEDAI_SEROLOGI, SLEDAI_DESKRIPTOR } from '@/constants/sledai';
import {
  pisahkanDeskriptor,
  scoreSledai,
  type DeskriptorTersimpan,
  type SledaiDeskriptorSet,
} from '@/lib/sledai';

const PETA = new Map(SLEDAI_DESKRIPTOR.map((d) => [d.key, d]));

/** Deskriptor yang bernilai true. Urut, supaya bisa dibandingkan antar kunjungan. */
export function deskriptorAktif(dipilih: SledaiDeskriptorSet | null | undefined): string[] {
  return Object.entries(dipilih ?? {})
    .filter(([, v]) => v === true)
    .map(([k]) => k)
    .sort();
}

/**
 * clinical SLEDAI-2K — total tanpa deskriptor serologi.
 *
 * DORIS mensyaratkan cSLEDAI-2K = 0 tetapi membiarkan aktivitas serologis:
 * pasien dengan komplemen rendah dan anti-dsDNA meningkat, tanpa satu pun
 * gejala klinis, TETAP memenuhi remisi.
 */
export function skorKlinis(raw: DeskriptorTersimpan): number {
  const { dipilih } = pisahkanDeskriptor(raw);
  return scoreSledai(dipilih).aktif.reduce(
    (n, d) => n + (SLEDAI_SEROLOGI.has(d.key) ? 0 : d.bobot),
    0
  );
}

/** Deskriptor organ mayor yang sedang aktif (ginjal, SSP, kardiopulmoner, vaskulitis, demam). */
export function organMayorAktif(raw: DeskriptorTersimpan): string[] {
  return deskriptorAktif(pisahkanDeskriptor(raw).dipilih)
    .filter((k) => SLEDAI_ORGAN_MAYOR.has(k))
    .map((k) => PETA.get(k)?.label ?? k);
}

export interface PenilaianTarget {
  /** Deskriptor kunjungan ini, apa adanya dari database — termasuk bentuk warisan. */
  deskriptor: DeskriptorTersimpan;
  /** Physician Global Assessment, skala 0–3. null = belum dinilai. */
  pga: number | null;
  /** Dosis glukokortikoid harian setara prednison, mg. null = belum dicatat. */
  gcMg: number | null;
  /** Pernyataan dokter soal kestabilan imunosupresan/biologik. null = belum. */
  terapiStabil: boolean | null;
  /**
   * Deskriptor pada penilaian SEBELUMNYA, untuk syarat LLDAS "tidak ada
   * aktivitas lupus baru". null = tidak ada penilaian sebelumnya.
   */
  sebelumnya?: Record<string, boolean> | string[] | null;
}

export type StatusTarget = 'tercapai' | 'tidak' | 'belum-lengkap';

/** Status satu syarat: terpenuhi, tidak terpenuhi, atau datanya belum ada. */
export type StatusKriteria = 'ya' | 'tidak' | 'belum';

export interface Kriteria {
  /** Bunyi syaratnya, mis. "PGA < 0,5". */
  label: string;
  /** Nilai yang membuatnya begitu, mis. "sekarang 1,5". null bila tak relevan. */
  nilai: string | null;
  status: StatusKriteria;
  /**
   * True bila dihitung dari SLEDAI-2K dan tidak bisa diubah dokter.
   *
   * Pemisahan ini yang membuat daftarnya bisa dipercaya: yang otomatis berasal
   * dari deskriptor yang sudah dicentang, yang manual adalah pernyataan dokter.
   * Mencampur keduanya membuat pembacanya tidak tahu mana yang dijamin data.
   */
  otomatis: boolean;
}

export interface HasilTarget {
  status: StatusTarget;
  /** Tiap syarat definisi, urut seperti di naskah aslinya. */
  kriteria: Kriteria[];
  /** Syarat yang tidak terpenuhi, bahasa manusia. Kosong bila tercapai. */
  gagal: string[];
  /** Syarat yang datanya belum ada sehingga penilaian belum bisa dituntaskan. */
  kurang: string[];
}

const AMBANG = {
  /** DORIS: PGA < 0,5 pada skala 0–3. */
  dorisPga: 0.5,
  /** DORIS: glukokortikoid ≤ 5 mg/hari. */
  dorisGc: 5,
  /** LLDAS: SLEDAI-2K ≤ 4. */
  lldasSledai: 4,
  /** LLDAS: PGA ≤ 1 pada skala 0–3. */
  lldasPga: 1,
  /** LLDAS: prednisolon atau setara ≤ 7,5 mg/hari. */
  lldasGc: 7.5,
} as const;

const angka = (n: number) => String(n).replace('.', ',');

/** Syarat berbasis angka yang diisi dokter: belum diisi ≠ tidak terpenuhi. */
function kriteriaAngka(
  label: string,
  nilai: number | null,
  lolos: (v: number) => boolean,
  satuan = ''
): Kriteria {
  if (nilai == null) return { label, nilai: null, status: 'belum', otomatis: false };
  return {
    label,
    nilai: `sekarang ${angka(nilai)}${satuan}`,
    status: lolos(nilai) ? 'ya' : 'tidak',
    otomatis: false,
  };
}

/** Pernyataan dokter berupa ya/tidak. null = belum dinyatakan. */
function kriteriaPernyataan(label: string, nilai: boolean | null): Kriteria {
  return {
    label,
    nilai: null,
    status: nilai == null ? 'belum' : nilai ? 'ya' : 'tidak',
    otomatis: false,
  };
}

/**
 * DORIS 2021 — remisi.
 *
 * clinical SLEDAI-2K = 0 · PGA < 0,5 (skala 0–3) · glukokortikoid ≤ 5 mg/hari ·
 * antimalaria boleh · imunosupresan & biologik boleh pada dosis stabil ·
 * aktivitas serologis boleh ada.
 */
export function nilaiDoris(p: PenilaianTarget): HasilTarget {
  const klinis = skorKlinis(p.deskriptor);
  const kriteria: Kriteria[] = [
    {
      label: 'clinical SLEDAI-2K = 0',
      nilai: `sekarang ${klinis}`,
      status: klinis === 0 ? 'ya' : 'tidak',
      otomatis: true,
    },
    kriteriaAngka('PGA < 0,5', p.pga, (v) => v < AMBANG.dorisPga),
    kriteriaAngka('Glukokortikoid ≤ 5 mg/hari', p.gcMg, (v) => v <= AMBANG.dorisGc, ' mg'),
    kriteriaPernyataan('Imunosupresan & biologik pada dosis stabil', p.terapiStabil),
  ];
  return rangkum(kriteria, p.deskriptor);
}

/**
 * LLDAS — aktivitas penyakit rendah.
 *
 * SLEDAI-2K ≤ 4 tanpa aktivitas organ mayor · tidak ada aktivitas lupus baru
 * dibanding penilaian sebelumnya · PGA ≤ 1 (skala 0–3) · prednisolon atau
 * setara ≤ 7,5 mg/hari · imunosupresan & biologik pada dosis pemeliharaan
 * standar yang ditoleransi.
 *
 * ⚠️ Dua butir definisi aslinya TIDAK bisa diperiksa dari sini: anemia
 * hemolitik dan aktivitas gastrointestinal tidak punya deskriptor di
 * SLEDAI-2K. Keduanya tetap pertimbangan dokter di luar aplikasi.
 */
export function nilaiLldas(p: PenilaianTarget): HasilTarget {
  const total = scoreSledai(pisahkanDeskriptor(p.deskriptor).dipilih).total;
  const mayor = organMayorAktif(p.deskriptor);

  const kriteria: Kriteria[] = [
    {
      label: 'SLEDAI-2K ≤ 4',
      nilai: `sekarang ${total}`,
      status: total <= AMBANG.lldasSledai ? 'ya' : 'tidak',
      otomatis: true,
    },
    {
      label: 'Tanpa aktivitas organ mayor',
      nilai: mayor.length > 0 ? mayor.join(', ') : 'ginjal, SSP, jantung-paru, vaskulitis, demam',
      status: mayor.length === 0 ? 'ya' : 'tidak',
      otomatis: true,
    },
    kriteriaAktivitasBaru(p),
    kriteriaAngka('PGA ≤ 1', p.pga, (v) => v <= AMBANG.lldasPga),
    kriteriaAngka('Glukokortikoid ≤ 7,5 mg/hari', p.gcMg, (v) => v <= AMBANG.lldasGc, ' mg'),
    kriteriaPernyataan('Imunosupresan & biologik dosis pemeliharaan', p.terapiStabil),
  ];
  return rangkum(kriteria, p.deskriptor);
}

/**
 * "Tidak ada aktivitas lupus baru dibanding penilaian sebelumnya."
 *
 * `sebelumnya === null` berarti ini penilaian PERTAMA: tidak ada pembanding,
 * jadi syaratnya dianggap terpenuhi. Menganggapnya gagal akan membuat tidak
 * ada pasien baru yang pernah bisa masuk LLDAS. `undefined` berbeda — berarti
 * penilaian sebelumnya ada tetapi belum diambil, dan itu data yang kurang.
 */
function kriteriaAktivitasBaru(p: PenilaianTarget): Kriteria {
  const label = 'Tanpa aktivitas baru sejak kunjungan lalu';
  if (p.sebelumnya === undefined) {
    return { label, nilai: 'penilaian sebelumnya belum diambil', status: 'belum', otomatis: true };
  }
  if (p.sebelumnya === null) {
    return { label, nilai: 'penilaian pertama, tanpa pembanding', status: 'ya', otomatis: true };
  }
  const lama = new Set(deskriptorAktif(pisahkanDeskriptor(p.sebelumnya).dipilih));
  const baru = deskriptorAktif(pisahkanDeskriptor(p.deskriptor).dipilih)
    .filter((k) => !lama.has(k))
    .map((k) => PETA.get(k)?.label ?? k);
  return {
    label,
    nilai: baru.length > 0 ? baru.join(', ') : null,
    status: baru.length === 0 ? 'ya' : 'tidak',
    otomatis: true,
  };
}

/**
 * Menyimpulkan daftar syarat jadi satu status.
 *
 * Syarat yang sudah PASTI gagal mengalahkan data yang belum lengkap: pasien
 * dengan cSLEDAI-2K 8 tidak akan memenuhi DORIS berapa pun PGA-nya, jadi
 * menyebutnya "belum bisa dinilai" hanya menyembunyikan jawaban yang jelas.
 */
function rangkum(kriteria: Kriteria[], deskriptor: DeskriptorTersimpan): HasilTarget {
  const kurang = [
    ...kurangKarenaAsing(deskriptor),
    ...kriteria.filter((k) => k.status === 'belum').map(teksKriteria),
  ];
  const gagal = kriteria.filter((k) => k.status === 'tidak').map(teksKriteria);

  const status: StatusTarget =
    gagal.length > 0 ? 'tidak' : kurang.length > 0 ? 'belum-lengkap' : 'tercapai';
  return { status, kriteria, gagal, kurang };
}

function teksKriteria(k: Kriteria): string {
  return k.nilai ? `${k.label} (${k.nilai})` : k.label;
}

/**
 * Kunci deskriptor yang tidak dikenal — dilaporkan sebagai data yang kurang.
 *
 * Baris warisan prototipe web memakai LABEL sebagai kunci ("Ruam"), sehingga
 * bobotnya tidak terhitung. Konsekuensinya asimetris, dan itu yang membuat
 * penanganan ini aman:
 *
 * - Kunci asing hanya bisa MENAMBAH aktivitas, tidak pernah mengurangi. Jadi
 *   kalau deskriptor yang dikenal saja sudah menggagalkan target, hasil
 *   "tidak tercapai" tetap benar berapa pun isi kunci asingnya.
 * - Sebaliknya "tercapai" TIDAK aman: bisa saja kunci asing itu vaskulitis.
 *   Karena `kurang` membuat statusnya turun jadi "belum bisa dinilai", hasil
 *   itu tidak pernah keluar. Persis yang kita inginkan.
 */
function kurangKarenaAsing(deskriptor: DeskriptorTersimpan): string[] {
  const { asing } = pisahkanDeskriptor(deskriptor);
  return asing.length === 0 ? [] : [`deskriptor format lama: ${asing.join(', ')}`];
}

/**
 * Membaca angka yang diketik dokter: menerima koma maupun titik desimal.
 *
 * Papan ketik Indonesia memberi koma, dan `Number('0,5')` adalah NaN — kalau
 * tidak ditangani, PGA 0,5 tersimpan sebagai kosong dan pasien tampak "belum
 * dinilai" padahal sudah.
 *
 * String kosong → null (belum diisi). Yang tidak terbaca → undefined (salah
 * ketik), supaya pemanggilnya bisa membedakan keduanya.
 */
export function bacaAngka(teks: string): number | null | undefined {
  const t = teks.trim().replace(',', '.');
  if (t === '') return null;
  if (!/^\d+(\.\d+)?$/.test(t)) return undefined;
  return Number(t);
}

/** Bentuk minimal sebuah baris penilaian untuk pengurutan. */
export interface BarisPenilaian {
  id: string;
  tanggal: string;
  created_at?: string | null;
}

/**
 * Penilaian tepat SEBELUM `id`, menurut urutan waktu.
 *
 * Ada karena layar Target terapi kini bisa melengkapi penilaian LAMA, bukan
 * hanya yang terbaru. Syarat LLDAS "tidak ada aktivitas baru dibanding
 * kunjungan sebelumnya" harus dibandingkan dengan tetangga yang BENAR: kalau
 * dokter mengisi penilaian ketiga dari lima, pembandingnya penilaian keempat
 * dalam urutan menurun — bukan yang terbaru.
 *
 * Salah pembanding tidak memunculkan galat apa pun. Ia hanya diam-diam
 * menjawab "tercapai" atau "tidak" untuk kunjungan yang salah, dan itu masuk
 * ke data penelitian tanpa jejak.
 *
 * Mengembalikan null bila `id` adalah penilaian paling awal, atau tidak ada di
 * daftar. Null berarti "tanpa pembanding" — bukan "belum diambil" — dan
 * `nilaiLldas` memperlakukannya sebagai syarat terpenuhi.
 */
export function penilaianSebelum<T extends BarisPenilaian>(rows: T[], id: string): T | null {
  const urut = [...rows].sort(urutWaktu);
  const i = urut.findIndex((r) => r.id === id);
  return i <= 0 ? null : urut[i - 1];
}

/**
 * Urut naik: tanggal, lalu created_at, lalu id.
 *
 * Dua penilaian bertanggal sama bukan hal mustahil (koreksi yang diisi ulang
 * pada hari yang sama), dan urutan yang bergantung pada kebetulan susunan
 * larik akan membuat pembanding LLDAS berpindah-pindah antar pemuatan. `id`
 * sebagai pemutus terakhir menjamin hasilnya selalu sama.
 */
function urutWaktu(a: BarisPenilaian, b: BarisPenilaian): number {
  return (
    a.tanggal.localeCompare(b.tanggal) ||
    (a.created_at ?? '').localeCompare(b.created_at ?? '') ||
    a.id.localeCompare(b.id)
  );
}

export type Kelengkapan = 'lengkap' | 'sebagian' | 'kosong';

/**
 * Seberapa lengkap tiga isian target pada sebuah penilaian.
 *
 * Dipakai daftar pemilih supaya dokter langsung melihat penilaian mana yang
 * masih perlu dilengkapi, alih-alih membuka satu per satu.
 */
export function kelengkapanTarget(p: {
  pga: number | null;
  gc_mg: number | null;
  terapi_stabil: boolean | null;
}): Kelengkapan {
  const terisi = [p.pga, p.gc_mg, p.terapi_stabil].filter((v) => v !== null && v !== undefined);
  if (terisi.length === 3) return 'lengkap';
  return terisi.length === 0 ? 'kosong' : 'sebagian';
}
