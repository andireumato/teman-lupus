#!/usr/bin/env python3
"""
Membangkitkan CONTOH tabel hasil penelitian dengan ANGKA REKAAN.

    python3 penelitian/contoh-tabel-hasil.py

⚠️ SELURUH ANGKA YANG DIHASILKAN BERKAS INI ADALAH REKAAN KOMPUTER.
Tidak ada satu pun pasien sungguhan di dalamnya. Gunanya hanya untuk melihat
BENTUK tabel hasil sebelum data yang sebenarnya terkumpul, sehingga rancangan
analisis dapat dinilai lebih awal. Jangan pernah memasukkan angka-angka ini ke
dalam naskah proposal, laporan, maupun publikasi.

Datanya dibangkitkan dengan benih tetap supaya hasilnya sama setiap kali
dijalankan, lalu dianalisis memakai persis rencana analisis pada subbab 3.11:
interval kepercayaan proporsi dengan metode Wilson, uji Wilcoxon berpasangan,
dan korelasi Spearman. Dengan begitu angka antartabel tetap konsisten, dan
kekeliruan rencana analisis dapat ketahuan sebelum penelitian berjalan.
"""

import math
import random
from pathlib import Path

HASIL = Path(__file__).resolve().parent / 'contoh-tabel-hasil.md'
BENIH = 20260803
N_REKRUT = 55
HARI_PANTAU = 90


# ---------------------------------------------------------------- statistik

def wilson(k: int, n: int, z: float = 1.959964) -> tuple[float, float, float]:
    """Interval kepercayaan proporsi metode Wilson (subbab 3.11.1)."""
    if n == 0:
        return (0.0, 0.0, 0.0)
    p = k / n
    d = 1 + z * z / n
    tengah = (p + z * z / (2 * n)) / d
    lebar = z * math.sqrt(p * (1 - p) / n + z * z / (4 * n * n)) / d
    return (p, max(0.0, tengah - lebar), min(1.0, tengah + lebar))


def norm_sf(x: float) -> float:
    return 0.5 * math.erfc(x / math.sqrt(2))


def betacf(a: float, b: float, x: float) -> float:
    """Pecahan berlanjut Lentz untuk fungsi beta tak lengkap."""
    kecil = 1e-300
    qab, qap, qam = a + b, a + 1, a - 1
    c, d = 1.0, 1 - qab * x / qap
    if abs(d) < kecil:
        d = kecil
    d = 1 / d
    h = d
    for m in range(1, 300):
        m2 = 2 * m
        aa = m * (b - m) * x / ((qam + m2) * (a + m2))
        d = 1 + aa * d
        c = 1 + aa / c
        if abs(d) < kecil:
            d = kecil
        if abs(c) < kecil:
            c = kecil
        d = 1 / d
        h *= d * c
        aa = -(a + m) * (qab + m) * x / ((a + m2) * (qap + m2))
        d = 1 + aa * d
        c = 1 + aa / c
        if abs(d) < kecil:
            d = kecil
        if abs(c) < kecil:
            c = kecil
        d = 1 / d
        selisih = d * c
        h *= selisih
        if abs(selisih - 1) < 3e-16:
            break
    return h


def betai(a: float, b: float, x: float) -> float:
    if x <= 0:
        return 0.0
    if x >= 1:
        return 1.0
    lbeta = math.lgamma(a + b) - math.lgamma(a) - math.lgamma(b)
    depan = math.exp(lbeta + a * math.log(x) + b * math.log(1 - x))
    if x < (a + 1) / (a + b + 2):
        return depan * betacf(a, b, x) / a
    return 1 - depan * betacf(b, a, 1 - x) / b


def t_dua_sisi(t: float, df: float) -> float:
    """Nilai p dua sisi sebaran t."""
    if df <= 0:
        return float('nan')
    return betai(df / 2, 0.5, df / (df + t * t))


