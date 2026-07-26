import Ionicons from '@expo/vector-icons/Ionicons';
import { StyleSheet, Text, View } from 'react-native';

import { GhostButton, PrimaryButton } from '@/components/ui/kit';
import { Brand, radius, space } from '@/constants/brand';
import type { Insight } from '@/lib/beranda';

/**
 * Ajakan utama Beranda: mengarahkan pasien ke formulir check-in, atau
 * mengapresiasi bila hari ini sudah terisi.
 */
export function CtaCard({
  sudahIsi,
  streak,
  insight,
  onIsi,
}: {
  sudahIsi: boolean;
  streak: number;
  insight: Insight | null;
  onIsi: () => void;
}) {
  const chip =
    streak > 0 ? (
      <View style={styles.chip}>
        <Ionicons name="flame" size={11} color="#c2410c" />
        <Text style={styles.chipTeks}>{streak} hari</Text>
      </View>
    ) : null;

  if (sudahIsi) {
    return (
      <View style={[styles.kartu, styles.selesai]}>
        {chip}
        <Text style={styles.judulSelesai}>Check-in hari ini selesai</Text>
        <Text style={styles.subSelesai}>Terima kasih sudah menjaga dirimu hari ini.</Text>
        {insight && <Text style={styles.insight}>{insight.teks}</Text>}
        <GhostButton label="Perbarui check-in" onPress={onIsi} />
      </View>
    );
  }

  return (
    <View style={[styles.kartu, styles.belum]}>
      {chip}
      <Text style={styles.judulBelum}>Bagaimana kondisimu hari ini?</Text>
      <Text style={styles.subBelum}>Isi check-in harianmu — cukup 20 detik.</Text>
      <PrimaryButton label="Isi Check-in Hari Ini" onPress={onIsi} />
      {insight && streak > 0 && <Text style={styles.insightBelum}>{insight.teks}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  kartu: {
    borderWidth: 1,
    borderRadius: radius.lg,
    padding: space.lg,
    gap: 5,
    position: 'relative',
  },
  selesai: { backgroundColor: '#f0fdf4', borderColor: '#bbf7d0' },
  belum: { backgroundColor: '#f6f2ff', borderColor: '#e4d6ff' },
  chip: {
    position: 'absolute',
    top: space.md,
    right: space.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#fff7ed',
    borderWidth: 1,
    borderColor: '#fed7aa',
    borderRadius: 13,
    paddingHorizontal: 9,
    paddingVertical: 3,
  },
  chipTeks: { fontSize: 11.5, fontWeight: '700', color: '#c2410c' },
  judulSelesai: { fontSize: 16, fontWeight: '800', color: '#15803d', maxWidth: '76%' },
  subSelesai: { fontSize: 12.5, color: '#3f6212' },
  judulBelum: { fontSize: 16.5, fontWeight: '800', color: '#6b21a8', maxWidth: '76%' },
  subBelum: { fontSize: 12.5, color: '#7c6f93' },
  insight: { fontSize: 12.5, color: Brand.teksLembut, lineHeight: 19, marginTop: space.xs },
  insightBelum: { fontSize: 12, color: '#7c6f93', lineHeight: 18, marginTop: space.xs },
});
