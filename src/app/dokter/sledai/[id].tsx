import Ionicons from '@expo/vector-icons/Ionicons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import {
  Card,
  Disclaimer,
  InfoBar,
  Msg,
  PrimaryButton,
  Screen,
  SectionLabel,
} from '@/components/ui/kit';
import { Brand, radius, space } from '@/constants/brand';
import { DISCLAIMER } from '@/constants/consent';
import { SLEDAI_DESKRIPTOR, SLEDAI_KELOMPOK } from '@/constants/sledai';
import { todayISO } from '@/lib/dates';
import { useSession } from '@/lib/session';
import { scoreSledai, SLEDAI_MAKS } from '@/lib/sledai';
import { skorKlinis } from '@/lib/target';
import { supabase } from '@/lib/supabase';

export default function SledaiScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { session } = useSession();

  const [dipilih, setDipilih] = useState<Record<string, boolean>>({});
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const skor = useMemo(() => scoreSledai(dipilih), [dipilih]);

  function toggle(key: string) {
    setDipilih((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  async function simpan() {
    if (!id) return;
    setBusy(true);
    setErr(null);

    // Hanya deskriptor yang bernilai true yang disimpan — nilai false tidak
    // menambah informasi apa pun dan hanya membuat baris jsonb membengkak.
    const deskriptor = Object.fromEntries(
      Object.entries(dipilih).filter(([, v]) => v === true)
    ) as Record<string, boolean>;

    const { error } = await supabase.from('sledai_assessments').insert({
      patient_id: id,
      doctor_id: session?.user.id ?? null,
      tanggal: todayISO(),
      deskriptor,
      total: skor.total,
      kategori: skor.kategori,
      // PGA, dosis steroid, dan kestabilan terapi diisi di layar Target
      // terapi, yang MEMPERBARUI baris ini. Tidak disebut di sini supaya
      // tidak menimpa isian yang sudah ada bila SLEDAI diisi ulang.
    });

    setBusy(false);
    if (error) {
      setErr(`Gagal menyimpan: ${error.message}`);
      return;
    }
    router.back();
  }

  return (
    <Screen>
      <InfoBar>
        Centang deskriptor yang ada{' '}
        <Text style={styles.tebal}>saat pemeriksaan atau dalam 10 hari terakhir</Text>. Skor
        dihitung otomatis dari bobotnya.
      </InfoBar>

      {err && <Msg tone="err">{err}</Msg>}

      <Card style={styles.skorKartu}>
        <Text style={styles.skorAngka}>
          {skor.total}
          <Text style={styles.skorMaks}> / {SLEDAI_MAKS}</Text>
        </Text>
        <Text style={styles.skorKategori}>{skor.kategori}</Text>
        <Text style={styles.skorKlinis}>clinical SLEDAI-2K {skorKlinis(dipilih)}</Text>
        {skor.aktif.length > 0 && (
          <Text style={styles.skorRincian}>
            {skor.aktif.map((d) => `${d.label} (${d.bobot})`).join(' · ')}
          </Text>
        )}
      </Card>

      {SLEDAI_KELOMPOK.map((kelompok) => {
        const isi = SLEDAI_DESKRIPTOR.filter((d) => d.kelompok === kelompok);
        if (isi.length === 0) return null;
        return (
          <Card key={kelompok}>
            <SectionLabel>{kelompok}</SectionLabel>
            {isi.map((d) => {
              const on = dipilih[d.key] === true;
              return (
                <Pressable
                  key={d.key}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: on }}
                  accessibilityLabel={`${d.label}, bobot ${d.bobot}`}
                  onPress={() => toggle(d.key)}
                  style={({ pressed }) => [
                    styles.baris,
                    on && styles.barisOn,
                    pressed && styles.ditekan,
                  ]}
                >
                  <View style={[styles.kotak, on && styles.kotakOn, styles.kotakAtas]}>
                    {on && <Ionicons name="checkmark" size={15} color="#fff" />}
                  </View>
                  <View style={styles.isi}>
                    <View style={styles.judulBaris}>
                      <Text style={[styles.label, on && styles.labelOn]}>{d.label}</Text>
                      <View style={[styles.bobot, on && styles.bobotOn]}>
                        <Text style={[styles.bobotText, on && styles.bobotTextOn]}>{d.bobot}</Text>
                      </View>
                    </View>
                    <Text style={styles.definisi}>{d.definisi}</Text>
                  </View>
                </Pressable>
              );
            })}
          </Card>
        );
      })}

      <PrimaryButton label="Simpan penilaian" onPress={() => void simpan()} loading={busy} />

      <Text style={styles.catatan}>
        Bobot deskriptor bagian dari instrumen SLEDAI-2K (Gladman dkk., J Rheumatol 2002). Ruam,
        alopesia, ulkus mukosa, dan proteinuria tetap dihitung meski menetap — itu yang membedakan
        2K dari SLEDAI asli. Kategori remisi 0 · ringan ≤6 · sedang ≤12 · berat &gt;12 mengikuti
        Carter dkk. 2016; potongan ini bukan bagian instrumen dan berbeda antar sumber.
      </Text>

      <Disclaimer>{DISCLAIMER}</Disclaimer>
    </Screen>
  );
}

const styles = StyleSheet.create({
  skorKartu: {
    alignItems: 'center',
    backgroundColor: Brand.unguMuda,
    borderColor: Brand.unguGaris,
  },
  skorAngka: { fontSize: 40, fontWeight: '800', color: Brand.ungu },
  skorMaks: { fontSize: 18, fontWeight: '600', color: Brand.teksLembut },
  skorKategori: { fontSize: 15, fontWeight: '700', color: '#5b5566' },
  skorRincian: { fontSize: 11.5, color: Brand.teksLembut, textAlign: 'center', lineHeight: 17 },
  baris: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: space.sm,
    minHeight: 44,
    paddingVertical: 10,
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
  isi: { flex: 1, gap: 3 },
  judulBaris: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  kotakAtas: { marginTop: 1 },
  definisi: { fontSize: 11.5, color: Brand.teksLembut, lineHeight: 16 },
  label: { flex: 1, fontSize: 13.5, fontWeight: '600', color: '#374151' },
  labelOn: { color: Brand.ungu },
  bobot: {
    minWidth: 26,
    paddingVertical: 2,
    borderRadius: 999,
    backgroundColor: '#f3f4f6',
    alignItems: 'center',
  },
  bobotOn: { backgroundColor: Brand.ungu },
  bobotText: { fontSize: 12, fontWeight: '700', color: '#6b7280' },
  bobotTextOn: { color: '#fff' },
  catatan: { fontSize: 11.5, color: Brand.teksLembut, lineHeight: 17 },
  skorKlinis: { fontSize: 12.5, fontWeight: '600', color: '#5b5566' },
  tebal: { fontWeight: '700' },
});
