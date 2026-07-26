# Teman Lupus

Aplikasi pendamping pasien Lupus Eritematosus Sistemik (SLE) — check-in harian,
triase tanda bahaya, kepatuhan obat, hasil lab, dan tren.

Expo SDK 57 · React Native 0.86 · TypeScript · Supabase.

> **Bukan alat diagnosis.** Aplikasi ini mencatat dan menyaring (triage), bukan
> mengambil keputusan klinis. Untuk keadaan darurat → IGD.

---

## Status backend

`.env` menunjuk ke project Supabase yang sama dengan prototipe web
(`zuaskccuznkljafznofq`). Project ini sempat *paused* dan sudah di-resume;
REST & auth berjalan normal.

Isi database sudah lebih maju daripada `teman-lupus-supabase-schema.sql` —
tabel `lab_results` dan kolom `profiles.consent_at` / `consent_version` **sudah
ada** di sana. SQL di `supabase/` tetap disimpan sebagai dokumentasi dan aman
dijalankan ulang bila suatu saat perlu menyiapkan project baru.

Unique constraint `(patient_id, tanggal)` pada `daily_checkins` semula tidak ada
— tabel hanya punya primary key di `id`, karena prototipe web memakai `insert`
biasa dan tidak membutuhkannya. Constraint ini **sudah dipasang** (26 Juli 2026)
lewat Dashboard SQL Editor, tanpa duplikat yang perlu dibersihkan:

```sql
alter table public.daily_checkins
  add constraint daily_checkins_patient_tanggal_key unique (patient_id, tanggal);
```

Tabel `visit_questions` **sudah dibuat** (26 Juli 2026) lewat Dashboard SQL
Editor dengan isi `supabase/visit_questions.sql` apa adanya. Diverifikasi lewat
REST: tabel terbaca (HTTP 200) dan RLS aktif — insert tanpa login ditolak
`42501`. Bila suatu saat tabelnya hilang, bagian "Pertanyaan untuk dokter" di
layar ringkasan menampilkan pesan yang menyebut nama file SQL-nya, sementara
enam bagian ringkasan lain tetap jalan.

Aplikasi ini menyimpan check-in dengan upsert (`onConflict: patient_id,tanggal`)
sehingga mengisi ulang di hari yang sama **memperbarui** baris, bukan menambah
baris baru. Kalau suatu saat constraint ini hilang, penyimpanan check-in akan
gagal.

Bila suatu saat perlu menyiapkan project Supabase dari nol:

1. Buat project baru.
2. SQL Editor → jalankan berurutan:
   - `teman-lupus-supabase-schema.sql` (skema utama, 10 tabel + RLS)
   - `supabase/lab_results.sql`
   - `supabase/consent_columns.sql`
   - `supabase/unique_checkin_per_hari.sql`
   - `supabase/visit_questions.sql`
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
| `npm test`          | Unit test (red-flag, ringkasan, MARS-5, UV, beranda, tanggal) — 134 test |
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
    checkin.tsx           formulir check-in harian + layar apresiasi
    mars.tsx              kuesioner MARS-5
    ringkasan.tsx         ringkasan pra-kunjungan (Bagian 8 spesifikasi)
    (tabs)/
      index.tsx           Beranda
      flare.tsx           Cek Flare (triase tanda bahaya)
      obat.tsx            Obat & kepatuhan
      lab.tsx             Hasil laboratorium
      tren.tsx            Grafik, riwayat, akun
  lib/
    redflag.ts            red-flag engine [DETERMINISTIK]
    ringkasan.ts          perakit ringkasan pra-kunjungan + versi teksnya
    beranda.ts            salam, konten harian, tingkatan streak, insight
    uv.ts                 kategori indeks UV + pengambilan Open-Meteo
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

Mengikuti `docs/prototipe-web-2026-07-16.html`:

