import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import {
  Card,
  Disclaimer,
  Field,
  InfoBar,
  Loading,
  Msg,
  Screen,
  SectionLabel,
  SegmentedVertical,
} from '@/components/ui/kit';
import { Brand, radius, space } from '@/constants/brand';
import { DISCLAIMER } from '@/constants/consent';
import { KONDISI, TINDAKAN } from '@/constants/tindak-lanjut';
import { tanggalPendek } from '@/lib/dates';
import { useSession } from '@/lib/session';
import { supabase } from '@/lib/supabase';
import {
  barisTindakLanjut,
  jamRespons,
  kondisiTerkunci,
  periksaTindakLanjut,
  sesuaikanKondisi,
} from '@/lib/tindak-lanjut';
import type { Alert, AlertTindakLanjut, Patient, Profile } from '@/types/database';

/**
 * Tabel, kolom, dan fungsi baru belum tentu ada di project Supabase lama.
 *
 * Pesannya menyebut nama berkasnya, bukan sekadar "gagal": yang membaca layar
 * ini adalah dokter yang memasang aplikasinya sendiri, dan galat mentah
 * PostgREST tidak memberi tahu apa yang harus dilakukan.
 */
function pesanSkema(pesan: string): string {
  if (pesan.includes('flare_check_id')) {
    return 'Skema peringatan belum diperbarui di Supabase. Jalankan supabase/alerts_kunjungan.sql di SQL Editor.';
  }
  if (/tutup_alert|alert_tindak_lanjut/.test(pesan)) {
    return 'Pencatatan tindak lanjut belum ada di database. Jalankan supabase/tindak_lanjut_alert.sql di SQL Editor.';
  }
  return pesan;
}

interface BarisPeringatan {
  alert: Alert;
  patientId: string;
  nama: string;
  lanjut: AlertTindakLanjut | null;
}

