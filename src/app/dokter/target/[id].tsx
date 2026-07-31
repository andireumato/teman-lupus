import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { TargetChecklist } from '@/components/target-baris';
import {
  Card,
  Disclaimer,
  Field,
  GhostButton,
  InfoBar,
  Loading,
  Msg,
  PrimaryButton,
  Screen,
  SectionLabel,
  Segmented,
} from '@/components/ui/kit';
import { Brand, radius, space } from '@/constants/brand';
import { DISCLAIMER } from '@/constants/consent';
import { tanggalPendek, todayISO } from '@/lib/dates';
import {
  bacaAngka,
  kelengkapanTarget,
  nilaiDoris,
  nilaiLldas,
  penilaianSebelum,
  skorKlinis,
  type Kelengkapan,
} from '@/lib/target';
import { supabase } from '@/lib/supabase';
import type { SledaiAssessment } from '@/types/database';

/**
 * TARGET TERAPI — DORIS 2021 & LLDAS.
 *
 * Dipisah dari formulir SLEDAI-2K, tetapi MEMPERBARUI baris penilaian yang
 * sama: satu kunjungan = satu baris. PGA, dosis steroid, dan kestabilan terapi
 * adalah kolom pada `sledai_assessments`, bukan tabel tersendiri, karena
 * ketiganya tidak punya arti lepas dari skor kunjungan itu.
 *
 * Konsekuensinya ada urutan yang wajib: SLEDAI-2K dulu, baru target. Tanpa
 * baris penilaian tidak ada yang bisa diperbarui, dan layar ini mengatakannya
 * terus terang alih-alih diam-diam membuat baris baru tanpa deskriptor —
 * baris seperti itu akan terbaca sebagai "tidak ada aktivitas" dan melaporkan
 * remisi palsu.
 *
 * Sejak 31 Juli 2026 layar ini bisa melengkapi penilaian LAMA, bukan hanya yang
 * terbaru. Yang ikut berubah dan mudah terlewat: pembanding LLDAS harus
 * mengikuti penilaian yang DIPILIH, bukan selalu baris kedua dari daftar —
 * lihat `penilaianSebelum()` di lib/target.ts.
 */

const STABIL = [
  { v: 'ya', label: 'Ya, stabil' },
  { v: 'tidak', label: 'Belum' },
  { v: '', label: 'Belum dinilai' },
];

/** Sama dengan batas di layar ringkasan pasien, supaya daftarnya tidak berbeda. */
const BATAS = 10;

/**
 * Satu baris diambil MELEBIHI yang ditampilkan.
 *
 * Penilaian tertua yang tampil tetap butuh tetangganya untuk syarat LLDAS
 * "tidak ada aktivitas baru". Tanpa baris tambahan ini, `penilaianSebelum()`
 * mengembalikan null untuk baris itu — yang berarti "tanpa pembanding" dan
 * membuat syaratnya lolos otomatis, padahal pembandingnya ada dan hanya tidak
 * ikut terambil. Persis jenis kesalahan yang tidak memunculkan galat apa pun.
 */
const AMBIL = BATAS + 1;

const WARNA: Record<Kelengkapan, string> = {
  lengkap: Brand.hijau,
  sebagian: Brand.kuning,
  kosong: Brand.teksLembut,
};

const LABEL: Record<Kelengkapan, string> = {
  lengkap: 'lengkap',
  sebagian: 'sebagian',
  kosong: 'belum diisi',
};

type Baris = Pick<
  SledaiAssessment,
  | 'id'
  | 'tanggal'
  | 'deskriptor'
  | 'total'
  | 'kategori'
  | 'pga'
  | 'gc_mg'
  | 'terapi_stabil'
  | 'created_at'
>;

const teksAngka = (v: number | null | undefined) => (v == null ? '' : String(v));

