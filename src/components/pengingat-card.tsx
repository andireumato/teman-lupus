import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Platform, StyleSheet, Switch, Text, View } from 'react-native';

import { Card, GhostButton, Msg, SectionLabel } from '@/components/ui/kit';
import { Brand, space } from '@/constants/brand';
import {
  buangPengingatHariLalu,
  cekIzin,
  matikanPengingat,
  mintaIzin,
  pasangPengingat,
  terpasangDiSistem,
  ujiBunyi,
  type IzinNotifikasi,
} from '@/lib/notifikasi';
import {
  diagnosaPengingat,
  pengingatBerikutnya,
  rencanaPengingat,
  tulisJam,
  type DiagnosaPengingat,
} from '@/lib/pengingat';
import type { Medication } from '@/types/database';

/**
 * Saklar pengingat obat.
 *
 * Saklarnya disimpan di ponsel (AsyncStorage), bukan di Supabase: izin
 * notifikasi memang milik perangkat, dan pasien yang punya dua ponsel wajar
 * saja hanya mau diingatkan di salah satunya. Yang tersimpan di database
 * adalah JAM-nya — itu data yang tidak boleh hilang saat aplikasi dipasang
 * ulang. Lihat supabase/pengingat_obat.sql.
 *
 * AsyncStorage adalah satu-satunya sumber kebenaran saklarnya, dan `sinkron()`
 * selalu membacanya ulang. Menyimpan keadaan yang sama di dua tempat adalah
 * cara termudah membuat saklar di layar berbeda dari pengingat yang sebenarnya
 * terpasang.
 */

const KUNCI = 'temanlupus.pengingat.aktif';

