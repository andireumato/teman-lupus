import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import {
  Card,
  Chip,
  ChipGroup,
  Disclaimer,
  GhostButton,
  InfoBar,
  Msg,
  PrimaryButton,
  Screen,
  SectionLabel,
} from '@/components/ui/kit';
import { Brand, space } from '@/constants/brand';
import { DISCLAIMER } from '@/constants/consent';
import { todayISO } from '@/lib/dates';
import {
  EMPTY_INPUT,
  evaluateRedFlags,
  PERTANYAAN_MENDESAK,
  PERTANYAAN_TANDA_BAHAYA,
  type RedFlagInput,
  type RedFlagVerdict,
} from '@/lib/redflag';
import { useSession } from '@/lib/session';
import { supabase } from '@/lib/supabase';
import type { DailyCheckin } from '@/types/database';

const WARNA = {
  darurat: Brand.merah,
  mendesak: Brand.kuning,
  aman: Brand.hijau,
} as const;

const LATAR = {
  darurat: Brand.merahMuda,
  mendesak: Brand.kuningMuda,
  aman: Brand.hijauMuda,
} as const;

const JUDUL = {
  darurat: 'Segera ke IGD',
  mendesak: 'Hubungi dokter dalam 24 jam',
  aman: 'Tidak ada tanda bahaya',
} as const;

/**
 * Deteksi perburukan beruntun dari riwayat check-in.
 * Definisi: skor beban (lelah + nyeri sendi) naik pada 3 hari terakhir
 * berturut-turut. Ini dihitung dari data, bukan ditanyakan ke pasien,
 * agar tidak bergantung pada ingatan.
 */
function memburukBeruntun(rows: DailyCheckin[]): boolean {
  const urut = [...rows]
    .filter((r) => r.lelah != null && r.nyeri_sendi != null)
    .sort((a, b) => a.tanggal.localeCompare(b.tanggal))
    .slice(-3);
  if (urut.length < 3) return false;
  const beban = urut.map((r) => (r.lelah ?? 0) + (r.nyeri_sendi ?? 0));
  return beban[1] > beban[0] && beban[2] > beban[1];
}

