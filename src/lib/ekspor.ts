/**
 * EKSPOR CSV UNTUK PENELITIAN.
 *
 * Murni tanpa I/O: menerima baris yang sudah diambil, mengembalikan berkas
 * siap tulis. Penulisan dan pembagian berkasnya ada di layarnya.
 *
 * PRIVASI — keputusan yang dipegang berkas ini
 *
 * 1. TANPA NAMA. Pasien diwakili `kode`, yaitu delapan karakter pertama UUID-
 *    nya. Kode yang sama sudah tampil di kepala ringkasan pra-kunjungan
 *    ("ID abc12345"), jadi konsistensinya bukan janji melainkan akibat: ia
 *    diturunkan dari id yang tidak pernah berubah, tanpa tabel pemetaan
 *    terpisah yang bisa hilang atau meleset. Anda tetap bisa menelusuri balik
 *    ke rekam medis lewat layar pasien.
 *
 * 2. TANPA TANGGAL LAHIR DAN TANPA TANGGAL DIAGNOSIS. Yang diekspor usia dalam
 *    tahun dan lama sakit dalam bulan. Keduanya membawa seluruh nilai
 *    analitiknya; tanggal mentahnya adalah pengenal semu yang, digabung dengan
 *    jenis kelamin dan tanggal kunjungan, bisa mempersempit identitas
 *    seseorang.
 *
 * 3. TANPA TEKS BEBAS. Catatan check-in, alasan tidak minum obat, dan
 *    pertanyaan pasien TIDAK ikut. Isinya sering menyebut nama orang, tempat,
 *    dan peristiwa. Yang diekspor hanya penandanya (`ada_catatan`), supaya
 *    kelengkapan datanya tetap bisa dihitung. Kalau protokol dan persetujuan
 *    etik Anda mencakup analisis kualitatif, teksnya bisa ditambahkan — tetapi
 *    itu keputusan yang harus diambil sadar, bukan bawaan.
 */

import { SLEDAI_DESKRIPTOR } from '@/constants/sledai';
import { buatCsv, type Kolom } from '@/lib/csv';
import { LUPUSQOL_DOMAIN, PERIODE_INGAT_MINGGU } from '@/constants/lupusqol';
import { lamaSakitBulan, usiaTahun } from '@/lib/klinis';
import { skorLupusQol } from '@/lib/lupusqol';
import { idPendek } from '@/lib/ringkasan';
import { pisahkanDeskriptor } from '@/lib/sledai';
import { nilaiDoris, nilaiLldas, skorKlinis } from '@/lib/target';
import { jamRespons } from '@/lib/tindak-lanjut';
import type {
  Alert,
  AlertTindakLanjut,
  DailyCheckin,
  LupusQolAssessment,
  FlareCheck,
  LabResult,
  MarsAssessment,
  MedLog,
  Medication,
  MedSideEffect,
  Patient,
  SledaiAssessment,
  Visit,
} from '@/types/database';

export interface DataEkspor {
  pasien: Patient[];
  sledai: SledaiAssessment[];
  checkins: DailyCheckin[];
  meds: Medication[];
  medLogs: MedLog[];
  efekSamping: MedSideEffect[];
  mars: MarsAssessment[];
  flares: FlareCheck[];
  /** Peringatan red-flag dan tindak lanjutnya, untuk kolom keluaran cek_flare. */
  alerts: Alert[];
  tindakLanjut: AlertTindakLanjut[];
  /** LupusQoL. Kosong sampai naskah resminya dilisensikan — lihat constants/lupusqol.ts. */
  lupusqol: LupusQolAssessment[];
  labs: LabResult[];
  visits: Visit[];
  /**
   * `patients.id` yang PEMILIKNYA menyetujui penelitian.
   *
   * Pasien di luar daftar ini dibuang dari SELURUH tabel sebelum apa pun
   * dirakit — lihat `saringIzin()`. Larik kosong berarti tidak ada satu pun
   * yang menyetujui, dan ekspornya memang kosong; itu hasil yang benar, bukan
   * kegagalan.
   */
  izinPenelitian: string[];
  /** Tanggal ekspor, dipakai menghitung usia & lama sakit. */
  tanggal: string;
}

