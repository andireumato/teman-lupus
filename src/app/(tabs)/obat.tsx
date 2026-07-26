import { useCallback, useState } from 'react';
import { Link, useFocusEffect } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import {
  Card,
  Disclaimer,
  Field,
  GhostButton,
  InfoBar,
  Loading,
  Msg,
  PrimaryButton,
  Screen,
  SectionLabel,
  Segmented,
} from '@/components/ui/kit';
import { Brand, radius, space } from '@/constants/brand';
import { DISCLAIMER } from '@/constants/consent';
import { tanggalPendek, todayISO } from '@/lib/dates';
import { useSession } from '@/lib/session';
import { supabase } from '@/lib/supabase';
import type { MedLog, Medication, MedicationEvent } from '@/types/database';

/** Pilihan frekuensi; nilainya = jumlah dosis per hari. */
const FREKUENSI = [
  { v: 1, label: '1x sehari' },
  { v: 2, label: '2x sehari' },
  { v: 3, label: '3x sehari' },
  { v: 4, label: '4x sehari' },
];

/** Kunci catatan satu dosis pada satu hari. */
const kunciDosis = (medicationId: string, dosisKe: number) => `${medicationId}|${dosisKe}`;

/** Tabel/kolom baru belum tentu ada di project Supabase lama. */
function pesanSkemaObat(pesan: string): string {
  return /frekuensi|dosis_ke|medication_events/.test(pesan)
    ? 'Skema obat di Supabase belum diperbarui. Jalankan supabase/obat_frekuensi_dan_riwayat.sql di SQL Editor.'
    : pesan;
}

