import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Platform, Pressable, Share, StyleSheet, Text, View } from 'react-native';

import {
  Card,
  Disclaimer,
  Field,
  GhostButton,
  InfoBar,
  Loading,
  Msg,
  PrimaryButton,
  Screen,
  SectionLabel,
  Segmented,
} from '@/components/ui/kit';
import { Brand, space } from '@/constants/brand';
import { DISCLAIMER } from '@/constants/consent';
import { tanggalPendek, todayISO } from '@/lib/dates';
import {
  buatRingkasan,
  idPendek,
  inisialNama,
  mundurHari,
  ringkasanTeks,
  type GejalaRingkas,
  type Ringkasan,
} from '@/lib/ringkasan';
import { useSession } from '@/lib/session';
import { supabase } from '@/lib/supabase';
import type {
  DailyCheckin,
  FlareCheck,
  LabResult,
  MarsAssessment,
  MedLog,
  Medication,
} from '@/types/database';

const PERIODE = [
  { v: 30, label: '30 hari' },
  { v: 90, label: '90 hari' },
];

/** Pertanyaan pasien disimpan di perangkat saja — belum ada tabelnya di Supabase. */
const kunciPertanyaan = (patientId: string) => `pertanyaan-kunjungan:${patientId}`;

const ARAH_LABEL = { naik: 'naik', turun: 'turun', stabil: 'stabil' } as const;

/** Data mentah dari Supabase, dipisah dari perakitan agar menambah pertanyaan
 *  tidak perlu mengambil ulang seluruh data. */
interface DataMentah {
  dari: string;
  sampai: string;
  checkins: DailyCheckin[];
  meds: Medication[];
  medLogs: MedLog[];
  mars: MarsAssessment[];
  flares: FlareCheck[];
  labs: LabResult[];
}

function BarisGejala({ judul, list }: { judul: string; list: GejalaRingkas[] }) {
  return (
    <View style={styles.grup}>
      <Text style={styles.grupJudul}>{judul}</Text>
      {list.length === 0 ? (
        <Text style={styles.kosong}>—</Text>
      ) : (
        list.map((g) => (
          <Text key={`${g.system}|${g.item}`} style={styles.item}>
            • {g.item}{' '}
            <Text style={styles.lembut}>
              ({g.sistemLabel}, {g.hari} hari)
            </Text>
          </Text>
        ))
      )}
    </View>
  );
}

