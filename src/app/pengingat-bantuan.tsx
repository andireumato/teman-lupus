import { useRouter } from 'expo-router';
import { Linking, Platform, StyleSheet, Text, View } from 'react-native';

import { Card, Disclaimer, GhostButton, Msg, Screen, SectionLabel } from '@/components/ui/kit';
import { Brand, space } from '@/constants/brand';
import { DISCLAIMER } from '@/constants/consent';

/**
 * Kenapa pengingat tidak berbunyi, dan cara memperbaikinya.
 *
 * Ini bukan bug aplikasi. Beberapa pabrikan Android — terutama OPPO/realme
 * (ColorOS), Xiaomi/POCO (MIUI/HyperOS), dan vivo (Funtouch) — membatalkan
 * SELURUH alarm terjadwal ketika aplikasi digeser dari daftar recent, dan
 * menutup aplikasi yang dianggap tidak aktif demi menghemat baterai. Tidak ada
 * kode yang bisa mencegahnya dari dalam aplikasi; yang bisa dilakukan hanya
 * memberi tahu pasien setelan mana yang harus diubah.
 *
 * Langkahnya sengaja ditulis per merek. Petunjuk umum "matikan penghemat
 * baterai" tidak menolong orang yang tidak tahu menu itu ada di mana, dan
 * pasien yang gagal pada langkah pertama biasanya berhenti mencoba.
 */

interface Merek {
  nama: string;
  langkah: string[];
}

const MEREK: Merek[] = [
  {
    nama: 'OPPO, realme, OnePlus (ColorOS)',
    langkah: [
      'Pengaturan → Baterai → Penggunaan daya aplikasi → Teman Lupus → pilih "Izinkan aktivitas latar belakang"',
      'Pengaturan → Aplikasi → Teman Lupus → Penggunaan baterai → matikan "Optimalkan penggunaan baterai"',
      'Buka daftar aplikasi terbaru, tarik kartu Teman Lupus ke bawah, lalu ketuk ikon gembok agar tidak ikut tertutup',
    ],
  },
  {
    nama: 'Xiaomi, POCO, Redmi (MIUI, HyperOS)',
    langkah: [
      'Pengaturan → Aplikasi → Kelola aplikasi → Teman Lupus → Hemat baterai → pilih "Tanpa batasan"',
      'Pada layar yang sama, nyalakan "Mulai otomatis"',
      'Buka daftar aplikasi terbaru, tekan lama kartu Teman Lupus, lalu ketuk gembok',
    ],
  },
  {
    nama: 'vivo, iQOO (Funtouch, OriginOS)',
    langkah: [
      'Pengaturan → Baterai → Konsumsi daya latar belakang tinggi → izinkan Teman Lupus',
      'Pengaturan → Aplikasi → Teman Lupus → izinkan "Mulai otomatis"',
    ],
  },
  {
    nama: 'Samsung (One UI)',
    langkah: [
      'Pengaturan → Baterai → Batas penggunaan latar belakang → Aplikasi tidak pernah tidur → tambahkan Teman Lupus',
      'Pastikan Teman Lupus tidak ada di daftar "Aplikasi tidur" maupun "Aplikasi tidur nyenyak"',
    ],
  },
];

export default function PengingatBantuanScreen() {
  const router = useRouter();

  return (
    <Screen>
      <Msg tone="info">
        Kalau pengingat obat tidak berbunyi, hampir selalu penyebabnya setelan hemat baterai ponsel
        — bukan aplikasinya.
      </Msg>

      <Card>
        <SectionLabel>Apa yang terjadi</SectionLabel>
        <Text style={styles.ket}>
          Sebagian ponsel Android menutup paksa aplikasi yang dianggap tidak aktif, dan saat itu
          seluruh pengingat yang sudah dijadwalkan ikut terhapus. Menggeser aplikasi dari daftar
          aplikasi terbaru juga melakukan hal yang sama pada beberapa merek.
        </Text>
        <Text style={styles.ket}>
          Aplikasi memasang ulang pengingatnya setiap kali kamu membuka layar Obat. Jadi kalau
          setelan di bawah belum diubah, membuka aplikasi sesekali sudah cukup membuat pengingat
          kembali terpasang.
        </Text>
      </Card>

      <Card>
        <SectionLabel>Langkah sesuai merek ponsel</SectionLabel>
        <Text style={styles.ket}>
          Nama menunya bisa sedikit berbeda antarversi. Cari kata kuncinya, bukan kalimat persisnya.
        </Text>
        {MEREK.map((m) => (
          <View key={m.nama} style={styles.merek}>
            <Text style={styles.merekNama}>{m.nama}</Text>
            {m.langkah.map((l, i) => (
              <Text key={l} style={styles.langkah}>
                {i + 1}. {l}
              </Text>
            ))}
          </View>
        ))}
      </Card>

      {Platform.OS !== 'web' && (
        <Card>
          <SectionLabel>Jalan pintas</SectionLabel>
          <Text style={styles.ket}>
            Tombol di bawah membuka halaman setelan aplikasi ini. Dari sana biasanya ada menu
            Baterai dan Notifikasi.
          </Text>
          <GhostButton
            label="Buka setelan aplikasi"
            onPress={() => void Linking.openSettings().catch(() => undefined)}
          />
        </Card>
      )}

      <Card>
        <SectionLabel>Kalau masih tidak berbunyi</SectionLabel>
        <Text style={styles.ket}>
          Pakai tombol &ldquo;Coba bunyikan pengingat&rdquo; di layar Obat. Kalau yang itu berbunyi
          tetapi pengingat harian tidak, berarti masalahnya memang pada setelan hemat baterai, bukan
          pada notifikasinya.
        </Text>
        <Text style={styles.ket}>
          Sampaikan juga ke dokter saat kontrol. Pengingat yang tidak berbunyi memengaruhi catatan
          minum obatmu, dan itu perlu diketahui saat membaca hasilnya.
        </Text>
      </Card>

      <GhostButton label="Kembali" onPress={() => router.back()} />
      <Disclaimer>{DISCLAIMER}</Disclaimer>
    </Screen>
  );
}

const styles = StyleSheet.create({
  ket: { fontSize: 12.5, color: Brand.teksLembut, lineHeight: 19 },
  merek: { gap: 4, paddingVertical: space.xs },
  merekNama: { fontSize: 13, fontWeight: '700', color: Brand.teks },
  langkah: { fontSize: 12.5, color: Brand.teksLembut, lineHeight: 19, paddingLeft: space.xs },
});