export default function PeringatanScreen() {
  const { session } = useSession();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<BarisPeringatan[]>([]);
  const [selesai, setSelesai] = useState<BarisPeringatan[]>([]);
  const [err, setErr] = useState<string | null>(null);

  // Formulir penutup, satu yang terbuka pada satu waktu. Isinya sengaja TIDAK
  // disimpan per-kartu: dua formulir setengah terisi yang tertukar isinya
  // adalah cara paling mudah mencatat keluaran klinis pada pasien yang salah.
  const [buka, setBuka] = useState<string | null>(null);
  const [tindakan, setTindakan] = useState<string | null>(null);
  const [kondisi, setKondisi] = useState<string | null>(null);
  const [catatan, setCatatan] = useState('');
  const [simpan, setSimpan] = useState(false);

  const muat = useCallback(async () => {
    const doctorId = session?.user.id;
    if (!doctorId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setErr(null);

    const { data: pasien, error: ep } = await supabase
      .from('patients')
      .select('id,profile_id')
      .eq('doctor_id', doctorId);

    if (ep) {
      setErr(`Gagal memuat pasien: ${ep.message}`);
      setLoading(false);
      return;
    }

    const daftar = (pasien ?? []) as Pick<Patient, 'id' | 'profile_id'>[];
    if (daftar.length === 0) {
      setRows([]);
      setSelesai([]);
      setLoading(false);
      return;
    }

    const [al, prof] = await Promise.all([
      supabase
        .from('alerts')
        .select('*')
        .in(
          'patient_id',
          daftar.map((p) => p.id)
        )
        .order('created_at', { ascending: false })
        .limit(100),
      supabase
        .from('profiles')
        .select('id,nama')
        .in(
          'id',
          daftar.map((p) => p.profile_id)
        ),
    ]);

    if (al.error) {
      setErr(pesanSkema(`Gagal memuat peringatan: ${al.error.message}`));
      setLoading(false);
      return;
    }

    const peringatan = (al.data ?? []) as Alert[];

    // Tindak lanjutnya diambil terpisah, dan kegagalannya TIDAK menggagalkan
    // layar: tabelnya baru, dan kotak masuk peringatan harus tetap terbuka di
    // project yang belum menjalankan skripnya.
    const tl = await supabase
      .from('alert_tindak_lanjut')
      .select('*')
      .in(
        'alert_id',
        peringatan.map((a) => a.id)
      );

    const lanjutPerAlert = new Map(
      ((tl.data ?? []) as AlertTindakLanjut[]).map((t) => [t.alert_id, t])
    );

    const nama = new Map(
      ((prof.data ?? []) as Pick<Profile, 'id' | 'nama'>[]).map((p) => [p.id, p.nama])
    );
    const profilPerPasien = new Map(daftar.map((p) => [p.id, p.profile_id]));

    const semua: BarisPeringatan[] = peringatan.map((a) => ({
      alert: a,
      patientId: a.patient_id,
      nama: nama.get(profilPerPasien.get(a.patient_id) ?? '') ?? 'Tanpa nama',
      lanjut: lanjutPerAlert.get(a.id) ?? null,
    }));

    setRows(semua.filter((r) => !r.alert.selesai));
    setSelesai(semua.filter((r) => r.alert.selesai).slice(0, 20));
    setLoading(false);
  }, [session?.user.id]);

  useFocusEffect(
    useCallback(() => {
      void muat();
    }, [muat])
  );

  function mulaiTutup(r: BarisPeringatan) {
    setErr(null);
    setBuka(r.alert.id);
    setTindakan(null);
    setKondisi(null);
    setCatatan('');
  }

  function pilihTindakan(v: string) {
    setTindakan(v);
    // Kondisi ikut disesuaikan seketika, supaya kombinasi yang mustahil tidak
    // pernah sempat terbentuk di layar.
    setKondisi((k) => sesuaikanKondisi(v, k));
  }

  async function tutup(r: BarisPeringatan) {
    const cek = periksaTindakLanjut(tindakan, kondisi);
    if (!cek.ok) {
      setErr(cek.pesan);
      return;
    }
    setErr(null);
    setSimpan(true);

    // Satu panggilan, bukan dua: fungsinya menulis tindak lanjut DAN menandai
    // selesai dalam satu transaksi. Lihat supabase/tindak_lanjut_alert.sql.
    const { error } = await supabase.rpc('tutup_alert', {
      p_alert: r.alert.id,
      p_tindakan: tindakan!,
      p_kondisi: kondisi!,
      p_catatan: catatan.trim() || null,
    });

    setSimpan(false);
    if (error) {
      setErr(pesanSkema(`Gagal menyimpan tindak lanjut: ${error.message}`));
      return;
    }

    setBuka(null);
    // Dimuat ulang, tidak dipindahkan secara optimistis: `dibuat_pada`
    // distempel server, dan jam responsnya harus yang benar-benar tersimpan.
    await muat();
  }

  if (loading) return <Loading />;

  const darurat = rows.filter((r) => r.alert.jenis === 'flare_darurat');
  const mendesak = rows.filter((r) => r.alert.jenis !== 'flare_darurat');

  return (
    <Screen>
      <InfoBar>
        Peringatan dibuat otomatis saat Cek Flare pasien menghasilkan tingkat mendesak atau darurat.
        Pasien sudah menerima arahannya langsung di aplikasinya saat itu juga.
      </InfoBar>

      {err && <Msg tone="err">{err}</Msg>}

      {rows.length === 0 ? (
        <Card>
          <SectionLabel>Tidak ada peringatan terbuka</SectionLabel>
          <Text style={styles.kosong}>
            Semua peringatan sudah ditindaklanjuti, atau belum ada Cek Flare yang menghasilkan
            kuning maupun merah.
          </Text>
        </Card>
      ) : (
        [...darurat, ...mendesak].map((r) => {
          const gawat = r.alert.jenis === 'flare_darurat';
          const terbuka = buka === r.alert.id;
          return (
            <View
              key={r.alert.id}
              style={[styles.kartu, { borderColor: gawat ? Brand.merah : Brand.kuning }]}
            >
              <View style={styles.kepala}>
                <View
                  style={[styles.badge, { backgroundColor: gawat ? Brand.merah : Brand.kuning }]}
                >
                  <Text style={styles.badgeText}>{gawat ? 'DARURAT' : 'MENDESAK'}</Text>
                </View>
                <Text style={styles.waktu}>{tanggalPendek(r.alert.created_at)}</Text>
              </View>

              <Text style={styles.nama}>{r.nama}</Text>
              <Text style={styles.pesan}>{r.alert.pesan ?? '—'}</Text>

              {terbuka ? (
                <View style={styles.form}>
                  <Text style={styles.formJudul}>Yang dokter lakukan</Text>
                  <SegmentedVertical
                    options={TINDAKAN.map((t) => ({ v: t.v, label: t.label }))}
                    value={tindakan}
                    onChange={pilihTindakan}
                  />

                  <Text style={styles.formJudul}>Kondisi pasien saat dihubungi</Text>
                  {kondisiTerkunci(tindakan) ? (
                    <Text style={styles.terkunci}>
                      Tidak diketahui — pasien tidak berhasil dihubungi.
                    </Text>
                  ) : (
                    <SegmentedVertical
                      options={KONDISI.map((k) => ({ v: k.v, label: k.label }))}
                      value={kondisi}
                      onChange={setKondisi}
                    />
                  )}

                  <Field
                    label="Catatan (opsional)"
                    value={catatan}
                    onChangeText={setCatatan}
                    placeholder="Hanya untuk Anda sendiri"
                    multiline
                  />
                  <Text style={styles.ket}>
                    Catatan ini tidak ikut ringkasan pra-kunjungan maupun ekspor penelitian.
                  </Text>

                  <View style={styles.aksi}>
                    <Pressable
                      accessibilityRole="button"
                      disabled={simpan}
                      onPress={() => void tutup(r)}
                      style={[styles.tombol, styles.tombolUtama, simpan && styles.tombolMati]}
                    >
                      <Text style={styles.tombolUtamaText}>
                        {simpan ? 'Menyimpan…' : 'Simpan & tutup'}
                      </Text>
                    </Pressable>
                    <Pressable
                      accessibilityRole="button"
                      onPress={() => setBuka(null)}
                      style={styles.tombol}
                    >
                      <Text style={styles.tombolText}>Batal</Text>
                    </Pressable>
                  </View>
                </View>
              ) : (
                <View style={styles.aksi}>
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => router.push(`/dokter/pasien/${r.patientId}`)}
                    style={[styles.tombol, styles.tombolUtama]}
                  >
                    <Text style={styles.tombolUtamaText}>Buka ringkasan</Text>
                  </Pressable>
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => mulaiTutup(r)}
                    style={styles.tombol}
                  >
                    <Text style={styles.tombolText}>Catat tindak lanjut</Text>
                  </Pressable>
                </View>
              )}
            </View>
          );
        })
      )}

      {selesai.length > 0 && (
        <Card>
          <SectionLabel>Sudah ditindaklanjuti</SectionLabel>
          {selesai.map((r) => {
            const ringkas = r.lanjut
              ? barisTindakLanjut({
                  waktu: r.lanjut.dibuat_pada,
                  jam: jamRespons(r.alert.created_at, r.lanjut.dibuat_pada),
                  tindakan: r.lanjut.tindakan,
                  kondisi: r.lanjut.kondisi,
                })
              : null;
            return (
              <View key={r.alert.id} style={styles.baris}>
                <View style={styles.barisKiri}>
                  <Text style={styles.barisNama}>{r.nama}</Text>
                  <Text style={styles.barisLanjut}>
                    {ringkas ?? 'ditandai selesai, tanpa rincian'}
                  </Text>
                </View>
                <Text style={styles.barisWaktu}>{tanggalPendek(r.alert.created_at)}</Text>
              </View>
            );
          })}
        </Card>
      )}

      <Disclaimer>{DISCLAIMER}</Disclaimer>
    </Screen>
  );
}

