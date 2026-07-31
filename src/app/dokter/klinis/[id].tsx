import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';

import {
  Card,
  Disclaimer,
  Field,
  GhostButton,
  Loading,
  Msg,
  PrimaryButton,
  Screen,
  SectionLabel,
} from '@/components/ui/kit';
import { Brand, radius, space } from '@/constants/brand';
import { DISCLAIMER } from '@/constants/consent';
import { KRITERIA_KLASIFIKASI, ORGAN_TERLIBAT } from '@/constants/klinis';
import { todayISO } from '@/lib/dates';
import { lamaSakit, periksaTanggalDiagnosis } from '@/lib/klinis';
import { supabase } from '@/lib/supabase';
import type { Patient } from '@/types/database';

/**
 * Data klinis dasar — satu-satunya tempat kolom `tgl_diagnosis`,
 * `klasifikasi`, dan `organ_terlibat` diisi.
 *
 * Sengaja di sisi DOKTER. Kriteria klasifikasi adalah penilaian dengan butir
 * berbobot, dan "organ terlibat" adalah kesimpulan klinis; kalau pasien yang
 * mencentang, isinya jadi laporan-diri yang bercampur dengan penilaian
 * sungguhan — persis masalah yang dihindari waktu memisahkan efek samping
 * obat dari gejala lupus.
 *
 * Penyimpanan lewat `simpan_data_klinis()`, bukan update biasa: lihat
 * alasannya di supabase/data_klinis_dasar.sql.
 */
