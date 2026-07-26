# Teman Lupus

Aplikasi pendamping pasien Lupus Eritematosus Sistemik (SLE) — check-in harian,
triase tanda bahaya, kepatuhan obat, hasil lab, dan tren.

Expo SDK 57 · React Native 0.86 · TypeScript · Supabase.

> **Bukan alat diagnosis.** Aplikasi ini mencatat dan menyaring (triage), bukan
> mengambil keputusan klinis. Untuk keadaan darurat → IGD.

---

## ⚠️ Backend perlu disiapkan lebih dulu

`.env` saat ini menunjuk ke `zuaskccuznkljafznofq.supabase.co` — project yang
dipakai prototipe web. **Host itu sudah tidak ada lagi** (DNS NXDOMAIN), jadi
login akan gagal dengan _"fetch failed: A server with the specified hostname
could not be found."_

Untuk menjalankannya:

1. Buat project Supabase baru.
2. SQL Editor → jalankan berurutan:
   - `teman-lupus-supabase-schema.sql` (skema utama, 10 tabel + RLS)
   - `supabase/lab_results.sql`
   - `supabase/consent_columns.sql`
   - `supabase/unique_checkin_per_hari.sql`
3. Salin Project URL & anon key ke `.env`.

---

## Menjalankan

```bash
npm install
cp .env.example .env      # isi URL & anon key Supabase
npm start                 # lalu tekan i (iOS) / a (Android), atau pindai QR dengan Expo Go
```

| Perintah            | Fungsi                                         |
| ------------------- | ---------------------------------------------- |
| `npm test`          | Unit test (red-flag, MARS-5, tanggal) — 45 test |
| `npm run typecheck` | Cek tipe TypeScript                            |
| `npm run lint`      | ESLint + Prettier                              |
| `npm run format`    | Rapikan format kode                            |
| `npm run doctor`    | Cek kesehatan dependensi Expo                  |

Anon key memang dirancang untuk disertakan di aplikasi klien — yang melindungi
data adalah Row Level Security di Supabase, bukan kerahasiaan key ini. **Jangan
pernah** menaruh `service_role` key di `.env`.

---

## Struktur

```
src/
  app/                    rute (expo-router, file-based)
    _layout.tsx           penjaga rute: login → consent → tabs
    login.tsx             masuk / daftar (pasien atau dokter)
    consent.tsx           informed consent, wajib sebelum masuk
    mars.tsx              kuesioner MARS-5
    (tabs)/
      index.tsx           Check-in harian
      flare.tsx           Cek Flare (triase tanda bahaya)
      obat.tsx            Obat & kepatuhan
      lab.tsx             Hasil laboratorium
      tren.tsx            Grafik, riwayat, akun
  lib/
    redflag.ts            red-flag engine [DETERMINISTIK]
    beranda.ts            salam, konten harian, tingkatan streak, insight
    mars.ts               skoring MARS-5
    dates.ts              tanggal lokal & streak
    session.tsx           auth + profil + consent
    supabase.ts           klien Supabase
  constants/
    lupus.ts              gejala per sistem organ, panel lab & nilai rujukan
    edukasi.ts            kutipan harian + tips lupus
    consent.ts            naskah informed consent + versinya
    brand.ts              palet warna
  types/database.ts       bentuk tabel Supabase
supabase/                 SQL pelengkap yang belum ada di skema awal
```

---

## Beranda

Mengikuti prototipe web terbaru (`docs/prototipe-web-2026-07-26.html`):

- **Sapaan harian** sesuai waktu + tanggal Indonesia + kutipan penyemangat
- **Kartu streak** dengan tingkatan pada 3 / 7 / 14 / 30 / 60 / 100 hari,
  plus berapa hari lagi menuju tingkatan berikutnya
- **Insight personal** dari riwayat check-in
- **"Tahukah kamu?"** — edukasi lupus harian
- **Layar apresiasi** setelah check-in tersimpan

Kutipan dan tips berputar berdasarkan hari-ke-berapa dalam setahun, jadi semua
pasien melihat konten yang sama pada hari yang sama.

> **Insight bukan penilaian klinis.** Ia hanya merefleksikan apa yang pasien
> catat sendiri, dan tidak pernah menyebut flare, diagnosis, atau perubahan
> dosis. Satu-satunya jalur eskalasi tetap red-flag engine di bawah ini.
> Bila insight mendeteksi nyeri menaik, ia mengarahkan pasien ke **Cek Flare** —
> bukan mengambil kesimpulan sendiri.

---

