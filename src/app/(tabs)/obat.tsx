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
} from '@/components/ui/kit';
import { Brand, radius, space } from '@/constants/brand';
import { DISCLAIMER } from '@/constants/consent';
import { todayISO } from '@/lib/dates';
import { useSession } from '@/lib/session';
import { supabase } from '@/lib/supabase';
import type { MedLog, Medication } from '@/types/database';

export default function ObatScreen() {
  const { patientId } = useSession();
  const hariIni = todayISO();

  const [loading, setLoading] = useState(true);
  const [meds, setMeds] = useState<Medication[]>([]);
  const [logs, setLogs] = useState<Record<string, MedLog>>({});
  const [tambah, setTambah] = useState(false);
  const [nama, setNama] = useState('');
  const [dosis, setDosis] = useState('');
  const [jadwal, setJadwal] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const muat = useCallback(async () => {
    if (!patientId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setErr(null);

    const [{ data: m, error: em }, { data: l, error: el }] = await Promise.all([
      supabase
        .from('medications')
        .select('*')
        .eq('patient_id', patientId)
        .eq('aktif', true)
        .order('created_at', { ascending: true }),
      supabase.from('med_logs').select('*').eq('patient_id', patientId).eq('tanggal', hariIni),
    ]);

    if (em || el) {
      setErr((em ?? el)?.message ?? 'Gagal memuat data obat.');
      setLoading(false);
      return;
    }

    setMeds((m ?? []) as Medication[]);
    const map: Record<string, MedLog> = {};
    for (const row of (l ?? []) as MedLog[]) {
      if (row.medication_id) map[row.medication_id] = row;
    }
    setLogs(map);
    setLoading(false);
  }, [patientId, hariIni]);

  useFocusEffect(
    useCallback(() => {
      void muat();
    }, [muat])
  );

  async function tandai(med: Medication, diminum: boolean) {
    if (!patientId) return;
    setErr(null);

    const existing = logs[med.id];
    // Optimistic: pasien menandai obat berkali-kali sehari; menunggu jaringan
    // membuat tombol terasa rusak.
    const sebelumnya = logs;
    setLogs((prev) => ({
      ...prev,
      [med.id]: { ...(existing ?? ({} as MedLog)), medication_id: med.id, diminum } as MedLog,
    }));

    const { error } = existing?.id
      ? await supabase.from('med_logs').update({ diminum }).eq('id', existing.id)
      : await supabase.from('med_logs').insert({
          patient_id: patientId,
          medication_id: med.id,
          tanggal: hariIni,
          diminum,
        });

    if (error) {
      setLogs(sebelumnya);
      setErr(`Gagal menyimpan: ${error.message}`);
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
    const { error } = await supabase.from('medications').insert({
      patient_id: patientId,
      nama_obat: nama.trim(),
      dosis: dosis.trim() || null,
      jadwal: jadwal.trim() || null,
    });
    setBusy(false);
    if (error) {
      setErr(`Gagal menambah obat: ${error.message}`);
      return;
    }
    setNama('');
    setDosis('');
    setJadwal('');
    setTambah(false);
    await muat();
  }

  async function hentikan(med: Medication) {
    const { error } = await supabase.from('medications').update({ aktif: false }).eq('id', med.id);
    if (error) {
      setErr(`Gagal menghapus: ${error.message}`);
      return;
    }
    await muat();
  }

  if (loading) return <Loading />;

  const sudah = meds.filter((m) => logs[m.id]?.diminum === true).length;

  return (
    <Screen>
      <InfoBar>
        Daftar obatmu sekaligus catatan kepatuhan — tandai sudah/belum minum setiap hari.
      </InfoBar>

      {err && <Msg tone="err">{err}</Msg>}

      <Card>
        <SectionLabel>Hari ini</SectionLabel>
        <Text style={styles.ringkas}>
          {meds.length === 0
            ? 'Belum ada obat terdaftar.'
            : `${sudah} dari ${meds.length} obat sudah ditandai diminum.`}
        </Text>
      </Card>

      {meds.map((m) => {
        const log = logs[m.id];
        return (
          <Card key={m.id}>
            <View style={styles.medHead}>
              <View style={styles.medInfo}>
                <Text style={styles.medNama}>{m.nama_obat}</Text>
                <Text style={styles.medMeta}>
                  {[m.dosis, m.jadwal].filter(Boolean).join(' · ') || 'Tanpa keterangan dosis'}
                </Text>
              </View>
              <Pressable onPress={() => void hentikan(m)} hitSlop={8}>
                <Text style={styles.hapus}>Hentikan</Text>
              </Pressable>
            </View>

            <View style={styles.aksi}>
              <Pressable
                accessibilityRole="button"
                onPress={() => void tandai(m, true)}
                style={[styles.tombol, log?.diminum === true && styles.tombolYa]}
              >
                <Text style={[styles.tombolText, log?.diminum === true && styles.tombolTextOn]}>
                  ✓ Sudah
                </Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                onPress={() => void tandai(m, false)}
                style={[styles.tombol, log?.diminum === false && styles.tombolTidak]}
              >
                <Text style={[styles.tombolText, log?.diminum === false && styles.tombolTextOn]}>
                  ✕ Belum
                </Text>
              </Pressable>
            </View>
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
          <Field
            label="Jadwal"
            value={jadwal}
            onChangeText={setJadwal}
            placeholder="mis. 1x sehari pagi"
          />
          <PrimaryButton label="Simpan obat" onPress={simpanObat} loading={busy} />
          <GhostButton label="Batal" onPress={() => setTambah(false)} />
        </Card>
      ) : (
        <GhostButton label="＋ Tambah obat" onPress={() => setTambah(true)} />
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
  medHead: { flexDirection: 'row', alignItems: 'flex-start', gap: space.sm },
  medInfo: { flex: 1 },
  medNama: { fontSize: 15, fontWeight: '700', color: Brand.teks },
  medMeta: { fontSize: 12.5, color: Brand.teksLembut, marginTop: 2 },
  hapus: { fontSize: 12, color: Brand.merah, fontWeight: '600' },
  aksi: { flexDirection: 'row', gap: space.sm, marginTop: space.xs },
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
