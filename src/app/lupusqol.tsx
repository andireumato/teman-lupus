import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import {
  Card,
  Disclaimer,
  InfoBar,
  Msg,
  PrimaryButton,
  Screen,
  SectionLabel,
  Segmented,
} from '@/components/ui/kit';
import { Brand, radius, space } from '@/constants/brand';
import { DISCLAIMER } from '@/constants/consent';
import {
  LABEL_TAK_BERLAKU,
  LUPUSQOL_DOMAIN,
  NILAI_MAKS,
  PERIODE_INGAT_MINGGU,
  TEKS_BUTIR,
  TEKS_PILIHAN,
  naskahTerpasang,
} from '@/constants/lupusqol';
import { todayISO } from '@/lib/dates';
import { butirBelumDijawab, skorLupusQol, type JawabanLupusQol } from '@/lib/lupusqol';
import { useSession } from '@/lib/session';
import { supabase } from '@/lib/supabase';

/**
 * LupusQoL — kuesioner kualitas hidup khusus SLE, diisi PASIEN.
 *
 * Layar ini sengaja tidak memuat teks butirnya. LupusQoL berhak cipta
 * (University of Central Lancashire & East Lancashire Hospitals NHS Trust,
 * dilisensikan lewat RWS Life Sciences) dan tidak boleh direproduksi tanpa izin
 * tertulis. Sampai izinnya turun, `naskahTerpasang()` bernilai false dan layar
 * ini menjelaskan keadaannya alih-alih menampilkan 34 baris kosong.
 *
 * Selebihnya sudah siap: penyimpanan, penghitungan skor, dan tampilan hasilnya
 * tidak perlu disentuh lagi saat naskah resminya dipasang.
 */
export default function LupusQolScreen() {
  const { patientId } = useSession();
  const siap = naskahTerpasang();

  const [jawaban, setJawaban] = useState<JawabanLupusQol>({});
  const [takBerlaku, setTakBerlaku] = useState<Set<string>>(new Set());
  const [tersimpan, setTersimpan] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const hasil = skorLupusQol(jawaban);
  const sisa = butirBelumDijawab(jawaban).filter((k) => !takBerlaku.has(k));

  function pilih(butir: string, v: number) {
    setTersimpan(false);
    setJawaban((prev) => ({ ...prev, [butir]: v }));
    setTakBerlaku((prev) => {
      if (!prev.has(butir)) return prev;
      const next = new Set(prev);
      next.delete(butir);
      return next;
    });
  }

  function toggleTakBerlaku(butir: string) {
    setTersimpan(false);
    setTakBerlaku((prev) => {
      const next = new Set(prev);
      if (next.has(butir)) next.delete(butir);
      else next.add(butir);
      return next;
    });
    // Jawaban angkanya ikut dihapus: "tidak berlaku" dan sebuah nilai adalah
    // dua jawaban yang saling bertentangan, dan menyimpan keduanya membuat
    // skornya bergantung pada urutan ketukan.
    setJawaban((prev) => ({ ...prev, [butir]: null }));
  }

  async function simpan() {
    if (!patientId) return;
    setErr(null);
    setBusy(true);

    // Hanya nilai yang sah yang dikirim; butir terlewat dan "tidak berlaku"
    // sengaja TIDAK dikirim sebagai null, supaya jsonb-nya hanya berisi jawaban
    // sungguhan dan tidak bisa disalahbaca sebagai nol.
    const isi: Record<string, number> = {};
    for (const [k, v] of Object.entries(jawaban)) {
      if (typeof v === 'number') isi[k] = v;
    }

    const { error } = await supabase.from('lupusqol_assessments').upsert(
      {
        patient_id: patientId,
        tanggal: todayISO(),
        jawaban: isi,
        tak_berlaku: [...takBerlaku],
      },
      // Satu penilaian per hari — instrumennya menanyakan 4 minggu terakhir,
      // jadi pengisian kedua di hari yang sama menimpa, bukan menambah.
      { onConflict: 'patient_id,tanggal' }
    );

    setBusy(false);
    if (error) {
      setErr(
        /lupusqol_assessments/.test(error.message)
          ? 'Tabel LupusQoL belum ada di database. Jalankan supabase/lupusqol.sql lebih dulu.'
          : `Gagal menyimpan: ${error.message}`
      );
      return;
    }
    setTersimpan(true);
  }

  if (!siap) return <BelumBerlisensi />;

  return (
    <Screen>
      <InfoBar>
        Pertanyaan berikut tentang {PERIODE_INGAT_MINGGU} minggu terakhir. Tidak ada jawaban benar
        atau salah — pilih yang paling mendekati keadaanmu.
      </InfoBar>

      {err && <Msg tone="err">{err}</Msg>}
      {tersimpan && <Msg tone="ok">Jawaban tersimpan.</Msg>}

      {LUPUSQOL_DOMAIN.map((d) => (
        <Card key={d.key}>
          <SectionLabel>{d.label}</SectionLabel>
          {Array.from({ length: d.jumlah }, (_, i) => {
            const butir = `${d.key}_${i + 1}`;
            const mati = takBerlaku.has(butir);
            return (
              <View key={butir} style={styles.butir}>
                <Text style={[styles.teks, mati && styles.teksMati]}>{TEKS_BUTIR[butir]}</Text>
                <Segmented
                  options={TEKS_PILIHAN.map((label, v) => ({ v, label }))}
                  value={mati ? null : ((jawaban[butir] as number | undefined) ?? null)}
                  onChange={(v) => pilih(butir, v)}
                />
                {d.bolehTakBerlaku && (
                  <Pressable
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: mati }}
                    onPress={() => toggleTakBerlaku(butir)}
                    style={styles.takBerlaku}
                  >
                    <Text style={[styles.takBerlakuTeks, mati && styles.takBerlakuOn]}>
                      {mati ? '✓ ' : ''}
                      {LABEL_TAK_BERLAKU}
                    </Text>
                  </Pressable>
                )}
              </View>
            );
          })}
        </Card>
      ))}

      {sisa.length > 0 && (
        <Msg tone="info">
          Masih ada {sisa.length} pertanyaan yang belum dijawab. Boleh disimpan sekarang dan
          dilanjutkan nanti — yang kosong tidak dihitung sebagai nol.
        </Msg>
      )}

      <PrimaryButton
        label={busy ? 'Menyimpan…' : 'Simpan jawaban'}
        onPress={() => void simpan()}
        loading={busy}
        disabled={hasil.terjawab === 0}
      />

      {hasil.terjawab > 0 && (
        <Card>
          <SectionLabel>Skor kamu</SectionLabel>
          <Text style={styles.ket}>
            Setiap domain bernilai 0–100. Makin tinggi makin baik — kebalikan dari skor aktivitas
            penyakit.
          </Text>
          {hasil.domain.map((d) => (
            <View key={d.key} style={styles.baris}>
              <Text style={styles.barisLabel}>{d.label}</Text>
              <Text style={styles.barisNilai}>
                {d.skor == null ? '—' : d.skor}
                <Text style={styles.barisKet}>
                  {'  '}
                  {d.terjawab}/{d.total}
                </Text>
              </Text>
            </View>
          ))}
        </Card>
      )}

      <Disclaimer>{DISCLAIMER}</Disclaimer>
    </Screen>
  );
}

