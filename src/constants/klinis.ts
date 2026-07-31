/**
 * DATA KLINIS DASAR — pilihan yang diisi dokter di `/dokter/klinis/[id]`.
 *
 * Berbeda dari `SISTEM_GEJALA` di `lupus.ts`, yang berisi keluhan berbahasa
 * awam untuk dicentang PASIEN. Yang di sini adalah kesimpulan klinis: organ
 * mana yang pernah terbukti terlibat, dan kriteria klasifikasi mana yang
 * dipakai. Hanya dokter yang bisa menentukannya.
 *
 * ✅ DISAHKAN reumatolog penanggung jawab, 31 Juli 2026 — `KRITERIA_KLASIFIKASI`
 * dan `ORGAN_TERLIBAT` diterima apa adanya, tanpa perubahan. Keduanya semula
 * berstatus USULAN sejak disusun; sumbernya tercantum di masing-masing daftar
 * di bawah.
 *
 * Termasuk yang disahkan: domain `antifosfolipid`, yang BUKAN bagian dari
 * BILAG-2004 dan sempat ditawarkan untuk dicoret.
 *
 * Menambah, membuang, atau mengubah kata-katanya tetap keputusan reumatolog —
 * jangan menyuntingnya tanpa persetujuan, dan perbarui tanggal di atas bila
 * isinya berubah. Nilai `v` dan `key` TIDAK boleh diubah setelah tanggal ini:
 * keduanya sudah tersimpan di `patients.klasifikasi` dan
 * `patients.organ_terlibat`, dan ikut ke ekspor penelitian.
 */

/**
 * Jenis kelamin — diisi pasien di layar Profil.
 *
 * Dua pilihan, karena kolom ini untuk keperluan EPIDEMIOLOGI: SLE menyerang
 * perempuan jauh lebih sering, dan angka itu hanya bisa dihitung kalau
 * penyebutnya jelas. Ia sengaja TIDAK dipakai untuk keputusan terapi. Kalau
 * nanti dibutuhkan penilaian risiko kehamilan (mikofenolat teratogenik,
 * siklofosfamid gonadotoksik), yang menentukan adalah kemungkinan hamil dan
 * itu pertanyaan berbeda yang butuh kolomnya sendiri.
 */
export const JENIS_KELAMIN: { v: string; label: string }[] = [
  { v: 'perempuan', label: 'Perempuan' },
  { v: 'laki-laki', label: 'Laki-laki' },
];

export function labelJenisKelamin(v: string | null | undefined): string | null {
  if (!v) return null;
  return JENIS_KELAMIN.find((j) => j.v === v)?.label ?? v;
}

/**
 * Kriteria klasifikasi SLE yang lazim dipakai.
 *
 * Disimpan sebagai teks apa adanya di kolom `patients.klasifikasi`, jadi
 * baris lama dengan nilai lain tetap tampil utuh dan tidak hilang diam-diam
 * kalau daftar ini berubah.
 *
 * Catatan: ini kriteria KLASIFIKASI (untuk penelitian dan pelaporan), bukan
 * kriteria diagnosis. Pasien tanpa penanda apa pun di sini tetap bisa saja SLE
 * menurut penilaian klinis — itu sebabnya tersedia pilihan terakhir.
 */
export const KRITERIA_KLASIFIKASI: { v: string; ket: string }[] = [
  {
    v: 'EULAR/ACR 2019',
    ket: 'ANA ≥1:80 sebagai syarat masuk, lalu butir berbobot dari 7 domain klinis dan 3 imunologi; ambang ≥10.',
  },
  {
    v: 'SLICC 2012',
    ket: '≥4 kriteria (minimal 1 klinis dan 1 imunologi), atau nefritis lupus terbukti biopsi dengan ANA/anti-dsDNA positif.',
  },
  {
    v: 'ACR 1997',
    ket: '≥4 dari 11 kriteria, serentak maupun berurutan. Kriteria terlama, masih dipakai banyak kajian lama.',
  },
  {
    v: 'Diagnosis klinis',
    ket: 'Ditegakkan atas pertimbangan klinis tanpa memenuhi satu set kriteria klasifikasi pun.',
  },
];

export interface OrganTerlibat {
  /** Nilai yang tersimpan di `patients.organ_terlibat`. */
  key: string;
  label: string;
  ket: string;
  /**
   * Padanan `system` di `SISTEM_GEJALA` (lupus.ts), bila ada.
   *
   * Inilah yang membuat ringkasan bisa menandai gejala baru pada sistem organ
   * yang belum pernah tercatat terlibat. Domain tanpa padanan (`null`) tidak
   * akan pernah ikut penandaan itu — tidak ada gejala pasien yang memetakan ke
   * sana — tetapi tetap perlu tercatat sebagai riwayat.
   */
  sistem: string | null;
}

