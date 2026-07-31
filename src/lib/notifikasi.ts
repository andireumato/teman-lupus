/**
 * PENGINGAT OBAT — bagian yang menyentuh sistem.
 *
 * Semua pengambilan keputusan ada di `pengingat.ts` yang murni dan teruji;
 * berkas ini hanya menjalankannya. Jangan menambahkan aturan baru di sini.
 *
 * NOTIFIKASI LOKAL, BUKAN PUSH. Tidak ada server yang tahu obat apa yang
 * diminum pasien dan kapan — jadwalnya hidup di ponsel itu sendiri. Selain
 * lebih terjaga, pengingatnya juga tetap berbunyi tanpa sinyal.
 *
 * TIDAK TERGANTUNG DOSIS YANG SUDAH DICENTANG. Pemicu harian berulang tidak
 * bisa dibatalkan hanya untuk satu hari, jadi pengingat tetap berbunyi meski
 * dosisnya sudah dicentang pagi tadi. Pilihannya disengaja: cara lain adalah
 * menjadwalkan beberapa hari ke depan satu per satu, dan itu berarti
 * pengingatnya HABIS bila pasien tidak membuka aplikasi beberapa hari —
 * tepat pada keadaan pengingat paling dibutuhkan.
 */

import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import type { Pengingat } from '@/lib/pengingat';

/**
 * Versi channel, BUKAN sekadar nama.
 *
 * Android mengunci `importance` dan `sound` sebuah channel sejak ia dibuat:
 * `setNotificationChannelAsync` pada channel yang sudah ada TIDAK mengubah
 * keduanya, dan kegagalannya sunyi. Versi pertama ('obat') terbentuk tanpa
 * `sound` sehingga senyap, dan satu-satunya cara memperbaikinya adalah
 * membuat channel baru lalu membuang yang lama. Kalau kelak perlu mengubah
 * bunyi atau tingkat kepentingannya lagi, naikkan angkanya — jangan menyunting
 * yang lama.
 */
const CHANNEL = 'obat-v3';
const CHANNEL_LAMA = ['obat', 'obat-v2'];

/** Ditandai di data notifikasi supaya bisa dikenali saat diketuk. */
export const JENIS_PENGINGAT_OBAT = 'pengingat-obat';

/**
 * Notifikasi yang tiba saat aplikasi sedang dibuka tetap ditampilkan.
 * Tanpa ini, pengingat yang jatuh persis ketika pasien membuka aplikasi
 * hilang tanpa jejak.
 */
export function pasangPenangan(): void {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldPlaySound: true,
      shouldSetBadge: false,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });
}

export type IzinNotifikasi = 'granted' | 'denied' | 'undetermined';

export async function cekIzin(): Promise<IzinNotifikasi> {
  const { status } = await Notifications.getPermissionsAsync();
  return status as IzinNotifikasi;
}

/**
 * Meminta izin — hanya dipanggil saat pasien menyalakan pengingat, bukan saat
 * aplikasi dibuka. Dialog izin yang muncul sebelum orang tahu untuk apa
 * hampir selalu ditolak, dan di Android penolakan itu sulit dibatalkan.
 */
export async function mintaIzin(): Promise<IzinNotifikasi> {
  // Channel harus ada LEBIH DULU di Android: notifikasi tanpa channel tidak
  // pernah tampil, dan kegagalannya sunyi.
  await siapkanChannel();
  const { status } = await Notifications.requestPermissionsAsync();
  return status as IzinNotifikasi;
}

async function siapkanChannel(): Promise<void> {
  if (Platform.OS !== 'android') return;

  await Notifications.setNotificationChannelAsync(CHANNEL, {
    name: 'Pengingat obat',
    importance: Notifications.AndroidImportance.HIGH,
    // `sound` SENGAJA TIDAK DISEBUT. Di native, kunci yang tidak ada berarti
    // bunyi bawaan sistem:
    //
    //   if (!args.containsKey(SOUND_KEY)) return Settings.System.DEFAULT_NOTIFICATION_URI;
    //   // "null" means "no sound"
    //
    // Nilainya adalah NAMA BERKAS, bukan kata kunci. `sound: 'default'` dicari
    // sebagai berkas bernama "default", tidak ketemu ("Custom sound 'default'
    // not found in native app"), dan channel-nya justru jadi senyap. Untuk
    // bunyi khusus kelak, berkasnya harus didaftarkan di array `sounds` pada
    // plugin expo-notifications di app.json.
    enableVibrate: true,
    vibrationPattern: [0, 250, 250, 250],
  });

  for (const lama of CHANNEL_LAMA) {
    await Notifications.deleteNotificationChannelAsync(lama);
  }
}

