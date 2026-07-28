-- ============================================================
-- TEMAN LUPUS — peringatan otomatis & kunjungan
--
-- Tabel `alerts` dan `visits` sudah ada di skema utama tetapi belum pernah
-- dipakai. Yang ditambahkan di sini:
--   1. alerts.flare_check_id — menautkan peringatan ke Cek Flare asalnya
--   2. trigger yang membuat peringatan saat Cek Flare menghasilkan
--      kuning/merah
--
-- Kenapa TRIGGER, bukan insert dari aplikasi:
--
-- Peringatan ini yang dilihat dokter. Kalau aplikasi yang menyisipkannya,
-- satu kegagalan jaringan sesudah flare_checks tersimpan akan menghasilkan
-- cek flare merah yang TIDAK pernah muncul di kotak masuk dokter — gagal
-- diam-diam pada jalur yang justru paling tidak boleh gagal diam-diam.
-- Trigger membuatnya menyatu dengan penyimpanan cek flare-nya.
--
-- Ini TIDAK mengubah jalur eskalasi pasien: pesan "segera ke IGD" tetap
-- dihitung di perangkat oleh lib/redflag.ts dan tampil tanpa menunggu
-- jaringan. Peringatan ini hanya salinan untuk dokter.
--
-- Jalankan di Supabase Dashboard → SQL Editor. Aman dijalankan ulang.
-- ============================================================

-- ---------- 1. Tautan ke cek flare asalnya ----------

alter table public.alerts
  add column if not exists flare_check_id uuid references public.flare_checks(id) on delete cascade;

-- Satu peringatan per cek flare; trigger memakai ini agar menjalankan ulang
-- skrip atau menyisipkan ulang baris tidak menggandakan kotak masuk dokter.
create unique index if not exists alerts_flare_check_unik
  on public.alerts (flare_check_id)
  where flare_check_id is not null;

create index if not exists alerts_patient_belum_selesai_idx
  on public.alerts (patient_id, created_at desc)
  where selesai = false;

-- ---------- 2. Trigger pembuat peringatan ----------

create or replace function public.buat_alert_flare()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Hijau tidak membuat peringatan: keluhannya sudah tercatat di
  -- flare_checks dan muncul di bagian 5 ringkasan bila relevan.
  if new.hasil not in ('red', 'yellow') then
    return new;
  end if;

  insert into public.alerts (patient_id, flare_check_id, jenis, pesan)
  values (
    new.patient_id,
    new.id,
    case when new.hasil = 'red' then 'flare_darurat' else 'flare_mendesak' end,
    case
      when new.hasil = 'red'
        then 'Cek Flare tingkat DARURAT. Pasien diarahkan segera ke IGD.'
      else 'Cek Flare tingkat MENDESAK. Pasien diarahkan menghubungi tim dokter dalam 24 jam.'
    end
  )
  on conflict (flare_check_id) where flare_check_id is not null do nothing;

  return new;
end;
$$;

-- `security definer`: peringatan harus tetap terbuat meski kebijakan RLS
-- pada `alerts` suatu saat diperketat. Nilainya diambil dari baris cek flare
-- yang memicunya, bukan dari masukan pemanggil, jadi tidak ada yang bisa
-- disisipkan lewat sini.

drop trigger if exists on_flare_check_alert on public.flare_checks;
create trigger on_flare_check_alert
  after insert on public.flare_checks
  for each row execute function public.buat_alert_flare();

-- ---------- 3. Peringatan untuk cek flare yang sudah telanjur ada ----------

-- Cek flare kuning/merah yang tersimpan SEBELUM trigger ini dipasang tidak
-- punya peringatan. Diisi sekali di sini; `on conflict do nothing` membuatnya
-- aman dijalankan ulang.
insert into public.alerts (patient_id, flare_check_id, jenis, pesan)
select
  f.patient_id,
  f.id,
  case when f.hasil = 'red' then 'flare_darurat' else 'flare_mendesak' end,
  case
    when f.hasil = 'red'
      then 'Cek Flare tingkat DARURAT. Pasien diarahkan segera ke IGD.'
    else 'Cek Flare tingkat MENDESAK. Pasien diarahkan menghubungi tim dokter dalam 24 jam.'
  end
from public.flare_checks f
where f.hasil in ('red', 'yellow')
on conflict (flare_check_id) where flare_check_id is not null do nothing;
