import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import {
  Card,
  Field,
  GhostButton,
  Loading,
  Msg,
  PrimaryButton,
  Screen,
  SectionLabel,
} from '@/components/ui/kit';
import { Brand, space } from '@/constants/brand';
import { CONSENT } from '@/constants/consent';
import {
  KATA_KONFIRMASI,
  bacaPratinjau,
  kalimatRingkas,
  konfirmasiCocok,
  type Pratinjau,
} from '@/lib/hapus-akun';
import { useSession } from '@/lib/session';
import { supabase } from '@/lib/supabase';

/**
 * HAPUS AKUN — satu-satunya jalur penghapusan permanen di aplikasi ini.
 *
 * Ada karena dua hal: hak penghapusan data pribadi di UU PDP 27/2022, dan
 * syarat Google Play bahwa aplikasi dengan pendaftaran akun harus menyediakan
 * penghapusan akun beserta seluruh datanya.
 *
 * Tiga penahan supaya tidak terpencet tanpa sengaja:
 *   1. Layar terpisah, dicapai lewat tautan bertulisan jelas di Profil
 *   2. Rincian berisi ANGKA — apa persisnya yang hilang, bukan peringatan umum
 *   3. Kata konfirmasi yang harus diketik huruf besar
 *
 * Penghapusannya sendiri satu panggilan `hapus_akun_saya()`; rantai CASCADE di
 * database yang mengerjakan sisanya. Menghapus tabel satu per satu dari sini
 * akan basi diam-diam setiap kali ada tabel baru — lihat supabase/hapus_akun.sql.
 */
export default function HapusAkunScreen() {
  const router = useRouter();
  const { signOut } = useSession();

  const [loading, setLoading] = useState(true);
  const [pratinjau, setPratinjau] = useState<Pratinjau | null>(null);
  const [ketik, setKetik] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      const { data, error } = await supabase.rpc('pratinjau_hapus_akun');
      if (error) {
        setErr(pesan(error.message));
      } else {
        setPratinjau(bacaPratinjau(data));
      }
      setLoading(false);
    })();
  }, []);

  async function hapus() {
    setErr(null);
    setBusy(true);

    const { error } = await supabase.rpc('hapus_akun_saya');
    if (error) {
      setBusy(false);
      setErr(pesan(error.message));
      return;
    }

    // Sesinya sudah tidak punya pengguna, jadi `signOut` di server bisa saja
    // menolak. Yang penting sesi LOKAL bersih — kalau tidak, aplikasi terbuka
    // dengan token milik akun yang sudah tidak ada dan setiap layar gagal
    // dengan galat yang tidak bisa dijelaskan.
    try {
      await signOut();
    } catch {
      // Diabaikan dengan sengaja: akunnya memang sudah tidak ada.
    }
    router.replace('/login');
  }

  if (loading) return <Loading label="Menghitung data Anda…" />;

  const siap = konfirmasiCocok(ketik);
  const dokter = pratinjau?.peran === 'doctor';

  return (
    <Screen>
      <Msg tone="err">
        Penghapusan akun bersifat permanen. Tidak ada cadangan dan tidak bisa dibatalkan.
      </Msg>

      {err && <Msg tone="err">{err}</Msg>}

      {pratinjau && (
        <>
          <Card>
            <SectionLabel>{dokter ? 'Yang akan terjadi' : 'Yang akan dihapus'}</SectionLabel>
            {pratinjau.rincian.map((r) => (
              <View key={r.label} style={styles.baris}>
                <Text style={styles.barisLabel}>{r.label}</Text>
                <Text style={styles.barisJumlah}>{r.jumlah}</Text>
              </View>
            ))}
            <Text style={styles.ringkas}>{kalimatRingkas(pratinjau)}</Text>
          </Card>

          <Card>
            <SectionLabel>Yang perlu Anda tahu</SectionLabel>
            {dokter ? (
              <>
                <Text style={styles.ket}>
                  Catatan pasien Anda tidak ikut terhapus — itu milik mereka. Yang hilang hanya
                  tautannya, dan mereka bisa menautkan diri ke dokter lain memakai kode dokter baru.
                </Text>
                <Text style={styles.ket}>
                  Kolom &ldquo;diperiksa oleh&rdquo; pada penilaian SLEDAI-2K dan catatan kunjungan
                  lama Anda akan menjadi kosong. Kolom itu tidak ikut ekspor penelitian, jadi
                  analisis yang sudah berjalan tidak terpengaruh.
                </Text>
              </>
            ) : (
              <>
                <Text style={styles.ket}>
                  Dokter Anda tidak lagi bisa melihat catatan apa pun dari Anda, termasuk ringkasan
                  pra-kunjungan dan peringatan yang pernah terkirim.
                </Text>
                <Text style={styles.ket}>
                  Data yang sudah terlanjur ikut ekspor penelitian sebelumnya tidak bisa ditarik
                  kembali dari berkas yang sudah keluar — tetapi di sana Anda hanya diwakili kode,
                  tanpa nama maupun tanggal lahir.
                </Text>
              </>
            )}
            <Text style={styles.ket}>
              Pertanyaan tentang data Anda bisa disampaikan ke {CONSENT.kontak}.
            </Text>
          </Card>

          <Card>
            <SectionLabel>Konfirmasi</SectionLabel>
            <Text style={styles.ket}>
              Ketik <Text style={styles.tebal}>{KATA_KONFIRMASI}</Text> dengan huruf besar untuk
              menghidupkan tombolnya.
            </Text>
            <Field
              label={`Ketik ${KATA_KONFIRMASI}`}
              value={ketik}
              onChangeText={setKetik}
              autoCapitalize="characters"
              autoCorrect={false}
              placeholder={KATA_KONFIRMASI}
            />
            <PrimaryButton
              label={busy ? 'Menghapus…' : 'Hapus akun saya permanen'}
              onPress={() => void hapus()}
              loading={busy}
              disabled={!siap}
            />
            <GhostButton label="Batal, kembali" onPress={() => router.back()} />
          </Card>
        </>
      )}

      {!pratinjau && !err && (
        <Card>
          <Text style={styles.ket}>Data akun tidak bisa dibaca. Coba lagi nanti.</Text>
          <GhostButton label="Kembali" onPress={() => router.back()} />
        </Card>
      )}
    </Screen>
  );
}

/** Fungsi baru belum tentu ada di project Supabase lama. */
function pesan(raw: string): string {
  return /hapus_akun_saya|pratinjau_hapus_akun/.test(raw)
    ? 'Fungsi hapus akun belum ada di database. Jalankan supabase/hapus_akun.sql lebih dulu.'
    : raw;
}

const styles = StyleSheet.create({
  baris: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
    gap: space.sm,
  },
  barisLabel: { flex: 1, fontSize: 13, color: Brand.teks },
  barisJumlah: { fontSize: 13, fontWeight: '700', color: Brand.teks },
  ringkas: { fontSize: 13, fontWeight: '600', color: Brand.merah, lineHeight: 19, marginTop: 4 },
  ket: { fontSize: 12, color: Brand.teksLembut, lineHeight: 18 },
  tebal: { fontWeight: '800', color: Brand.teks },
});
