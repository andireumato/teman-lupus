-- ============================================================
-- PERBAIKAN BARIS SLEDAI WARISAN PROTOTIPE WEB
--
-- Empat baris menyimpan `deskriptor` sebagai LARIK LABEL
-- (["Artritis", "Ruam"]) alih-alih objek berkunci
-- ({"artritis": true, "ruam": true}). Akibatnya baris itu tidak bisa
-- dinilai untuk DORIS/LLDAS dan tidak terpakai untuk penelitian.
--
-- Pemetaannya diverifikasi lebih dulu: menjumlahkan ulang bobot tiap label
-- menghasilkan angka yang SAMA PERSIS dengan kolom `total` yang tersimpan
-- pada keempat baris. Kalau pemetaannya keliru, totalnya tidak akan cocok.
--
-- `total` dan `kategori` sengaja TIDAK diubah — keduanya sudah benar.
-- Yang diperbaiki hanya bentuk `deskriptor`.
-- ============================================================

update public.sledai_assessments
   set deskriptor = '{"artritis": true, "ruam": true}'::jsonb
 where id = 'd8f45751-066d-4c62-a41d-58b2cc76dcbe'
   and jsonb_typeof(deskriptor) = 'array';

update public.sledai_assessments
   set deskriptor = '{"ruam": true}'::jsonb
 where id = '403fa104-c84f-4114-a722-6c042a1f50af'
   and jsonb_typeof(deskriptor) = 'array';

update public.sledai_assessments
   set deskriptor = '{"artritis": true, "ruam": true, "alopesia": true, "ulkus_mukosa": true, "demam": true}'::jsonb
 where id = '75b00140-e04a-470c-8f25-6ee93d9069b6'
   and jsonb_typeof(deskriptor) = 'array';

update public.sledai_assessments
   set deskriptor = '{"vaskulitis": true, "alopesia": true, "komplemen_rendah": true, "dna_meningkat": true}'::jsonb
 where id = 'bf549523-524c-4611-8fa6-579bc33813e0'
   and jsonb_typeof(deskriptor) = 'array';

-- Verifikasi: harus mengembalikan 0 baris.
select count(*) as sisa_larik from public.sledai_assessments
 where jsonb_typeof(deskriptor) = 'array';
