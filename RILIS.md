# Cara mengirim perbaikan ke ponsel pasien

Ada dua jalur, dan memilih yang salah berarti pasien tidak menerima apa pun
atau — lebih buruk — menerima aplikasi yang tidak bisa dibuka.

## Jalur 1: update JavaScript (tanpa pasang ulang)

Dipakai untuk perubahan logika, teks, tampilan, perhitungan. Pasien menerimanya
saat membuka aplikasi; versi barunya aktif pada pembukaan berikutnya.

```
npx eas-cli update --branch preview --platform android --environment preview --message "apa yang diperbaiki"
```

Tiga argumen itu wajib, dan masing-masing pernah menggagalkan rilis:

- **`--platform android`** — tanpa ini EAS mengekspor web juga, dan ekspor web
  gagal dengan `window is not defined`. Supabase mencari `localStorage` saat
  server-side rendering. Seluruh perintah batal, termasuk bagian Android-nya.
- **`--environment preview`** — tanpa ini bundelnya dibangun tanpa
  `EXPO_PUBLIC_SUPABASE_URL` dan `EXPO_PUBLIC_SUPABASE_ANON_KEY`. Aplikasi
  terpasang, terbuka, lalu gagal di setiap panggilan ke database.
- **`--branch preview`** — kanal yang dipakai profil build `preview`.

Sesudah terbit, cocokkan `Runtime version` pada keluarannya dengan
`Fingerprint` milik APK yang dipegang pasien (`eas build:view <id>`). Kalau
berbeda, update itu tidak akan pernah sampai ke mereka.

### Kapan update itu benar-benar terpasang

`app.json` menyetel `fallbackToCacheTimeout: 0`, jadi aplikasi tidak pernah
menahan layar menunggu unduhan: ia memuat versi lama yang tersimpan, mengunduh
yang baru di latar belakang, lalu memasangnya pada **pembukaan dingin
berikutnya**. Setiap update selalu butuh dua kali buka. Itu disengaja — pasien
yang sedang tidak enak badan tidak pantas menunggu layar splash saat sinyalnya
jelek.

Untuk menguji sendiri: buka, tunggu ~10 detik, geser aplikasi keluar dari daftar
aplikasi terbaru, buka lagi.

**Jangan menyuruh pasien melakukan itu.** Menggeser aplikasi dari daftar terbaru
membuang seluruh alarm terjadwal di ColorOS, MIUI, dan Funtouch — lihat
`src/app/pengingat-bantuan.tsx`. Pasien akan mendapatkan updatenya sendiri dalam
pemakaian biasa, ketika ponsel di-restart atau aplikasinya ditutup sistem. Kalau
sebuah perbaikan memang mendesak, sampaikan isinya, bukan cara memaksanya.

## Jalur 2: build APK baru (pasien harus memasang ulang)

Wajib bila menyentuh kode native: menambah/menghapus pustaka, mengubah izin di
`app.json`, ikon, nama aplikasi, atau menaikkan versi Expo SDK.

```
npx eas-cli build --profile preview --platform android
```

## Kenapa runtimeVersion memakai `fingerprint`

`app.json` menyetel `runtimeVersion.policy = "fingerprint"`, bukan `appVersion`.

Dengan `appVersion`, semua APK bernomor 1.0.0 dianggap sepadan. Menambah
pustaka native lalu mengirim update JS yang memanggilnya — tanpa menaikkan
nomor versi — akan mengirim update itu ke APK lama yang tidak memilikinya, dan
aplikasi mati di ponsel pasien.

Dengan `fingerprint`, sidik jari susunan native ikut berubah, dan APK lama
tidak menerima update tersebut sama sekali. Pasien tetap pada versi lama yang
berfungsi. Jangan ganti kebijakan ini.

## Riwayat

- versionCode 4 — APK pertama yang bisa menerima update JS. Semua APK sebelumnya
  (1–3) tidak punya `expo-updates` dan selamanya menuntut pasang ulang.
