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
  DailyCheckin,
  FlareCheck,
  LabResult,
  MarsAssessment,
  MedLog,
  Medication,
  MedicationEvent,
  MedSideEffect,
} from '@/types/database';

export interface DataRingkasan {
  dari: string;
  sampai: string;
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

  const [c, me, ml, mev, ma, f, lab, es] = await Promise.all([
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

  return {
    dari,
    sampai,
    checkins: (c.data ?? []) as DailyCheckin[],
    meds: (me.data ?? []) as Medication[],
    medLogs: (ml.data ?? []) as MedLog[],
    medEvents: (mev.data ?? []) as MedicationEvent[],
    mars: (ma.data ?? []) as MarsAssessment[],
    flares: (f.data ?? []) as FlareCheck[],
    labs: (lab.data ?? []) as LabResult[],
    efekSamping: (es.data ?? []) as MedSideEffect[],
    error: [c.error, me.error, ml.error, ma.error, f.error].find(Boolean)?.message ?? null,
  };
}
