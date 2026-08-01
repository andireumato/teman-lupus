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

import { LABEL_EFEK } from '@/constants/efek-samping';
import { labelJenisKelamin, labelOrgan, sistemDariOrgan } from '@/constants/klinis';
import { SISTEM_GEJALA } from '@/constants/lupus';
import { mundurHari, selisihHari, tanggalPendek } from '@/lib/dates';
import { lamaSakit, usiaTahun } from '@/lib/klinis';
import { PERTANYAAN_MENDESAK, PERTANYAAN_TANDA_BAHAYA } from '@/lib/redflag';
import {
  isiTindakLanjut,
  jamRespons,
  labelJeda,
  type TindakLanjutRingkas,
} from '@/lib/tindak-lanjut';
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

// ---------- Masukan & keluaran ----------

export interface RingkasanInput {
  /** Batas periode, YYYY-MM-DD, inklusif di kedua ujung. */
  dari: string;
  sampai: string;
  pasien: { inisial: string; id: string };
  /**
   * Data klinis dasar yang diisi dokter (`patients`). Boleh kosong seluruhnya —
   * kolomnya nullable dan pasien baru belum punya isinya.
   */
  klinis?: {
    /** Diisi pasien di `/profil`. */
    tglLahir: string | null;
    jenisKelamin: string | null;
    /** Tiga di bawah diisi dokter di `/dokter/klinis/[id]`. */
    tglDiagnosis: string | null;
    klasifikasi: string | null;
    organ: string[] | null;
  };
  checkins: DailyCheckin[];
  /** Semua obat, termasuk yang sudah dihentikan. */
  meds: Medication[];
  medLogs: MedLog[];
  /** Riwayat mulai/stop/lanjut obat. */
  medEvents: MedicationEvent[];
  /** Efek samping yang dilaporkan pasien. */
  efekSamping: MedSideEffect[];
  mars: MarsAssessment[];
  flares: FlareCheck[];
  /**
   * Peringatan otomatis dan tindak lanjutnya, untuk bagian 5.
   *
   * OPSIONAL, dan layar pasien sengaja tidak mengisinya: `alert_tindak_lanjut`
   * hanya bisa dibaca dokter pemiliknya, jadi bagi pasien keduanya akan selalu
   * kosong. Dibiarkan opsional supaya perbedaan itu terlihat di tanda tangan
   * fungsinya, bukan tersembunyi sebagai larik kosong yang menipu.
   */
  alerts?: Alert[];
  tindakLanjut?: AlertTindakLanjut[];
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
  /**
   * Tanggal terakhir gejala ini dilaporkan, YYYY-MM-DD.
   *
   * Tanpa ini dokter tidak bisa tahu kapan pasien memasukkannya, dan sebuah
   * keluhan dari tiga minggu lalu terbaca sama mendesaknya dengan keluhan
   * kemarin.
   */
  terakhir: string;
  /**
   * Jumlah hari check-in SESUDAH `terakhir` yang tidak menyebutkan gejala ini.
   *
   * Nol berarti gejalanya masih dilaporkan pada check-in terbaru. Angka besar
   * berarti pasien tetap mengisi tetapi keluhannya sudah tidak ada lagi — dan
   * itu bukti yang berbeda sama sekali dari pasien yang berhenti mengisi.
   */
  checkinSesudahnya: number;
}

export interface ObatTerlewat {
  /** id baris `medications` — dua obat bisa punya nama sama. */
  id: string;
  nama: string;
  /** Berapa kali diminum per hari. */
  frekuensi: number;
  /** Dosis yang ditandai "belum diminum". */
  terlewat: number;
  /** Dosis yang ditandai "sudah diminum". */
  diminum: number;
  /** False bila obat sudah dihentikan. */
  aktif: boolean;
  /**
   * Perubahan obat pada periode ini, sudah diringkas jadi satu frasa
   * ("stop 12 Jul 2026, lanjut 20 Jul 2026"). Menempel pada obatnya, bukan
   * jadi daftar terpisah: pembaca ringkasan butuh tahu obat MANA yang
   * berubah, bukan mengurutkan sendiri dua daftar.
   */
  perubahan: string;
}