export default function FlareScreen() {
  const { patientId } = useSession();
  const [input, setInput] = useState<RedFlagInput>(EMPTY_INPUT);
  const [hasil, setHasil] = useState<RedFlagVerdict | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [autoMemburuk, setAutoMemburuk] = useState(false);

  const muatKonteks = useCallback(async () => {
    if (!patientId) return;

    const [{ data: checkins }, { data: meds }] = await Promise.all([
      supabase
        .from('daily_checkins')
        .select('*')
        .eq('patient_id', patientId)
        .lte('tanggal', todayISO())
        .order('tanggal', { ascending: false })
        .limit(7),
      supabase
        .from('medications')
        .select('nama_obat')
        .eq('patient_id', patientId)
        .eq('aktif', true),
    ]);

    const beruntun = memburukBeruntun((checkins ?? []) as DailyCheckin[]);
    setAutoMemburuk(beruntun);

    // Konteks imunosupresan diturunkan dari daftar obat aktif pasien.
    const namaObat = (meds ?? []).map((m) => (m.nama_obat ?? '').toLowerCase()).join(' ');
    const imunosupresan = IMUNOSUPRESAN.some((o) => namaObat.includes(o));

    setInput((prev) => ({
      ...prev,
      memburuk_beruntun: beruntun,
      imunosupresan_aktif: imunosupresan,
    }));
  }, [patientId]);

  useFocusEffect(
    useCallback(() => {
      void muatKonteks();
    }, [muatKonteks])
  );

  function toggle(k: keyof RedFlagInput) {
    setInput((prev) => ({ ...prev, [k]: !prev[k] }));
    setHasil(null);
  }

  async function evaluasi() {
    setErr(null);
    // Evaluasi deterministik terjadi di klien; hasilnya tidak menunggu jaringan
    // supaya pesan darurat tidak pernah tertunda oleh koneksi lambat.
    const verdict = evaluateRedFlags(input);
    setHasil(verdict);

    if (!patientId) return;
    setBusy(true);
    const { error } = await supabase.from('flare_checks').insert({
      patient_id: patientId,
      tanda_bahaya: Object.fromEntries(
        PERTANYAAN_TANDA_BAHAYA.map((q) => [q.key, input[q.key]])
      ) as Record<string, boolean>,
      gejala: Object.fromEntries(PERTANYAAN_MENDESAK.map((q) => [q.key, input[q.key]])) as Record<
        string,
        boolean
      >,
      hasil: verdict.hasil,
    });
    setBusy(false);
    if (error) setErr(`Hasil di atas tetap berlaku, tetapi gagal disimpan: ${error.message}`);
  }

  function ulangi() {
    setHasil(null);
    setInput({ ...EMPTY_INPUT, memburuk_beruntun: autoMemburuk });
    void muatKonteks();
  }

  return (
    <Screen>
      <InfoBar>
        <Text style={styles.tebal}>Flare</Text> = kekambuhan lupus. Cek cepat ini membantumu
        mengenali tanda bahaya yang perlu segera ditangani. Bukan diagnosis.
      </InfoBar>

      {hasil ? (
        <>
          <Card style={{ backgroundColor: LATAR[hasil.level], borderColor: WARNA[hasil.level] }}>
            <Text style={[styles.hasilJudul, { color: WARNA[hasil.level] }]}>
              {JUDUL[hasil.level]}
            </Text>
            <Text style={styles.hasilPesan}>{hasil.pesan}</Text>

            {hasil.rules.length > 0 && (
              <View style={styles.alasanBox}>
                <Text style={styles.alasanJudul}>Yang terdeteksi:</Text>
                {hasil.rules.map((r) => (
                  <Text key={r.id} style={styles.alasanItem}>
                    • {r.alasan}
                    {r.level === 'darurat' ? ' (darurat)' : ' (mendesak)'}
                  </Text>
                ))}
              </View>
            )}
          </Card>

          {err && <Msg tone="err">{err}</Msg>}
          <GhostButton label="Cek ulang" onPress={ulangi} />
        </>
      ) : (
        <>
          <Card>
            <SectionLabel>Tanda bahaya</SectionLabel>
            <Text style={styles.hint}>Ketuk semua yang kamu rasakan saat ini.</Text>
            <ChipGroup>
              {PERTANYAAN_TANDA_BAHAYA.map((q) => (
                <Chip
                  key={q.key}
                  label={q.label}
                  on={input[q.key] as boolean}
                  onPress={() => toggle(q.key)}
                  tone="merah"
                />
              ))}
            </ChipGroup>
          </Card>

          <Card>
            <SectionLabel>Keluhan lain</SectionLabel>
            <ChipGroup>
              {PERTANYAAN_MENDESAK.map((q) => (
                <Chip
                  key={q.key}
                  label={q.label}
                  on={input[q.key] as boolean}
                  onPress={() => toggle(q.key)}
                />
              ))}
            </ChipGroup>
          </Card>

          {(autoMemburuk || input.imunosupresan_aktif) && (
            <Msg tone="info">
              Diperhitungkan otomatis dari datamu:
              {autoMemburuk ? ' gejala memburuk beberapa hari terakhir.' : ''}
              {input.imunosupresan_aktif
                ? ' kamu sedang memakai obat penekan kekebalan tubuh.'
                : ''}
            </Msg>
          )}

          <PrimaryButton label="Cek sekarang" onPress={evaluasi} loading={busy} />
        </>
      )}

      <Disclaimer>{DISCLAIMER}</Disclaimer>
    </Screen>
  );
}

/**
 * Kata kunci obat penekan kekebalan tubuh / steroid.
 * ⚠️ Daftar ini menentukan apakah demam tinggi dieskalasi ke DARURAT,
 * jadi wajib direview reumatolog. "Dosis signifikan" belum dibedakan —
 * saat ini semua steroid dianggap signifikan (fail-safe).
 */
const IMUNOSUPRESAN = [
  'metilprednisolon',
  'methylprednisolone',
  'prednison',
  'prednisone',
  'deksametason',
  'dexamethasone',
  'azatioprin',
  'azathioprine',
  'mikofenolat',
  'mycophenolate',
  'siklofosfamid',
  'cyclophosphamide',
  'siklosporin',
  'cyclosporine',
  'takrolimus',
  'tacrolimus',
  'metotreksat',
  'methotrexate',
  'rituximab',
  'belimumab',
  'anifrolumab',
];

const styles = StyleSheet.create({
  tebal: { fontWeight: '700' },
  hint: { fontSize: 12, color: Brand.teksLembut },
  hasilJudul: { fontSize: 18, fontWeight: '800' },
  hasilPesan: { fontSize: 13.5, color: Brand.teks, lineHeight: 20 },
  alasanBox: {
    marginTop: space.sm,
    paddingTop: space.sm,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.08)',
    gap: 3,
  },
  alasanJudul: { fontSize: 12.5, fontWeight: '700', color: '#374151' },
  alasanItem: { fontSize: 12.5, color: '#374151', lineHeight: 18 },
});
