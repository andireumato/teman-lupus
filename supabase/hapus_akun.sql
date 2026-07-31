-- ============================================================
-- TEMAN LUPUS — hapus akun sendiri
--
-- Dua alasan fitur ini wajib ada:
--   1. UU PDP 27/2022 — hak penghapusan data pribadi, dan data kesehatan
--      tergolong data pribadi spesifik.
--   2. Google Play mewajibkan aplikasi yang punya pendaftaran akun menyediakan
--      cara menghapus akun DAN seluruh datanya — bukan sekadar membekukan.
--
-- RANTAI PENGHAPUSAN (diperiksa dari pg_constraint 31 Juli 2026):
--
--   auth.users --CASCADE--> profiles --CASCADE--> patients --CASCADE--> 13 tabel
--
-- Tiga belas tabel itu: daily_checkins, medications, med_logs, med_side_effects,
-- medication_events, mars_assessments, flare_checks, lab_results,
-- sledai_assessments, visits, visit_questions, alerts, lupusqol_assessments.
-- `alert_tindak_lanjut` ikut lewat CASCADE dari `alerts`.
--
-- Artinya untuk PASIEN cukup satu baris `delete from auth.users` — sisanya
-- diurus database. Menghapus tabel satu per satu dari aplikasi justru berbahaya:
-- daftar itu akan basi diam-diam setiap kali ada tabel baru, dan yang
-- tertinggal adalah data kesehatan yang mestinya sudah hilang.
--
-- Jalankan di Supabase Dashboard → SQL Editor. Aman dijalankan ulang.
-- ============================================================

-- ---------- 1. Pratinjau ----------
--
-- Ditampilkan SEBELUM pengguna mengetik konfirmasi. Penghapusan permanen tanpa
-- angka yang konkret adalah tombol yang tidak bisa dinilai akibatnya.

create or replace function public.pratinjau_hapus_akun()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_role text;
  v_patient uuid;
  v_out jsonb;
  t text;
  n bigint;
begin
  if v_uid is null then
    raise exception 'Tidak ada sesi.' using errcode = '42501';
  end if;

  select role into v_role from public.profiles where id = v_uid;
  select id into v_patient from public.patients where profile_id = v_uid;

  v_out := jsonb_build_object('peran', coalesce(v_role, 'patient'));

  if v_patient is not null then
    -- Dihitung lewat SQL dinamis dan disaring `to_regclass`: tidak semua
    -- project sudah menjalankan setiap skrip migrasi, dan pratinjau yang
    -- meledak karena satu tabel belum ada akan memblokir hak penghapusan
    -- yang justru dijamin undang-undang.
    foreach t in array array[
      'daily_checkins', 'medications', 'med_logs', 'med_side_effects',
      'medication_events', 'mars_assessments', 'flare_checks', 'lab_results',
      'sledai_assessments', 'visits', 'visit_questions', 'alerts',
      'lupusqol_assessments'
    ] loop
      if to_regclass('public.' || t) is not null then
        execute format('select count(*) from public.%I where patient_id = $1', t)
          into n using v_patient;
        v_out := v_out || jsonb_build_object(t, n);
      end if;
    end loop;
  end if;

  if v_role = 'doctor' then
    v_out := v_out || jsonb_build_object(
      'pasien_tertaut', (select count(*) from public.patients where doctor_id = v_uid)
    );
  end if;

  return v_out;
end;
$$;

-- ---------- 2. Penghapusan ----------

create or replace function public.hapus_akun_saya()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'Tidak ada sesi.' using errcode = '42501';
  end if;

  -- DOKTER: tautannya dilepas, data pasiennya TIDAK ikut terhapus.
  --
  -- Bukan sekadar sopan santun — ketiga foreign key ini `NO ACTION`, jadi
  -- tanpa dilepas lebih dulu penghapusan akan gagal dengan galat foreign key
  -- yang tidak berarti apa-apa bagi pemakainya. Dan secara isi: catatan itu
  -- milik pasien, bukan milik dokternya.
  --
  -- Konsekuensi yang harus diketahui dokter sebelum menyetujui: pasiennya
  -- kehilangan tautan dan harus menautkan diri ke dokter lain, dan kolom
  -- "diperiksa oleh" pada penilaian SLEDAI serta kunjungan lamanya menjadi
  -- kosong. Kolom itu tidak ikut ekspor penelitian, jadi analisis tidak
  -- terpengaruh.
  update public.patients set doctor_id = null where doctor_id = v_uid;
  update public.sledai_assessments set doctor_id = null where doctor_id = v_uid;
  update public.visits set doctor_id = null where doctor_id = v_uid;

  -- `alert_tindak_lanjut.doctor_id` sengaja dibiarkan: kolomnya `not null` dan
  -- tanpa foreign key, jadi ia tidak memblokir apa pun. Yang tertinggal hanya
  -- UUID tanpa baris profil untuk menerjemahkannya — jejak audit yang sudah
  -- tidak bisa ditautkan kembali ke seseorang.

  -- Satu baris ini menghapus seluruh sisanya lewat rantai CASCADE di atas.
  delete from auth.users where id = v_uid;
end;
$$;

-- `anon` disebut terpisah dari `public`: default privileges Supabase memberi
-- EXECUTE eksplisit ke `anon`, dan mencabut dari pseudo-role `public` tidak
-- menyentuhnya. Lihat supabase/kunci_fungsi_dari_anon.sql.
revoke all on function public.pratinjau_hapus_akun() from public;
revoke all on function public.pratinjau_hapus_akun() from anon;
grant execute on function public.pratinjau_hapus_akun() to authenticated;

revoke all on function public.hapus_akun_saya() from public;
revoke all on function public.hapus_akun_saya() from anon;
grant execute on function public.hapus_akun_saya() to authenticated;
