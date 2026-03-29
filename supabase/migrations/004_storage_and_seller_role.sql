-- =============================================================
-- Migration 004 — Storage buckets, policies, and seller role fix
-- =============================================================

-- ─── 1. Storage buckets ──────────────────────────────────────
-- Create listings and avatars buckets if they don't exist yet.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('listings', 'listings', true,  5242880, array['image/jpeg','image/png','image/webp']),
  ('avatars',  'avatars',  true,  5242880, array['image/jpeg','image/png','image/webp'])
on conflict (id) do nothing;


-- ─── 2. Storage RLS policies — listings bucket ───────────────

-- Public read (buyers browsing listings)
create policy "listings-bucket: public read"
  on storage.objects for select
  using (bucket_id = 'listings');

-- Approved sellers can upload to their own folder (path: {userId}/...)
create policy "listings-bucket: seller can upload"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'listings'
    and auth.uid()::text = (storage.foldername(name))[1]
    and exists (
      select 1 from public.profiles
      where id = auth.uid() and seller_status = 'approved'
    )
  );

-- Sellers can overwrite/update their own files
create policy "listings-bucket: seller can update"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'listings'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

-- Sellers can delete their own files
create policy "listings-bucket: seller can delete"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'listings'
    and auth.uid()::text = (storage.foldername(name))[1]
  );


-- ─── 3. Storage RLS policies — avatars bucket ────────────────

-- Public read (profile photos visible everywhere)
create policy "avatars-bucket: public read"
  on storage.objects for select
  using (bucket_id = 'avatars');

-- Any authenticated user can upload their own avatar (path: {userId}/...)
create policy "avatars-bucket: owner can upload"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'avatars'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

-- Users can replace their own avatar
create policy "avatars-bucket: owner can update"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'avatars'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

-- Users can delete their own avatar
create policy "avatars-bucket: owner can delete"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'avatars'
    and auth.uid()::text = (storage.foldername(name))[1]
  );


-- ─── 4. Fix listing insert RLS ───────────────────────────────
-- Old policy checked profiles.role ('seller'|'both') which was never
-- auto-updated on seller approval. Replace with seller_status check.

drop policy if exists "listings: seller can insert" on public.listings;

create policy "listings: seller can insert"
  on public.listings for insert
  to authenticated
  with check (
    auth.uid() = seller_id
    and exists (
      select 1 from public.profiles
      where id = auth.uid() and seller_status = 'approved'
    )
  );


-- ─── 5. Auto-sync profiles.role when seller is approved ──────
-- Keeps the role column consistent with seller_status for any
-- code that still reads role.

create or replace function sync_seller_role()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if new.seller_status = 'approved' and (old.seller_status is distinct from 'approved') then
    new.role := case when old.role = 'buyer' then 'seller' else 'both' end;
  end if;
  return new;
end;
$$;

create trigger on_seller_approved
  before update on public.profiles
  for each row execute procedure sync_seller_role();


-- ─── 6. Back-fill role for already-approved sellers ──────────
-- Any seller approved before this migration has role = 'buyer'.
-- Fix them now.

update public.profiles
set role = case when role = 'buyer' then 'seller' else 'both' end
where seller_status = 'approved'
  and role not in ('seller', 'both');
