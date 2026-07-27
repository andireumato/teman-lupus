import { Stack } from 'expo-router';

import { Brand } from '@/constants/brand';

/**
 * Sisi dokter memakai Stack, bukan Tabs: alurnya lurus — daftar pasien →
 * satu pasien → formulir SLEDAI — dan tidak ada dua tempat yang perlu
 * dibolak-balik.
 */
export default function DokterLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: Brand.ungu },
        headerTintColor: '#fff',
        headerTitleStyle: { fontWeight: '700' },
        contentStyle: { backgroundColor: Brand.latar },
      }}
    >
      <Stack.Screen name="index" options={{ title: 'Pasien Saya' }} />
      <Stack.Screen name="akun" options={{ title: 'Akun Dokter' }} />
      <Stack.Screen name="pasien/[id]" options={{ title: 'Ringkasan Pasien' }} />
      <Stack.Screen name="sledai/[id]" options={{ title: 'SLEDAI-2K' }} />
    </Stack>
  );
}
