/**
 * Bentuk tabel Supabase untuk Teman Lupus.
 * Sumber kebenaran: teman-lupus-supabase-schema.sql (10 tabel + RLS).
 * Nama kolom sengaja dipertahankan dalam Bahasa Indonesia agar sama persis
 * dengan skema yang sudah live.
 */

export type Role = 'patient' | 'doctor' | 'admin';
export type FlareResult = 'green' | 'yellow' | 'red';

export type Profile = {
  id: string;
  role: Role;
  nama: string | null;
  no_hp: string | null;
  /**
   * Kode yang dibagikan dokter agar pasien bisa menautkan diri. NULL untuk
   * pasien. Lihat supabase/sisi_dokter.sql.
   */
  kode_dokter: string | null;
  /** Persetujuan PENGGUNAAN. NULL = belum menyetujui; wajib untuk memakai aplikasi. */
  consent_at: string | null;
  consent_version: string | null;
  /**
   * Persetujuan PENELITIAN — terpisah dan opsional.
   *
   * NULL = belum menjawab, true = ikut, false = menolak. Menolak TIDAK
   * membatasi pemakaian aplikasi. Perlakukan NULL sama seperti false saat
   * memutuskan apakah data boleh ikut ekspor penelitian — belum menjawab
   * bukan izin. Lihat supabase/consent_penelitian.sql.
   */
  consent_penelitian: boolean | null;
  consent_penelitian_at: string | null;
  created_at: string;
};

export type Patient = {
  id: string;
  profile_id: string;
  doctor_id: string | null;
  /** Diisi pasien sendiri. Usianya dihitung saat ditampilkan, tidak disimpan. */
  tgl_lahir: string | null;
  /** 'perempuan' | 'laki-laki'. Untuk keperluan epidemiologi. */
  jenis_kelamin: string | null;
  tgl_diagnosis: string | null;
  klasifikasi: string | null;
  organ_terlibat: string[] | null;
  created_at: string;
};

export type Medication = {
  id: string;
  patient_id: string;
  nama_obat: string;
  dosis: string | null;
  jadwal: string | null;
  /**
   * Berapa kali diminum pada SETIAP HARI MINUM (1–6) — bukan per hari kalender.
   * Untuk obat mingguan, ini jumlah dosis pada hari minumnya saja.
   * Lihat supabase/obat_frekuensi_dan_riwayat.sql.
   */
  frekuensi: number;
  /**
   * Jam minum per dosis, 'HH:MM' 24 jam, urut mengikuti `MedLog.slot`.
   * Dasar pengingat — lihat supabase/pengingat_obat.sql. NULL = tanpa pengingat.
   */
  jam: string[] | null;
  /**
   * Pola hari minum: 'harian' | 'mingguan' | 'selang'.
   * Lihat src/lib/pola-minum.ts dan supabase/obat_pola_minum.sql.
   */
  pola: string;
  /**
   * Untuk pola 'mingguan': hari minum menurut ISO, 1 = Senin … 7 = Minggu.
   *
   * ⚠️ Bukan penomoran JavaScript (`getDay()`: 0 = Minggu) dan bukan penomoran
   * expo-notifications (1 = Minggu). Penerjemahannya ada di `pola-minum.ts`.
   */
  hari_minggu: number[] | null;
  /** Untuk pola 'selang': tiap berapa hari (2–30). 2 = selang sehari. */
  selang_hari: number | null;
  /** Untuk pola 'selang': tanggal jangkar 'YYYY-MM-DD' yang dihitung sebagai hari minum. */
  mulai_tanggal: string | null;
  /** Keadaan sekarang saja; riwayatnya ada di `medication_events`. */
  aktif: boolean;
  created_at: string;
};

export type MedLog = {
  id: string;
  patient_id: string;
  medication_id: string | null;
  tanggal: string;
  /**
   * Dosis ke berapa pada hari itu, dihitung dari 0 (0 = dosis pertama).
   *
   * Kolom ini sudah ada sejak prototipe web beserta unique index
   * `(medication_id, tanggal, slot)`, meskipun tidak tercantum di
   * teman-lupus-supabase-schema.sql. Basisnya 0 karena baris lama memakai
   * nilai default 0 — mengubahnya ke basis 1 akan membuat catatan lama
   * terbaca sebagai dosis yang berbeda.
   */
  slot: number;
  diminum: boolean | null;
  alasan: string | null;
  created_at: string;
};

export type MedicationEventJenis = 'mulai' | 'stop' | 'lanjut';

/**
 * Riwayat mulai/berhenti/lanjut obat. BELUM ada di
 * teman-lupus-supabase-schema.sql — lihat
 * supabase/obat_frekuensi_dan_riwayat.sql.
 */
