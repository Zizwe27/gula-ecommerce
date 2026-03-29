-- =============================================================
-- Gula Marketplace — Supabase Schema
-- Run this in the Supabase SQL editor in order.
-- =============================================================

-- =============================================================
-- EXTENSIONS
-- =============================================================
create extension if not exists "uuid-ossp";


-- =============================================================
-- PROFILES
-- Extends auth.users. Created automatically on signup via trigger.
-- =============================================================
create table profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  phone       text unique not null,
  display_name text not null,
  role        text not null default 'buyer' check (role in ('buyer', 'seller', 'both')),
  location    text,                        -- city/town e.g. "Lusaka", "Kitwe"
  avatar_url  text,
  is_verified   boolean not null default false,
  onboarded     boolean not null default false,
  seller_status text check (seller_status in ('pending', 'approved', 'rejected')),
  shop_name     text,       -- set when seller application is approved
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- Auto-create profile on signup
create or replace function handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into profiles (id, phone, display_name)
  values (
    new.id,
    new.phone,
    coalesce(new.raw_user_meta_data->>'display_name', 'User')
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure handle_new_user();


-- =============================================================
-- SELLER APPLICATIONS
-- =============================================================
create table seller_applications (
  id                    uuid primary key default uuid_generate_v4(),
  user_id               uuid not null references profiles (id) on delete cascade,
  seller_name           text not null,
  description           text not null,
  location              text not null,
  id_type               text not null check (id_type in ('nrc', 'passport', 'driver_license')),
  id_number             text not null,
  mobile_money_provider text not null check (mobile_money_provider in ('mtn', 'airtel')),
  mobile_money_number   text not null,
  id_document_url       text,         -- private Storage path, admin-only read
  status                text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  rejection_reason      text,
  reviewed_at           timestamptz,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

create unique index seller_applications_one_pending_per_user
  on seller_applications (user_id)
  where status = 'pending';

create index seller_applications_user_id_idx on seller_applications (user_id);
create index seller_applications_status_idx  on seller_applications (status);

create trigger seller_applications_updated_at
  before update on seller_applications
  for each row execute procedure touch_updated_at();


-- =============================================================
-- CATEGORIES
-- Seeded manually. Buyers/sellers cannot modify.
-- =============================================================
create table categories (
  id    uuid primary key default uuid_generate_v4(),
  name  text unique not null,
  slug  text unique not null,
  icon  text                    -- emoji or icon name for the app
);

insert into categories (name, slug, icon) values
  ('Electronics',       'electronics',       '📱'),
  ('Clothing & Fashion','clothing-fashion',  '👗'),
  ('Home & Garden',     'home-garden',       '🏠'),
  ('Food & Groceries',  'food-groceries',    '🛒'),
  ('Vehicles & Parts',  'vehicles-parts',    '🚗'),
  ('Farm & Agriculture','farm-agriculture',  '🌾'),
  ('Beauty & Health',   'beauty-health',     '💊'),
  ('Sports & Leisure',  'sports-leisure',    '⚽'),
  ('Books & Stationery','books-stationery',  '📚'),
  ('Other',             'other',             '📦');


-- =============================================================
-- LISTINGS
-- =============================================================
create table listings (
  id           uuid primary key default uuid_generate_v4(),
  seller_id    uuid not null references profiles (id) on delete cascade,
  category_id  uuid not null references categories (id),
  title        text not null,
  description  text,
  price_zmw    numeric(10, 2) not null check (price_zmw > 0),
  images       text[] not null default '{}',   -- Supabase Storage URLs, max 5
  stock_qty    integer not null default 1 check (stock_qty >= 0),
  location     text,                           -- where the item is / seller location
  status       text not null default 'active' check (status in ('active', 'paused', 'sold')),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index listings_seller_id_idx    on listings (seller_id);
create index listings_category_id_idx  on listings (category_id);
create index listings_status_idx       on listings (status);


-- =============================================================
-- ORDERS
-- One item per order for MVP. Escrow lives here.
-- =============================================================
create table orders (
  id                   uuid primary key default uuid_generate_v4(),
  listing_id           uuid not null references listings (id),
  buyer_id             uuid not null references profiles (id),
  seller_id            uuid not null references profiles (id),

  -- what was ordered (snapshotted at time of order — survives listing edits/deletes)
  qty                  integer not null default 1 check (qty > 0),
  listing_title        text not null,             -- snapshot
  listing_image        text,                      -- snapshot of first image URL
  unit_price_zmw       numeric(10, 2) not null,   -- snapshot
  total_zmw            numeric(10, 2) not null,

  -- delivery info (records only, no courier integration in MVP)
  delivery_address     text not null,
  delivery_notes       text,

  -- status
  -- transitions:
  --   pending_payment → pending (payment webhook)
  --   pending        → received (seller)
  --   received       → preparing (seller)
  --   preparing      → delivered (seller)
  --   delivered      → completed (buyer confirms OR auto-release after 48h)
  --   pending_payment → cancelled (buyer, within 10 min)
  --   pending        → cancelled (support/admin only)
  status               text not null default 'pending_payment' check (status in (
    'pending_payment',
    'pending',
    'received',
    'preparing',
    'delivered',
    'completed',
    'cancelled'
  )),

  -- payment
  payment_provider     text check (payment_provider in ('mtn', 'airtel')),
  payment_reference    text,                      -- provider transaction ID
  disbursement_reference text,                    -- payout transaction ID

  -- escrow auto-release: set to now() + 48h when status → delivered
  escrow_release_at    timestamptz,

  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

create index orders_buyer_id_idx   on orders (buyer_id);
create index orders_seller_id_idx  on orders (seller_id);
create index orders_status_idx     on orders (status);
create index orders_escrow_release_at_idx on orders (escrow_release_at)
  where status = 'delivered';   -- partial index, only rows needing auto-release check


-- Set escrow_release_at automatically when status flips to 'delivered'
create or replace function set_escrow_release()
returns trigger
language plpgsql
as $$
begin
  if new.status = 'delivered' and old.status != 'delivered' then
    new.escrow_release_at := now() + interval '48 hours';
  end if;
  new.updated_at := now();
  return new;
end;
$$;

create trigger on_order_status_change
  before update on orders
  for each row execute procedure set_escrow_release();


-- =============================================================
-- PAYMENT EVENTS
-- Immutable log of every payment action for reconciliation.
-- Never update rows here — only insert.
-- =============================================================
create table payment_events (
  id           uuid primary key default uuid_generate_v4(),
  order_id     uuid not null references orders (id),
  event_type   text not null check (event_type in (
    'collection_initiated',   -- we called MTN/Airtel to request payment
    'collection_confirmed',   -- webhook confirmed buyer paid
    'collection_failed',      -- payment failed or timed out
    'disbursement_initiated', -- we called MTN/Airtel to pay seller
    'disbursement_confirmed', -- payout successful
    'disbursement_failed'     -- payout failed
  )),
  provider     text check (provider in ('mtn', 'airtel')),
  reference    text,          -- provider transaction ID
  amount_zmw   numeric(10, 2),
  raw_payload  jsonb,         -- full provider webhook/response, for debugging
  created_at   timestamptz not null default now()
);

create index payment_events_order_id_idx on payment_events (order_id);


-- =============================================================
-- CONVERSATIONS
-- One conversation per order. Created when order is created.
-- =============================================================
create table conversations (
  id         uuid primary key default uuid_generate_v4(),
  order_id   uuid not null unique references orders (id) on delete cascade,
  buyer_id   uuid not null references profiles (id),
  seller_id  uuid not null references profiles (id),
  created_at timestamptz not null default now()
);

-- Auto-create conversation when an order is created
create or replace function handle_new_order()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into conversations (order_id, buyer_id, seller_id)
  values (new.id, new.buyer_id, new.seller_id);
  return new;
end;
$$;

create trigger on_order_created
  after insert on orders
  for each row execute procedure handle_new_order();


-- =============================================================
-- MESSAGES
-- =============================================================
create table messages (
  id               uuid primary key default uuid_generate_v4(),
  conversation_id  uuid not null references conversations (id) on delete cascade,
  sender_id        uuid not null references profiles (id),
  body             text not null check (char_length(body) > 0),
  created_at       timestamptz not null default now()
);

create index messages_conversation_id_idx on messages (conversation_id, created_at);


-- =============================================================
-- updated_at TRIGGER (applied to listings and profiles)
-- =============================================================
create or replace function touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger listings_updated_at
  before update on listings
  for each row execute procedure touch_updated_at();

create trigger profiles_updated_at
  before update on profiles
  for each row execute procedure touch_updated_at();


-- =============================================================
-- ROW LEVEL SECURITY
-- =============================================================

alter table profiles             enable row level security;
alter table seller_applications  enable row level security;
alter table categories           enable row level security;
alter table listings       enable row level security;
alter table orders         enable row level security;
alter table payment_events enable row level security;
alter table conversations  enable row level security;
alter table messages       enable row level security;


-- ── CATEGORIES ───────────────────────────────────────────────

-- Anyone (including anon) can read categories
create policy "categories: public read"
  on categories for select
  using (true);

-- No insert/update/delete for any client role — managed via SQL only


-- ── PROFILES ─────────────────────────────────────────────────

-- Anyone authenticated can read any profile (needed to show seller info on listings)
create policy "profiles: authenticated can read"
  on profiles for select
  to authenticated
  using (true);

-- Users can only update their own profile
create policy "profiles: owner can update"
  on profiles for update
  to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- Insert handled by trigger (service role), not the client


-- ── SELLER APPLICATIONS ───────────────────────────────────────

create policy "seller_applications: user can read own"
  on seller_applications for select
  to authenticated
  using (auth.uid() = user_id);

create policy "seller_applications: user can insert"
  on seller_applications for insert
  to authenticated
  with check (auth.uid() = user_id);

-- No client-side updates — status changes via service role (admin) only


-- ── LISTINGS ─────────────────────────────────────────────────

-- Anyone authenticated can read active listings
create policy "listings: authenticated can read active"
  on listings for select
  to authenticated
  using (status = 'active' or seller_id = auth.uid());

-- Only sellers can create listings
create policy "listings: seller can insert"
  on listings for insert
  to authenticated
  with check (
    auth.uid() = seller_id
    and exists (
      select 1 from profiles
      where id = auth.uid() and role in ('seller', 'both')
    )
  );

-- Sellers can only update/delete their own listings
create policy "listings: seller can update own"
  on listings for update
  to authenticated
  using (auth.uid() = seller_id)
  with check (auth.uid() = seller_id);

create policy "listings: seller can delete own"
  on listings for delete
  to authenticated
  using (auth.uid() = seller_id);


-- ── ORDERS ───────────────────────────────────────────────────

-- Buyers see their orders; sellers see orders placed with them
create policy "orders: buyer or seller can read"
  on orders for select
  to authenticated
  using (auth.uid() = buyer_id or auth.uid() = seller_id);

-- Only buyers can create orders
create policy "orders: buyer can insert"
  on orders for insert
  to authenticated
  with check (auth.uid() = buyer_id);

-- Buyer can cancel from pending_payment
-- Seller can advance: pending → received → preparing → delivered
-- Buyer can complete from delivered
-- Service role (edge functions) handles payment status transitions
create policy "orders: buyer or seller can update status"
  on orders for update
  to authenticated
  using (auth.uid() = buyer_id or auth.uid() = seller_id);
-- Fine-grained transition validation is enforced in Edge Functions,
-- not purely in RLS, to keep policies readable.


-- ── PAYMENT EVENTS ───────────────────────────────────────────

-- Buyers and sellers can read their own payment events
create policy "payment_events: buyer or seller can read"
  on payment_events for select
  to authenticated
  using (
    exists (
      select 1 from orders
      where orders.id = payment_events.order_id
        and (orders.buyer_id = auth.uid() or orders.seller_id = auth.uid())
    )
  );

-- Only service role (edge functions) can insert payment events
-- No insert policy for authenticated role — inserts come from Edge Functions only


-- ── CONVERSATIONS ─────────────────────────────────────────────

-- Only the buyer and seller of that order can read the conversation
create policy "conversations: participants can read"
  on conversations for select
  to authenticated
  using (auth.uid() = buyer_id or auth.uid() = seller_id);

-- Insert handled by trigger (service role)


-- ── MESSAGES ─────────────────────────────────────────────────

-- Only conversation participants can read messages
create policy "messages: participants can read"
  on messages for select
  to authenticated
  using (
    exists (
      select 1 from conversations
      where conversations.id = messages.conversation_id
        and (conversations.buyer_id = auth.uid() or conversations.seller_id = auth.uid())
    )
  );

-- Only conversation participants can send messages
create policy "messages: participants can insert"
  on messages for insert
  to authenticated
  with check (
    auth.uid() = sender_id
    and exists (
      select 1 from conversations
      where conversations.id = messages.conversation_id
        and (conversations.buyer_id = auth.uid() or conversations.seller_id = auth.uid())
    )
  );


-- =============================================================
-- SUPABASE REALTIME
-- Enable realtime only on the messages table.
-- (orders realtime optional — for live status updates in app)
-- =============================================================
alter publication supabase_realtime add table messages;
alter publication supabase_realtime add table orders;


-- =============================================================
-- STORAGE BUCKETS
-- Run this via Supabase dashboard or Storage API, not SQL.
-- Bucket: "listings"   — public read, authenticated write
-- Bucket: "avatars"    — public read, authenticated write
-- Max file size: 5MB. Allowed types: image/jpeg, image/png, image/webp
-- =============================================================
