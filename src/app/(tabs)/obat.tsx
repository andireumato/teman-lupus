import Ionicons from '@expo/vector-icons/Ionicons';
import { useCallback, useState } from 'react';
import { Link, useFocusEffect } from 'expo-router';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';

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
import { Brand, radius, space } from '@/constants/brand';
import { DISCLAIMER } from '@/constants/consent';
import { tanggalPendek, todayISO } from '@/lib/dates';
import { useSession } from '@/lib/session';
import { supabase } from '@/lib/supabase';
import type { MedLog, Medication, MedicationEvent } from '@/types/database';

/** Pilihan frekuensi; nilainya = jumlah dosis per hari. */
const FREKUENSI = [
  { v: 1, label: '1x sehari' },
  { v: 2, label: '2x sehari' },
  { v: 3, label: '3x sehari' },
  { v: 4, label: '4x sehari' },
];

/**
 * Kunci catatan satu dosis pada satu hari.
 * `slot` dihitung dari 0 — lihat catatan di `MedLog.slot`.
 */
const kunciDosis = (medicationId: string, slot: number) => `${medicationId}|${slot}`;

/** Tabel/kolom baru belum tentu ada di project Supabase lama. */
function pesanSkemaObat(pesan: string): string {
  return /frekuensi|slot|medication_events/.test(pesan)
    ? 'Skema obat di Supabase belum diperbarui. Jalankan supabase/obat_frekuensi_dan_riwayat.sql di SQL Editor.'
    : pesan;
}

