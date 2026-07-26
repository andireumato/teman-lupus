/**
 * RINGKASAN PRA-KUNJUNGAN
 *
 * Implementasi Bagian 8 "Spesifikasi MVP — Teman Lupus": satu halaman padat
 * yang dibaca reumatolog sebelum kontrol.
 *
 * Semua fungsi di sini MURNI (tanpa I/O) supaya bisa diuji baris per baris,
 * sama seperti red-flag engine. Layar `/ringkasan` hanya mengambil data lalu
 * memanggil `buatRingkasan()`.
 *
 * ⚠️ Batas yang sengaja dijaga:
 * - Ringkasan ini MERANGKUM apa yang pasien catat. Ia tidak menilai aktivitas
 *   penyakit, tidak menyebut flare sebagai kesimpulan, dan tidak pernah
 *   menyarankan perubahan terapi.
 * - Satu-satunya jalur eskalasi tetap `redflag.ts`. Bagian "Perubahan &
 *   waktunya" di sini deskriptif — hitungan hari atas data, bukan pemicu
 *   tindakan.
 */

import { SISTEM_GEJALA } from '@/constants/lupus';
import { tanggalPendek } from '@/lib/dates';
import { PERTANYAAN_MENDESAK, PERTANYAAN_TANDA_BAHAYA } from '@/lib/redflag';
import type {
  DailyCheckin,
  FlareCheck,
  LabResult,
  MarsAssessment,
  MedLog,
  Medication,
} from '@/types/database';

// ---------- Masukan & keluaran ----------

export interface RingkasanInput {
  /** Batas periode, YYYY-MM-DD, inklusif di kedua ujung. */
  dari: string;
  sampai: string;
  pasien: { inisial: string; id: string };
  checkins: DailyCheckin[];
  meds: Medication[];
  medLogs: MedLog[];
  mars: MarsAssessment[];
  flares: FlareCheck[];
  labs: LabResult[];
  /** Pertanyaan yang ditulis pasien sendiri untuk kunjungan ini. */
  pertanyaan: string[];
}

export type Arah = 'naik' | 'turun' | 'stabil';

export interface TrenSkor {
  label: string;
  /** Rata-rata paruh awal periode; null bila tidak ada data. */
  awal: number | null;
  /** Rata-rata paruh akhir periode. */
  akhir: number | null;
  arah: Arah;
  /** Rata-rata per minggu, urut lama → baru. null = minggu tanpa check-in. */
  mingguan: (number | null)[];
  /** Nilai tertinggi skala, untuk konteks pembacaan (mis. mood 1–5). */
  maks: number;
}

export type KategoriGejala = 'baru' | 'memburuk' | 'menetap' | 'membaik';

export interface GejalaRingkas {
  system: string;
  sistemLabel: string;
  item: string;
  kategori: KategoriGejala;
  /** Jumlah hari check-in yang mencatat gejala ini. */
  hari: number;
  /** Proporsi check-in yang mencatatnya, per paruh periode (0–1). */
  freqAwal: number;
  freqAkhir: number;
}

export interface ObatTerlewat {
  nama: string;
  /** Hari yang ditandai "belum diminum". */
  terlewat: number;
  /** Hari yang ditandai "sudah diminum". */
  diminum: number;
}

export interface EventRedFlag {
  waktu: string;
  level: 'darurat' | 'mendesak';
  /** Label bahasa awam dari tanda yang dicentang pasien. */
  tanda: string[];
}

