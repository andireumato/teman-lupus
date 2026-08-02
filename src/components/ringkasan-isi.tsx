import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Card, SectionLabel } from '@/components/ui/kit';
import { Brand, space } from '@/constants/brand';
import { tanggalPendek } from '@/lib/dates';
import type { GejalaRingkas, Ringkasan } from '@/lib/ringkasan';

/**
 * Tampilan tujuh bagian ringkasan pra-kunjungan.
 *
 * Dipakai DUA pihak: pasien di `/ringkasan` dan dokter di
 * `/dokter/pasien/[id]`. Sengaja satu komponen — kalau masing-masing punya
 * tampilannya sendiri, dokter dan pasien bisa duduk berhadapan membahas dua
 * ringkasan yang berbeda isinya.
 *
 * Bagian 6 punya slot karena hanya pasien yang boleh menambah pertanyaan;
 * dokter membacanya saja.
 */

const ARAH_LABEL = { naik: 'naik', turun: 'turun', stabil: 'stabil' } as const;

function BarisGejala({ judul, list }: { judul: string; list: GejalaRingkas[] }) {
  return (
    <View style={styles.grup}>
      <Text style={styles.grupJudul}>{judul}</Text>
      {list.length === 0 ? (
        <Text style={styles.kosong}>—</Text>
      ) : (
        list.map((g) => (
          <Text key={`${g.system}|${g.item}`} style={styles.item}>
            • {g.item}{' '}
            <Text style={styles.lembut}>
              ({g.sistemLabel}, {g.hari} hari, terakhir {tanggalPendek(g.terakhir)}
              {g.checkinSesudahnya > 0
                ? `, ${g.checkinSesudahnya} check-in sesudahnya tanpa keluhan ini`
                : ''}
              )
            </Text>
          </Text>
        ))
      )}
    </View>
  );
}

