# Gambar untuk proposal — sumber Mermaid

Empat bagan yang diminta *Panduan Penulisan Disertasi* FK USU. Sumbernya
disimpan di sini supaya ikut terlacak bersama proposal; bila isi proposal
berubah, terlihat bahwa bagannya perlu ikut berubah.

## Berkas di folder ini

| Sumber | Hasil | Untuk |
|---|---|---|
| `gambar-2-1.mmd` | `.svg` · `.png` | Kerangka teori |
| `gambar-2-2.mmd` | `.svg` · `.png` | Kerangka konsep |
| `gambar-3-1.mmd` | `.svg` · `.png` | Alur rekrutmen dan persetujuan |
| `gambar-3-2.mmd` | `.svg` · `.png` | Alur pemantauan dan analisis |

Berkas jadi sudah tersedia, jadi tidak perlu dibuat ulang kecuali bagannya
disunting. PNG dibuat pada skala tiga kali dengan latar putih sehingga tetap
tajam saat dicetak.

---

## Cara membuat ulang setelah menyunting

**Tanpa memasang apa pun.** Buka https://mermaid.live, hapus contoh di kotak
kiri, tempel isi berkas `.mmd`, lalu klik **Actions** dan pilih **SVG** atau
**PNG**. Pilih SVG bila akan dicetak, sebab SVG tidak pecah saat diperbesar dan
dapat disisipkan langsung ke Word.

**Di komputer sendiri.**

```bash
cd penelitian/gambar
npx -y @mermaid-js/mermaid-cli@11 -i gambar-3-1.mmd -o gambar-3-1.svg
npx -y @mermaid-js/mermaid-cli@11 -i gambar-3-1.mmd -o gambar-3-1.png -s 3 -b white
```

---

## Ketentuan panduan saat menempel ke Word

1. Judul gambar diletakkan **di bawah** gambar, **tanpa** titik di akhir, huruf
   kapital hanya pada awal kalimat.
2. Nomor gambar mengikuti bab, yaitu Gambar 2.1, Gambar 2.2, Gambar 3.1, dan
   Gambar 3.2.
3. Setiap gambar wajib dirujuk dalam teks.
4. Gambar tidak boleh dipenggal antarhalaman.
5. Judul dan keterangan gambar memakai Times New Roman ukuran 10.

Karena judul harus di bawah gambar, **judul jangan dimasukkan ke dalam bagan**;
ketik sebagai teks biasa di Word tepat di bawah gambarnya.

### Lebar yang disarankan

Lebar bidang ketik A4 dengan margin panduan adalah 14 cm, dan tinggi bidang
ketik 23,7 cm. Angka di bawah sudah menyisakan ruang bagi judul gambar.

| Gambar | Rasio | Lebar disarankan | Tinggi jadinya |
|---|---|---|---|
| 2.1 | 1 : 0,66 | 14 cm | 9,2 cm |
| 2.2 | 1 : 0,68 | 14 cm | 9,5 cm |
| 3.1 | 1 : 1,72 | 12 cm | 20,6 cm |
| 3.2 | 1 : 1,84 | 11 cm | 20,2 cm |

Gambar 3.1 dan 3.2 masing-masing memenuhi hampir satu halaman penuh. Keduanya
sengaja dipisah, sebab digabung menjadi satu bagan menghasilkan tinggi sekitar
28 cm yang pasti terpenggal antarhalaman.

---

## Gambar 2.1 — Kerangka teori

Judul yang diketik di bawah gambar:

> Gambar 2.1 Kerangka teori kesenjangan informasi antarkunjungan pada lupus
> eritematosus sistemik

