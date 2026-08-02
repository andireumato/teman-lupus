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
import { PengingatCard } from '@/components/pengingat-card';
import { DISCLAIMER } from '@/constants/consent';
import { tanggalPendek, todayISO } from '@/lib/dates';
import { tutupPengingatDosis } from '@/lib/notifikasi';
import { bacaJam, sesuaikanJam } from '@/lib/pengingat';
import {
  drafKeKolom,
  drafPolaBawaan,
  periksaDrafPola,
  PilihPola,
  type DrafPola,
} from '@/components/pilih-pola';
import { jatuhPada, labelPola, tanggalMinumBerikutnya } from '@/lib/pola-minum';
import { useSession } from '@/lib/session';
import { supabase } from '@/lib/supabase';
import type { MedLog, Medication, MedicationEvent } from '@/types/database';

/**
 * Pilihan frekuensi; nilainya = jumlah dosis pada setiap HARI MINUM.
 *
 * Labelnya ikut pola: "1x sehari" pada obat mingguan adalah keterangan yang
 * salah — metotreksat 1x seminggu bukan 1x sehari, dan pasien yang membaca
 * "sehari" bisa meminumnya tiap hari.
 */
function pilihanFrekuensi(pola: string) {
  const satuan = pola === 'harian' ? 'sehari' : 'tiap hari minum';
  return [1, 2, 3, 4].map((v) => ({ v, label: `${v}x ${satuan}` }));
}

/**
 * Kunci catatan satu dosis pada satu hari.
 * `slot` dihitung dari 0 — lihat catatan di `MedLog.slot`.
 */
const kunciDosis = (medicationId: string, slot: number) => `${medicationId}|${slot}`;