export interface EventRedFlag {
  id: string;
  waktu: string;
  level: 'darurat' | 'mendesak';
  /** Label bahasa awam dari tanda yang dicentang pasien. */
  tanda: string[];
  /** Apa yang terjadi sesudahnya. null bila belum dicatat. */
  tindakLanjut: TindakLanjutRingkas | null;
  /**
   * Peringatannya sudah ditandai selesai, tapi tanpa rincian apa pun.
   *
   * Dibedakan dari `tindakLanjut === null` yang biasa: baris ini ditutup
   * sebelum pencatatan tindak lanjut ada, jadi rinciannya tidak akan pernah
   * datang. Menyamakan keduanya membuat data lama tampak seperti pekerjaan
   * yang belum selesai, dan itu akan terus mengganggu selamanya.
   */
  selesaiTanpaRincian: boolean;
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
    /** Usia dalam tahun penuh di akhir periode; null bila belum diisi. */
    usia: number | null;
    /** "Perempuan" / "Laki-laki"; null bila belum diisi. */
    jenisKelamin: string | null;
    /** "4 tahun 2 bulan" sejak tanggal diagnosis; null bila belum diisi. */
    lamaSakit: string | null;
    /** Kriteria klasifikasi yang dipakai; null bila belum diisi. */
    klasifikasi: string | null;
    /** Label organ yang tercatat pernah terlibat. Kosong bila belum diisi. */
    organ: string[];
  };
  skor: TrenSkor[];
  gejala: Record<KategoriGejala, GejalaRingkas[]>;
  /**
   * Sistem organ yang gejalanya dicatat pasien pada periode ini, tetapi TIDAK
   * ada dalam daftar organ terlibat di data klinis dasar.
   *
   * Deskriptif, bukan kesimpulan: ini hanya menunjukkan bahwa catatan pasien
   * dan catatan organ terlibat tidak sejalan. Penyebabnya bisa keterlibatan
   * organ baru, bisa juga keluhan yang tidak ada hubungannya dengan lupus,
   * atau daftar organ yang memang belum diperbarui. Yang membedakan dokter.
   *
   * Kosong bila daftar organ terlibat belum diisi — tanpa pembanding, "belum
   * tercatat" tidak berarti apa-apa.
   */
  sistemBelumTercatat: { sistemLabel: string; items: string[] }[];
  /**
   * Kalimat deskriptif dalam satuan asli check-in: hitungan hari, tanggal
   * mulai memberat, gejala yang muncul bersamaan, dan hari yang tidak
   * terpantau. Bukan penilaian aktivitas penyakit. Kosong bila tidak ada.
   */
  perubahan: string[];
  obat: {
    /** Data mentah per obat; dipertahankan agar bisa diaudit & diuji. */
    daftar: ObatTerlewat[];
    /**
     * Tiga kelompok berikut adalah bentuk siap-baca dari `daftar`, masing-masing
     * menjawab satu pertanyaan: sedang minum apa, apa yang berubah, seberapa
     * patuh. Dirakit di sini supaya layar dan versi teks tidak bisa berbeda.
     */
    sedangDiminum: { id: string; nama: string; frekuensi: number }[];
    perubahan: { id: string; nama: string; teks: string }[];
    dosis: {
      diminum: number;
      /** Diminum + terlewat. Penyebut yang jujur: hari tanpa catatan tidak ikut. */
      tercatat: number;
      terlewat: { id: string; nama: string; jumlah: number }[];
    };
    /**
     * Efek samping yang dilaporkan pasien, digabung per jenis. Terpisah dari
     * gejala di bagian 2 karena keluhan yang sama bisa datang dari lupusnya
     * atau dari obatnya — yang membedakan penilaian dokter, bukan aplikasi.
     */
    efekSamping: { jenis: string; label: string; jumlah: number; terakhir: string }[];
    /** Hari dalam periode tanpa satu pun catatan minum obat. */
    hariTanpaCatatan: number;
    mars: { tanggal: string; total: number; kategori: string } | null;
    /** Alasan bebas yang ditulis pasien di catatan minum obat. */
    alasan: { id: string; tanggal: string; teks: string }[];
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
  { key: 'lelah', label: 'Kelelahan (0–3, makin tinggi makin berat)', maks: 3 },
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

/**
 * Berapa hari check-in tanpa keluhan sebelum gejala dianggap sudah berhenti.
 *
 * Tiga, bukan satu: satu hari tanpa keluhan terlalu mudah membuat kategorinya
 * bolak-balik antar-kunjungan, dan dokter yang membaca ringkasan dua kali
 * dalam seminggu akan melihat gejala yang sama berpindah kolom tanpa sebab
 * klinis.
 */
const AMBANG_BERHENTI = 3;

function gejalaMenonjol(
  rows: DailyCheckin[],
  dari: string,
  sampai: string
): Record<KategoriGejala, GejalaRingkas[]> {
  const batas = tengahPeriode(dari, sampai);
  const awal = rows.filter((r) => r.tanggal < batas);
  const akhir = rows.filter((r) => r.tanggal >= batas);

  type Hitung = {
    system: string;
    item: string;
    awal: number;
    akhir: number;
    terakhir: string;
  };
  const peta = new Map<string, Hitung>();

  const catat = (bagian: DailyCheckin[], sisi: 'awal' | 'akhir') => {
    for (const r of bagian) {
      for (const g of r.gejala ?? []) {
        if (!g.present) continue;
        const k = `${g.system}|${g.item}`;
        const h = peta.get(k) ?? {
          system: g.system,
          item: g.item,
          awal: 0,
          akhir: 0,
          terakhir: r.tanggal,
        };
        h[sisi] += 1;
        // Baris check-in tidak dijamin urut, jadi tanggal terbesar yang menang.
        if (r.tanggal > h.terakhir) h.terakhir = r.tanggal;
        peta.set(k, h);
      }
    }
  };
  catat(awal, 'awal');
  catat(akhir, 'akhir');

  // Tanggal seluruh hari check-in dalam periode, untuk menghitung berapa hari
  // pasien tetap mengisi SESUDAH sebuah gejala terakhir dilaporkan.
  const hariCheckin = rows.map((r) => r.tanggal);

  const hasil: Record<KategoriGejala, GejalaRingkas[]> = {
    baru: [],
    memburuk: [],
    menetap: [],
    membaik: [],
  };

  for (const h of peta.values()) {
    const freqAwal = awal.length === 0 ? 0 : h.awal / awal.length;
    const freqAkhir = akhir.length === 0 ? 0 : h.akhir / akhir.length;

    // Hari pasien tetap mengisi tetapi tidak lagi menyebut gejala ini.
    const checkinSesudahnya = hariCheckin.filter((t) => t > h.terakhir).length;
    const sudahBerhenti = checkinSesudahnya >= AMBANG_BERHENTI;

    let kategori: KategoriGejala;
    if (awal.length === 0 || akhir.length === 0) {
      // Tanpa pembanding di salah satu paruh, "baru" atau "membaik" tidak bisa
      // dibuktikan. Dicatat netral sebagai menetap agar tidak menyesatkan.
      kategori = 'menetap';
    } else if (sudahBerhenti) {
      // DIPERIKSA SEBELUM `baru`, dan urutan itu inti perbaikannya.
      //
      // Sebelum 1 Agustus 2026, `h.awal === 0` diperiksa lebih dahulu, sehingga
      // gejala yang pertama muncul di paruh kedua TIDAK PERNAH bisa keluar dari
      // "Baru muncul" — berapa lama pun sudah berhenti. Ruam yang dilaporkan
      // sekali lalu hilang tetap terbaca sebagai keluhan baru berminggu-minggu
      // kemudian.
      //
      // `sudahBerhenti` menuntut pasien MASIH mengisi check-in sesudahnya.
      // Pasien yang berhenti mengisi sama sekali tidak akan pernah masuk sini:
      // tidak adanya data bukan tidak adanya gejala.
      kategori = 'membaik';
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
      terakhir: h.terakhir,
      checkinSesudahnya,
    });
  }

  for (const k of Object.keys(hasil) as KategoriGejala[]) {
    hasil[k].sort((a, b) => b.hari - a.hari || a.item.localeCompare(b.item));
  }
  return hasil;
}

