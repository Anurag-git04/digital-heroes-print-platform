insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('artwork', 'artwork', false, 4194304, array['application/pdf', 'image/svg+xml', 'image/png', 'application/postscript']),
  ('proofs', 'proofs', false, 10485760, array['image/png', 'image/jpeg']),
  ('print-files', 'print-files', false, 52428800, array['application/pdf', 'image/png', 'application/zip'])
on conflict (id) do update
set public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;
