-- =============================================================
-- Migration 005 — Stock reservation, order transition validation,
--                 push tokens, and admin flag
-- =============================================================

-- ─── 1. Push token + admin flag on profiles ──────────────────

alter table profiles
  add column if not exists push_token text,
  add column if not exists is_admin   boolean not null default false;


-- ─── 2. Stock reservation on order creation ──────────────────
-- Atomically checks and decrements stock when an order is placed.
-- Raises an exception (→ 400 from PostgREST) if stock is insufficient.

create or replace function reserve_listing_stock()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  v_stock integer;
  v_status text;
begin
  -- Lock the row to prevent race conditions
  select stock_qty, status into v_stock, v_status
  from listings
  where id = new.listing_id
  for update;

  if not found then
    raise exception 'Listing not found';
  end if;

  if v_status != 'active' then
    raise exception 'This listing is no longer available';
  end if;

  if v_stock < new.qty then
    raise exception 'Only % item(s) left in stock', v_stock;
  end if;

  -- Decrement; mark sold if stock hits zero
  update listings
  set
    stock_qty = stock_qty - new.qty,
    status    = case when stock_qty - new.qty = 0 then 'sold' else status end
  where id = new.listing_id;

  return new;
end;
$$;

create trigger on_order_insert_reserve_stock
  after insert on orders
  for each row execute procedure reserve_listing_stock();


-- ─── 3. Order status transition validation ───────────────────
-- Prevents illegal jumps (e.g. buyer advancing seller steps).
-- Named 'aa_...' to run before the escrow trigger alphabetically.

create or replace function validate_order_status_transition()
returns trigger
language plpgsql
as $$
begin
  -- No-op updates are fine
  if new.status = old.status then return new; end if;

  -- Enumerate every legal transition
  if old.status = 'pending_payment' and new.status in ('pending',   'cancelled') then return new; end if;
  if old.status = 'pending'         and new.status in ('received',  'cancelled') then return new; end if;
  if old.status = 'received'        and new.status = 'preparing'                 then return new; end if;
  if old.status = 'preparing'       and new.status = 'delivered'                 then return new; end if;
  if old.status = 'delivered'       and new.status = 'completed'                 then return new; end if;

  raise exception 'Invalid order status transition: % → %', old.status, new.status;
end;
$$;

create trigger aa_validate_order_transition
  before update on orders
  for each row
  when (old.status is distinct from new.status)
  execute procedure validate_order_status_transition();


-- ─── 4. Notify seller on approval/rejection ──────────────────
-- Stores a notification record we can poll from the app.
-- (Real push is handled by the Edge Function called from the app.)

-- No extra table needed — push is fired from the mobile app after
-- the admin action succeeds, using the push-notification edge function.