- **Hero bergradien** — sapaan sesuai waktu + nama depan, tanggal, kutipan harian
- **Kartu indeks UV** — UV maksimum hari ini dari Open-Meteo + saran proteksi
- **Kartu ajakan** — mengarah ke formulir check-in, atau apresiasi bila hari ini
  sudah terisi; streak tampil sebagai chip kecil di sudut
- **Akses cepat** — pintasan ke Cek Flare / Obat / Tren
- **"Tahukah kamu?"** — edukasi lupus harian

Formulir check-in ada di layar terpisah (`/checkin`), diakhiri **layar
apresiasi** berisi streak, pencapaian tingkatan (3/7/14/30/60/100 hari), dan
insight personal.

Kutipan dan tips berputar berdasarkan hari-ke-berapa dalam setahun, jadi semua
pasien melihat konten yang sama pada hari yang sama.

### Catatan dua prototipe

`docs/` menyimpan dua snapshot web. Yang **16 Juli** adalah acuan tampilan yang
dipakai sekarang. Yang **26 Juli** lebih baru secara tanggal dan sempat menjadi
acuan, tetapi Beranda-nya dikembalikan ke bentuk 16 Juli atas permintaan.
Bila suatu saat ingin menengok arah yang satunya: bedanya ada pada Beranda —
versi 26 Juli tidak punya kartu UV dan akses cepat, formulir check-in menyatu di
Beranda, dan streak tampil sebagai kartu penuh, bukan chip.

### Kartu UV & privasi lokasi

Lokasi hanya dipakai untuk mencari indeks UV, **tidak dikirim ke Supabase** dan
tidak disimpan bersama data medis — hanya di-cache di perangkat. Bila izin
ditolak, kartu tetap tampil memakai koordinat Medan dan menandainya sebagai
perkiraan. Bila jaringan gagal, kartu hilang diam-diam.

Permintaan izin digantung pada `patientId`, supaya pasien tidak dimintai izin
lokasi sebelum sempat login dan menyetujui consent.

