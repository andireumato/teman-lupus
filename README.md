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

Tabel `med_side_effects` (efek samping) dan skema sisi dokter
(`profiles.kode_dokter`, fungsi `tautkan_dokter`, RLS akses profil) **sudah
dibuat** 27 Juli 2026 lewat Dashboard SQL Editor, dengan isi
`supabase/efek_samping.sql` dan `supabase/sisi_dokter.sql` apa adanya.
Diverifikasi lewat REST: keduanya terbaca (HTTP 200) dan RLS aktif — insert
tanpa login ditolak `42501`.

Skema obat diperbarui 27 Juli 2026 lewat Dashboard SQL Editor dengan isi
`supabase/obat_frekuensi_dan_riwayat.sql`: kolom `medications.frekuensi` dan
tabel `medication_events`. Diverifikasi lewat REST: keduanya terbaca (HTTP 200)
dan RLS `medication_events` aktif (insert tanpa login ditolak `42501`).

Dua kejadian di sepanjang migrasi ini yang layak diingat:

**Baris kembar.** Pemasangan unique index gagal pada percobaan pertama: ada 3
pasang baris `med_logs` kembar — nilainya identik, dibuat selisih milidetik
oleh kode lama yang memeriksa-lalu-menyisipkan, sehingga dua ketukan cepat
lolos pemeriksaan. Persis masalah yang hendak dicegah index ini. Baris yang
lebih tua dari tiap pasangan dihapus (21 → 18) atas persetujuan.

**Kolom yang ternyata sudah ada.** `med_logs` sudah punya kolom `slot`
(`int not null default 0`) beserta unique index
`med_logs_unik_slot (medication_id, tanggal, slot)` sejak prototipe web —
keduanya **tidak tercantum** di `teman-lupus-supabase-schema.sql`. Versi
pertama migrasi ini menambahkan `dosis_ke` yang gunanya sama persis, sehingga
aplikasi menulis semua dosis dengan `slot = 0` dan tanda dosis ke-2 selalu
ditolak database, sementara dosis pertama tampak normal karena barisnya hanya
di-update. `dosis_ke` sudah dibuang; aplikasi memakai `slot` (berbasis 0).
Pelajarannya: **periksa tabel yang hidup, jangan percaya file skema** — file
ini memang sudah tertinggal, seperti tercatat di awal bagian ini.

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
   - `supabase/obat_frekuensi_dan_riwayat.sql`
   - `supabase/sisi_dokter.sql`
   - `supabase/efek_samping.sql`
   - `supabase/alerts_kunjungan.sql`
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
| `npm test`          | Unit test (red-flag, ringkasan, SLEDAI, MARS-5, UV, grafik, kode, tanggal) — 215 test |
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
    efek-samping.tsx      laporan efek samping obat oleh pasien
    dokter/               sisi dokter (hanya untuk role 'doctor')
      index.tsx           daftar pasien tertaut
      akun.tsx            kode dokter & keluar
      peringatan.tsx      kotak masuk peringatan Cek Flare
      pasien/[id].tsx     ringkasan pra-kunjungan satu pasien
      sledai/[id].tsx     formulir SLEDAI-2K
    (tabs)/
      index.tsx           Beranda
      flare.tsx           Cek Flare (triase tanda bahaya)
      obat.tsx            Obat & kepatuhan
      lab.tsx             Hasil laboratorium
      tren.tsx            Grafik, riwayat, akun
  lib/
    redflag.ts            red-flag engine [DETERMINISTIK]
    ringkasan.ts          perakit ringkasan pra-kunjungan + versi teksnya
    ringkasan-data.ts     pengambilan datanya (dipakai pasien & dokter)
    sledai.ts             skoring SLEDAI-2K
    kode.ts               kode dokter: bentuk, validasi, pembuatan
    grafik.ts             geometri grafik garis (murni, tanpa React)
    beranda.ts            salam, konten harian, tingkatan streak, insight
    uv.ts                 kategori indeks UV + pengambilan Open-Meteo
    mars.ts               skoring MARS-5
    dates.ts              tanggal lokal, selisih/mundur hari, deret & streak
    session.tsx           auth + profil + consent
    supabase.ts           klien Supabase
  constants/
    lupus.ts              gejala per sistem organ, panel lab & nilai rujukan
    sledai.ts             24 deskriptor SLEDAI-2K + bobotnya
    efek-samping.ts       daftar efek samping obat [DRAF, perlu review]
    edukasi.ts            kutipan harian + tips lupus
    consent.ts            naskah informed consent + versinya
    brand.ts              palet warna
  components/
    ringkasan-isi.tsx     tampilan 7 bagian ringkasan (dipakai pasien & dokter)
    dokter-saya.tsx       kartu penautan dokter di layar Tren
  types/database.ts       bentuk tabel Supabase