/**
 * Membuang seluruh data pasien yang tidak menyetujui penelitian.
 *
 * SATU gerbang di pintu masuk, bukan penyaringan per tabel. Menyaring dua
 * belas tabel satu per satu berarti dua belas kesempatan untuk lupa — dan yang
 * terlupa adalah data kesehatan orang yang menyatakan tidak mau ikut. Tabel
 * baru yang ditambahkan nanti otomatis ikut tersaring di sini, asal ia punya
 * `patient_id`.
 *
 * `tindakLanjut` disaring lewat peringatan yang sudah lolos, bukan lewat
 * `patient_id` — ia memang tidak punya kolom itu.
 */
function saringIzin(d: DataEkspor): DataEkspor {
  const boleh = new Set(d.izinPenelitian);
  const p = <T extends { patient_id: string }>(rows: T[]) =>
    rows.filter((r) => boleh.has(r.patient_id));

  const alerts = p(d.alerts);
  const idAlert = new Set(alerts.map((a) => a.id));

  return {
    ...d,
    pasien: d.pasien.filter((x) => boleh.has(x.id)),
    sledai: p(d.sledai),
    checkins: p(d.checkins),
    meds: p(d.meds),
    medLogs: p(d.medLogs),
    efekSamping: p(d.efekSamping),
    mars: p(d.mars),
    flares: p(d.flares),
    alerts,
    tindakLanjut: d.tindakLanjut.filter((t) => idAlert.has(t.alert_id)),
    labs: p(d.labs),
    visits: p(d.visits),
    lupusqol: p(d.lupusqol),
  };
}

export interface BerkasCsv {
  nama: string;
  isi: string;
  baris: number;
}

const kode = (patientId: string) => idPendek(patientId);

/** Satu tabel: nama berkas, kolomnya, dan barisnya. */
function tabel<T>(nama: string, kolom: Kolom<T>[], baris: T[]): BerkasCsv {
  return { nama, isi: buatCsv(kolom, baris), baris: baris.length };
}

/**
 * Menjodohkan tiap penilaian SLEDAI dengan penilaian SEBELUMNYA milik pasien
 * yang sama — syarat LLDAS "tidak ada aktivitas baru" membutuhkannya.
 *
 * Diurutkan naik per pasien lalu dipasangkan; penilaian pertama tiap pasien
 * mendapat `null`, yang berarti "tanpa pembanding" dan bukan "belum diambil".
 */
function denganPembanding(
  rows: SledaiAssessment[]
): { s: SledaiAssessment; sebelumnya: SledaiAssessment['deskriptor'] | null }[] {
  const perPasien = new Map<string, SledaiAssessment[]>();
  for (const s of rows) {
    const daftar = perPasien.get(s.patient_id) ?? [];
    daftar.push(s);
    perPasien.set(s.patient_id, daftar);
  }
  const out: { s: SledaiAssessment; sebelumnya: SledaiAssessment['deskriptor'] | null }[] = [];
  for (const daftar of perPasien.values()) {
    const urut = [...daftar].sort((a, b) => a.tanggal.localeCompare(b.tanggal));
    urut.forEach((s, i) => out.push({ s, sebelumnya: i === 0 ? null : urut[i - 1].deskriptor }));
  }
  return out.sort(
    (a, b) =>
      kode(a.s.patient_id).localeCompare(kode(b.s.patient_id)) ||
      a.s.tanggal.localeCompare(b.s.tanggal)
  );
}

