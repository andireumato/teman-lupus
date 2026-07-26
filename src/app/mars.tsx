import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import {
  Card,
  Disclaimer,
  InfoBar,
  Msg,
  PrimaryButton,
  Screen,
  Segmented,
} from '@/components/ui/kit';
import { Brand, radius, space } from '@/constants/brand';
import { DISCLAIMER } from '@/constants/consent';
import { MARS_ITEMS, MARS_SKALA, scoreMars, type MarsScore } from '@/lib/mars';
import { useSession } from '@/lib/session';
import { supabase } from '@/lib/supabase';

const WARNA: Record<MarsScore['kategori'], string> = {
  Tinggi: Brand.hijau,
  Sedang: Brand.kuning,
  Rendah: Brand.merah,
};

export default function MarsScreen() {
  const { patientId } = useSession();
  const [jawaban, setJawaban] = useState<(number | null)[]>(() => MARS_ITEMS.map(() => null));
  const [hasil, setHasil] = useState<MarsScore | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const lengkap = jawaban.every((j) => j != null);

  function pilih(i: number, v: number) {
    setJawaban((prev) => {
      const next = [...prev];
      next[i] = v;
      return next;
    });
    setHasil(null);
  }

  async function simpan() {
    setErr(null);

    let skor: MarsScore;
    try {
      skor = scoreMars(jawaban);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Jawaban belum lengkap.');
      return;
    }
    setHasil(skor);

    if (!patientId) return;
    setBusy(true);
    const { error } = await supabase.from('mars_assessments').insert({
      patient_id: patientId,
      item1: jawaban[0],
      item2: jawaban[1],
      item3: jawaban[2],
      item4: jawaban[3],
      item5: jawaban[4],
      total: skor.total,
      kategori: skor.kategori,
    });
    setBusy(false);
    if (error) setErr(`Skor di atas tetap berlaku, tetapi gagal disimpan: ${error.message}`);
  }

  return (
    <Screen>
      <InfoBar>
        <Text style={styles.tebal}>MARS-5</Text> (Medication Adherence Report Scale) = kuesioner
        singkat 5 pertanyaan untuk menilai seberapa rutin kamu minum obat.
      </InfoBar>

      <Card>
        <Text style={styles.petunjuk}>
          Seberapa sering Anda melakukan hal berikut? (Selalu … Tidak pernah)
        </Text>
      </Card>

      {MARS_ITEMS.map((q, i) => (
        <Card key={q}>
          <Text style={styles.pertanyaan}>
            {i + 1}. {q}
          </Text>
          <Segmented
            options={MARS_SKALA.map((s) => ({ v: s.v, label: s.label }))}
            value={jawaban[i]}
            onChange={(v) => pilih(i, v)}
          />
        </Card>
      ))}

      {err && <Msg tone="err">{err}</Msg>}

      <PrimaryButton label="Hitung & simpan" onPress={simpan} disabled={!lengkap} loading={busy} />

      {hasil && (
        <View style={[styles.hasil, { borderColor: WARNA[hasil.kategori] }]}>
          <Text style={[styles.hasilAngka, { color: WARNA[hasil.kategori] }]}>
            {hasil.total}/25
          </Text>
          <Text style={[styles.hasilKategori, { color: WARNA[hasil.kategori] }]}>
            Kepatuhan {hasil.kategori}
          </Text>
          <Text style={styles.hasilCatatan}>
            Skor ini adalah laporan diri, bukan penilaian klinis. Bawalah hasilnya saat kontrol.
          </Text>
        </View>
      )}

      <Disclaimer>{DISCLAIMER}</Disclaimer>
    </Screen>
  );
}

const styles = StyleSheet.create({
  tebal: { fontWeight: '700' },
  petunjuk: { fontSize: 13, color: Brand.teks, lineHeight: 19 },
  pertanyaan: { fontSize: 14, fontWeight: '600', color: Brand.teks, marginBottom: 2 },
  hasil: {
    backgroundColor: Brand.unguMuda,
    borderWidth: 1,
    borderRadius: radius.lg,
    padding: space.lg,
    alignItems: 'center',
    gap: 2,
  },
  hasilAngka: { fontSize: 32, fontWeight: '800' },
  hasilKategori: { fontSize: 15, fontWeight: '700' },
  hasilCatatan: {
    fontSize: 12,
    color: Brand.teksLembut,
    textAlign: 'center',
    lineHeight: 17,
    marginTop: space.xs,
  },
});
