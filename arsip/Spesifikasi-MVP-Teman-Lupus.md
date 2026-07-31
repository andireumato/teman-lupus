# Spesifikasi MVP — "Teman Lupus"
### Agent pendamping pasien SLE + ringkasan pra-kunjungan

**Versi:** 0.1 (MVP) · **Konteks:** Indonesia, berbahasa Indonesia · **Pengguna:** pasien SLE (antar-kunjungan) + reumatolog (penerima ringkasan)

> Dokumen ini bersifat *framework-agnostic*: alur percakapan, aturan red-flag, dan skema data di bawah dapat diimplementasikan di agent framework apa pun. Bagian yang ditandai **[DETERMINISTIK]** wajib diimplementasi sebagai logika berbasis aturan/kode, **bukan** diserahkan ke pertimbangan bebas model bahasa.

---

## 1. Tujuan MVP (sengaja dibatasi)

MVP hanya melakukan **dua hal inti**:
1. **Check-in gejala terstruktur** secara berkala (mingguan) + jalur "saya tidak enak badan" sewaktu-waktu.
2. **Ringkasan pra-kunjungan** otomatis untuk klinisi.

Fitur red-flag triage masuk MVP karena menyangkut keselamatan. PRO tervalidasi penuh, prediksi flare, dan integrasi rekam medis → fase berikutnya (lihat Roadmap).

**Yang TIDAK dilakukan MVP:** memberi diagnosis, menilai SLEDAI/BILAG secara mandiri, mengubah/menyarankan dosis obat, menafsirkan hasil lab. Agent adalah **pencatat + penyaring (triage)**, bukan pengambil keputusan klinis.

---

## 2. Prinsip keamanan (tidak bisa ditawar)

1. **Tidak mendiagnosis, tidak mengubah terapi.** Setiap kali pasien menanyakan "apakah ini lupus kambuh?" atau "apakah obat saya perlu ditambah?", agent menjawab bahwa hal itu hanya bisa dinilai oleh dokter, lalu mencatat pertanyaannya untuk dibawa ke kunjungan.
2. **Triage keselamatan = [DETERMINISTIK].** Keputusan "ini perlu kontak darurat" ditentukan oleh aturan eksplisit (Bagian 6), bukan oleh model. Model hanya menangani bahasa natural & empati.
3. **Selalu ada jalur keluar ke manusia.** Di titik mana pun pasien bisa diarahkan menghubungi layanan/IGD.
4. **Fail-safe, bukan fail-silent.** Jika ragu antara aman dan tidak aman, agent memilih mengeskalasi.
5. **Transparan.** Pasien diberitahu di awal: ini alat bantu pemantauan, bukan pengganti dokter, dan tidak untuk keadaan darurat (untuk darurat → langsung IGD).

---

## 3. Komponen sistem

```
[Pasien] ──chat──> [Agent]
                      │
       ┌──────────────┼───────────────┐
       │              │               │
   Onboarding    Check-in &      Red-flag engine
   & consent     symptom log     [DETERMINISTIK]
       │              │               │
       └──────────────┼───────────────┘
                      ▼
              [Data store terstruktur]
                      │
                      ▼
        [Generator ringkasan pra-kunjungan] ──> [Reumatolog]
```

---

## 4. Alur percakapan