export default function ObatScreen() {
  const { patientId } = useSession();
  const hariIni = todayISO();

  const [loading, setLoading] = useState(true);
  const [meds, setMeds] = useState<Medication[]>([]);
  const [berhenti, setBerhenti] = useState<Medication[]>([]);
  const [logs, setLogs] = useState<Record<string, MedLog>>({});
  const [events, setEvents] = useState<MedicationEvent[]>([]);
  const [tambah, setTambah] = useState(false);
  const [nama, setNama] = useState('');
  const [dosis, setDosis] = useState('');
  const [jadwal, setJadwal] = useState('');
  const [frekuensi, setFrekuensi] = useState(1);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const muat = useCallback(async () => {
    if (!patientId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setErr(null);

    const [{ data: m, error: em }, { data: l, error: el }, { data: ev, error: ee }] =
      await Promise.all([
        supabase
          .from('medications')
          .select('*')
          .eq('patient_id', patientId)
          .order('created_at', { ascending: true }),
        supabase.from('med_logs').select('*').eq('patient_id', patientId).eq('tanggal', hariIni),
        supabase
          .from('medication_events')
          .select('*')
          .eq('patient_id', patientId)
          .order('tanggal', { ascending: false }),
      ]);

    if (em || el || ee) {
      setErr(pesanSkemaObat((em ?? el ?? ee)?.message ?? 'Gagal memuat data obat.'));
      setLoading(false);
      return;
    }

    const semua = (m ?? []) as Medication[];
    setMeds(semua.filter((x) => x.aktif));
    setBerhenti(semua.filter((x) => !x.aktif));
    setEvents((ev ?? []) as MedicationEvent[]);

    const map: Record<string, MedLog> = {};
    for (const row of (l ?? []) as MedLog[]) {
      if (row.medication_id) map[kunciDosis(row.medication_id, row.dosis_ke ?? 1)] = row;
    }
    setLogs(map);
    setLoading(false);
  }, [patientId, hariIni]);

  useFocusEffect(
    useCallback(() => {
      void muat();
    }, [muat])
  );

  /** Tanggal berhenti terakhir sebuah obat, untuk daftar obat lama. */
  function tanggalBerhenti(medId: string): string | null {
    return events.find((e) => e.medication_id === medId && e.jenis === 'stop')?.tanggal ?? null;
  }

  async function tandai(med: Medication, dosisKe: number, diminum: boolean) {
    if (!patientId) return;
    setErr(null);

    const k = kunciDosis(med.id, dosisKe);
    const sebelumnya = logs;
    // Optimistic: pasien menandai obat berkali-kali sehari; menunggu jaringan
    // membuat tombol terasa rusak.
    setLogs((prev) => ({
      ...prev,
      [k]: {
        ...(prev[k] ?? ({} as MedLog)),
        medication_id: med.id,
        dosis_ke: dosisKe,
        diminum,
      } as MedLog,
    }));

    const { error } = await supabase.from('med_logs').upsert(
      {
        patient_id: patientId,
        medication_id: med.id,
        tanggal: hariIni,
        dosis_ke: dosisKe,
        diminum,
      },
      { onConflict: 'patient_id,medication_id,tanggal,dosis_ke' }
    );

    if (error) {
      setLogs(sebelumnya);
      setErr(pesanSkemaObat(`Gagal menyimpan: ${error.message}`));
      return;
    }
    await muat();
  }

  async function simpanObat() {
    if (!patientId) return;
    if (!nama.trim()) {
      setErr('Nama obat wajib diisi.');
      return;
    }
    setBusy(true);
    const { data, error } = await supabase
      .from('medications')
      .insert({
        patient_id: patientId,
        nama_obat: nama.trim(),
        dosis: dosis.trim() || null,
        jadwal: jadwal.trim() || null,
        frekuensi,
      })
      .select('id')
      .maybeSingle();

    if (error) {
      setBusy(false);
      setErr(pesanSkemaObat(`Gagal menambah obat: ${error.message}`));
      return;
    }

    if (data?.id) {
      await supabase.from('medication_events').insert({
        patient_id: patientId,
        medication_id: data.id,
        jenis: 'mulai',
        tanggal: hariIni,
      });
    }

    setBusy(false);
    setNama('');
    setDosis('');
    setJadwal('');
    setFrekuensi(1);
    setTambah(false);
    await muat();
  }

  /**
   * Menghentikan obat TIDAK menghapus datanya: barisnya hanya ditandai tidak
   * aktif dan pindah ke daftar "pernah diminum", plus satu event bertanggal
   * supaya ringkasan pra-kunjungan bisa menyebutkannya.
   */
  async function hentikan(med: Medication) {
    if (!patientId) return;
    const { error } = await supabase.from('medications').update({ aktif: false }).eq('id', med.id);
    if (error) {
      setErr(pesanSkemaObat(`Gagal menghentikan: ${error.message}`));
      return;
    }
    const { error: ee } = await supabase.from('medication_events').insert({
      patient_id: patientId,
      medication_id: med.id,
      jenis: 'stop',
      tanggal: hariIni,
    });
    if (ee)
      setErr(pesanSkemaObat(`Obat dihentikan, tetapi tanggalnya gagal dicatat: ${ee.message}`));
    await muat();
  }

  async function lanjutkan(med: Medication) {
    if (!patientId) return;
    const { error } = await supabase.from('medications').update({ aktif: true }).eq('id', med.id);
    if (error) {
      setErr(pesanSkemaObat(`Gagal melanjutkan: ${error.message}`));
      return;
    }
    const { error: ee } = await supabase.from('medication_events').insert({
      patient_id: patientId,
      medication_id: med.id,
      jenis: 'lanjut',
      tanggal: hariIni,
    });
    if (ee)
      setErr(pesanSkemaObat(`Obat dilanjutkan, tetapi tanggalnya gagal dicatat: ${ee.message}`));
    await muat();
  }

  if (loading) return <Loading />;

  const totalDosis = meds.reduce((n, m) => n + (m.frekuensi ?? 1), 0);
  // Hanya obat yang sedang diminum: obat yang dihentikan hari ini bisa punya
  // catatan hari ini juga, dan akan membuat hitungannya melebihi totalnya.
  const sudah = meds.reduce(
    (n, m) =>
      n +
      Array.from({ length: m.frekuensi ?? 1 }, (_, i) => i + 1).filter(
        (d) => logs[kunciDosis(m.id, d)]?.diminum === true
      ).length,
    0
  );

  return (
    <Screen>
      <InfoBar>
        Daftar obatmu sekaligus catatan kepatuhan — tandai tiap dosis yang sudah kamu minum hari
        ini.
      </InfoBar>

      {err && <Msg tone="err">{err}</Msg>}

      <Card>
        <SectionLabel>Hari ini</SectionLabel>
        <Text style={styles.ringkas}>
          {meds.length === 0
            ? 'Belum ada obat yang sedang diminum.'
            : `${sudah} dari ${totalDosis} dosis sudah ditandai diminum.`}
        </Text>
      </Card>

      {meds.map((m) => {
        const n = m.frekuensi ?? 1;
        return (
          <Card key={m.id}>
            <View style={styles.medHead}>
              <View style={styles.medInfo}>
                <Text style={styles.medNama}>{m.nama_obat}</Text>
                <Text style={styles.medMeta}>
                  {[m.dosis, `${n}x sehari`, m.jadwal].filter(Boolean).join(' · ')}
                </Text>
              </View>
              <Pressable onPress={() => void hentikan(m)} hitSlop={8}>
                <Text style={styles.hapus}>Hentikan</Text>
              </Pressable>
            </View>

            {/* Satu baris per dosis: obat 3x sehari perlu tiga tanda. */}
            {Array.from({ length: n }, (_, i) => i + 1).map((dosisKe) => {
              const log = logs[kunciDosis(m.id, dosisKe)];
              return (
                <View key={dosisKe} style={styles.dosisBaris}>
                  {n > 1 && <Text style={styles.dosisLabel}>Dosis {dosisKe}</Text>}
                  <View style={styles.aksi}>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`${m.nama_obat} dosis ${dosisKe} sudah diminum`}
                      onPress={() => void tandai(m, dosisKe, true)}
                      style={[styles.tombol, log?.diminum === true && styles.tombolYa]}
                    >
                      <Text
                        style={[styles.tombolText, log?.diminum === true && styles.tombolTextOn]}
                      >
                        ✓ Sudah
                      </Text>
                    </Pressable>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`${m.nama_obat} dosis ${dosisKe} belum diminum`}
                      onPress={() => void tandai(m, dosisKe, false)}
                      style={[styles.tombol, log?.diminum === false && styles.tombolTidak]}
                    >
                      <Text
                        style={[styles.tombolText, log?.diminum === false && styles.tombolTextOn]}
                      >
                        ✕ Belum
                      </Text>
                    </Pressable>
                  </View>
                </View>
              );
            })}
          </Card>
        );
      })}

      {tambah ? (
        <Card>
          <SectionLabel>Tambah obat</SectionLabel>
          <Field
            label="Nama obat"
            value={nama}
            onChangeText={setNama}
            placeholder="mis. Hidroksiklorokuin"
          />
          <Field label="Dosis" value={dosis} onChangeText={setDosis} placeholder="mis. 200 mg" />
          <Text style={styles.fieldLabel}>Berapa kali sehari</Text>
          <Segmented options={FREKUENSI} value={frekuensi} onChange={setFrekuensi} />
          <Field
            label="Waktu minum (opsional)"
            value={jadwal}
            onChangeText={setJadwal}
            placeholder="mis. pagi & malam, sesudah makan"
          />
          <PrimaryButton label="Simpan obat" onPress={simpanObat} loading={busy} />
          <GhostButton label="Batal" onPress={() => setTambah(false)} />
        </Card>
      ) : (
        <GhostButton label="＋ Tambah obat" onPress={() => setTambah(true)} />
      )}

      {berhenti.length > 0 && (
        <Card>
          <SectionLabel>Obat yang pernah diminum</SectionLabel>
          <Text style={styles.hint}>
            Tersimpan beserta tanggal berhentinya. Bisa dilanjutkan lagi kapan saja.
          </Text>
          {berhenti.map((m) => {
            const tgl = tanggalBerhenti(m.id);
            return (
              <View key={m.id} style={styles.lamaBaris}>
                <View style={styles.medInfo}>
                  <Text style={styles.lamaNama}>{m.nama_obat}</Text>
                  <Text style={styles.medMeta}>
                    {[m.dosis, `${m.frekuensi ?? 1}x sehari`].filter(Boolean).join(' · ')}
                    {tgl ? ` · berhenti ${tanggalPendek(tgl)}` : ''}
                  </Text>
                </View>
                <Pressable onPress={() => void lanjutkan(m)} hitSlop={8}>
                  <Text style={styles.lanjut}>Lanjutkan</Text>
                </Pressable>
              </View>
            );
          })}
        </Card>
      )}

      <Link href="/mars" asChild>
        <Pressable style={styles.marsCard}>
          <Text style={styles.marsJudul}>Kuesioner MARS-5</Text>
          <Text style={styles.marsSub}>
            5 pertanyaan singkat untuk menilai seberapa rutin kamu minum obat.
          </Text>
        </Pressable>
      </Link>

      <Disclaimer>{DISCLAIMER}</Disclaimer>
    </Screen>
  );
}

