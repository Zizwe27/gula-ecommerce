-- =============================================================
-- Migration 001 — Seller applications + seller_status on profiles
-- Run this as a new query in the Supabase SQL editor.
-- =============================================================

-- Add seller_status and shop_name to profiles
alter table profiles
  add column seller_status text check (seller_status in ('pending', 'approved', 'rejected')),
  add column shop_name text;   -- set when application is approved

-- seller_applications table
create table seller_applications (
  id                    uuid primary key default uuid_generate_v4(),
  user_id               uuid not null references profiles (id) on delete cascade,
  seller_name           text not null,       -- proposed shop/seller name
  description           text not null,       -- what they plan to sell
  location              text not null,       -- city/town
  id_type               text not null check (id_type in ('nrc', 'passport', 'driver_license')),
  id_number             text not null,       -- for admin identity check
  mobile_money_provider text not null check (mobile_money_provider in ('mtn', 'airtel')),
  mobile_money_number   text not null,       -- payout number, must be verified
  status                text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  rejection_reason      text,               -- admin fills this on rejection
  reviewed_at           timestamptz,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

-- Prevent multiple pending applications from the same user
create unique index seller_applications_one_pending_per_user
  on seller_applications (user_id)
  where status = 'pending';

create index seller_applications_user_id_idx on seller_applications (user_id);
create index seller_applications_status_idx  on seller_applications (status);

create trigger seller_applications_updated_at
  before update on seller_applications
  for each row execute procedure touch_updated_at();


-- =============================================================
-- RLS
-- =============================================================
alter table seller_applications enable row level security;

-- Users can read their own applications (all statuses — they need to see rejection reason)
create policy "seller_applications: user can read own"
  on seller_applications for select
  to authenticated
  using (auth.uid() = user_id);

-- Users can submit an application
-- Guard: not already approved (profile.seller_status check happens in the app/edge fn)
create policy "seller_applications: user can insert"
  on seller_applications for insert
  to authenticated
  with check (auth.uid() = user_id);

-- No client-side updates — status changes are handled by admin via service role only
