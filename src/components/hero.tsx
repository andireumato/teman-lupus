import Ionicons from '@expo/vector-icons/Ionicons';
import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet, Text, View } from 'react-native';

import { Brand, radius, space } from '@/constants/brand';
import { quoteHariIni, salamWaktu } from '@/lib/beranda';
import { tanggalPanjang } from '@/lib/dates';

/** Sapaan besar bergradien di puncak Beranda. */
export function Hero({
  nama,
  hariIni,
  sekarang,
}: {
  nama: string | null;
  hariIni: string;
  sekarang: Date;
}) {
  // Nama depan saja — sapaan terasa lebih akrab dan tidak memenuhi baris.
  const depan = nama?.trim().split(/\s+/)[0] ?? '';

  return (
    <LinearGradient
      colors={[Brand.ungu, Brand.ungu2]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.hero}
    >
      <Text style={styles.salam}>
        {salamWaktu(sekarang.getHours())}
        {depan ? `, ${depan}` : ''}
      </Text>
      <View style={styles.tanggalRow}>
        <Ionicons name="calendar-outline" size={13} color="rgba(255,255,255,0.9)" />
        <Text style={styles.tanggal}>{tanggalPanjang(hariIni)}</Text>
      </View>
      <Text style={styles.quote}>&ldquo;{quoteHariIni(sekarang)}&rdquo;</Text>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  hero: { borderRadius: radius.xl + 2, padding: space.lg + 2, gap: 5 },
  salam: { fontSize: 20, fontWeight: '800', color: '#fff' },
  tanggalRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  tanggal: { fontSize: 12.5, color: 'rgba(255,255,255,0.9)' },
  quote: {
    fontSize: 12.5,
    color: 'rgba(255,255,255,0.88)',
    fontStyle: 'italic',
    lineHeight: 19,
    marginTop: space.xs,
  },
});
