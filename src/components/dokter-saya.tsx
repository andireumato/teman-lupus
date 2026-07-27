import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Card, Field, GhostButton, Msg, PrimaryButton, SectionLabel } from '@/components/ui/kit';
import { Brand, radius, space } from '@/constants/brand';
import { formatKode, kodeValid, normalkanKode } from '@/lib/kode';
import { supabase } from '@/lib/supabase';
import type { Patient, Profile } from '@/types/database';

/**
 * Kartu penautan dokter di layar Tren pasien.
 *
 * Yang memulai penautan adalah PASIEN, bukan dokter: dia mengetik kode yang
 * diberikan dokternya. Ini sejalan dengan naskah consent — pasien memilih
 * membagikan datanya, bukan ditambahkan diam-diam ke daftar seseorang.
 *
 * Pencariannya lewat fungsi `tautkan_dokter` di database, bukan `select` ke
 * tabel profiles: kalau pasien boleh membaca profil orang lain untuk mencari
 * kode, dia juga bisa menelusuri daftar pengguna.
 */
export function DokterSaya({ patientId }: { patientId: string | null }) {
  const [loading, setLoading] = useState(true);
  const [namaDokter, setNamaDokter] = useState<string | null>(null);
  const [tertaut, setTertaut] = useState(false);
  const [kode, setKode] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const muat = useCallback(async () => {
    if (!patientId) {
      setLoading(false);
      return;
    }
    const { data } = await supabase
      .from('patients')
      .select('doctor_id')
      .eq('id', patientId)
      .maybeSingle();

    const doctorId = (data as Pick<Patient, 'doctor_id'> | null)?.doctor_id ?? null;
    setTertaut(doctorId != null);

    if (doctorId) {
      const { data: prof } = await supabase
        .from('profiles')
        .select('nama')
        .eq('id', doctorId)
        .maybeSingle();
      setNamaDokter((prof as Pick<Profile, 'nama'> | null)?.nama ?? null);
    } else {
      setNamaDokter(null);
    }
    setLoading(false);
  }, [patientId]);

  // useFocusEffect, bukan useEffect: kartunya harus menyegarkan diri saat
  // pasien kembali dari layar lain, dan pemanggilannya tidak menyalakan
  // setState langsung di badan efek.
  useFocusEffect(
    useCallback(() => {
      void muat();
    }, [muat])
  );

  async function tautkan() {
    setErr(null);
    setInfo(null);

    if (!kodeValid(kode)) {
      setErr('Kode harus 6 karakter. Periksa lagi huruf dan angkanya.');
      return;
    }

    setBusy(true);
    const { data, error } = await supabase.rpc('tautkan_dokter', { kode: normalkanKode(kode) });
    setBusy(false);

    if (error) {
      setErr(
        error.message.includes('tidak ditemukan')
          ? 'Kode itu tidak dikenali. Pastikan kodenya benar dan berasal dari dokter Anda.'
          : `Gagal menautkan: ${error.message}`
      );
      return;
    }

    const nama = Array.isArray(data) ? (data[0] as { nama_dokter?: string })?.nama_dokter : null;
    setKode('');
    setInfo(`Tertaut dengan ${nama ?? 'dokter Anda'}.`);
    await muat();
  }

  async function lepas() {
    if (!patientId) return;
    setBusy(true);
    setErr(null);
    setInfo(null);
    const { error } = await supabase
      .from('patients')
      .update({ doctor_id: null })
      .eq('id', patientId);
    setBusy(false);
    if (error) {
      setErr(`Gagal melepas tautan: ${error.message}`);
      return;
    }
    setInfo('Tautan dilepas. Dokter tidak bisa melihat datamu lagi.');
    await muat();
  }

  if (loading) return null;

  return (
    <Card>
      <SectionLabel>Dokter saya</SectionLabel>

      {err && <Msg tone="err">{err}</Msg>}
      {info && <Msg tone="ok">{info}</Msg>}

      {tertaut ? (
        <>
          <View style={styles.tertaut}>
            <Text style={styles.namaDokter}>{namaDokter ?? 'Dokter Anda'}</Text>
            <Text style={styles.hint}>
              Dokter ini bisa melihat ringkasan pra-kunjunganmu: check-in, obat, hasil Cek Flare,
              dan pertanyaan yang kamu siapkan.
            </Text>
          </View>
          <GhostButton label="Lepas tautan" onPress={() => void lepas()} disabled={busy} />
        </>
      ) : (
        <>
          <Text style={styles.hint}>
            Punya kode dari dokter? Masukkan di sini agar dia bisa melihat ringkasanmu sebelum
            kontrol. Kamu bisa melepasnya kapan saja.
          </Text>
          <Field
            label="Kode dokter"
            value={kode}
            onChangeText={setKode}
            placeholder="mis. RA4-K7P"
            autoCapitalize="characters"
            autoCorrect={false}
            onSubmitEditing={() => void tautkan()}
            returnKeyType="done"
          />
          {kode.length > 0 && <Text style={styles.pratinjau}>Terbaca: {formatKode(kode)}</Text>}
          <PrimaryButton
            label="Tautkan"
            onPress={() => void tautkan()}
            loading={busy}
            disabled={kode.trim().length === 0}
          />
        </>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  tertaut: {
    backgroundColor: Brand.hijauMuda,
    borderRadius: radius.md,
    padding: space.md,
    gap: 4,
  },
  namaDokter: { fontSize: 15, fontWeight: '700', color: '#166534' },
  hint: { fontSize: 12, color: Brand.teksLembut, lineHeight: 18 },
  pratinjau: { fontSize: 12, color: Brand.ungu, fontWeight: '600' },
});
