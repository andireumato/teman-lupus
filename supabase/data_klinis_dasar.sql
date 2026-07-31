-- ============================================================
-- DATA KLINIS DASAR — diisi DOKTER
--
-- Kolom `tgl_diagnosis`, `klasifikasi`, dan `organ_terlibat` sudah ada di
-- tabel `patients` sejak skema awal, tetapi tidak pernah tersambung ke satu
-- layar pun. Berkas ini yang menyambungkannya.
--
-- MENGAPA FUNGSI, BUKAN KEBIJAKAN RLS BIASA
-- Menambah `create policy ... for update using (doctor_id = auth.uid())`
-- memang lebih pendek, tetapi RLS di Postgres bekerja per BARIS, bukan per
-- KOLOM: dokter yang boleh memperbarui barisnya juga otomatis boleh mengubah
-- `doctor_id` dan `profile_id` di baris yang sama. Artinya seorang dokter bisa
-- mengalihkan pasien ke akun lain tanpa pasien tahu. Tautan dokter–pasien
-- adalah milik pasien (lihat `tautkan_dokter` di sisi_dokter.sql), jadi fungsi
-- ini sengaja hanya menyentuh tiga kolom klinis dan tidak lebih.
--
-- Jalankan di Supabase → SQL Editor.
-- ============================================================

create or replace function public.simpan_data_klinis(
  p_patient_id   uuid,
  p_tgl_diagnosis date,
  p_klasifikasi  text,
  p_organ        text[]
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Tanggal diagnosis di masa depan hampir pasti salah ketik. Dijaga di sini,
  -- bukan hanya di aplikasi: aturan yang hanya hidup di layar bisa dilewati.
  if p_tgl_diagnosis is not null and p_tgl_diagnosis > current_date then
    raise exception 'Tanggal diagnosis tidak boleh di masa depan'
      using errcode = 'check_violation';
  end if;

  update public.patients
     set tgl_diagnosis  = p_tgl_diagnosis,
         klasifikasi    = nullif(btrim(coalesce(p_klasifikasi, '')), ''),
         -- Larik kosong disimpan sebagai NULL supaya "belum diisi" dan
         -- "sudah ditinjau, tidak ada organ tercatat" tidak tertukar bentuknya.
         organ_terlibat = case
                            when p_organ is null or cardinality(p_organ) = 0 then null
                            else p_organ
                          end
   where id = p_patient_id
     and doctor_id = auth.uid();

  -- Pasien yang bukan miliknya dan pasien yang tidak ada sama-sama sampai di
  -- sini, dan sengaja diberi pesan yang sama: memberi pesan berbeda akan
  -- memberitahu penebak bahwa suatu id pasien itu nyata.
  if not found then
    raise exception 'Pasien ini tidak ditemukan, atau tidak tertaut dengan akun Anda'
      using errcode = 'insufficient_privilege';
  end if;
end;
$$;

revoke all     on function public.simpan_data_klinis(uuid, date, text, text[]) from public;
grant  execute on function public.simpan_data_klinis(uuid, date, text, text[]) to authenticated;