```mermaid
flowchart TD
    A["Aktivitas penyakit LES<br/>berfluktuasi harian"]
    B["Penilaian klinis hanya<br/>pada kunjungan berkala"]
    C["Kesenjangan informasi<br/>antarkunjungan"]
    D["Bias mengingat kembali"]
    E["Ketidakpatuhan minum obat<br/>tidak terdeteksi"]
    F["Pemantauan mandiri harian<br/>berpotensi memperkecil kesenjangan"]
    G["Syarat: pasien bersedia dan mampu<br/>memakai secara berkelanjutan"]
    H["Kelayakan dan penerimaan<br/>TITIK MASUK PENELITIAN INI"]

    A --> C
    B --> C
    D --> C
    E --> C
    C --> F
    F --> G
    G --> H

    classDef masalah fill:#fdecea,stroke:#c0392b,stroke-width:1px,color:#111
    classDef antara fill:#fff6e5,stroke:#d68910,stroke-width:1px,color:#111
    classDef fokus fill:#eae6fb,stroke:#5b3cc4,stroke-width:2px,color:#111
    class A,B,D,E masalah
    class C,F,G antara
    class H fokus
```

---

## Gambar 2.2 — Kerangka konsep

Judul yang diketik di bawah gambar:

> Gambar 2.2 Kerangka konsep penelitian

```mermaid
flowchart LR
    subgraph BEBAS["VARIABEL BEBAS"]
        X["Penggunaan aplikasi<br/>Teman Lupus<br/>selama 3 bulan"]
    end

    subgraph UTAMA["VARIABEL TERGANTUNG UTAMA"]
        Y1["Kelayakan dan penerimaan"]
        Y1a["Retensi peserta"]
        Y1b["Kelengkapan pengisian"]
    end

    subgraph SEKUNDER["VARIABEL TERGANTUNG SEKUNDER"]
        Y2["Aktivitas penyakit<br/>SLEDAI-2K"]
        Y3["Kepatuhan minum obat"]
        Y4["Pola keluhan harian"]
    end

    subgraph PERANCU["VARIABEL PERANCU YANG DICATAT"]
        Z["Usia · Jenis kelamin · Lama sakit<br/>Tingkat pendidikan · Organ terlibat<br/>Dosis glukokortikoid"]
    end

    X --> Y1
    Y1 --- Y1a
    Y1 --- Y1b
    X --> Y2
    X --> Y3
    X --> Y4
    Z -.pengaruh.-> Y1
    Z -.pengaruh.-> Y2
    Z -.pengaruh.-> Y3

    classDef bebas fill:#eae6fb,stroke:#5b3cc4,stroke-width:2px,color:#111
    classDef utama fill:#e6f4ea,stroke:#1e8449,stroke-width:2px,color:#111
    classDef sekunder fill:#e8f1fb,stroke:#2471a3,stroke-width:1px,color:#111
    classDef perancu fill:#f4f4f4,stroke:#7f8c8d,stroke-dasharray:4,color:#111
    class X bebas
    class Y1,Y1a,Y1b utama
    class Y2,Y3,Y4 sekunder
    class Z perancu
```

---

## Gambar 3.1 — Alur rekrutmen dan persetujuan

Judul dan keterangan yang diketik di bawah gambar:

> Gambar 3.1 Alur rekrutmen dan persetujuan
>
> Keterangan: peserta yang menolak persetujuan penelitian tetap terdaftar dan
> dapat memakai seluruh fitur aplikasi; hanya datanya yang tidak disertakan
> dalam analisis. Penolakan tidak memengaruhi pelayanan medis yang diterima.