supabase/                 SQL pelengkap yang belum ada di skema awal
```

---

## Logo & ikon

Sumbernya satu berkas: logo lingkaran berisi kupu-kupu, nama, dan tagline
(`~/Downloads/teman-lupus-logo.png`, 512×512). Seluruh aset diturunkan darinya
oleh skrip sekali-jalan memakai `jimp-compact` yang sudah ada di dependensi.

Dua keputusan yang menentukan hasilnya:

**Ikon aplikasi hanya memakai kupu-kupunya, tanpa tulisan.** Ikon di layar HP
tampil sekitar 60×60 titik; pada ukuran itu nama dan tagline jadi bubur dan
hanya menambah keruwetan. Logo utuh dipakai di layar masuk, tempat ukurannya
besar dan terbaca.

**Latar kupu-kupu dibuat transparan, bukan dipotong sebagai persegi.**
Menempelkan potongan persegi ke kanvas berwarna meninggalkan garis kotak samar,
karena latar sumbernya tidak rata (artefak JPEG). Batas kupu-kupunya juga
dipindai otomatis dengan mengabaikan piksel berjarak >195 px dari pusat, supaya
cincin ungu di tepi logo tidak ikut terhitung.

Aset yang dihasilkan:

| Berkas | Isi |
| --- | --- |
| `icon.png` | Kupu-kupu di kanvas 1024 buram penuh — iOS menolak ikon ber-alpha |
| `android-icon-foreground.png` | Kupu-kupu transparan, hanya 52% lebar kanvas (zona aman Android ~66%) |
| `android-icon-background.png` | Warna rata `#FAFAF6`, dicuplik dari latar logo |
| `android-icon-monochrome.png` | Siluet hitam untuk ikon bertema Android |
| `logo-teman-lupus.png` | Logo utuh, di luar lingkaran dibuat transparan |
| `splash-icon.png`, `favicon.png` | Turunan yang sama |

> Sumbernya hanya 512×512 dan kupu-kupunya sekitar 285 px, jadi ikon 1024 px
> hasil pembesaran **agak lunak**. Kalau ada berkas asli beresolusi lebih
> tinggi, jalankan ulang skripnya dengan berkas itu.

> Ikon aplikasi bagian **native** — ia tidak ikut hot reload. Perubahannya baru
> terlihat setelah APK/IPA dibangun ulang. Yang langsung terlihat hanya logo di
> layar masuk.

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

### Patokan skala kelelahan & nyeri sendi

Kedua skala keluhan di formulir check-in (`SKALA_LELAH` dan
`SKALA_NYERI_SENDI` di `src/constants/lupus.ts`) punya keterangan pendek di
bawah tiap pilihan, ditulis reumatolog penanggung jawab. Patokannya sengaja
berbasis **dampak pada kegiatan** — apa yang masih bisa dikerjakan pasien —
bukan seberapa "capek" atau "sakit" rasanya, supaya penilaiannya konsisten
antar hari dan antar pasien, dan supaya hitungan hari di bagian 3 ringkasan
pra-kunjungan berarti sama bagi semua orang.

Karena butuh ruang untuk kalimat, pilihannya memakai `SegmentedVertical`
(bertumpuk ke bawah), bukan `Segmented` (berjajar).

Tiap tingkat juga punya titik berwarna (abu → hijau → kuning → merah).
Reumatolog menuliskan tingkatannya dengan emoji ⚪🟢🟡🔴; emoji **tidak**
dipakai di aplikasi native karena tidak dijamin punya glyph dan bisa tampil
sebagai kotak kosong (lihat catatan di `components/mood-scale.tsx`), jadi kode
warnanya diwujudkan sebagai titik. Warna hanya penguat — maknanya tetap ada di
label dan keterangannya, termasuk untuk pembaca layar.

Dijaga test di `src/constants/lupus.test.ts`: kedua skala wajib 0–3 berurutan,
setiap tingkat di atas "Tidak ada" wajib punya patokan, patokannya wajib
menyebut dampak pada kegiatan, dan tidak boleh ada emoji yang menyelinap masuk.