export function rakitEkspor(semua: DataEkspor): BerkasCsv[] {
  // Gerbang izin dilewati SEBELUM apa pun dibaca. Segala sesuatu di bawah
  // baris ini hanya melihat pasien yang menyetujui penelitian.
  const d = saringIzin(semua);

  const namaObat = new Map(d.meds.map((m) => [m.id, m.nama_obat]));
  const obatKode = (medId: string | null) => (medId ? idPendek(medId) : null);

  return [
    tabel<Patient>(
      'pasien.csv',
      [
        { judul: 'kode', ambil: (p) => kode(p.id) },
        { judul: 'jenis_kelamin', ambil: (p) => p.jenis_kelamin },
        { judul: 'usia_tahun', ambil: (p) => usiaTahun(p.tgl_lahir, d.tanggal) },
        { judul: 'lama_sakit_bulan', ambil: (p) => lamaSakitBulan(p.tgl_diagnosis, d.tanggal) },
        { judul: 'klasifikasi', ambil: (p) => p.klasifikasi },
        // Dipisah titik koma, bukan koma: koma di dalam sel akan memaksa
        // kutip dan menyulitkan pemisahan ulang saat dianalisis.
        { judul: 'organ_terlibat', ambil: (p) => (p.organ_terlibat ?? []).join(';') },
      ],
      [...d.pasien].sort((a, b) => kode(a.id).localeCompare(kode(b.id)))
    ),

    tabel(
      'sledai.csv',
      [
        { judul: 'kode', ambil: (r) => kode(r.s.patient_id) },
        { judul: 'tanggal', ambil: (r) => r.s.tanggal },
        { judul: 'sledai_2k', ambil: (r) => r.s.total },
        { judul: 'kategori', ambil: (r) => r.s.kategori },
        { judul: 'csledai_2k', ambil: (r) => skorKlinis(r.s.deskriptor) },
        { judul: 'pga', ambil: (r) => r.s.pga },
        { judul: 'gc_mg_setara_prednison', ambil: (r) => r.s.gc_mg },
        { judul: 'terapi_stabil', ambil: (r) => r.s.terapi_stabil },
        { judul: 'doris_2021', ambil: (r) => statusTarget(r, 'doris') },
        { judul: 'lldas', ambil: (r) => statusTarget(r, 'lldas') },
        // Satu kolom 0/1 per deskriptor. Totalnya saja tidak cukup untuk
        // menganalisis pola keterlibatan organ, dan menyusunnya ulang dari
        // jsonb di luar aplikasi berarti menduplikasi aturan pemetaannya.
        ...SLEDAI_DESKRIPTOR.map((dk): Kolom<{ s: SledaiAssessment }> => ({
          judul: `d_${dk.key}`,
          ambil: (r) => pisahkanDeskriptor(r.s.deskriptor).dipilih[dk.key] === true,
        })),
      ],
      denganPembanding(d.sledai)
    ),

    tabel<DailyCheckin>(
      'checkin.csv',
      [
        { judul: 'kode', ambil: (c) => kode(c.patient_id) },
        { judul: 'tanggal', ambil: (c) => c.tanggal },
        { judul: 'mood_1_5', ambil: (c) => c.mood },
        { judul: 'lelah_0_3', ambil: (c) => c.lelah },
        { judul: 'nyeri_sendi_0_3', ambil: (c) => c.nyeri_sendi },
        { judul: 'jumlah_gejala', ambil: (c) => (c.gejala ?? []).filter((g) => g.present).length },
        // Teks catatannya sengaja tidak ikut — lihat catatan privasi di kepala.
        { judul: 'ada_catatan', ambil: (c) => (c.catatan ?? '').trim().length > 0 },
      ],
      urut(d.checkins, (c) => [kode(c.patient_id), c.tanggal])
    ),

    tabel(
      'gejala.csv',
      [
        { judul: 'kode', ambil: (g: GejalaBaris) => g.kode },
        { judul: 'tanggal', ambil: (g) => g.tanggal },
        { judul: 'sistem', ambil: (g) => g.sistem },
        { judul: 'gejala', ambil: (g) => g.item },
      ],
      gejalaPanjang(d.checkins)
    ),

    tabel<Medication>(
      'obat.csv',
      [
        { judul: 'kode', ambil: (m) => kode(m.patient_id) },
        { judul: 'obat_kode', ambil: (m) => idPendek(m.id) },
        { judul: 'nama_obat', ambil: (m) => m.nama_obat },
        { judul: 'dosis', ambil: (m) => m.dosis },
        { judul: 'frekuensi_per_hari', ambil: (m) => m.frekuensi },
        { judul: 'aktif', ambil: (m) => m.aktif },
      ],
      urut(d.meds, (m) => [kode(m.patient_id), m.nama_obat])
    ),

    tabel<MedLog>(
      'dosis.csv',
      [
        { judul: 'kode', ambil: (l) => kode(l.patient_id) },
        { judul: 'tanggal', ambil: (l) => l.tanggal },
        { judul: 'obat_kode', ambil: (l) => obatKode(l.medication_id) },
        { judul: 'nama_obat', ambil: (l) => namaObat.get(l.medication_id ?? '') ?? null },
        // Berbasis 0 di database; dinaikkan jadi 1 di sini karena "dosis ke-0"
        // tidak punya arti bagi pembaca tabel.
        { judul: 'dosis_ke', ambil: (l) => (l.slot ?? 0) + 1 },
        { judul: 'diminum', ambil: (l) => l.diminum },
      ],
      urut(d.medLogs, (l) => [kode(l.patient_id), l.tanggal, String(l.slot ?? 0)])
    ),

    tabel<MedSideEffect>(
      'efek_samping.csv',
      [
        { judul: 'kode', ambil: (e) => kode(e.patient_id) },
        { judul: 'tanggal', ambil: (e) => e.tanggal },
        { judul: 'jenis', ambil: (e) => e.jenis },
        { judul: 'obat_kode', ambil: (e) => obatKode(e.medication_id) },
      ],
      urut(d.efekSamping, (e) => [kode(e.patient_id), e.tanggal, e.jenis])
    ),

    tabel<MarsAssessment>(
      'mars.csv',
      [
        { judul: 'kode', ambil: (m) => kode(m.patient_id) },
        { judul: 'tanggal', ambil: (m) => m.tanggal },
        { judul: 'item1', ambil: (m) => m.item1 },
        { judul: 'item2', ambil: (m) => m.item2 },
        { judul: 'item3', ambil: (m) => m.item3 },
        { judul: 'item4', ambil: (m) => m.item4 },
        { judul: 'item5', ambil: (m) => m.item5 },
        { judul: 'total', ambil: (m) => m.total },
        { judul: 'kategori', ambil: (m) => m.kategori },
      ],
      urut(d.mars, (m) => [kode(m.patient_id), m.tanggal])
    ),

    tabel<BarisFlare>(
      'cek_flare.csv',
      [
        { judul: 'kode', ambil: (f) => kode(f.flare.patient_id) },
        { judul: 'waktu', ambil: (f) => f.flare.waktu },
        { judul: 'hasil', ambil: (f) => f.flare.hasil },
        {
          judul: 'jumlah_tanda_bahaya',
          ambil: (f) => Object.values(f.flare.tanda_bahaya ?? {}).filter(Boolean).length,
        },
        {
          judul: 'jumlah_gejala',
          ambil: (f) => Object.values(f.flare.gejala ?? {}).filter(Boolean).length,
        },
        // Tiga kolom keluaran. Kosong berarti belum ditindaklanjuti — dan itu
        // temuan tersendiri, bukan data yang hilang.
        { judul: 'tindakan_dokter', ambil: (f) => f.lanjut?.tindakan ?? null },
        { judul: 'kondisi_pasien', ambil: (f) => f.lanjut?.kondisi ?? null },
        {
          judul: 'jam_ke_tindak_lanjut',
          // Satu desimal: jaraknya diukur dalam jam, dan presisi menit di
          // kolom ini akan mengesankan ketepatan yang tidak dimiliki datanya.
          ambil: (f) => (f.jam == null ? null : Number(f.jam.toFixed(1))),
        },
      ],
      barisFlare(d)
    ),

    tabel<LabResult>(
      'lab.csv',
      [
        { judul: 'kode', ambil: (l) => kode(l.patient_id) },
        { judul: 'tanggal', ambil: (l) => l.tanggal },
        { judul: 'jenis', ambil: (l) => l.jenis },
        { judul: 'nilai_num', ambil: (l) => l.nilai_num },
        { judul: 'nilai_teks', ambil: (l) => l.nilai_teks },
        { judul: 'satuan', ambil: (l) => l.satuan },
      ],
      urut(d.labs, (l) => [kode(l.patient_id), l.tanggal ?? '', l.jenis])
    ),

    tabel<Visit>(
      'kunjungan.csv',
      [
        { judul: 'kode', ambil: (v) => kode(v.patient_id) },
        { judul: 'tanggal', ambil: (v) => v.tanggal },
      ],
      urut(d.visits, (v) => [kode(v.patient_id), v.tanggal])
    ),

    tabel<LupusQolAssessment>(
      'lupusqol.csv',
      [
        { judul: 'kode', ambil: (q) => kode(q.patient_id) },
        { judul: 'tanggal', ambil: (q) => q.tanggal },
        // Satu kolom skor + satu kolom kelengkapan per domain. Kelengkapannya
        // ikut karena skor domain dihitung dari butir yang TERJAWAB saja —
        // tanpa penyebutnya, 100 dari satu butir tak bisa dibedakan dari 100
        // dari delapan butir.
        ...LUPUSQOL_DOMAIN.flatMap((dom): Kolom<LupusQolAssessment>[] => [
          {
            judul: dom.key,
            ambil: (q) => skorLupusQol(q.jawaban ?? {}).domain.find((x) => x.key === dom.key)!.skor,
          },
          {
            judul: `${dom.key}_terjawab`,
            ambil: (q) =>
              skorLupusQol(q.jawaban ?? {}).domain.find((x) => x.key === dom.key)!.terjawab,
          },
        ]),
        { judul: 'butir_terjawab', ambil: (q) => skorLupusQol(q.jawaban ?? {}).terjawab },
        { judul: 'jumlah_tak_berlaku', ambil: (q) => (q.tak_berlaku ?? []).length },
      ],
      urut(d.lupusqol, (q) => [kode(q.patient_id), q.tanggal])
    ),

    keterangan(d),
  ];
}

