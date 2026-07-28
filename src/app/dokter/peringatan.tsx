import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Card, Disclaimer, InfoBar, Loading, Msg, Screen, SectionLabel } from '@/components/ui/kit';
import { Brand, radius, space } from '@/constants/brand';
import { DISCLAIMER } from '@/constants/consent';
import { tanggalPendek } from '@/lib/dates';
import { useSession } from '@/lib/session';
import { supabase } from '@/lib/supabase';
import type { Alert, Patient, Profile } from '@/types/database';

/** Tabel/kolom baru belum tentu ada di project Supabase lama. */
function pesanSkema(pesan: string): string {
  return pesan.includes('flare_check_id')
    ? 'Skema peringatan belum diperbarui di Supabase. Jalankan supabase/alerts_kunjungan.sql di SQL Editor.'
    : pesan;
}

interface BarisPeringatan {
  alert: Alert;
  patientId: string;
  nama: string;
}

export default function PeringatanScreen() {
  const { session } = useSession();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<BarisPeringatan[]>([]);
  const [selesai, setSelesai] = useState<BarisPeringatan[]>([]);
  const [err, setErr] = useState<string | null>(null);

  const muat = useCallback(async () => {
    const doctorId = session?.user.id;
    if (!doctorId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setErr(null);

    const { data: pasien, error: ep } = await supabase
      .from('patients')
      .select('id,profile_id')
      .eq('doctor_id', doctorId);

    if (ep) {
      setErr(`Gagal memuat pasien: ${ep.message}`);
      setLoading(false);
      return;
    }

    const daftar = (pasien ?? []) as Pick<Patient, 'id' | 'profile_id'>[];
    if (daftar.length === 0) {
      setRows([]);
      setSelesai([]);
      setLoading(false);
      return;
    }

    const [al, prof] = await Promise.all([
      supabase
        .from('alerts')
        .select('*')
        .in(
          'patient_id',
          daftar.map((p) => p.id)
        )
        .order('created_at', { ascending: false })
        .limit(100),
      supabase
        .from('profiles')
        .select('id,nama')
        .in(
          'id',
          daftar.map((p) => p.profile_id)
        ),
    ]);

    if (al.error) {
      setErr(pesanSkema(`Gagal memuat peringatan: ${al.error.message}`));
      setLoading(false);
      return;
    }

    const nama = new Map(
      ((prof.data ?? []) as Pick<Profile, 'id' | 'nama'>[]).map((p) => [p.id, p.nama])
    );
    const profilPerPasien = new Map(daftar.map((p) => [p.id, p.profile_id]));

    const semua: BarisPeringatan[] = ((al.data ?? []) as Alert[]).map((a) => ({
      alert: a,
      patientId: a.patient_id,
      nama: nama.get(profilPerPasien.get(a.patient_id) ?? '') ?? 'Tanpa nama',
    }));

    setRows(semua.filter((r) => !r.alert.selesai));
    setSelesai(semua.filter((r) => r.alert.selesai).slice(0, 20));
    setLoading(false);
  }, [session?.user.id]);

  useFocusEffect(
    useCallback(() => {
      void muat();
    }, [muat])
  );

  async function tandaiSelesai(r: BarisPeringatan) {
    setErr(null);
    // Optimistis: memindahkan barisnya seketika, tanpa memuat ulang layar.
    setRows((prev) => prev.filter((x) => x.alert.id !== r.alert.id));

    const { error } = await supabase.from('alerts').update({ selesai: true }).eq('id', r.alert.id);

    if (error) {
      setErr(`Gagal menandai selesai: ${error.message}`);
      await muat();
      return;
    }
    setSelesai((prev) => [{ ...r, alert: { ...r.alert, selesai: true } }, ...prev]);
  }

  if (loading) return <Loading />;

  const darurat = rows.filter((r) => r.alert.jenis === 'flare_darurat');
  const mendesak = rows.filter((r) => r.alert.jenis !== 'flare_darurat');

  return (
    <Screen>
      <InfoBar>
        Peringatan dibuat otomatis saat Cek Flare pasien menghasilkan tingkat mendesak atau darurat.
        Pasien sudah menerima arahannya langsung di aplikasinya saat itu juga.
      </InfoBar>

      {err && <Msg tone="err">{err}</Msg>}

      {rows.length === 0 ? (
        <Card>
          <SectionLabel>Tidak ada peringatan terbuka</SectionLabel>
          <Text style={styles.kosong}>
            Semua peringatan sudah ditandai selesai, atau belum ada Cek Flare yang menghasilkan
            kuning maupun merah.
          </Text>
        </Card>
      ) : (
        [...darurat, ...mendesak].map((r) => {
          const gawat = r.alert.jenis === 'flare_darurat';
          return (
            <View
              key={r.alert.id}
              style={[styles.kartu, { borderColor: gawat ? Brand.merah : Brand.kuning }]}
            >
              <View style={styles.kepala}>
                <View
                  style={[styles.badge, { backgroundColor: gawat ? Brand.merah : Brand.kuning }]}
                >
                  <Text style={styles.badgeText}>{gawat ? 'DARURAT' : 'MENDESAK'}</Text>
                </View>
                <Text style={styles.waktu}>{tanggalPendek(r.alert.created_at)}</Text>
              </View>

              <Text style={styles.nama}>{r.nama}</Text>
              <Text style={styles.pesan}>{r.alert.pesan ?? '—'}</Text>

              <View style={styles.aksi}>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => router.push(`/dokter/pasien/${r.patientId}`)}
                  style={[styles.tombol, styles.tombolUtama]}
                >
                  <Text style={styles.tombolUtamaText}>Buka ringkasan</Text>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => void tandaiSelesai(r)}
                  style={styles.tombol}
                >
                  <Text style={styles.tombolText}>Tandai selesai</Text>
                </Pressable>
              </View>
            </View>
          );
        })
      )}

      {selesai.length > 0 && (
        <Card>
          <SectionLabel>Sudah ditindaklanjuti</SectionLabel>
          {selesai.map((r) => (
            <View key={r.alert.id} style={styles.baris}>
              <Text style={styles.barisNama}>{r.nama}</Text>
              <Text style={styles.barisWaktu}>{tanggalPendek(r.alert.created_at)}</Text>
            </View>
          ))}
        </Card>
      )}

      <Disclaimer>{DISCLAIMER}</Disclaimer>
    </Screen>
  );
}

