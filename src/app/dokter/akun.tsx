import { useCallback, useState } from 'react';
import { Platform, Share, StyleSheet, Text, View } from 'react-native';

import {
  Card,
  Disclaimer,
  GhostButton,
  InfoBar,
  Msg,
  PrimaryButton,
  Screen,
  SectionLabel,
} from '@/components/ui/kit';
import { Brand, radius, space } from '@/constants/brand';
import { DISCLAIMER } from '@/constants/consent';
import { buatKode, formatKode } from '@/lib/kode';
import { useSession } from '@/lib/session';
import { supabase } from '@/lib/supabase';

/** Berapa kali mencoba kode baru bila kebetulan sudah dipakai dokter lain. */
const PERCOBAAN = 5;

export default function AkunDokterScreen() {
  const { profile, session, reload, signOut } = useSession();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const kode = profile?.kode_dokter ?? null;

  /**
   * Kode dibuat di aplikasi lalu disimpan ke profil sendiri. Keunikannya
   * dijamin unique index di database, bukan oleh keberuntungan: bila kodenya
   * bentrok, insert ditolak dan kita coba kode lain.
   */
  const buat = useCallback(async () => {
    const userId = session?.user.id;
    if (!userId) return;
    setBusy(true);
    setErr(null);
    setInfo(null);

    for (let i = 0; i < PERCOBAAN; i++) {
      const calon = buatKode();
      const { error } = await supabase
        .from('profiles')
        .update({ kode_dokter: calon })
        .eq('id', userId);

      if (!error) {
        await reload();
        setBusy(false);
        setInfo('Kode baru dibuat. Kode lama tidak berlaku lagi.');
        return;
      }
      // 23505 = unique violation; kode itu sudah dipakai, coba yang lain.
      if (error.code !== '23505') {
        setBusy(false);
        setErr(`Gagal membuat kode: ${error.message}`);
        return;
      }
    }

    setBusy(false);
    setErr('Gagal membuat kode unik setelah beberapa percobaan. Coba lagi.');
  }, [session?.user.id, reload]);

  async function bagikan() {
    if (!kode) return;
    const pesan =
      `Kode dokter untuk aplikasi Teman Lupus: ${formatKode(kode)}\n\n` +
      'Buka aplikasi → tab Tren → “Dokter saya” → masukkan kode ini.';
    try {
      if (Platform.OS === 'web') {
        await navigator.clipboard.writeText(pesan);
        setInfo('Teks ajakan sudah disalin.');
        return;
      }
      await Share.share({ message: pesan });
    } catch (e) {
      setErr(`Gagal membagikan: ${e instanceof Error ? e.message : 'tidak diketahui'}`);
    }
  }

  return (
    <Screen>
      <InfoBar>
        Kode ini yang dimasukkan pasien agar datanya bisa Anda lihat. Satu kode dipakai oleh semua
        pasien Anda.
      </InfoBar>

      {err && <Msg tone="err">{err}</Msg>}
      {info && <Msg tone="ok">{info}</Msg>}

      <Card>
        <SectionLabel>Kode dokter</SectionLabel>
        {kode ? (
          <>
            <View style={styles.kodeKotak}>
              <Text
                style={styles.kode}
                accessibilityLabel={`Kode dokter ${kode.split('').join(' ')}`}
              >
                {formatKode(kode)}
              </Text>
            </View>
            <PrimaryButton label="Bagikan kode ke pasien" onPress={() => void bagikan()} />
            <GhostButton label="Buat kode baru" onPress={() => void buat()} disabled={busy} />
            <Text style={styles.hint}>
              Membuat kode baru tidak memutus pasien yang sudah tertaut — mereka tetap tertaut. Yang
              berubah hanya kode untuk pasien berikutnya.
            </Text>
          </>
        ) : (
          <>
            <Text style={styles.hint}>
              Anda belum punya kode. Buat sekarang, lalu bagikan kepada pasien.
            </Text>
            <PrimaryButton label="Buat kode dokter" onPress={() => void buat()} loading={busy} />
          </>
        )}
      </Card>

      <Card>
        <SectionLabel>Akun</SectionLabel>
        <Text style={styles.akun}>{profile?.nama ?? '—'} · Dokter</Text>
        <GhostButton label="Keluar" onPress={() => void signOut()} />
      </Card>

      <Disclaimer>{DISCLAIMER}</Disclaimer>
    </Screen>
  );
}

const styles = StyleSheet.create({
  kodeKotak: {
    backgroundColor: Brand.unguMuda,
    borderWidth: 1,
    borderColor: Brand.unguGaris,
    borderRadius: radius.lg,
    paddingVertical: space.lg,
    alignItems: 'center',
  },
  kode: { fontSize: 32, fontWeight: '800', color: Brand.ungu, letterSpacing: 3 },
  hint: { fontSize: 12, color: Brand.teksLembut, lineHeight: 18 },
  akun: { fontSize: 13, color: Brand.teks },
});
