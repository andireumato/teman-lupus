import { useFocusEffect, useRouter } from 'expo-router';
import { openBrowserAsync } from 'expo-web-browser';
import { useCallback, useRef, useState } from 'react';
import { StyleSheet, Text } from 'react-native';

import { DokterSaya } from '@/components/dokter-saya';
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
  Segmented,
} from '@/components/ui/kit';
import { Brand } from '@/constants/brand';
import { DISCLAIMER } from '@/constants/consent';
import { situsTerpasang, urlPrivasi } from '@/constants/tautan';
import { JENIS_KELAMIN } from '@/constants/klinis';
import { todayISO } from '@/lib/dates';
import { periksaTanggalLahir, usiaTahun } from '@/lib/klinis';
import { useSession } from '@/lib/session';
import { supabase } from '@/lib/supabase';
import type { Patient, Profile } from '@/types/database';

/**
 * Profil pasien.
 *
 * Tanggal lahir dan jenis kelamin disimpan di `patients`, bukan `profiles`:
 * `profiles` dipakai dokter juga, dan kolomnya akan selalu null di baris
 * dokter. Lihat supabase/data_dasar_pasien.sql.
 *
 * Nama tetap di `profiles` karena itu identitas akun, bukan data klinis, dan
 * dipakai juga oleh akun dokter.
 */
/**
 * Menerjemahkan galat Supabase jadi kalimat yang bisa ditindaklanjuti.
 *
 * Kolom yang belum ada muncul dengan dua wujud berbeda: Postgres menjawab
 * `42703 column ... does not exist` saat membaca, sedangkan PostgREST menahan
 * penulisan lebih dulu dengan `PGRST204 ... in the schema cache`. Keduanya
 * berarti hal yang sama bagi pemakainya, jadi keduanya dicocokkan — versi
 * pertama layar ini hanya menangani jalur baca, sehingga tombol Simpan
 * menampilkan pesan mentah yang tidak memberi tahu apa yang harus dilakukan.
 */
function pesanGalat(pesan: string): string {
  if (/tgl_lahir|jenis_kelamin/.test(pesan)) {
    return 'Kolom tanggal lahir & jenis kelamin belum ada di database. Jalankan supabase/data_dasar_pasien.sql lebih dulu.';
  }
  return `Gagal menyimpan: ${pesan}`;
}

