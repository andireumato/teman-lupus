import { Stack, useRouter, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { View } from 'react-native';

import { Brand } from '@/constants/brand';
import { pasangPenangan } from '@/lib/notifikasi';
import { SessionProvider, useSession } from '@/lib/session';

SplashScreen.preventAutoHideAsync();

// Dipasang di tingkat modul, sekali seumur proses: pengingat yang jatuh
// persis saat pasien sedang membuka aplikasi harus tetap tampil, bukan
// hilang tanpa jejak. Tidak meminta izin apa pun — itu terjadi hanya
// ketika pasien menyalakan saklarnya di layar Obat.
pasangPenangan();

/**
 * Penjaga rute: menentukan layar mana yang boleh dilihat berdasarkan
 * status login, peran, dan status persetujuan.
 *
 *   belum login           → /login
 *   dokter                → /dokter
 *   pasien, belum consent → /consent
 *   pasien + consent      → (tabs)
 *
 * Consent hanya berlaku bagi pasien: naskahnya tentang penggunaan data
 * pribadi pasien, dan dokter tidak menyerahkan datanya sendiri di sini.
 */
function AuthGate() {
  const { session, profile, loading, consentValid } = useSession();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    SplashScreen.hideAsync().catch(() => {});

    const seg = segments[0];
    const diLogin = seg === 'login';
    const diConsent = seg === 'consent';
    const diDokter = seg === 'dokter';

    if (!session) {
      if (!diLogin) router.replace('/login');
      return;
    }

    // Profil belum sempat termuat — tunggu, jangan lempar ke mana-mana.
    if (!profile) return;

    if (profile.role === 'doctor') {
      if (!diDokter) router.replace('/dokter');
      return;
    }

    // Pasien tidak boleh masuk ke rute dokter meski mengetik alamatnya.
    if (diDokter) {
      router.replace('/');
      return;
    }

    if (!consentValid) {
      if (!diConsent) router.replace('/consent');
      return;
    }

    if (diLogin || diConsent) router.replace('/');
  }, [loading, session, profile, consentValid, segments, router]);

  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: Brand.ungu },
        headerTintColor: '#fff',
        headerTitleStyle: { fontWeight: '700' },
        contentStyle: { backgroundColor: Brand.latar },
      }}
    >
      <Stack.Screen name="login" options={{ headerShown: false }} />
      <Stack.Screen name="consent" options={{ title: 'Persetujuan Ikut Serta' }} />
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="checkin" options={{ title: 'Check-in Harian' }} />
      <Stack.Screen name="mars" options={{ title: 'Kuesioner MARS-5' }} />
      <Stack.Screen name="lupusqol" options={{ title: 'Kualitas Hidup (LupusQoL)' }} />
      <Stack.Screen name="ringkasan" options={{ title: 'Ringkasan Pra-Kunjungan' }} />
      <Stack.Screen name="efek-samping" options={{ title: 'Efek Samping Obat' }} />
      <Stack.Screen name="profil" options={{ title: 'Profil Saya' }} />
      <Stack.Screen name="hapus-akun" options={{ title: 'Hapus Akun' }} />
      <Stack.Screen name="pengingat-bantuan" options={{ title: 'Pengingat Tidak Berbunyi' }} />
      <Stack.Screen name="dokter" options={{ headerShown: false }} />
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <SessionProvider>
      <View style={{ flex: 1, backgroundColor: Brand.latar }}>
        <StatusBar style="light" />
        <AuthGate />
      </View>
    </SessionProvider>
  );
}
