/**
 * Kode dokter: dibacakan atau diketik ulang oleh pasien, jadi bentuknya
 * dipilih agar sulit salah baca.
 *
 * Yang dibuang dari abjadnya adalah pasangan yang paling sering tertukar saat
 * menyalin dari layar atau mendengar: 0/O, 1/I/L, 5/S, 8/B. Tersisa 27
 * karakter, jadi kode 6 karakter memberi 27⁶ ≈ 387 juta kemungkinan.
 * Tabrakan tetap ditangani unique index di database, bukan diandaikan tidak
 * pernah terjadi.
 */

export const ABJAD_KODE = '234679ACDEFGHJKMNPQRTUVWXYZ';

export const PANJANG_KODE = 6;

/** Rapikan masukan pasien: huruf besar, tanpa spasi atau tanda hubung. */
export function normalkanKode(masukan: string): string {
  return masukan.toUpperCase().replace(/[^A-Z0-9]/g, '');
}

/** Format tampilan: "RA4K7P" → "RA4-K7P". */
export function formatKode(kode: string): string {
  const bersih = normalkanKode(kode);
  if (bersih.length !== PANJANG_KODE) return bersih;
  return `${bersih.slice(0, 3)}-${bersih.slice(3)}`;
}

/** True bila panjang & karakternya sah — dicek sebelum menembak jaringan. */
export function kodeValid(masukan: string): boolean {
  const k = normalkanKode(masukan);
  return k.length === PANJANG_KODE && [...k].every((c) => ABJAD_KODE.includes(c));
}

/** Kode acak baru. Keunikannya dijamin unique index di database. */
export function buatKode(acak: () => number = Math.random): string {
  let k = '';
  for (let i = 0; i < PANJANG_KODE; i++) {
    k += ABJAD_KODE[Math.floor(acak() * ABJAD_KODE.length)];
  }
  return k;
}
