import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Platform, Share, StyleSheet, Text, View } from 'react-native';

import { RingkasanIsi } from '@/components/ringkasan-isi';
import {
  Card,
  Disclaimer,
  GhostButton,
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
import { tanggalPendek } from '@/lib/dates';
import { buatRingkasan, idPendek, inisialNama, ringkasanTeks } from '@/lib/ringkasan';
import { ambilDataRingkasan, type DataRingkasan } from '@/lib/ringkasan-data';
import { supabase } from '@/lib/supabase';
import type { Patient, Profile, SledaiAssessment, VisitQuestion } from '@/types/database';

const PERIODE = [
  { v: 30, label: '30 hari' },
  { v: 90, label: '90 hari' },
];

export default function DetailPasienScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();

  const [hari, setHari] = useState(30);
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<DataRingkasan | null>(null);
  const [pasien, setPasien] = useState<{ nama: string | null; pat: Patient } | null>(null);
  const [pertanyaan, setPertanyaan] = useState<VisitQuestion[]>([]);
  const [sledai, setSledai] = useState<SledaiAssessment[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const muat = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setErr(null);

    const { data: pat, error: ep } = await supabase
      .from('patients')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (ep || !pat) {
      // RLS yang menolak akan tampak sama seperti pasien yang tidak ada;
      // keduanya sama-sama berarti "bukan pasien Anda".
      setErr('Pasien ini tidak ditemukan, atau tidak tertaut dengan akun Anda.');
      setLoading(false);
      return;
    }

    const p = pat as Patient;
    const [prof, tanya, sl, ringkas] = await Promise.all([
      supabase.from('profiles').select('nama').eq('id', p.profile_id).maybeSingle(),
      supabase
        .from('visit_questions')
        .select('*')
        .eq('patient_id', p.id)
        .order('created_at', { ascending: true }),
      supabase
        .from('sledai_assessments')
        .select('*')
        .eq('patient_id', p.id)
        .order('tanggal', { ascending: false })
        .limit(10),
      ambilDataRingkasan(p.id, hari),
    ]);

    setPasien({ nama: (prof.data as Pick<Profile, 'nama'> | null)?.nama ?? null, pat: p });
    setPertanyaan((tanya.data ?? []) as VisitQuestion[]);
    setSledai((sl.data ?? []) as SledaiAssessment[]);
    setData(ringkas);
    setErr(ringkas.error);
    setLoading(false);
  }, [id, hari]);

  useFocusEffect(
    useCallback(() => {
      void muat();
    }, [muat])
  );

  const ringkasan = useMemo(() => {
    if (!data || !pasien) return null;
    return buatRingkasan({
      ...data,
      pasien: { inisial: inisialNama(pasien.nama), id: idPendek(pasien.pat.id) },
      pertanyaan: pertanyaan.map((p) => p.teks),
    });
  }, [data, pasien, pertanyaan]);

  async function bagikan() {
    if (!ringkasan) return;
    setErr(null);
    setInfo(null);
    const teks = ringkasanTeks(ringkasan);
    try {
      if (Platform.OS === 'web') {
        await navigator.clipboard.writeText(teks);
        setInfo('Teks ringkasan sudah disalin.');
        return;
      }
      await Share.share({ message: teks });
    } catch (e) {
      setErr(`Gagal membagikan: ${e instanceof Error ? e.message : 'tidak diketahui'}`);
    }
  }

  if (loading) return <Loading />;
  if (!ringkasan) {
    return (
      <Screen>
        <Msg tone="err">{err ?? 'Data pasien tidak bisa dimuat.'}</Msg>
      </Screen>
    );
  }

  return (
    <Screen>
      <InfoBar>
        Ringkasan ini dirakit dari catatan pasien sendiri — bukan penilaian klinis. Isinya sama
        persis dengan yang dilihat pasien di aplikasinya.
      </InfoBar>

      {err && <Msg tone="err">{err}</Msg>}
      {info && <Msg tone="ok">{info}</Msg>}

      <Card>
        <Text style={styles.nama}>{pasien?.nama ?? 'Tanpa nama'}</Text>
        <Text style={styles.meta}>
          {[
            pasien?.pat.tgl_diagnosis
              ? `Diagnosis ${tanggalPendek(pasien.pat.tgl_diagnosis)}`
              : null,
            pasien?.pat.klasifikasi,
          ]
            .filter(Boolean)
            .join(' · ') || 'Belum ada data klinis dasar'}
        </Text>
      </Card>

      <Segmented options={PERIODE} value={hari} onChange={setHari} />

      <Card>
        <SectionLabel>SLEDAI-2K</SectionLabel>
        {sledai.length === 0 ? (
          <Text style={styles.kosong}>Belum pernah dinilai.</Text>
        ) : (
          sledai.map((s) => (
            <View key={s.id} style={styles.baris}>
              <Text style={styles.barisTanggal}>{tanggalPendek(s.tanggal)}</Text>
              <Text style={styles.barisNilai}>
                {s.total ?? '—'} · {s.kategori ?? '—'}
              </Text>
            </View>
          ))
        )}
        <PrimaryButton
          label="Isi SLEDAI-2K hari ini"
          onPress={() => router.push(`/dokter/sledai/${id}`)}
        />
      </Card>

      <RingkasanIsi
        r={ringkasan}
        catatanBagian3="Hitungan hari dari catatan pasien, bukan kesimpulan medis."
      />

      <Msg tone="info">
        Teks yang dibagikan berisi data kesehatan pasien. Perlakukan seperti isi rekam medis.
      </Msg>
      <GhostButton
        label={Platform.OS === 'web' ? 'Salin teks ringkasan' : 'Bagikan teks ringkasan'}
        onPress={() => void bagikan()}
      />

      <Disclaimer>{DISCLAIMER}</Disclaimer>
    </Screen>
  );
}

const styles = StyleSheet.create({
  nama: { fontSize: 18, fontWeight: '800', color: Brand.teks },
  meta: { fontSize: 12.5, color: Brand.teksLembut },
  kosong: { fontSize: 12.5, color: Brand.teksLembut },
  baris: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 7,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
    gap: space.sm,
  },
  barisTanggal: { fontSize: 12.5, color: Brand.teksLembut },
  barisNilai: { fontSize: 13, fontWeight: '600', color: Brand.teks },
});
