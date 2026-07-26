import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Brand, radius, space } from '@/constants/brand';

const TILES = [
  { ke: '/flare', ikon: 'pulse-outline', label: 'Cek Flare' },
  { ke: '/obat', ikon: 'medkit-outline', label: 'Obat' },
  { ke: '/tren', ikon: 'trending-up-outline', label: 'Tren' },
] as const;

/** Pintasan ke tab lain langsung dari Beranda. */
export function QuickTiles() {
  const router = useRouter();

  return (
    <View style={styles.baris}>
      {TILES.map((t) => (
        <Pressable
          key={t.ke}
          accessibilityRole="button"
          accessibilityLabel={t.label}
          onPress={() => router.navigate(t.ke)}
          style={({ pressed }) => [styles.tile, pressed && styles.ditekan]}
        >
          <Ionicons name={t.ikon} size={24} color={Brand.ungu} />
          <Text style={styles.label}>{t.label}</Text>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  baris: { flexDirection: 'row', gap: 11 },
  tile: {
    flex: 1,
    backgroundColor: '#faf7ff',
    borderWidth: 1,
    borderColor: Brand.garis,
    borderRadius: radius.xl,
    paddingVertical: space.lg - 2,
    paddingHorizontal: 6,
    alignItems: 'center',
    gap: 5,
  },
  ditekan: { opacity: 0.7 },
  label: { fontSize: 12, color: '#4b5563', fontWeight: '600' },
});
