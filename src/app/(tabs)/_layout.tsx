import Ionicons from '@expo/vector-icons/Ionicons';
import { Tabs } from 'expo-router';
import type { ColorValue } from 'react-native';

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