export type MedicationEvent = {
  id: string;
  patient_id: string;
  medication_id: string;
  jenis: MedicationEventJenis;
  tanggal: string;
  catatan: string | null;
  created_at: string;
};

/** Gejala per sistem organ, disimpan sebagai jsonb di kolom `gejala`. */
export type SymptomEntry = {
  system: string;
  item: string;
  present: boolean;
  severity?: number;
  change?: 'baru' | 'membaik' | 'sama' | 'memburuk';
};

export type DailyCheckin = {
  id: string;
  patient_id: string;
  tanggal: string;
  /** 1–5 */
  mood: number | null;
  /** 0–3. Nilai 4 ("Sangat berat") dipakai versi lama, lihat SKALA_LELAH. */
  lelah: number | null;
  /** 0–3 */
  nyeri_sendi: number | null;
  gejala: SymptomEntry[] | null;
  foto_url: string | null;
  catatan: string | null;
  created_at: string;
};

export type MarsAssessment = {
  id: string;
  patient_id: string;
  tanggal: string;
  item1: number | null;
  item2: number | null;
  item3: number | null;
  item4: number | null;
  item5: number | null;
  total: number | null;
  kategori: string | null;
  created_at: string;
};

export type FlareCheck = {
  id: string;
  patient_id: string;
  waktu: string;
  tanda_bahaya: Record<string, boolean> | null;
  gejala: Record<string, boolean> | null;
  hasil: FlareResult | null;
};

export type SledaiAssessment = {
  id: string;
  patient_id: string;
  doctor_id: string | null;
  tanggal: string;
  /**
   * Deskriptor yang dicentang. Baris yang dibuat aplikasi ini berbentuk
   * objek; baris warisan prototipe web berbentuk LARIK LABEL. Selalu baca
   * lewat `pisahkanDeskriptor()` — lihat catatannya di lib/sledai.ts.
   */
  deskriptor: Record<string, boolean> | string[] | null;
  total: number | null;
  kategori: string | null;
  /** PGA skala 0–3. NULL = belum dinilai, bukan nol. DORIS & LLDAS. */
  pga: number | null;
  /** Glukokortikoid harian setara prednison, mg. NULL = belum dicatat. */
  gc_mg: number | null;
  /** Pernyataan dokter: imunosupresan/biologik pada dosis pemeliharaan stabil. */
  terapi_stabil: boolean | null;
  created_at: string;
};

export type Visit = {
  id: string;
  patient_id: string;
  doctor_id: string | null;
  tanggal: string;
  catatan: string | null;
};

/**
 * Catatan: tabel ini dipakai prototipe web tetapi BELUM ada di
 * teman-lupus-supabase-schema.sql. Lihat supabase/lab_results.sql.
 */
export type LabResult = {
  id: string;
  patient_id: string;
  jenis: string;
  nilai_num: number | null;
  nilai_teks: string | null;
  satuan: string | null;
  tanggal: string | null;
  catatan: string | null;
  created_at: string;
};

/**
 * Pertanyaan yang pasien siapkan untuk kunjungan berikutnya (bagian 6
 * ringkasan pra-kunjungan). BELUM ada di teman-lupus-supabase-schema.sql —
 * lihat supabase/visit_questions.sql.
 */
export type VisitQuestion = {
  id: string;
  patient_id: string;
  teks: string;
  created_at: string;
};

/**
 * Efek samping obat yang dilaporkan pasien. Sengaja terpisah dari
 * `daily_checkins.gejala` — lihat catatan di supabase/efek_samping.sql.
 * BELUM ada di teman-lupus-supabase-schema.sql.
 */
export type MedSideEffect = {
  id: string;
  patient_id: string;
  /** NULL bila pasien tidak tahu obat mana penyebabnya. */
  medication_id: string | null;
  /** Kunci dari constants/efek-samping.ts. */
  jenis: string;
  tanggal: string;
  catatan: string | null;
  created_at: string;
};

export type Alert = {
  id: string;
  patient_id: string;
  /**
   * Cek Flare yang memicunya. NULL untuk peringatan dari sumber lain.
   * Lihat supabase/alerts_kunjungan.sql.
   */
  flare_check_id: string | null;
  /** 'flare_darurat' | 'flare_mendesak' untuk peringatan dari Cek Flare. */
  jenis: string | null;
  pesan: string | null;
  /**
   * True bila dokter sudah menindaklanjutinya.
   *
   * Rinciannya ada di `alert_tindak_lanjut`. Baris yang ditutup sebelum tabel
   * itu ada punya `selesai = true` TANPA rincian — jangan anggap keduanya
   * setara.
   */
  selesai: boolean;
  created_at: string;
};

