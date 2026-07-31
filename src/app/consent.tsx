import Ionicons from '@expo/vector-icons/Ionicons';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Card, Disclaimer, GhostButton, Msg, PrimaryButton, Screen } from '@/components/ui/kit';
import { Brand, radius, space } from '@/constants/brand';
import { CONSENT, CONSENT_PARAGRAF, CONSENT_VERSION, DISCLAIMER } from '@/constants/consent';
import { useSession } from '@/lib/session';

function Checkbox({
  checked,
  onToggle,
  children,
}: {
  checked: boolean;
  onToggle: () => void;
  children: string;
}) {
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
      onPress={onToggle}
      style={styles.checkRow}
    >
      <View style={[styles.box, checked && styles.boxOn]}>
        {checked && <Text style={styles.check}>✓</Text>}
      </View>
      <Text style={styles.checkLabel}>{children}</Text>
    </Pressable>
  );
}

export default function ConsentScreen() {
  const { agreeConsent, signOut, profile } = useSession();
  const [baca, setBaca] = useState(false);
  const [setuju, setSetuju] = useState(false);
  // Sengaja TIDAK dicentang di awal. Persetujuan penelitian harus tindakan
  // aktif; kotak yang sudah tercentang bukan persetujuan, itu kelalaian yang
  // dibiarkan.
  const [penelitian, setPenelitian] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const bolehLanjut = baca && setuju;
  // Naskah consent berubah sejak pasien terakhir menyetujui.
  const consentDiperbarui = profile?.consent_at != null;

  async function submit() {
    setErr(null);
    setBusy(true);
    try {
      await agreeConsent(penelitian);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Gagal menyimpan persetujuan.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen>
      <View style={styles.header}>
        <Ionicons name="heart-circle" size={40} color={Brand.ungu} />
        <Text style={styles.judul}>{CONSENT.judul}</Text>
      </View>

      {consentDiperbarui && (
        <Msg tone="info">
          Naskah persetujuan telah diperbarui (versi {CONSENT_VERSION}). Mohon baca dan setujui
          kembali sebelum melanjutkan.
        </Msg>
      )}

      <Card>
        {CONSENT_PARAGRAF.map((p) => (
          <Text key={p.judul} style={styles.paragraf}>
            <Text style={styles.paragrafJudul}>{p.judul}. </Text>
            {p.isi}
          </Text>
        ))}

        <View style={styles.pemisah} />

        <Text style={styles.meta}>
          <Text style={styles.paragrafJudul}>Peneliti. </Text>
          {CONSENT.peneliti}
        </Text>
        <Text style={styles.meta}>
          <Text style={styles.paragrafJudul}>Institusi. </Text>
          {CONSENT.institusi}
        </Text>
        <Text style={styles.meta}>
          <Text style={styles.paragrafJudul}>Etik. </Text>
          {CONSENT.etik}
        </Text>
        <Text style={styles.meta}>
          <Text style={styles.paragrafJudul}>Kontak. </Text>
          {CONSENT.kontak}
        </Text>
        <Text style={styles.versi}>Versi naskah: {CONSENT_VERSION}</Text>
      </Card>

      <Card>
        <Text style={styles.bagian}>Wajib</Text>
        <Checkbox checked={baca} onToggle={() => setBaca((v) => !v)}>
          Saya telah membaca dan memahami penjelasan di atas.
        </Checkbox>
        <Checkbox checked={setuju} onToggle={() => setSetuju((v) => !v)}>
          Saya setuju memakai aplikasi ini, dan data saya disimpan untuk mendukung perawatan saya
          bersama dokter.
        </Checkbox>

        <View style={styles.pemisah} />

        <Text style={styles.bagian}>Pilihan — boleh tidak dicentang</Text>
        <Checkbox checked={penelitian} onToggle={() => setPenelitian((v) => !v)}>
          Saya bersedia data saya ikut dianalisis untuk penelitian, tanpa nama dan tanpa tanggal
          lahir.
        </Checkbox>
        <Text style={styles.ketPenelitian}>
          Bagian ini sepenuhnya pilihan Anda. Menolaknya{' '}
          <Text style={styles.tegas}>tidak mengurangi apa pun</Text> — seluruh fitur aplikasi tetap
          bisa dipakai, dan pelayanan medis Anda tidak terpengaruh. Anda juga boleh mengubah jawaban
          ini kapan saja lewat layar Profil.
        </Text>

        {err && <Msg tone="err">{err}</Msg>}

        <PrimaryButton
          label="Setuju & lanjutkan"
          onPress={submit}
          disabled={!bolehLanjut}
          loading={busy}
        />
        <GhostButton label="Tidak setuju / keluar" onPress={() => void signOut()} />
      </Card>

      <Disclaimer>{DISCLAIMER}</Disclaimer>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { alignItems: 'center', gap: space.xs },
  judul: { fontSize: 15, color: Brand.teksLembut, textAlign: 'center' },
  paragraf: { fontSize: 13, color: Brand.teks, lineHeight: 20 },
  paragrafJudul: { fontWeight: '700' },
  pemisah: { height: 1, backgroundColor: Brand.garis, marginVertical: space.xs },
  meta: { fontSize: 12.5, color: '#374151', lineHeight: 18 },
  versi: { fontSize: 11.5, color: Brand.teksLembut, marginTop: space.xs },
  bagian: {
    fontSize: 11,
    fontWeight: '800',
    color: Brand.teksLembut,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  ketPenelitian: { fontSize: 11.5, color: Brand.teksLembut, lineHeight: 17, paddingLeft: 30 },
  tegas: { fontWeight: '700', color: Brand.teks },
  checkRow: { flexDirection: 'row', gap: space.sm, alignItems: 'flex-start', paddingVertical: 6 },
  box: {
    width: 22,
    height: 22,
    borderRadius: radius.sm - 2,
    borderWidth: 1.5,
    borderColor: '#d1d5db',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  boxOn: { backgroundColor: Brand.ungu, borderColor: Brand.ungu },
  check: { color: '#fff', fontSize: 14, fontWeight: '900', lineHeight: 18 },
  checkLabel: { flex: 1, fontSize: 13, color: '#374151', lineHeight: 19 },
});