```mermaid
---
config:
  flowchart:
    rankSpacing: 32
    nodeSpacing: 28
---
flowchart TD
    A["Pasien LES rawat jalan"]
    B{"Memenuhi kriteria?"}
    Bx["Tidak disertakan"]
    C["Penjelasan lisan dan tertulis"]
    D{"Persetujuan pemakaian<br/>WAJIB"}
    Dx["Tidak ikut serta"]
    E{"Persetujuan penelitian<br/>OPSIONAL"}
    E1["Data ikut analisis"]
    E2["Data tidak ikut analisis"]
    Z["Peserta terdaftar"]

    A --> B
    B -- Tidak --> Bx
    B -- Ya --> C
    C --> D
    D -- Tidak --> Dx
    D -- Ya --> E
    E -- Ya --> E1
    E -- Tidak --> E2
    E1 --> Z
    E2 --> Z

    classDef keluar fill:#fdecea,stroke:#c0392b,stroke-width:1px,color:#111
    classDef tanya fill:#fff6e5,stroke:#d68910,stroke-width:1px,color:#111
    classDef proses fill:#e8f1fb,stroke:#2471a3,stroke-width:1px,color:#111
    classDef hasil fill:#e6f4ea,stroke:#1e8449,stroke-width:2px,color:#111
    class Bx,Dx keluar
    class B,D,E tanya
    class A,C,E1,E2 proses
    class Z hasil
```

---

## Gambar 3.2 — Alur pemantauan dan analisis

Judul dan keterangan yang diketik di bawah gambar:

> Gambar 3.2 Alur pemantauan dan analisis
>
> Keterangan: penilaian awal T0 meliputi data klinis dasar, SLEDAI-2K, PGA,
> dosis glukokortikoid, dan MARS-5; penilaian akhir T3 mengulang seluruhnya.
> Pemantauan meliputi catatan harian mandiri, penyaringan tanda bahaya bila ada
> keluhan, dan kuesioner yang diulang tiap bulan. Ekspor menghasilkan empat
> belas berkas CSV tanpa identitas dan hanya memuat peserta yang menyetujui
> penelitian.

```mermaid
---
config:
  flowchart:
    rankSpacing: 32
    nodeSpacing: 28
---
flowchart TD
    Z["Peserta terdaftar"]
    F["Penilaian awal T0"]
    G["Pemantauan bulan pertama sampai ketiga"]
    H{"Masih aktif pada bulan ketiga?"}
    Hx["Wawancara hambatan penggunaan"]
    I["Penilaian akhir T3"]
    J["Ekspor tanpa identitas"]
    K["Analisis univariat dan bivariat"]

    Z --> F
    F --> G
    G --> H
    H -- Tidak --> Hx
    H -- Ya --> I
    Hx --> J
    I --> J
    J --> K

    classDef tanya fill:#fff6e5,stroke:#d68910,stroke-width:1px,color:#111
    classDef proses fill:#e8f1fb,stroke:#2471a3,stroke-width:1px,color:#111
    classDef hasil fill:#e6f4ea,stroke:#1e8449,stroke-width:2px,color:#111
    class H tanya
    class Z,F,G,I,Hx proses
    class J,K hasil
```

---

## Catatan isi yang sengaja ditampilkan

**Gambar 3.1 menggambar dua persetujuan sebagai dua percabangan terpisah.**
Percabangan kedua tidak mengeluarkan peserta, melainkan hanya menentukan apakah
datanya ikut analisis; kedua cabangnya sama-sama bermuara pada "Peserta
terdaftar". Inilah gambaran paling ringkas bahwa keikutsertaan penelitian
benar-benar bersifat sukarela, dan hal itulah yang paling ingin dilihat penelaah
etik.

**Peserta yang berhenti tetap masuk alur pada Gambar 3.2.** Anak panah dari
wawancara hambatan menuju ekspor data memperlihatkan bahwa mereka tidak hilang
begitu saja; alasan berhenti justru salah satu tujuan khusus penelitian.

**Variabel perancu pada Gambar 2.2 digambar dengan garis putus-putus** karena
hanya dicatat, bukan dikendalikan. Rancangan ini tidak memiliki kelompok
pembanding.

**Rincian sengaja dipindahkan dari kotak ke keterangan gambar.** Kotak berisi
empat baris teks membuat bagan menjadi terlalu tinggi untuk satu halaman, dan
panduan melarang gambar dipenggal. Panduan membolehkan keterangan ditulis di
bawah gambar secukupnya, sehingga isinya tidak hilang.