/**
 * Keadaan sebelum lisensinya turun.
 *
 * Menjelaskan apa adanya alih-alih menyembunyikan layarnya: yang membaca ini
 * dokter yang memasang aplikasinya sendiri, dan ia perlu tahu persis apa yang
 * kurang dan ke mana memintanya.
 */
function BelumBerlisensi() {
  return (
    <Screen>
      <Msg tone="err">
        Kuesioner LupusQoL belum bisa dibuka karena naskah resminya belum dipasang.
      </Msg>

      <Card>
        <SectionLabel>Kenapa</SectionLabel>
        <Text style={styles.ket}>
          LupusQoL berhak cipta — University of Central Lancashire dan East Lancashire Hospitals NHS
          Trust — dan tidak boleh disalin atau diterjemahkan sebagian maupun seluruhnya tanpa izin
          tertulis. Karena itu teks pertanyaannya sengaja tidak ditanam di aplikasi ini.
        </Text>
        <Text style={styles.ket}>
          Gratis untuk peneliti akademik. Mintakan izinnya ke{' '}
          <Text style={styles.tebal}>LupusQoL@rws.com</Text> (RWS Life Sciences), lalu pasang naskah
          LupusQoL-ID di <Text style={styles.tebal}>src/constants/lupusqol.ts</Text>. Tidak ada
          berkas lain yang perlu diubah.
        </Text>
      </Card>

      <Card>
        <SectionLabel>Yang sudah siap</SectionLabel>
        <Text style={styles.ket}>
          Struktur {LUPUSQOL_DOMAIN.length} domain, penghitung skor 0–100, penyimpanan, dan kolom
          ekspor penelitian sudah terpasang dan teruji. Begitu teksnya masuk, layar ini langsung
          berfungsi.
        </Text>
        {LUPUSQOL_DOMAIN.map((d) => (
          <View key={d.key} style={styles.baris}>
            <Text style={styles.barisLabel}>{d.label}</Text>
            <Text style={styles.barisKet}>{d.jumlah} pertanyaan</Text>
          </View>
        ))}
        <Text style={styles.ket}>
          Skala {0}–{NILAI_MAKS} per pertanyaan, periode ingat {PERIODE_INGAT_MINGGU} minggu.
          Rujukan versi Indonesia: Anindito dkk., Indonesian Journal of Rheumatology
          2016;8(2):38–44.
        </Text>
      </Card>

      <Disclaimer>{DISCLAIMER}</Disclaimer>
    </Screen>
  );
}

const styles = StyleSheet.create({
  butir: { gap: 6, paddingVertical: space.xs },
  teks: { fontSize: 13.5, color: Brand.teks, lineHeight: 20 },
  teksMati: { color: Brand.teksLembut },
  takBerlaku: { paddingVertical: 6, minHeight: 32, justifyContent: 'center' },
  takBerlakuTeks: { fontSize: 12.5, color: Brand.teksLembut },
  takBerlakuOn: { color: Brand.ungu, fontWeight: '700' },
  ket: { fontSize: 12, color: Brand.teksLembut, lineHeight: 18 },
  tebal: { fontWeight: '700', color: Brand.teks },
  baris: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
    gap: space.sm,
    borderRadius: radius.sm,
  },
  barisLabel: { flex: 1, fontSize: 13, color: Brand.teks },
  barisNilai: { fontSize: 14, fontWeight: '700', color: Brand.teks },
  barisKet: { fontSize: 11.5, fontWeight: '400', color: Brand.teksLembut },
});