## Red-flag engine — bagian paling penting

`src/lib/redflag.ts` mengimplementasikan Bagian 6 spesifikasi MVP. Keputusan
eskalasi ditentukan **hanya oleh aturan eksplisit** — tidak ada model bahasa,
tidak ada skor probabilistik, tidak ada heuristik.

| Tingkat      | `flare_checks.hasil` | Tindakan                           |
| ------------ | -------------------- | ---------------------------------- |
| **darurat**  | `red`                | Segera ke IGD                      |
| **mendesak** | `yellow`             | Hubungi tim dokter ≤ 24 jam        |
| **aman**     | `green`              | Dicatat untuk dibahas saat kontrol |

Sifat yang sengaja dipertahankan:

- **Fail-safe.** Bila darurat dan mendesak terpicu bersamaan → darurat. Demam
  tinggi tanpa konteks imunosupresan turun ke _mendesak_, bukan _aman_.
- **Murni.** `evaluateRedFlags()` tidak melakukan I/O, jadi bisa diaudit dan
  diuji baris per baris. 24 test menutupi setiap aturan.
- **Tidak menunggu jaringan.** Hasil dihitung di perangkat lalu baru disimpan,
  supaya pesan darurat tidak pernah tertunda oleh koneksi lambat.
- **Konteks diturunkan dari data, bukan ingatan pasien.** "Memburuk beruntun"
  dihitung dari 3 check-in terakhir; "sedang memakai imunosupresan" dibaca dari
  daftar obat aktif.

### Wajib direview reumatolog sebelum dipakai ke pasien nyata

1. **Ambang & definisi aturan** (`src/lib/redflag.ts`) — "demam tinggi" belum
   punya angka; "dosis steroid signifikan" belum dibedakan (saat ini semua
   steroid dianggap signifikan, fail-safe).
2. **Daftar kata kunci imunosupresan** (`src/app/(tabs)/flare.tsx`,
   konstanta `IMUNOSUPRESAN`) — menentukan apakah demam dieskalasi ke darurat.
3. **Definisi "memburuk beruntun"** (`flare.tsx`, `memburukBeruntun`) — saat
   ini: skor `lelah + nyeri_sendi` naik 3 hari berturut-turut.
4. **Nilai rujukan lab** (`src/constants/lupus.ts`) — indikatif, berbeda antar
   laboratorium.
5. **Ambang kategori MARS-5** (`src/lib/mars.ts`: Tinggi ≥ 23, Sedang ≥ 18) —
   cocokkan dengan rujukan yang dipakai di protokol penelitian.

---

## Database

Skema utama: `teman-lupus-supabase-schema.sql` (10 tabel + RLS).
Folder `supabase/` berisi SQL yang **belum ada** di skema itu tetapi dibutuhkan
aplikasi ini:

| File                          | Kegunaan                                                        |
| ----------------------------- | --------------------------------------------------------------- |
| `lab_results.sql`             | Tabel hasil lab + RLS (dipakai prototipe, tak ada di skema)      |
| `consent_columns.sql`         | `profiles.consent_at` & `profiles.consent_version`               |
| `unique_checkin_per_hari.sql` | Unique `(patient_id, tanggal)` agar upsert check-in bekerja      |

Semuanya aman dijalankan ulang. `unique_checkin_per_hari.sql` berisi query untuk
memeriksa duplikat lebih dulu — baca komentarnya sebelum menjalankan.

`patients` tidak dibuat oleh trigger auth (trigger hanya membuat `profiles`),
jadi `session.tsx` membuatnya saat pertama kali dibutuhkan.

---

## Consent

Naskah ada di `src/constants/consent.ts`. Setiap kali naskah berubah,
**naikkan `CONSENT_VERSION`** — pasien yang menyetujui versi lama akan diminta
menyetujui ulang. Ini syarat audit etik.

---

## Yang belum ada

- **Sisi dokter**: daftar pasien, input SLEDAI, alerts, ringkasan pra-kunjungan.
  Tabel `sledai_assessments`, `visits`, dan `alerts` sudah ada di skema tetapi
  belum dipakai. Pengguna dengan peran `doctor` saat ini masuk ke tampilan yang
  sama dengan pasien.
- **Ringkasan pra-kunjungan** (Bagian 8 spesifikasi MVP).
- **Pengingat obat** & notifikasi.
- **Ekspor CSV** untuk penelitian.
- **PRO tervalidasi Bahasa Indonesia** (mis. Lupus Impact Tracker) — lihat
  catatan validasi di Bagian 7 spesifikasi MVP.
