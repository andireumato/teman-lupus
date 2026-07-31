import { Directory, File, Paths } from 'expo-file-system';
import { EncodingType, StorageAccessFramework } from 'expo-file-system/legacy';
import type { ErrorBoundaryProps } from 'expo-router';
import { strToU8, zipSync } from 'fflate';
import { useEffect, useState } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';

import {
  Card,
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
import { keBase64 } from '@/lib/base64';
import { namaBerkasAman } from '@/lib/csv';
import { todayISO } from '@/lib/dates';
import { rakitEkspor, type BerkasCsv } from '@/lib/ekspor';
import { supabase } from '@/lib/supabase';
import type {
  Alert,
  AlertTindakLanjut,
  DailyCheckin,
  LupusQolAssessment,
  FlareCheck,
  LabResult,
  MarsAssessment,
  MedicationEvent,
  MedLog,
  Medication,
  MedSideEffect,
  Patient,
  Profile,
  SledaiAssessment,
  Visit,
} from '@/types/database';

/**
 * Ekspor CSV untuk penelitian.
 *
 * Perakitan tabelnya ada di `lib/ekspor.ts` yang murni dan teruji — termasuk
 * seluruh keputusan privasinya. Berkas ini hanya mengambil data, mengemas, dan
 * mengeluarkannya.
 *
 * Dikemas jadi SATU zip. Share sheet hanya menerima satu berkas, dan dua belas
 * kali berbagi berturut-turut bukan alat yang bisa dipakai.
 */

/** Kolom persetujuan penelitian belum tentu ada di project Supabase lama. */
function pesanConsent(raw: string): string {
  return /consent_penelitian/.test(raw)
    ? 'Kolom persetujuan penelitian belum ada di database. Jalankan supabase/consent_penelitian.sql lebih dulu.'
    : raw;
}

/** Tabel anak yang punya kolom `patient_id`. */
type TabelPasien =
  | 'sledai_assessments'
  | 'daily_checkins'
  | 'medications'
  | 'med_logs'
  | 'med_side_effects'
  | 'medication_events'
  | 'mars_assessments'
  | 'flare_checks'
  | 'lab_results'
  | 'visits'
  | 'alerts'
  | 'lupusqol_assessments';

/**
 * Cara berkas keluar dari aplikasi.
 *
 * - `bagikan` — share sheet lewat expo-sharing. Paling enak: langsung ke
 *   WhatsApp, Drive, atau email.
 * - `simpan` — pilih folder sendiri lewat Storage Access Framework bawaan
 *   Android. Jalan tanpa expo-sharing, karena kode nativenya menumpang
 *   `expo-file-system` yang selalu ikut terpasang bersama `expo`.
 */
type Cara = 'memeriksa' | 'bagikan' | 'simpan' | 'tak-ada';

type ModulSharing = typeof import('expo-sharing');

/**
 * Memuat `expo-sharing` tanpa merobohkan layar bila kode nativenya tidak ada.
 *
 * Modul itu memanggil `requireNativeModule('ExpoSharing')` di baris paling atas
 * berkasnya, artinya ia melempar saat MODULNYA DIEVALUASI — bukan saat
 * fungsinya dipanggil. Dengan `import` biasa, APK yang dibangun sebelum paket
 * ini ditambahkan akan gagal memuat SELURUH layar ini (render error), dan
 * try/catch di dalam komponen tidak akan pernah kebagian jalan karena
 * komponennya belum sempat ada. Karena itu dimuat malas di sini.
 *
 * Bandingkan dengan `expo-file-system/legacy` di atas, yang boleh diimpor biasa
 * karena memakai `requireOptionalNativeModule` dan jatuh ke shim, bukan
 * melempar.
 */
function muatSharing(): ModulSharing | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require('expo-sharing') as ModulSharing;
  } catch {
    return null;
  }
}

async function periksaCara(): Promise<Cara> {
  const berbagi = muatSharing();
  if (berbagi) {
    try {
      if (await berbagi.isAvailableAsync()) return 'bagikan';
    } catch {
      // Modulnya ada tapi tidak berfungsi — masih ada jalan lain di bawah.
    }
  }
  // SAF hanya ada di Android. Di iOS tanpa expo-sharing memang buntu.
  return Platform.OS === 'android' ? 'simpan' : 'tak-ada';
}