/**
 * Menutup pengingat yang sudah tampil dan mengosongkan angka di ikon.
 *
 * Notifikasi yang sudah berbunyi TIDAK hilang sendiri — ia menunggu di panel
 * notifikasi sampai disapu, dan ColorOS menghitungnya sebagai angka di ikon
 * aplikasi. Enam dosis sehari plus beberapa notifikasi uji dengan cepat
 * menumpuk jadi angka yang tidak jelas asalnya.
 *
 * Dipanggil saat layar Obat dibuka: di sanalah kotak centang dosisnya berada,
 * jadi pengingatnya memang sudah selesai tugasnya.
 */
export async function bersihkanTampilan(): Promise<void> {
  await Notifications.dismissAllNotificationsAsync();
  await Notifications.setBadgeCountAsync(0);
}

/**
 * Menghapus semua pengingat lalu memasang ulang dari nol.
 *
 * Sengaja bukan penambalan bertahap. Obat bisa dihentikan, dilanjutkan,
 * dihapus, atau berubah frekuensinya, dan menambal sedikit-sedikit adalah cara
 * paling mudah meninggalkan pengingat yatim untuk obat yang sudah tidak
 * diminum. Jumlahnya kecil (paling banyak beberapa belas), jadi memasang ulang
 * semuanya murah dan hasilnya selalu bisa diprediksi.
 *
 * Menerima rencana yang sudah jadi, bukan daftar obat: yang memutuskan tetap
 * `rencanaPengingat()` yang murni dan teruji, dan pemanggilnya bisa menahan
 * pemasangan ulang selama rencananya tidak berubah.
 */
export async function pasangPengingat(rencana: Pengingat[]): Promise<void> {
  await siapkanChannel();
  await batalkanPengingatObat();

  for (const p of rencana) {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: p.judul,
        body: p.isi,
        data: { jenis: JENIS_PENGINGAT_OBAT, medicationId: p.medicationId, slot: p.slot },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DAILY,
        hour: p.hour,
        minute: p.minute,
        channelId: CHANNEL,
      },
    });
  }
}

/** Mematikan seluruh pengingat. Dipakai saat pasien menggeser saklarnya. */
export async function matikanPengingat(): Promise<void> {
  await batalkanPengingatObat();
}

/**
 * Membatalkan pengingat obat saja, bukan `cancelAllScheduledNotificationsAsync`.
 *
 * Bedanya nyata: notifikasi uji yang baru dipasang pasien akan ikut terhapus
 * kalau semuanya dibatalkan, dan pengujian jadi mustahil. Menyaring lewat
 * penanda `jenis` juga menjaga notifikasi lain yang mungkin ditambahkan kelak.
 */
async function batalkanPengingatObat(): Promise<void> {
  const semua = await Notifications.getAllScheduledNotificationsAsync();
  for (const n of semua) {
    if (n.content.data?.jenis === JENIS_PENGINGAT_OBAT) {
      await Notifications.cancelScheduledNotificationAsync(n.identifier);
    }
  }
}

/**
 * Notifikasi uji beberapa detik lagi.
 *
 * Tetap ada meski pelacakannya sudah selesai: perilaku notifikasi berbeda jauh
 * antar merek Android, dan mencoba sekali di ponsel sendiri adalah satu-
 * satunya cara pasien tahu pengingatnya benar-benar berbunyi — tanpa menunggu
 * sampai jam minum obat.
 */
export async function ujiBunyi(detik = 10): Promise<void> {
  await siapkanChannel();
  await Notifications.scheduleNotificationAsync({
    content: {
      title: 'Uji pengingat Teman Lupus',
      body: `Kalau kamu melihat ini, notifikasi berfungsi di ponselmu.`,
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
      seconds: detik,
      repeats: false,
      channelId: CHANNEL,
    },
  });
}