export default function ObatScreen() {
  const { patientId } = useSession();
  const hariIni = todayISO();

  const [loading, setLoading] = useState(true);
  const [meds, setMeds] = useState<Medication[]>([]);
  const [berhenti, setBerhenti] = useState<Medication[]>([]);
  const [logs, setLogs] = useState<Record<string, MedLog>>({});
  const [events, setEvents] = useState<MedicationEvent[]>([]);
  const [tambah, setTambah] = useState(false);
  const [nama, setNama] = useState('');
  const [dosis, setDosis] = useState('');
  const [jadwal, setJadwal] = useState('');
  const [frekuensi, setFrekuensi] = useState(1);
  /** id obat yang sedang ditanyai alasan berhentinya. */
  const [hentikanId, setHentikanId] = useState<string | null>(null);
  const [alasanHenti, setAlasanHenti] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const muat = useCallback(async () => {
    if (!patientId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setErr(null);

    const [{ data: m, error: em }, { data: l, error: el }, { data: ev, error: ee }] =
      await Promise.all([
        supabase
          .from('medications')
          .select('*')
          .eq('patient_id', patientId)
          .order('created_at', { ascending: true }),
        supabase.from('med_logs').select('*').eq('patient_id', patientId).eq('tanggal', hariIni),
        supabase
          .from('medication_events')
          .select('*')
          .eq('patient_id', patientId)
          .order('tanggal', { ascending: false }),
      ]);

    if (em || el || ee) {
      setErr(pesanSkemaObat((em ?? el ?? ee)?.message ?? 'Gagal memuat data obat.'));
      setLoading(false);
      return;
    }

    const semua = (m ?? []) as Medication[];
    setMeds(semua.filter((x) => x.aktif));
    setBerhenti(semua.filter((x) => !x.aktif));
    setEvents((ev ?? []) as MedicationEvent[]);

    const map: Record<string, MedLog> = {};
    for (const row of (l ?? []) as MedLog[]) {
      if (row.medication_id) map[kunciDosis(row.medication_id, row.slot ?? 0)] = row;
    }
    setLogs(map);
    setLoading(false);
  }, [patientId, hariIni]);

  useFocusEffect(
    useCallback(() => {
      void muat();
    }, [muat])
  );

  /** Berapa catatan dosis hari ini yang akan ikut terhapus. */
  function jumlahCatatan(medId: string): number {
    return Object.values(logs).filter((l) => l.medication_id === medId).length;
  }

  /** Tanggal berhenti terakhir sebuah obat, untuk daftar obat lama. */
  function tanggalBerhenti(medId: string): string | null {
    return events.find((e) => e.medication_id === medId && e.jenis === 'stop')?.tanggal ?? null;
  }

  /**
   * Menandai satu dosis.
   *
   * Sengaja TIDAK memanggil `muat()` sesudah berhasil: `muat()` menyalakan
   * `loading`, seluruh layar diganti spinner, lalu dirakit ulang — dan ketukan
   * berikutnya jatuh di spinner itu. Pada obat 3x sehari yang ditandai
   * berturut-turut, tombolnya jadi terasa mati. Keadaan di layar sudah benar
   * dari pembaruan optimistis; jaringan hanya perlu menyusul.
   */
  async function tandai(med: Medication, slot: number, diminum: boolean) {
    if (!patientId) return;
    setErr(null);

    const k = kunciDosis(med.id, slot);
    const sebelumnya = logs;
    setLogs((prev) => ({
      ...prev,
      [k]: {
        ...(prev[k] ?? ({} as MedLog)),
        medication_id: med.id,
        slot,
        diminum,
      } as MedLog,
    }));

    const { error } = await supabase.from('med_logs').upsert(
      {
        patient_id: patientId,
        medication_id: med.id,
        tanggal: hariIni,
        slot,
        diminum,
      },
      // Cocok dengan unique index `med_logs_unik_slot` yang sudah ada.
      { onConflict: 'medication_id,tanggal,slot' }
    );

    if (error) {
      setLogs(sebelumnya);
      setErr(pesanSkemaObat(`Gagal menyimpan: ${error.message}`));
    }
  }

  async function simpanObat() {
    if (!patientId) return;
    if (!nama.trim()) {
      setErr('Nama obat wajib diisi.');
      return;
    }
    setBusy(true);
    const { data, error } = await supabase
      .from('medications')
      .insert({
        patient_id: patientId,
        nama_obat: nama.trim(),
        dosis: dosis.trim() || null,
        jadwal: jadwal.trim() || null,
        frekuensi,
      })
      .select('id')
      .maybeSingle();

    if (error) {
      setBusy(false);
      setErr(pesanSkemaObat(`Gagal menambah obat: ${error.message}`));
      return;
    }

    if (data?.id) {
      await supabase.from('medication_events').insert({
        patient_id: patientId,
        medication_id: data.id,
        jenis: 'mulai',
        tanggal: hariIni,
      });
    }

    setBusy(false);
    setNama('');
    setDosis('');
    setJadwal('');
    setFrekuensi(1);
    setTambah(false);
    await muat();
  }

  /**
   * Menghentikan obat TIDAK menghapus datanya: barisnya hanya ditandai tidak
   * aktif dan pindah ke daftar "pernah diminum", plus satu event bertanggal
   * supaya ringkasan pra-kunjungan bisa menyebutkannya.
   */
  async function hentikan(med: Medication, alasan: string) {
    if (!patientId) return;
    const { error } = await supabase.from('medications').update({ aktif: false }).eq('id', med.id);
    if (error) {
      setErr(pesanSkemaObat(`Gagal menghentikan: ${error.message}`));
      return;
    }
    const { error: ee } = await supabase.from('medication_events').insert({
      patient_id: patientId,
      medication_id: med.id,
      jenis: 'stop',
      tanggal: hariIni,
      catatan: alasan.trim() || null,
    });
    if (ee)
      setErr(pesanSkemaObat(`Obat dihentikan, tetapi tanggalnya gagal dicatat: ${ee.message}`));
    setHentikanId(null);
    setAlasanHenti('');
    await muat();
  }

  /**
   * Menghapus obat BERBEDA dari menghentikannya: seluruh jejaknya ikut hilang,
   * termasuk catatan dosis dan riwayat berhenti/lanjut. Disediakan untuk obat
   * yang salah dimasukkan — bukan untuk obat yang memang pernah diminum, yang
   * seharusnya dihentikan supaya riwayatnya terbawa ke ringkasan.
   *
   * `med_logs` dihapus lebih dulu dan eksplisit: foreign key-nya
   * `on delete set null`, jadi tanpa ini barisnya tertinggal tanpa induk dan
   * hitungan kepatuhan diam-diam berkurang tanpa jejak obatnya.
   */
  async function hapus(med: Medication) {
    if (!patientId) return;

    const { error: el } = await supabase.from('med_logs').delete().eq('medication_id', med.id);
    if (el) {
      setErr(`Gagal menghapus catatan dosisnya: ${el.message}`);
      return;
    }
    // medication_events ikut terhapus lewat cascade.
    const { error } = await supabase.from('medications').delete().eq('id', med.id);
    if (error) {
      setErr(`Gagal menghapus obat: ${error.message}`);
      return;
    }
    await muat();
  }

  function konfirmasiHapus(med: Medication) {
    const n = jumlahCatatan(med.id);
    Alert.alert(
      `Hapus ${med.nama_obat}?`,
      n > 0
        ? `${n} catatan dosis hari ini dan seluruh riwayatnya ikut terhapus dan tidak bisa dikembalikan.\n\nKalau obat ini memang pernah diminum, pilih "Hentikan" saja — riwayatnya tetap terbawa ke ringkasan pra-kunjungan.`
        : 'Obat ini akan dihapus beserta seluruh riwayatnya dan tidak bisa dikembalikan.',
      [
        { text: 'Batal', style: 'cancel' },
        { text: 'Hapus', style: 'destructive', onPress: () => void hapus(med) },
      ]
    );
  }

  async function lanjutkan(med: Medication) {
    if (!patientId) return;
    const { error } = await supabase.from('medications').update({ aktif: true }).eq('id', med.id);
    if (error) {
      setErr(pesanSkemaObat(`Gagal melanjutkan: ${error.message}`));
      return;
    }
    const { error: ee } = await supabase.from('medication_events').insert({
      patient_id: patientId,
      medication_id: med.id,
      jenis: 'lanjut',
      tanggal: hariIni,
    });
    if (ee)
      setErr(pesanSkemaObat(`Obat dilanjutkan, tetapi tanggalnya gagal dicatat: ${ee.message}`));
    await muat();
  }

  if (loading) return <Loading />;

  const totalDosis = meds.reduce((n, m) => n + (m.frekuensi ?? 1), 0);
  // Hanya obat yang sedang diminum: obat yang dihentikan hari ini bisa punya
  // catatan hari ini juga, dan akan membuat hitungannya melebihi totalnya.
  const sudah = meds.reduce(
    (n, m) =>
      n +
      Array.from({ length: m.frekuensi ?? 1 }, (_, i) => i).filter(
        (slot) => logs[kunciDosis(m.id, slot)]?.diminum === true
      ).length,
    0
  );

  return (
    <Screen>
      <InfoBar>
        Daftar obatmu sekaligus catatan kepatuhan — tandai tiap dosis yang sudah kamu minum hari
        ini.
      </InfoBar>

      {err && <Msg tone="err">{err}</Msg>}

      <Card>
        <SectionLabel>Hari ini</SectionLabel>
        <Text style={styles.ringkas}>
          {meds.length === 0
            ? 'Belum ada obat yang sedang diminum.'
            : `${sudah} dari ${totalDosis} dosis sudah ditandai diminum.`}
        </Text>
      </Card>

      {meds.map((m) => {
        const n = m.frekuensi ?? 1;
        return (
          <Card key={m.id}>
            <View style={styles.medHead}>
              <View style={styles.medInfo}>
                <Text style={styles.medNama}>{m.nama_obat}</Text>
                <Text style={styles.medMeta}>
                  {[m.dosis, `${n}x sehari`, m.jadwal].filter(Boolean).join(' · ')}
                </Text>
              </View>
              <View style={styles.aksiKanan}>
                <Pressable
                  onPress={() => {
                    setHentikanId(hentikanId === m.id ? null : m.id);
                    setAlasanHenti('');
                  }}
                  hitSlop={8}
                >
                  <Text style={styles.hentikan}>Hentikan</Text>
                </Pressable>
                <Pressable onPress={() => konfirmasiHapus(m)} hitSlop={8}>
                  <Text style={styles.hapus}>Hapus</Text>
                </Pressable>
              </View>
            </View>

            {hentikanId === m.id && (
              <View style={styles.formHenti}>
                <Field
                  label="Alasan berhenti (opsional)"
                  value={alasanHenti}
                  onChangeText={setAlasanHenti}
                  placeholder="mis. mual, atau dihentikan dokter"
                  onSubmitEditing={() => void hentikan(m, alasanHenti)}
                  returnKeyType="done"
                />
                <Text style={styles.hint}>
                  Alasannya ikut tercatat di ringkasan pra-kunjungan beserta tanggalnya.
                </Text>
                <View style={styles.aksi}>
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => void hentikan(m, alasanHenti)}
                    style={[styles.tombolKecil, styles.tombolHenti]}
                  >
                    <Text style={styles.tombolHentiText}>Hentikan obat ini</Text>
                  </Pressable>
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => setHentikanId(null)}
                    style={styles.tombolKecil}
                  >
                    <Text style={styles.tombolKecilText}>Batal</Text>
                  </Pressable>
                </View>
              </View>
            )}

            {/*
              Satu baris centang per dosis: obat 3x sehari perlu tiga tanda.
              Seluruh barisnya yang bisa diketuk, bukan kotak kecilnya saja —
              sasaran ketuk setinggi 44pt, sesuai baris obat lain.
            */}
            {Array.from({ length: n }, (_, i) => i).map((slot) => {
              const log = logs[kunciDosis(m.id, slot)];
              const sudah = log?.diminum === true;
              return (
                <Pressable
                  key={slot}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: sudah }}
                  accessibilityLabel={
                    n > 1 ? `${m.nama_obat} dosis ke-${slot + 1}` : `${m.nama_obat} sudah diminum`
                  }
                  onPress={() => void tandai(m, slot, !sudah)}
                  style={({ pressed }) => [
                    styles.dosisBaris,
                    sudah && styles.dosisBarisOn,
                    pressed && styles.dosisBarisPressed,
                  ]}
                >
                  <View style={[styles.kotak, sudah && styles.kotakOn]}>
                    {sudah && <Ionicons name="checkmark" size={15} color="#fff" />}
                  </View>
                  <Text style={[styles.dosisLabel, sudah && styles.dosisLabelOn]}>
                    {n > 1 ? `Dosis ke-${slot + 1}` : 'Sudah diminum hari ini'}
                  </Text>
                  {log?.diminum === false && <Text style={styles.belum}>ditandai belum</Text>}
                </Pressable>
              );
            })}
          </Card>
        );
      })}

      {tambah ? (
        <Card>
          <SectionLabel>Tambah obat</SectionLabel>
          <Field
            label="Nama obat"
            value={nama}
            onChangeText={setNama}
            placeholder="mis. Hidroksiklorokuin"
          />
          <Field label="Dosis" value={dosis} onChangeText={setDosis} placeholder="mis. 200 mg" />
          <Text style={styles.fieldLabel}>Berapa kali sehari</Text>
          <Segmented options={FREKUENSI} value={frekuensi} onChange={setFrekuensi} />
          <Field
            label="Waktu minum (opsional)"
            value={jadwal}
            onChangeText={setJadwal}
            placeholder="mis. pagi & malam, sesudah makan"
          />
          <PrimaryButton label="Simpan obat" onPress={simpanObat} loading={busy} />
          <GhostButton label="Batal" onPress={() => setTambah(false)} />
        </Card>
      ) : (
        <GhostButton label="＋ Tambah obat" onPress={() => setTambah(true)} />
      )}

      {berhenti.length > 0 && (
        <Card>
          <SectionLabel>Obat yang pernah diminum</SectionLabel>
          <Text style={styles.hint}>
            Tersimpan beserta tanggal berhentinya. Bisa dilanjutkan lagi kapan saja.
          </Text>
          {berhenti.map((m) => {
            const tgl = tanggalBerhenti(m.id);
            return (
              <View key={m.id} style={styles.lamaBaris}>
                <View style={styles.medInfo}>
                  <Text style={styles.lamaNama}>{m.nama_obat}</Text>
                  <Text style={styles.medMeta}>
                    {[m.dosis, `${m.frekuensi ?? 1}x sehari`].filter(Boolean).join(' · ')}
                    {tgl ? ` · berhenti ${tanggalPendek(tgl)}` : ''}
                  </Text>
                </View>
                <View style={styles.aksiKanan}>
                  <Pressable onPress={() => void lanjutkan(m)} hitSlop={8}>
                    <Text style={styles.lanjut}>Lanjutkan</Text>
                  </Pressable>
                  <Pressable onPress={() => konfirmasiHapus(m)} hitSlop={8}>
                    <Text style={styles.hapus}>Hapus</Text>
                  </Pressable>
                </View>
              </View>
            );
          })}
        </Card>
      )}

      <Link href="/efek-samping" asChild>
        <Pressable style={styles.efekCard}>
          <Text style={styles.efekJudul}>Laporkan efek samping</Text>
          <Text style={styles.efekSub}>
            Keluhan yang kamu duga berasal dari obat. Dicatat terpisah dari gejala lupus.
          </Text>
        </Pressable>
      </Link>

      <Link href="/mars" asChild>
        <Pressable style={styles.marsCard}>
          <Text style={styles.marsJudul}>Kuesioner MARS-5</Text>
          <Text style={styles.marsSub}>
            5 pertanyaan singkat untuk menilai seberapa rutin kamu minum obat.
          </Text>
        </Pressable>
      </Link>

      <Disclaimer>{DISCLAIMER}</Disclaimer>
    </Screen>
  );
}

