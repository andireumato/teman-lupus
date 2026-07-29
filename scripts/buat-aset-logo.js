/* Merakit aset logo Teman Lupus dari satu berkas sumber. */
const J = require('/Users/dr.andi/Code/teman-lupus/node_modules/jimp-compact/dist/jimp.js');
const path = require('path');

const SUMBER = '/Users/dr.andi/Downloads/teman-lupus-logo.png';
const KELUAR =
  '/private/tmp/claude-501/-Users-dr-andi-Code/409b7f51-2cf4-49fa-aafc-dfa0eecb49ac/scratchpad/aset';
const LATAR = 0xfafaf6ff; // latar di dalam lingkaran, dicuplik dari sumbernya

(async () => {
  const src = await J.read(SUMBER);
  const W = src.bitmap.width;
  const px = (img, x, y) => J.intToRGBA(img.getPixelColor(x, y));

  // ---- 1. Batas kupu-kupu ----
  // Dipindai hanya jauh di dalam lingkaran (jarak < 195 dari pusat) supaya
  // cincin ungu di tepi tidak ikut terhitung sebagai bagian kupu-kupu, dan
  // di atas tulisan supaya hurufnya tidak ikut.
  const PUSAT = W / 2;
  const berwarna = (p) => {
    const max = Math.max(p.r, p.g, p.b),
      min = Math.min(p.r, p.g, p.b);
    return max - min > 30 && max > 80;
  };
  let minX = 9999,
    maxX = -1,
    minY = 9999,
    maxY = -1;
  for (let y = 40; y < 296; y++) {
    for (let x = 40; x < W - 40; x++) {
      if (Math.hypot(x - PUSAT, y - PUSAT) > 195) continue;
      if (!berwarna(px(src, x, y))) continue;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }
  const bw = maxX - minX + 1,
    bh = maxY - minY + 1;
  console.log('kupu-kupu:', { minX, minY, lebar: bw, tinggi: bh });

  // Latar dibuat transparan: menempelkan potongan persegi ke kanvas berwarna
  // lain meninggalkan garis kotak samar, karena latar sumbernya tidak rata
  // (artefak JPEG). Dengan alpha, yang tersisa hanya bentuk kupu-kupunya.
  const kupu = src.clone().crop(minX, minY, bw, bh);
  kupu.scan(0, 0, bw, bh, function (x, y, idx) {
    const d = this.bitmap.data;
    const r = d[idx],
      g = d[idx + 1],
      b = d[idx + 2];
    const lum = (r + g + b) / 3;
    const sat = Math.max(r, g, b) - Math.min(r, g, b);
    if (sat < 14 && lum > 238) d[idx + 3] = 0;
    else if (sat < 22 && lum > 224) d[idx + 3] = Math.round((255 * (238 - lum)) / 14);
  });

  // ---- 2. Ikon aplikasi: kupu-kupu di kanvas persegi, latar sama ----
  // Tanpa transparansi — iOS menolak ikon ber-alpha.
  const buatIkon = (sisi, isiRasio) => {
    const kanvas = new J(sisi, sisi, LATAR);
    const target = Math.round(sisi * isiRasio);
    const skala = Math.min(target / bw, target / bh);
    const w = Math.round(bw * skala),
      h = Math.round(bh * skala);
    const k = kupu.clone().resize(w, h);
    return kanvas.composite(k, Math.round((sisi - w) / 2), Math.round((sisi - h) / 2));
  };

  await buatIkon(1024, 0.78).writeAsync(path.join(KELUAR, 'icon.png'));

  // ---- 3. Android adaptive icon ----
  // Sistem memotong ikonnya jadi lingkaran/kotak-bulat; hanya ~66% bagian
  // tengah yang dijamin aman, jadi kupu-kupunya dibuat lebih kecil.
  const fg = new J(1024, 1024, 0x00000000);
  {
    const target = Math.round(1024 * 0.52);
    const skala = Math.min(target / bw, target / bh);
    const w = Math.round(bw * skala),
      h = Math.round(bh * skala);
    fg.composite(kupu.clone().resize(w, h), Math.round((1024 - w) / 2), Math.round((1024 - h) / 2));
  }
  await fg.writeAsync(path.join(KELUAR, 'android-icon-foreground.png'));
  await new J(1024, 1024, LATAR).writeAsync(path.join(KELUAR, 'android-icon-background.png'));

  // ---- 4. Logo utuh untuk layar, sudut hitamnya dibuat transparan ----
  // Sumbernya punya sudut hitam di luar lingkaran; kalau dibiarkan, logo
  // tampak sebagai kotak hitam di atas latar aplikasi yang ungu muda.
  const logo = src.clone();
  const cx = W / 2,
    cy = W / 2,
    r = W / 2 - 2;
  logo.scan(0, 0, W, W, function (x, y, idx) {
    const d = Math.hypot(x - cx, y - cy);
    if (d > r) {
      this.bitmap.data[idx + 3] = 0; // di luar lingkaran → transparan
    } else if (d > r - 2) {
      this.bitmap.data[idx + 3] = Math.round((255 * (r - d)) / 2); // tepi dihaluskan
    }
  });
  await logo.clone().resize(512, 512).writeAsync(path.join(KELUAR, 'logo-teman-lupus.png'));

  // ---- 5. Splash & favicon ----
  await buatIkon(512, 0.72).writeAsync(path.join(KELUAR, 'splash-icon.png'));
  await logo.clone().resize(96, 96).writeAsync(path.join(KELUAR, 'favicon.png'));

  console.log('selesai');
})().catch((e) => {
  console.error('GAGAL:', e.message);
  process.exit(1);
});
