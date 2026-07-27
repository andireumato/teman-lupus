import Ionicons from '@expo/vector-icons/Ionicons';
import { Link, useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Card, InfoBar, Loading, Msg, Screen, SectionLabel } from '@/components/ui/kit';
import { Brand, radius, space } from '@/constants/brand';
import { hitungStreak, mundurHari, tanggalPendek, todayISO } from '@/lib/dates';
import { useSession } from '@/lib/session';
import { supabase } from '@/lib/supabase';
import type { DailyCheckin, FlareCheck, Patient, Profile } from '@/types/database';

/** Berapa hari ke belakang yang diringkas pada kartu daftar. */
const JENDELA = 30;

interface BarisPasien {
  patientId: string;
  nama: string;
  /** Tanggal check-in terakhir; null bila belum pernah. */
  terakhir: string | null;
  streak: number;
  jumlahCheckin: number;
  darurat: number;
  mendesak: number;
}

export default function DaftarPasienScreen() {
  const { profile, session } = useSession();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<BarisPasien[]>([]);
  const [err, setErr] = useState<string | null>(null);

  const muat = useCallback(async () => {
    const doctorId = session?.user.id;
    if (!doctorId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setErr(null);

    const { data: pasien, error } = await supabase
      .from('patients')
      .select('*')
      .eq('doctor_id', doctorId);

    if (error) {
      setErr(`Gagal memuat daftar pasien: ${error.message}`);
      setLoading(false);
      return;
    }

    const daftar = (pasien ?? []) as Patient[];
    if (daftar.length === 0) {
      setRows([]);
      setLoading(false);
      return;
    }

    const patientIds = daftar.map((p) => p.id);
    const profileIds = daftar.map((p) => p.profile_id);
    const dari = mundurHari(todayISO(), JENDELA - 1);

    // Tiga kueri untuk semua pasien sekaligus, bukan tiga kueri per pasien:
    // daftar 30 pasien akan berarti 90 permintaan jaringan.
    const [prof, checkins, flares] = await Promise.all([
      supabase.from('profiles').select('id,nama').in('id', profileIds),
      supabase
        .from('daily_checkins')
        .select('patient_id,tanggal')
        .in('patient_id', patientIds)
        .gte('tanggal', dari),
      supabase
        .from('flare_checks')
        .select('patient_id,hasil,waktu')
        .in('patient_id', patientIds)
        .gte('waktu', `${dari}T00:00:00`),
    ]);

    const nama = new Map(
      ((prof.data ?? []) as Pick<Profile, 'id' | 'nama'>[]).map((p) => [p.id, p.nama])
    );
    const perPasien = new Map<string, string[]>();
    for (const c of (checkins.data ?? []) as Pick<DailyCheckin, 'patient_id' | 'tanggal'>[]) {
      perPasien.set(c.patient_id, [...(perPasien.get(c.patient_id) ?? []), c.tanggal]);
    }
    const flarePer = new Map<string, FlareCheck['hasil'][]>();
    for (const f of (flares.data ?? []) as Pick<FlareCheck, 'patient_id' | 'hasil'>[]) {
      flarePer.set(f.patient_id, [...(flarePer.get(f.patient_id) ?? []), f.hasil]);
    }

    const hasil: BarisPasien[] = daftar.map((p) => {
      const tanggal = [...new Set(perPasien.get(p.id) ?? [])].sort();
      const hasilFlare = flarePer.get(p.id) ?? [];
      return {
        patientId: p.id,
        nama: nama.get(p.profile_id) ?? 'Tanpa nama',
        terakhir: tanggal[tanggal.length - 1] ?? null,
        streak: hitungStreak(tanggal),
        jumlahCheckin: tanggal.length,
        darurat: hasilFlare.filter((h) => h === 'red').length,
        mendesak: hasilFlare.filter((h) => h === 'yellow').length,
      };
    });

    // Yang punya peringatan naik ke atas; sisanya menurut check-in terbaru.
    hasil.sort(
      (a, b) =>
        b.darurat - a.darurat ||
        b.mendesak - a.mendesak ||
        (b.terakhir ?? '').localeCompare(a.terakhir ?? '')
    );
    setRows(hasil);
    setLoading(false);
  }, [session?.user.id]);

  useFocusEffect(
    useCallback(() => {
      void muat();
    }, [muat])
  );

  if (loading) return <Loading />;

  return (
    <Screen>
      <InfoBar>
        Pasien yang menautkan diri dengan kode Anda. Ketuk namanya untuk membuka ringkasan
        pra-kunjungan.
      </InfoBar>

      {err && <Msg tone="err">{err}</Msg>}

      <Link href="/dokter/akun" asChild>
        <Pressable style={styles.akunCard}>
          <Ionicons name="key-outline" size={18} color={Brand.ungu} />
          <View style={styles.akunTeks}>
            <Text style={styles.akunJudul}>Kode dokter & akun</Text>
            <Text style={styles.akunSub}>Bagikan kode ini agar pasien bisa menautkan diri.</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={Brand.teksLembut} />
        </Pressable>
      </Link>

      {rows.length === 0 ? (
        <Card>
          <SectionLabel>Belum ada pasien</SectionLabel>
          <Text style={styles.kosong}>
            Buka “Kode dokter & akun”, lalu bagikan kodenya kepada pasien. Setelah mereka
            memasukkannya di aplikasi masing-masing, namanya muncul di sini.
          </Text>
        </Card>
      ) : (
        rows.map((r) => (
          <Pressable
            key={r.patientId}
            accessibilityRole="button"
            accessibilityLabel={`Buka ringkasan ${r.nama}`}
            onPress={() => router.push(`/dokter/pasien/${r.patientId}`)}
            style={({ pressed }) => [styles.pasienCard, pressed && styles.ditekan]}
          >
            <View style={styles.pasienHead}>
              <Text style={styles.pasienNama}>{r.nama}</Text>
              <Ionicons name="chevron-forward" size={18} color={Brand.teksLembut} />
            </View>

            <View style={styles.badgeBaris}>
              {r.darurat > 0 && (
                <View style={[styles.badge, { backgroundColor: Brand.merah }]}>
                  <Text style={styles.badgeText}>{r.darurat} darurat</Text>
                </View>
              )}
              {r.mendesak > 0 && (
                <View style={[styles.badge, { backgroundColor: Brand.kuning }]}>
                  <Text style={styles.badgeText}>{r.mendesak} mendesak</Text>
                </View>
              )}
              {r.darurat === 0 && r.mendesak === 0 && (
                <View style={[styles.badge, { backgroundColor: Brand.hijau }]}>
                  <Text style={styles.badgeText}>Tanpa peringatan</Text>
                </View>
              )}
            </View>

            <Text style={styles.pasienMeta}>
              {r.terakhir
                ? `Check-in terakhir ${tanggalPendek(r.terakhir)} · ${r.jumlahCheckin} dari ${JENDELA} hari`
                : 'Belum pernah check-in'}
              {r.streak > 0 ? ` · ${r.streak} hari berturut` : ''}
            </Text>
          </Pressable>
        ))
      )}

      <Text style={styles.catatanKecil}>
        Masuk sebagai {profile?.nama ?? '—'} · peringatan dihitung dari {JENDELA} hari terakhir.
      </Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  akunCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    backgroundColor: Brand.unguMuda,
    borderWidth: 1,
    borderColor: Brand.unguGaris,
    borderRadius: radius.lg,
    padding: space.lg,
  },
  akunTeks: { flex: 1, gap: 2 },
  akunJudul: { fontSize: 15, fontWeight: '700', color: Brand.ungu },
  akunSub: { fontSize: 12.5, color: '#5b5566', lineHeight: 18 },
  pasienCard: {
    backgroundColor: Brand.kartu,
    borderRadius: radius.lg,
    padding: space.lg,
    borderWidth: 1,
    borderColor: Brand.garis,
    gap: 6,
  },
  ditekan: { opacity: 0.75 },
  pasienHead: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  pasienNama: { flex: 1, fontSize: 16, fontWeight: '700', color: Brand.teks },
  pasienMeta: { fontSize: 12.5, color: Brand.teksLembut, lineHeight: 18 },
  badgeBaris: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  badge: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3 },
  badgeText: { color: '#fff', fontSize: 11.5, fontWeight: '700' },
  kosong: { fontSize: 13, color: Brand.teksLembut, lineHeight: 19 },
  catatanKecil: { fontSize: 11.5, color: Brand.teksLembut, textAlign: 'center', lineHeight: 17 },
});