/**
 * Domain organ.
 *
 * Sembilan domain pertama mengikuti pembagian sistem BILAG-2004 (Isenberg DA,
 * dkk. Rheumatology 2005;44:902–6) — pembagian domain organ yang paling baku
 * pada SLE, sehingga catatan di sini bisa dibandingkan dengan literatur.
 *
 * Domain terakhir (antifosfolipid) BUKAN bagian BILAG; ditambahkan karena
 * trombosis dan morbiditas kehamilan mengubah tata laksana secara langsung dan
 * tidak punya rumah di domain mana pun. Ditawarkan untuk dicoret saat
 * pengesahan 31 Juli 2026 dan sengaja DIPERTAHANKAN.
 *
 * Konsekuensinya untuk analisis: sembilan domain pertama bisa dibandingkan
 * langsung dengan kajian berbasis BILAG-2004, yang kesepuluh tidak. Pisahkan
 * bila membandingkan dengan literatur.
 */
export const ORGAN_TERLIBAT: OrganTerlibat[] = [
  {
    key: 'konstitusional',
    label: 'Konstitusional',
    ket: 'Demam, penurunan berat badan, limfadenopati, kelelahan yang tidak dijelaskan sebab lain.',
    sistem: 'konstitusional',
  },
  {
    key: 'mukokutan',
    label: 'Mukokutan',
    ket: 'Lupus kutaneus akut/subakut/kronik, ulkus mukosa, alopesia, vaskulitis kulit, panikulitis.',
    sistem: 'kulit',
  },
  {
    key: 'muskuloskeletal',
    label: 'Muskuloskeletal',
    ket: 'Artritis, artropati Jaccoud, miositis, tendinitis, nekrosis avaskular.',
    sistem: 'sendi',
  },
  {
    key: 'ginjal',
    label: 'Ginjal',
    ket: 'Nefritis lupus. Sebutkan kelas biopsinya di catatan bila ada.',
    sistem: 'ginjal',
  },
  {
    key: 'neuropsikiatri',
    label: 'Neuropsikiatri',
    ket: 'Kejang, psikosis, sindrom otak organik, mielitis, neuropati kranial/perifer, stroke, meningitis aseptik.',
    sistem: 'saraf',
  },
  {
    key: 'kardiorespiratori',
    label: 'Jantung & paru',
    ket: 'Pleuritis, perikarditis, miokarditis, endokarditis, pneumonitis, penyakit paru interstisial, hipertensi pulmonal.',
    sistem: 'kardiopulmoner',
  },
  {
    key: 'hematologi',
    label: 'Hematologi',
    ket: 'Anemia hemolitik autoimun, trombositopenia, leukopenia/limfopenia, sindrom aktivasi makrofag.',
    sistem: 'darah',
  },
  {
    key: 'gastrointestinal',
    label: 'Gastrointestinal & hati',
    ket: 'Vaskulitis/enteritis lupus, peritonitis, pankreatitis, hepatitis autoimun, enteropati protein-losing.',
    sistem: null,
  },
  {
    key: 'oftalmik',
    label: 'Mata',
    ket: 'Vaskulitis retina, skleritis, episkleritis, neuritis optik, keratokonjungtivitis sika.',
    sistem: null,
  },
  {
    key: 'antifosfolipid',
    label: 'Antifosfolipid',
    ket: 'Trombosis arteri/vena atau morbiditas kehamilan dengan antibodi antifosfolipid persisten.',
    sistem: null,
  },
];

const PETA_ORGAN = new Map(ORGAN_TERLIBAT.map((o) => [o.key, o]));

/**
 * Label organ untuk ditampilkan.
 *
 * Kunci yang tak dikenal dikembalikan apa adanya, bukan dibuang: daftar di
 * atas bisa berubah, dan catatan lama tidak boleh lenyap dari layar tanpa ada
 * yang menyadarinya.
 */
export function labelOrgan(key: string): string {
  return PETA_ORGAN.get(key)?.label ?? key;
}

/** Kumpulan `system` gejala pasien yang tercakup oleh organ terlibat tercatat. */
export function sistemDariOrgan(organ: string[] | null | undefined): Set<string> {
  const out = new Set<string>();
  for (const k of organ ?? []) {
    const s = PETA_ORGAN.get(k)?.sistem;
    if (s) out.add(s);
  }
  return out;
}
