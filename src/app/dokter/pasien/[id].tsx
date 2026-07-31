import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Platform, Share, StyleSheet, Text, View } from 'react-native';

import { RingkasanIsi } from '@/components/ringkasan-isi';
import { TargetRingkas } from '@/components/target-baris';
import {
  Card,
  Disclaimer,
  GhostButton,
  InfoBar,
  Loading,
  Msg,
  PrimaryButton,
  Field,
  Screen,
  SectionLabel,
  Segmented,
} from '@/components/ui/kit';
import { Brand, space } from '@/constants/brand';
import { DISCLAIMER } from '@/constants/consent';
import { labelJenisKelamin, labelOrgan } from '@/constants/klinis';
import { selisihHari, tanggalPendek, todayISO } from '@/lib/dates';
import { lamaSakit, usiaTahun } from '@/lib/klinis';
import { buatRingkasan, idPendek, inisialNama, ringkasanTeks } from '@/lib/ringkasan';
import { nilaiDoris, nilaiLldas } from '@/lib/target';
import {
  ambilDataRingkasan,
  ambilPeringatan,
  type DataPeringatan,
  type DataRingkasan,
} from '@/lib/ringkasan-data';
import { useSession } from '@/lib/session';
import { supabase } from '@/lib/supabase';
import type { Patient, Profile, SledaiAssessment, Visit, VisitQuestion } from '@/types/database';

const PERIODE = [
  { v: 30, label: '30 hari' },
  { v: 90, label: '90 hari' },
];

/** Sama dengan `.limit()` pada query riwayat SLEDAI — dipakai untuk tahu
 *  apakah penilaian yang lebih lama memang tidak ada, atau hanya belum diambil. */
const BATAS_SLEDAI = 10;

