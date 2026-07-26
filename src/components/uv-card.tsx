import AsyncStorage from '@react-native-async-storage/async-storage';
import Ionicons from '@expo/vector-icons/Ionicons';
import * as Location from 'expo-location';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Brand, radius, space } from '@/constants/brand';
import { todayISO } from '@/lib/dates';
import { ambilUv, KOORDINAT_CADANGAN, uvCategory, type Koordinat, type UvHarian } from '@/lib/uv';

const KUNCI_UV = 'tl_uv';
const KUNCI_LOKASI = 'tl_uv_loc';

/**
 * Lokasi pasien untuk pencarian UV.
 *
 * Izin lokasi diminta sekali; bila ditolak atau gagal, dipakai koordinat
 * Medan sebagai perkiraan — kartu tetap tampil dan pasien diberi tahu bahwa
 * angkanya perkiraan.
 */
async function ambilKoordinat(): Promise<Koordinat> {
  try {
    const tersimpan = await AsyncStorage.getItem(KUNCI_LOKASI);
    if (tersimpan) {
      const c = JSON.parse(tersimpan) as Koordinat;
      if (typeof c?.lat === 'number' && typeof c?.lon === 'number') return c;
    }
  } catch {
    // Cache rusak — abaikan dan minta ulang.
  }

  const cadangan: Koordinat = { ...KOORDINAT_CADANGAN, perkiraan: true };

  try {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') return cadangan;

    const pos = await Location.getLastKnownPositionAsync();
    const titik =
      pos ?? (await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Low }));
    if (!titik) return cadangan;

    const c: Koordinat = {
      lat: Number(titik.coords.latitude.toFixed(3)),
      lon: Number(titik.coords.longitude.toFixed(3)),
      perkiraan: false,
    };
    await AsyncStorage.setItem(KUNCI_LOKASI, JSON.stringify(c)).catch(() => {});
    return c;
  } catch {
    return cadangan;
  }
}

export function UvCard() {
  const [data, setData] = useState<UvHarian | null>(null);
  const [gagal, setGagal] = useState(false);

  useEffect(() => {
    const ac = new AbortController();
    let hidup = true;

    (async () => {
      const hariIni = todayISO();

      // Satu panggilan jaringan per hari — UV maksimum harian tidak berubah.
      try {
        const cache = await AsyncStorage.getItem(KUNCI_UV);
        if (cache) {
          const c = JSON.parse(cache) as { tanggal: string } & UvHarian;
          if (c?.tanggal === hariIni && typeof c.uv === 'number') {
            if (hidup) setData({ uv: c.uv, perkiraan: c.perkiraan });
            return;
          }
        }
      } catch {
        // Cache rusak — ambil ulang dari jaringan.
      }

      try {
        const koordinat = await ambilKoordinat();
        const hasil = await ambilUv(koordinat, ac.signal);
        if (!hidup) return;
        setData(hasil);
        await AsyncStorage.setItem(KUNCI_UV, JSON.stringify({ tanggal: hariIni, ...hasil })).catch(
          () => {}
        );
      } catch {
        if (hidup) setGagal(true);
      }
    })();

    return () => {
      hidup = false;
      ac.abort();
    };
  }, []);

  // Kartu ini pelengkap; bila gagal, hilang diam-diam daripada menampilkan error.
  if (gagal) return null;

  if (!data) {
    return (
      <View style={[styles.kartu, styles.memuat]}>
        <Ionicons name="sunny-outline" size={15} color="#9ca3af" />
        <Text style={styles.memuatTeks}>Memuat indeks UV…</Text>
      </View>
    );
  }

  const k = uvCategory(data.uv);

  return (
    <View style={[styles.kartu, { backgroundColor: k.latar, borderColor: k.garis }]}>
      <View style={styles.judulRow}>
        <Ionicons name="sunny" size={15} color={k.warna} />
        <Text style={[styles.judul, { color: k.warna }]}>
          Indeks UV hari ini: {data.uv} · {k.label}
        </Text>
      </View>
      <Text style={styles.saran}>{k.saran}</Text>
      {data.perkiraan && (
        <Text style={styles.perkiraan}>
          Perkiraan untuk Medan — izinkan akses lokasi untuk data area-mu.
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  kartu: {
    borderWidth: 1,
    borderRadius: radius.xl - 2,
    padding: space.md + 2,
    gap: 5,
  },
  memuat: {
    backgroundColor: Brand.unguMuda,
    borderColor: Brand.unguGaris,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  memuatTeks: { fontSize: 12.5, color: '#9ca3af' },
  judulRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  judul: { flex: 1, fontSize: 13, fontWeight: '700' },
  saran: { fontSize: 12.5, color: '#4b5563', lineHeight: 19 },
  perkiraan: { fontSize: 10.5, color: '#9ca3af' },
});
