import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import {
  Card,
  Disclaimer,
  GhostButton,
  InfoBar,
  Loading,
  Msg,
  Screen,
  SectionLabel,
} from '@/components/ui/kit';
import { Brand, radius, space } from '@/constants/brand';
import { DISCLAIMER } from '@/constants/consent';
import { hitungStreak, tanggalPendek } from '@/lib/dates';
import { useSession } from '@/lib/session';
import { supabase } from '@/lib/supabase';
import type { DailyCheckin, FlareCheck, MarsAssessment } from '@/types/database';

/** Bar chart sederhana tanpa dependensi grafik. */
function BarChart({
  data,
  max,
  warna,
  label,
}: {
  data: { tanggal: string; nilai: number }[];
  max: number;
  warna: string;
  label: string;
}) {
  if (data.length === 0) {
    return (
      <View>
        <Text style={styles.chartLabel}>{label}</Text>
        <Text style={styles.kosong}>Belum ada data.</Text>
      </View>
    );
  }

  return (
    <View>
      <Text style={styles.chartLabel}>{label}</Text>
      <View style={styles.chart}>
        {data.map((d) => (
          <View key={d.tanggal} style={styles.barKolom}>
            <View style={styles.barTrack}>
              <View
                style={[
                  styles.bar,
                  {
                    height: `${Math.max(4, (d.nilai / max) * 100)}%`,
                    backgroundColor: warna,
                  },
                ]}
              />
            </View>
            <Text style={styles.barLabel}>{d.tanggal.slice(8)}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const WARNA_FLARE: Record<string, string> = {
  red: Brand.merah,
  yellow: Brand.kuning,
  green: Brand.hijau,
};

const LABEL_FLARE: Record<string, string> = {
  red: 'Darurat',
  yellow: 'Mendesak',
  green: 'Aman',
};

export default function TrenScreen() {
  const { patientId, profile, signOut } = useSession();
  const [loading, setLoading] = useState(true);
  const [checkins, setCheckins] = useState<DailyCheckin[]>([]);
  const [mars, setMars] = useState<MarsAssessment[]>([]);
  const [flares, setFlares] = useState<FlareCheck[]>([]);
  const [err, setErr] = useState<string | null>(null);

  const muat = useCallback(async () => {
    if (!patientId) {
      setLoading(false);
      return;
    }
    setLoading(true);

    const [c, m, f] = await Promise.all([
      supabase
        .from('daily_checkins')
        .select('*')
        .eq('patient_id', patientId)
        .order('tanggal', { ascending: false })
        .limit(90),
      supabase
        .from('mars_assessments')
        .select('*')
        .eq('patient_id', patientId)
        .order('tanggal', { ascending: false })
        .limit(10),
      supabase
        .from('flare_checks')
        .select('*')
        .eq('patient_id', patientId)
        .order('waktu', { ascending: false })
        .limit(10),
    ]);

    const pesan = [c.error, m.error, f.error].find(Boolean)?.message;
    setErr(pesan ?? null);
    setCheckins((c.data ?? []) as DailyCheckin[]);
    setMars((m.data ?? []) as MarsAssessment[]);
    setFlares((f.data ?? []) as FlareCheck[]);
    setLoading(false);
  }, [patientId]);

  useFocusEffect(
    useCallback(() => {
      void muat();
    }, [muat])
  );

  if (loading) return <Loading />;

  const streak = hitungStreak(checkins.map((c) => c.tanggal));
  // 14 hari terakhir, urut lama → baru agar grafik dibaca kiri ke kanan.
  const terakhir14 = [...checkins].reverse().slice(-14);

  const dataMood = terakhir14
    .filter((c) => c.mood != null)
    .map((c) => ({ tanggal: c.tanggal, nilai: c.mood as number }));
  const dataNyeri = terakhir14
    .filter((c) => c.nyeri_sendi != null)
    .map((c) => ({ tanggal: c.tanggal, nilai: c.nyeri_sendi as number }));
  const dataLelah = terakhir14
    .filter((c) => c.lelah != null)
    .map((c) => ({ tanggal: c.tanggal, nilai: c.lelah as number }));

  return (
    <Screen>
      <InfoBar>
        Grafik & riwayat perkembangan mood, nyeri, serta streak check-in-mu dari waktu ke waktu.
      </InfoBar>

      {err && <Msg tone="err">{err}</Msg>}

      <Card>
        <View style={styles.statRow}>
          <View style={styles.stat}>
            <Text style={styles.statAngka}>{streak}</Text>
            <Text style={styles.statLabel}>hari berturut</Text>
          </View>
          <View style={styles.stat}>
            <Text style={styles.statAngka}>{checkins.length}</Text>
            <Text style={styles.statLabel}>total check-in</Text>
          </View>
        </View>
      </Card>

      <Card>
        <SectionLabel>14 hari terakhir</SectionLabel>
        <BarChart data={dataMood} max={5} warna={Brand.ungu} label="Mood (1–5)" />
        <BarChart data={dataLelah} max={4} warna={Brand.kuning} label="Kelelahan (0–4)" />
        <BarChart data={dataNyeri} max={3} warna={Brand.merah} label="Nyeri sendi (0–3)" />
      </Card>

      <Card>
        <SectionLabel>Riwayat MARS-5</SectionLabel>
        {mars.length === 0 ? (
          <Text style={styles.kosong}>Belum pernah mengisi.</Text>
        ) : (
          mars.map((m) => (
            <View key={m.id} style={styles.baris}>
              <Text style={styles.barisTanggal}>{tanggalPendek(m.tanggal)}</Text>
              <Text style={styles.barisNilai}>
                {m.total}/25 · {m.kategori}
              </Text>
            </View>
          ))
        )}
      </Card>

      <Card>
        <SectionLabel>Riwayat Cek Flare</SectionLabel>
        {flares.length === 0 ? (
          <Text style={styles.kosong}>Belum pernah melakukan cek flare.</Text>
        ) : (
          flares.map((f) => (
            <View key={f.id} style={styles.baris}>
              <Text style={styles.barisTanggal}>{tanggalPendek(f.waktu)}</Text>
              <View
                style={[
                  styles.badge,
                  { backgroundColor: WARNA_FLARE[f.hasil ?? 'green'] ?? Brand.teksLembut },
                ]}
              >
                <Text style={styles.badgeText}>{LABEL_FLARE[f.hasil ?? 'green'] ?? '—'}</Text>
              </View>
            </View>
          ))
        )}
      </Card>

      <Card>
        <SectionLabel>Akun</SectionLabel>
        <Text style={styles.akun}>
          {profile?.nama ?? '—'} · {profile?.role === 'doctor' ? 'Dokter' : 'Pasien'}
        </Text>
        <GhostButton label="Keluar" onPress={() => void signOut()} />
      </Card>

      <Disclaimer>{DISCLAIMER}</Disclaimer>
    </Screen>
  );
}

const styles = StyleSheet.create({
  statRow: { flexDirection: 'row', gap: space.md },
  stat: {
    flex: 1,
    backgroundColor: Brand.unguMuda,
    borderRadius: radius.lg,
    paddingVertical: space.md,
    alignItems: 'center',
  },
  statAngka: { fontSize: 24, fontWeight: '800', color: Brand.ungu },
  statLabel: { fontSize: 11.5, color: Brand.teksLembut },
  chartLabel: { fontSize: 12.5, fontWeight: '700', color: '#4b5563', marginTop: space.sm },
  chart: { flexDirection: 'row', alignItems: 'flex-end', gap: 3, height: 90, marginTop: 6 },
  barKolom: { flex: 1, alignItems: 'center', gap: 3 },
  barTrack: { flex: 1, width: '100%', justifyContent: 'flex-end' },
  bar: { width: '100%', borderRadius: 3 },
  barLabel: { fontSize: 9, color: Brand.teksLembut },
  kosong: { fontSize: 12.5, color: Brand.teksLembut, paddingVertical: 4 },
  baris: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 7,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  barisTanggal: { fontSize: 12.5, color: Brand.teksLembut },
  barisNilai: { fontSize: 13, fontWeight: '600', color: Brand.teks },
  badge: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3 },
  badgeText: { color: '#fff', fontSize: 11.5, fontWeight: '700' },
  akun: { fontSize: 13, color: Brand.teks },
});