const styles = StyleSheet.create({
  ringkas: { fontSize: 13, color: Brand.teks },
  hint: { fontSize: 11.5, color: Brand.teksLembut, lineHeight: 16 },
  fieldLabel: { fontSize: 13, fontWeight: '600', color: '#374151' },
  medHead: { flexDirection: 'row', alignItems: 'flex-start', gap: space.sm },
  medInfo: { flex: 1 },
  medNama: { fontSize: 15, fontWeight: '700', color: Brand.teks },
  medMeta: { fontSize: 12.5, color: Brand.teksLembut, marginTop: 2 },
  hapus: { fontSize: 12, color: Brand.merah, fontWeight: '600' },
  lanjut: { fontSize: 12, color: Brand.ungu, fontWeight: '700' },
  dosisBaris: { gap: 4, marginTop: space.xs },
  dosisLabel: { fontSize: 12, fontWeight: '600', color: '#4b5563' },
  aksi: { flexDirection: 'row', gap: space.sm },
  tombol: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: radius.md,
    paddingVertical: 11,
    alignItems: 'center',
    backgroundColor: '#fff',
    minHeight: 44,
    justifyContent: 'center',
  },
  tombolYa: { backgroundColor: Brand.hijau, borderColor: Brand.hijau },
  tombolTidak: { backgroundColor: Brand.teksLembut, borderColor: Brand.teksLembut },
  tombolText: { fontSize: 13.5, fontWeight: '600', color: '#374151' },
  tombolTextOn: { color: '#fff' },
  lamaBaris: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    paddingVertical: 7,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  lamaNama: { fontSize: 14, fontWeight: '600', color: Brand.teks },
  marsCard: {
    backgroundColor: Brand.unguMuda,
    borderWidth: 1,
    borderColor: Brand.unguGaris,
    borderRadius: radius.lg,
    padding: space.lg,
    gap: 4,
  },
  marsJudul: { fontSize: 15, fontWeight: '700', color: Brand.ungu },
  marsSub: { fontSize: 12.5, color: '#5b5566', lineHeight: 18 },
});
