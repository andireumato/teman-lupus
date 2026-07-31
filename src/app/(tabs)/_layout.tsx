import Ionicons from '@expo/vector-icons/Ionicons';
import { Link, Tabs } from 'expo-router';
import type { ColorValue } from 'react-native';
import { Pressable, StyleSheet } from 'react-native';

import { Brand } from '@/constants/brand';

/**
 * Ikon vektor, bukan emoji: emoji tidak punya glyph di sebagian environment
 * (mis. simulator iOS yang baru diunduh) dan muncul sebagai kotak kosong.
 */
type IconName = React.ComponentProps<typeof Ionicons>['name'];

function icon(name: IconName) {
  const TabIcon = ({ color, size }: { color: ColorValue; size: number }) => (
    <Ionicons name={name} size={size} color={color as string} />
  );
  TabIcon.displayName = `TabIcon(${name})`;
  return TabIcon;
}

/**
 * Jalan masuk ke Profil, di tempat orang biasa mencarinya.
 *
 * `<Link asChild>` menolak `style` berbentuk larik, jadi gayanya diratakan
 * dulu — pelajaran yang sama dari daftar pasien sisi dokter.
 */
function TombolProfil() {
  return (
    <Link href="/profil" asChild>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Profil saya"
        hitSlop={10}
        style={StyleSheet.flatten([styles.profil])}
      >
        <Ionicons name="person-circle-outline" size={26} color="#fff" />
      </Pressable>
    </Link>
  );
}

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: Brand.ungu },
        headerTintColor: '#fff',
        headerTitleStyle: { fontWeight: '700' },
        tabBarActiveTintColor: Brand.ungu,
        tabBarInactiveTintColor: '#9ca3af',
        tabBarLabelStyle: { fontSize: 10.5, fontWeight: '600' },
        sceneStyle: { backgroundColor: Brand.latar },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Check-in',
          headerTitle: 'Teman Lupus',
          tabBarIcon: icon('home-outline'),
          headerRight: () => <TombolProfil />,
        }}
      />
      <Tabs.Screen
        name="flare"
        options={{
          title: 'Cek Flare',
          tabBarIcon: icon('pulse-outline'),
        }}
      />
      <Tabs.Screen
        name="obat"
        options={{
          title: 'Obat',
          headerTitle: 'Obat & Kepatuhan',
          tabBarIcon: icon('medkit-outline'),
        }}
      />
      <Tabs.Screen
        name="lab"
        options={{
          title: 'Lab',
          headerTitle: 'Lab Saya',
          tabBarIcon: icon('flask-outline'),
        }}
      />
      <Tabs.Screen
        name="tren"
        options={{
          title: 'Tren',
          headerTitle: 'Tren & Riwayat',
          tabBarIcon: icon('trending-up-outline'),
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  profil: { marginRight: 14 },
});