/**
 * Gejala yang tercatat pada sistem organ di luar daftar organ terlibat.
 *
 * Sengaja satu baris untuk seluruh periode, bukan penanda menempel di tiap
 * gejala: penanda per baris membuat bagian 2 penuh label dan justru menutupi
 * hal yang mau ditonjolkan. Semua kategori ikut dihitung — gejala yang MENETAP
 * pada sistem yang belum tercatat sama pentingnya dengan yang baru muncul,
 * karena artinya daftar organnya mungkin sudah tertinggal.
 */
function sistemBelumTercatat(
  gejala: Record<KategoriGejala, GejalaRingkas[]>,
  organ: string[] | null | undefined
): Ringkasan['sistemBelumTercatat'] {
  // Penjaganya adalah panjang daftar ORGAN, bukan jumlah sistem hasil
  // pemetaannya. Sebagian domain (mata, gastrointestinal, antifosfolipid)
  // sengaja tidak punya padanan gejala pasien; kalau yang diperiksa hasil
  // pemetaan, dokter yang hanya mencatat domain-domain itu akan kehilangan
  // seluruh penandaan tanpa ada yang memberi tahu.
  if ((organ ?? []).length === 0) return [];
  const tercatat = sistemDariOrgan(organ);

  const per = new Map<string, { sistemLabel: string; items: Set<string> }>();
  for (const list of Object.values(gejala)) {
    for (const g of list) {
      if (tercatat.has(g.system)) continue;
      const s = per.get(g.system) ?? { sistemLabel: g.sistemLabel, items: new Set<string>() };
      s.items.add(g.item);
      per.set(g.system, s);
    }
  }

  return [...per.values()]
    .map((s) => ({ sistemLabel: s.sistemLabel, items: [...s.items].sort() }))
    .sort((a, b) => a.sistemLabel.localeCompare(b.sistemLabel));
}