Tingkat **"Sangat berat" (nilai 4) dihapus** 27 Juli 2026: patokan "Berat"
sudah mencakup pasien yang sebagian besar harinya berbaring, jadi tidak ada
ruang bermakna di atasnya — dan tingkat tanpa patokan membuat data antar pasien
tidak sebanding. Skalanya kini **0–3**, sama panjang dengan nyeri sendi.

Constraint database sengaja dibiarkan `lelah between 0 and 4`: 0–3 tetap sah
dan baris lama bernilai 4 tidak perlu diubah. Yang menanganinya di sisi
aplikasi:

- `checkin.tsx` — nilai di luar skala dikosongkan saat formulir dibuka, supaya
  tidak tersimpan ulang diam-diam sementara layarnya tampak tanpa pilihan.
- `BarChart` di `tren.tsx` — tinggi bar dibatasi 100% agar nilai 4 tidak
  meluber keluar kolomnya.
- Hitungan di ringkasan memakai `≥`, jadi baris lama bernilai 4 tetap terhitung
  sebagai kelelahan berat.

### Obat: frekuensi dosis & riwayat berhenti

Tiap obat punya **frekuensi** (1–4x sehari). Obat 3x sehari menampilkan tiga
baris centang pada layar Obat, dan tiap dosis dicatat sebagai baris `med_logs`
tersendiri (kolom `slot`, berbasis 0) — sebelumnya satu obat hanya bisa ditandai
sekali per hari, sehingga pasien yang minum 3x sehari tidak punya cara mencatat
dosis yang terlewat.

Seluruh baris centangnya bisa diketuk (tinggi 44pt), bukan kotak kecilnya saja.
Menandai dosis **tidak** memuat ulang layar: `muat()` menyalakan `loading` dan
mengganti seluruh layar dengan spinner, sehingga ketukan berikutnya jatuh di
spinner itu — pada obat 3x sehari tombolnya jadi terasa mati. Keadaan layar
sudah benar dari pembaruan optimistis; jaringan tinggal menyusul.

Menghentikan obat **tidak menghapus apa pun**: barisnya ditandai tidak aktif,
pindah ke daftar "Obat yang pernah diminum" beserta tanggal berhentinya, dan
bisa dilanjutkan lagi kapan saja. Riwayatnya disimpan sebagai event bertanggal
di `medication_events` (`mulai` / `stop` / `lanjut`) — bukan sekadar kolom
tanggal di `medications`, supaya obat yang berkali-kali dihentikan dan
dilanjutkan tetap terekam utuh.

Bagian 4 ringkasan pra-kunjungan tetap melaporkan obat yang **sudah
dihentikan** selama masih ada jejaknya pada periode itu — obat yang distop
kemarin justru yang penting dibawa ke kontrol.

Bagian itu dikelompokkan **per pertanyaan, bukan per obat** — tiap baris
menjawab satu hal, sehingga jumlah barisnya tetap berapa pun banyaknya obat:

```
4. OBAT
   - Sedang diminum: Metilprednisolon (3x/hari), Hidroksiklorokuin (1x/hari)
   - Perubahan: Prednison stop 12 Jul 2026 (perut perih), lanjut 20 Jul 2026
   - Dosis diminum: 94 dari 96 yang tercatat; terlewat: Prednison 1
   - MARS-5 22/25 Sedang (20 Jul 2026) · 8 dari 30 hari tanpa catatan
```

Dua bentuk sebelumnya ditolak saat ditinjau karena membingungkan: versi
pertama satu baris per obat dengan hitungan dosis mentah plus daftar perubahan
terpisah, versi kedua tetap per obat. Yang dipakai sekarang bentuk ketiga.

Keputusan yang dijaga di sini: **penyebutnya "dosis yang tercatat"**, bukan
dosis yang seharusnya. Persentase kepatuhan butuh penyebut "berapa dosis
seharusnya diminum", dan dengan hari yang tidak dicatat penyebut itu jadi
tebakan — angka 90% yang sebenarnya tidak diketahui lebih menyesatkan daripada
dua angka mentah. Karena itu jumlah hari tanpa catatan disebut di baris yang
sama dengan MARS-5.

Nama obat hanya disebut pada baris "terlewat" bila obat itu memang punya dosis
terlewat. Keterbatasan efek samping pindah ke kalimat penutup ringkasan: ia
bercerita tentang aplikasi, bukan tentang pasien.

### Efek samping obat

