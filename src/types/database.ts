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
  /** NULL = pasien belum menyetujui informed consent. */
  consent_at: string | null;
  consent_version: string | null;
  created_at: string;
};

export type Patient = {
  id: string;
  profile_id: string;
  doctor_id: string | null;
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
  /** Berapa kali diminum per hari (1–6). Lihat supabase/obat_frekuensi_dan_riwayat.sql. */
  frekuensi: number;
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
  deskriptor: Record<string, boolean> | null;
  total: number | null;
  kategori: string | null;
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

export type Alert = {
  id: string;
  patient_id: string;
  jenis: string | null;
  pesan: string | null;
  selesai: boolean;
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
      lab_results: Row<LabResult>;
      visit_questions: Row<VisitQuestion>;
      medication_events: Row<MedicationEvent>;
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
    };
    Enums: { [_ in never]: never };
    CompositeTypes: { [_ in never]: never };
  };
};
