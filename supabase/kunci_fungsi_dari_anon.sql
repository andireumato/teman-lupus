-- ============================================================
-- TEMAN LUPUS — menutup fungsi security definer dari peran `anon`
--
-- MASALAH YANG DIPERBAIKI
--
-- Ketiga fungsi RPC di project ini ditulis dengan baris:
--
--     revoke all on function ... from public;
--     grant execute on function ... to authenticated;
--
-- Baris itu TIDAK melakukan apa yang tampaknya dilakukan. Supabase memasang
-- default privileges yang memberi EXECUTE secara EKSPLISIT kepada `anon`,
-- `authenticated`, dan `service_role` untuk setiap fungsi baru di skema
-- `public`. Mencabut dari pseudo-role `public` tidak menyentuh pemberian
-- eksplisit kepada `anon`.
--
-- Terbukti lewat REST 31 Juli 2026: pemanggil dengan anon key BERHASIL
-- menjalankan `tutup_alert` dan `simpan_data_klinis`. Keduanya tetap menolak
-- melakukan apa pun — pemeriksaan `auth.uid()` manual di dalam fungsinya
-- bekerja, dan jawabannya adalah pesan buatan kita (42501), bukan
-- "permission denied". Jadi tidak ada data yang bocor.
--
-- Tetap diperbaiki, karena ketiganya `security definer`: mereka berjalan
-- dengan hak pembuatnya dan MELEWATI RLS. Satu-satunya yang menahan pemanggil
-- anonim adalah satu blok `if not boleh then raise` di dalam badan fungsi.
-- Pertahanan itu benar hari ini, tapi ia satu suntingan ceroboh dari terbuka,
-- dan kode yang mengaku sudah mencabut izin membuat orang berikutnya berhenti
-- memeriksa.
--
-- Jalankan di Supabase Dashboard → SQL Editor. Aman dijalankan ulang.
-- ============================================================

-- Dicabut lewat katalog, bukan dengan menuliskan tanda tangan tiap fungsi:
-- `revoke` menuntut tanda tangan yang sama persis, dan satu tipe argumen yang
-- salah ketik akan menggagalkan seluruh skrip — pada skrip yang justru
-- tugasnya menutup lubang izin.
do $$
declare
  f record;
begin
  for f in
    select p.oid::regprocedure as sig
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in ('tutup_alert', 'simpan_data_klinis', 'tautkan_dokter')
  loop
    -- `anon` saja. `authenticated` tetap perlu: ketiganya dipanggil dari
    -- aplikasi oleh pengguna yang sudah login.
    execute format('revoke all on function %s from anon', f.sig);
    raise notice 'dicabut dari anon: %', f.sig;
  end loop;
end $$;

-- Verifikasi dari dalam database. Ketiganya harus menjawab `false`.
select
  p.oid::regprocedure as fungsi,
  has_function_privilege('anon', p.oid, 'execute') as anon_masih_bisa,
  has_function_privilege('authenticated', p.oid, 'execute') as authenticated_bisa
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in ('tutup_alert', 'simpan_data_klinis', 'tautkan_dokter')
order by 1;