const styles = StyleSheet.create({
  ringkas: { fontSize: 13, color: Brand.teks },
  hint: { fontSize: 11.5, color: Brand.teksLembut, lineHeight: 16 },
  fieldLabel: { fontSize: 13, fontWeight: '600', color: '#374151' },
  medHead: { flexDirection: 'row', alignItems: 'flex-start', gap: space.sm },
  medInfo: { flex: 1 },
  medNama: { fontSize: 15, fontWeight: '700', color: Brand.teks },
  medMeta: { fontSize: 12.5, color: Brand.teksLembut, marginTop: 2 },
  hentikan: { fontSize: 12, color: Brand.kuning, fontWeight: '600' },
  hapus: { fontSize: 12, color: Brand.merah, fontWeight: '600' },
  aksiKanan: { alignItems: 'flex-end', gap: 6 },
  aksi: { flexDirection: 'row', gap: space.sm },
  formHenti: {
    gap: 6,
    marginTop: space.xs,
    padding: space.md,
    borderRadius: radius.md,
    backgroundColor: Brand.kuningMuda,
    borderWidth: 1,
    borderColor: '#fde68a',
  },
  tombolKecil: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: radius.md,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
    minHeight: 44,
  },
  tombolKecilText: { fontSize: 13, fontWeight: '600', color: '#374151' },
  tombolHenti: { backgroundColor: Brand.kuning, borderColor: Brand.kuning },
  tombolHentiText: { fontSize: 13, fontWeight: '700', color: '#fff' },
  lanjut: { fontSize: 12, color: Brand.ungu, fontWeight: '700' },
  dosisBaris: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    minHeight: 44,
    paddingHorizontal: space.md,
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: radius.md,
    backgroundColor: '#fff',
  },
  dosisBarisOn: { borderColor: Brand.hijau, backgroundColor: Brand.hijauMuda },
  dosisBarisPressed: { opacity: 0.7 },
  kotak: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: '#9ca3af',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
  },
  kotakOn: { backgroundColor: Brand.hijau, borderColor: Brand.hijau },
  dosisLabel: { flex: 1, fontSize: 13.5, fontWeight: '600', color: '#374151' },
  dosisLabelOn: { color: '#166534' },
  belum: { fontSize: 11, color: Brand.teksLembut },
  lamaBaris: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    paddingVertical: 7,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  lamaNama: { fontSize: 14, fontWeight: '600', color: Brand.teks },
  efekCard: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: Brand.garis,
    borderRadius: radius.lg,
    padding: space.lg,
    gap: 4,
  },
  efekJudul: { fontSize: 15, fontWeight: '700', color: Brand.teks },
  efekSub: { fontSize: 12.5, color: Brand.teksLembut, lineHeight: 18 },
  marsCard: {
    backgroundColor: Brand.unguMuda,
    borderWidth: 1,
    borderColor: Brand.unguGaris,
    borderRadius: radius.lg,
    padding: space.lg,
    gap: 4,
  },
  marsJudul: { fontSize: 15, fontWeight: '700', color: Brand.ungu },
  marsSub: { fontSize: 12.5, color: '#5b5566', lineHeight: 18 },
});