export interface Ringkasan {
  kepala: {
    inisial: string;
    id: string;
    dari: string;
    sampai: string;
    jumlahCheckin: number;
    /** Jumlah hari dalam periode, untuk menghitung kelengkapan pencatatan. */
    jumlahHari: number;
  };
  skor: TrenSkor[];
  gejala: Record<KategoriGejala, GejalaRingkas[]>;
  /**
   * Kalimat deskriptif dalam satuan asli check-in: hitungan hari, tanggal
   * mulai memberat, gejala yang muncul bersamaan, dan hari yang tidak
   * terpantau. Bukan penilaian aktivitas penyakit. Kosong bila tidak ada.
   */
  perubahan: string[];
  obat: {
    daftar: ObatTerlewat[];
    /** Hari dalam periode tanpa satu pun catatan minum obat. */
    hariTanpaCatatan: number;
    mars: { tanggal: string; total: number; kategori: string } | null;
    /** Alasan bebas yang ditulis pasien di catatan minum obat. */
    alasan: { tanggal: string; teks: string }[];
  };
  redflag: EventRedFlag[];
  pertanyaan: {
    /** Ditulis pasien khusus untuk kunjungan ini. */
    pasien: string[];
    /** Catatan bebas dari check-in harian. */
    catatan: { tanggal: string; teks: string }[];
  };
  pemantauan: string[];
}

// ---------- Pembantu ----------

const rata = (xs: number[]): number | null =>
  xs.length === 0 ? null : xs.reduce((a, b) => a + b, 0) / xs.length;

const bulat1 = (x: number) => Math.round(x * 10) / 10;
const bulat2 = (x: number) => Math.round(x * 100) / 100;

/** Selisih hari antara dua tanggal YYYY-MM-DD (b − a). */
export function selisihHari(a: string, b: string): number {
  const ms = new Date(`${b}T00:00:00`).getTime() - new Date(`${a}T00:00:00`).getTime();
  return Math.round(ms / 86_400_000);
}

