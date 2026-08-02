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
import { hariISOKeExpo } from '@/lib/pola-minum';

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
    // Inilah yang mengizinkan titik/angka muncul di ikon aplikasi. Bawaan
    // Android memang `true`, jadi channel yang sudah terlanjur dibuat di ponsel
    // pasien tetap benar — ditulis di sini supaya tidak ada yang mematikannya
    // tanpa sengaja. Setelan channel terkunci setelah dibuat; mengubah nilai
    // ini kelak menuntut nama channel baru.
    showBadge: true,
  });

  for (const lama of CHANNEL_LAMA) {
    await Notifications.deleteNotificationChannelAsync(lama);
  }
}

/**
 * Menutup notifikasi pengingat milik satu dosis tertentu.
 *
 * Dipanggil saat pasien menjawab dosisnya. Tanpa ini, pengingat yang sudah
 * selesai tugasnya tetap menunggu di panel notifikasi dan tetap dihitung
 * peluncur sebagai tunggakan — sehingga angka di ikon berselisih dengan
 * kotak centang yang baru saja dicentang pasien.
 *
 * Hanya menyentuh notifikasi yang SUDAH TAMPIL, bukan yang masih terjadwal.
 * Jadwal harian berikutnya tidak ikut terhapus.
 */
export async function tutupPengingatDosis(medicationId: string, slot: number): Promise<void> {
  const tampil = await Notifications.getPresentedNotificationsAsync();
  for (const n of tampil) {
    const d = n.request.content.data;
    if (d?.jenis === JENIS_PENGINGAT_OBAT && d?.medicationId === medicationId && d?.slot === slot) {
      await Notifications.dismissNotificationAsync(n.request.identifier);
    }
  }
}

/**
 * Membuang pengingat dari hari-hari sebelumnya yang tak pernah dijawab.
 *
 * Angka di ikon aplikasi adalah jumlah pengingat yang masih menunggu di baki.
 * Pengingat kemarin yang tidak dijawab tetap di sana selamanya, padahal
 * dosisnya sudah tidak muncul lagi di layar Obat — layar itu hanya menampilkan
 * hari ini. Pasien tidak punya cara menghapusnya lewat aplikasi, jadi angkanya
 * akan naik terus sampai tidak berarti apa-apa lagi, dan angka yang selalu
 * salah adalah angka yang berhenti dibaca orang.
 *
 * Yang hilang di sini hanya penandanya, bukan datanya: dosis yang terlewat
 * tetap tercatat sebagai tidak dijawab di `med_logs` dan tetap terbawa ke
 * ringkasan pra-kunjungan maupun ekspor penelitian.
 */
export async function buangPengingatHariLalu(sekarang: Date = new Date()): Promise<void> {
  const awalHariIni = new Date(
    sekarang.getFullYear(),
    sekarang.getMonth(),
    sekarang.getDate()
  ).getTime();

  const tampil = await Notifications.getPresentedNotificationsAsync();
  for (const n of tampil) {
    if (n.request.content.data?.jenis !== JENIS_PENGINGAT_OBAT) continue;
    // `date` dalam milidetik sejak epoch pada Android; iOS memakai detik pada
    // sebagian versi, jadi nilai yang jelas terlalu kecil dibiarkan saja
    // daripada salah membuang pengingat hari ini.
    const waktu = typeof n.date === 'number' ? n.date : NaN;
    if (Number.isFinite(waktu) && waktu > 1e11 && waktu < awalHariIni) {
      await Notifications.dismissNotificationAsync(n.request.identifier);
    }
  }
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
      trigger: pemicuKeTrigger(p),
    });
  }
}

/**
 * Menerjemahkan pemicu murni jadi bentuk yang dimengerti expo-notifications.
 *
 * ⚠️ PENOMORAN HARI. `WEEKLY` memakai 1 = Minggu, sedangkan aplikasi ini
 * menyimpan hari dengan ISO 1 = Senin. Penerjemahannya lewat `hariISOKeExpo`,
 * bukan aritmetika di tempat — satu digit yang salah berarti pasien diingatkan
 * meminum metotreksat pada hari yang keliru.
 */
function pemicuKeTrigger(p: Pengingat): Notifications.NotificationTriggerInput {
  switch (p.pemicu.jenis) {
    case 'harian':
      return {
        type: Notifications.SchedulableTriggerInputTypes.DAILY,
        hour: p.hour,
        minute: p.minute,
        channelId: CHANNEL,
      };

    case 'mingguan':
      return {
        type: Notifications.SchedulableTriggerInputTypes.WEEKLY,
        weekday: hariISOKeExpo(p.pemicu.hariISO),
        hour: p.hour,
        minute: p.minute,
        channelId: CHANNEL,
      };

    case 'tanggal':
      // Sekali pakai. Pola selang tidak punya pemicu berulang di Android, jadi
      // jadwalnya diisi ulang tiap layar Obat dibuka — lihat
      // KEJADIAN_SELANG_DI_MUKA di pengingat.ts.
      return {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: p.pemicu.tanggal,
        channelId: CHANNEL,
      };
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
/**
 * Berapa pengingat obat yang BENAR-BENAR dipegang sistem sekarang.
 *
 * Dibutuhkan karena kartu pengingat selama ini menampilkan panjang rencana —
 * jumlah yang kita NIATKAN pasang — bukan jumlah yang tersimpan di Android.
 * Keduanya berbeda pada keadaan yang justru paling penting: ColorOS dan MIUI
 * membatalkan seluruh alarm ketika aplikasi digeser dari daftar recent, dan
 * sesudah itu kartu tetap berkata "3 pengingat aktif" padahal tidak ada satu
 * pun yang akan berbunyi.
 */
export async function terpasangDiSistem(): Promise<number> {
  const semua = await Notifications.getAllScheduledNotificationsAsync();
  return semua.filter((n) => n.content.data?.jenis === JENIS_PENGINGAT_OBAT).length;
}

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
