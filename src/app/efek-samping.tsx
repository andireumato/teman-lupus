import Ionicons from '@expo/vector-icons/Ionicons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import {
  Card,
  Disclaimer,
  Field,
  InfoBar,
  Loading,
  Msg,
  PrimaryButton,
  Screen,
  SectionLabel,
} from '@/components/ui/kit';
import { Brand, radius, space } from '@/constants/brand';
import { DISCLAIMER } from '@/constants/consent';
import { EFEK_KELOMPOK, EFEK_SAMPING } from '@/constants/efek-samping';
import { todayISO } from '@/lib/dates';
import { useSession } from '@/lib/session';
import { supabase } from '@/lib/supabase';
import type { Medication } from '@/types/database';

/** Tabel med_side_effects belum tentu ada di project Supabase lama. */
function pesanSkema(pesan: string): string {
  return pesan.includes('med_side_effects')
    ? 'Tabel efek samping belum ada di Supabase. Jalankan supabase/efek_samping.sql di SQL Editor.'
    : pesan;
}

export default function EfekSampingScreen() {
  const { patientId } = useSession();
  const router = useRouter();
  const { med } = useLocalSearchParams<{ med?: string }>();
  const hariIni = todayISO();

  const [loading, setLoading] = useState(true);
  const [meds, setMeds] = useState<Medication[]>([]);
  const [obatId, setObatId] = useState<string | null>(med ?? null);
  const [dipilih, setDipilih] = useState<Record<string, boolean>>({});
  const [catatan, setCatatan] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let hidup = true;
    (async () => {
      if (!patientId) {
        setLoading(false);
        return;
      }
      const { data } = await supabase
        .from('medications')
        .select('*')
        .eq('patient_id', patientId)
        .eq('aktif', true)
        .order('created_at', { ascending: true });
      if (!hidup) return;
      setMeds((data ?? []) as Medication[]);
      setLoading(false);
    })();
    return () => {
      hidup = false;
    };
  }, [patientId]);

  const terpilih = useMemo(() => EFEK_SAMPING.filter((e) => dipilih[e.key] === true), [dipilih]);
  const adaTandaBahaya = terpilih.some((e) => e.arahkanCekFlare);

  function toggle(key: string) {
    setDipilih((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  async function simpan() {
    if (!patientId || terpilih.length === 0) return;
    setBusy(true);
    setErr(null);

    // Satu baris per jenis; upsert supaya melapor dua kali di hari yang sama
    // memperbarui, bukan menggelembungkan hitungan di ringkasan.
    const baris = terpilih.map((e) => ({
      patient_id: patientId,
      medication_id: obatId,
      jenis: e.key,
      tanggal: hariIni,
      catatan: catatan.trim() || null,
    }));

    const { error } = await supabase.from('med_side_effects').upsert(baris, {
      onConflict: obatId ? 'patient_id,medication_id,jenis,tanggal' : 'patient_id,jenis,tanggal',
    });

    setBusy(false);
    if (error) {
      setErr(pesanSkema(`Gagal menyimpan: ${error.message}`));
      return;
    }
    router.back();
  }

  if (loading) return <Loading />;

  return (
    <Screen>
      <InfoBar>
        Catat keluhan yang kamu duga berasal dari obat. Ini dicatat terpisah dari gejala lupus, dan
        dokter yang menilai mana yang mana.
      </InfoBar>

      {err && <Msg tone="err">{err}</Msg>}

      {adaTandaBahaya && (
        <Msg tone="err">
          Beberapa yang kamu pilih bisa juga jadi tanda bahaya. Setelah menyimpan, buka{' '}
          <Text style={styles.tebal}>Cek Flare</Text> supaya diperiksa dengan aturan tanda bahaya.
        </Msg>
      )}

      {meds.length > 0 && (
        <Card>
          <SectionLabel>Obat yang dicurigai (opsional)</SectionLabel>
          <Text style={styles.hint}>
            Kosongkan kalau kamu tidak yakin obat mana. Menebak lebih buruk daripada mengosongkan.
          </Text>
          <View style={styles.chipBaris}>
            <Pressable
              onPress={() => setObatId(null)}
              style={[styles.chip, obatId === null && styles.chipOn]}
            >
              <Text style={[styles.chipText, obatId === null && styles.chipTextOn]}>
                Tidak tahu
              </Text>
            </Pressable>
            {meds.map((m) => (
              <Pressable
                key={m.id}
                onPress={() => setObatId(m.id)}
                style={[styles.chip, obatId === m.id && styles.chipOn]}
              >
                <Text style={[styles.chipText, obatId === m.id && styles.chipTextOn]}>
                  {m.nama_obat}
                </Text>
              </Pressable>
            ))}
          </View>
        </Card>
      )}

      {EFEK_KELOMPOK.map((kelompok) => {
        const isi = EFEK_SAMPING.filter((e) => e.kelompok === kelompok);
        if (isi.length === 0) return null;
        return (
          <Card key={kelompok}>
            <SectionLabel>{kelompok}</SectionLabel>
            {isi.map((e) => {
              const on = dipilih[e.key] === true;
              return (
                <Pressable
                  key={e.key}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: on }}
                  accessibilityLabel={e.label}
                  onPress={() => toggle(e.key)}
                  style={({ pressed }) => [
                    styles.baris,
                    on && styles.barisOn,
                    pressed && styles.ditekan,
                  ]}
                >
                  <View style={[styles.kotak, on && styles.kotakOn]}>
                    {on && <Ionicons name="checkmark" size={15} color="#fff" />}
                  </View>
                  <Text style={[styles.label, on && styles.labelOn]}>{e.label}</Text>
                </Pressable>
              );
            })}
          </Card>
        );
      })}

      <Card>
        <Field
          label="Catatan (opsional)"
          value={catatan}
          onChangeText={setCatatan}
          placeholder="mis. muncul sekitar sejam sesudah minum obat"
          multiline
          numberOfLines={3}
          style={styles.catatan}
        />
        <PrimaryButton
          label={
            terpilih.length === 0
              ? 'Pilih dulu keluhannya'
              : `Simpan ${terpilih.length} keluhan hari ini`
          }
          onPress={() => void simpan()}
          loading={busy}
          disabled={terpilih.length === 0}
        />
      </Card>

      <Disclaimer>{DISCLAIMER}</Disclaimer>
    </Screen>
  );
}

const styles = StyleSheet.create({
  hint: { fontSize: 11.5, color: Brand.teksLembut, lineHeight: 17 },
  tebal: { fontWeight: '700' },
  chipBaris: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 999,
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: '#fff',
  },
  chipOn: { backgroundColor: Brand.ungu, borderColor: Brand.ungu },
  chipText: { fontSize: 12.5, color: '#374151' },
  chipTextOn: { color: '#fff', fontWeight: '600' },
  baris: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    minHeight: 44,
    paddingHorizontal: space.md,
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: radius.md,
    backgroundColor: '#fff',
  },
  barisOn: { borderColor: Brand.ungu, backgroundColor: Brand.unguMuda },
  ditekan: { opacity: 0.7 },
  kotak: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: '#9ca3af',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
  },
  kotakOn: { backgroundColor: Brand.ungu, borderColor: Brand.ungu },
  label: { flex: 1, fontSize: 13.5, fontWeight: '600', color: '#374151' },
  labelOn: { color: Brand.ungu },
  catatan: { minHeight: 76, textAlignVertical: 'top', paddingTop: 10 },
});