export default function EksporScreen() {
  const [cara, setCara] = useState<Cara>('memeriksa');
  const [busy, setBusy] = useState(false);
  const [hasil, setHasil] = useState<BerkasCsv[] | null>(null);
  const [pesan, setPesan] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    void periksaCara().then(setCara);
  }, []);

  async function ekspor() {
    setBusy(true);
    setErr(null);
    setPesan(null);
    setHasil(null);
    try {
      // RLS yang menentukan cakupannya: dokter hanya menerima baris pasien
      // yang `doctor_id`-nya dia. Tidak ada penyaringan tambahan di sini yang
      // bisa meleset dari kebijakan di database.
      const { data: pas, error: ep } = await supabase.from('patients').select('*');
      if (ep) throw new Error(ep.message);

      const pasien = (pas ?? []) as Patient[];
      if (pasien.length === 0) {
        setErr('Belum ada pasien yang tertaut dengan akun Anda.');
        setBusy(false);
        return;
      }
      const ids = pasien.map((p) => p.id);
      // Union sempit, bukan `string`: klien Supabase mengetat nama tabel, dan
      // membiarkannya longgar berarti salah ketik nama tabel baru ketahuan
      // saat ekspor dijalankan pengguna.
      const ambil = (tabel: TabelPasien) => supabase.from(tabel).select('*').in('patient_id', ids);

      const [sl, ci, me, ml, es, ma, fl, lb, vs, al, lq, mev] = await Promise.all([
        ambil('sledai_assessments'),
        ambil('daily_checkins'),
        ambil('medications'),
        ambil('med_logs'),
        ambil('med_side_effects'),
        ambil('mars_assessments'),
        ambil('flare_checks'),
        ambil('lab_results'),
        ambil('visits'),
        ambil('alerts'),
        ambil('lupusqol_assessments'),
        ambil('medication_events'),
      ]);

      // Tindak lanjut menyusul, bukan sejajar: ia dikunci `alert_id`, bukan
      // `patient_id`, jadi id peringatannya harus sudah ada lebih dulu.
      const alerts = (al.data ?? []) as Alert[];
      const tl =
        alerts.length > 0
          ? await supabase
              .from('alert_tindak_lanjut')
              .select('*')
              .in(
                'alert_id',
                alerts.map((a) => a.id)
              )
          : null;

      // Tabel yang belum ada di project Supabase lama TIDAK menggagalkan
      // seluruh ekspor — bagiannya kosong, dan jumlah barisnya yang nol
      // terlihat di ringkasan hasil.
      const galatPenting = [sl.error, ci.error, me.error, ml.error].find(Boolean);
      if (galatPenting) throw new Error(galatPenting.message);

      // Izin penelitian ada di `profiles`, sedangkan data dikunci `patients.id`.
      // Pemetaannya dilakukan di sini, dan pasien yang profilnya gagal dibaca
      // TIDAK diikutkan — ketiadaan jawaban bukan izin.
      const prof = await supabase
        .from('profiles')
        .select('id, consent_penelitian')
        .in(
          'id',
          pasien.map((p) => p.profile_id)
        );
      if (prof.error) throw new Error(pesanConsent(prof.error.message));

      const setuju = new Set(
        ((prof.data ?? []) as Pick<Profile, 'id' | 'consent_penelitian'>[])
          .filter((x) => x.consent_penelitian === true)
          .map((x) => x.id)
      );
      const izinPenelitian = pasien.filter((p) => setuju.has(p.profile_id)).map((p) => p.id);

      if (izinPenelitian.length === 0) {
        setErr(
          'Belum ada pasien Anda yang menyetujui penggunaan datanya untuk penelitian. Ekspor dibatalkan.'
        );
        setBusy(false);
        return;
      }

      const berkas = rakitEkspor({
        pasien,
        izinPenelitian,
        sledai: (sl.data ?? []) as SledaiAssessment[],
        checkins: (ci.data ?? []) as DailyCheckin[],
        meds: (me.data ?? []) as Medication[],
        medLogs: (ml.data ?? []) as MedLog[],
        medEvents: (mev.data ?? []) as MedicationEvent[],
        efekSamping: (es.data ?? []) as MedSideEffect[],
        mars: (ma.data ?? []) as MarsAssessment[],
        flares: (fl.data ?? []) as FlareCheck[],
        labs: (lb.data ?? []) as LabResult[],
        visits: (vs.data ?? []) as Visit[],
        alerts,
        lupusqol: (lq.data ?? []) as LupusQolAssessment[],
        tindakLanjut: (tl?.data ?? []) as AlertTindakLanjut[],
        tanggal: todayISO(),
      });

      setPesan(await keluarkan(berkas, cara));
      setHasil(berkas);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Ekspor gagal.');
    }
    setBusy(false);
  }

  const label = cara === 'simpan' ? 'Buat & simpan berkas ekspor' : 'Buat & bagikan berkas ekspor';

  return (
    <Screen>
      <InfoBar>
        Mengekspor data seluruh pasien yang tertaut dengan akun Anda, sebagai berkas CSV di dalam
        satu zip.
      </InfoBar>

      {cara === 'tak-ada' && (
        <Msg tone="err">Perangkat ini tidak menyediakan cara menyimpan berkas keluar.</Msg>
      )}
      {err && <Msg tone="err">{err}</Msg>}
      {pesan && <Msg tone="ok">{pesan}</Msg>}

      <Card>
        <SectionLabel>Yang ikut, dan yang sengaja tidak</SectionLabel>
        <Text style={styles.ket}>
          Pasien diwakili <Text style={styles.tebal}>kode</Text> — delapan karakter pertama id-nya,
          sama dengan yang tampil di kepala ringkasan pra-kunjungan. Kode itu tetap sama di setiap
          ekspor, jadi data lama dan baru bisa digabung, dan Anda tetap bisa menelusurinya balik
          lewat layar pasien.
        </Text>
        <Text style={styles.ket}>
          <Text style={styles.tebal}>Tidak ikut:</Text> nama, tanggal lahir, tanggal diagnosis, dan
          seluruh teks bebas — catatan check-in, alasan tidak minum obat, pertanyaan pasien. Yang
          menggantikannya: usia dalam tahun, lama sakit dalam bulan, dan penanda ada-tidaknya
          catatan.
        </Text>
        <Text style={styles.ket}>
          Berkas <Text style={styles.tebal}>keterangan.csv</Text> ikut di dalamnya, mencatat tanggal
          ekspor, instrumen, jendela SLEDAI-2K, dan rujukan DORIS/LLDAS yang dipakai — supaya enam
          bulan lagi tidak perlu diingat-ingat.
        </Text>
      </Card>

      <Msg tone="info">
        Berkas ini berisi data kesehatan. Begitu keluar dari aplikasi, ia tidak lagi dalam
        kendalinya. Perlakukan seperti isi rekam medis.
      </Msg>

      <PrimaryButton
        label={busy ? 'Menyiapkan…' : label}
        onPress={() => void ekspor()}
        loading={busy}
        disabled={cara === 'memeriksa' || cara === 'tak-ada'}
      />

      {cara === 'simpan' && (
        <Text style={styles.ket}>
          Android akan meminta Anda memilih folder tujuan —{' '}
          <Text style={styles.tebal}>Download</Text> paling mudah ditemukan lagi saat ponsel
          disambungkan ke komputer.
        </Text>
      )}

      {hasil && (
        <Card>
          <SectionLabel>Isi ekspor</SectionLabel>
          {hasil.map((b) => (
            <View key={b.nama} style={styles.baris}>
              <Text style={styles.namaBerkas}>{b.nama}</Text>
              <Text style={styles.jumlah}>{b.baris} baris</Text>
            </View>
          ))}
          <Text style={styles.ket}>
            Pemisah koma dan desimal titik, sesuai CSV baku — langsung terbaca R, pandas, dan SPSS.
            Di Excel berlokal Indonesia, buka lewat Data → From Text/CSV, jangan diklik dua kali.
          </Text>
        </Card>
      )}

      <Disclaimer>{DISCLAIMER}</Disclaimer>
    </Screen>
  );
}

