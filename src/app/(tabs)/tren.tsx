import { useCallback, useState } from 'react';
import { Link, useFocusEffect } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

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
import { deretHari, hitungStreak, mundurHari, tanggalPendek, todayISO } from '@/lib/dates';
import { ruasGrafik, titikGrafik } from '@/lib/grafik';
import { useSession } from '@/lib/session';
import { supabase } from '@/lib/supabase';
import type { DailyCheckin, FlareCheck, MarsAssessment } from '@/types/database';

const TINGGI_GRAFIK = 96;
const TITIK = 7;

/**
 * Grafik garis tanpa dependensi apa pun.
 *
 * Tiap ruas digambar sebagai `View` tipis yang diputar — react-native-svg
 * tidak dipasang di proyek ini, dan menambah dependensi grafik hanya untuk
 * tiga garis kecil tidak sepadan.
 *
 * Sumbu X-nya HARI KALENDER, bukan urutan check-in: dua titik yang terpaut
 * seminggu tidak boleh tampak berdampingan. Karena itu pula garisnya
 * diputus pada hari yang tidak diisi — menyambungkannya akan mengarang
 * nilai untuk hari yang pasien memang tidak mencatat apa pun.
 */
function LineChart({
  hari,
  nilai,
  max,
  warna,
  label,
}: {
  /** Semua tanggal pada sumbu X, urut lama → baru. */
  hari: string[];
  /** Nilai per tanggal; tanggal yang tidak ada berarti tidak ada check-in. */
  nilai: Map<string, number>;
  max: number;
  warna: string;
  label: string;
}) {
  const [lebar, setLebar] = useState(0);

  if (nilai.size === 0) {
    return (
      <View>
        <Text style={styles.chartLabel}>{label}</Text>
        <Text style={styles.kosong}>Belum ada data.</Text>
      </View>
    );
  }

  const titik = titikGrafik({ hari, nilai, max, lebar, tinggi: TINGGI_GRAFIK });
  const ruas = ruasGrafik(titik);

  return (
    <View>
      <Text style={styles.chartLabel}>{label}</Text>
      <View
        style={styles.grafik}
        onLayout={(e) => setLebar(e.nativeEvent.layout.width)}
        accessibilityRole="image"
        accessibilityLabel={`${label}. ${titik.length} hari tercatat dari ${hari.length} hari.`}
      >
        {lebar > 0 && (
          <>
            {ruas.map((s) => (
              <View
                key={s.key}
                style={[
                  styles.ruas,
                  {
                    left: s.left,
                    top: s.top,
                    width: s.width,
                    backgroundColor: warna,
                    transform: [{ rotateZ: s.sudut }],
                  },
                ]}
              />
            ))}
            {titik.map((p) => (
              <View
                key={p.tanggal}
                style={[
                  styles.titik,
                  { left: p.x - TITIK / 2, top: p.y - TITIK / 2, borderColor: warna },
                ]}
              />
            ))}
          </>
        )}
      </View>
      <View style={styles.sumbu}>
        <Text style={styles.sumbuLabel}>{tanggalPendek(hari[0])}</Text>
        <Text style={styles.sumbuLabel}>{tanggalPendek(hari[hari.length - 1])}</Text>
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

  // Sumbu X = 14 hari kalender terakhir, urut lama → baru. Bukan "14 check-in
  // terakhir": kalau pasien mengisi jarang, keduanya bisa terpaut berminggu.
  const sampai = todayISO();
  const hari = deretHari(mundurHari(sampai, 13), sampai);

  const perHari = (ambil: (c: DailyCheckin) => number | null) => {
    const m = new Map<string, number>();
    for (const c of checkins) {
      const v = ambil(c);
      // checkins urut baru → lama, jadi entri pertama per tanggal yang menang.
      if (v != null && !m.has(c.tanggal)) m.set(c.tanggal, v);
    }
    return m;
  };

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
        <LineChart
          hari={hari}
          nilai={perHari((c) => c.mood)}
          max={5}
          warna={Brand.ungu}
          label="Mood (1–5)"
        />
        <LineChart
          hari={hari}
          nilai={perHari((c) => c.lelah)}
          max={3}
          warna={Brand.kuning}
          label="Kelelahan (0–3)"
        />
        <LineChart
          hari={hari}
          nilai={perHari((c) => c.nyeri_sendi)}
          max={3}
          warna={Brand.merah}
          label="Nyeri sendi (0–3)"
        />
        <Text style={styles.chartCatatan}>
          Garis terputus pada hari yang tidak kamu isi — bukan berarti tidak ada keluhan.
        </Text>
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

      <Link href="/ringkasan" asChild>
        <Pressable style={styles.ringkasanCard}>
          <Text style={styles.ringkasanJudul}>Ringkasan pra-kunjungan</Text>
          <Text style={styles.ringkasanSub}>
            Rangkuman catatanmu 30–90 hari terakhir untuk dibawa saat kontrol.
          </Text>
        </Pressable>
      </Link>

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
  grafik: {
    height: TINGGI_GRAFIK,
    marginTop: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  ruas: {
    position: 'absolute',
    height: 2,
    borderRadius: 1,
    // Titik putarnya di ujung kiri ruas, bukan tengahnya.
    transformOrigin: 'left center',
  },
  titik: {
    position: 'absolute',
    width: TITIK,
    height: TITIK,
    borderRadius: TITIK / 2,
    borderWidth: 2,
    backgroundColor: '#fff',
  },
  sumbu: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 3 },
  sumbuLabel: { fontSize: 9.5, color: Brand.teksLembut },
  chartCatatan: { fontSize: 11, color: Brand.teksLembut, lineHeight: 16, marginTop: space.xs },
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
  ringkasanCard: {
    backgroundColor: Brand.unguMuda,
    borderWidth: 1,
    borderColor: Brand.unguGaris,
    borderRadius: radius.lg,
    padding: space.lg,
    gap: 4,
  },
  ringkasanJudul: { fontSize: 15, fontWeight: '700', color: Brand.ungu },
  ringkasanSub: { fontSize: 12.5, color: '#5b5566', lineHeight: 18 },
});