> Di **Expo Go**, teks izin yang muncul adalah milik Expo Go ("shows you the
> current location on a map"), bukan teks kita. Teks di `app.json` baru dipakai
> pada development build atau build produksi.

> **Insight bukan penilaian klinis.** Ia hanya merefleksikan apa yang pasien
> catat sendiri, dan tidak pernah menyebut flare, diagnosis, atau perubahan
> dosis. Satu-satunya jalur eskalasi tetap red-flag engine di bawah ini.
> Bila insight mendeteksi nyeri menaik, ia mengarahkan pasien ke **Cek Flare** —
> bukan mengambil kesimpulan sendiri.

---

## Ringkasan pra-kunjungan

`src/lib/ringkasan.ts` + layar `/ringkasan` (dari tab **Tren**). Mengikuti
kerangka tujuh bagian di Bagian 8 spesifikasi MVP, untuk periode **30 atau 90
hari terakhir**. Tombol di bawah layar membagikan versi teks satu halaman
(share sheet di ponsel, salin ke papan klip di web).

Isi layar dan isi teks dirakit dari objek yang sama (`buatRingkasan()` →
`ringkasanTeks()`), jadi keduanya tidak bisa berbeda. Perakitnya murni tanpa
I/O — 36 test menutupi setiap aturan pengelompokan.

**Yang dijaga:** ringkasan hanya merangkum apa yang pasien catat. Ia tidak
menilai aktivitas penyakit, tidak menyebut flare sebagai kesimpulan, dan tidak
pernah menyinggung dosis. Bagian "Indikator" berisi kalimat berangka
(mis. "skor beban naik 4 check-in berturut-turut") — pengamatan, bukan pemicu
tindakan. Satu-satunya jalur eskalasi tetap red-flag engine.

**Penyimpangan yang disengaja dari naskah spesifikasi:**

| Spesifikasi | Yang dibuat | Alasan |
| --- | --- | --- |
| "1. SKOR PRO" | "1. SKOR HARIAN (bukan PRO tervalidasi)" | PRO tervalidasi Bahasa Indonesia belum ada — lihat Bagian 7. Menyebut skala check-in sebagai "PRO" akan menyesatkan pembaca. |
| "Efek samping dilaporkan" | Alasan bebas dari catatan minum obat + keterangan bahwa efek samping belum dikumpulkan terstruktur | Aplikasi belum punya field efek samping. |
| "tindak lanjut pasien jika diketahui" | "tindak lanjut pasien belum tercatat" | Tidak ada data tindak lanjut sesudah peringatan red-flag. |
| "7. PENGINGAT PEMANTAUAN (fase 2)" | Hanya fakta: tanggal lab terakhir, dan penanda bila pasien memakai hidroksiklorokuin | Jadwal skrining mata & lab rutin belum dipantau; memberi pengingat tanpa aturan yang direview akan jadi anjuran klinis. |

**Ambang yang perlu direview reumatolog** (semuanya ambang *tampilan*, tidak
memicu tindakan apa pun):

- Gejala dikelompokkan **baru / makin sering / menetap / berkurang** dengan
  membandingkan seberapa sering ia tercatat di paruh awal vs paruh akhir
  periode. Ambang geser 0,25 (`AMBANG_GESER`).
- Tren skor harian disebut naik/turun bila selisih rata-rata antar paruh ≥ 0,5.
- "Skor beban harian" = kelelahan + nyeri sendi, definisi yang sama dengan
  `memburukBeruntun` di layar Cek Flare.
- Bila salah satu paruh tidak punya check-in sama sekali, gejala **tidak**
  diklaim "baru" atau "berkurang" — dicatat netral sebagai "menetap", karena
  tidak ada pembanding.

**Privasi.** Teks memakai inisial + 8 karakter pertama ID pasien, bukan nama
lengkap. Membagikan tetap berarti mengeluarkan data medis dari aplikasi, jadi
ada peringatan tepat di atas tombolnya.

**Pertanyaan untuk kunjungan** disimpan di tabel `visit_questions`
(`supabase/visit_questions.sql`), jadi tidak hilang bila aplikasi dihapus dan
ikut pindah antar perangkat. Dokter penanggung jawab sudah boleh membacanya
lewat RLS, tinggal menunggu layar sisi dokter dibuat.

Versi pertama menyimpannya di perangkat (AsyncStorage). Layar `/ringkasan`
memindahkan sisa data lokal itu ke Supabase sekali saat dibuka, lalu membuang
kuncinya — dan hanya membuang kunci **setelah** pemindahan berhasil, supaya
tidak ada pertanyaan yang hilang bila jaringan gagal. Bila tabelnya belum
dibuat, layar menampilkan pesan yang menyebut file SQL-nya dan enam bagian
ringkasan lain tetap jalan.

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
6. **Ambang tampilan ringkasan pra-kunjungan** (`src/lib/ringkasan.ts`) —
   lihat daftarnya di bagian Ringkasan pra-kunjungan di atas.

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
| `visit_questions.sql`         | Pertanyaan pasien untuk kunjungan (bagian 6 ringkasan)          |

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
- **Efek samping obat terstruktur** — sekarang hanya ada alasan bebas di
  catatan minum obat, sehingga bagian 4 ringkasan pra-kunjungan belum lengkap.
- **Tindak lanjut sesudah peringatan red-flag** — tidak ada layar yang bertanya
  "apa yang kamu lakukan setelah itu?", jadi bagian 5 ringkasan selalu berkata
  belum tercatat.
- **Pengingat obat** & notifikasi.
- **Ekspor CSV** untuk penelitian.
- **PRO tervalidasi Bahasa Indonesia** (mis. Lupus Impact Tracker) — lihat
  catatan validasi di Bagian 7 spesifikasi MVP.