type Target = 'doris' | 'lldas';

function statusTarget(
  r: { s: SledaiAssessment; sebelumnya: SledaiAssessment['deskriptor'] | null },
  mana: Target
): string {
  const masuk = {
    deskriptor: r.s.deskriptor,
    pga: r.s.pga,
    gcMg: r.s.gc_mg,
    terapiStabil: r.s.terapi_stabil,
    sebelumnya: r.sebelumnya,
  };
  return (mana === 'doris' ? nilaiDoris(masuk) : nilaiLldas(masuk)).status;
}

interface GejalaBaris {
  kode: string;
  tanggal: string;
  sistem: string;
  item: string;
}

/**
 * Gejala dalam bentuk PANJANG: satu baris per gejala per hari.
 *
 * Bukan satu kolom per gejala. Daftar gejala bisa bertambah, dan bentuk lebar
 * memaksa seluruh berkas lama ditulis ulang setiap kali itu terjadi.
 */
function gejalaPanjang(checkins: DailyCheckin[]): GejalaBaris[] {
  const out: GejalaBaris[] = [];
  for (const c of checkins) {
    for (const g of c.gejala ?? []) {
      if (!g.present) continue;
      out.push({ kode: kode(c.patient_id), tanggal: c.tanggal, sistem: g.system, item: g.item });
    }
  }
  return urut(out, (g) => [g.kode, g.tanggal, g.sistem, g.item]);
}