export default function KlinisScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [tanggal, setTanggal] = useState('');
  const [klasifikasi, setKlasifikasi] = useState<string | null>(null);
  const [organ, setOrgan] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const hariIni = todayISO();
  const cek = periksaTanggalDiagnosis(tanggal, hariIni);
  const lama = cek.ok && cek.nilai ? lamaSakit(cek.nilai, hariIni) : null;

  // Sekali saja, tidak seperti layar dokter lainnya yang memuat ulang tiap
  // kembali fokus. Ini FORMULIR: memuat ulang di tengah pengisian akan
  // menimpa ketikan dokter dengan isi lama tanpa peringatan apa pun.
  const sudahDimuat = useRef(false);

  const muat = useCallback(async () => {
    if (!id || sudahDimuat.current) return;
    sudahDimuat.current = true;
    const { data, error } = await supabase
      .from('patients')
      .select('tgl_diagnosis, klasifikasi, organ_terlibat')
      .eq('id', id)
      .maybeSingle();

    if (error || !data) {
      setErr('Pasien ini tidak ditemukan, atau tidak tertaut dengan akun Anda.');
      setLoading(false);
      return;
    }

    const p = data as Pick<Patient, 'tgl_diagnosis' | 'klasifikasi' | 'organ_terlibat'>;
    setTanggal(p.tgl_diagnosis ?? '');
    setKlasifikasi(p.klasifikasi);
    setOrgan(new Set(p.organ_terlibat ?? []));
    setLoading(false);
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      void muat();
    }, [muat])
  );

  function toggleOrgan(key: string) {
    setOrgan((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  async function simpan() {
    if (!id) return;
    if (!cek.ok) {
      setErr(cek.pesan);
      return;
    }
    setBusy(true);
    setErr(null);

    // Urutan larik dibuat mengikuti ORGAN_TERLIBAT, bukan urutan klik dokter,
    // supaya isinya sama untuk pasien yang sama apa pun urutan pengisiannya.
    const daftar = ORGAN_TERLIBAT.filter((o) => organ.has(o.key)).map((o) => o.key);

    const { error } = await supabase.rpc('simpan_data_klinis', {
      p_patient_id: id,
      p_tgl_diagnosis: cek.nilai,
      p_klasifikasi: klasifikasi,
      p_organ: daftar,
    });

    setBusy(false);
    if (error) {
      setErr(
        error.message.includes('simpan_data_klinis')
          ? 'Fungsi simpan_data_klinis belum ada di database. Jalankan supabase/data_klinis_dasar.sql lebih dulu.'
          : `Gagal menyimpan: ${error.message}`
      );
      return;
    }
    router.back();
  }

  if (loading) return <Loading />;

  return (
    <Screen>
      <Msg tone="info">
        Bagian ini diisi dokter. Isinya muncul di kepala ringkasan pra-kunjungan, dan dipakai untuk
        menandai gejala yang pasien catat di luar organ yang tercatat terlibat.
      </Msg>

      {err && <Msg tone="err">{err}</Msg>}

      <Card>
        <SectionLabel>Tanggal diagnosis</SectionLabel>
        <Field
          label="Format TTTT-BB-HH"
          value={tanggal}
          onChangeText={setTanggal}
          placeholder="2019-03-15"
          autoCapitalize="none"
          keyboardType="numbers-and-punctuation"
        />
        <Text style={styles.ket}>
          Boleh dikosongkan kalau memang tidak diketahui. Kalau hanya bulannya yang diketahui, pakai
          tanggal 1 — lebih baik ketidaktepatan yang Anda pilih sendiri daripada tanggal yang
          ditebak aplikasi.
        </Text>
        {!cek.ok && <Msg tone="err">{cek.pesan}</Msg>}
        {lama && <Text style={styles.lama}>Sejak diagnosis {lama}.</Text>}
      </Card>

      <Card>
        <SectionLabel>Kriteria klasifikasi</SectionLabel>
        <Text style={styles.ket}>
          Kriteria klasifikasi, bukan kriteria diagnosis. Ketuk sekali lagi untuk mengosongkan.
        </Text>
        {KRITERIA_KLASIFIKASI.map((k) => {
          const on = klasifikasi === k.v;
          return (
            <Pressable
              key={k.v}
              accessibilityRole="radio"
              accessibilityState={{ selected: on }}
              accessibilityLabel={`${k.v}. ${k.ket}`}
              onPress={() => setKlasifikasi(on ? null : k.v)}
              style={({ pressed }) => [styles.baris, on && styles.barisOn, pressed && styles.tekan]}
            >
              <Text style={[styles.barisLabel, on && styles.barisLabelOn]}>{k.v}</Text>
              <Text style={styles.barisKet}>{k.ket}</Text>
            </Pressable>
          );
        })}
        {klasifikasi != null && !KRITERIA_KLASIFIKASI.some((k) => k.v === klasifikasi) && (
          <Msg tone="info">
            Tersimpan sebelumnya sebagai “{klasifikasi}”, yang tidak ada di daftar ini. Memilih
            salah satu di atas akan menggantikannya.
          </Msg>
        )}
      </Card>

      <Card>
        <SectionLabel>Organ terlibat</SectionLabel>
        <Text style={styles.ket}>
          Yang pernah terbukti terlibat sepanjang perjalanan penyakit, bukan hanya yang aktif
          sekarang. Boleh lebih dari satu.
        </Text>
        {ORGAN_TERLIBAT.map((o) => {
          const on = organ.has(o.key);
          return (
            <Pressable
              key={o.key}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: on }}
              accessibilityLabel={`${o.label}. ${o.ket}`}
              onPress={() => toggleOrgan(o.key)}
              style={({ pressed }) => [styles.baris, on && styles.barisOn, pressed && styles.tekan]}
            >
              <Text style={[styles.barisLabel, on && styles.barisLabelOn]}>{o.label}</Text>
              <Text style={styles.barisKet}>{o.ket}</Text>
            </Pressable>
          );
        })}
      </Card>

      <PrimaryButton
        label="Simpan"
        onPress={() => void simpan()}
        loading={busy}
        disabled={!cek.ok}
      />
      <GhostButton label="Batal" onPress={() => router.back()} />

      <Text style={styles.catatan}>
        Pembagian domain organ mengikuti sistem BILAG-2004 (Isenberg dkk., Rheumatology
        2005;44:902–6), ditambah satu domain antifosfolipid yang bukan bagian BILAG. Disahkan 31
        Juli 2026.
      </Text>

      <Disclaimer>{DISCLAIMER}</Disclaimer>
    </Screen>
  );
}

const styles = StyleSheet.create({
  ket: { fontSize: 11.5, color: Brand.teksLembut, lineHeight: 17 },
  lama: { fontSize: 13, fontWeight: '700', color: Brand.ungu },
  baris: {
    gap: 3,
    minHeight: 44,
    paddingVertical: 10,
    paddingHorizontal: space.md,
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: radius.md,
    backgroundColor: '#fff',
  },
  barisOn: { borderColor: Brand.ungu, backgroundColor: Brand.unguMuda },
  tekan: { opacity: 0.7 },
  barisLabel: { fontSize: 13.5, fontWeight: '700', color: '#374151' },
  barisLabelOn: { color: Brand.ungu },
  barisKet: { fontSize: 11.5, color: Brand.teksLembut, lineHeight: 16 },
  catatan: { fontSize: 11.5, color: Brand.teksLembut, lineHeight: 17 },
});