export default function DetailPasienScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { session } = useSession();

  const [hari, setHari] = useState(30);
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<DataRingkasan | null>(null);
  const [peringatan, setPeringatan] = useState<DataPeringatan>({ alerts: [], tindakLanjut: [] });
  const [pasien, setPasien] = useState<{ nama: string | null; pat: Patient } | null>(null);
  const [pertanyaan, setPertanyaan] = useState<VisitQuestion[]>([]);
  const [sledai, setSledai] = useState<SledaiAssessment[]>([]);
  const [kunjungan, setKunjungan] = useState<Visit[]>([]);
  const [catatKunjungan, setCatatKunjungan] = useState(false);
  const [catatan, setCatatan] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const muat = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setErr(null);

    const { data: pat, error: ep } = await supabase
      .from('patients')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (ep || !pat) {
      // RLS yang menolak akan tampak sama seperti pasien yang tidak ada;
      // keduanya sama-sama berarti "bukan pasien Anda".
      setErr('Pasien ini tidak ditemukan, atau tidak tertaut dengan akun Anda.');
      setLoading(false);
      return;
    }

    const p = pat as Patient;
    const [prof, tanya, sl, kj, ringkas, alert] = await Promise.all([
      supabase.from('profiles').select('nama').eq('id', p.profile_id).maybeSingle(),
      supabase
        .from('visit_questions')
        .select('*')
        .eq('patient_id', p.id)
        .order('created_at', { ascending: true }),
      supabase
        .from('sledai_assessments')
        .select('*')
        .eq('patient_id', p.id)
        .order('tanggal', { ascending: false })
        // Konstanta yang sama dipakai saat memutuskan apakah penilaian lebih
        // lama memang tidak ada atau hanya belum diambil. Dua angka terpisah
        // akan meleset diam-diam kalau salah satunya diubah.
        .limit(BATAS_SLEDAI),
      supabase
        .from('visits')
        .select('*')
        .eq('patient_id', p.id)
        .order('tanggal', { ascending: false })
        .limit(10),
      ambilDataRingkasan(p.id, hari),
      // Bagian 5 ringkasan: apa yang terjadi sesudah tiap peringatan red-flag.
      // Hanya dokter yang bisa membacanya, jadi diambil di sini, bukan di
      // pengambil bersama.
      ambilPeringatan(p.id),
    ]);

    setPasien({ nama: (prof.data as Pick<Profile, 'nama'> | null)?.nama ?? null, pat: p });
    setPertanyaan((tanya.data ?? []) as VisitQuestion[]);
    setSledai((sl.data ?? []) as SledaiAssessment[]);
    setKunjungan((kj.data ?? []) as Visit[]);
    setData(ringkas);
    setPeringatan(alert);
    setErr(ringkas.error);
    setLoading(false);
  }, [id, hari]);

  useFocusEffect(
    useCallback(() => {
      void muat();
    }, [muat])
  );

  /**
   * Baris identitas: jenis kelamin & usia.
   *
   * Terpisah dari baris klinis di bawahnya karena keduanya konteks untuk
   * membaca SELURUH halaman, bukan salah satu bagiannya — susunan yang sama
   * dipakai di kepala ringkasan. Datanya sudah ikut terambil (`select('*')`),
   * jadi tidak ada query tambahan.
   */
  const diri = useMemo(() => {
    const p = pasien?.pat;
    if (!p) return null;
    const usia = usiaTahun(p.tgl_lahir, todayISO());
    return (
      [labelJenisKelamin(p.jenis_kelamin), usia != null ? `${usia} tahun` : null]
        .filter(Boolean)
        .join(', ') || null
    );
  }, [pasien]);

  const klinisBaris = useMemo(() => {
    const p = pasien?.pat;
    if (!p) return [];
    const lama = lamaSakit(p.tgl_diagnosis, todayISO());
    return [
      p.tgl_diagnosis
        ? `Diagnosis ${tanggalPendek(p.tgl_diagnosis)}${lama ? ` · ${lama}` : ''}`
        : null,
      p.klasifikasi,
      p.organ_terlibat?.length
        ? `Organ terlibat: ${p.organ_terlibat.map(labelOrgan).join(', ')}`
        : null,
    ].filter((x): x is string => Boolean(x));
  }, [pasien]);

  const ringkasan = useMemo(() => {
    if (!data || !pasien) return null;
    return buatRingkasan({
      ...data,
      ...peringatan,
      pasien: { inisial: inisialNama(pasien.nama), id: idPendek(pasien.pat.id) },
      pertanyaan: pertanyaan.map((p) => p.teks),
    });
  }, [data, peringatan, pasien, pertanyaan]);

  async function simpanKunjungan() {
    if (!id) return;
    setBusy(true);
    setErr(null);
    const { error } = await supabase.from('visits').insert({
      patient_id: id,
      doctor_id: session?.user.id ?? null,
      tanggal: todayISO(),
      catatan: catatan.trim() || null,
    });
    setBusy(false);
    if (error) {
      setErr(`Gagal menyimpan kunjungan: ${error.message}`);
      return;
    }
    setCatatan('');
    setCatatKunjungan(false);
    await muat();
  }

  async function bagikan() {
    if (!ringkasan) return;
    setErr(null);
    setInfo(null);
    const teks = ringkasanTeks(ringkasan);
    try {
      if (Platform.OS === 'web') {
        await navigator.clipboard.writeText(teks);
        setInfo('Teks ringkasan sudah disalin.');
        return;
      }
      await Share.share({ message: teks });
    } catch (e) {
      setErr(`Gagal membagikan: ${e instanceof Error ? e.message : 'tidak diketahui'}`);
    }
  }

  if (loading) return <Loading />;
  if (!ringkasan) {
    return (
      <Screen>
        <Msg tone="err">{err ?? 'Data pasien tidak bisa dimuat.'}</Msg>
      </Screen>
    );
  }

  return (
    <Screen>
      <InfoBar>
        Ringkasan ini dirakit dari catatan pasien sendiri — bukan penilaian klinis. Isinya sama
        persis dengan yang dilihat pasien di aplikasinya.
      </InfoBar>

      {err && <Msg tone="err">{err}</Msg>}
      {info && <Msg tone="ok">{info}</Msg>}

      <Card>
        <Text style={styles.nama}>{pasien?.nama ?? 'Tanpa nama'}</Text>
        {/* Diisi PASIEN di `/profil`, bukan dokter — karena itu ia tidak ikut
            tombol "Ubah data klinis dasar" di bawah. Kalau kosong, barisnya
            tidak muncul: dokter tidak bisa mengisinya, jadi memberitahu bahwa
            ia kosong hanya menambah baris tanpa memberi jalan keluar. */}
        {diri && <Text style={styles.diri}>{diri}</Text>}
        {/* Yang kosong tidak diberi barisnya sendiri: tiga baris "belum
            diisi" berturut-turut hanya mengulang apa yang sudah jelas dari
            tidak adanya isi. Satu kalimat cukup bila semuanya kosong. */}
        {klinisBaris.length === 0 ? (
          <Text style={styles.meta}>Belum ada data klinis dasar.</Text>
        ) : (
          klinisBaris.map((b) => (
            <Text key={b} style={styles.meta}>
              {b}
            </Text>
          ))
        )}
        <GhostButton
          label={klinisBaris.length === 0 ? 'Isi data klinis dasar' : 'Ubah data klinis dasar'}
          onPress={() => router.push(`/dokter/klinis/${id}`)}
        />
      </Card>

      <Segmented options={PERIODE} value={hari} onChange={setHari} />

      <Card>
        <SectionLabel>Kunjungan</SectionLabel>
        {kunjungan.length === 0 ? (
          <Text style={styles.kosong}>Belum ada kunjungan tercatat.</Text>
        ) : (
          <Text style={styles.kosong}>
            Kunjungan terakhir {selisihHari(kunjungan[0].tanggal, todayISO())} hari lalu.
          </Text>
        )}
        {kunjungan.length > 0 &&
          kunjungan.map((k) => (
            <View key={k.id} style={styles.baris}>
              <Text style={styles.barisTanggal}>{tanggalPendek(k.tanggal)}</Text>
              <Text style={styles.barisNilai} numberOfLines={2}>
                {k.catatan ?? '—'}
              </Text>
            </View>
          ))}
        {catatKunjungan ? (
          <>
            <Field
              label="Catatan kunjungan (opsional)"
              value={catatan}
              onChangeText={setCatatan}
              placeholder="mis. tapering metilprednisolon, kontrol 4 minggu"
              multiline
              numberOfLines={3}
              style={styles.catatan}
            />
            <PrimaryButton
              label="Simpan kunjungan hari ini"
              onPress={() => void simpanKunjungan()}
              loading={busy}
            />
            <GhostButton label="Batal" onPress={() => setCatatKunjungan(false)} />
          </>
        ) : (
          <GhostButton
            label="＋ Catat kunjungan hari ini"
            onPress={() => setCatatKunjungan(true)}
          />
        )}
      </Card>

      <Card>
        <SectionLabel>SLEDAI-2K</SectionLabel>
        {sledai.length === 0 ? (
          <Text style={styles.kosong}>Belum pernah dinilai.</Text>
        ) : (
          sledai.map((s) => (
            <View key={s.id} style={styles.baris}>
              <Text style={styles.barisTanggal}>{tanggalPendek(s.tanggal)}</Text>
              <Text style={styles.barisNilai}>
                {s.total ?? '—'} · {s.kategori ?? '—'}
              </Text>
            </View>
          ))
        )}
        <PrimaryButton
          label="Isi SLEDAI-2K hari ini"
          onPress={() => router.push(`/dokter/sledai/${id}`)}
        />
      </Card>

      <Card>
        <SectionLabel>Target terapi</SectionLabel>
        <Text style={styles.kosong}>
          DORIS 2021 (remisi) dan LLDAS (aktivitas rendah), dihitung dari penilaian SLEDAI-2K di
          atas ditambah PGA, dosis steroid, dan kestabilan terapi.
        </Text>
        {sledai.length === 0 ? (
          <Text style={styles.kosong}>Belum ada penilaian untuk dinilai.</Text>
        ) : (
          sledai.map((s, i) => {
            // Daftar urut baru → lama, jadi pembandingnya elemen BERIKUTNYA.
            // Kalau daftar ini penuh (dibatasi BATAS_SLEDAI), penilaian yang
            // lebih lama mungkin ada tetapi belum diambil — itu `undefined`,
            // bukan `null`. Bedanya nyata: `null` berarti "memang penilaian
            // pertama" dan syarat LLDAS dianggap terpenuhi.
            const lebihLama =
              i + 1 < sledai.length
                ? (sledai[i + 1].deskriptor ?? {})
                : sledai.length < BATAS_SLEDAI
                  ? null
                  : undefined;
            const masuk = {
              deskriptor: s.deskriptor ?? {},
              pga: s.pga,
              gcMg: s.gc_mg,
              terapiStabil: s.terapi_stabil,
              sebelumnya: lebihLama,
            };
            return (
              <View key={s.id} style={styles.targetGrup}>
                <Text style={styles.barisTanggal}>{tanggalPendek(s.tanggal)}</Text>
                <TargetRingkas nama="DORIS 2021" hasil={nilaiDoris(masuk)} />
                <TargetRingkas nama="LLDAS" hasil={nilaiLldas(masuk)} />
              </View>
            );
          })
        )}
        <PrimaryButton
          label="Isi target terapi hari ini"
          onPress={() => router.push(`/dokter/target/${id}`)}
        />
      </Card>

      <RingkasanIsi
        r={ringkasan}
        catatanBagian3="Hitungan hari dari catatan pasien, bukan kesimpulan medis."
      />

      <Msg tone="info">
        Teks yang dibagikan berisi data kesehatan pasien. Perlakukan seperti isi rekam medis.
      </Msg>
      <GhostButton
        label={Platform.OS === 'web' ? 'Salin teks ringkasan' : 'Bagikan teks ringkasan'}
        onPress={() => void bagikan()}
      />

      <Disclaimer>{DISCLAIMER}</Disclaimer>
    </Screen>
  );
}

const styles = StyleSheet.create({
  nama: { fontSize: 18, fontWeight: '800', color: Brand.teks },
  meta: { fontSize: 12.5, color: Brand.teksLembut },
  diri: { fontSize: 13, fontWeight: '600', color: Brand.teks },
  kosong: { fontSize: 12.5, color: Brand.teksLembut },
  baris: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 7,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
    gap: space.sm,
  },
  barisTanggal: { fontSize: 12.5, color: Brand.teksLembut },
  targetGrup: { gap: 1, paddingTop: 6, borderTopWidth: 1, borderTopColor: '#f3f4f6' },
  barisNilai: { flex: 1, fontSize: 13, fontWeight: '600', color: Brand.teks, textAlign: 'right' },
  catatan: { minHeight: 70, textAlignVertical: 'top', paddingTop: 10 },
});