Pasien melaporkannya lewat **Obat → Laporkan efek samping**: daftar centang
16 keluhan yang lazim pada obat lupus, boleh disertai obat yang dicurigai
(opsional — "Tidak tahu" adalah pilihan sah, karena menebak lebih buruk
daripada mengosongkan) dan catatan bebas.

Disimpan di tabel `med_side_effects`, **bukan** di `daily_checkins.gejala`.
Alasannya menentukan: beberapa keluhan — ruam, rambut rontok, sariawan, demam —
bisa datang dari lupusnya atau dari obatnya. Kalau digabung, bagian 2 ringkasan
("gejala menonjol per sistem organ") akan menghitung efek obat sebagai
aktivitas penyakit. Yang membedakan keduanya penilaian dokter, bukan tebakan
aplikasi; jadi aplikasi mencatat keduanya apa adanya, di tempat berbeda.

Dua keluhan ditandai `arahkanCekFlare` — pandangan kabur dan demam — karena
keduanya juga bisa jadi tanda bahaya. Aplikasi **tidak** mengeskalasi sendiri:
ia hanya menampilkan pesan yang mengarahkan pasien ke Cek Flare, tetap satu-
satunya jalur eskalasi.

> ⚠️ **Daftar 16 efek sampingnya masih DRAF** (`constants/efek-samping.ts`),
> disusun dari efek samping yang lazim pada hidroksiklorokuin, steroid,
> mikofenolat, azatioprin, dan metotreksat. Menambah, membuang, atau mengubah
> kata-katanya adalah keputusan reumatolog.

### Grafik di layar Tren

Grafik garis, digambar tanpa dependensi apa pun: tiap ruas adalah `View` tipis
yang diputar. `react-native-svg` tidak dipasang di proyek ini dan menambah
pustaka grafik hanya untuk tiga garis kecil tidak sepadan.

Dua hal yang sengaja dijaga, keduanya ditutup test di `src/lib/grafik.test.ts`:

- **Sumbu X-nya hari kalender**, bukan urutan check-in. Dua titik yang terpaut
  seminggu tidak boleh tampak berdampingan — alasan yang sama dengan hitungan
  hari di bagian 3 ringkasan.
- **Garis diputus pada hari yang tidak diisi.** Menyambungkannya berarti
  mengarang nilai untuk hari yang pasien memang tidak mencatat apa pun. Ada
  keterangan di bawah grafik yang menyebutkan ini.

Geometrinya (`src/lib/grafik.ts`) dipisah dari komponennya supaya salah skala
atau salah sudut ketahuan lewat test, bukan lewat memelototi layar.

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
I/O — 44 test menutupi setiap aturan pengelompokan.

**Yang dijaga:** ringkasan hanya merangkum apa yang pasien catat. Ia tidak
menilai aktivitas penyakit, tidak menyebut flare sebagai kesimpulan, dan tidak
pernah menyinggung dosis. Bagian 3 berisi kalimat deskriptif dalam satuan asli
check-in — hitungan hari, bukan pemicu tindakan. Satu-satunya jalur eskalasi
tetap red-flag engine.

### Bagian 3 — "Perubahan & waktunya"

Tugasnya: menghemat pekerjaan yang kalau tidak ada harus dilakukan dengan
membaca seluruh log — sejak kapan memberat, apa yang muncul bersamaan, dan
kapan datanya kosong.

Versi pertama bagian ini bernama "Indikator" dan ditolak saat ditinjau. Empat
sebabnya, semuanya sudah diperbaiki dan dijaga oleh test:

1. **Skor gabungan karangan.** Kelelahan (0–4) + nyeri sendi (0–3) dijumlahkan
   jadi "skor beban" 0–7 — angka yang tampak objektif tetapi tidak punya
   padanan klinis. Sekarang semua kalimat memakai skala asli beserta ambangnya.
2. **Satuannya check-in, bukan hari.** "Naik 4 check-in berturut-turut" bisa
   berarti rentang tiga minggu bila pasien jarang mengisi. Sekarang semua
   hitungan memakai hari kalender, dan rentetan harus benar-benar bersambung.
3. **Mengulang bagian lain.** Baris jumlah peringatan Cek Flare persis isi
   bagian 5; sudah dibuang.
4. **Judul tanpa rujukan.** "Indikator" — indikator apa? Diganti menjadi
   "Perubahan & waktunya".