interface BarisFlare {
  flare: FlareCheck;
  lanjut: AlertTindakLanjut | null;
  jam: number | null;
}

/**
 * Cek flare beserta keluarannya.
 *
 * Ditelusuri lewat `flare_check_id`, bukan lewat kecocokan waktu: satu pasien
 * bisa mengisi dua cek flare dalam menit yang sama, dan pasangan yang tertukar
 * akan mengarang keluaran klinis di data penelitian.
 *
 * `catatan` dokter TIDAK ikut — sama seperti seluruh teks bebas lain di ekspor
 * ini, dan alasannya lebih kuat lagi: ia ditulis untuk dokternya sendiri.
 */
function barisFlare(d: DataEkspor): BarisFlare[] {
  const alertPerFlare = new Map(
    d.alerts.filter((a) => a.flare_check_id).map((a) => [a.flare_check_id!, a])
  );
  const lanjutPerAlert = new Map(d.tindakLanjut.map((t) => [t.alert_id, t]));

  const baris = d.flares.map((flare) => {
    const alert = alertPerFlare.get(flare.id);
    const lanjut = (alert ? lanjutPerAlert.get(alert.id) : undefined) ?? null;
    return {
      flare,
      lanjut,
      // Diukur dari terbitnya peringatan, bukan dari waktu cek flare: itulah
      // saat yang dokter benar-benar bisa melihatnya.
      jam: lanjut ? jamRespons(alert?.created_at, lanjut.dibuat_pada) : null,
    };
  });

  return urut(baris, (b) => [kode(b.flare.patient_id), b.flare.waktu]);
}

/**
 * Berkas keterangan — asal-usul ekspornya.
 *
 * Enam bulan setelah analisis, pertanyaan "jendela SLEDAI yang dipakai berapa
 * hari" tidak boleh dijawab dengan mengingat-ingat. Ia ikut di dalam berkas.
 */