def uji_t_berpasangan(a: list[float], b: list[float]) -> tuple[float, float]:
    d = [y - x for x, y in zip(a, b)]
    n = len(d)
    rerata = sum(d) / n
    sd = math.sqrt(sum((x - rerata) ** 2 for x in d) / (n - 1))
    t = rerata / (sd / math.sqrt(n))
    return t, t_dua_sisi(t, n - 1)


def peringkat(v: list[float]) -> list[float]:
    """Peringkat dengan rerata pada nilai yang sama."""
    urut = sorted(range(len(v)), key=lambda i: v[i])
    hasil = [0.0] * len(v)
    i = 0
    while i < len(urut):
        j = i
        while j + 1 < len(urut) and v[urut[j + 1]] == v[urut[i]]:
            j += 1
        rata = (i + j) / 2 + 1
        for k in range(i, j + 1):
            hasil[urut[k]] = rata
        i = j + 1
    return hasil


def wilcoxon(a: list[float], b: list[float]) -> tuple[float, float]:
    """Uji Wilcoxon berpasangan, hampiran normal dengan koreksi kontinuitas."""
    d = [y - x for x, y in zip(a, b) if y != x]
    n = len(d)
    if n < 5:
        return (float('nan'), float('nan'))
    r = peringkat([abs(x) for x in d])
    w_plus = sum(ri for ri, di in zip(r, d) if di > 0)
    w_min = sum(ri for ri, di in zip(r, d) if di < 0)
    w = min(w_plus, w_min)
    mu = n * (n + 1) / 4
    sigma = math.sqrt(n * (n + 1) * (2 * n + 1) / 24)
    z = (abs(w - mu) - 0.5) / sigma
    return w, 2 * norm_sf(z)


def spearman(x: list[float], y: list[float]) -> tuple[float, float]:
    n = len(x)
    rx, ry = peringkat(x), peringkat(y)
    mx, my = sum(rx) / n, sum(ry) / n
    atas = sum((a - mx) * (b - my) for a, b in zip(rx, ry))
    bawah = math.sqrt(sum((a - mx) ** 2 for a in rx) * sum((b - my) ** 2 for b in ry))
    rho = atas / bawah if bawah else 0.0
    if abs(rho) >= 1 or n <= 2:
        return rho, 0.0
    t = rho * math.sqrt((n - 2) / (1 - rho * rho))
    return rho, t_dua_sisi(t, n - 2)


def des(x: float, n: int = 1) -> str:
    """
    Angka desimal dengan KOMA, sesuai panduan FK USU bagian 3.

    Dibentuk di sini, bukan dengan mengganti semua titik pada naskah jadi koma.
    Cara itu pernah dicoba dan merusak penomoran: "Tabel 4.1" berubah menjadi
    "Tabel 4,1" dan "subbab 3.11.1" menjadi "subbab 3,11,1".
    """
    return f'{{:.{n}f}}'.format(x).replace('.', ',')


def ringkas(v: list[float], desimal: int = 1) -> str:
    """Median dan rentang interkuartil, sesuai subbab 3.11.1."""
    s = sorted(v)
    n = len(s)

    def kuantil(q: float) -> float:
        pos = (n - 1) * q
        bawah = math.floor(pos)
        atas = math.ceil(pos)
        if bawah == atas:
            return s[int(pos)]
        return s[bawah] + (s[atas] - s[bawah]) * (pos - bawah)

    return (f'{des(kuantil(0.5), desimal)} '
            f'({des(kuantil(0.25), desimal)}–{des(kuantil(0.75), desimal)})')


def rerata_sd(v: list[float], desimal: int = 1) -> str:
    n = len(v)
    m = sum(v) / n
    sd = math.sqrt(sum((x - m) ** 2 for x in v) / (n - 1))
    return f'{des(m, desimal)} ± {des(sd, desimal)}'


def persen(k: int, n: int) -> str:
    return f'{k} ({des(k / n * 100)}%)'


def nilai_p(p: float) -> str:
    return '< 0,001' if p < 0.001 else des(p, 3)


# ------------------------------------------------------------- data rekaan

