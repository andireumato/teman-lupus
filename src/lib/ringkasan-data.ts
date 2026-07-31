/**
 * Pengambilan data untuk ringkasan pra-kunjungan.
 *
 * Dipisahkan dari layarnya karena dipakai dua pihak: pasien melihat
 * ringkasannya sendiri, dokter melihat ringkasan pasiennya. Keduanya harus
 * membaca data yang sama persis — kalau tidak, dokter dan pasien bisa membahas
 * dua ringkasan yang berbeda isinya.
 *
 * Yang membatasi siapa boleh melihat apa adalah RLS di Supabase, bukan fungsi
 * ini: dokter hanya menerima baris pasien yang `doctor_id`-nya dia.
 */

import { mundurHari, todayISO } from '@/lib/dates';
import { supabase } from '@/lib/supabase';
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
  Patient,
} from '@/types/database';

export interface DataRingkasan {
  dari: string;
  sampai: string;
  /**
   * Data klinis dasar dari baris `patients`. Diambil di sini, bukan di layar
   * dokter saja, supaya pasien dan dokter membaca kepala ringkasan yang sama.
   */
  klinis: {
    tglLahir: string | null;
    jenisKelamin: string | null;
    tglDiagnosis: string | null;
    klasifikasi: string | null;
    organ: string[] | null;
  };
  checkins: DailyCheckin[];
  meds: Medication[];
  medLogs: MedLog[];
  medEvents: MedicationEvent[];
  efekSamping: MedSideEffect[];
  mars: MarsAssessment[];
  flares: FlareCheck[];
  labs: LabResult[];
  /** Pesan galat pertama yang penting; null bila semuanya berhasil. */
  error: string | null;
}

export async function ambilDataRingkasan(
  patientId: string,
  jumlahHari: number
): Promise<DataRingkasan> {
  const sampai = todayISO();
  const dari = mundurHari(sampai, jumlahHari - 1);

  const [pat, c, me, ml, mev, ma, f, lab, es] = await Promise.all([
    supabase
      .from('patients')
      .select('tgl_lahir, jenis_kelamin, tgl_diagnosis, klasifikasi, organ_terlibat')
      .eq('id', patientId)
      .maybeSingle(),
    supabase
      .from('daily_checkins')
      .select('*')
      .eq('patient_id', patientId)
      .gte('tanggal', dari)
      .lte('tanggal', sampai),
    // Termasuk obat yang sudah dihentikan: obat yang distop di tengah periode
    // justru penting dibawa ke kontrol.
    supabase.from('medications').select('*').eq('patient_id', patientId),
    supabase
      .from('med_logs')
      .select('*')
      .eq('patient_id', patientId)
      .gte('tanggal', dari)
      .lte('tanggal', sampai),
    supabase
      .from('medication_events')
      .select('*')
      .eq('patient_id', patientId)
      .gte('tanggal', dari)
      .lte('tanggal', sampai),
    supabase.from('mars_assessments').select('*').eq('patient_id', patientId).limit(20),
    supabase
      .from('flare_checks')
      .select('*')
      .eq('patient_id', patientId)
      .gte('waktu', `${dari}T00:00:00`)
      .lte('waktu', `${sampai}T23:59:59`)
      .order('waktu', { ascending: true }),
    // lab_results & medication_events belum tentu ada di project Supabase
    // lama; kegagalannya hanya mengosongkan bagiannya, bukan menghapus yang
    // lain, jadi keduanya tidak ikut dilaporkan sebagai galat.
    supabase.from('lab_results').select('*').eq('patient_id', patientId).limit(100),
    supabase
      .from('med_side_effects')
      .select('*')
      .eq('patient_id', patientId)
      .gte('tanggal', dari)
      .lte('tanggal', sampai),
  ]);

  const p = pat.data as Pick<
    Patient,
    'tgl_lahir' | 'jenis_kelamin' | 'tgl_diagnosis' | 'klasifikasi' | 'organ_terlibat'
  > | null;

  return {
    dari,
    sampai,
    klinis: {
      tglLahir: p?.tgl_lahir ?? null,
      jenisKelamin: p?.jenis_kelamin ?? null,
      tglDiagnosis: p?.tgl_diagnosis ?? null,
      klasifikasi: p?.klasifikasi ?? null,
      organ: p?.organ_terlibat ?? null,
    },
    checkins: (c.data ?? []) as DailyCheckin[],
    meds: (me.data ?? []) as Medication[],
    medLogs: (ml.data ?? []) as MedLog[],
    medEvents: (mev.data ?? []) as MedicationEvent[],
    mars: (ma.data ?? []) as MarsAssessment[],
    flares: (f.data ?? []) as FlareCheck[],
    labs: (lab.data ?? []) as LabResult[],
    efekSamping: (es.data ?? []) as MedSideEffect[],
    error:
      [pat.error, c.error, me.error, ml.error, ma.error, f.error].find(Boolean)?.message ?? null,
  };
}

export interface DataPeringatan {
  alerts: Alert[];
  tindakLanjut: AlertTindakLanjut[];
}

/**
 * Peringatan red-flag beserta tindak lanjutnya — UNTUK DOKTER SAJA.
 *
 * Sengaja TIDAK digabung ke `ambilDataRingkasan`. Fungsi itu dipakai bersama
 * dan namanya berjanji bahwa pasien dan dokter membaca data yang sama;
 * `alert_tindak_lanjut` justru satu-satunya bagian yang TIDAK sama, karena
 * hanya dokter pemiliknya yang boleh membacanya. Menyelipkannya di sana akan
 * membuat janji itu diam-diam tidak lagi benar.
 *
 * Tidak disaring tanggal: penautannya lewat `flare_check_id`, dan daftar cek
 * flare-nya sudah dibatasi periode di `ambilDataRingkasan`.
 *
 * Kegagalannya mengosongkan hasil, bukan melempar — tabelnya baru, dan
 * ringkasan harus tetap terbuka di project yang belum menjalankan
 * supabase/tindak_lanjut_alert.sql.
 */
export async function ambilPeringatan(patientId: string): Promise<DataPeringatan> {
  const al = await supabase
    .from('alerts')
    .select('*')
    .eq('patient_id', patientId)
    .order('created_at', { ascending: false })
    .limit(100);

  const alerts = (al.data ?? []) as Alert[];
  if (alerts.length === 0) return { alerts: [], tindakLanjut: [] };

  const tl = await supabase
    .from('alert_tindak_lanjut')
    .select('*')
    .in(
      'alert_id',
      alerts.map((a) => a.id)
    );

  return { alerts, tindakLanjut: (tl.data ?? []) as AlertTindakLanjut[] };
}
