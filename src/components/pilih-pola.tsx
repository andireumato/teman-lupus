import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Field, Segmented } from '@/components/ui/kit';
import { Brand, radius, space } from '@/constants/brand';
import { todayISO } from '@/lib/dates';
import { NAMA_HARI, SELANG_MAKS, SELANG_MIN, type PolaMinum } from '@/lib/pola-minum';

/**
 * Pemilih pola hari minum obat.
 *
 * Dipakai DUA tempat: formulir tambah obat dan panel jadwal pada kartu obat
 * yang sudah ada. Satu komponen supaya keduanya tidak bisa menyimpan bentuk
 * data yang berbeda — obat lama pun harus bisa diubah jadi mingguan, karena
 * pasien sudah memasukkan obatnya sebelum pola ini ada.
 */

export interface DrafPola {
  pola: PolaMinum;
  /** ISO 1 = Senin … 7 = Minggu. */
  hariMinggu: number[];
  selangHari: string;
  /** 'YYYY-MM-DD'. Jangkar pola selang. */
  mulaiTanggal: string;
}

const PILIHAN: { v: PolaMinum; label: string }[] = [
  { v: 'harian', label: 'Setiap hari' },
  { v: 'mingguan', label: 'Hari tertentu' },
  { v: 'selang', label: 'Selang hari' },
];

/** Urutan tampil Senin→Minggu, sesuai kebiasaan kalender di Indonesia. */
const URUT_HARI = [1, 2, 3, 4, 5, 6, 7];

export function drafPolaBawaan(): DrafPola {
  return { pola: 'harian', hariMinggu: [], selangHari: '2', mulaiTanggal: todayISO() };
}

export function PilihPola({
  nilai,
  onChange,
}: {
  nilai: DrafPola;
  onChange: (d: DrafPola) => void;
}) {
  function geserHari(h: number) {
    const ada = nilai.hariMinggu.includes(h);
    onChange({
      ...nilai,
      hariMinggu: ada
        ? nilai.hariMinggu.filter((x) => x !== h)
        : [...nilai.hariMinggu, h].sort((a, b) => a - b),
    });
  }

  return (
    <View style={styles.bungkus}>
      <Text style={styles.label}>Pola minum</Text>
      <Segmented
        options={PILIHAN}
        value={nilai.pola}
        onChange={(v) => onChange({ ...nilai, pola: v })}
      />

      {nilai.pola === 'mingguan' && (
        <View style={styles.bagian}>
          <Text style={styles.label}>Hari minum</Text>
          <View style={styles.hariBaris}>
            {URUT_HARI.map((h) => {
              const on = nilai.hariMinggu.includes(h);
              return (
                <Pressable
                  key={h}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: on }}
                  accessibilityLabel={NAMA_HARI[h]}
                  onPress={() => geserHari(h)}
                  style={[styles.hari, on && styles.hariOn]}
                >
                  <Text style={[styles.hariText, on && styles.hariTextOn]}>
                    {NAMA_HARI[h].slice(0, 3)}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          <Text style={styles.hint}>
            {nilai.hariMinggu.length === 0
              ? 'Pilih minimal satu hari. Metotreksat biasanya satu hari saja dalam seminggu.'
              : `Diingatkan tiap ${nilai.hariMinggu.map((h) => NAMA_HARI[h]).join(', ')}.`}
          </Text>
        </View>
      )}

      {nilai.pola === 'selang' && (
        <View style={styles.bagian}>
          <Field
            label="Diminum tiap berapa hari"
            value={nilai.selangHari}
            onChangeText={(t) => onChange({ ...nilai, selangHari: t.replace(/[^0-9]/g, '') })}
            placeholder="2"
            keyboardType="number-pad"
          />
          <Text style={styles.hint}>
            Isi 2 untuk selang sehari. Dihitung mulai {nilai.mulaiTanggal}, jadi tanggal itu
            termasuk hari minum. Harinya akan bergeser tiap pekan — itu memang sifat aturan
            selang-sehari, bukan kesalahan.
          </Text>
        </View>
      )}
    </View>
  );
}

/**
 * Memeriksa draf sebelum disimpan.
 *
 * Mengembalikan pesan kesalahan, atau null bila sudah sah. Sengaja menolak
 * dengan tegas alih-alih diam-diam kembali ke pola harian: obat mingguan yang
 * tersimpan sebagai harian berarti pasien diingatkan meminum metotreksat tujuh
 * kali seminggu.
 */
export function periksaDrafPola(d: DrafPola): string | null {
  if (d.pola === 'mingguan' && d.hariMinggu.length === 0) {
    return 'Pilih dulu hari minumnya.';
  }
  if (d.pola === 'selang') {
    const n = Number(d.selangHari);
    if (!Number.isInteger(n) || n < SELANG_MIN || n > SELANG_MAKS) {
      return `Selang hari harus antara ${SELANG_MIN} dan ${SELANG_MAKS}.`;
    }
  }
  return null;
}

/** Draf → kolom database. Kolom milik pola lain sengaja dinolkan. */
export function drafKeKolom(d: DrafPola) {
  switch (d.pola) {
    case 'mingguan':
      return {
        pola: 'mingguan',
        hari_minggu: d.hariMinggu,
        selang_hari: null,
        mulai_tanggal: null,
      };
    case 'selang':
      return {
        pola: 'selang',
        hari_minggu: null,
        selang_hari: Number(d.selangHari),
        mulai_tanggal: d.mulaiTanggal,
      };
    default:
      return { pola: 'harian', hari_minggu: null, selang_hari: null, mulai_tanggal: null };
  }
}

const styles = StyleSheet.create({
  bungkus: { gap: space.xs },
  bagian: { gap: space.xs, marginTop: space.xs },
  label: { fontSize: 12.5, fontWeight: '700', color: Brand.teks },
  hariBaris: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  hari: {
    minWidth: 44,
    minHeight: 40,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: '#d1d5db',
    backgroundColor: '#fff',
  },
  hariOn: { backgroundColor: Brand.ungu, borderColor: Brand.ungu },
  hariText: { fontSize: 12.5, fontWeight: '600', color: Brand.teks },
  hariTextOn: { color: '#fff' },
  hint: { fontSize: 11.5, color: Brand.teksLembut, lineHeight: 17 },
});