def bangkitkan():
    r = random.Random(BENIH)
    peserta = []
    for i in range(N_REKRUT):
        usia = max(18, min(62, int(r.gauss(31, 9))))
        perempuan = r.random() < 0.94
        lama_bulan = max(3, int(r.lognormvariate(math.log(40), 0.8)))
        pendidikan = r.choices(['Dasar', 'Menengah', 'Tinggi'], [0.18, 0.52, 0.30])[0]
        organ = r.choices([1, 2, 3, 4], [0.22, 0.38, 0.28, 0.12])[0]
        gk = r.choices([0.0, 4.0, 7.5, 12.5, 20.0], [0.09, 0.31, 0.28, 0.22, 0.10])[0]

        sledai0 = max(0, min(24, int(abs(r.gauss(7.5, 4.5)))))

        # Keterlibatan menurun seiring waktu; sebagian peserta berhenti total.
        gigih = r.betavariate(2.2, 1.6)
        berhenti_hari = HARI_PANTAU + 1
        if r.random() < 0.30:
            berhenti_hari = int(r.triangular(7, HARI_PANTAU, 30))

        hari_isi = 0
        for h in range(HARI_PANTAU):
            if h >= berhenti_hari:
                break
            peluang = gigih * math.exp(-h / 130)
            if r.random() < peluang:
                hari_isi += 1

        aktif30 = hari_isi > 0 and berhenti_hari > HARI_PANTAU - 30
        tarik = r.random() < 0.036

        # Kepatuhan berkaitan lemah dengan aktivitas penyakit.
        mars0 = max(5, min(25, int(r.gauss(20 - sledai0 * 0.18, 3.2))))
        dosis_terjadwal = r.randint(60, 270)
        rasio = max(0.15, min(1.0, r.gauss(0.55 + (mars0 - 20) * 0.035, 0.16)))
        dosis_tercatat = int(dosis_terjadwal * rasio)
        diminum = int(dosis_tercatat * max(0.4, min(1.0, r.gauss(0.88, 0.10))))

        peserta.append({
            'usia': usia, 'perempuan': perempuan, 'lama': lama_bulan,
            'pendidikan': pendidikan, 'organ': organ, 'gk': gk,
            'sledai0': sledai0, 'hari_isi': hari_isi, 'aktif30': aktif30,
            'tarik': tarik, 'berhenti': berhenti_hari, 'mars0': mars0,
            'dosis_terjadwal': dosis_terjadwal, 'dosis_tercatat': dosis_tercatat,
            'diminum': diminum,
        })

    # Penilaian akhir hanya pada peserta yang datang kontrol bulan ketiga.
    for p in peserta:
        p['lengkap'] = (not p['tarik']) and r.random() < (0.55 + 0.35 * (p['hari_isi'] / HARI_PANTAU))
        if p['lengkap']:
            turun = r.gauss(1.6, 2.6) + (p['hari_isi'] / HARI_PANTAU) * 1.2
            p['sledai3'] = max(0, min(24, int(round(p['sledai0'] - turun))))
            p['mars3'] = max(5, min(25, int(round(p['mars0'] + r.gauss(0.4, 2.0)))))
    return peserta


# ------------------------------------------------------------------ tabel

def tabel(judul: str, kepala: list[str], baris: list[list[str]], catatan: str) -> str:
    out = [f'**{judul}**', '']
    out.append('| ' + ' | '.join(kepala) + ' |')
    out.append('|' + '|'.join(['---'] * len(kepala)) + '|')
    for b in baris:
        out.append('| ' + ' | '.join(b) + ' |')
    out += ['', f'*Cara membacanya:* {catatan}', '']
    return '\n'.join(out)


