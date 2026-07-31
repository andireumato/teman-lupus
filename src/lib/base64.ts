/**
 * Base64 untuk data biner.
 *
 * Ditulis sendiri, bukan memakai `btoa`/`Buffer`/`TextEncoder`: tidak satu pun
 * dari ketiganya dijamin ada di Hermes, dan zip ekspor harus diserahkan ke
 * Storage Access Framework dalam bentuk string base64.
 *
 * Dipisah ke sini, bukan ditanam di layar ekspor, dengan alasan yang sama
 * seperti `csv.ts`: satu byte yang salah di padding menghasilkan zip rusak yang
 * baru ketahuan saat dibuka di komputer, jauh dari tempat kesalahannya.
 */

const ABJAD = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

/** RFC 4648 §4 — abjad baku, dengan padding `=`. */
export function keBase64(data: Uint8Array): string {
  // Dikumpulkan per potongan lalu digabung sekali: rangkaian `+=` sepanjang
  // ratusan ribu kali membengkakkan memori di Hermes.
  const potongan: string[] = [];
  let buf = '';

  let i = 0;
  for (; i + 2 < data.length; i += 3) {
    const n = (data[i] << 16) | (data[i + 1] << 8) | data[i + 2];
    buf += ABJAD[(n >> 18) & 63] + ABJAD[(n >> 12) & 63] + ABJAD[(n >> 6) & 63] + ABJAD[n & 63];
    if (buf.length >= 8192) {
      potongan.push(buf);
      buf = '';
    }
  }

  // Sisa 1 atau 2 byte: bit yang kurang diisi nol, lalu ditambal `=` sebanyak
  // byte yang tidak ada. Inilah bagian yang paling mudah salah.
  const sisa = data.length - i;
  if (sisa === 1) {
    const n = data[i] << 16;
    buf += ABJAD[(n >> 18) & 63] + ABJAD[(n >> 12) & 63] + '==';
  } else if (sisa === 2) {
    const n = (data[i] << 16) | (data[i + 1] << 8);
    buf += ABJAD[(n >> 18) & 63] + ABJAD[(n >> 12) & 63] + ABJAD[(n >> 6) & 63] + '=';
  }

  potongan.push(buf);
  return potongan.join('');
}
