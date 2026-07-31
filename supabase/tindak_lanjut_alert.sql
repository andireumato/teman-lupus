-- ============================================================
-- TEMAN LUPUS — tindak lanjut sesudah peringatan red-flag
--
-- Sebelum ini, menutup peringatan hanya membalik `alerts.selesai` jadi true.
-- Artinya pertanyaan yang paling penting tidak pernah terjawab: sesudah pasien
-- disuruh ke IGD, apa yang sebenarnya terjadi? Ringkasan pra-kunjungan selalu
-- berakhir "(tindak lanjut pasien belum tercatat)", dan ekspor penelitian tidak
-- punya kolom keluaran sama sekali.
--
-- Yang ditambahkan:
--   1. tabel alert_tindak_lanjut — dua sumbu berkode + catatan bebas
--   2. fungsi tutup_alert() — menulis tindak lanjut DAN menandai selesai
--
-- Jalankan di Supabase Dashboard → SQL Editor. Aman dijalankan ulang.
-- ============================================================

-- ---------- 1. Tabel ----------
--
-- Kenapa TABEL TERPISAH, bukan kolom tambahan di `alerts`:
--
-- `catatan` adalah catatan pribadi dokter. RLS Postgres bekerja per-BARIS,
-- bukan per-KOLOM — jadi kalau catatan itu ikut menumpang di baris `alerts`,
-- siapa pun yang boleh membaca baris peringatan otomatis ikut membaca
-- catatannya. Kebijakan RLS `alerts` dibuat di luar repo ini dan tidak bisa
-- dipastikan dari sini; menaruh catatan dokter di tabel sendiri membuat
-- keamanannya tidak bergantung pada kebijakan yang tidak terlihat.

create table if not exists public.alert_tindak_lanjut (
  id uuid primary key default gen_random_uuid(),

  -- Satu tindak lanjut per peringatan. `unique` inilah yang membuat fungsi di
  -- bawah aman dipanggil dua kali (mis. tombol terpencet ganda).
  alert_id uuid not null unique references public.alerts(id) on delete cascade,

  -- Sengaja TANPA foreign key. Di project ini `patients.doctor_id` dibandingkan
  -- langsung dengan `auth.uid()`, dan tabel tujuannya dibuat di luar repo ini
  -- sehingga tidak bisa dipastikan dari sini. Menebak target FK yang salah
  -- membuat seluruh skrip gagal; nilainya sendiri sudah dijamin benar oleh
  -- `default auth.uid()` dan fungsi `security definer` di bawah.
  doctor_id uuid not null default auth.uid(),

  -- Sumbu 1: apa yang DOKTER lakukan.
  tindakan text not null check (
    tindakan in (
      'edukasi',              -- cukup edukasi / observasi
      'obat_disesuaikan',
      'kunjungan_dipercepat',
      'dirujuk',              -- dirujuk IGD / rawat inap
      'tak_terhubung'         -- pasien tidak bisa dihubungi
    )
  ),

  -- Sumbu 2: kondisi PASIEN saat dihubungi. Dipisah dari sumbu 1 supaya bisa
  -- disilangkan saat analisis — mis. berapa persen peringatan merah yang
  -- ternyata sudah membaik sendiri sebelum dokter sempat menghubungi.
  kondisi text not null check (
    kondisi in (
      'membaik_sendiri',
      'masih_bergejala',
      'sudah_ke_igd',
      'dirawat_inap',
      'tidak_diketahui'
    )
  ),

  -- Pasien yang tidak bisa dihubungi tidak mungkin diketahui kondisinya.
  -- Dijaga di sini, BUKAN hanya di aplikasi: data penelitian yang sudah
  -- terlanjur tidak konsisten tidak bisa diperbaiki belakangan.
  constraint tak_terhubung_berarti_tak_diketahui check (
    tindakan <> 'tak_terhubung' or kondisi = 'tidak_diketahui'
  ),

  catatan text,

  -- Distempel server, bukan perangkat. Selisihnya terhadap `alerts.created_at`
  -- adalah variabel penelitian (jam sampai tindak lanjut); jam ponsel yang
  -- meleset — atau disetel mundur — akan menghasilkan angka negatif yang
  -- tampak sah.
  dibuat_pada timestamptz not null default now()
);