/** Date → 'YYYY-MM-DD' setempat, untuk diberikan ke `tanggalPendek`. */
function isoDari(d: Date): string {
  const bulan = String(d.getMonth() + 1).padStart(2, '0');
  const hari = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${bulan}-${hari}`;
}

/** Tabel/kolom baru belum tentu ada di project Supabase lama. */
function pesanSkemaObat(pesan: string): string {
  if (/\bjam\b/.test(pesan)) {
    return 'Kolom jam minum belum ada di database. Jalankan supabase/pengingat_obat.sql lebih dulu.';
  }
  if (/\bpola\b|hari_minggu|selang_hari|mulai_tanggal/.test(pesan)) {
    return 'Kolom pola minum belum ada di database. Jalankan supabase/obat_pola_minum.sql di SQL Editor.';
  }
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
  const [jamId, setJamId] = useState<string | null>(null);
  const [jamDraf, setJamDraf] = useState<string[]>([]);
  /** Pola pada formulir tambah obat. */
  const [polaBaru, setPolaBaru] = useState<DrafPola>(drafPolaBawaan());
  /** Jam pada formulir tambah obat, sudah terisi bawaan sejak awal. */
  const [jamBaru, setJamBaru] = useState<string[]>(sesuaikanJam(null, 1));
  /** Pola pada panel jadwal kartu obat yang sedang dibuka. */
  const [polaDraf, setPolaDraf] = useState<DrafPola>(drafPolaBawaan());
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
      return;
    }

    // INILAH yang membuat angka di ikon aplikasi benar.
    //
    // Android tidak menyediakan cara menandai ikon tanpa notifikasi aktif, jadi
    // penandanya adalah pengingat yang masih menunggu di baki. Selama satu
    // pengingat belum dijawab ia tetap di sana dan tetap dihitung peluncur;
    // begitu dosisnya dijawab, pengingatnya harus ikut hilang. Tanpa baris ini
    // angka di ikon akan berselisih dengan kotak centang yang baru saja diisi.
    void tutupPengingatDosis(med.id, slot);
  }

  async function simpanObat() {
    if (!patientId) return;
    if (!nama.trim()) {
      setErr('Nama obat wajib diisi.');
      return;
    }
    const salahPola = periksaDrafPola(polaBaru);
    if (salahPola) {
      setErr(salahPola);
      return;
    }
    const jamSalah = jamBaru.filter((j) => j.trim() !== '' && !bacaJam(j));
    if (jamSalah.length > 0) {
      setErr(`Jam "${jamSalah[0].trim()}" tidak terbaca. Pakai format 24 jam seperti 07:30.`);
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
        ...drafKeKolom(polaBaru),
        // Formulirnya sudah terisi jam yang lazim sejak dibuka, jadi pasien
        // yang belum tahu jamnya tetap bisa menyimpan tanpa terhalang — obat
        // yang tidak tercatat sama sekali lebih buruk daripada obat dengan jam
        // yang masih perlu disesuaikan. Yang dikosongkan disimpan sebagai
        // string kosong agar posisinya tetap sejajar dengan nomor dosisnya.
        jam: jamBaru.map((j) => (bacaJam(j) ? j.trim() : '')),
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
    setPolaBaru(drafPolaBawaan());
    setJamBaru(sesuaikanJam(null, 1));
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

  /**
   * Ringkasan jam untuk label tombol, mis. "08:00, 20:00" atau "belum diatur".
   * Jam yang tidak terbaca tidak ikut ditampilkan — ia juga tidak akan
   * dijadwalkan, jadi menampilkannya akan menjanjikan pengingat yang tak ada.
   */
  function ringkasJam(med: Medication, n: number): string {
    const isi = Array.from({ length: n }, (_, i) => med.jam?.[i]).filter((j) => bacaJam(j) != null);
    return isi.length === 0 ? 'belum diatur' : isi.join(', ');
  }

  /** Kolom pola sebuah obat → draf yang bisa disunting. */
  function drafDariObat(med: Medication): DrafPola {
    const pola = med.pola === 'mingguan' || med.pola === 'selang' ? med.pola : 'harian';
    return {
      pola,
      hariMinggu: med.hari_minggu ?? [],
      selangHari: String(med.selang_hari ?? 2),
      // Obat lama tidak punya jangkar. Memakai hari ini berarti pasien yang
      // baru mengubahnya jadi selang-sehari mulai dihitung dari hari ini,
      // bukan dari tanggal yang tidak pernah ia tentukan.
      mulaiTanggal: med.mulai_tanggal ?? hariIni,
    };
  }

  async function simpanJam(med: Medication) {
    setErr(null);
    // Yang kosong disimpan sebagai string kosong, bukan dibuang: posisi tiap
    // jam harus tetap sejajar dengan nomor dosisnya. Jam kosong berarti dosis
    // itu tidak diingatkan, dan itu pilihan yang sah.
    const bersih = jamDraf.map((j) => (bacaJam(j) ? j.trim() : ''));
    const salah = jamDraf.filter((j) => j.trim() !== '' && !bacaJam(j));
    if (salah.length > 0) {
      setErr(`Jam "${salah[0].trim()}" tidak terbaca. Pakai format 24 jam seperti 07:30.`);
      return;
    }

    const salahPola = periksaDrafPola(polaDraf);
    if (salahPola) {
      setErr(salahPola);
      return;
    }

    const { error } = await supabase
      .from('medications')
      .update({ jam: bersih, ...drafKeKolom(polaDraf) })
      .eq('id', med.id);

    if (error) {
      setErr(pesanSkemaObat(`Gagal menyimpan jam: ${error.message}`));
      return;
    }
    setJamId(null);
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

  const sekarang = new Date();
  // Obat mingguan dan selang-hari TIDAK dihitung pada hari yang bukan hari
  // minumnya. Tanpa penyaringan ini, penyebutnya ikut menghitung metotreksat
  // setiap hari, dan pasien membaca "0 dari 3" pada hari ia sudah minum semua
  // obat yang memang harus diminum.
  const medsHariIni = meds.filter((m) => jatuhPada(m, sekarang));

  const totalDosis = medsHariIni.reduce((n, m) => n + (m.frekuensi ?? 1), 0);
  // Hanya obat yang sedang diminum: obat yang dihentikan hari ini bisa punya
  // catatan hari ini juga, dan akan membuat hitungannya melebihi totalnya.
  const sudah = medsHariIni.reduce(
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
            : totalDosis === 0
              ? 'Tidak ada obat yang dijadwalkan hari ini.'
              : `${sudah} dari ${totalDosis} dosis sudah ditandai diminum.`}
        </Text>
      </Card>

      <PengingatCard meds={meds} />

      {meds.map((m) => {
        const n = m.frekuensi ?? 1;
        const hariMinum = jatuhPada(m, sekarang);
        const berikutnya = hariMinum ? null : tanggalMinumBerikutnya(m, sekarang);
        return (
          <Card key={m.id}>
            <View style={styles.medHead}>
              <View style={styles.medInfo}>
                <Text style={styles.medNama}>{m.nama_obat}</Text>
                <Text style={styles.medMeta}>
                  {[m.dosis, labelPola(m), m.jadwal].filter(Boolean).join(' · ')}
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

            <Pressable
              accessibilityRole="button"
              onPress={() => {
                setJamId(jamId === m.id ? null : m.id);
                setJamDraf(sesuaikanJam(m.jam, n));
                setPolaDraf(drafDariObat(m));
              }}
              hitSlop={8}
            >
              <Text style={styles.aturJam}>
                {jamId === m.id ? 'Tutup pengaturan jadwal' : `Jadwal: ${ringkasJam(m, n)}`}
              </Text>
            </Pressable>

            {jamId === m.id && (
              <View style={styles.formHenti}>
                <PilihPola nilai={polaDraf} onChange={setPolaDraf} />
                {jamDraf.map((j, i) => (
                  <Field
                    key={i}
                    label={n > 1 ? `Jam dosis ke-${i + 1}` : 'Jam minum'}
                    value={j}
                    onChangeText={(t) =>
                      setJamDraf((prev) => prev.map((x, k) => (k === i ? t : x)))
                    }
                    placeholder="08:00"
                    autoCapitalize="none"
                    keyboardType="numbers-and-punctuation"
                  />
                ))}
                <Text style={styles.hint}>
                  Format 24 jam, mis. 07:30 atau 19:00. Jam yang dikosongkan tidak diingatkan.
                </Text>
                <View style={styles.aksi}>
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => void simpanJam(m)}
                    style={[styles.tombolKecil, styles.tombolSimpanJam]}
                  >
                    <Text style={styles.tombolSimpanJamText}>Simpan jam</Text>
                  </Pressable>
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => setJamId(null)}
                    style={styles.tombolKecil}
                  >
                    <Text style={styles.tombolKecilText}>Batal</Text>
                  </Pressable>
                </View>
              </View>
            )}

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
              Hari yang bukan hari minum TIDAK diberi kotak centang.
              Menampilkannya berarti mengundang pasien mencatat dosis
              metotreksat pada hari Rabu — catatan yang salah, dan pada
              obat seperti metotreksat, dorongan untuk meminumnya di hari
              yang keliru.
            */}
            {!hariMinum && (
              <Text style={styles.bukanHariMinum}>
                Tidak dijadwalkan hari ini
                {berikutnya ? ` · berikutnya ${tanggalPendek(isoDari(berikutnya))}` : ''}
              </Text>
            )}

            {/*
              Satu baris centang per dosis: obat 3x sehari perlu tiga tanda.
              Seluruh barisnya yang bisa diketuk, bukan kotak kecilnya saja —
              sasaran ketuk setinggi 44pt, sesuai baris obat lain.
            */}
            {hariMinum &&
              Array.from({ length: n }, (_, i) => i).map((slot) => {
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
                      {bacaJam(m.jam?.[slot]) ? ` · ${m.jam![slot]}` : ''}
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

          {/*
            Pola minum ditanyakan DI SINI, bukan ditunda ke kartu obat.
            Jam punya nilai bawaan yang aman — salah jam berarti pengingatnya
            meleset beberapa jam. Pola tidak punya padanan itu: menyimpan
            metotreksat sebagai harian berarti mengingatkannya tujuh kali
            seminggu, dan membuat penyebut kepatuhan di ekspor penelitian
            salah tujuh kali lipat.
          */}
          <PilihPola nilai={polaBaru} onChange={setPolaBaru} />

          <Text style={styles.fieldLabel}>
            {polaBaru.pola === 'harian' ? 'Berapa kali sehari' : 'Berapa kali tiap hari minum'}
          </Text>
          <Segmented
            options={pilihanFrekuensi(polaBaru.pola)}
            value={frekuensi}
            onChange={(v) => {
              setFrekuensi(v);
              setJamBaru((prev) => sesuaikanJam(prev, v));
            }}
          />

          {jamBaru.map((j, i) => (
            <Field
              key={i}
              label={frekuensi > 1 ? `Jam dosis ke-${i + 1}` : 'Jam minum'}
              value={j}
              onChangeText={(t) => setJamBaru((prev) => prev.map((x, k) => (k === i ? t : x)))}
              placeholder="08:00"
              autoCapitalize="none"
              keyboardType="numbers-and-punctuation"
            />
          ))}
          <Text style={styles.hint}>
            Sudah diisi jam yang lazim — ubah bila perlu. Jam yang dikosongkan tidak diingatkan.
          </Text>

          <Field
            label="Catatan waktu minum (opsional)"
            value={jadwal}
            onChangeText={setJadwal}
            placeholder="mis. sesudah makan"
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
  aturJam: { fontSize: 12.5, fontWeight: '600', color: Brand.ungu },
  tombolSimpanJam: { backgroundColor: Brand.ungu, borderColor: Brand.ungu },
  tombolSimpanJamText: { fontSize: 12.5, fontWeight: '700', color: '#fff' },
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
  bukanHariMinum: {
    fontSize: 12.5,
    color: Brand.teksLembut,
    fontStyle: 'italic',
    paddingVertical: space.xs,
  },
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