export default function RingkasanScreen() {
  const { patientId, profile } = useSession();

  const [hari, setHari] = useState(30);
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<DataMentah | null>(null);
  const [pertanyaan, setPertanyaan] = useState<string[]>([]);
  const [draf, setDraf] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  // Pertanyaan dimuat sekali, lalu ikut masuk setiap kali ringkasan dirakit.
  useEffect(() => {
    if (!patientId) return;
    let hidup = true;
    AsyncStorage.getItem(kunciPertanyaan(patientId))
      .then((raw) => {
        if (!hidup || !raw) return;
        const parsed: unknown = JSON.parse(raw);
        if (Array.isArray(parsed)) setPertanyaan(parsed.filter((p) => typeof p === 'string'));
      })
      .catch(() => {});
    return () => {
      hidup = false;
    };
  }, [patientId]);

  const muat = useCallback(async () => {
    if (!patientId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setErr(null);

    const sampai = todayISO();
    const dari = mundurHari(sampai, hari - 1);

    const [c, me, ml, ma, f, lab] = await Promise.all([
      supabase
        .from('daily_checkins')
        .select('*')
        .eq('patient_id', patientId)
        .gte('tanggal', dari)
        .lte('tanggal', sampai),
      supabase.from('medications').select('*').eq('patient_id', patientId).eq('aktif', true),
      supabase
        .from('med_logs')
        .select('*')
        .eq('patient_id', patientId)
        .gte('tanggal', dari)
        .lte('tanggal', sampai),
      supabase.from('mars_assessments').select('*').eq('patient_id', patientId).limit(20),
      supabase
        .from('flare_checks')
        .select('*')
        .eq('patient_id', patientId)
        .gte('waktu', `${dari}T00:00:00`)
        .lte('waktu', `${sampai}T23:59:59`)
        .order('waktu', { ascending: true }),
      // lab_results belum tentu ada di project Supabase lama — kegagalannya
      // tidak boleh menghapus enam bagian ringkasan yang lain.
      supabase.from('lab_results').select('*').eq('patient_id', patientId).limit(100),
    ]);

    const pesan = [c.error, me.error, ml.error, ma.error, f.error].find(Boolean)?.message;
    setErr(pesan ?? null);

    setData({
      dari,
      sampai,
      checkins: (c.data ?? []) as DailyCheckin[],
      meds: (me.data ?? []) as Medication[],
      medLogs: (ml.data ?? []) as MedLog[],
      mars: (ma.data ?? []) as MarsAssessment[],
      flares: (f.data ?? []) as FlareCheck[],
      labs: (lab.data ?? []) as LabResult[],
    });
    setLoading(false);
  }, [patientId, hari]);

  useFocusEffect(
    useCallback(() => {
      void muat();
    }, [muat])
  );

  const ringkasan = useMemo<Ringkasan | null>(() => {
    if (!data) return null;
    return buatRingkasan({
      ...data,
      pasien: { inisial: inisialNama(profile?.nama), id: idPendek(patientId) },
      pertanyaan,
    });
  }, [data, profile?.nama, patientId, pertanyaan]);

  async function simpanPertanyaan(next: string[]) {
    setPertanyaan(next);
    if (!patientId) return;
    try {
      await AsyncStorage.setItem(kunciPertanyaan(patientId), JSON.stringify(next));
    } catch {
      setErr('Pertanyaan gagal disimpan di perangkat, tetapi tetap masuk ke ringkasan ini.');
    }
  }

  function tambahPertanyaan() {
    const t = draf.trim();
    if (!t) return;
    setDraf('');
    void simpanPertanyaan([...pertanyaan, t]);
  }

  async function bagikan() {
    if (!ringkasan) return;
    setErr(null);
    setInfo(null);
    const teks = ringkasanTeks(ringkasan);

    try {
      if (Platform.OS === 'web') {
        await navigator.clipboard.writeText(teks);
        setInfo('Teks ringkasan sudah disalin ke papan klip.');
        return;
      }
      await Share.share({ message: teks });
    } catch (e) {
      setErr(`Gagal membagikan: ${e instanceof Error ? e.message : 'tidak diketahui'}`);
    }
  }

  if (loading) return <Loading />;
  if (!ringkasan) return <Msg tone="err">Data pasien belum siap. Kembali lalu coba lagi.</Msg>;

  const r = ringkasan;

  return (
    <Screen>
      <InfoBar>
        Rangkuman catatanmu untuk dibawa saat kontrol. Semuanya berasal dari data yang kamu isi
        sendiri — bukan penilaian dokter dan bukan diagnosis.
      </InfoBar>

      {err && <Msg tone="err">{err}</Msg>}
      {info && <Msg tone="ok">{info}</Msg>}

      <Segmented options={PERIODE} value={hari} onChange={setHari} />

      <Card>
        <Text style={styles.kepala}>
          {r.kepala.inisial} · ID {r.kepala.id}
        </Text>
        <Text style={styles.kepalaSub}>
          {tanggalPendek(r.kepala.dari)} s/d {tanggalPendek(r.kepala.sampai)}
        </Text>
        <Text style={styles.kepalaSub}>
          {r.kepala.jumlahCheckin} check-in dari {r.kepala.jumlahHari} hari
        </Text>
      </Card>

      <Card>
        <SectionLabel>1. Skor harian</SectionLabel>
        <Text style={styles.catatanKecil}>
          Bukan PRO tervalidasi — ini rata-rata dari skala check-in harian.
        </Text>
        {r.skor.map((s) => (
          <View key={s.label} style={styles.grup}>
            <Text style={styles.grupJudul}>{s.label}</Text>
            {s.akhir == null ? (
              <Text style={styles.kosong}>Belum ada data.</Text>
            ) : (
              <>
                <Text style={styles.item}>
                  Terkini {s.akhir} · awal periode {s.awal ?? '–'} · tren {ARAH_LABEL[s.arah]}
                </Text>
                <Text style={styles.lembut}>
                  Per minggu: {s.mingguan.map((m) => (m == null ? '–' : m)).join(' → ')}
                </Text>
              </>
            )}
          </View>
        ))}
      </Card>

      <Card>
        <SectionLabel>2. Gejala menonjol</SectionLabel>
        <BarisGejala judul="Baru muncul" list={r.gejala.baru} />
        <BarisGejala judul="Makin sering" list={r.gejala.memburuk} />
        <BarisGejala judul="Menetap" list={r.gejala.menetap} />
        <BarisGejala judul="Berkurang" list={r.gejala.membaik} />
      </Card>

      <Card>
        <SectionLabel>3. Indikator</SectionLabel>
        <Text style={styles.catatanKecil}>
          Pengamatan berangka atas datamu, bukan kesimpulan medis. Bila ada tanda bahaya, gunakan
          Cek Flare.
        </Text>
        {r.indikator.length === 0 ? (
          <Text style={styles.kosong}>Tidak ada pola menonjol dari data yang tercatat.</Text>
        ) : (
          r.indikator.map((i) => (
            <Text key={i} style={styles.item}>
              • {i}
            </Text>
          ))
        )}
      </Card>

      <Card>
        <SectionLabel>4. Kepatuhan & efek samping obat</SectionLabel>
        {r.obat.daftar.length === 0 ? (
          <Text style={styles.kosong}>Belum ada obat terdaftar.</Text>
        ) : (
          <>
            {r.obat.daftar.map((o) => (
              <Text key={o.nama} style={styles.item}>
                • {o.nama}: <Text style={styles.tebal}>{o.terlewat}</Text> hari belum diminum,{' '}
                {o.diminum} hari sudah
              </Text>
            ))}
            <Text style={styles.lembut}>
              Hari tanpa catatan minum obat: {r.obat.hariTanpaCatatan}
            </Text>
          </>
        )}
        <Text style={styles.item}>
          • MARS-5:{' '}
          {r.obat.mars
            ? `${r.obat.mars.total}/25 · ${r.obat.mars.kategori} (${tanggalPendek(r.obat.mars.tanggal)})`
            : 'belum diisi pada periode ini'}
        </Text>
        {r.obat.alasan.map((a) => (
          <Text key={`${a.tanggal}|${a.teks}`} style={styles.item}>
            • {tanggalPendek(a.tanggal)}: {a.teks}
          </Text>
        ))}
        <Text style={styles.catatanKecil}>
          Efek samping belum dikumpulkan secara terstruktur oleh aplikasi.
        </Text>
      </Card>

      <Card>
        <SectionLabel>5. Event red-flag</SectionLabel>
        {r.redflag.length === 0 ? (
          <Text style={styles.kosong}>Tidak ada peringatan pada periode ini.</Text>
        ) : (
          r.redflag.map((e) => (
            <View key={e.waktu} style={styles.event}>
              <View style={styles.eventHead}>
                <Text style={styles.eventTanggal}>{tanggalPendek(e.waktu)}</Text>
                <View
                  style={[
                    styles.badge,
                    { backgroundColor: e.level === 'darurat' ? Brand.merah : Brand.kuning },
                  ]}
                >
                  <Text style={styles.badgeText}>{e.level}</Text>
                </View>
              </View>
              <Text style={styles.lembut}>
                {e.tanda.length > 0 ? e.tanda.join(', ') : 'Tanpa tanda tercentang'}
              </Text>
            </View>
          ))
        )}
      </Card>

      <Card>
        <SectionLabel>6. Pertanyaan untuk dokter</SectionLabel>
        <Text style={styles.catatanKecil}>
          Tersimpan di perangkatmu saja, dan ikut tercetak di ringkasan.
        </Text>
        {pertanyaan.map((p, i) => (
          <View key={`${i}|${p}`} style={styles.tanya}>
            <Text style={styles.tanyaTeks}>• {p}</Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Hapus pertanyaan: ${p}`}
              hitSlop={8}
              onPress={() => void simpanPertanyaan(pertanyaan.filter((_, j) => j !== i))}
            >
              <Text style={styles.hapus}>Hapus</Text>
            </Pressable>
          </View>
        ))}
        <Field
          label="Tambah pertanyaan"
          value={draf}
          onChangeText={setDraf}
          placeholder="mis. Apakah boleh berjemur pagi?"
          onSubmitEditing={tambahPertanyaan}
          returnKeyType="done"
        />
        <GhostButton label="＋ Tambahkan" onPress={tambahPertanyaan} />

        {r.pertanyaan.catatan.length > 0 && (
          <View style={styles.grup}>
            <Text style={styles.grupJudul}>Dari catatan check-in</Text>
            {r.pertanyaan.catatan.map((c) => (
              <Text key={c.tanggal} style={styles.item}>
                • {tanggalPendek(c.tanggal)}: {c.teks}
              </Text>
            ))}
          </View>
        )}
      </Card>

      <Card>
        <SectionLabel>7. Pemantauan</SectionLabel>
        {r.pemantauan.map((p) => (
          <Text key={p} style={styles.item}>
            • {p}
          </Text>
        ))}
      </Card>

      <Msg tone="info">
        Teks yang dibagikan berisi data kesehatanmu. Kirim hanya kepada dokter atau tim yang kamu
        percaya.
      </Msg>
      <PrimaryButton
        label={Platform.OS === 'web' ? 'Salin teks ringkasan' : 'Bagikan ke dokter'}
        onPress={() => void bagikan()}
      />

      <Disclaimer>{DISCLAIMER}</Disclaimer>
    </Screen>
  );
}

const styles = StyleSheet.create({
  kepala: { fontSize: 16, fontWeight: '800', color: Brand.teks },
  kepalaSub: { fontSize: 12.5, color: Brand.teksLembut },
  grup: { gap: 3, marginTop: space.sm },
  grupJudul: { fontSize: 12.5, fontWeight: '700', color: '#4b5563' },
  item: { fontSize: 13, color: Brand.teks, lineHeight: 19 },
  lembut: { fontSize: 12, color: Brand.teksLembut, lineHeight: 18 },
  tebal: { fontWeight: '700' },
  kosong: { fontSize: 12.5, color: Brand.teksLembut },
  catatanKecil: { fontSize: 11.5, color: Brand.teksLembut, lineHeight: 17 },
  event: {
    gap: 3,
    paddingVertical: 7,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  eventHead: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  eventTanggal: { fontSize: 13, fontWeight: '600', color: Brand.teks },
  badge: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 2 },
  badgeText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  tanya: { flexDirection: 'row', alignItems: 'flex-start', gap: space.sm },
  tanyaTeks: { flex: 1, fontSize: 13, color: Brand.teks, lineHeight: 19 },
  hapus: { fontSize: 12, color: Brand.merah, fontWeight: '600' },
});