export function PengingatCard({ meds }: { meds: Medication[] }) {
  const router = useRouter();
  // Notifikasi lokal tidak berjalan di browser; menampilkan saklar yang tidak
  // melakukan apa-apa lebih buruk daripada mengatakannya terus terang.
  const didukung = Platform.OS !== 'web';

  const [aktif, setAktif] = useState(false);
  const [izin, setIzin] = useState<IzinNotifikasi>('undetermined');
  const [jumlah, setJumlah] = useState(0);
  /**
   * Hasil membandingkan rencana dengan isi jadwal sistem yang sebenarnya.
   *
   * Sebelum ini kartu menampilkan panjang rencana dan menyebutnya "pengingat
   * aktif" — padahal itu jumlah yang kita NIATKAN pasang. Pada ponsel yang
   * membuang alarm saat aplikasi ditutup, keduanya berbeda persis pada saat
   * pasien paling perlu diberi tahu.
   */
  const [diagnosa, setDiagnosa] = useState<DiagnosaPengingat | null>(null);
  /** Pesan setelah tombol coba-bunyikan ditekan. */
  const [uji, setUji] = useState<string | null>(null);
  const [siap, setSiap] = useState(!didukung);
  const [err, setErr] = useState<string | null>(null);

  const rencana = useMemo(() => rencanaPengingat(meds), [meds]);

  /**
   * Sidik jari rencana. Effect di bawah bergantung pada string ini, bukan pada
   * `meds`, supaya pemasangan ulang hanya terjadi ketika jadwalnya benar-benar
   * berubah — bukan setiap kali layar dirender ulang, misalnya saat pasien
   * mencentang satu dosis.
   */
  const tanda = useMemo(
    () => rencana.map((p) => `${p.kunci}@${p.hour}:${p.minute}`).join('|'),
    [rencana]
  );

  const sinkron = useCallback(async () => {
    if (!didukung) return;
    // Angka di ikon aplikasi TIDAK disetel dari kode — Android tidak
    // menyediakan caranya tanpa notifikasi aktif. Angkanya adalah jumlah
    // pengingat yang masih menunggu di baki, jadi yang perlu diurus hanyalah
    // membuang pengingat yang sudah tidak berlaku. Jangan tambahkan
    // `setBadgeCountAsync` di sini: nilai 0 memanggil `cancelAll()` di native
    // dan justru menyapu pengingat yang menjadi penanda itu sendiri.
    void buangPengingatHariLalu();
    const [simpan, status] = await Promise.all([AsyncStorage.getItem(KUNCI), cekIzin()]);
    setAktif(simpan === '1');
    setIzin(status);

    try {
      if (simpan === '1' && status === 'granted') {
        await pasangPengingat(rencana);
        setJumlah(rencana.length);
        // Dibaca SESUDAH pemasangan ulang, jadi selisih apa pun berarti sistem
        // menolak atau membuang alarmnya — bukan sekadar belum sempat dipasang.
        setDiagnosa(diagnosaPengingat(rencana.length, await terpasangDiSistem()));
      } else {
        await matikanPengingat();
        setJumlah(0);
        setDiagnosa(null);
      }
      setErr(null);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Pengingat gagal dipasang.');
    }
    setSiap(true);
    // `rencana` sengaja tidak jadi dependensi: `tanda` mewakilinya, dan
    // memakai lariknya langsung akan memasang ulang tiap render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [didukung, tanda]);

  /**
   * Dipasang ulang setiap kali layar Obat dibuka DAN setiap kali jadwalnya
   * berubah — termasuk saat obat dihentikan, dilanjutkan, dihapus, atau jamnya
   * diubah. Tanpa ini, pengingat obat yang baru dihentikan dokter akan terus
   * berbunyi. Membuka layar juga menangkap izin yang diubah pasien lewat
   * Pengaturan ponsel selagi aplikasi tertutup.
   */
  useFocusEffect(
    useCallback(() => {
      void sinkron();
    }, [sinkron])
  );

  async function geser(nyala: boolean) {
    setErr(null);
    if (!nyala) {
      await AsyncStorage.setItem(KUNCI, '0');
      await sinkron();
      return;
    }
    // Izin diminta di sini, bukan saat aplikasi dibuka: dialog yang muncul
    // sebelum orang tahu untuk apa hampir selalu ditolak, dan di Android
    // penolakan itu sulit dibatalkan.
    const status = izin === 'granted' ? izin : await mintaIzin();
    await AsyncStorage.setItem(KUNCI, status === 'granted' ? '1' : '0');
    await sinkron();
  }

  if (!siap) return null;

  if (!didukung) {
    return (
      <Card>
        <SectionLabel>Pengingat obat</SectionLabel>
        <Text style={styles.hint}>
          Pengingat hanya berjalan di aplikasi ponsel, tidak di browser.
        </Text>
      </Card>
    );
  }

  const nyala = aktif && izin === 'granted';
  const berikutnya = pengingatBerikutnya(rencana, new Date());
  const tanpaJam = meds.filter((m) => m.aktif && !rencana.some((p) => p.medicationId === m.id));

  return (
    <Card>
      <View style={styles.baris}>
        <View style={styles.kiri}>
          <SectionLabel>Pengingat obat</SectionLabel>
          <Text style={styles.hint}>
            {!nyala
              ? 'Dapatkan pengingat pada jam yang kamu atur sendiri.'
              : jumlah === 0
                ? 'Belum ada obat aktif yang punya jam minum.'
                : `${jumlah} pengingat aktif${
                    berikutnya
                      ? ` · berikutnya ${tulisJam(berikutnya)} ${berikutnya.judul.replace(
                          'Waktunya ',
                          ''
                        )}`
                      : ''
                  }`}
          </Text>
        </View>
        <Switch
          value={nyala}
          onValueChange={(v) => void geser(v)}
          trackColor={{ true: Brand.ungu, false: '#d1d5db' }}
          accessibilityLabel="Nyalakan pengingat obat"
        />
      </View>

      {err && <Msg tone="err">{err}</Msg>}

      {izin === 'denied' && (
        <>
          <Msg tone="info">
            Izin notifikasi ditolak. Nyalakan lewat Pengaturan ponsel → Notifikasi → Teman Lupus,
            lalu kembali ke sini.
          </Msg>
          <GhostButton label="Coba minta izin lagi" onPress={() => void geser(true)} />
        </>
      )}

      {nyala && tanpaJam.length > 0 && (
        <Text style={styles.hint}>
          Belum berjam: {tanpaJam.map((m) => m.nama_obat).join(', ')}. Ketuk &ldquo;Jam minum&rdquo;
          di kartu obatnya untuk mengatur.
        </Text>
      )}

      {/* Hanya bicara saat ada yang salah. Baris pemeriksa yang selalu tampil
          pernah ada di sini dan dibuang karena jadi bising ketika semuanya
          memang bekerja — lihat catatan 30 Juli 2026. */}
      {nyala && diagnosa?.pesan && (
        <>
          <Msg tone="err">{diagnosa.pesan}</Msg>
          <GhostButton
            label="Kenapa pengingat tidak berbunyi?"
            onPress={() => router.push('/pengingat-bantuan')}
          />
        </>
      )}

      {nyala && jumlah > 0 && (
        <Text style={styles.catatan}>
          Pengingat tetap berbunyi meski dosisnya sudah kamu centang lebih dulu — abaikan saja kalau
          begitu. Obat yang dihentikan tidak pernah mengingatkan.
        </Text>
      )}

      {uji && <Msg tone="ok">{uji}</Msg>}
      {/* Tautan bantuan selalu tersedia, bukan hanya saat terdeteksi rusak:
          pengingat bisa gagal berbunyi tanpa jadwalnya hilang, misalnya ketika
          ponsel menunda alarm demi menghemat baterai. */}
      {nyala && !diagnosa?.pesan && (
        <GhostButton
          label="Pengingat tidak berbunyi?"
          onPress={() => router.push('/pengingat-bantuan')}
        />
      )}

      <GhostButton
        label="Coba bunyikan pengingat"
        onPress={() => {
          setUji(null);
          void ujiBunyi(10)
            .then(() => setUji('Tunggu 10 detik — jangan tutup aplikasinya.'))
            .catch((e) => setErr(e instanceof Error ? e.message : 'Uji gagal.'));
        }}
      />
    </Card>
  );
}

const styles = StyleSheet.create({
  baris: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  kiri: { flex: 1, gap: 3 },
  hint: { fontSize: 12, color: Brand.teksLembut, lineHeight: 17 },
  catatan: { fontSize: 11.5, color: Brand.teksLembut, lineHeight: 16 },
});
