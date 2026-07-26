import { Stack, useRouter, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { View } from 'react-native';

import { Brand } from '@/constants/brand';
import { SessionProvider, useSession } from '@/lib/session';

SplashScreen.preventAutoHideAsync();

/**
 * Penjaga rute: menentukan layar mana yang boleh dilihat berdasarkan
 * status login dan status persetujuan.
 *
 *   belum login          → /login
 *   login, belum consent → /consent
 *   login + consent      → (tabs)
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

    if (!session) {
      if (!diLogin) router.replace('/login');
      return;
    }

    // Profil belum sempat termuat — tunggu, jangan lempar ke mana-mana.
    if (!profile) return;

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
      <Stack.Screen name="mars" options={{ title: 'Kuesioner MARS-5' }} />
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