function keterangan(d: DataEkspor): BerkasCsv {
  const isi: { kunci: string; nilai: string }[] = [
    { kunci: 'tanggal_ekspor', nilai: d.tanggal },
    { kunci: 'jumlah_pasien', nilai: String(d.pasien.length) },
    {
      kunci: 'dasar_penyertaan',
      nilai: 'hanya pasien yang menyetujui penelitian (profiles.consent_penelitian = true)',
    },
    { kunci: 'jumlah_penilaian_sledai', nilai: String(d.sledai.length) },
    { kunci: 'jumlah_checkin', nilai: String(d.checkins.length) },
    { kunci: 'identitas', nilai: 'tanpa nama; kode = 8 karakter pertama UUID pasien' },
    { kunci: 'tanggal_lahir_diekspor', nilai: 'tidak; hanya usia dalam tahun' },
    { kunci: 'tanggal_diagnosis_diekspor', nilai: 'tidak; hanya lama sakit dalam bulan' },
    { kunci: 'teks_bebas_diekspor', nilai: 'tidak; catatan & alasan tidak ikut' },
    { kunci: 'instrumen', nilai: 'SLEDAI-2K (Gladman dkk. 2002, PMID 11838846)' },
    { kunci: 'jendela_sledai', nilai: 'saat pemeriksaan atau 10 hari terakhir' },
    { kunci: 'kategori_sledai', nilai: 'Carter dkk. 2016 (PMID 27558659)' },
    { kunci: 'doris', nilai: 'DORIS 2021 (van Vollenhoven dkk., PMID 34819388)' },
    { kunci: 'lldas', nilai: 'LLDAS (kriteria operasional lewat PMID 37798595)' },
    {
      kunci: 'catatan_lldas',
      nilai: 'anemia hemolitik & gastrointestinal tidak ada di SLEDAI-2K, tidak ikut diperiksa',
    },
    { kunci: 'nilai_status_target', nilai: 'tercapai | tidak | belum-lengkap' },
    {
      kunci: 'nilai_tindakan_dokter',
      nilai: 'edukasi | obat_disesuaikan | kunjungan_dipercepat | dirujuk | tak_terhubung',
    },
    {
      kunci: 'nilai_kondisi_pasien',
      nilai: 'membaik_sendiri | masih_bergejala | sudah_ke_igd | dirawat_inap | tidak_diketahui',
    },
    {
      kunci: 'tindak_lanjut_kosong',
      nilai: 'peringatan belum ditindaklanjuti — bukan data hilang',
    },
    {
      kunci: 'jam_ke_tindak_lanjut',
      nilai: 'diukur dari terbitnya peringatan, bukan dari waktu cek flare',
    },
    {
      kunci: 'lupusqol',
      nilai:
        'McElhone dkk. 2007 (PMID 17665467); versi Indonesia Anindito dkk., Indones J Rheumatol 2016;8(2):38-44',
    },
    {
      kunci: 'lupusqol_skala',
      nilai: `domain 0-100, makin tinggi makin BAIK; periode ingat ${PERIODE_INGAT_MINGGU} minggu`,
    },
    {
      kunci: 'lupusqol_butir_kosong',
      nilai: 'dikeluarkan dari rata-rata domain, tidak dihitung nol — lihat kolom *_terjawab',
    },
    {
      kunci: 'lupusqol_tanpa_skor_total',
      nilai: 'instrumen aslinya tidak mendefinisikan skor total; hanya 8 skor domain yang diekspor',
    },
  ];
  return tabel<{ kunci: string; nilai: string }>(
    'keterangan.csv',
    [
      { judul: 'kunci', ambil: (r) => r.kunci },
      { judul: 'nilai', ambil: (r) => r.nilai },
    ],
    isi
  );
}

/** Urut stabil menurut beberapa kunci, supaya dua ekspor bisa dibandingkan. */
function urut<T>(rows: T[], kunci: (r: T) => string[]): T[] {
  return [...rows].sort((a, b) => {
    const ka = kunci(a);
    const kb = kunci(b);
    for (let i = 0; i < ka.length; i++) {
      const c = ka[i].localeCompare(kb[i]);
      if (c !== 0) return c;
    }
    return 0;
  });
}