Ditambahkan satu hal yang sebelumnya tidak ada: **hari tanpa check-in**
disebut eksplisit, karena tidak ada catatan bukan berarti tidak ada gejala.

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
- Ambang "menonjol" di bagian 3: nyeri sendi 2–3 (sedang–berat), kelelahan 2–3
  (sedang–berat), mood 1–2 (buruk). Kelelahan semula hanya menghitung tingkat
  teratas; disamakan dengan nyeri sendi 27 Juli 2026, karena patokan "Sedang"
  pada kedua skala sama-sama berarti kegiatan harus dikurangi. Labelnya menyebut rentang **dan** skala aslinya
  ("2–3 dari skala 0–3") alih-alih notasi "≥2", yang menuntut pembacanya tahu
  dulu panjang skalanya. Rentang itu diturunkan dari ambang, jadi label tidak
  bisa meleset ketika ambangnya diubah. Jendela pembandingnya 14 hari terakhir vs 14 hari
  sebelumnya — dipotong setengah periode bila periodenya lebih pendek.
- Penyebut hitungan itu **hari yang tercatat**, bukan hari kalender, dan
  panjang jendelanya tetap disebut ("6 dari 7 hari yang tercatat (dalam 14 hari
  terakhir)"). Alasannya: pasien yang jarang mengisi biasanya justru sedang
  tidak enak badan, dan penyebut kalender akan meremehkan angkanya — 6 dari 7
  hari terisi terbaca "6 dari 14".
- "Mulai memberat" butuh ≥ 3 hari kalender berturut-turut dengan nyeri ≥ 2;
  yang dilaporkan adalah rentetan terakhir.
- "Muncul bersamaan" butuh ≥ 2 gejala dari ≥ 2 sistem organ yang pertama
  tercatat dalam rentang 7 hari, dan gejala yang sudah ada sejak check-in
  pertama tidak dihitung.
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

## Sisi dokter

Pengguna dengan peran `doctor` masuk ke `/dokter`, bukan ke tab pasien —
penjaga rute di `app/_layout.tsx` yang memisahkannya, dan pasien yang mengetik
alamat `/dokter` dilempar kembali.

**Penautan pasien–dokter.** Dokter punya kode 6 karakter (`profiles.kode_dokter`)
yang dibagikan ke pasiennya; pasien memasukkannya di tab **Tren → Dokter saya**.
Yang memulai adalah PASIEN, sejalan dengan naskah consent: dia memilih
membagikan datanya, bukan ditambahkan diam-diam ke daftar seseorang. Pasien
bisa melepas tautan kapan saja.

Penautan lewat fungsi `tautkan_dokter()` di database (`security definer`),
bukan `select` biasa ke `profiles`. Alasannya: untuk mencari dokter dari kode,
pasien perlu membaca baris profil orang lain — dan kalau itu dibuka lewat RLS,
siapa pun yang login bisa menelusuri daftar pengguna. Dengan fungsi, pencarian
terjadi di dalam database dan yang keluar hanya hasil penautannya.

Abjad kodenya membuang karakter yang mudah tertukar (0/O, 1/I/L, 5/S, 8/B)
karena kode ini dibacakan dan diketik ulang. Keunikan dijamin unique index,
bukan keberuntungan: bila kode bentrok, aplikasi mencoba kode lain.

**Yang dilihat dokter** adalah ringkasan pra-kunjungan yang sama persis dengan
yang dilihat pasien — komponen tampilannya satu (`components/ringkasan-isi.tsx`)
dan pengambilan datanya satu (`lib/ringkasan-data.ts`). Kalau masing-masing
punya salinannya sendiri, dokter dan pasien bisa duduk berhadapan membahas dua
ringkasan yang berbeda isinya.

**Peringatan** dibuat **oleh trigger database**, bukan oleh aplikasi. Saat Cek
Flare menghasilkan kuning atau merah, `on_flare_check_alert` menyisipkan baris
`alerts` menyatu dengan penyimpanan cek flare-nya.

Kenapa bukan dari aplikasi: satu kegagalan jaringan sesudah `flare_checks`
tersimpan akan menghasilkan cek flare merah yang tidak pernah muncul di kotak
masuk dokter — gagal diam-diam, pada jalur yang justru paling tidak boleh gagal
diam-diam. Ini tidak mengubah jalur eskalasi pasien: pesan "segera ke IGD"
tetap dihitung di perangkat oleh `redflag.ts` dan tampil tanpa menunggu
jaringan. Peringatan hanya salinan untuk dokter.

`alerts.flare_check_id` dengan unique index membuat trigger, penyisipan ulang,
maupun menjalankan skrip dua kali tidak menggandakan kotak masuk. Skrip juga
mengisi peringatan untuk cek flare kuning/merah yang tersimpan sebelum trigger
dipasang.

