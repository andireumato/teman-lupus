import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Brand, radius } from '@/constants/brand';

/**
 * Skala mood 1–5 dengan ikon wajah.
 *
 * Prototipe web memakai emoji (😣😟😐🙂😄); di aplikasi native emoji tidak
 * dijamin punya glyph dan bisa tampil sebagai kotak kosong, jadi dipakai ikon
 * vektor dengan bentuk wajah yang setara.
 */
const WAJAH = [
  { v: 1, ikon: 'emoticon-sad-outline', label: 'Sangat buruk' },
  { v: 2, ikon: 'emoticon-confused-outline', label: 'Buruk' },
  { v: 3, ikon: 'emoticon-neutral-outline', label: 'Biasa' },
  { v: 4, ikon: 'emoticon-happy-outline', label: 'Baik' },
  { v: 5, ikon: 'emoticon-excited-outline', label: 'Sangat baik' },
] as const;

const WARNA = ['#dc2626', '#ea580c', '#ca8a04', '#65a30d', '#16a34a'];

export function MoodScale({
  value,
  onChange,
}: {
  value: number | null;
  onChange: (v: number) => void;
}) {
  return (
    <View style={styles.row}>
      {WAJAH.map((w, i) => {
        const on = value === w.v;
        return (
          <Pressable
            key={w.v}
            accessibilityRole="radio"
            accessibilityState={{ selected: on }}
            accessibilityLabel={w.label}
            onPress={() => onChange(w.v)}
            style={[styles.item, on && { borderColor: WARNA[i], backgroundColor: '#fff' }]}
          >
            <MaterialCommunityIcons name={w.ikon} size={30} color={on ? WARNA[i] : '#c4c8ce'} />
            <Text style={[styles.label, on && { color: WARNA[i], fontWeight: '700' }]}>
              {w.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 6 },
  item: {
    flex: 1,
    alignItems: 'center',
    gap: 3,
    paddingVertical: 10,
    paddingHorizontal: 2,
    borderWidth: 1.5,
    borderColor: '#e5e7eb',
    borderRadius: radius.md,
    backgroundColor: '#fff',
    minHeight: 70,
    justifyContent: 'center',
  },
  label: { fontSize: 9.5, color: Brand.teksLembut, textAlign: 'center' },
});
