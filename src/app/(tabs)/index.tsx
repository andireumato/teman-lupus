import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { StyleSheet, Text } from 'react-native';

import { TipCard } from '@/components/beranda-cards';
import { CtaCard } from '@/components/cta-card';
import { Hero } from '@/components/hero';
import { QuickTiles } from '@/components/quick-tiles';
import { Disclaimer, Loading, Msg, Screen } from '@/components/ui/kit';
import { UvCard } from '@/components/uv-card';
import { DISCLAIMER } from '@/constants/consent';
import { insightText, type CheckinRingkas, type Insight } from '@/lib/beranda';
import { hitungStreak, todayISO } from '@/lib/dates';
import { useSession } from '@/lib/session';
import { supabase } from '@/lib/supabase';

export default function BerandaScreen() {
  const { patientId, profile } = useSession();
  const router = useRouter();
  const hariIni = todayISO();

  const [loading, setLoading] = useState(true);
  const [sudahIsi, setSudahIsi] = useState(false);
  const [streak, setStreak] = useState(0);
  const [insight, setInsight] = useState<Insight | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const muat = useCallback(async () => {
    if (!patientId) {
      setLoading(false);
      return;
    }
    setErr(null);

    const { data, error } = await supabase
      .from('daily_checkins')
      .select('tanggal,mood,nyeri_sendi')
      .eq('patient_id', patientId)
      .order('tanggal', { ascending: false })
      .limit(120);

    if (error) {
      setErr(error.message);
      setLoading(false);
      return;
    }

    const rows = (data ?? []) as CheckinRingkas[];
    setStreak(
      hitungStreak(
        rows.map((r) => r.tanggal),
        hariIni
      )
    );
    setInsight(insightText(rows));
    setSudahIsi(rows.some((r) => r.tanggal === hariIni));
    setLoading(false);
  }, [patientId, hariIni]);

  useFocusEffect(
    useCallback(() => {
      void muat();
    }, [muat])
  );

  if (loading) return <Loading />;

  return (
    <Screen>
      <Hero nama={profile?.nama ?? null} hariIni={hariIni} sekarang={new Date()} />

      {/* Digantung pada patientId: tab sempat ter-mount sebelum penjaga rute
          mengalihkan ke /login, dan kartu ini meminta izin lokasi saat mount.
          Tanpa penjaga ini, pasien dimintai izin lokasi sebelum sempat masuk. */}
      {patientId && <UvCard />}

      {err && <Msg tone="err">{err}</Msg>}

      <CtaCard
        sudahIsi={sudahIsi}
        streak={streak}
        insight={insight}
        onIsi={() => router.push('/checkin')}
      />

      <Text style={styles.label}>Akses cepat</Text>
      <QuickTiles />

      <TipCard sekarang={new Date()} />

      <Disclaimer>{DISCLAIMER}</Disclaimer>
    </Screen>
  );
}

const styles = StyleSheet.create({
  label: { fontSize: 14, fontWeight: '600', color: '#374151', marginTop: 2 },
});