export function RingkasanIsi({
  r,
  slotPertanyaan,
  catatanBagian3,
}: {
  r: Ringkasan;
  /** Formulir pertanyaan milik pasien; kosong pada tampilan dokter. */
  slotPertanyaan?: ReactNode;
  catatanBagian3: string;
}) {
  return (
    <>
      <Card>
        <Text style={styles.kepala}>
          {[
            r.kepala.inisial,
            [r.kepala.jenisKelamin, r.kepala.usia != null ? `${r.kepala.usia} tahun` : null]
              .filter(Boolean)
              .join(', ') || null,
            `ID ${r.kepala.id}`,
          ]
            .filter(Boolean)
            .join(' · ')}
        </Text>
        <Text style={styles.kepalaSub}>
          {tanggalPendek(r.kepala.dari)} s/d {tanggalPendek(r.kepala.sampai)}
        </Text>
        <Text style={styles.kepalaSub}>
          {r.kepala.jumlahCheckin} check-in dari {r.kepala.jumlahHari} hari
        </Text>
        {/* Data klinis dasar hanya muncul bila ada isinya — baris kosong
            berisi "—" tidak memberi tahu apa pun. */}
        {r.kepala.lamaSakit && (
          <Text style={styles.kepalaKlinis}>
            Sejak diagnosis {r.kepala.lamaSakit}
            {r.kepala.klasifikasi ? ` · ${r.kepala.klasifikasi}` : ''}
          </Text>
        )}
        {!r.kepala.lamaSakit && r.kepala.klasifikasi && (
          <Text style={styles.kepalaKlinis}>{r.kepala.klasifikasi}</Text>
        )}
        {r.kepala.organ.length > 0 && (
          <Text style={styles.kepalaKlinis}>Organ terlibat: {r.kepala.organ.join(', ')}</Text>
        )}
      </Card>

      <Card>
        <SectionLabel>1. Skor harian</SectionLabel>
        <Text style={styles.catatanKecil}>
          Bukan PRO tervalidasi — ini rata-rata dari skala check-in harian.
        </Text>
        {r.skor.map((s) => (
          <View key={s.label} style={styles.grup}>
            <Text style={styles.grupJudul}>{s.label}</Text>
            {s.akhir == null ? (
              <Text style={styles.kosong}>Belum ada data.</Text>
            ) : (
              <>
                <Text style={styles.item}>
                  Terkini {s.akhir} · awal periode {s.awal ?? '–'} · tren {ARAH_LABEL[s.arah]}
                </Text>
                <Text style={styles.lembut}>
                  Per minggu: {s.mingguan.map((m) => (m == null ? '–' : m)).join(' → ')}
                </Text>
              </>
            )}
          </View>
        ))}
      </Card>

      <Card>
        <SectionLabel>2. Gejala menonjol</SectionLabel>
        <BarisGejala judul="Baru muncul" list={r.gejala.baru} />
        <BarisGejala judul="Makin sering" list={r.gejala.memburuk} />
        <BarisGejala judul="Menetap" list={r.gejala.menetap} />
        <BarisGejala judul="Berkurang" list={r.gejala.membaik} />
        {r.sistemBelumTercatat.length > 0 && (
          <View style={styles.grup}>
            <Text style={styles.grupJudul}>Di luar organ terlibat yang tercatat</Text>
            {r.sistemBelumTercatat.map((s) => (
              <Text key={s.sistemLabel} style={styles.item}>
                • {s.sistemLabel} <Text style={styles.lembut}>({s.items.join(', ')})</Text>
              </Text>
            ))}
            <Text style={styles.catatanKecil}>
              Catatan pasien dan daftar organ terlibat tidak sejalan. Bisa berarti keterlibatan
              baru, keluhan di luar lupus, atau daftar organ yang belum diperbarui.
            </Text>
          </View>
        )}
      </Card>

      <Card>
        <SectionLabel>3. Perubahan & waktunya</SectionLabel>
        <Text style={styles.catatanKecil}>{catatanBagian3}</Text>
        {r.perubahan.length === 0 ? (
          <Text style={styles.kosong}>Data belum cukup untuk membandingkan dua periode.</Text>
        ) : (
          r.perubahan.map((p) => (
            <Text key={p} style={styles.item}>
              • {p}
            </Text>
          ))
        )}
      </Card>

      <Card>
        <SectionLabel>4. Obat</SectionLabel>
        <Text style={styles.item}>
          • <Text style={styles.tebal}>Sedang diminum:</Text>{' '}
          {r.obat.sedangDiminum.length === 0
            ? 'tidak ada obat aktif'
            : r.obat.sedangDiminum.map((o) => `${o.nama} (${o.polaLabel})`).join(', ')}
        </Text>
        {r.obat.perubahan.length > 0 && (
          <Text style={styles.item}>
            • <Text style={styles.tebal}>Perubahan:</Text>{' '}
            {r.obat.perubahan.map((o) => `${o.nama} ${o.teks}`).join('; ')}
          </Text>
        )}
        {r.obat.dosis.tercatat > 0 && (
          <Text style={styles.item}>
            • <Text style={styles.tebal}>Dosis diminum:</Text> {r.obat.dosis.diminum} dari{' '}
            {r.obat.dosis.tercatat} yang tercatat
            {r.obat.dosis.terlewat.length > 0
              ? `; terlewat: ${r.obat.dosis.terlewat.map((o) => `${o.nama} ${o.jumlah}`).join(', ')}`
              : ''}
          </Text>
        )}
        <Text style={styles.item}>
          •{' '}
          {r.obat.mars
            ? `MARS-5 ${r.obat.mars.total}/25 ${r.obat.mars.kategori} (${tanggalPendek(r.obat.mars.tanggal)})`
            : 'MARS-5 belum diisi'}
          {r.obat.hariTanpaCatatan > 0
            ? ` · ${r.obat.hariTanpaCatatan} dari ${r.kepala.jumlahHari} hari tanpa catatan`
            : ''}
        </Text>
        {r.obat.alasan.map((a) => (
          <Text key={a.id} style={styles.item}>
            • Alasan: {tanggalPendek(a.tanggal)} {a.teks}
          </Text>
        ))}
      </Card>

      <Card>
        <SectionLabel>5. Event red-flag</SectionLabel>
        {r.redflag.length === 0 ? (
          <Text style={styles.kosong}>Tidak ada peringatan pada periode ini.</Text>
        ) : (
          r.redflag.map((e) => (
            <View key={e.id} style={styles.event}>
              <View style={styles.eventHead}>
                <Text style={styles.eventTanggal}>{tanggalPendek(e.waktu)}</Text>
                <View
                  style={[
                    styles.badge,
                    { backgroundColor: e.level === 'darurat' ? Brand.merah : Brand.kuning },
                  ]}
                >
                  <Text style={styles.badgeText}>{e.level}</Text>
                </View>
              </View>
              <Text style={styles.lembut}>
                {e.tanda.length > 0 ? e.tanda.join(', ') : 'Tanpa tanda tercentang'}
              </Text>
            </View>
          ))
        )}
      </Card>

      <Card>
        <SectionLabel>6. Pertanyaan pasien</SectionLabel>
        {slotPertanyaan}
        {r.pertanyaan.pasien.length > 0 && !slotPertanyaan && (
          <View style={styles.grup}>
            {r.pertanyaan.pasien.map((p) => (
              <Text key={p} style={styles.item}>
                • {p}
              </Text>
            ))}
          </View>
        )}
        {r.pertanyaan.pasien.length === 0 && !slotPertanyaan && (
          <Text style={styles.kosong}>Belum ada pertanyaan yang disiapkan.</Text>
        )}

        {r.pertanyaan.catatan.length > 0 && (
          <View style={styles.grup}>
            <Text style={styles.grupJudul}>Dari catatan check-in</Text>
            {r.pertanyaan.catatan.map((c) => (
              <Text key={c.tanggal} style={styles.item}>
                • {tanggalPendek(c.tanggal)}: {c.teks}
              </Text>
            ))}
          </View>
        )}
      </Card>

      <Card>
        <SectionLabel>7. Pemantauan</SectionLabel>
        {r.pemantauan.map((p) => (
          <Text key={p} style={styles.item}>
            • {p}
          </Text>
        ))}
      </Card>
    </>
  );
}

const styles = StyleSheet.create({
  kepala: { fontSize: 16, fontWeight: '800', color: Brand.teks },
  kepalaSub: { fontSize: 12.5, color: Brand.teksLembut },
  kepalaKlinis: { fontSize: 12.5, color: Brand.teks, lineHeight: 18 },
  grup: { gap: 3, marginTop: space.sm },
  grupJudul: { fontSize: 12.5, fontWeight: '700', color: '#4b5563' },
  item: { fontSize: 13, color: Brand.teks, lineHeight: 19 },
  lembut: { fontSize: 12, color: Brand.teksLembut, lineHeight: 18 },
  tebal: { fontWeight: '700' },
  kosong: { fontSize: 12.5, color: Brand.teksLembut },
  catatanKecil: { fontSize: 11.5, color: Brand.teksLembut, lineHeight: 17 },
  event: { gap: 3, paddingVertical: 7, borderBottomWidth: 1, borderBottomColor: '#f3f4f6' },
  eventHead: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  eventTanggal: { fontSize: 13, fontWeight: '600', color: Brand.teks },
  badge: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 2 },
  badgeText: { color: '#fff', fontSize: 11, fontWeight: '700' },
});
