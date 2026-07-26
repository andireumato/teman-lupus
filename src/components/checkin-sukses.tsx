import Ionicons from '@expo/vector-icons/Ionicons';
import { StyleSheet, Text, View } from 'react-native';

import { GhostButton } from '@/components/ui/kit';
import { Brand, radius, space } from '@/constants/brand';
import { streakInfo, tepatMilestone, type Insight } from '@/lib/beranda';

/** Layar apresiasi setelah check-in tersimpan. */
export function CheckinSukses({
  streak,
  insight,
  onKembali,
}: {
  streak: number;
  insight: Insight | null;
  onKembali: () => void;
}) {
  const { earned, next } = streakInfo(streak);
  const milestone = tepatMilestone(streak);

  return (
    <View style={styles.wrap}>
      <View style={styles.kartu}>
        <Ionicons name="checkmark-circle" size={52} color={Brand.hijau} />
        <Text style={styles.judul}>Check-in tersimpan!</Text>

        {streak > 0 && (
          <View style={styles.streakRow}>
            <Ionicons name={earned?.ikon ?? 'flame-outline'} size={22} color="#c2410c" />
            <Text style={styles.streakText}>{streak} hari berturut</Text>
          </View>
        )}

        {milestone && (
          <Text style={styles.milestone}>Pencapaian baru: {milestone.label} berturut. Hebat!</Text>
        )}

        {streak > 0 && next && (
          <Text style={styles.next}>
            {next.n - streak} hari lagi menuju {next.label}
          </Text>
        )}

        {insight && <Text style={styles.insight}>{insight.teks}</Text>}
      </View>

      <GhostButton label="Kembali ke beranda" onPress={onKembali} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: space.md },
  kartu: {
    backgroundColor: Brand.hijauMuda,
    borderWidth: 1,
    borderColor: '#bbf7d0',
    borderRadius: radius.xl,
    padding: space.xl,
    alignItems: 'center',
    gap: 6,
  },
  judul: { fontSize: 17, fontWeight: '700', color: '#15803d', marginTop: 2 },
  streakRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: space.xs },
  streakText: { fontSize: 24, fontWeight: '800', color: '#c2410c' },
  milestone: {
    fontSize: 13,
    color: '#c2410c',
    fontWeight: '700',
    textAlign: 'center',
    marginTop: space.xs,
  },
  next: { fontSize: 12, color: '#9a3412', textAlign: 'center' },
  insight: {
    fontSize: 13,
    color: '#7c2d12',
    textAlign: 'center',
    lineHeight: 20,
    marginTop: space.md,
  },
});
