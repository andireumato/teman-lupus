-- ============================================================
-- TEMAN LUPUS — Skema Database Supabase (MVP)
-- Cara pakai: Supabase Dashboard → SQL Editor → New query →
-- tempel SELURUH isi file ini → klik RUN.
-- Aman dijalankan ulang (pakai "if not exists" / "drop policy if exists").
-- ============================================================

-- ---------- 1. PROFILES (semua pengguna: pasien & dokter) ----------
create table if not exists public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  role        text not null default 'patient' check (role in ('patient','doctor','admin')),
  nama        text,
  no_hp       text,
  created_at  timestamptz not null default now()
);

-- Buat profil otomatis saat ada pengguna baru mendaftar
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, nama, role)
  values (new.id, new.raw_user_meta_data->>'nama',
          coalesce(new.raw_user_meta_data->>'role','patient'));
  return new;
end; $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------- 2. PATIENTS (data klinis pasien) ----------
create table if not exists public.patients (
  id             uuid primary key default gen_random_uuid(),
  profile_id     uuid not null references public.profiles(id) on delete cascade,
  doctor_id      uuid references public.profiles(id),
  tgl_diagnosis  date,
  klasifikasi    text,
  organ_terlibat text[],
  created_at     timestamptz not null default now()
);

-- ---------- 3. MEDICATIONS (daftar obat) ----------
create table if not exists public.medications (
  id          uuid primary key default gen_random_uuid(),
  patient_id  uuid not null references public.patients(id) on delete cascade,
  nama_obat   text not null,
  dosis       text,
  jadwal      text,
  aktif       boolean not null default true,
  created_at  timestamptz not null default now()
);

-- ---------- 4. MED_LOGS (catatan minum obat harian) ----------
create table if not exists public.med_logs (
  id            uuid primary key default gen_random_uuid(),
  patient_id    uuid not null references public.patients(id) on delete cascade,
  medication_id uuid references public.medications(id) on delete set null,
  tanggal       date not null default current_date,
  diminum       boolean,
  alasan        text,
  created_at    timestamptz not null default now()
);

-- ---------- 5. DAILY_CHECKINS (check-in harian) ----------
create table if not exists public.daily_checkins (
  id          uuid primary key default gen_random_uuid(),
  patient_id  uuid not null references public.patients(id) on delete cascade,
  tanggal     date not null default current_date,
  mood        int  check (mood between 1 and 5),
  lelah       int  check (lelah between 0 and 4),
  nyeri_sendi int  check (nyeri_sendi between 0 and 3),
  gejala      jsonb,
  foto_url    text,
  catatan     text,
  created_at  timestamptz not null default now()
);

-- ---------- 6. MARS_ASSESSMENTS (kepatuhan MARS-5) ----------
create table if not exists public.mars_assessments (
  id          uuid primary key default gen_random_uuid(),
  patient_id  uuid not null references public.patients(id) on delete cascade,
  tanggal     date not null default current_date,
  item1 int, item2 int, item3 int, item4 int, item5 int,
  total       int,
  kategori    text,
  created_at  timestamptz not null default now()
);

-- ---------- 7. FLARE_CHECKS (triase Cek Flare) ----------
create table if not exists public.flare_checks (
  id           uuid primary key default gen_random_uuid(),
  patient_id   uuid not null references public.patients(id) on delete cascade,
  waktu        timestamptz not null default now(),
  tanda_bahaya jsonb,
  gejala       jsonb,
  hasil        text check (hasil in ('green','yellow','red'))
);

-- ---------- 8. SLEDAI_ASSESSMENTS (diisi dokter) ----------
create table if not exists public.sledai_assessments (
  id          uuid primary key default gen_random_uuid(),
  patient_id  uuid not null references public.patients(id) on delete cascade,
  doctor_id   uuid references public.profiles(id),
  tanggal     date not null default current_date,
  deskriptor  jsonb,
  total       int,
  kategori    text,
  created_at  timestamptz not null default now()
);