/**
 * Apa yang terjadi sesudah sebuah peringatan red-flag.
 *
 * Tabel terpisah, bukan kolom di `alerts`, karena `catatan` adalah catatan
 * pribadi dokter dan RLS Postgres bekerja per-BARIS bukan per-KOLOM. Lihat
 * supabase/tindak_lanjut_alert.sql.
 */
export type AlertTindakLanjut = {
  id: string;
  alert_id: string;
  doctor_id: string;
  /** Kode dari `TINDAKAN` di constants/tindak-lanjut.ts — apa yang dokter lakukan. */
  tindakan: string;
  /** Kode dari `KONDISI` — keadaan pasien saat dihubungi. */
  kondisi: string;
  /** Catatan pribadi dokter. TIDAK ikut ringkasan maupun ekspor penelitian. */
  catatan: string | null;
  /** Distempel server. Selisihnya terhadap `alerts.created_at` = jam respons. */
  dibuat_pada: string;
};

/**
 * LupusQoL — kualitas hidup khusus SLE, 34 butir dalam 8 domain.
 *
 * Skor domain SENGAJA tidak disimpan: ia turunan murni dari `jawaban`, dan
 * menyimpan keduanya berarti keduanya bisa berselisih. Hitung dengan
 * `skorLupusQol()` di lib/lupusqol.ts. Lihat supabase/lupusqol.sql.
 */
export type LupusQolAssessment = {
  id: string;
  patient_id: string;
  tanggal: string;
  /** Kunci butir → nilai 0-4, mis. `{ fisik_1: 3 }`. */
  jawaban: Record<string, number> | null;
  /** Butir yang ditandai "tidak berlaku" — hanya domain hubungan intim. */
  tak_berlaku: string[] | null;
  created_at: string;
};

type Row<T> = {
  Row: T;
  Insert: Partial<T>;
  Update: Partial<T>;
  Relationships: [];
};

export type Database = {
  public: {
    Tables: {
      profiles: Row<Profile>;
      patients: Row<Patient>;
      medications: Row<Medication>;
      med_logs: Row<MedLog>;
      daily_checkins: Row<DailyCheckin>;
      mars_assessments: Row<MarsAssessment>;
      flare_checks: Row<FlareCheck>;
      sledai_assessments: Row<SledaiAssessment>;
      visits: Row<Visit>;
      alerts: Row<Alert>;
      alert_tindak_lanjut: Row<AlertTindakLanjut>;
      lupusqol_assessments: Row<LupusQolAssessment>;
      lab_results: Row<LabResult>;
      visit_questions: Row<VisitQuestion>;
      medication_events: Row<MedicationEvent>;
      med_side_effects: Row<MedSideEffect>;
    };
    Views: { [_ in never]: never };
    Functions: {
      /**
       * Dipanggil pasien untuk menautkan diri ke dokter lewat kode.
       * `security definer` — lihat supabase/sisi_dokter.sql.
       */
      tautkan_dokter: {
        Args: { kode: string };
        Returns: { nama_dokter: string | null }[];
      };
      /**
       * Dipanggil dokter untuk mengisi data klinis dasar pasiennya.
       * `security definer` — lihat supabase/data_klinis_dasar.sql.
       */
      simpan_data_klinis: {
        Args: {
          p_patient_id: string;
          p_tgl_diagnosis: string | null;
          p_klasifikasi: string | null;
          p_organ: string[];
        };
        Returns: undefined;
      };
      /**
       * Dipanggil dokter untuk menutup peringatan red-flag.
       *
       * Menyimpan tindak lanjut DAN menandai `alerts.selesai` dalam satu
       * transaksi — dua tulisan terpisah bisa gagal separuh dan meninggalkan
       * peringatan yang sudah ditangani tapi masih menumpuk di kotak masuk.
       * `security definer` — lihat supabase/tindak_lanjut_alert.sql.
       */
      /**
       * Pratinjau apa yang akan hilang bila akun dihapus. Hanya membaca.
       * `security definer` — lihat supabase/hapus_akun.sql.
       */
      pratinjau_hapus_akun: {
        Args: Record<string, never>;
        Returns: unknown;
      };
      /**
       * Menghapus akun pemanggil beserta seluruh datanya, permanen.
       *
       * Satu `delete from auth.users`; rantai CASCADE yang mengerjakan sisanya.
       * Untuk dokter, tautan pasien dilepas lebih dulu — data pasien TIDAK ikut.
       */
      hapus_akun_saya: {
        Args: Record<string, never>;
        Returns: undefined;
      };
      tutup_alert: {
        Args: {
          p_alert: string;
          p_tindakan: string;
          p_kondisi: string;
          p_catatan: string | null;
        };
        Returns: undefined;
      };
    };
    Enums: { [_ in never]: never };
    CompositeTypes: { [_ in never]: never };
  };
};