/** Tanggal YYYY-MM-DD, n hari sebelum `iso`. */
export function mundurHari(iso: string, n: number): string {
  const d = new Date(`${iso}T00:00:00`);
  d.setDate(d.getDate() - n);
  const pad = (x: number) => String(x).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Inisial dari nama lengkap: "Siti Rahma Dewi" → "S.R.D." */
export function inisialNama(nama: string | null | undefined): string {
  const bagian = (nama ?? '').trim().split(/\s+/).filter(Boolean);
  if (bagian.length === 0) return '—';
  return bagian.map((b) => `${b[0].toUpperCase()}.`).join('');
}

/** 8 karakter pertama UUID — cukup untuk mencocokkan rekam medis. */
export function idPendek(id: string | null | undefined): string {
  return (id ?? '').slice(0, 8) || '—';
}

const LABEL_SISTEM = new Map(SISTEM_GEJALA.map((s) => [s.system, s.label]));

const LABEL_TANDA = new Map(
  [...PERTANYAAN_TANDA_BAHAYA, ...PERTANYAAN_MENDESAK].map((q) => [q.key as string, q.label])
);

/**
 * Buang duplikat per tanggal (entri terakhir menang) lalu urutkan lama → baru.
 * Check-in bisa diperbarui di hari yang sama.
 */
function rapikanCheckin(rows: DailyCheckin[], dari: string, sampai: string): DailyCheckin[] {
  const perTanggal = new Map<string, DailyCheckin>();
  for (const r of rows) {
    if (!r.tanggal) continue;
    if (r.tanggal < dari || r.tanggal > sampai) continue;
    perTanggal.set(r.tanggal, r);
  }
  return [...perTanggal.keys()].sort().map((k) => perTanggal.get(k)!);
}

/**
 * Titik pisah paruh awal / paruh akhir periode.
 * Dipisah berdasarkan TANGGAL, bukan jumlah check-in, supaya pasien yang
 * mengisi rajin di satu minggu saja tidak menggeser garis pembanding.
 */
function tengahPeriode(dari: string, sampai: string): string {
  return mundurHari(sampai, Math.floor(selisihHari(dari, sampai) / 2));
}

// ---------- 1. Skor harian ----------

const SKALA: { key: 'mood' | 'lelah' | 'nyeri_sendi'; label: string; maks: number }[] = [
  { key: 'mood', label: 'Mood (1–5, makin tinggi makin baik)', maks: 5 },
  { key: 'lelah', label: 'Kelelahan (0–4, makin tinggi makin berat)', maks: 4 },
  { key: 'nyeri_sendi', label: 'Nyeri sendi (0–3, makin tinggi makin berat)', maks: 3 },
];

function trenSkor(rows: DailyCheckin[], dari: string, sampai: string): TrenSkor[] {
  const batas = tengahPeriode(dari, sampai);
  const totalHari = selisihHari(dari, sampai) + 1;
  const jumlahMinggu = Math.max(1, Math.ceil(totalHari / 7));

  return SKALA.map(({ key, label, maks }) => {
    const nilai = (r: DailyCheckin) => r[key];
    const awal = rata(
      rows
        .filter((r) => r.tanggal < batas)
        .map(nilai)
        .filter(isAngka)
    );
    const akhir = rata(
      rows
        .filter((r) => r.tanggal >= batas)
        .map(nilai)
        .filter(isAngka)
    );

    const mingguan: (number | null)[] = [];
    for (let m = 0; m < jumlahMinggu; m++) {
      // Minggu dihitung mundur dari `sampai`, lalu dibalik agar urut lama → baru.
      const akhirMinggu = mundurHari(sampai, m * 7);
      const awalMinggu = mundurHari(sampai, m * 7 + 6);
      const isi = rows
        .filter((r) => r.tanggal >= awalMinggu && r.tanggal <= akhirMinggu)
        .map(nilai)
        .filter(isAngka);
      const r = rata(isi);
      mingguan.unshift(r == null ? null : bulat1(r));
    }

    let arah: Arah = 'stabil';
    if (awal != null && akhir != null) {
      if (akhir - awal >= 0.5) arah = 'naik';
      else if (awal - akhir >= 0.5) arah = 'turun';
    }

    return {
      label,
      awal: awal == null ? null : bulat1(awal),
      akhir: akhir == null ? null : bulat1(akhir),
      arah,
      mingguan,
      maks,
    };
  });
}

function isAngka(v: number | null): v is number {
  return v != null;
}

// ---------- 2. Gejala menonjol ----------

/**
 * Gejala dikelompokkan dengan membandingkan SEBERAPA SERING ia tercatat di
 * paruh awal vs paruh akhir periode (proporsi terhadap jumlah check-in di
 * masing-masing paruh), bukan jumlah mentah — pasien tidak selalu mengisi
 * sama rajin di kedua paruh.
 *
 * Ambang 0,25 dipilih agar perubahan 1 dari 4 hari sudah terbaca. Ini angka
 * tampilan, bukan ambang klinis: apa pun kategorinya, tidak ada tindakan yang
 * dipicu otomatis.
 */
const AMBANG_GESER = 0.25;

function gejalaMenonjol(
  rows: DailyCheckin[],
  dari: string,
  sampai: string
): Record<KategoriGejala, GejalaRingkas[]> {
  const batas = tengahPeriode(dari, sampai);
  const awal = rows.filter((r) => r.tanggal < batas);
  const akhir = rows.filter((r) => r.tanggal >= batas);

  type Hitung = { system: string; item: string; awal: number; akhir: number };
  const peta = new Map<string, Hitung>();

  const catat = (bagian: DailyCheckin[], sisi: 'awal' | 'akhir') => {
    for (const r of bagian) {
      for (const g of r.gejala ?? []) {
        if (!g.present) continue;
        const k = `${g.system}|${g.item}`;
        const h = peta.get(k) ?? { system: g.system, item: g.item, awal: 0, akhir: 0 };
        h[sisi] += 1;
        peta.set(k, h);
      }
    }
  };
  catat(awal, 'awal');
  catat(akhir, 'akhir');

  const hasil: Record<KategoriGejala, GejalaRingkas[]> = {
    baru: [],
    memburuk: [],
    menetap: [],
    membaik: [],
  };

  for (const h of peta.values()) {
    const freqAwal = awal.length === 0 ? 0 : h.awal / awal.length;
    const freqAkhir = akhir.length === 0 ? 0 : h.akhir / akhir.length;

    let kategori: KategoriGejala;
    if (awal.length === 0 || akhir.length === 0) {
      // Tanpa pembanding di salah satu paruh, "baru" atau "membaik" tidak bisa
      // dibuktikan. Dicatat netral sebagai menetap agar tidak menyesatkan.
      kategori = 'menetap';
    } else if (h.awal === 0) {
      kategori = 'baru';
    } else if (freqAkhir - freqAwal >= AMBANG_GESER) {
      kategori = 'memburuk';
    } else if (freqAwal - freqAkhir >= AMBANG_GESER) {
      kategori = 'membaik';
    } else {
      kategori = 'menetap';
    }

    hasil[kategori].push({
      system: h.system,
      sistemLabel: LABEL_SISTEM.get(h.system) ?? h.system,
      item: h.item,
      kategori,
      hari: h.awal + h.akhir,
      freqAwal: bulat2(freqAwal),
      freqAkhir: bulat2(freqAkhir),
    });
  }

  for (const k of Object.keys(hasil) as KategoriGejala[]) {
    hasil[k].sort((a, b) => b.hari - a.hari || a.item.localeCompare(b.item));
  }
  return hasil;
}

// ---------- 3. Perubahan & waktunya ----------

/**
 * Bagian ini menghemat pekerjaan yang kalau tidak ada harus dilakukan dengan
 * membaca seluruh log: sejak kapan memberat, apa yang muncul bersamaan, dan
 * kapan datanya kosong.
 *
 * Aturan yang sengaja dipegang:
 * - Tidak ada skor gabungan. Versi pertama menjumlahkan kelelahan (0–4) dan
 *   nyeri sendi (0–3) menjadi "skor beban" 0–7 — angka yang tampak objektif
 *   tetapi tidak punya padanan klinis apa pun. Semua kalimat sekarang memakai
 *   skala asli yang diisi pasien, lengkap dengan ambangnya.
 * - Satuannya HARI KALENDER, bukan jumlah check-in. "Naik 4 check-in
 *   berturut-turut" bisa berarti rentang tiga minggu bila pasien jarang
 *   mengisi; itu menyesatkan.
 * - Hari tanpa check-in disebut eksplisit. Tidak ada catatan bukan berarti
 *   tidak ada gejala.
 * - Tidak mengulang bagian lain: event Cek Flare adalah isi bagian 5.
 *
 * ⚠️ Ambang di bawah menentukan kalimat mana yang muncul, jadi wajib direview
 * reumatolog. Tidak ada tindakan yang dipicu otomatis olehnya.
 */

/** Nyeri sendi (skala 0–3): 2 = sedang, 3 = berat. */
const AMBANG_NYERI = 2;
/** Kelelahan (skala 0–4): 3 = berat, 4 = sangat berat. */
const AMBANG_LELAH = 3;
/** Mood (skala 1–5): 1 = sangat buruk, 2 = buruk. */
const AMBANG_MOOD = 2;
/** Panjang jendela pembanding, dipotong bila periodenya pendek. */
const JENDELA_MAKS = 14;
/** Panjang minimum rentetan hari berturut-turut sebelum disebut "mulai memberat". */
const MIN_BERUNTUN = 3;
/** Jarak maksimum antar gejala baru agar disebut muncul bersamaan. */
const JARAK_BERSAMAAN = 7;

interface Metrik {
  label: string;
  /** True bila nilai hari itu memenuhi ambang. */
  test: (r: DailyCheckin) => boolean;
}

const METRIK: Metrik[] = [
  {
    label: `Nyeri sendi sedang–berat (≥${AMBANG_NYERI})`,
    test: (r) => r.nyeri_sendi != null && r.nyeri_sendi >= AMBANG_NYERI,
  },
  {
    label: `Kelelahan berat (≥${AMBANG_LELAH})`,
    test: (r) => r.lelah != null && r.lelah >= AMBANG_LELAH,
  },
  {
    label: `Mood buruk (≤${AMBANG_MOOD})`,
    test: (r) => r.mood != null && r.mood <= AMBANG_MOOD,
  },
];

const dalam = (t: string, awal: string, akhir: string) => t >= awal && t <= akhir;

/**
 * Rentetan hari kalender berturut-turut dengan nyeri sendi memenuhi ambang.
 * Mengembalikan rentetan TERAKHIR yang cukup panjang — yang paling relevan
 * untuk pertanyaan "sejak kapan memberat".
 */
function rentetanNyeri(rows: DailyCheckin[]): { mulai: string; panjang: number } | null {
  let hasil: { mulai: string; panjang: number } | null = null;
  let mulai: string | null = null;
  let panjang = 0;
  let sebelumnya: string | null = null;

  for (const r of rows) {
    const cocok = r.nyeri_sendi != null && r.nyeri_sendi >= AMBANG_NYERI;
    const bersambung = sebelumnya != null && selisihHari(sebelumnya, r.tanggal) === 1;

    if (cocok && bersambung && panjang > 0) panjang += 1;
    else if (cocok) {
      mulai = r.tanggal;
      panjang = 1;
    } else {
      mulai = null;
      panjang = 0;
    }

    if (mulai && panjang >= MIN_BERUNTUN) hasil = { mulai, panjang };
    sebelumnya = r.tanggal;
  }
  return hasil;
}

/**
 * Gejala yang pertama kali tercatat berdekatan waktunya, dari ≥2 sistem organ.
 * Gejala yang sudah ada sejak check-in pertama tidak dihitung — tanpa hari
 * pembanding yang menunjukkan gejala itu belum ada, "muncul" tidak terbukti.
 */
function munculBersamaan(
  rows: DailyCheckin[]
): { tanggal: string; daftar: { item: string; sistemLabel: string }[] } | null {
  if (rows.length === 0) return null;
  const hariPertama = rows[0].tanggal;

  const pertama = new Map<string, { system: string; item: string; tanggal: string }>();
  for (const r of rows) {
    for (const g of r.gejala ?? []) {
      if (!g.present) continue;
      const k = `${g.system}|${g.item}`;
      if (!pertama.has(k)) pertama.set(k, { system: g.system, item: g.item, tanggal: r.tanggal });
    }
  }

  const baru = [...pertama.values()]
    .filter((g) => g.tanggal > hariPertama)
    .sort((a, b) => a.tanggal.localeCompare(b.tanggal));
  if (baru.length < 2) return null;

  // Kelompokkan di sekitar kemunculan terbaru.
  const terbaru = baru[baru.length - 1].tanggal;
  const batas = mundurHari(terbaru, JARAK_BERSAMAAN - 1);
  const kelompok = baru.filter((g) => g.tanggal >= batas);

  const sistem = new Set(kelompok.map((g) => g.system));
  if (kelompok.length < 2 || sistem.size < 2) return null;

  return {
    tanggal: kelompok[0].tanggal,
    daftar: kelompok.map((g) => ({
      item: g.item,
      sistemLabel: LABEL_SISTEM.get(g.system) ?? g.system,
    })),
  };
}

function perubahanTerkini(rows: DailyCheckin[], dari: string, sampai: string): string[] {
  const out: string[] = [];
  const jumlahHari = selisihHari(dari, sampai) + 1;
  const jendela = Math.min(JENDELA_MAKS, Math.floor(jumlahHari / 2));

  // Periode terlalu pendek untuk membandingkan dua jendela yang setara.
  if (jendela < MIN_BERUNTUN) return out;

  const awalBaru = mundurHari(sampai, jendela - 1);
  const akhirLama = mundurHari(awalBaru, 1);
  const awalLama = mundurHari(akhirLama, jendela - 1);

  const hitung = (awal: string, akhir: string, test: Metrik['test']) =>
    rows.filter((r) => dalam(r.tanggal, awal, akhir) && test(r)).length;

  // Penyebutnya HARI YANG TERCATAT, bukan hari kalender: pasien yang jarang
  // mengisi biasanya justru sedang tidak enak badan, dan penyebut kalender
  // akan meremehkan angkanya (6 dari 7 hari terisi terbaca "6 dari 14").
  // Panjang jendelanya tetap disebut supaya bolongnya data tidak hilang.
  const tercatatBaru = rows.filter((r) => dalam(r.tanggal, awalBaru, sampai)).length;
  const tercatatLama = rows.filter((r) => dalam(r.tanggal, awalLama, akhirLama)).length;

  for (const m of METRIK) {
    const baru = hitung(awalBaru, sampai, m.test);
    const lama = hitung(awalLama, akhirLama, m.test);
    if (baru === 0 && lama === 0) continue;

    const sisiBaru =
      tercatatBaru === 0
        ? `tidak ada catatan dalam ${jendela} hari terakhir`
        : `${baru} dari ${tercatatBaru} hari yang tercatat (dalam ${jendela} hari terakhir)`;
    const sisiLama =
      tercatatLama === 0
        ? 'sebelumnya tidak ada catatan'
        : `sebelumnya ${lama} dari ${tercatatLama}`;

    out.push(`${m.label}: ${sisiBaru}, ${sisiLama}.`);
  }

  const rentetan = rentetanNyeri(rows);
  if (rentetan) {
    out.push(
      `Mulai memberat sekitar ${tanggalPendek(rentetan.mulai)} — hari pertama dari ${rentetan.panjang} hari berturut-turut dengan nyeri sendi ≥${AMBANG_NYERI}.`
    );
  }

  const bersamaan = munculBersamaan(rows);
  if (bersamaan) {
    const daftar = bersamaan.daftar.map((g) => `${g.item} (${g.sistemLabel})`).join(', ');
    out.push(`Muncul bersamaan sejak ${tanggalPendek(bersamaan.tanggal)}: ${daftar}.`);
  }

  const kosong = jendela - tercatatBaru;
  if (kosong > 0) {
    out.push(
      `${kosong} dari ${jendela} hari terakhir tanpa check-in — hari itu tidak terpantau, bukan berarti tanpa gejala.`
    );
  }

  return out;
}

// ---------- 4. Obat ----------

function ringkasObat(
  meds: Medication[],
  logs: MedLog[],
  mars: MarsAssessment[],
  dari: string,
  sampai: string
): Ringkasan['obat'] {
  const dalamPeriode = logs.filter((l) => l.tanggal >= dari && l.tanggal <= sampai);
  const namaObat = new Map(meds.map((m) => [m.id, m.nama_obat]));

  const daftar: ObatTerlewat[] = meds.map((m) => {
    const milik = dalamPeriode.filter((l) => l.medication_id === m.id);
    return {
      nama: m.nama_obat,
      terlewat: milik.filter((l) => l.diminum === false).length,
      diminum: milik.filter((l) => l.diminum === true).length,
    };
  });

  const hariTercatat = new Set(dalamPeriode.map((l) => l.tanggal)).size;
  const totalHari = selisihHari(dari, sampai) + 1;

  const marsTerakhir = [...mars]
    .filter((m) => m.tanggal >= dari && m.tanggal <= sampai)
    .sort((a, b) => b.tanggal.localeCompare(a.tanggal))[0];

  const alasan = dalamPeriode
    .filter((l) => (l.alasan ?? '').trim().length > 0)
    .sort((a, b) => a.tanggal.localeCompare(b.tanggal))
    .map((l) => ({
      tanggal: l.tanggal,
      teks: `${namaObat.get(l.medication_id ?? '') ?? 'Obat'}: ${l.alasan!.trim()}`,
    }));

  return {
    daftar: daftar.sort((a, b) => b.terlewat - a.terlewat || a.nama.localeCompare(b.nama)),
    hariTanpaCatatan: meds.length === 0 ? 0 : Math.max(0, totalHari - hariTercatat),
    mars:
      marsTerakhir && marsTerakhir.total != null
        ? {
            tanggal: marsTerakhir.tanggal,
            total: marsTerakhir.total,
            kategori: marsTerakhir.kategori ?? '—',
          }
        : null,
    alasan,
  };
}

// ---------- 5. Event red-flag ----------

function eventRedFlag(flares: FlareCheck[], dari: string, sampai: string): EventRedFlag[] {
  return flares
    .filter((f) => {
      if (f.hasil !== 'red' && f.hasil !== 'yellow') return false;
      const tgl = (f.waktu ?? '').slice(0, 10);
      return tgl >= dari && tgl <= sampai;
    })
    .sort((a, b) => a.waktu.localeCompare(b.waktu))
    .map((f) => {
      const dicentang = [f.tanda_bahaya ?? {}, f.gejala ?? {}].flatMap((obj) =>
        Object.entries(obj)
          .filter(([, v]) => v === true)
          .map(([k]) => LABEL_TANDA.get(k) ?? k)
      );
      return {
        waktu: f.waktu,
        level: f.hasil === 'red' ? ('darurat' as const) : ('mendesak' as const),
        tanda: dicentang,
      };
    });
}

// ---------- 7. Pemantauan ----------

const HCQ = ['hidroksiklorokuin', 'hydroxychloroquine', 'plaquenil'];

function pemantauan(labs: LabResult[], meds: Medication[], sampai: string): string[] {
  const out: string[] = [];

  const dalamRentang = labs.filter((l) => l.tanggal != null && l.tanggal <= sampai);
  const terbaru = [...dalamRentang].sort((a, b) =>
    (b.tanggal ?? '').localeCompare(a.tanggal ?? '')
  )[0];

  if (!terbaru) {
    out.push('Belum ada hasil lab yang dicatat di aplikasi.');
  } else {
    const umur = selisihHari(terbaru.tanggal!, sampai);
    out.push(
      `Lab terakhir yang dicatat: ${terbaru.jenis}, ${tanggalPendek(terbaru.tanggal)} (${umur} hari sebelum akhir periode).`
    );
  }

  const pakaiHcq = meds.some((m) => HCQ.some((h) => m.nama_obat.toLowerCase().includes(h)));
  if (pakaiHcq) {
    out.push(
      'Pasien memakai hidroksiklorokuin. Aplikasi belum memantau jadwal skrining mata (fase 2).'
    );
  }

  return out;
}

// ---------- Perakit ----------

export function buatRingkasan(input: RingkasanInput): Ringkasan {
  const { dari, sampai } = input;
  const rows = rapikanCheckin(input.checkins, dari, sampai);
  const gejala = gejalaMenonjol(rows, dari, sampai);
  const redflag = eventRedFlag(input.flares, dari, sampai);

  return {
    kepala: {
      inisial: input.pasien.inisial,
      id: input.pasien.id,
      dari,
      sampai,
      jumlahCheckin: rows.length,
      jumlahHari: selisihHari(dari, sampai) + 1,
    },
    skor: trenSkor(rows, dari, sampai),
    gejala,
    perubahan: perubahanTerkini(rows, dari, sampai),
    obat: ringkasObat(input.meds, input.medLogs, input.mars, dari, sampai),
    redflag,
    pertanyaan: {
      pasien: input.pertanyaan.map((p) => p.trim()).filter(Boolean),
      catatan: rows
        .filter((r) => (r.catatan ?? '').trim().length > 0)
        .map((r) => ({ tanggal: r.tanggal, teks: r.catatan!.trim() })),
    },
    pemantauan: pemantauan(input.labs, input.meds, sampai),
  };
}

// ---------- Versi teks (untuk dibagikan / ditempel ke rekam medis) ----------

const ARAH_TEKS: Record<Arah, string> = { naik: 'naik', turun: 'turun', stabil: 'stabil' };

function daftarGejala(list: GejalaRingkas[]): string {
  if (list.length === 0) return '—';
  return list.map((g) => `${g.item} (${g.sistemLabel}, ${g.hari} hari)`).join('; ');
}

/**
 * Bentuk teks satu halaman, mengikuti kerangka Bagian 8 spesifikasi.
 * Dibuat murni dari objek `Ringkasan` agar isi layar dan isi teks tidak
 * pernah berbeda.
 */
export function ringkasanTeks(r: Ringkasan): string {
  const b: string[] = [];
  const k = r.kepala;

  b.push(`RINGKASAN PRA-KUNJUNGAN — ${k.inisial} · ID ${k.id}`);
  b.push(
    `Periode: ${tanggalPendek(k.dari)} s/d ${tanggalPendek(k.sampai)} · Check-in: ${k.jumlahCheckin} dari ${k.jumlahHari} hari`
  );
  b.push('');

  b.push('1. SKOR HARIAN (bukan PRO tervalidasi)');
  for (const s of r.skor) {
    if (s.awal == null && s.akhir == null) {
      b.push(`   - ${s.label}: belum ada data`);
      continue;
    }
    const seri = s.mingguan.map((m) => (m == null ? '–' : String(m))).join(' → ');
    b.push(
      `   - ${s.label}: ${s.akhir ?? '–'} terkini · tren ${ARAH_TEKS[s.arah]} (per minggu: ${seri})`
    );
  }
  b.push('');

  b.push('2. GEJALA MENONJOL (per sistem organ)');
  b.push(`   - Baru muncul: ${daftarGejala(r.gejala.baru)}`);
  b.push(`   - Makin sering: ${daftarGejala(r.gejala.memburuk)}`);
  b.push(`   - Menetap: ${daftarGejala(r.gejala.menetap)}`);
  b.push(`   - Berkurang: ${daftarGejala(r.gejala.membaik)}`);
  b.push('');

  b.push('3. PERUBAHAN & WAKTUNYA (deskriptif, bukan penilaian aktivitas penyakit)');
  if (r.perubahan.length === 0) {
    b.push('   - Data belum cukup untuk membandingkan dua periode.');
  } else {
    for (const p of r.perubahan) b.push(`   - ${p}`);
  }
  b.push('');

  b.push('4. KEPATUHAN & EFEK SAMPING OBAT');
  if (r.obat.daftar.length === 0) {
    b.push('   - Belum ada obat terdaftar di aplikasi.');
  } else {
    for (const o of r.obat.daftar) {
      b.push(`   - ${o.nama}: ${o.terlewat} hari ditandai belum diminum, ${o.diminum} hari sudah`);
    }
    b.push(`   - Hari tanpa catatan minum obat sama sekali: ${r.obat.hariTanpaCatatan}`);
  }
  if (r.obat.mars) {
    b.push(
      `   - MARS-5 (${tanggalPendek(r.obat.mars.tanggal)}): ${r.obat.mars.total}/25 · ${r.obat.mars.kategori}`
    );
  } else {
    b.push('   - MARS-5: belum diisi pada periode ini');
  }
  if (r.obat.alasan.length > 0) {
    for (const a of r.obat.alasan)
      b.push(`   - Alasan tercatat ${tanggalPendek(a.tanggal)}: ${a.teks}`);
  }
  b.push('   - Efek samping belum dikumpulkan secara terstruktur oleh aplikasi.');
  b.push('');

  b.push('5. EVENT RED-FLAG');
  if (r.redflag.length === 0) {
    b.push('   - Tidak ada peringatan red-flag pada periode ini.');
  } else {
    for (const e of r.redflag) {
      const tindak =
        e.level === 'darurat' ? 'diarahkan ke IGD' : 'diarahkan menghubungi tim ≤24 jam';
      b.push(
        `   - ${tanggalPendek(e.waktu)} · ${e.level} · ${e.tanda.join(', ') || 'tanpa tanda tercentang'} → ${tindak} (tindak lanjut pasien belum tercatat)`
      );
    }
  }
  b.push('');

  b.push('6. PERTANYAAN / KEKHAWATIRAN PASIEN');
  if (r.pertanyaan.pasien.length === 0 && r.pertanyaan.catatan.length === 0) {
    b.push('   - Tidak ada.');
  } else {
    for (const p of r.pertanyaan.pasien) b.push(`   - ${p}`);
    for (const c of r.pertanyaan.catatan) {
      b.push(`   - Catatan ${tanggalPendek(c.tanggal)}: ${c.teks}`);
    }
  }
  b.push('');

  b.push('7. PEMANTAUAN');
  if (r.pemantauan.length === 0) b.push('   - —');
  else for (const p of r.pemantauan) b.push(`   - ${p}`);
  b.push('');

  b.push(
    'Ringkasan ini dibuat otomatis dari catatan pasien. Bukan penilaian aktivitas penyakit dan bukan alat diagnosis.'
  );

  return b.join('\n');
}
