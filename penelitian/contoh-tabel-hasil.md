# Contoh tabel hasil penelitian

> # ⚠️ SELURUH ANGKA DI BAWAH INI REKAAN
>
> Tidak ada satu pun pasien sungguhan di dalam berkas ini. Angkanya dibangkitkan
> komputer dengan benih tetap, semata-mata untuk memperlihatkan **bentuk** tabel
> hasil sebelum data yang sebenarnya terkumpul.
>
> **Jangan memasukkan angka mana pun dari berkas ini ke dalam proposal, laporan,
> maupun publikasi.** Berkas ini bukan bagian naskah yang diserahkan.

Tabel-tabel berikut dihasilkan dengan menjalankan persis rencana analisis pada
subbab 3.11 di atas data rekaan tersebut, yaitu interval kepercayaan proporsi
metode Wilson, uji Wilcoxon berpasangan, dan korelasi Spearman. Karena itu
angka antartabel saling konsisten, dan tabel ini sekaligus membuktikan bahwa
rencana analisisnya memang dapat dijalankan.

Dibangkitkan ulang dengan `python3 penelitian/contoh-tabel-hasil.py`.

---

**Tabel 4.1. Alur peserta penelitian.**

| Tahap | Jumlah |
|---|---|
| Pasien dinilai kelayakannya | 78 |
| Tidak memenuhi kriteria | 15 |
| Menolak ikut serta | 8 |
| Terekrut dan memberi persetujuan | 55 |
| Menarik persetujuan selama pemantauan | 2 |
| Masuk analisis luaran utama | 53 |
| Memiliki penilaian awal dan akhir lengkap | 37 |

*Cara membacanya:* Baris terakhir selalu lebih kecil daripada jumlah yang terekrut. Selisih itu bukan kegagalan penelitian, melainkan bagian dari yang diukur — lihat penanganan data hilang pada subbab 3.11.1.

**Tabel 4.2. Karakteristik dasar peserta.**

| Karakteristik | n = 53 |
|---|---|
| Usia, tahun, rerata ± SB | 30,0 ± 7,4 |
| Perempuan, n (%) | 50 (94,3%) |
| Lama sakit, bulan, median (RIK) | 45 (23–72) |
| Pendidikan dasar, n (%) | 6 (11,3%) |
| Pendidikan menengah, n (%) | 28 (52,8%) |
| Pendidikan tinggi, n (%) | 19 (35,8%) |
| Jumlah organ terlibat, median (RIK) | 2 (2–3) |
| Memakai glukokortikoid, n (%) | 51 (96,2%) |
| Dosis setara prednison, mg/hari, median (RIK) | 7,5 (4,0–12,5) |
| SLEDAI-2K awal, median (RIK) | 7 (4–9) |

*Cara membacanya:* Tabel pertama pada tiap laporan penelitian. Gunanya bukan menjawab pertanyaan penelitian, melainkan memberi tahu pembaca kepada siapa hasil ini berlaku.

**Tabel 4.3. Retensi dan kelengkapan pengisian (luaran utama).**

| Luaran | n/N | Proporsi (IK 95%) |
|---|---|---|
| Aktif pada 30 hari terakhir | 36/53 | 67,9% (54,5–78,9) |
| Mengisi ≥ 50% hari pemantauan | 11/53 | 20,8% (12,0–33,5) |
| Hari terisi dari 90 hari, median (RIK) | — | 28 (15–41) |

*Cara membacanya:* Inilah jawaban atas pertanyaan penelitian utama. Yang dilaporkan bukan sekadar angka tengahnya, melainkan interval kepercayaannya — itulah sebabnya besar sampel dihitung dari presisi pada subbab 3.5.

**Tabel 4.4. Aktivitas penyakit pada penilaian awal dan akhir.**

| Penilaian | n = 37 | Uji | Nilai p |
|---|---|---|---|
| SLEDAI-2K awal, median (RIK) | 7 (4–9) | Wilcoxon berpasangan | < 0,001 |
| SLEDAI-2K bulan ke-3, median (RIK) | 5 (1–7) |  |  |
| Selisih, median (RIK) | −2 (−4 hingga −1) |  |  |

