import { KATA_KONFIRMASI, bacaPratinjau, kalimatRingkas, konfirmasiCocok } from './hapus-akun';

describe('konfirmasiCocok', () => {
  it('menerima kata yang tepat', () => {
    expect(konfirmasiCocok(KATA_KONFIRMASI)).toBe(true);
  });

  it('memaafkan spasi di ujung — papan ketik ponsel kerap menambahkannya', () => {
    expect(konfirmasiCocok('  HAPUS ')).toBe(true);
  });

  it('TIDAK memaafkan huruf kecil — mengetiknya harus terasa disengaja', () => {
    expect(konfirmasiCocok('hapus')).toBe(false);
    expect(konfirmasiCocok('Hapus')).toBe(false);
  });

  it('menolak kosong dan kata lain', () => {
    for (const t of ['', ' ', 'HAPUSKAN', 'HAPU', 'ya']) {
      expect(konfirmasiCocok(t)).toBe(false);
    }
  });
});

describe('bacaPratinjau', () => {
  it('hanya menampilkan yang jumlahnya lebih dari nol', () => {
    const p = bacaPratinjau({ peran: 'patient', daily_checkins: 12, medications: 0, alerts: 3 });
    expect(p.rincian).toEqual([
      { label: 'Check-in harian', jumlah: 12 },
      { label: 'Peringatan ke dokter', jumlah: 3 },
    ]);
    expect(p.total).toBe(15);
  });

  it('kunci tak dikenal tidak ditampilkan mentah, tapi tetap ikut total', () => {
    // Fungsi database bisa menambah tabel sebelum berkas ini menyusul.
    // "tabel_baru: 5" di layar pasien lebih buruk daripada tidak tampil —
    // tapi total yang kurang 5 adalah kebohongan.
    const p = bacaPratinjau({ peran: 'patient', daily_checkins: 2, tabel_baru: 5 });
    expect(p.rincian).toEqual([{ label: 'Check-in harian', jumlah: 2 }]);
    expect(p.total).toBe(7);
  });

  it('pasien_tertaut tidak ikut total catatan', () => {
    // Pasien bukan "catatan yang dihapus" — mereka justru TIDAK dihapus.
    const p = bacaPratinjau({ peran: 'doctor', pasien_tertaut: 9, visits: 2 });
    expect(p.pasienTertaut).toBe(9);
    expect(p.total).toBe(2);
  });

  it('peran selain doctor dibaca sebagai patient', () => {
    expect(bacaPratinjau({ peran: 'doctor' }).peran).toBe('doctor');
    expect(bacaPratinjau({ peran: 'patient' }).peran).toBe('patient');
    expect(bacaPratinjau({ peran: 'admin' }).peran).toBe('patient');
    expect(bacaPratinjau({}).peran).toBe('patient');
  });

  it('nilai rusak dianggap nol, tidak melempar', () => {
    const p = bacaPratinjau({
      peran: 'patient',
      daily_checkins: -3,
      medications: 'dua',
      alerts: 4,
    });
    expect(p.rincian).toEqual([{ label: 'Peringatan ke dokter', jumlah: 4 }]);
    expect(p.total).toBe(4);
  });

  it('masukan null atau undefined tidak melempar', () => {
    for (const v of [null, undefined]) {
      const p = bacaPratinjau(v);
      expect(p.total).toBe(0);
      expect(p.rincian).toEqual([]);
    }
  });
});

describe('kalimatRingkas', () => {
  const p = (o: object) => bacaPratinjau({ peran: 'patient', ...o });

  it('menyebut jumlah total untuk pasien', () => {
    expect(kalimatRingkas(p({ daily_checkins: 30, alerts: 2 }))).toContain('32 catatan');
    expect(kalimatRingkas(p({ daily_checkins: 30 }))).toContain('tidak bisa dikembalikan');
  });

  it('akun kosong tetap punya kalimatnya sendiri', () => {
    // Tanpa ini bunyinya "0 catatan akan dihapus permanen", yang membingungkan.
    expect(kalimatRingkas(p({}))).toBe('Belum ada catatan yang tersimpan. Akun Anda akan dihapus.');
  });

  it('dokter diberi tahu pasiennya TIDAK ikut terhapus', () => {
    const d = bacaPratinjau({ peran: 'doctor', pasien_tertaut: 9 });
    const s = kalimatRingkas(d);
    expect(s).toContain('9 pasien');
    expect(s).toContain('TIDAK ikut terhapus');
  });

  it('dokter tanpa pasien tidak diberi kalimat yang menakuti', () => {
    const d = bacaPratinjau({ peran: 'doctor', pasien_tertaut: 0 });
    expect(kalimatRingkas(d)).toContain('Tidak ada pasien yang tertaut');
  });
});
