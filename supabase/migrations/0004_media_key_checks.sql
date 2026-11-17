-- Pin photo_key / cover_key to the row's own family folder.
--
-- Both are written from client input and later signed and deleted with the
-- service-role key, so a key naming another family's object is a read (and a
-- delete) of that family's photo. The app refuses such keys already (isMediaKey
-- in lib/slug.ts); this makes the database refuse them too, whoever writes.
-- NULL passes a CHECK, so "no photo" stays legal.

-- Rows written before the app checked keys could hold a foreign path, and the
-- constraint cannot be added over them. Clear them first; the audit trigger
-- logs the clear like any other edit.
update public.people
   set photo_key = null
 where not (photo_key like 'families/' || family_id::text || '/photos/%'
            and photo_key not like '%..%');

update public.families
   set cover_key = null
 where not (cover_key like 'families/' || id::text || '/cover/%'
            and cover_key not like '%..%');

alter table public.people
  add constraint people_photo_key_in_family
  check (photo_key like 'families/' || family_id::text || '/photos/%'
         and photo_key not like '%..%');

alter table public.families
  add constraint families_cover_key_in_family
  check (cover_key like 'families/' || id::text || '/cover/%'
         and cover_key not like '%..%');
