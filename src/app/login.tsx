import { Image } from 'expo-image';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, Text, View } from 'react-native';

import {
  Card,
  Disclaimer,
  Field,
  Msg,
  PrimaryButton,
  Screen,
  Segmented,
} from '@/components/ui/kit';
import { Brand, space } from '@/constants/brand';
import { DISCLAIMER } from '@/constants/consent';
import { useSession } from '@/lib/session';
import type { Role } from '@/types/database';

type Mode = 'login' | 'signup';

export default function LoginScreen() {
  const { signIn, signUp } = useSession();
  const [mode, setMode] = useState<Mode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [nama, setNama] = useState('');
  const [role, setRole] = useState<Role>('patient');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  const isSignup = mode === 'signup';

  async function submit() {
    setErr(null);
    setOk(null);

    if (!email.trim() || !password) {
      setErr('Email dan kata sandi wajib diisi.');
      return;
    }
    if (isSignup && !nama.trim()) {
      setErr('Nama wajib diisi.');
      return;
    }
    if (isSignup && password.length < 6) {
      setErr('Kata sandi minimal 6 karakter.');
      return;
    }

    setBusy(true);
    try {
      if (isSignup) {
        await signUp(email, password, nama, role);
        setOk(
          'Akun dibuat. Bila Supabase meminta verifikasi email, cek kotak masuk Anda lalu masuk.'
        );
        setMode('login');
      } else {
        await signIn(email, password);
        // Navigasi ditangani AuthGate setelah sesi berubah.
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Terjadi kesalahan. Coba lagi.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Screen style={styles.content}>
        <View style={styles.header}>
          {/*
            Logo memuat nama & tagline-nya sendiri, jadi judul teks di bawahnya
            dibuang — kalau tidak, "Teman Lupus" tertulis dua kali bertumpuk.
          */}
          <Image
            source={require('@/assets/images/logo-teman-lupus.png')}
            style={styles.logo}
            contentFit="contain"
            accessibilityLabel="Teman Lupus — pantau, pahami, perjalananmu, bersama"
          />
        </View>

        <Card>
          {/* Segmented, bukan dua tombol identik: pasien harus bisa melihat
              mode mana yang sedang aktif. */}
          <Segmented
            options={[
              { v: 'login' as Mode, label: 'Masuk' },
              { v: 'signup' as Mode, label: 'Daftar baru' },
            ]}
            value={mode}
            onChange={setMode}
          />
          <Text style={styles.modeHint}>
            {isSignup ? 'Membuat akun baru' : 'Masuk ke akun yang sudah ada'}
          </Text>

          {isSignup && (
            <>
              <Field
                label="Nama"
                value={nama}
                onChangeText={setNama}
                placeholder="Nama lengkap"
                autoCapitalize="words"
                textContentType="name"
              />
              <Text style={styles.fieldLabel}>Saya adalah</Text>
              <Segmented
                options={[
                  { v: 'patient' as Role, label: 'Pasien' },
                  { v: 'doctor' as Role, label: 'Dokter' },
                ]}
                value={role}
                onChange={setRole}
              />
            </>
          )}

          <Field
            label="Email"
            value={email}
            onChangeText={setEmail}
            placeholder="nama@email.com"
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            textContentType="emailAddress"
          />
          <Field
            label="Kata sandi"
            value={password}
            onChangeText={setPassword}
            placeholder={isSignup ? 'Minimal 6 karakter' : '••••••••'}
            secureTextEntry
            textContentType="password"
          />

          {err && <Msg tone="err">{err}</Msg>}
          {ok && <Msg tone="ok">{ok}</Msg>}

          <PrimaryButton label={isSignup ? 'Buat akun' : 'Masuk'} onPress={submit} loading={busy} />
        </Card>

        <Disclaimer>{DISCLAIMER}</Disclaimer>
      </Screen>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { justifyContent: 'center', flexGrow: 1 },
  logo: { width: 190, height: 190 },
  header: { alignItems: 'center', gap: space.xs, marginBottom: space.sm },
  modeHint: { fontSize: 12.5, color: Brand.teksLembut, textAlign: 'center' },
  fieldLabel: { fontSize: 13, fontWeight: '600', color: '#374151' },
});
