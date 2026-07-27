-- ============================================================
-- TEMAN LUPUS — sisi dokter: penautan pasien & akses profil
--
-- Tiga hal:
--   1. profiles.kode_dokter — kode pendek yang dibagikan dokter
--   2. fungsi tautkan_dokter() — dipanggil PASIEN untuk menautkan diri
--   3. kebijakan RLS agar dokter bisa membaca nama pasiennya
--
-- Jalankan di Supabase Dashboard → SQL Editor. Aman dijalankan ulang.
-- ============================================================

-- ---------- 1. Kode dokter ----------

alter table public.profiles
  add column if not exists kode_dokter text;

-- Unik hanya di antara yang terisi; pasien tidak punya kode.
create unique index if not exists profiles_kode_dokter_unik
  on public.profiles (kode_dokter)
  where kode_dokter is not null;

-- ---------- 2. Penautan oleh pasien ----------

-- Kenapa lewat fungsi, bukan `update` biasa dari aplikasi:
--
-- Untuk menautkan diri, pasien perlu tahu id profil dokter — dan menemukannya
-- berarti boleh membaca baris `profiles` milik orang lain. Kalau itu dibuka
-- lewat RLS, siapa pun yang login bisa menelusuri daftar pengguna.
--
-- `security definer` membuat pencarian terjadi DI DALAM database dengan hak
-- lebih tinggi, dan yang keluar hanya jawaban ya/tidak. Aplikasi tidak pernah
-- melihat baris profil dokter, hanya hasil penautannya.
create or replace function public.tautkan_dokter(kode text)
returns table (nama_dokter text)
language plpgsql
security definer
set search_path = public
as $$
declare
  d_id   uuid;
  d_nama text;
begin
  select p.id, p.nama into d_id, d_nama
  from public.profiles p
  where p.kode_dokter is not null
    and upper(p.kode_dokter) = upper(trim(kode))
    and p.role = 'doctor';

  if d_id is null then
    raise exception 'Kode dokter tidak ditemukan' using errcode = 'no_data_found';
  end if;

  -- Hanya baris pasien milik pemanggil yang boleh diubah.
  update public.patients
  set doctor_id = d_id
  where profile_id = auth.uid();

  if not found then
    raise exception 'Data pasien belum siap' using errcode = 'no_data_found';
  end if;

  return query select d_nama;
end;
$$;

revoke all on function public.tautkan_dokter(text) from public;
grant execute on function public.tautkan_dokter(text) to authenticated;

-- Melepas tautan tidak perlu fungsi khusus: pasien memang boleh menulis
-- barisnya sendiri lewat kebijakan patients_patient_write.

-- ---------- 3. Dokter boleh membaca profil pasiennya ----------

-- Tanpa ini dokter hanya melihat deretan UUID: kebijakan `profiles_self`
-- membatasi pembacaan pada diri sendiri saja.
drop policy if exists profiles_doctor_read on public.profiles;
create policy profiles_doctor_read on public.profiles
  for select using (
    id in (select profile_id from public.patients where doctor_id = auth.uid())
  );

-- Pasien juga perlu melihat NAMA dokternya setelah tertaut.
drop policy if exists profiles_patient_read_doctor on public.profiles;
create policy profiles_patient_read_doctor on public.profiles
  for select using (
    id in (select doctor_id from public.patients where profile_id = auth.uid())
  );