Hitungan peringatan terbuka di daftar pasien sengaja **tanpa batas waktu**,
berbeda dengan penanda 30 hari di kartu pasien: peringatan darurat dari dua
bulan lalu yang belum ditindaklanjuti tetap harus terlihat.

**Kunjungan** dicatat dokter di layar detail pasien (`visits`), dan layar itu
menampilkan berapa hari sejak kunjungan terakhir.

**SLEDAI-2K** (`constants/sledai.ts` + `lib/sledai.ts`) diisi dokter, skor
dihitung otomatis dari bobot deskriptor. Bobotnya bagian dari instrumen —
mengubahnya berarti bukan SLEDAI-2K lagi — dan dijaga test: 8×bobot 8,
6×bobot 4, 7×bobot 2, 3×bobot 1, maksimum 105. Kunci yang tidak dikenal
melempar, bukan diabaikan diam-diam.

**Diverifikasi ke literatur** 27 Juli 2026 lewat PubMed, dan verifikasi itu
menemukan dua kesalahan yang sudah diperbaiki:

1. **Jendela waktu.** Layar semula menulis "centang deskriptor yang ada saat
   ini". Instrumen menghitung deskriptor yang ada dalam **30 hari terakhir**.
2. **Ambang kategori.** Versi pertama memakai 1–5 / 6–10 / 11–19 / ≥20 yang
   disusun dari ingatan dan tidak cocok dengan rujukan mana pun yang bisa
   ditelusuri. Diganti dengan pembagian yang dikutip Suszek dkk. (Reumatologia
   2024) dari Carter dkk. (Nat Rev Rheumatol 2016): **remisi 0 · ringan ≤6 ·
   sedang ≤12 · berat >12**.

Yang terverifikasi benar: 24 deskriptor (16 klinis + 8 laboratorium), skor
maksimum 105 — sekaligus pemeriksaan aritmetika atas komposisi bobotnya — dan
sifat khas 2K yaitu ruam, alopesia, ulkus mukosa, serta proteinuria tetap
dihitung meski menetap.

Rujukan tercantum di kepala `constants/sledai.ts`: Gladman dkk. J Rheumatol
2002 (PMID 11838846), Bombardier dkk. Arthritis Rheum 1992 (PMID 1599520),
Suszek dkk. Reumatologia 2024 (PMID 39055730), Carter dkk. Nat Rev Rheumatol
2016 (PMID 27558659).

**Definisi tiap deskriptor** ditampilkan di bawah namanya pada formulir —
definisi itulah yang menentukan boleh atau tidaknya sesuatu dicentang, dan
tanpa itu penilai hanya menebak dari judulnya. Dijaga test: tiap deskriptor
wajib punya definisi.

> ⚠️ Masih perlu disahkan reumatolog:
> - **Definisi 24 deskriptor** — ini ditulis dari pengetahuan baku SLEDAI
>   (Bombardier dkk. 1992) dan **belum dicocokkan kata-per-kata** dengan naskah
>   aslinya; tabel definisinya ada di lampiran yang tidak tersedia sebagai teks
>   akses terbuka. Berbeda dengan struktur, bobot, dan kategori di atas, yang
>   memang dicocokkan ke sumber yang bisa dibaca.
> - **Terjemahan Indonesia** tiap deskriptor.
> - Apakah potongan kategori Carter cocok dengan protokol penelitian Anda.

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
| `obat_frekuensi_dan_riwayat.sql` | Frekuensi dosis, dosis ke-berapa, & riwayat berhenti/lanjut  |
| `sisi_dokter.sql`             | Kode dokter, fungsi penautan, RLS akses profil                  |
| `efek_samping.sql`            | Tabel efek samping obat yang dilaporkan pasien                   |
| `alerts_kunjungan.sql`        | Trigger peringatan dari Cek Flare + tautan ke cek flare asalnya  |

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
- **Tindak lanjut sesudah peringatan red-flag** — tidak ada layar yang bertanya
  "apa yang kamu lakukan setelah itu?", jadi bagian 5 ringkasan selalu berkata
  belum tercatat.
- **Pengingat obat** & notifikasi.
- **Ekspor CSV** untuk penelitian.
- **PRO tervalidasi Bahasa Indonesia** (mis. Lupus Impact Tracker) — lihat
  catatan validasi di Bagian 7 spesifikasi MVP.