const styles = StyleSheet.create({
  kartu: {
    backgroundColor: Brand.kartu,
    borderRadius: radius.lg,
    padding: space.lg,
    borderWidth: 1.5,
    gap: 6,
  },
  kepala: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  badge: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3 },
  badgeText: { color: '#fff', fontSize: 11, fontWeight: '800', letterSpacing: 0.5 },
  waktu: { flex: 1, fontSize: 12, color: Brand.teksLembut, textAlign: 'right' },
  nama: { fontSize: 16, fontWeight: '700', color: Brand.teks },
  pesan: { fontSize: 13, color: Brand.teks, lineHeight: 19 },
  aksi: { flexDirection: 'row', gap: space.sm, marginTop: space.xs },
  tombol: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: radius.md,
    paddingVertical: 11,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
    minHeight: 44,
  },
  tombolUtama: { backgroundColor: Brand.ungu, borderColor: Brand.ungu },
  tombolUtamaText: { fontSize: 13.5, fontWeight: '700', color: '#fff' },
  tombolText: { fontSize: 13.5, fontWeight: '600', color: '#374151' },
  kosong: { fontSize: 13, color: Brand.teksLembut, lineHeight: 19 },
  baris: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
    gap: space.sm,
  },
  barisNama: { fontSize: 13, color: Brand.teks },
  barisWaktu: { fontSize: 12, color: Brand.teksLembut },
});
