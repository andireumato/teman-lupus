import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import {
  Card,
  Chip,
  ChipGroup,
  Disclaimer,
  Field,
  InfoBar,
  Loading,
  Msg,
  PrimaryButton,
  Screen,
  SectionLabel,
  Segmented,
} from '@/components/ui/kit';
import { Brand, space } from '@/constants/brand';
import { DISCLAIMER } from '@/constants/consent';
import { SISTEM_GEJALA, SKALA_LELAH, SKALA_MOOD, SKALA_NYERI_SENDI } from '@/constants/lupus';
import { hitungStreak, tanggalPanjang, todayISO } from '@/lib/dates';
import { useSession } from '@/lib/session';
import { supabase } from '@/lib/supabase';
import type { DailyCheckin, SymptomEntry } from '@/types/database';

/** Kunci unik gejala: "sistem|item". */
const key = (system: string, item: string) => `${system}|${item}`;

export default function CheckinScreen() {
  const { patientId, profile } = useSession();
  const hariIni = todayISO();

  const [loading, setLoading] = useState(true);
  const [sudahIsi, setSudahIsi] = useState(false);
  const [streak, setStreak] = useState(0);
  const [mood, setMood] = useState<number | null>(null);
  const [lelah, setLelah] = useState<number | null>(null);
  const [nyeri, setNyeri] = useState<number | null>(null);
  const [gejala, setGejala] = useState<Set<string>>(new Set());
  const [catatan, setCatatan] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  const muat = useCallback(async () => {
    if (!patientId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setErr(null);

    const { data, error } = await supabase
      .from('daily_checkins')
      .select('*')
      .eq('patient_id', patientId)
      .order('tanggal', { ascending: false })
      .limit(120);

    if (error) {
      setErr(error.message);
      setLoading(false);
      return;
    }

    const rows = (data ?? []) as DailyCheckin[];
    setStreak(
      hitungStreak(
        rows.map((r) => r.tanggal),
        hariIni
      )
    );

    const today = rows.find((r) => r.tanggal === hariIni);
    if (today) {
      setSudahIsi(true);
      setMood(today.mood);
      setLelah(today.lelah);
      setNyeri(today.nyeri_sendi);
      setCatatan(today.catatan ?? '');
      setGejala(
        new Set((today.gejala ?? []).filter((g) => g.present).map((g) => key(g.system, g.item)))
      );
    } else {
      setSudahIsi(false);
    }
    setLoading(false);
  }, [patientId, hariIni]);

  useFocusEffect(
    useCallback(() => {
      void muat();
    }, [muat])
  );

  function toggle(system: string, item: string) {
    setGejala((prev) => {
      const next = new Set(prev);
      const k = key(system, item);
      if (next.has(k)) next.delete(k);
      else next.add(k);
      return next;
    });
  }

  async function simpan() {
    setErr(null);
    setOk(null);

    if (!patientId) {
      setErr('Data pasien belum siap. Tarik untuk memuat ulang atau masuk kembali.');
      return;
    }
    if (mood == null || lelah == null || nyeri == null) {
      setErr('Mohon isi mood, kelelahan, dan nyeri sendi.');
      return;
    }

    const entries: SymptomEntry[] = [];
    for (const s of SISTEM_GEJALA) {
      for (const item of s.items) {
        if (gejala.has(key(s.system, item))) {
          entries.push({ system: s.system, item, present: true });
        }
      }
    }

    setBusy(true);
    // onConflict: satu check-in per pasien per hari — mengisi ulang memperbarui,
    // bukan menambah baris baru.
    const { error } = await supabase.from('daily_checkins').upsert(
      {
        patient_id: patientId,
        tanggal: hariIni,
        mood,
        lelah,
        nyeri_sendi: nyeri,
        gejala: entries,
        catatan: catatan.trim() || null,
      },
      { onConflict: 'patient_id,tanggal' }
    );
    setBusy(false);

    if (error) {
      setErr(`Gagal menyimpan: ${error.message}`);
      return;
    }
    setOk('Check-in tersimpan. Terima kasih.');
    await muat();
  }

  if (loading) return <Loading />;

  return (
    <Screen>
      <InfoBar>
        Catat kondisimu setiap hari (mood, kelelahan, nyeri, gejala) agar perkembanganmu bisa
        dipantau bersama dokter.
      </InfoBar>

      <Card>
        <Text style={styles.sapaan}>Halo, {profile?.nama ?? 'Sahabat'}</Text>
        <Text style={styles.tanggal}>{tanggalPanjang(hariIni)}</Text>
        <View style={styles.statRow}>
          <View style={styles.stat}>
            <Text style={styles.statAngka}>{streak}</Text>
            <Text style={styles.statLabel}>hari berturut</Text>
          </View>
          <View style={styles.stat}>
            <Text style={[styles.statAngka, { color: sudahIsi ? Brand.hijau : Brand.kuning }]}>
              {sudahIsi ? '✓' : '—'}
            </Text>
            <Text style={styles.statLabel}>{sudahIsi ? 'sudah diisi' : 'belum diisi'}</Text>
          </View>
        </View>
      </Card>

      <Card>
        <SectionLabel>Bagaimana perasaanmu hari ini?</SectionLabel>
        <Segmented options={SKALA_MOOD} value={mood} onChange={setMood} />

        <SectionLabel>Seberapa lelah?</SectionLabel>
        <Segmented options={SKALA_LELAH} value={lelah} onChange={setLelah} />

        <SectionLabel>Nyeri sendi</SectionLabel>
        <Segmented options={SKALA_NYERI_SENDI} value={nyeri} onChange={setNyeri} />
      </Card>

      <Card>
        <SectionLabel>Gejala hari ini</SectionLabel>
        <Text style={styles.hint}>Ketuk yang kamu rasakan. Kosongkan bila tidak ada.</Text>
        {SISTEM_GEJALA.map((s) => (
          <View key={s.system} style={styles.sistem}>
            <Text style={styles.sistemLabel}>{s.label}</Text>
            <ChipGroup>
              {s.items.map((item) => (
                <Chip
                  key={item}
                  label={item}
                  on={gejala.has(key(s.system, item))}
                  onPress={() => toggle(s.system, item)}
                />
              ))}
            </ChipGroup>
          </View>
        ))}
      </Card>

      <Card>
        <Field
          label="Catatan (opsional)"
          value={catatan}
          onChangeText={setCatatan}
          placeholder="Hal lain yang ingin kamu catat…"
          multiline
          numberOfLines={3}
          style={styles.catatan}
        />
        {err && <Msg tone="err">{err}</Msg>}
        {ok && <Msg tone="ok">{ok}</Msg>}
        <PrimaryButton
          label={sudahIsi ? 'Perbarui check-in' : 'Simpan check-in'}
          onPress={simpan}
          loading={busy}
        />
      </Card>

      <Disclaimer>{DISCLAIMER}</Disclaimer>
    </Screen>
  );
}

const styles = StyleSheet.create({
  sapaan: { fontSize: 17, fontWeight: '700', color: Brand.teks },
  tanggal: { fontSize: 13, color: Brand.teksLembut },
  statRow: { flexDirection: 'row', gap: space.md, marginTop: space.sm },
  stat: {
    flex: 1,
    backgroundColor: Brand.unguMuda,
    borderRadius: 12,
    paddingVertical: space.md,
    alignItems: 'center',
  },
  statAngka: { fontSize: 24, fontWeight: '800', color: Brand.ungu },
  statLabel: { fontSize: 11.5, color: Brand.teksLembut },
  hint: { fontSize: 12, color: Brand.teksLembut },
  sistem: { gap: 6, marginTop: space.sm },
  sistemLabel: { fontSize: 12.5, fontWeight: '700', color: '#4b5563' },
  catatan: { minHeight: 76, textAlignVertical: 'top', paddingTop: 10 },
});
