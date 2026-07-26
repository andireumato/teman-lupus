import Ionicons from '@expo/vector-icons/Ionicons';
import type { ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputProps,
  type ViewStyle,
} from 'react-native';

import { Brand, radius, space } from '@/constants/brand';

export function Screen({ children, style }: { children: ReactNode; style?: ViewStyle }) {
  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={[styles.screenContent, style]}
      keyboardShouldPersistTaps="handled"
    >
      {children}
    </ScrollView>
  );
}

export function Card({ children, style }: { children: ReactNode; style?: ViewStyle }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function SectionLabel({ children }: { children: ReactNode }) {
  return <Text style={styles.sectionLabel}>{children}</Text>;
}

export function Muted({ children }: { children: ReactNode }) {
  return <Text style={styles.muted}>{children}</Text>;
}

/** Kotak penjelasan singkat di atas tiap tab. */
export function InfoBar({ children }: { children: ReactNode }) {
  return (
    <View style={styles.infoBar}>
      <Ionicons name="information-circle-outline" size={17} color={Brand.ungu} />
      <Text style={styles.infoText}>{children}</Text>
    </View>
  );
}

export type MsgTone = 'info' | 'ok' | 'err';

export function Msg({ tone = 'info', children }: { tone?: MsgTone; children: ReactNode }) {
  const toneStyle = tone === 'ok' ? styles.msgOk : tone === 'err' ? styles.msgErr : styles.msgInfo;
  return (
    <View style={[styles.msg, toneStyle]}>
      <Text style={styles.msgText}>{children}</Text>
    </View>
  );
}

export function PrimaryButton({
  label,
  onPress,
  disabled,
  loading,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
}) {
  const off = disabled || loading;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!off }}
      onPress={onPress}
      disabled={off}
      style={({ pressed }) => [
        styles.btn,
        styles.btnPrimary,
        off && styles.btnOff,
        pressed && !off && styles.btnPressed,
      ]}
    >
      {loading ? (
        <ActivityIndicator color="#fff" />
      ) : (
        <Text style={styles.btnPrimaryText}>{label}</Text>
      )}
    </Pressable>
  );
}

export function GhostButton({
  label,
  onPress,
  disabled,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.btn,
        styles.btnGhost,
        disabled && styles.btnOff,
        pressed && !disabled && styles.btnPressed,
      ]}
    >
      <Text style={styles.btnGhostText}>{label}</Text>
    </Pressable>
  );
}

export function Field({
  label,
  ...props
}: TextInputProps & {
  label: string;
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        style={styles.input}
        placeholderTextColor="#9ca3af"
        accessibilityLabel={label}
        {...props}
      />
    </View>
  );
}