// ---------- 3. Perubahan & waktunya ----------

/**
 * Bagian ini menghemat pekerjaan yang kalau tidak ada harus dilakukan dengan
 * membaca seluruh log: sejak kapan memberat, apa yang muncul bersamaan, dan
 * kapan datanya kosong.
 *
 * Aturan yang sengaja dipegang:
 * - Tidak ada skor gabungan. Versi pertama menjumlahkan kelelahan dan
 *   nyeri sendi menjadi satu "skor beban" — angka yang tampak objektif
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
/**
 * Kelelahan (skala 0–3): 2 = sedang, 3 = berat.
 *
 * Disamakan dengan nyeri sendi atas keputusan reumatolog (27 Juli 2026).
 * Semula hanya menghitung tingkat teratas, padahal patokan "Sedang" pada
 * kedua skala sama-sama berarti kegiatan harus dikurangi — sudah bermakna
 * dan sebelumnya tidak terhitung sama sekali.
 */
const AMBANG_LELAH = 2;
/** Mood (skala 1–5): 1 = sangat buruk, 2 = buruk. */
const AMBANG_MOOD = 2;
/** Panjang jendela pembanding, dipotong bila periodenya pendek. */
const JENDELA_MAKS = 14;
/** Panjang minimum rentetan hari berturut-turut sebelum disebut "mulai memberat". */
const MIN_BERUNTUN = 3;
/** Jarak maksimum antar gejala baru agar disebut muncul bersamaan. */
const JARAK_BERSAMAAN = 7;

interface Metrik {
  nama: string;
  /** Batas skala aslinya, ikut disebut supaya angkanya bisa dibaca sendiri. */
  min: number;
  max: number;
  ambang: number;
  /** 'atas' = nilai ≥ ambang dihitung; 'bawah' = nilai ≤ ambang. */
  arah: 'atas' | 'bawah';
  /** True bila nilai hari itu memenuhi ambang. */
  test: (r: DailyCheckin) => boolean;
}