def main() -> int:
    d = bangkitkan()
    n = len(d)
    analisis = [p for p in d if not p['tarik']]
    na = len(analisis)
    lengkap = [p for p in analisis if p['lengkap']]

    bagian = ["""# Contoh tabel hasil penelitian

> # ⚠️ SELURUH ANGKA DI BAWAH INI REKAAN
>
> Tidak ada satu pun pasien sungguhan di dalam berkas ini. Angkanya dibangkitkan
> komputer dengan benih tetap, semata-mata untuk memperlihatkan **bentuk** tabel
> hasil sebelum data yang sebenarnya terkumpul.
>
> **Jangan memasukkan angka mana pun dari berkas ini ke dalam proposal, laporan,
> maupun publikasi.** Berkas ini bukan bagian naskah yang diserahkan.

Tabel-tabel berikut dihasilkan dengan menjalankan persis rencana analisis pada
subbab 3.11 di atas data rekaan tersebut, yaitu interval kepercayaan proporsi
metode Wilson, uji Wilcoxon berpasangan, dan korelasi Spearman. Karena itu
angka antartabel saling konsisten, dan tabel ini sekaligus membuktikan bahwa
rencana analisisnya memang dapat dijalankan.

Dibangkitkan ulang dengan `python3 penelitian/contoh-tabel-hasil.py`.

---
"""]

    # 4.1 Alur peserta
    tarik = sum(1 for p in d if p['tarik'])
    bagian.append(tabel(
        'Tabel 4.1. Alur peserta penelitian.',
        ['Tahap', 'Jumlah'],
        [
            ['Pasien dinilai kelayakannya', '78'],
            ['Tidak memenuhi kriteria', '15'],
            ['Menolak ikut serta', '8'],
            ['Terekrut dan memberi persetujuan', str(n)],
            ['Menarik persetujuan selama pemantauan', str(tarik)],
            ['Masuk analisis luaran utama', str(na)],
            ['Memiliki penilaian awal dan akhir lengkap', str(len(lengkap))],
        ],
        'Baris terakhir selalu lebih kecil daripada jumlah yang terekrut. Selisih '
        'itu bukan kegagalan penelitian, melainkan bagian dari yang diukur — '
        'lihat penanganan data hilang pada subbab 3.11.1.'))

    # 4.2 Karakteristik dasar
    pr = sum(1 for p in analisis if p['perempuan'])
    pend = {k: sum(1 for p in analisis if p['pendidikan'] == k) for k in ('Dasar', 'Menengah', 'Tinggi')}
    gk_ada = [p['gk'] for p in analisis if p['gk'] > 0]
    bagian.append(tabel(
        'Tabel 4.2. Karakteristik dasar peserta.',
        ['Karakteristik', f'n = {na}'],
        [
            ['Usia, tahun, rerata ± SB', rerata_sd([p['usia'] for p in analisis])],
            ['Perempuan, n (%)', persen(pr, na)],
            ['Lama sakit, bulan, median (RIK)', ringkas([p['lama'] for p in analisis], 0)],
            ['Pendidikan dasar, n (%)', persen(pend['Dasar'], na)],
            ['Pendidikan menengah, n (%)', persen(pend['Menengah'], na)],
            ['Pendidikan tinggi, n (%)', persen(pend['Tinggi'], na)],
            ['Jumlah organ terlibat, median (RIK)', ringkas([p['organ'] for p in analisis], 0)],
            ['Memakai glukokortikoid, n (%)', persen(len(gk_ada), na)],
            ['Dosis setara prednison, mg/hari, median (RIK)', ringkas(gk_ada, 1)],
            ['SLEDAI-2K awal, median (RIK)', ringkas([p['sledai0'] for p in analisis], 0)],
        ],
        'Tabel pertama pada tiap laporan penelitian. Gunanya bukan menjawab '
        'pertanyaan penelitian, melainkan memberi tahu pembaca kepada siapa hasil '
        'ini berlaku.'))

    # 4.3 Luaran utama
    aktif = sum(1 for p in analisis if p['aktif30'])
    p_ret, lo, hi = wilson(aktif, na)
    isi50 = sum(1 for p in analisis if p['hari_isi'] >= 45)
    p50, lo50, hi50 = wilson(isi50, na)
    bagian.append(tabel(
        'Tabel 4.3. Retensi dan kelengkapan pengisian (luaran utama).',
        ['Luaran', 'n/N', 'Proporsi (IK 95%)'],
        [
            ['Aktif pada 30 hari terakhir', f'{aktif}/{na}',
             f'{des(p_ret*100)}% ({des(lo*100)}–{des(hi*100)})'],
            ['Mengisi ≥ 50% hari pemantauan', f'{isi50}/{na}',
             f'{des(p50*100)}% ({des(lo50*100)}–{des(hi50*100)})'],
            ['Hari terisi dari 90 hari, median (RIK)', '—',
             ringkas([p['hari_isi'] for p in analisis], 0)],
        ],
        'Inilah jawaban atas pertanyaan penelitian utama. Yang dilaporkan bukan '
        'sekadar angka tengahnya, melainkan interval kepercayaannya — itulah '
        'sebabnya besar sampel dihitung dari presisi pada subbab 3.5.'))

    # 4.4 Aktivitas penyakit
    a0 = [p['sledai0'] for p in lengkap]
    a3 = [p['sledai3'] for p in lengkap]
    w, pw = wilcoxon(a0, a3)
    t, pt = uji_t_berpasangan(a0, a3)
    bagian.append(tabel(
        'Tabel 4.4. Aktivitas penyakit pada penilaian awal dan akhir.',
        ['Penilaian', f'n = {len(lengkap)}', 'Uji', 'Nilai p'],
        [
            ['SLEDAI-2K awal, median (RIK)', ringkas(a0, 0), 'Wilcoxon berpasangan', nilai_p(pw)],
            ['SLEDAI-2K bulan ke-3, median (RIK)', ringkas(a3, 0), '', ''],
            ['Selisih, median (RIK)',
             ringkas([y - x for x, y in zip(a0, a3)], 0)
             .replace('–', ' hingga ').replace('-', '−'), '', ''],
        ],
        f'Hanya {len(lengkap)} dari {na} peserta yang punya kedua penilaian, dan '
        'jumlah itu wajib dicantumkan. Penelitian ini tanpa kelompok pembanding, '
        'sehingga perubahan apa pun TIDAK boleh dibaca sebagai akibat aplikasi.'))

    # 4.5 Kepatuhan
    rasio_catat = [p['dosis_tercatat'] / p['dosis_terjadwal'] * 100 for p in analisis]
    rasio_minum = [p['diminum'] / p['dosis_tercatat'] * 100 for p in analisis if p['dosis_tercatat']]
    bagian.append(tabel(
        'Tabel 4.5. Kepatuhan minum obat.',
        ['Ukuran', 'Penyebut', f'n = {na}'],
        [
            ['MARS-5 awal, median (RIK)', 'skor 5–25', ringkas([p['mars0'] for p in analisis], 0)],
            ['Kepatuhan tercatat, %, median (RIK)', 'dosis yang tercatat', ringkas(rasio_minum, 1)],
            ['Cakupan pencatatan, %, median (RIK)', 'dosis terjadwal', ringkas(rasio_catat, 1)],
        ],
        'Tiga baris ini TIDAK boleh dijumlahkan atau dibandingkan langsung, sebab '
        'penyebutnya berbeda. Cakupan pencatatan rendah berarti banyak dosis tidak '
        'dicatat — bukan berarti tidak diminum.'))

    # 4.6 Hubungan kepatuhan dan aktivitas
    x = [p['mars0'] for p in lengkap]
    y = [p['sledai3'] for p in lengkap]
    rho, prho = spearman(x, y)
    x2 = [p['diminum'] / p['dosis_tercatat'] * 100 for p in lengkap if p['dosis_tercatat']]
    y2 = [p['sledai3'] for p in lengkap if p['dosis_tercatat']]
    rho2, prho2 = spearman(x2, y2)
    bagian.append(tabel(
        'Tabel 4.6. Hubungan kepatuhan minum obat dengan aktivitas penyakit.',
        ['Pasangan variabel', 'n', 'Spearman rho', 'Nilai p'],
        [
            ['MARS-5 awal vs SLEDAI-2K bulan ke-3', str(len(x)),
             des(rho, 3), nilai_p(prho)],
            ['Kepatuhan tercatat vs SLEDAI-2K bulan ke-3', str(len(x2)),
             des(rho2, 3), nilai_p(prho2)],
        ],
        f'Pada {len(x)} peserta, hanya rho sekitar 0,37 atau lebih yang terdeteksi '
        'dengan kekuatan 80% (subbab 3.5). Hasil yang tidak bermakna di sini '
        'berarti "belum terbukti", BUKAN "terbukti tidak ada hubungan".'))

    # 4.7 Tanda bahaya
    r = random.Random(BENIH + 1)
    darurat = sum(1 for _ in range(na) if r.random() < 0.13)
    mendesak = sum(1 for _ in range(na) if r.random() < 0.31)
    bagian.append(tabel(
        'Tabel 4.7. Peristiwa penyaringan tanda bahaya.',
        ['Tingkat', 'Peserta yang mengalami ≥ 1 kali, n (%)', 'Ditindaklanjuti dalam 24 jam, n (%)'],
        [
            ['Darurat', persen(darurat, na), persen(max(0, darurat - 1), max(1, darurat))],
            ['Mendesak', persen(mendesak, na), persen(int(mendesak * 0.72), max(1, mendesak))],
        ],
        'Kolom kedua mengukur mesin aturannya, kolom ketiga mengukur alur '
        'pelayanannya. Peringatan yang terbit tetapi tidak ditindaklanjuti adalah '
        'temuan keselamatan tersendiri.'))

    # 4.8 Alasan berhenti
    berhenti = [p for p in analisis if not p['aktif30']]
    nb = len(berhenti)
    alasan = [('Merasa sudah membaik sehingga tidak perlu mencatat', 0.27),
              ('Bosan atau merasa mengisi setiap hari melelahkan', 0.24),
              ('Kesulitan teknis, termasuk pengingat tidak berbunyi', 0.20),
              ('Ponsel rusak, hilang, atau berganti', 0.13),
              ('Kuota internet atau daya baterai', 0.09),
              ('Tidak dapat dihubungi', 0.07)]
    bagian.append(tabel(
        'Tabel 4.8. Alasan berhenti memakai aplikasi.',
        ['Alasan', f'n = {nb}'],
        [[a, persen(round(nb * b), nb)] for a, b in alasan],
        'Tabel ini yang paling berguna bagi pengembangan lanjutan, dan datanya '
        'berasal dari wawancara singkat pada subbab 3.9 butir 6 — bukan dari '
        'aplikasi. Tanpa wawancara itu, kolom ini kosong.'))

    isi = '\n'.join(bagian) + """\n---

## Yang tidak dapat dijawab penelitian ini

Perlu dinyatakan sekali lagi, sebab tabel yang rapi mudah membuat orang lupa.
Penelitian ini tanpa kelompok pembanding. Apabila SLEDAI-2K turun pada Tabel
4.4, penurunan itu dapat disebabkan oleh perjalanan alami penyakit, oleh
penyesuaian obat yang dilakukan dokter, oleh perhatian tambahan karena menjadi
peserta penelitian, atau memang oleh aplikasi. Rancangan ini tidak dapat
memisahkan keempatnya, dan naskah hasil harus mengatakannya secara terbuka.

Yang benar-benar dijawab penelitian ini hanyalah Tabel 4.3, yaitu apakah pasien
LES di RSUP H. Adam Malik bersedia dan mampu memakai aplikasi ini selama tiga
bulan. Tabel-tabel lain menggambarkan keadaan peserta selama periode itu, dan
menyiapkan angka untuk perhitungan besar sampel penelitian berikutnya.
"""
    HASIL.write_text(isi, encoding='utf-8')
    print(f'Tersimpan: {HASIL}')
    print(f'  peserta rekaan {n}, masuk analisis {na}, penilaian lengkap {len(lengkap)}')
    print(f'  retensi {aktif}/{na} = {des(p_ret*100)}% (IK95 {des(lo*100)}–{des(hi*100)})')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