/** Deretan pilihan tunggal berjajar (mis. skala 0–3 tanpa keterangan). */
export function Segmented<T extends string | number>({
  options,
  value,
  onChange,
}: {
  options: { v: T; label: string }[];
  value: T | null;
  onChange: (v: T) => void;
}) {
  return (
    <View style={styles.seg}>
      {options.map((o) => {
        const on = value === o.v;
        return (
          <Pressable
            key={String(o.v)}
            accessibilityRole="radio"
            accessibilityState={{ selected: on }}
            onPress={() => onChange(o.v)}
            style={[styles.segItem, on && styles.segItemOn]}
          >
            <Text style={[styles.segText, on && styles.segTextOn]} numberOfLines={2}>
              {o.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/**
 * Pilihan tunggal bertumpuk ke bawah, tiap baris boleh punya keterangan.
 *
 * Dipakai untuk skala yang tingkatannya perlu dijelaskan (mis. kelelahan):
 * lima pilihan berjajar seperti `Segmented` tidak menyisakan ruang untuk
 * kalimat patokan, dan patokan itulah yang membuat jawaban pasien konsisten.
 */
export function SegmentedVertical<T extends string | number>({
  options,
  value,
  onChange,
}: {
  options: { v: T; label: string; ket?: string; warna?: string }[];
  value: T | null;
  onChange: (v: T) => void;
}) {
  return (
    <View style={styles.segVList}>
      {options.map((o) => {
        const on = value === o.v;
        return (
          <Pressable
            key={String(o.v)}
            accessibilityRole="radio"
            accessibilityState={{ selected: on }}
            // Warna hanya penguat; maknanya tetap ada di label & keterangan.
            accessibilityLabel={o.ket ? `${o.label}. ${o.ket}` : o.label}
            onPress={() => onChange(o.v)}
            style={[styles.segVItem, on && styles.segVItemOn]}
          >
            <View style={styles.segVHead}>
              {o.warna && <View style={[styles.segVTitik, { backgroundColor: o.warna }]} />}
              <Text style={[styles.segVLabel, on && styles.segVLabelOn]}>{o.label}</Text>
            </View>
            {o.ket && <Text style={[styles.segVKet, on && styles.segVKetOn]}>{o.ket}</Text>}
          </Pressable>
        );
      })}
    </View>
  );
}

/** Pilihan ganda berbentuk chip (mis. daftar gejala). */
export function Chip({
  label,
  on,
  onPress,
  tone = 'ungu',
}: {
  label: string;
  on: boolean;
  onPress: () => void;
  tone?: 'ungu' | 'merah';
}) {
  const onStyle = tone === 'merah' ? styles.chipOnMerah : styles.chipOnUngu;
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked: on }}
      onPress={onPress}
      style={[styles.chip, on && onStyle]}
    >
      <Text style={[styles.chipText, on && styles.chipTextOn]}>{label}</Text>
    </Pressable>
  );
}

export function ChipGroup({ children }: { children: ReactNode }) {
  return <View style={styles.chipGroup}>{children}</View>;
}

export function Loading({ label = 'Memuat…' }: { label?: string }) {
  return (
    <View style={styles.loading}>
      <ActivityIndicator color={Brand.ungu} />
      <Text style={styles.muted}>{label}</Text>
    </View>
  );
}

export function Disclaimer({ children }: { children: ReactNode }) {
  return <Text style={styles.disclaimer}>{children}</Text>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Brand.latar },
  screenContent: { padding: space.lg, paddingBottom: space.xl * 2, gap: space.md },
  card: {
    backgroundColor: Brand.kartu,
    borderRadius: radius.lg,
    padding: space.lg,
    borderWidth: 1,
    borderColor: Brand.garis,
    gap: space.sm,
  },
  sectionLabel: { fontSize: 14, fontWeight: '600', color: '#374151' },
  muted: { fontSize: 12.5, color: Brand.teksLembut, lineHeight: 18 },
  infoBar: {
    flexDirection: 'row',
    gap: space.sm,
    backgroundColor: Brand.unguMuda,
    borderWidth: 1,
    borderColor: Brand.unguGaris,
    borderRadius: radius.lg,
    padding: space.md,
  },
  infoText: { flex: 1, fontSize: 12.5, color: '#5b5566', lineHeight: 18 },
  msg: { borderRadius: radius.md, padding: space.md, borderWidth: 1 },
  msgInfo: { backgroundColor: Brand.unguMuda, borderColor: Brand.unguGaris },
  msgOk: { backgroundColor: Brand.hijauMuda, borderColor: '#bbf7d0' },
  msgErr: { backgroundColor: Brand.merahMuda, borderColor: '#fecaca' },
  msgText: { fontSize: 13, color: Brand.teks, lineHeight: 19 },
  btn: {
    borderRadius: radius.md,
    paddingVertical: 13,
    paddingHorizontal: space.lg,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
  },
  btnPrimary: { backgroundColor: Brand.ungu },
  btnPrimaryText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  btnGhost: { backgroundColor: '#f3f4f6', borderWidth: 1, borderColor: Brand.garis },
  btnGhostText: { color: '#374151', fontSize: 15, fontWeight: '600' },
  btnOff: { opacity: 0.5 },
  btnPressed: { opacity: 0.8 },
  field: { gap: space.xs },
  fieldLabel: { fontSize: 13, fontWeight: '600', color: '#374151' },
  input: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: radius.md,
    paddingHorizontal: space.md,
    paddingVertical: 11,
    fontSize: 15,
    color: Brand.teks,
    backgroundColor: '#fff',
    minHeight: 46,
  },
  seg: { flexDirection: 'row', gap: 6 },
  segItem: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: radius.sm,
    paddingVertical: 10,
    paddingHorizontal: 4,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
    minHeight: 46,
  },
  segItemOn: { backgroundColor: Brand.ungu, borderColor: Brand.ungu },
  segText: { fontSize: 11.5, color: '#374151', textAlign: 'center' },
  segTextOn: { color: '#fff', fontWeight: '700' },
  segVList: { gap: 6 },
  segVItem: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: radius.md,
    paddingVertical: 10,
    paddingHorizontal: space.md,
    backgroundColor: '#fff',
    minHeight: 46,
    justifyContent: 'center',
    gap: 2,
  },
  // Latar dibuat lembut, bukan ungu penuh seperti Segmented: teks keterangan
  // di baris terpilih harus tetap terbaca.
  segVItemOn: { backgroundColor: Brand.unguMuda, borderColor: Brand.ungu },
  segVHead: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  segVTitik: { width: 10, height: 10, borderRadius: 5 },
  segVLabel: { fontSize: 14, fontWeight: '600', color: '#374151' },
  segVLabelOn: { color: Brand.ungu, fontWeight: '700' },
  segVKet: { fontSize: 11.5, color: Brand.teksLembut, lineHeight: 16 },
  segVKetOn: { color: '#5b5566' },
  chipGroup: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 999,
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: '#fff',
  },
  chipOnUngu: { backgroundColor: Brand.ungu, borderColor: Brand.ungu },
  chipOnMerah: { backgroundColor: Brand.merah, borderColor: Brand.merah },
  chipText: { fontSize: 12.5, color: '#374151' },
  chipTextOn: { color: '#fff', fontWeight: '600' },
  loading: { alignItems: 'center', gap: space.sm, paddingVertical: space.xl },
  disclaimer: {
    fontSize: 11.5,
    color: Brand.teksLembut,
    textAlign: 'center',
    lineHeight: 17,
    marginTop: space.sm,
  },
});
