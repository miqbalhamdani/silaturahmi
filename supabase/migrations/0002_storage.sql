-- Supabase Storage for person photos and family cover images.
-- See §7 of docs/supabase-integration.md.

-- Private bucket. The size and MIME limits live HERE rather than in app code,
-- so Storage enforces them on the bytes as received — a client that lies about
-- its content type does not get in. The checks in createPhotoUploadUrl are a
-- fast-fail courtesy, not the boundary.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'family-media',
  'family-media',
  false,
  5242880,                                        -- 5 MB
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
  set public             = excluded.public,
      file_size_limit    = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Same posture as the data tables: anon gets no policies at all.
--
-- Every read is a service-role signed URL and every write is a service-role
-- signed upload token, both minted by a Server Action that has already checked
-- the family slug. RLS is enabled on storage.objects by Supabase already; we
-- deliberately add nothing, so the default deny stands.
--
-- Nothing to create here. This comment is the decision — without it the next
-- reader assumes the policies were forgotten.