*Cara membacanya:* Hanya 37 dari 53 peserta yang punya kedua penilaian, dan jumlah itu wajib dicantumkan. Penelitian ini tanpa kelompok pembanding, sehingga perubahan apa pun TIDAK boleh dibaca sebagai akibat aplikasi.

**Tabel 4.5. Kepatuhan minum obat.**

| Ukuran | Penyebut | n = 53 |
|---|---|---|
| MARS-5 awal, median (RIK) | skor 5–25 | 18 (15–19) |
| Kepatuhan tercatat, %, median (RIK) | dosis yang tercatat | 87,8 (78,9–95,5) |
| Cakupan pencatatan, %, median (RIK) | dosis terjadwal | 47,9 (37,3–58,3) |

*Cara membacanya:* Tiga baris ini TIDAK boleh dijumlahkan atau dibandingkan langsung, sebab penyebutnya berbeda. Cakupan pencatatan rendah berarti banyak dosis tidak dicatat — bukan berarti tidak diminum.

**Tabel 4.6. Hubungan kepatuhan minum obat dengan aktivitas penyakit.**

| Pasangan variabel | n | Spearman rho | Nilai p |
|---|---|---|---|
| MARS-5 awal vs SLEDAI-2K bulan ke-3 | 37 | 0,189 | 0,263 |
| Kepatuhan tercatat vs SLEDAI-2K bulan ke-3 | 37 | -0,085 | 0,616 |

*Cara membacanya:* Pada 37 peserta, hanya rho sekitar 0,37 atau lebih yang terdeteksi dengan kekuatan 80% (subbab 3.5). Hasil yang tidak bermakna di sini berarti "belum terbukti", BUKAN "terbukti tidak ada hubungan".

**Tabel 4.7. Peristiwa penyaringan tanda bahaya.**

| Tingkat | Peserta yang mengalami ≥ 1 kali, n (%) | Ditindaklanjuti dalam 24 jam, n (%) |
|---|---|---|
| Darurat | 10 (18,9%) | 9 (90,0%) |
| Mendesak | 12 (22,6%) | 8 (66,7%) |

*Cara membacanya:* Kolom kedua mengukur mesin aturannya, kolom ketiga mengukur alur pelayanannya. Peringatan yang terbit tetapi tidak ditindaklanjuti adalah temuan keselamatan tersendiri.

**Tabel 4.8. Alasan berhenti memakai aplikasi.**

| Alasan | n = 17 |
|---|---|
| Merasa sudah membaik sehingga tidak perlu mencatat | 5 (29,4%) |
| Bosan atau merasa mengisi setiap hari melelahkan | 4 (23,5%) |
| Kesulitan teknis, termasuk pengingat tidak berbunyi | 3 (17,6%) |
| Ponsel rusak, hilang, atau berganti | 2 (11,8%) |
| Kuota internet atau daya baterai | 2 (11,8%) |
| Tidak dapat dihubungi | 1 (5,9%) |

*Cara membacanya:* Tabel ini yang paling berguna bagi pengembangan lanjutan, dan datanya berasal dari wawancara singkat pada subbab 3.9 butir 6 — bukan dari aplikasi. Tanpa wawancara itu, kolom ini kosong.

---

## Yang tidak dapat dijawab penelitian ini

Perlu dinyatakan sekali lagi, sebab tabel yang rapi mudah membuat orang lupa.
Penelitian ini tanpa kelompok pembanding. Apabila SLEDAI-2K turun pada Tabel
4.4, penurunan itu dapat disebabkan oleh perjalanan alami penyakit, oleh
penyesuaian obat yang dilakukan dokter, oleh perhatian tambahan karena menjadi
peserta penelitian, atau memang oleh aplikasi. Rancangan ini tidak dapat
memisahkan keempatnya, dan naskah hasil harus mengatakannya secara terbuka.

Yang benar-benar dijawab penelitian ini hanyalah Tabel 4.3, yaitu apakah pasien
LES di RSUP H. Adam Malik bersedia dan mampu memakai aplikasi ini selama tiga
bulan. Tabel-tabel lain menggambarkan keadaan peserta selama periode itu, dan
menyiapkan angka untuk perhitungan besar sampel penelitian berikutnya.
