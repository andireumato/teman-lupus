import Ionicons from '@expo/vector-icons/Ionicons';
import { StyleSheet, Text, View } from 'react-native';

import { Brand, radius, space } from '@/constants/brand';
import type { HasilTarget, Kriteria, StatusKriteria, StatusTarget } from '@/lib/target';

/**
 * Tampilan hasil target terapi (DORIS 2021 / LLDAS).
 *
 * Dua bentuk, satu sumber: `TargetChecklist` untuk formulir, `TargetRingkas`
 * untuk daftar riwayat. Keduanya membaca `HasilTarget` yang sama, jadi tidak
 * bisa menampilkan kesimpulan yang berbeda untuk baris yang sama.
 */

export const WARNA_STATUS: Record<StatusTarget, string> = {
  tercapai: Brand.hijau,
  tidak: Brand.teksLembut,
  'belum-lengkap': Brand.kuning,
};

export const TEKS_STATUS: Record<StatusTarget, string> = {
  tercapai: 'Tercapai',
  tidak: 'Tidak tercapai',
  'belum-lengkap': 'Belum lengkap',
};

type IconName = React.ComponentProps<typeof Ionicons>['name'];

const IKON: Record<StatusKriteria, { nama: IconName; warna: string }> = {
  ya: { nama: 'checkmark-circle', warna: Brand.hijau },
  tidak: { nama: 'close-circle', warna: Brand.merah },
  // Bukan silang: syarat yang datanya belum ada BUKAN syarat yang gagal.
  belum: { nama: 'ellipse-outline', warna: '#9ca3af' },
};

function Baris({ k }: { k: Kriteria }) {
  const ikon = IKON[k.status];
  return (
    <View style={styles.baris}>
      <Ionicons name={ikon.nama} size={18} color={ikon.warna} style={styles.ikon} />
      <View style={styles.isi}>
        <Text style={[styles.label, k.status === 'ya' && styles.labelYa]}>{k.label}</Text>
        {k.nilai && <Text style={styles.nilai}>{k.nilai}</Text>}
      </View>
      {/* Menandai mana yang dijamin data dan mana pernyataan dokter. Tanpa itu,
          pembacanya tidak tahu bagian mana dari kesimpulan ini yang bisa
          ditelusuri kembali ke deskriptor yang dicentang. */}
      {k.otomatis && (
        <View style={styles.tag}>
          <Text style={styles.tagText}>SLEDAI-2K</Text>
        </View>
      )}
    </View>
  );
}

/** Daftar syarat lengkap — dipakai di formulir Target terapi. */
export function TargetChecklist({ nama, hasil }: { nama: string; hasil: HasilTarget }) {
  return (
    <View style={styles.grup}>
      <View style={styles.head}>
        <Text style={styles.nama}>{nama}</Text>
        <View style={[styles.badge, { backgroundColor: WARNA_STATUS[hasil.status] }]}>
          <Text style={styles.badgeText}>{TEKS_STATUS[hasil.status]}</Text>
        </View>
      </View>
      {hasil.kriteria.map((k) => (
        <Baris key={k.label} k={k} />
      ))}
    </View>
  );
}

/** Hanya lencana kesimpulannya — dipakai di daftar riwayat yang panjang. */
export function TargetRingkas({ nama, hasil }: { nama: string; hasil: HasilTarget }) {
  return (
    <View style={styles.head}>
      <Text style={styles.namaRingkas}>{nama}</Text>
      <View style={[styles.badge, { backgroundColor: WARNA_STATUS[hasil.status] }]}>
        <Text style={styles.badgeText}>{TEKS_STATUS[hasil.status]}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  grup: { gap: 2, paddingVertical: space.sm },
  head: { flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingVertical: 3 },
  nama: { flex: 1, fontSize: 14, fontWeight: '800', color: Brand.teks },
  namaRingkas: { flex: 1, fontSize: 13, fontWeight: '600', color: Brand.teks },
  badge: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 2 },
  badgeText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  baris: { flexDirection: 'row', alignItems: 'flex-start', gap: space.sm, paddingVertical: 5 },
  ikon: { marginTop: 1 },
  isi: { flex: 1, gap: 1 },
  label: { fontSize: 13, color: Brand.teks, lineHeight: 18 },
  labelYa: { color: '#4b5563' },
  nilai: { fontSize: 11.5, color: Brand.teksLembut, lineHeight: 16 },
  tag: {
    borderRadius: radius.sm,
    backgroundColor: Brand.unguMuda,
    borderWidth: 1,
    borderColor: Brand.unguGaris,
    paddingHorizontal: 6,
    paddingVertical: 1,
  },
  tagText: { fontSize: 9.5, fontWeight: '700', color: Brand.ungu },
});
