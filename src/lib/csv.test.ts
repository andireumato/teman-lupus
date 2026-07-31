import { barisCsv, buatCsv, namaBerkasAman, sel, type Kolom } from '@/lib/csv';

describe('sel', () => {
  it('teks biasa tidak dikutip', () => {
    expect(sel('Hidroksiklorokuin')).toBe('Hidroksiklorokuin');
  });

  it('koma memaksa kutip — satu koma menggeser seluruh kolom', () => {
    expect(sel('mual, muntah')).toBe('"mual, muntah"');
  });

  it('kutip di dalam teks digandakan', () => {
    expect(sel('obat "generik"')).toBe('"obat ""generik"""');
  });

  it('baris baru di catatan pasien tetap dalam satu sel', () => {
    expect(sel('lelah\nsejak pagi')).toBe('"lelah\nsejak pagi"');
    expect(sel('a\r\nb')).toBe('"a\r\nb"');
  });

  it('kosong dan null jadi sel kosong', () => {
    expect(sel(null)).toBe('');
    expect(sel(undefined)).toBe('');
    expect(sel('')).toBe('');
  });

  it('boolean jadi 1/0, bukan true/false', () => {
    // Alat statistik memperlakukan 1/0 sebagai numerik; "true" jadi faktor teks.
    expect(sel(true)).toBe('1');
    expect(sel(false)).toBe('0');
  });

  it('angka memakai titik desimal, bukan koma', () => {
    expect(sel(7.5)).toBe('7.5');
    expect(sel(0)).toBe('0');
  });

  it('angka yang bukan angka jadi kosong, bukan "NaN"', () => {
    expect(sel(NaN)).toBe('');
    expect(sel(Infinity)).toBe('');
  });
});

describe('sel — pencegahan rumus', () => {
  // Sel yang diawali karakter ini dijalankan Excel & LibreOffice sebagai
  // RUMUS. Catatan pasien dan nama obat diketik bebas, jadi ini bukan
  // kemungkinan teoretis.
  it.each(['=1+1', '+62', '-5', '@SUM(A1)'])('%s diawali kutip tunggal', (jahat) => {
    expect(sel(jahat).replace(/^"|"$/g, '')).toMatch(/^'/);
  });

  it('teks yang kebetulan diawali tanda minus tetap terbaca', () => {
    // "-5 kg" adalah catatan berat badan yang wajar, bukan serangan. Ia tetap
    // dilindungi, dan kutipnya terlihat saat dibuka — itu harga yang benar
    // dibanding sel yang dieksekusi.
    expect(sel('-5 kg')).toBe("'-5 kg");
  });

  it('tanda minus di tengah kalimat tidak diapa-apakan', () => {
    expect(sel('nyeri 3-4 hari')).toBe('nyeri 3-4 hari');
  });

  it('angka negatif tetap angka, bukan teks berkutip', () => {
    expect(sel(-5)).toBe('-5');
  });
});

describe('buatCsv', () => {
  interface Baris {
    kode: string;
    nilai: number | null;
  }
  const kolom: Kolom<Baris>[] = [
    { judul: 'kode', ambil: (r) => r.kode },
    { judul: 'nilai', ambil: (r) => r.nilai },
  ];

  it('menulis judul lalu barisnya, dipisah CRLF', () => {
    const csv = buatCsv(kolom, [
      { kode: 'abc12345', nilai: 4 },
      { kode: 'def67890', nilai: null },
    ]);
    expect(csv.replace('﻿', '')).toBe('kode,nilai\r\nabc12345,4\r\ndef67890,\r\n');
  });

  it('diawali BOM UTF-8 — tanpa itu Excel merusak huruf non-ASCII', () => {
    expect(buatCsv(kolom, []).startsWith('﻿')).toBe(true);
  });

  it('tetap menulis baris judul meski tanpa data', () => {
    // Berkas kosong tanpa judul tidak bisa dibedakan dari ekspor yang gagal.
    expect(buatCsv(kolom, []).replace('﻿', '')).toBe('kode,nilai\r\n');
  });

  it('jumlah kolom tiap baris selalu sama dengan judulnya', () => {
    const csv = buatCsv(kolom, [{ kode: 'a,b', nilai: 1 }]);
    const baris = csv.replace('﻿', '').trimEnd().split('\r\n');
    // Dihitung dengan pembaca sederhana yang menghormati kutip.
    const hitung = (s: string) => s.match(/(?:^|,)("(?:[^"]|"")*"|[^,]*)/g)!.length;
    expect(hitung(baris[1])).toBe(hitung(baris[0]));
  });
});

describe('barisCsv', () => {
  it('menggabungkan sel dengan koma', () => {
    expect(barisCsv(['a', 1, true, null])).toBe('a,1,1,');
  });
});

describe('namaBerkasAman', () => {
  it('mengganti karakter yang ditolak sistem berkas', () => {
    expect(namaBerkasAman('sledai 2026/07/30.csv')).toBe('sledai_2026_07_30.csv');
  });

  it('tidak pernah mengembalikan nama kosong', () => {
    expect(namaBerkasAman('///')).toBe('ekspor');
  });
});