export default function TargetScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<Baris[]>([]);
  const [dipilih, setDipilih] = useState<string | null>(null);
  const [pgaTeks, setPgaTeks] = useState('');
  const [gcTeks, setGcTeks] = useState('');
  const [stabil, setStabil] = useState<boolean | null>(null);
  const [pindahKe, setPindahKe] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const pga = bacaAngka(pgaTeks);
  const gcMg = bacaAngka(gcTeks);

  const aktif = rows.find((r) => r.id === dipilih) ?? null;

  // Pembanding LLDAS mengikuti penilaian yang DIPILIH. Memakai rows[1] apa
  // adanya — yang benar hanya saat mengedit penilaian terbaru — akan diam-diam
  // menjawab "tercapai" atau "tidak" untuk kunjungan yang salah.
  const sebelumnya = useMemo(
    () => (dipilih ? (penilaianSebelum(rows, dipilih)?.deskriptor ?? null) : null),
    [rows, dipilih]
  );

  // Angka yang salah ketik diperlakukan sebagai BELUM DIISI, bukan nol —
  // "0" dan "dua" tidak boleh berujung sama.
  const hasil = useMemo(() => {
    const masuk = {
      deskriptor: aktif?.deskriptor ?? {},
      pga: pga === undefined ? null : pga,
      gcMg: gcMg === undefined ? null : gcMg,
      terapiStabil: stabil,
      sebelumnya,
    };
    return { doris: nilaiDoris(masuk), lldas: nilaiLldas(masuk) };
  }, [aktif, pga, gcMg, stabil, sebelumnya]);

  // Dibandingkan NILAI hasil baca, bukan teksnya. Papan ketik Indonesia
  // memberi koma: "0,5" tersimpan sebagai 0.5, dan perbandingan teks akan
  // selamanya menganggapnya belum disimpan — lalu memunculkan peringatan
  // "perubahan belum disimpan" yang palsu setiap kali dokter berpindah baris.
  //
  // Angka yang salah ketik (`undefined`) sengaja dihitung sebagai berubah,
  // supaya tombol Simpan tetap hidup dan pesan galatnya sempat muncul.
  const kotor =
    aktif != null &&
    (pga !== (aktif.pga ?? null) ||
      gcMg !== (aktif.gc_mg ?? null) ||
      stabil !== (aktif.terapi_stabil ?? null));

  // Sekali saja: ini formulir, memuat ulang di tengah pengisian akan menimpa
  // ketikan dokter.
  const sudahDimuat = useRef(false);
  const muat = useCallback(async () => {
    if (!id || sudahDimuat.current) return;
    sudahDimuat.current = true;

    const { data, error } = await supabase
      .from('sledai_assessments')
      .select('id, tanggal, deskriptor, total, kategori, pga, gc_mg, terapi_stabil, created_at')
      .eq('patient_id', id)
      .order('tanggal', { ascending: false })
      .limit(AMBIL);

    if (error) {
      setErr(
        /pga|gc_mg|terapi_stabil/.test(error.message)
          ? 'Kolom PGA & dosis steroid belum ada di database. Jalankan supabase/target_doris_lldas.sql lebih dulu.'
          : error.message
      );
      setLoading(false);
      return;
    }

    const daftar = (data ?? []) as Baris[];
    setRows(daftar);
    if (daftar[0]) {
      setDipilih(daftar[0].id);
      isiFormulir(daftar[0]);
    }
    setLoading(false);
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      void muat();
    }, [muat])
  );

  function isiFormulir(b: Baris) {
    setPgaTeks(teksAngka(b.pga));
    setGcTeks(teksAngka(b.gc_mg));
    setStabil(b.terapi_stabil);
  }

  function pilih(idBaris: string) {
    if (idBaris === dipilih) return;
    setErr(null);
    setInfo(null);
    // Berpindah dengan isian yang belum disimpan akan membuang ketikan dokter
    // tanpa jejak. Ditahan sampai ia memilih sendiri.
    if (kotor) {
      setPindahKe(idBaris);
      return;
    }
    lanjutPindah(idBaris);
  }

  function lanjutPindah(idBaris: string) {
    const b = rows.find((r) => r.id === idBaris);
    if (!b) return;
    setPindahKe(null);
    setDipilih(idBaris);
    isiFormulir(b);
  }

  async function simpan() {
    if (!aktif) return;
    if (pga === undefined || gcMg === undefined) {
      setErr('PGA dan dosis steroid harus berupa angka, mis. 0,5 atau 5.');
      return;
    }
    setBusy(true);
    setErr(null);
    setInfo(null);

    const { error } = await supabase
      .from('sledai_assessments')
      .update({ pga, gc_mg: gcMg, terapi_stabil: stabil })
      .eq('id', aktif.id);

    setBusy(false);
    if (error) {
      setErr(`Gagal menyimpan: ${error.message}`);
      return;
    }

    // Salinan di layar ikut diperbarui, bukan dimuat ulang: memuat ulang akan
    // menimpa isian yang mungkin sedang diketik untuk penilaian lain, dan
    // lencana kelengkapan di daftar harus segar sekarang juga.
    setRows((prev) =>
      prev.map((r) => (r.id === aktif.id ? { ...r, pga, gc_mg: gcMg, terapi_stabil: stabil } : r))
    );
    setInfo(`Tersimpan pada penilaian ${tanggalPendek(aktif.tanggal)}.`);

    // Kalau tadi tertahan karena ada perubahan, lanjutkan perpindahannya.
    if (pindahKe) lanjutPindah(pindahKe);
  }

  if (loading) return <Loading />;

  if (!aktif) {
    return (
      <Screen>
        <Msg tone="info">
          Belum ada penilaian SLEDAI-2K untuk pasien ini. DORIS dan LLDAS dihitung dari skor
          kunjungan, jadi isi SLEDAI-2K lebih dulu.
        </Msg>
        {err && <Msg tone="err">{err}</Msg>}
        <PrimaryButton
          label="Isi SLEDAI-2K hari ini"
          onPress={() => router.replace(`/dokter/sledai/${id}`)}
        />
        <GhostButton label="Kembali" onPress={() => router.back()} />
      </Screen>
    );
  }

  const terbaru = rows[0]?.id === aktif.id;
  // Baris ke-(BATAS+1) hanya dipakai sebagai pembanding, tidak ditampilkan.
  const tampil = rows.slice(0, BATAS);
  const belumLengkap = tampil.filter((r) => kelengkapanTarget(r) !== 'lengkap').length;

  return (
    <Screen>
      <InfoBar>
        DORIS 2021 dan LLDAS bukan skor SLEDAI, melainkan definisi gabungan. Tiga isian di bawah
        melengkapi apa yang tidak bisa disimpulkan dari centang deskriptor.
      </InfoBar>

      {err && <Msg tone="err">{err}</Msg>}
      {info && <Msg tone="ok">{info}</Msg>}

      <Card>
        <SectionLabel>Penilaian mana yang dilengkapi</SectionLabel>
        <Text style={styles.ket}>
          {belumLengkap === 0
            ? 'Ketiga isian sudah lengkap di semua penilaian yang tampil.'
            : `${belumLengkap} dari ${tampil.length} penilaian belum lengkap. Ketuk untuk melengkapinya — termasuk kunjungan yang sudah lewat.`}
        </Text>
        {tampil.map((r) => {
          const on = r.id === aktif.id;
          const k = kelengkapanTarget(r);
          return (
            <Pressable
              key={r.id}
              accessibilityRole="radio"
              accessibilityState={{ selected: on }}
              accessibilityLabel={`Penilaian ${tanggalPendek(r.tanggal)}, ${LABEL[k]}`}
              onPress={() => pilih(r.id)}
              style={({ pressed }) => [styles.baris, on && styles.barisOn, pressed && styles.tekan]}
            >
              <View style={styles.barisKiri}>
                <Text style={[styles.barisTanggal, on && styles.barisTanggalOn]}>
                  {tanggalPendek(r.tanggal)}
                </Text>
                <Text style={styles.barisSkor}>
                  SLEDAI-2K {r.total ?? '—'} · {r.kategori ?? '—'}
                </Text>
              </View>
              <Text style={[styles.lencana, { color: WARNA[k] }]}>{LABEL[k]}</Text>
            </Pressable>
          );
        })}
        {rows.length > BATAS && (
          <Text style={styles.ket}>
            Menampilkan {BATAS} penilaian terbaru. Penilaian yang lebih lama tidak ikut di daftar
            ini.
          </Text>
        )}
      </Card>

      {pindahKe && (
        <Card>
          <Msg tone="err">
            Isian untuk {tanggalPendek(aktif.tanggal)} belum disimpan. Pindah sekarang akan
            membuangnya.
          </Msg>
          <PrimaryButton
            label="Simpan dulu, lalu pindah"
            onPress={() => void simpan()}
            loading={busy}
          />
          <GhostButton label="Buang perubahan & pindah" onPress={() => lanjutPindah(pindahKe)} />
          <GhostButton label="Batal, tetap di sini" onPress={() => setPindahKe(null)} />
        </Card>
      )}

      <Card>
        <SectionLabel>Melengkapi penilaian {tanggalPendek(aktif.tanggal)}</SectionLabel>
        <Text style={styles.skor}>
          SLEDAI-2K {aktif.total ?? '—'} · {aktif.kategori ?? '—'} · clinical SLEDAI-2K{' '}
          {skorKlinis(aktif.deskriptor)}
        </Text>
        <Text style={styles.ket}>
          {sebelumnya === null
            ? 'Penilaian paling awal yang tercatat — syarat LLDAS "tidak ada aktivitas baru" dinilai tanpa pembanding.'
            : `Dibandingkan dengan penilaian ${tanggalPendek(penilaianSebelum(rows, aktif.id)!.tanggal)} untuk syarat "tidak ada aktivitas baru".`}
        </Text>
        {terbaru && aktif.tanggal !== todayISO() && (
          <Msg tone="info">
            Ini penilaian terbaru pasien, bertanggal {tanggalPendek(aktif.tanggal)} — bukan hari
            ini. Kalau yang Anda maksud kunjungan hari ini, isi SLEDAI-2K baru lebih dulu.
          </Msg>
        )}
      </Card>

      <Card>
        <SectionLabel>Isian</SectionLabel>
        <Field
          label="PGA — penilaian global dokter (0–3)"
          value={pgaTeks}
          onChangeText={setPgaTeks}
          placeholder="mis. 0,5"
          keyboardType="numbers-and-punctuation"
        />
        <Field
          label="Glukokortikoid harian, setara prednison (mg)"
          value={gcTeks}
          onChangeText={setGcTeks}
          placeholder="mis. 5"
          keyboardType="numbers-and-punctuation"
        />
        <Text style={styles.ket}>
          Isi angka setara prednison. Konversinya sengaja tidak dihitung aplikasi — itu perhitungan
          klinis, dan angka yang Anda masukkan sendiri yang bisa diaudit.
        </Text>

        <Text style={styles.fieldLabel}>Imunosupresan &amp; biologik pada dosis pemeliharaan</Text>
        <Segmented
          options={STABIL}
          value={stabil === null ? '' : stabil ? 'ya' : 'tidak'}
          onChange={(v) => setStabil(v === '' ? null : v === 'ya')}
        />

        <PrimaryButton
          label={kotor ? 'Simpan' : 'Tersimpan'}
          onPress={() => void simpan()}
          loading={busy}
          disabled={!kotor}
        />
      </Card>

      <Card>
        <SectionLabel>Daftar syarat</SectionLabel>
        <Text style={styles.ket}>
          Bertanda SLEDAI-2K berarti diambil otomatis dari deskriptor yang sudah dicentang. Sisanya
          dari isian di atas.
        </Text>
        <TargetChecklist nama="DORIS 2021 — remisi" hasil={hasil.doris} />
        <TargetChecklist nama="LLDAS — aktivitas rendah" hasil={hasil.lldas} />
        <Text style={styles.ket}>
          Anemia hemolitik dan keluhan saluran cerna tidak punya deskriptor di SLEDAI-2K, jadi
          keduanya tidak ikut diperiksa di sini dan tetap pertimbangan Anda.
        </Text>
      </Card>

      <Text style={styles.catatan}>
        DORIS 2021: van Vollenhoven dkk., Lupus Sci Med 2021 (PMID 34819388). Kriteria operasional
        LLDAS dikutip lewat Parra Sánchez dkk., Rheumatol Ther 2023 (PMID 37798595).
      </Text>

      <Disclaimer>{DISCLAIMER}</Disclaimer>
    </Screen>
  );
}

const styles = StyleSheet.create({
  skor: { fontSize: 13.5, fontWeight: '700', color: Brand.ungu },
  ket: { fontSize: 11.5, color: Brand.teksLembut, lineHeight: 17 },
  fieldLabel: { fontSize: 12.5, fontWeight: '600', color: '#4b5563' },
  catatan: { fontSize: 11.5, color: Brand.teksLembut, lineHeight: 17 },
  baris: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space.sm,
    paddingVertical: 10,
    paddingHorizontal: space.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    backgroundColor: '#fff',
    minHeight: 48,
  },
  barisOn: { borderColor: Brand.ungu, backgroundColor: '#f5f3ff' },
  tekan: { opacity: 0.7 },
  barisKiri: { flex: 1, gap: 2 },
  barisTanggal: { fontSize: 13.5, fontWeight: '600', color: Brand.teks },
  barisTanggalOn: { color: Brand.ungu },
  barisSkor: { fontSize: 11.5, color: Brand.teksLembut },
  lencana: { fontSize: 11.5, fontWeight: '700' },
});