const METRIK: Metrik[] = [
  {
    nama: 'Nyeri sendi sedang–berat',
    min: 0,
    max: 3,
    ambang: AMBANG_NYERI,
    arah: 'atas',
    test: (r) => r.nyeri_sendi != null && r.nyeri_sendi >= AMBANG_NYERI,
  },
  {
    nama: 'Kelelahan sedang–berat',
    min: 0,
    max: 3,
    ambang: AMBANG_LELAH,
    arah: 'atas',
    test: (r) => r.lelah != null && r.lelah >= AMBANG_LELAH,
  },
  {
    nama: 'Mood buruk',
    min: 1,
    max: 5,
    ambang: AMBANG_MOOD,
    arah: 'bawah',
    test: (r) => r.mood != null && r.mood <= AMBANG_MOOD,
  },
];

/**
 * "Nyeri sendi sedang–berat (2–3 dari skala 0–3)".
 *
 * Notasi "≥2" dibuang: pembacanya harus tahu dulu skalanya 0–3 untuk paham
 * artinya. Rentangnya diturunkan dari ambang, jadi label tidak bisa meleset
 * ketika ambangnya diubah.
 */
function rentangMetrik(m: Metrik): string {
  const angka =
    m.arah === 'atas'
      ? m.ambang >= m.max
        ? `${m.ambang}`
        : `${m.ambang}–${m.max}`
      : m.ambang <= m.min
        ? `${m.ambang}`
        : `${m.min}–${m.ambang}`;
  return `${angka} dari skala ${m.min}–${m.max}`;
}

function labelMetrik(m: Metrik): string {
  return `${m.nama} (${rentangMetrik(m)})`;
}

