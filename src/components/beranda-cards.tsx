import Ionicons from '@expo/vector-icons/Ionicons';
import { StyleSheet, Text, View } from 'react-native';

import { Brand, radius, space } from '@/constants/brand';
import { quoteHariIni, salamWaktu, streakInfo, tipHariIni, type Insight } from '@/lib/beranda';
import { tanggalPanjang } from '@/lib/dates';

/** Sapaan sesuai waktu + tanggal + kutipan harian. */
export function DailyHeader({ hariIni, sekarang }: { hariIni: string; sekarang: Date }) {
  return (
    <View style={styles.header}>
      <Text style={styles.salam}>{salamWaktu(sekarang.getHours())}</Text>
      <View style={styles.tanggalRow}>
        <Ionicons name="calendar-outline" size={14} color={Brand.ungu} />
        <Text style={styles.tanggal}>{tanggalPanjang(hariIni)}</Text>
      </View>
      <Text style={styles.quote}>&ldquo;{quoteHariIni(sekarang)}&rdquo;</Text>
    </View>
  );
}

/** Streak, tingkatan berikutnya, insight, dan status check-in hari ini. */
export function StatusBeranda({
  streak,
  insight,
  sudahIsi,
}: {
  streak: number;
  insight: Insight | null;
  sudahIsi: boolean;
}) {
  const { earned, next } = streakInfo(streak);
  const sisa = next ? next.n - streak : 0;

  return (
    <View style={styles.status}>
      <View style={styles.streakRow}>
        <Ionicons name={earned?.ikon ?? 'flame-outline'} size={18} color={Brand.kuning} />
        <Text style={styles.streakText}>
          {streak > 0 ? (
            <>
              <Text style={styles.streakAngka}>{streak} hari berturut</Text> check-in
              {next ? ` · ${sisa} hari lagi ke ${next.label}` : ''}
            </>
          ) : (
            'Yuk mulai kebiasaan check-in-mu hari ini'
          )}
        </Text>
      </View>

      {insight && <Text style={styles.insight}>{insight.teks}</Text>}

      {sudahIsi && (
        <View style={styles.selesaiRow}>
          <Ionicons name="checkmark-circle" size={14} color={Brand.hijau} />
          <Text style={styles.selesai}>Check-in hari ini sudah terisi.</Text>
        </View>
      )}
    </View>
  );
}

/** Edukasi lupus harian. */
export function TipCard({ sekarang }: { sekarang: Date }) {
  return (
    <View style={styles.tip}>
      <View style={styles.tipHead}>
        <Ionicons name="bulb-outline" size={15} color="#1d4ed8" />
        <Text style={styles.tipJudul}>Tahukah kamu?</Text>
      </View>
      <Text style={styles.tipIsi}>{tipHariIni(sekarang)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    backgroundColor: Brand.unguMuda,
    borderWidth: 1,
    borderColor: Brand.unguGaris,
    borderRadius: radius.xl - 2,
    padding: space.lg,
    gap: 3,
  },
  salam: { fontSize: 12, color: '#9333ea', fontWeight: '600' },
  tanggalRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  tanggal: { fontSize: 13.5, color: Brand.ungu, fontWeight: '700' },
  quote: {
    fontSize: 13.5,
    color: '#5b5566',
    fontStyle: 'italic',
    lineHeight: 20,
    marginTop: space.xs,
  },
  status: {
    backgroundColor: '#fff7ed',
    borderWidth: 1,
    borderColor: '#fed7aa',
    borderRadius: radius.xl - 2,
    padding: space.md + 2,
    gap: 5,
  },
  streakRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  streakText: { flex: 1, fontSize: 13.5, color: '#c2410c', lineHeight: 19 },
  streakAngka: { fontWeight: '800' },
  insight: { fontSize: 12.5, color: '#7c2d12', lineHeight: 19 },
  selesaiRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  selesai: { fontSize: 11.5, color: Brand.hijau },
  tip: {
    backgroundColor: '#eff6ff',
    borderWidth: 1,
    borderColor: '#dbeafe',
    borderRadius: radius.xl - 2,
    padding: space.md + 2,
    gap: 4,
  },
  tipHead: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  tipJudul: { fontSize: 12, color: '#1d4ed8', fontWeight: '700' },
  tipIsi: { fontSize: 13, color: '#1e3a5f', lineHeight: 20 },
});
