import type { Session } from '@supabase/supabase-js';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';

import { CONSENT_VERSION } from '@/constants/consent';
import { supabase } from '@/lib/supabase';
import type { Profile, Role } from '@/types/database';

interface SessionValue {
  session: Session | null;
  profile: Profile | null;
  /** id baris `patients` milik pengguna ini; null bila belum ada / bukan pasien. */
  patientId: string | null;
  /** true selama status auth & profil belum diketahui. */
  loading: boolean;
  /** true bila pasien sudah menyetujui versi consent yang berlaku sekarang. */
  consentValid: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, nama: string, role: Role) => Promise<void>;
  signOut: () => Promise<void>;
  /**
   * Menyimpan persetujuan PENGGUNAAN (wajib) beserta jawaban PENELITIAN
   * (opsional) sekaligus, dalam satu tulisan.
   *
   * Satu tulisan, bukan dua: kegagalan jaringan di antara keduanya akan
   * meninggalkan pasien yang sudah menyetujui penggunaan tetapi jawaban
   * penelitiannya kosong — dan kosong itu tidak bisa dibedakan dari "belum
   * ditanya", sehingga ia akan ditanyai lagi tanpa sebab.
   */
  agreeConsent: (ikutPenelitian: boolean) => Promise<void>;
  /**
   * Mengubah HANYA jawaban penelitian, dari layar Profil.
   *
   * Tidak menyentuh `consent_at`: mencabut keikutsertaan penelitian tidak
   * boleh berakibat pasien diminta menyetujui ulang pemakaian aplikasinya.
   */
  ubahConsentPenelitian: (ikut: boolean) => Promise<void>;
  reload: () => Promise<void>;
}

const Ctx = createContext<SessionValue | null>(null);

export function useSession(): SessionValue {
  const v = useContext(Ctx);
  if (!v) throw new Error('useSession harus dipakai di dalam <SessionProvider>');
  return v;
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [patientId, setPatientId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  // Menghindari setState setelah unmount saat request Supabase masih berjalan.
  const alive = useRef(true);

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  const loadProfile = useCallback(async (userId: string | undefined) => {
    if (!userId) {
      if (alive.current) {
        setProfile(null);
        setPatientId(null);
      }
      return;
    }

    const { data: prof } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle();

    if (!alive.current) return;
    setProfile((prof as Profile) ?? null);

    if ((prof as Profile | null)?.role !== 'patient') {
      setPatientId(null);
      return;
    }

    // Baris `patients` dibuat saat pertama kali dibutuhkan — trigger auth
    // hanya membuat `profiles`.
    const { data: pat } = await supabase
      .from('patients')
      .select('id')
      .eq('profile_id', userId)
      .maybeSingle();

    if (!alive.current) return;

    if (pat?.id) {
      setPatientId(pat.id);
      return;
    }

    const { data: created } = await supabase
      .from('patients')
      .insert({ profile_id: userId })
      .select('id')
      .maybeSingle();

    if (alive.current) setPatientId(created?.id ?? null);
  }, []);

  useEffect(() => {
    let cancelled = false;

    supabase.auth.getSession().then(async ({ data }) => {
      if (cancelled) return;
      setSession(data.session);
      await loadProfile(data.session?.user.id);
      if (!cancelled && alive.current) setLoading(false);
    });

    const { data: sub } = supabase.auth.onAuthStateChange(async (_event, next) => {
      if (cancelled) return;
      setSession(next);
      setLoading(true);
      await loadProfile(next?.user.id);
      if (!cancelled && alive.current) setLoading(false);
    });

    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, [loadProfile]);

  const signIn = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    if (error) throw error;
  }, []);

  const signUp = useCallback(async (email: string, password: string, nama: string, role: Role) => {
    const { error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      // Dibaca trigger handle_new_user() untuk mengisi profiles.
      options: { data: { nama: nama.trim(), role } },
    });
    if (error) throw error;
  }, []);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
  }, []);

  const agreeConsent = useCallback(
    async (ikutPenelitian: boolean) => {
      const userId = session?.user.id;
      if (!userId) throw new Error('Sesi login tidak ditemukan.');
      const sekarang = new Date().toISOString();
      const { error } = await supabase
        .from('profiles')
        .update({
          consent_at: sekarang,
          consent_version: CONSENT_VERSION,
          consent_penelitian: ikutPenelitian,
          consent_penelitian_at: sekarang,
        })
        .eq('id', userId);
      if (error) throw error;
      await loadProfile(userId);
    },
    [session?.user.id, loadProfile]
  );

  const ubahConsentPenelitian = useCallback(
    async (ikut: boolean) => {
      const userId = session?.user.id;
      if (!userId) throw new Error('Sesi login tidak ditemukan.');
      const { error } = await supabase
        .from('profiles')
        .update({ consent_penelitian: ikut, consent_penelitian_at: new Date().toISOString() })
        .eq('id', userId);
      if (error) throw error;
      await loadProfile(userId);
    },
    [session?.user.id, loadProfile]
  );

  const reload = useCallback(async () => {
    await loadProfile(session?.user.id);
  }, [session?.user.id, loadProfile]);

  // Consent lama tidak berlaku lagi ketika naskahnya diperbarui.
  //
  // Jawaban penelitian yang masih NULL juga membuat consent belum lengkap:
  // artinya pasien belum pernah melewati layar persetujuan versi ini, jadi ia
  // belum pernah ditanya. `false` sudah cukup — menolak adalah jawaban.
  const consentValid =
    profile?.consent_at != null &&
    profile.consent_version === CONSENT_VERSION &&
    profile.consent_penelitian != null;

  const value = useMemo<SessionValue>(
    () => ({
      session,
      profile,
      patientId,
      loading,
      consentValid,
      signIn,
      signUp,
      signOut,
      agreeConsent,
      ubahConsentPenelitian,
      reload,
    }),
    [
      session,
      profile,
      patientId,
      loading,
      consentValid,
      signIn,
      signUp,
      signOut,
      agreeConsent,
      ubahConsentPenelitian,
      reload,
    ]
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