/** Metrik nyeri sendi, dipakai juga oleh kalimat "mulai memberat". */
const METRIK_NYERI = METRIK[0];

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

    out.push(`${labelMetrik(m)}: ${sisiBaru}, ${sisiLama}.`);
  }

  const rentetan = rentetanNyeri(rows);
  if (rentetan) {
    out.push(
      `Mulai memberat sekitar ${tanggalPendek(rentetan.mulai)} — hari pertama dari ${rentetan.panjang} hari berturut-turut dengan ${METRIK_NYERI.nama.toLowerCase()} (${rentangMetrik(METRIK_NYERI)}).`
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

const KATA_EVENT: Record<MedicationEvent['jenis'], string> = {
  mulai: 'mulai',
  stop: 'stop',
  lanjut: 'lanjut',
};

function ringkasEfekSamping(
  efek: MedSideEffect[],
  dari: string,
  sampai: string
): Ringkasan['obat']['efekSamping'] {
  const per = new Map<string, { jumlah: number; terakhir: string }>();
  for (const e of efek) {
    if (e.tanggal < dari || e.tanggal > sampai) continue;
    const s = per.get(e.jenis) ?? { jumlah: 0, terakhir: e.tanggal };
    per.set(e.jenis, {
      jumlah: s.jumlah + 1,
      terakhir: e.tanggal > s.terakhir ? e.tanggal : s.terakhir,
    });
  }
  return [...per.entries()]
    .map(([jenis, s]) => ({
      jenis,
      // Kunci yang tidak dikenal tetap ditampilkan apa adanya: daftar efek
      // samping bisa berubah, dan laporan lama tidak boleh hilang diam-diam.
      label: LABEL_EFEK.get(jenis) ?? jenis,
      jumlah: s.jumlah,
      terakhir: s.terakhir,
    }))
    .sort((a, b) => b.jumlah - a.jumlah || a.label.localeCompare(b.label));
}

function ringkasObat(
  meds: Medication[],
  logs: MedLog[],
  events: MedicationEvent[],
  efek: MedSideEffect[],
  mars: MarsAssessment[],
  dari: string,
  sampai: string
): Ringkasan['obat'] {
  const dalamPeriode = logs.filter((l) => l.tanggal >= dari && l.tanggal <= sampai);
  const namaObat = new Map(meds.map((m) => [m.id, m.nama_obat]));

  const eventPeriode = events
    .filter((e) => e.tanggal >= dari && e.tanggal <= sampai)
    .sort((a, b) => a.tanggal.localeCompare(b.tanggal));

  // Obat yang dihentikan tetap dilaporkan bila masih ada jejaknya pada periode
  // ini: kalau tidak, obat yang baru distop kemarin akan hilang dari ringkasan
  // yang justru dibawa ke kontrol.
  const adaJejak = (id: string) =>
    dalamPeriode.some((l) => l.medication_id === id) ||
    eventPeriode.some((e) => e.medication_id === id);

  const perubahanObat = (id: string) =>
    eventPeriode
      .filter((e) => e.medication_id === id)
      .map(
        (e) =>
          `${KATA_EVENT[e.jenis]} ${tanggalPendek(e.tanggal)}${
            e.catatan ? ` (${e.catatan.trim()})` : ''
          }`
      )
      .join(', ');

  const daftar: ObatTerlewat[] = meds
    .filter((m) => m.aktif || adaJejak(m.id))
    .map((m) => {
      const milik = dalamPeriode.filter((l) => l.medication_id === m.id);
      return {
        id: m.id,
        nama: m.nama_obat,
        frekuensi: m.frekuensi ?? 1,
        aktif: m.aktif,
        perubahan: perubahanObat(m.id),
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
      id: l.id,
      tanggal: l.tanggal,
      teks: `${namaObat.get(l.medication_id ?? '') ?? 'Obat'}: ${l.alasan!.trim()}`,
    }));

  const urut = daftar.sort((a, b) => b.terlewat - a.terlewat || a.nama.localeCompare(b.nama));

  return {
    daftar: urut,
    sedangDiminum: urut
      .filter((o) => o.aktif)
      .map((o) => ({ id: o.id, nama: o.nama, frekuensi: o.frekuensi })),
    perubahan: urut
      .filter((o) => o.perubahan)
      .map((o) => ({ id: o.id, nama: o.nama, teks: o.perubahan })),
    dosis: {
      diminum: urut.reduce((n, o) => n + o.diminum, 0),
      tercatat: urut.reduce((n, o) => n + o.diminum + o.terlewat, 0),
      terlewat: urut
        .filter((o) => o.terlewat > 0)
        .map((o) => ({ id: o.id, nama: o.nama, jumlah: o.terlewat })),
    },
    efekSamping: ringkasEfekSamping(efek, dari, sampai),
    hariTanpaCatatan: daftar.length === 0 ? 0 : Math.max(0, totalHari - hariTercatat),
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

function eventRedFlag(
  flares: FlareCheck[],
  alerts: Alert[],
  tindakLanjut: AlertTindakLanjut[],
  dari: string,
  sampai: string
): EventRedFlag[] {
  // Cek flare → peringatan → tindak lanjut. Ditelusuri lewat `flare_check_id`,
  // bukan lewat kecocokan waktu: satu pasien bisa mengisi dua cek flare dalam
  // menit yang sama, dan pasangan yang tertukar akan mengarang keluaran klinis.
  const alertPerFlare = new Map(
    alerts.filter((a) => a.flare_check_id).map((a) => [a.flare_check_id!, a])
  );
  const lanjutPerAlert = new Map(tindakLanjut.map((t) => [t.alert_id, t]));

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

      const alert = alertPerFlare.get(f.id);
      const lanjut = alert ? lanjutPerAlert.get(alert.id) : undefined;

      return {
        id: f.id,
        waktu: f.waktu,
        level: f.hasil === 'red' ? ('darurat' as const) : ('mendesak' as const),
        tanda: dicentang,
        tindakLanjut: lanjut
          ? {
              waktu: lanjut.dibuat_pada,
              // Diukur dari terbitnya peringatan, bukan dari waktu cek flare:
              // itulah saat yang dokter benar-benar bisa melihatnya.
              jam: jamRespons(alert?.created_at, lanjut.dibuat_pada),
              tindakan: lanjut.tindakan,
              kondisi: lanjut.kondisi,
            }
          : null,
        selesaiTanpaRincian: !!alert?.selesai && !lanjut,
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
  const redflag = eventRedFlag(
    input.flares,
    input.alerts ?? [],
    input.tindakLanjut ?? [],
    dari,
    sampai
  );

  return {
    kepala: {
      inisial: input.pasien.inisial,
      id: input.pasien.id,
      dari,
      sampai,
      jumlahCheckin: rows.length,
      jumlahHari: selisihHari(dari, sampai) + 1,
      // Usia dan lama sakit dihitung sampai akhir periode, bukan sampai hari
      // ini: ringkasan periode lama harus tetap berbunyi sama kalau dibuka
      // lagi bulan depan.
      usia: usiaTahun(input.klinis?.tglLahir, sampai),
      jenisKelamin: labelJenisKelamin(input.klinis?.jenisKelamin),
      lamaSakit: lamaSakit(input.klinis?.tglDiagnosis, sampai),
      klasifikasi: input.klinis?.klasifikasi ?? null,
      organ: (input.klinis?.organ ?? []).map(labelOrgan),
    },
    skor: trenSkor(rows, dari, sampai),
    gejala,
    sistemBelumTercatat: sistemBelumTercatat(gejala, input.klinis?.organ),
    perubahan: perubahanTerkini(rows, dari, sampai),
    obat: ringkasObat(
      input.meds,
      input.medLogs,
      input.medEvents,
      input.efekSamping,
      input.mars,
      dari,
      sampai
    ),
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

/**
 * Satu baris gejala untuk teks ringkasan.
 *
 * Tanggal terakhir SELALU ikut. Tanpa itu, keluhan tiga minggu lalu terbaca
 * sama mendesaknya dengan keluhan kemarin — dan dokter tidak punya cara
 * membedakannya dari halaman ini.
 */
function daftarGejala(list: GejalaRingkas[]): string {
  if (list.length === 0) return '—';
  return list
    .map((g) => {
      const sesudah =
        g.checkinSesudahnya > 0
          ? `, ${g.checkinSesudahnya} check-in sesudahnya tanpa keluhan ini`
          : '';
      return `${g.item} (${g.sistemLabel}, ${g.hari} hari, terakhir ${tanggalPendek(g.terakhir)}${sesudah})`;
    })
    .join('; ');
}

/**
 * Bentuk teks satu halaman, mengikuti kerangka Bagian 8 spesifikasi.
 * Dibuat murni dari objek `Ringkasan` agar isi layar dan isi teks tidak
 * pernah berbeda.
 */
export function ringkasanTeks(r: Ringkasan): string {
  const b: string[] = [];
  const k = r.kepala;

  // Usia & jenis kelamin menempel pada baris identitas, bukan baris klinis:
  // keduanya konteks untuk membaca SEMUA isi di bawahnya, bukan salah satu
  // bagiannya. Yang kosong hilang tanpa meninggalkan pemisah menggantung.
  const diri = [k.jenisKelamin, k.usia != null ? `${k.usia} tahun` : null]
    .filter(Boolean)
    .join(', ');
  b.push(
    `RINGKASAN PRA-KUNJUNGAN — ${[k.inisial, diri || null, `ID ${k.id}`].filter(Boolean).join(' · ')}`
  );
  b.push(
    `Periode: ${tanggalPendek(k.dari)} s/d ${tanggalPendek(k.sampai)} · Check-in: ${k.jumlahCheckin} dari ${k.jumlahHari} hari`
  );
  // Baris data klinis dasar hanya muncul bila ada isinya: baris berisi tiga
  // tanda "—" tidak memberi tahu apa pun selain bahwa kolomnya kosong.
  const klinis = [
    k.lamaSakit ? `Sejak diagnosis: ${k.lamaSakit}` : null,
    k.klasifikasi,
    k.organ.length > 0 ? `Organ terlibat: ${k.organ.join(', ')}` : null,
  ].filter(Boolean);
  if (klinis.length > 0) b.push(klinis.join(' · '));
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
  if (r.sistemBelumTercatat.length > 0) {
    b.push(
      `   - Di luar organ terlibat yang tercatat: ${r.sistemBelumTercatat
        .map((s) => `${s.sistemLabel} (${s.items.join(', ')})`)
        .join('; ')}`
    );
  }
  b.push('');

  b.push('3. PERUBAHAN & WAKTUNYA (deskriptif, bukan penilaian aktivitas penyakit)');
  if (r.perubahan.length === 0) {
    b.push('   - Data belum cukup untuk membandingkan dua periode.');
  } else {
    for (const p of r.perubahan) b.push(`   - ${p}`);
  }
  b.push('');

  // Sengaja padat: satu baris per obat, tanggal perubahan menempel pada
  // obatnya, dan tidak ada kalimat yang bercerita tentang aplikasi alih-alih
  // tentang pasien. Keterbatasan efek samping cukup disebut di judul.
  // Dikelompokkan per pertanyaan, bukan per obat: tiap baris menjawab satu
  // hal — sedang minum apa, apa yang berubah, seberapa patuh — sehingga
  // jumlah barisnya tetap berapa pun banyaknya obat.
  b.push('4. OBAT');
  b.push(
    r.obat.sedangDiminum.length === 0
      ? '   - Sedang diminum: tidak ada obat aktif'
      : `   - Sedang diminum: ${r.obat.sedangDiminum
          .map((o) => `${o.nama} (${o.frekuensi}x/hari)`)
          .join(', ')}`
  );
  if (r.obat.perubahan.length > 0) {
    b.push(`   - Perubahan: ${r.obat.perubahan.map((o) => `${o.nama} ${o.teks}`).join('; ')}`);
  }
  if (r.obat.dosis.tercatat > 0) {
    const terlewat =
      r.obat.dosis.terlewat.length > 0
        ? `; terlewat: ${r.obat.dosis.terlewat.map((o) => `${o.nama} ${o.jumlah}`).join(', ')}`
        : '';
    b.push(
      `   - Dosis diminum: ${r.obat.dosis.diminum} dari ${r.obat.dosis.tercatat} yang tercatat${terlewat}`
    );
  }
  const mars = r.obat.mars
    ? `MARS-5 ${r.obat.mars.total}/25 ${r.obat.mars.kategori} (${tanggalPendek(r.obat.mars.tanggal)})`
    : 'MARS-5 belum diisi';
  const kosong =
    r.obat.hariTanpaCatatan > 0
      ? ` · ${r.obat.hariTanpaCatatan} dari ${r.kepala.jumlahHari} hari tanpa catatan`
      : '';
  b.push(`   - ${mars}${kosong}`);
  if (r.obat.efekSamping.length > 0) {
    b.push(
      `   - Efek samping dilaporkan: ${r.obat.efekSamping
        .map((e) => `${e.label} ${e.jumlah}× (terakhir ${tanggalPendek(e.terakhir)})`)
        .join('; ')}`
    );
  }
  for (const a of r.obat.alasan) {
    b.push(`   - Alasan: ${tanggalPendek(a.tanggal)} ${a.teks}`);
  }
  b.push('');

  b.push('5. EVENT RED-FLAG');
  if (r.redflag.length === 0) {
    b.push('   - Tidak ada peringatan red-flag pada periode ini.');
  } else {
    for (const e of r.redflag) {
      const arahan =
        e.level === 'darurat' ? 'diarahkan ke IGD' : 'diarahkan menghubungi tim ≤24 jam';
      b.push(
        `   - ${tanggalPendek(e.waktu)} · ${e.level} · ${e.tanda.join(', ') || 'tanpa tanda tercentang'}`
      );
      b.push(`       → ${arahan}`);

      // Tiga keadaan yang sengaja dibedakan. "Belum ditindaklanjuti" adalah
      // temuan yang perlu dilihat dokter; "ditutup tanpa rincian" adalah baris
      // lama yang tidak akan pernah lengkap. Menyamakan keduanya membuat yang
      // pertama tenggelam di antara yang kedua.
      if (e.tindakLanjut) {
        const jeda = labelJeda(e.tindakLanjut.jam);
        const kapan = tanggalPendek(e.tindakLanjut.waktu) + (jeda ? ` (${jeda})` : '');
        b.push(`       → ${kapan}: ${isiTindakLanjut(e.tindakLanjut)}`);
      } else if (e.selesaiTanpaRincian) {
        b.push('       → ditandai selesai, tanpa rincian');
      } else {
        b.push('       → belum ditindaklanjuti');
      }
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
    'Ringkasan ini dibuat otomatis dari catatan pasien. Efek samping adalah yang DILAPORKAN ' +
      'pasien, belum dipilah dari aktivitas penyakit. Bukan penilaian aktivitas penyakit dan ' +
      'bukan alat diagnosis.'
  );

  return b.join('\n');
}