-- ---------- 9. VISITS (kunjungan) ----------
create table if not exists public.visits (
  id          uuid primary key default gen_random_uuid(),
  patient_id  uuid not null references public.patients(id) on delete cascade,
  doctor_id   uuid references public.profiles(id),
  tanggal     date not null default current_date,
  catatan     text
);

-- ---------- 10. ALERTS (peringatan untuk dokter) ----------
create table if not exists public.alerts (
  id          uuid primary key default gen_random_uuid(),
  patient_id  uuid not null references public.patients(id) on delete cascade,
  jenis       text,
  pesan       text,
  selesai     boolean not null default false,
  created_at  timestamptz not null default now()
);

-- ============================================================
-- KEAMANAN: Row Level Security (RLS)
-- Pasien hanya lihat datanya; dokter hanya pasien yang ditautkan.
-- ============================================================
alter table public.profiles            enable row level security;
alter table public.patients            enable row level security;
alter table public.medications         enable row level security;
alter table public.med_logs            enable row level security;
alter table public.daily_checkins      enable row level security;
alter table public.mars_assessments    enable row level security;
alter table public.flare_checks        enable row level security;
alter table public.sledai_assessments  enable row level security;
alter table public.visits              enable row level security;
alter table public.alerts              enable row level security;

-- PROFILES: tiap orang kelola profilnya sendiri
drop policy if exists profiles_self on public.profiles;
create policy profiles_self on public.profiles
  for all using (id = auth.uid()) with check (id = auth.uid());

-- PATIENTS: pasien lihat dirinya; dokter lihat pasiennya
drop policy if exists patients_access on public.patients;
create policy patients_access on public.patients
  for select using (profile_id = auth.uid() or doctor_id = auth.uid());
drop policy if exists patients_patient_write on public.patients;
create policy patients_patient_write on public.patients
  for all using (profile_id = auth.uid()) with check (profile_id = auth.uid());

-- Fungsi bantu: id pasien milik pengguna login (sebagai pasien)
create or replace function public.my_patient_ids()
returns setof uuid language sql security definer stable set search_path = public as $$
  select id from public.patients where profile_id = auth.uid();
$$;
-- Fungsi bantu: id pasien yang ditangani pengguna login (sebagai dokter)
create or replace function public.my_doctor_patient_ids()
returns setof uuid language sql security definer stable set search_path = public as $$
  select id from public.patients where doctor_id = auth.uid();
$$;

-- Template kebijakan untuk tabel anak (pasien CRUD; dokter baca)
do $$
declare t text;
begin
  foreach t in array array['medications','med_logs','daily_checkins',
      'mars_assessments','flare_checks','visits','alerts','sledai_assessments']
  loop
    execute format('drop policy if exists %1$s_patient on public.%1$s;', t);
    execute format($f$create policy %1$s_patient on public.%1$s
        for all using (patient_id in (select public.my_patient_ids()))
        with check (patient_id in (select public.my_patient_ids()));$f$, t);

    execute format('drop policy if exists %1$s_doctor_read on public.%1$s;', t);
    execute format($f$create policy %1$s_doctor_read on public.%1$s
        for select using (patient_id in (select public.my_doctor_patient_ids()));$f$, t);
  end loop;
end $$;

-- Dokter boleh menulis SLEDAI & kunjungan & menutup alert pasiennya
drop policy if exists sledai_doctor_write on public.sledai_assessments;
create policy sledai_doctor_write on public.sledai_assessments
  for all using (patient_id in (select public.my_doctor_patient_ids()))
  with check (patient_id in (select public.my_doctor_patient_ids()));
drop policy if exists visits_doctor_write on public.visits;
create policy visits_doctor_write on public.visits
  for all using (patient_id in (select public.my_doctor_patient_ids()))
  with check (patient_id in (select public.my_doctor_patient_ids()));
drop policy if exists alerts_doctor_update on public.alerts;
create policy alerts_doctor_update on public.alerts
  for update using (patient_id in (select public.my_doctor_patient_ids()));

-- ============================================================
-- SELESAI. Setelah RUN sukses, cek Table Editor → tabel-tabel sudah ada.
-- ============================================================