-- Tanpa index tambahan untuk `alert_id`: constraint `unique` di atas sudah
-- membuatkan indexnya sendiri, dan index kedua yang isinya sama hanya
-- memperlambat setiap penulisan tanpa mempercepat pembacaan apa pun.

alter table public.alert_tindak_lanjut enable row level security;

-- Hanya dokter pemilik pasiennya. Kepemilikan ditelusuri lewat `alerts`,
-- bukan lewat salinan `patient_id` di tabel ini — satu sumber kebenaran, tidak
-- ada yang bisa melenceng.
drop policy if exists "dokter kelola tindak lanjut" on public.alert_tindak_lanjut;
create policy "dokter kelola tindak lanjut"
  on public.alert_tindak_lanjut
  for all
  using (
    alert_id in (
      select a.id
      from public.alerts a
      join public.patients p on p.id = a.patient_id
      where p.doctor_id = auth.uid()
    )
  )
  with check (
    alert_id in (
      select a.id
      from public.alerts a
      join public.patients p on p.id = a.patient_id
      where p.doctor_id = auth.uid()
    )
  );

-- ---------- 2. Fungsi penutup ----------
--
-- Menutup peringatan itu DUA tulisan: menyimpan tindak lanjutnya, dan menandai
-- `alerts.selesai`. Dilakukan dari aplikasi, kegagalan jaringan di antara
-- keduanya meninggalkan peringatan yang sudah ditindaklanjuti tapi masih
-- menumpuk di kotak masuk — atau sebaliknya, hilang dari kotak masuk tanpa
-- rincian apa pun. Fungsi ini membuat keduanya satu transaksi.

create or replace function public.tutup_alert(
  p_alert uuid,
  p_tindakan text,
  p_kondisi text,
  p_catatan text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  boleh boolean;
begin
  -- `security definer` melewati RLS, jadi kepemilikannya diperiksa manual di
  -- sini. Tanpa ini, siapa pun yang login bisa menutup peringatan pasien orang
  -- lain hanya dengan menebak id-nya.
  select exists (
    select 1
    from public.alerts a
    join public.patients p on p.id = a.patient_id
    where a.id = p_alert
      and p.doctor_id = auth.uid()
  ) into boleh;

  if not boleh then
    raise exception 'Peringatan tidak ditemukan atau bukan milik pasien Anda.'
      using errcode = '42501';
  end if;

  insert into public.alert_tindak_lanjut (alert_id, doctor_id, tindakan, kondisi, catatan)
  values (p_alert, auth.uid(), p_tindakan, p_kondisi, nullif(btrim(coalesce(p_catatan, '')), ''))
  on conflict (alert_id) do update
    set tindakan = excluded.tindakan,
        kondisi  = excluded.kondisi,
        catatan  = excluded.catatan,
        -- Waktu tindak lanjut TIDAK diperbarui saat dokter meralat isiannya:
        -- yang diukur adalah kapan pasien ditangani, bukan kapan catatannya
        -- dirapikan.
        doctor_id = excluded.doctor_id;

  update public.alerts set selesai = true where id = p_alert;
end;
$$;

-- `anon` disebut TERPISAH dari `public`, dan itu bukan pengulangan.
--
-- Supabase memasang default privileges yang memberi EXECUTE secara EKSPLISIT
-- kepada `anon` untuk setiap fungsi baru di skema `public`. Mencabut dari
-- pseudo-role `public` tidak menyentuh pemberian itu — versi pertama berkas ini
-- hanya punya baris `from public` dan pemanggil dengan anon key tetap berhasil
-- menjalankan fungsinya (terbukti lewat REST 31 Juli 2026). Fungsinya menolak
-- melakukan apa pun karena pemeriksaan `auth.uid()` di dalamnya, tapi fungsi
-- `security definer` melewati RLS dan tidak pantas hanya berpagar satu lapis.
revoke all on function public.tutup_alert(uuid, text, text, text) from public;
revoke all on function public.tutup_alert(uuid, text, text, text) from anon;
grant execute on function public.tutup_alert(uuid, text, text, text) to authenticated;