const styles = StyleSheet.create({
  kartu: {
    backgroundColor: Brand.kartu,
    borderRadius: radius.lg,
    padding: space.lg,
    borderWidth: 1.5,
    gap: 6,
  },
  kepala: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  badge: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3 },
  badgeText: { color: '#fff', fontSize: 11, fontWeight: '800', letterSpacing: 0.5 },
  waktu: { flex: 1, fontSize: 12, color: Brand.teksLembut, textAlign: 'right' },
  nama: { fontSize: 16, fontWeight: '700', color: Brand.teks },
  pesan: { fontSize: 13, color: Brand.teks, lineHeight: 19 },
  form: { gap: space.sm, marginTop: space.sm },
  formJudul: { fontSize: 13, fontWeight: '700', color: Brand.teks },
  terkunci: {
    fontSize: 13,
    color: Brand.teksLembut,
    fontStyle: 'italic',
    paddingVertical: space.xs,
  },
  ket: { fontSize: 11.5, color: Brand.teksLembut, lineHeight: 16 },
  aksi: { flexDirection: 'row', gap: space.sm, marginTop: space.xs },
  tombol: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: radius.md,
    paddingVertical: 11,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
    minHeight: 44,
  },
  tombolUtama: { backgroundColor: Brand.ungu, borderColor: Brand.ungu },
  tombolUtamaText: { fontSize: 13.5, fontWeight: '700', color: '#fff' },
  tombolText: { fontSize: 13.5, fontWeight: '600', color: '#374151' },
  tombolMati: { opacity: 0.5 },
  kosong: { fontSize: 13, color: Brand.teksLembut, lineHeight: 19 },
  baris: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
    gap: space.sm,
  },
  barisKiri: { flex: 1, gap: 2 },
  barisNama: { fontSize: 13, color: Brand.teks },
  barisLanjut: { fontSize: 11.5, color: Brand.teksLembut, lineHeight: 16 },
  barisWaktu: { fontSize: 12, color: Brand.teksLembut },
});