export default function ProfilScreen() {
  const { patientId, profile, reload, signOut, ubahConsentPenelitian } = useSession();
  const router = useRouter();
  const profileId = profile?.id ?? '';

  const [loading, setLoading] = useState(true);
  const [nama, setNama] = useState('');
  const [tglLahir, setTglLahir] = useState('');
  const [jk, setJk] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [ubahRiset, setUbahRiset] = useState(false);

  const hariIni = todayISO();
  const cek = periksaTanggalLahir(tglLahir, hariIni);
  const usia = cek.ok && cek.nilai ? usiaTahun(cek.nilai, hariIni) : null;

  // Sekali saja: ini formulir, dan memuat ulang di tengah pengisian akan
  // menimpa ketikan pasien dengan isi lama tanpa peringatan.
  const sudahDimuat = useRef(false);

  const muat = useCallback(async () => {
    if (!patientId || sudahDimuat.current) return;
    sudahDimuat.current = true;

    // Nama dibaca dari database, bukan dari objek sesi: sesi bisa selesai
    // dimuat setelah layar ini terbuka, dan menyalinnya belakangan berisiko
    // menimpa ketikan yang sedang berjalan.
    const [pat, prof] = await Promise.all([
      supabase
        .from('patients')
        .select('tgl_lahir, jenis_kelamin')
        .eq('id', patientId)
        .maybeSingle(),
      supabase.from('profiles').select('nama').eq('id', profileId).maybeSingle(),
    ]);

    if (pat.error) {
      setErr(pesanGalat(pat.error.message));
    } else if (pat.data) {
      const p = pat.data as Pick<Patient, 'tgl_lahir' | 'jenis_kelamin'>;
      setTglLahir(p.tgl_lahir ?? '');
      setJk(p.jenis_kelamin);
    }
    setNama((prof.data as Pick<Profile, 'nama'> | null)?.nama ?? '');
    setLoading(false);
  }, [patientId, profileId]);

  useFocusEffect(
    useCallback(() => {
      if (!patientId) setLoading(false);
      void muat();
    }, [muat, patientId])
  );

  async function simpan() {
    if (!patientId) return;
    if (!cek.ok) {
      setErr(cek.pesan);
      return;
    }
    setBusy(true);
    setErr(null);
    setInfo(null);

    const [pat, prof] = await Promise.all([
      supabase
        .from('patients')
        .update({ tgl_lahir: cek.nilai, jenis_kelamin: jk })
        .eq('id', patientId),
      supabase
        .from('profiles')
        .update({ nama: nama.trim() || null })
        .eq('id', profileId),
    ]);

    setBusy(false);
    const gagal = pat.error ?? prof.error;
    if (gagal) {
      setErr(pesanGalat(gagal.message));
      return;
    }
    await reload();
    setInfo('Profil tersimpan.');
  }

  async function setRiset(ikut: boolean) {
    if (ikut === profile?.consent_penelitian) return;
    setErr(null);
    setInfo(null);
    setUbahRiset(true);
    try {
      await ubahConsentPenelitian(ikut);
      setInfo(
        ikut
          ? 'Terima kasih. Data Anda akan ikut dianalisis tanpa nama.'
          : 'Data Anda tidak akan ikut penelitian. Aplikasi tetap bisa dipakai seperti biasa.'
      );
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Gagal menyimpan pilihan.');
    }
    setUbahRiset(false);
  }

  if (loading) return <Loading />;

  return (
    <Screen>
      <Msg tone="info">
        Tanggal lahir dan jenis kelamin ikut di kepala ringkasan pra-kunjungan, supaya dokter
        membaca catatanmu bersama konteksnya.
      </Msg>

      {err && <Msg tone="err">{err}</Msg>}
      {info && <Msg tone="ok">{info}</Msg>}

      <Card>
        <SectionLabel>Data diri</SectionLabel>
        <Field label="Nama" value={nama} onChangeText={setNama} placeholder="Nama lengkap" />

        <Field
          label="Tanggal lahir (TTTT-BB-HH)"
          value={tglLahir}
          onChangeText={setTglLahir}
          placeholder="1990-03-15"
          autoCapitalize="none"
          keyboardType="numbers-and-punctuation"
        />
        {!cek.ok && <Msg tone="err">{cek.pesan}</Msg>}
        {usia != null && <Text style={styles.usia}>Usia {usia} tahun.</Text>}

        <SectionLabel>Jenis kelamin</SectionLabel>
        <Segmented options={JENIS_KELAMIN} value={jk} onChange={setJk} />
        <Text style={styles.ket}>
          Dipakai untuk statistik dan rentang rujukan lab, bukan untuk menentukan pengobatanmu.
        </Text>

        <PrimaryButton
          label="Simpan"
          onPress={() => void simpan()}
          loading={busy}
          disabled={!cek.ok}
        />
      </Card>

      <DokterSaya patientId={patientId} />

      <Card>
        <SectionLabel>Keikutsertaan penelitian</SectionLabel>
        <Text style={styles.ket}>
          Boleh diubah kapan saja, dan tidak memengaruhi pelayanan medis maupun fitur aplikasi.
          Kalau Anda berhenti ikut, data Anda tidak lagi disertakan pada analisis berikutnya.
        </Text>
        <Segmented
          options={[
            { v: 'ya', label: 'Ikut penelitian' },
            { v: 'tidak', label: 'Tidak ikut' },
          ]}
          value={
            profile?.consent_penelitian == null ? null : profile.consent_penelitian ? 'ya' : 'tidak'
          }
          onChange={(v) => void setRiset(v === 'ya')}
        />
        {ubahRiset && <Text style={styles.ket}>Menyimpan…</Text>}
        <Text style={styles.ket}>
          Data yang sudah terlanjur ikut ekspor sebelum Anda berhenti tidak bisa ditarik dari berkas
          yang sudah dibuat — di sana Anda hanya diwakili kode, tanpa nama.
        </Text>
      </Card>

      <Card>
        <SectionLabel>Akun</SectionLabel>
        <GhostButton label="Kembali" onPress={() => router.back()} />
        <GhostButton label="Keluar" onPress={() => void signOut()} />
      </Card>

      {/* Muncul sendiri begitu URL_SITUS diisi di constants/tautan.ts.
          Google Play mewajibkan tautan ini ada DI DALAM aplikasi, bukan hanya
          di Play Console — jadi sebelum kirim ke Play, ini harus terisi. */}
      {situsTerpasang() && (
        <Card>
          <SectionLabel>Privasi</SectionLabel>
          <Text style={styles.ket}>
            Data apa yang disimpan, di mana, siapa yang bisa melihatnya, dan bagaimana menghapusnya.
          </Text>
          <GhostButton
            label="Baca kebijakan privasi"
            onPress={() => void openBrowserAsync(urlPrivasi())}
          />
        </Card>
      )}

      {/* Dipisah ke kartunya sendiri, di paling bawah, dan tidak bersebelahan
          dengan "Keluar" — keduanya sekilas terbaca mirip, dan yang satu tidak
          bisa dibatalkan. Layar tujuannya masih meminta konfirmasi diketik. */}
      <Card>
        <SectionLabel>Hapus akun</SectionLabel>
        <Text style={styles.ket}>
          Menghapus akun beserta SELURUH catatan Anda, permanen. Berbeda dengan Keluar, yang hanya
          mengakhiri sesi di ponsel ini.
        </Text>
        <GhostButton label="Hapus akun saya…" onPress={() => router.push('/hapus-akun')} />
      </Card>

      <Disclaimer>{DISCLAIMER}</Disclaimer>
    </Screen>
  );
}

const styles = StyleSheet.create({
  usia: { fontSize: 13, fontWeight: '700', color: Brand.ungu },
  ket: { fontSize: 11.5, color: Brand.teksLembut, lineHeight: 17 },
});