/**
 * Mengemas jadi zip lalu mengeluarkannya, mengembalikan kalimat tempat ia
 * mendarat.
 */
async function keluarkan(berkas: BerkasCsv[], cara: Cara): Promise<string> {
  const isi: Record<string, Uint8Array> = {};
  // strToU8 dari fflate, bukan TextEncoder: TextEncoder tidak dijamin ada di
  // Hermes, dan isinya mengandung huruf non-ASCII.
  for (const b of berkas) isi[b.nama] = strToU8(b.isi);
  const zip = zipSync(isi);

  const dasar = namaBerkasAman(`teman-lupus-${todayISO()}`);

  if (cara === 'simpan') return await simpanKeFolder(zip, dasar);
  if (cara === 'bagikan') return await bagikan(zip, dasar);
  throw new Error('Tidak ada cara mengeluarkan berkas di perangkat ini.');
}

/**
 * Menyimpan lewat Storage Access Framework — dokter memilih sendiri foldernya.
 *
 * Tidak menulis apa pun sebelum izinnya diberikan: kalau dokter membatalkan
 * pemilihan folder, tidak ada zip berisi data kesehatan yang tertinggal di
 * penyimpanan aplikasi.
 */
async function simpanKeFolder(zip: Uint8Array, dasar: string): Promise<string> {
  const izin = await StorageAccessFramework.requestDirectoryPermissionsAsync();
  if (!izin.granted) throw new Error('Ekspor dibatalkan — folder tujuan belum dipilih.');

  // Namanya TANPA ekstensi; Android yang menambahkan `.zip` dari mimeType.
  const uri = await StorageAccessFramework.createFileAsync(
    izin.directoryUri,
    dasar,
    'application/zip'
  );
  await StorageAccessFramework.writeAsStringAsync(uri, keBase64(zip), {
    encoding: EncodingType.Base64,
  });

  return `Tersimpan sebagai ${dasar}.zip di folder yang Anda pilih.`;
}

