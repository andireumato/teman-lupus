import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import {
  Card,
  Chip,
  ChipGroup,
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
import { ANA_ANTIBODIES, ANA_PROFILE, labAbnormal, labRef, LABS } from '@/constants/lupus';
import { tanggalPendek, todayISO } from '@/lib/dates';
import { useSession } from '@/lib/session';
import { supabase } from '@/lib/supabase';
import type { LabResult } from '@/types/database';

export default function LabScreen() {
  const { patientId } = useSession();

  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<LabResult[]>([]);
  const [tambah, setTambah] = useState(false);
  const [jenis, setJenis] = useState<string>(LABS[0].k);
  const [nilai, setNilai] = useState('');
  const [satuan, setSatuan] = useState(LABS[0].u);
  const [tanggal, setTanggal] = useState(todayISO());
  const [catatan, setCatatan] = useState('');
  const [anaPositif, setAnaPositif] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const isAna = jenis === ANA_PROFILE;

  const muat = useCallback(async () => {
    if (!patientId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data, error } = await supabase
      .from('lab_results')
      .select('*')
      .eq('patient_id', patientId)
      .order('tanggal', { ascending: false })
      .limit(200);

    if (error) {
      // Tabel lab_results belum tentu ada di project Supabase lama.
      setErr(
        error.message.includes('lab_results')
          ? 'Tabel lab_results belum ada di database. Jalankan supabase/lab_results.sql lebih dulu.'
          : error.message
      );
      setRows([]);
    } else {
      setErr(null);
      setRows((data ?? []) as LabResult[]);
    }
    setLoading(false);
  }, [patientId]);

  useFocusEffect(
    useCallback(() => {
      void muat();
    }, [muat])
  );

  function pilihJenis(k: string) {
    setJenis(k);
    setSatuan(labRef(k)?.u ?? '');
    setNilai('');
    setAnaPositif(new Set());
  }

  function toggleAna(ab: string) {
    setAnaPositif((prev) => {
      const next = new Set(prev);
      if (next.has(ab)) next.delete(ab);
      else next.add(ab);
      return next;
    });
  }

  async function simpan() {
    if (!patientId) return;
    setErr(null);

    let nilai_num: number | null = null;
    let nilai_teks: string | null = null;

    if (isAna) {
      nilai_teks =
        anaPositif.size > 0 ? `Positif: ${[...anaPositif].join(', ')}` : 'Tidak ada yang positif';
    } else {
      const n = Number(nilai.replace(',', '.'));
      if (!nilai.trim() || Number.isNaN(n)) {
        setErr('Nilai harus berupa angka.');
        return;
      }
      nilai_num = n;
    }

    setBusy(true);
    const { error } = await supabase.from('lab_results').insert({
      patient_id: patientId,
      jenis,
      nilai_num,
      nilai_teks,
      satuan: isAna ? null : satuan.trim() || null,
      tanggal: tanggal || null,
      catatan: catatan.trim() || null,
    });
    setBusy(false);

    if (error) {
      setErr(`Gagal menyimpan: ${error.message}`);
      return;
    }
    setNilai('');
    setCatatan('');
    setAnaPositif(new Set());
    setTambah(false);
    await muat();
  }

  if (loading) return <Loading />;

  return (
    <Screen>
      <InfoBar>
        Kumpulan hasil pemeriksaan laboratoriummu (mis. anti-dsDNA, C3/C4, CRP) lengkap dengan nilai
        rujukannya.
      </InfoBar>

      {err && <Msg tone="err">{err}</Msg>}

      {tambah ? (
        <Card>
          <SectionLabel>Tambah hasil lab</SectionLabel>

          <Text style={styles.label}>Jenis pemeriksaan</Text>
          <ChipGroup>
            {LABS.map((l) => (
              <Chip key={l.k} label={l.k} on={jenis === l.k} onPress={() => pilihJenis(l.k)} />
            ))}
            <Chip label={ANA_PROFILE} on={isAna} onPress={() => pilihJenis(ANA_PROFILE)} />
          </ChipGroup>

          {isAna ? (
            <>
              <Text style={styles.label}>Pilih antibodi yang POSITIF</Text>
              <ChipGroup>
                {ANA_ANTIBODIES.map((ab) => (
                  <Chip key={ab} label={ab} on={anaPositif.has(ab)} onPress={() => toggleAna(ab)} />
                ))}
              </ChipGroup>
            </>
          ) : (
            <View style={styles.baris}>
              <View style={styles.kolom}>
                <Field
                  label="Nilai"
                  value={nilai}
                  onChangeText={setNilai}
                  keyboardType="decimal-pad"
                  placeholder="0"
                />
              </View>
              <View style={styles.kolom}>
                <Field label="Satuan" value={satuan} onChangeText={setSatuan} />
              </View>
            </View>
          )}

          <Field
            label="Tanggal pemeriksaan"
            value={tanggal}
            onChangeText={setTanggal}
            placeholder="YYYY-MM-DD"
            autoCapitalize="none"
          />
          <Field
            label="Catatan (opsional)"
            value={catatan}
            onChangeText={setCatatan}
            placeholder="mis. nama laboratorium"
          />

          <PrimaryButton label="Simpan hasil" onPress={simpan} loading={busy} />
          <GhostButton label="Batal" onPress={() => setTambah(false)} />
        </Card>
      ) : (
        <GhostButton label="＋ Tambah hasil lab" onPress={() => setTambah(true)} />
      )}

      {rows.length === 0 ? (
        <Card>
          <Text style={styles.kosong}>Belum ada hasil lab yang tercatat.</Text>
        </Card>
      ) : (
        rows.map((r) => {
          const abnormal = labAbnormal(r.jenis, r.nilai_num);
          const ref = labRef(r.jenis);
          return (
            <Card key={r.id} style={abnormal ? styles.kartuAbnormal : undefined}>
              <View style={styles.head}>
                <Text style={styles.jenis}>{r.jenis}</Text>
                <Text style={styles.tanggal}>{tanggalPendek(r.tanggal)}</Text>
              </View>
              <Text style={[styles.nilai, abnormal && styles.nilaiAbnormal]}>
                {r.nilai_num != null ? `${r.nilai_num} ${r.satuan ?? ''}`.trim() : r.nilai_teks}
                {abnormal ? '  (di luar rujukan)' : ''}
              </Text>
              {ref && (
                <Text style={styles.rujukan}>
                  Rujukan: {ref.lo != null ? `${ref.lo}` : '–'}
                  {' … '}
                  {ref.hi != null ? `${ref.hi}` : '–'} {ref.u}
                </Text>
              )}
              {r.catatan && <Text style={styles.catatan}>{r.catatan}</Text>}
            </Card>
          );
        })
      )}

      <Disclaimer>
        Nilai rujukan bersifat indikatif dan berbeda antar laboratorium. Penafsiran hasil hanya oleh
        dokter Anda. {DISCLAIMER}
      </Disclaimer>
    </Screen>
  );
}

const styles = StyleSheet.create({
  label: { fontSize: 13, fontWeight: '600', color: '#374151' },
  baris: { flexDirection: 'row', gap: space.sm },
  kolom: { flex: 1 },
  kosong: { fontSize: 13, color: Brand.teksLembut, textAlign: 'center' },
  kartuAbnormal: { borderColor: '#fecaca', backgroundColor: Brand.merahMuda },
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  jenis: { fontSize: 14, fontWeight: '700', color: Brand.teks, flex: 1 },
  tanggal: { fontSize: 12, color: Brand.teksLembut },
  nilai: { fontSize: 18, fontWeight: '800', color: Brand.teks },
  nilaiAbnormal: { color: Brand.merah },
  rujukan: { fontSize: 11.5, color: Brand.teksLembut },
  catatan: { fontSize: 12, color: '#4b5563', fontStyle: 'italic' },
  hasil: { borderRadius: radius.lg },
});