### 4.1 Onboarding (sekali di awal)
- Sapaan + penjelasan tujuan & batasan (poin keamanan #5).
- **Informed consent** eksplisit: pasien menyetujui pencatatan gejala & berbagi ringkasan dengan dokternya. Catat tanggal & versi consent.
- Data dasar minimal: nama/inisial, ID pasien, dokter penanggung jawab, daftar obat saat ini (untuk pertanyaan kepatuhan), tanggal kunjungan berikutnya.
- Tetapkan jadwal check-in (default: mingguan) + pengingat obat opsional.

### 4.2 Check-in mingguan (target ≤ 2–3 menit)
Singkat dan ramah. Urutan:
1. PRO singkat (lihat Bagian 7 — gunakan instrumen pendek 10 item).
2. Skrining gejala per sistem (Bagian 5) — hanya tanya detail bila pasien menandai ada keluhan.
3. Kepatuhan obat: "Minggu ini, apakah ada dosis yang terlewat?" + efek samping baru.
4. **[DETERMINISTIK]** Jalankan red-flag engine atas semua jawaban.
5. Tutup: "Ada yang ingin Anda tanyakan ke dokter saat kontrol nanti?" → simpan sebagai *daftar pertanyaan pasien*.

### 4.3 Jalur "saya tidak enak badan" (kapan saja)
- Pasien bisa memicu ini sewaktu-waktu, tanpa menunggu jadwal.
- Langsung ke skrining gejala + red-flag engine.
- Jika red-flag positif → pesan eskalasi (Bagian 6). Jika tidak → catat, beri pesan menenangkan yang netral ("keluhan Anda sudah dicatat untuk dibahas saat kontrol; bila memburuk, hubungi..."), tanpa menafsirkan.

---

## 5. Daftar gejala terstruktur (bahasa awam → sistem organ)

Untuk tiap gejala yang ditandai "ada": tanyakan **derajat** (ringan/sedang/berat atau skala 0–10) dan **perubahan** (baru / membaik / sama / memburuk).

| Sistem | Pertanyaan ke pasien (bahasa awam) |
|---|---|
| Konstitusional | kelelahan luar biasa; demam; penurunan berat badan |
| Kulit & mukosa | ruam (terutama wajah/pipi, muncul kena matahari); sariawan; rambut rontok; jari memutih/membiru saat dingin (Raynaud) |
| Sendi & otot | nyeri sendi; bengkak sendi; kaku saat bangun pagi; nyeri otot |
| Ginjal | bengkak di kaki/kelopak mata; urin berbusa; jumlah/frekuensi BAK berubah |
| Jantung–paru | nyeri dada; sesak napas |
| Saraf | sakit kepala hebat; kejang; bingung/sulit fokus; gangguan penglihatan; kebas/lemah satu sisi |
| Darah | mudah memar; perdarahan tak biasa; tampak pucat/lemas |
| Mood & tidur | suasana hati; kualitas tidur |

Catatan: daftar ini untuk **pemantauan & triage**, bukan untuk menghitung skor aktivitas penyakit secara mandiri.

---

## 6. Red-flag engine — [DETERMINISTIK]

Aturan eksplisit. Jika **salah satu** terpenuhi → tampilkan **pesan eskalasi** + tandai event di data store + (opsional, fase 2) notifikasi ke tim klinis.

**Aturan eskalasi DARURAT (arahkan ke IGD sekarang):**
- Nyeri dada + sesak napas
- Sesak napas berat / sulit bernapas
- Kejang, atau bingung/penurunan kesadaran baru
- Kelemahan/kebas mendadak satu sisi tubuh, bicara pelo, atau gangguan penglihatan mendadak
- Demam tinggi pada pasien yang sedang minum imunosupresan/steroid dosis signifikan (risiko infeksi serius)
- Tanda perdarahan signifikan atau memar luas mendadak

**Aturan eskalasi MENDESAK (hubungi tim/klinik dalam ≤24 jam, jangan menunggu jadwal):**
- Bengkak baru di kaki/wajah + urin berbusa atau jumlah urin menurun (kemungkinan keterlibatan ginjal — **dicatat sebagai keluhan, bukan diagnosis**)
- Demam tanpa penyebab jelas
- Nyeri/bengkak betis satu sisi (kewaspadaan trombosis, relevan pada SLE/APS)
- Gejala yang konsisten **memburuk** beberapa hari berturut-turut

**Format pesan eskalasi (template):**
> "Beberapa keluhan yang Anda sampaikan termasuk yang sebaiknya **tidak ditunda**. Mohon segera [hubungi tim dokter Anda / ke IGD terdekat]. Saya bukan pengganti penilaian dokter, jadi keputusan medis tetap di tangan tenaga kesehatan. Keluhan ini sudah saya catat."

> ⚠️ Daftar di atas adalah **kerangka awal** yang harus Anda (reumatolog) review dan sesuaikan sebelum dipakai ke pasien nyata. Ambang "demam tinggi", definisi "dosis signifikan", dll. perlu Anda tetapkan.

---

## 7. Patient-Reported Outcome (PRO) — pilihan instrumen

Untuk MVP, pakai **satu instrumen pendek** sebagai jangkar kuantitatif:

- **Pilihan ringan (disarankan untuk MVP):** instrumen 10-item yang memang dirancang untuk pemantauan rutin & cepat (mis. *Lupus Impact Tracker*). Cocok untuk diulang mingguan tanpa membebani pasien.
- **Alternatif lebih lengkap (fase 2):** *SLAQ* (aktivitas penyakit menurut pasien) atau *LupusPRO* (kualitas hidup terkait kesehatan).

**Catatan validasi penting:** sebelum dipakai untuk riset, pastikan tersedia **versi Bahasa Indonesia yang sudah divalidasi**. Bila belum ada, proses adaptasi lintas-budaya & validasi instrumen itu sendiri **layak jadi sub-studi tersendiri dan dapat dipublikasikan** — sebaiknya dikerjakan sebelum data PRO dipakai sebagai luaran formal.

---

## 8. Format ringkasan pra-kunjungan (untuk reumatolog)

Dihasilkan otomatis sebelum jadwal kontrol. Satu halaman, padat:

```
RINGKASAN PRA-KUNJUNGAN — [Inisial pasien] · ID [....]
Periode: [tanggal] s/d [tanggal] · Jumlah check-in: [n]

1. SKOR PRO
   - Skor terkini: [x] · Tren: [naik/turun/stabil] (mis. 12 → 15 → 14 → 18)

2. GEJALA MENONJOL (per sistem)
   - Baru muncul: ...
   - Menetap/memburuk: ...
   - Membaik: ...

3. INDIKATOR FLARE (pengamatan, bukan diagnosis)
   - [mis. nyeri sendi + ruam + kelelahan meningkat bersamaan sejak minggu ke-2]

4. KEPATUHAN & EFEK SAMPING OBAT
   - Dosis terlewat: [jumlah, obat apa]
   - Efek samping dilaporkan: ...

5. EVENT RED-FLAG
   - [tanggal] [keluhan] → [dieskalasi: ya/tidak] → [tindak lanjut pasien jika diketahui]

6. PERTANYAAN/KEKHAWATIRAN PASIEN UNTUK KUNJUNGAN INI
   - ...

7. PENGINGAT PEMANTAUAN (fase 2)
   - [mis. skrining mata hidroksiklorokuin jatuh tempo; lab rutin]
```

---

## 9. Skema data (contoh JSON)

```json
{
  "patient": {
    "id": "SLE-0001",
    "physician": "dr. ...",
    "consent": { "given": true, "date": "2026-06-28", "version": "0.1" },
    "medications": ["hidroksiklorokuin 200mg", "..."],
    "next_visit": "2026-07-20"
  },
  "checkins": [
    {
      "timestamp": "2026-06-28T09:00:00+07:00",
      "type": "weekly",
      "pro_score": 14,
      "symptoms": [
        { "system": "joint", "item": "nyeri sendi", "present": true,
          "severity": 6, "change": "memburuk" }
      ],
      "adherence": { "missed_doses": 1, "which": "hidroksiklorokuin" },
      "side_effects": [],
      "red_flags": [],
      "patient_questions": ["Apakah boleh berjemur pagi?"]
    }
  ]
}
```

Field `red_flags` mencatat aturan mana yang terpicu, tingkat (darurat/mendesak), dan apakah pesan eskalasi sudah ditampilkan.

---

## 10. Roadmap bertahap

- **MVP (sekarang):** onboarding+consent, check-in mingguan, daftar gejala, red-flag deterministik, ringkasan pra-kunjungan. Uji ke **5–10 pasien sukarelawan**.
- **v2:** PRO tervalidasi Indonesia; pengingat pemantauan (mata HCQ, lab, vaksinasi, tapering steroid); notifikasi red-flag ke tim klinis.
- **v3 / riset:** registry PRO longitudinal; studi validasi (akurasi ringkasan vs penilaian Anda; sensitivitas red-flag); eksplorasi apakah pola PRO memprediksi flare; konseling rencana kehamilan terstruktur.

---

## 11. Checklist etik & privasi (urus di awal)

- [ ] Informed consent tertulis (pasien & pemakaian data untuk riset bila relevan).
- [ ] Ethical clearance dari komite etik institusi sebelum data dipakai untuk penelitian.
- [ ] Kepatuhan UU Perlindungan Data Pribadi: penyimpanan aman, akses terbatas, enkripsi, kebijakan retensi & penghapusan.
- [ ] Minimisasi data: hanya kumpulkan yang perlu; pertimbangkan de-identifikasi untuk analisis.
- [ ] Disclaimer jelas: bukan alat darurat, bukan pengganti dokter.

---

## 12. Metrik keberhasilan MVP

- **Kelayakan:** % pasien yang menyelesaikan ≥ 4 check-in mingguan berturut (engagement adalah titik gagal utama aplikasi penyakit kronis).
- **Kegunaan klinis:** apakah ringkasan benar-benar menghemat waktu & dipakai di poli (tanya pendapat Anda sendiri secara terstruktur).
- **Keamanan:** sensitivitas red-flag (apakah ada keluhan serius yang lolos?) — dievaluasi dengan meninjau ulang transkrip bersama Anda.
- **Akurasi ringkasan:** kesesuaian ringkasan agent dengan catatan klinis Anda.
```