/**
 * Membagikan lewat share sheet.
 *
 * Ditulis ke direktori cache, bukan dokumen: berkas ini salinan sekali pakai
 * yang sudah berpindah ke tujuannya, dan menumpuknya di penyimpanan aplikasi
 * berarti menyimpan data kesehatan lebih lama daripada perlu.
 */
async function bagikan(zip: Uint8Array, dasar: string): Promise<string> {
  const berbagi = muatSharing();
  if (!berbagi) throw new Error('Modul berbagi tidak tersedia.');

  const dir = new Directory(Paths.cache, 'ekspor');
  if (dir.exists) dir.delete();
  dir.create();

  const berkas = new File(dir, `${dasar}.zip`);
  berkas.create();
  berkas.write(zip);

  await berbagi.shareAsync(berkas.uri, {
    mimeType: 'application/zip',
    dialogTitle: 'Bagikan ekspor Teman Lupus',
  });
  return `${dasar}.zip dikirim lewat menu berbagi.`;
}

/**
 * Jaring pengaman terakhir.
 *
 * Expo Router memakai ini menggantikan layar merah bila ada yang melempar saat
 * render. Ada di sini karena layar ini menyentuh tiga modul native sekaligus,
 * dan galat yang terbaca jauh lebih berguna daripada tumpukan stack.
 */
export function ErrorBoundary({ error, retry }: ErrorBoundaryProps) {
  return (
    <Screen>
      <Msg tone="err">Layar ekspor gagal dimuat.</Msg>
      <Card>
        <SectionLabel>Pesan aslinya</SectionLabel>
        <Text style={styles.ket}>{error.message}</Text>
      </Card>
      <GhostButton label="Coba lagi" onPress={() => void retry()} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  ket: { fontSize: 12, color: Brand.teksLembut, lineHeight: 18 },
  tebal: { fontWeight: '700', color: Brand.teks },
  baris: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 5,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
    gap: space.sm,
  },
  namaBerkas: { fontSize: 12.5, color: Brand.teks, fontWeight: '600' },
  jumlah: { fontSize: 12.5, color: Brand.teksLembut },
});
