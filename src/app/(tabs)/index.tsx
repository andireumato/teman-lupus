import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';

import { TipCard } from '@/components/beranda-cards';
import { CtaCard } from '@/components/cta-card';
import { Hero } from '@/components/hero';
import { QuickTiles } from '@/components/quick-tiles';
import { Disclaimer, Loading, Msg, Screen } from '@/components/ui/kit';
import { UvCard } from '@/components/uv-card';
import { Brand, radius, space } from '@/constants/brand';
import { DISCLAIMER } from '@/constants/consent';
import { insightText, type CheckinRingkas, type Insight } from '@/lib/beranda';
import { hitungStreak, todayISO } from '@/lib/dates';
import { useSession } from '@/lib/session';
import { supabase } from '@/lib/supabase';
import type { Patient } from '@/types/database';

export default function BerandaScreen() {
  const { patientId, profile } = useSession();
  const router = useRouter();
  const hariIni = todayISO();

  const [loading, setLoading] = useState(true);
  const [sudahIsi, setSudahIsi] = useState(false);
  const [streak, setStreak] = useState(0);
  const [insight, setInsight] = useState<Insight | null>(null);
  const [profilKurang, setProfilKurang] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const muat = useCallback(async () => {
    if (!patientId) {
      setLoading(false);
      return;
    }
    setErr(null);

    const [{ data, error }, pat] = await Promise.all([
      supabase
        .from('daily_checkins')
        .select('tanggal,mood,nyeri_sendi')
        .eq('patient_id', patientId)
        .order('tanggal', { ascending: false })
        .limit(120),
      supabase
        .from('patients')
        .select('tgl_lahir, jenis_kelamin')
        .eq('id', patientId)
        .maybeSingle(),
    ]);

    // Galatnya tidak dilaporkan: kalau kolomnya belum ada di database,
    // beranda tetap harus jalan — yang hilang cuma pengingatnya.
    const p = pat.data as Pick<Patient, 'tgl_lahir' | 'jenis_kelamin'> | null;
    setProfilKurang(!pat.error && (p == null || p.tgl_lahir == null || p.jenis_kelamin == null));

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

      {/* Pengingat, bukan pemblokir. Cek Flare harus tetap bisa dijangkau
          kapan pun — itu jalur keselamatan, dan tidak boleh berdiri di
          belakang formulir data diri. */}
      {profilKurang && (
        <Pressable style={styles.lengkapi} onPress={() => router.push('/profil')}>
          <Text style={styles.lengkapiJudul}>Lengkapi profilmu</Text>
          <Text style={styles.lengkapiSub}>
            Tanggal lahir dan jenis kelamin belum terisi. Keduanya ikut di ringkasan yang dibaca
            doktermu. Ketuk untuk mengisi.
          </Text>
        </Pressable>
      )}

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
  lengkapi: {
    gap: 3,
    padding: space.md,
    borderWidth: 1,
    borderColor: Brand.unguGaris,
    borderRadius: radius.lg,
    backgroundColor: Brand.unguMuda,
  },
  lengkapiJudul: { fontSize: 14, fontWeight: '700', color: Brand.ungu },
  lengkapiSub: { fontSize: 12, color: Brand.teksLembut, lineHeight: 17 },
});
