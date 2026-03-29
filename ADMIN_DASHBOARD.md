# Gula Admin Dashboard — Developer Guide

This document explains the Gula backend architecture so you can build a web-based admin dashboard that connects to the same database and data as the mobile app.

---

## 1. What is Gula?

Gula is a Zambian marketplace mobile app (React Native / Expo). Buyers browse listings and place orders. Sellers apply to sell, list products, and fulfil orders. All communication, payments, and data flow through a single backend: **Supabase**.

The mobile app is the only client right now. The admin dashboard will be a second client connecting to the exact same backend.

---

## 2. The Backend — Supabase

Supabase is a hosted backend platform. Think of it as:

- A **PostgreSQL database** you can query directly
- A **REST and real-time API** auto-generated from that database
- **Auth** (user accounts, sessions, JWTs)
- **Storage** (for images)
- **Edge Functions** (serverless functions, used here for push notifications)

Everything the mobile app does — reading listings, placing orders, chatting — goes through Supabase. The admin dashboard does the same.

### Credentials you need

You get these from the Supabase project dashboard → Settings → API.

| Credential | What it is | Where to use it |
|---|---|---|
| `SUPABASE_URL` | Your project's API endpoint | Both client and server |
| `SUPABASE_ANON_KEY` | Public key — respects Row Level Security | Safe to use in the browser |
| `SUPABASE_SERVICE_ROLE_KEY` | Master key — bypasses all security rules | **Server-side only. Never expose in a browser.** |

> **Important:** The admin dashboard needs to read data that regular users cannot see (e.g., all orders, all users, all payment events). For this, you must use the **service role key** — but only in server-side code (e.g., Next.js API routes, server components, or a backend API). Never ship the service role key to the browser.

---

## 3. Database Tables

Here is every table, what it stores, and what the admin dashboard needs to do with it.

### `profiles`

Every registered user has a profile. Created automatically when someone signs up.

| Column | Type | Notes |
|---|---|---|
| `id` | UUID | Matches the Supabase auth user ID |
| `phone` | text | Unique. Used for login |
| `display_name` | text | |
| `role` | text | `buyer`, `seller`, or `both` |
| `location` | text | City e.g. "Lusaka" |
| `avatar_url` | text | Supabase Storage URL |
| `is_verified` | boolean | Not yet used in mobile app |
| `onboarded` | boolean | Has the user completed onboarding |
| `seller_status` | text | `null`, `pending`, `approved`, or `rejected` |
| `shop_name` | text | Set when seller application is approved |
| `push_token` | text | Expo push notification token. Updated each login |
| `is_admin` | boolean | `true` = full admin access |
| `created_at` | timestamp | |

**Admin dashboard should:** list all users, filter by role/seller_status, view individual profiles, toggle `is_admin`, toggle `is_verified`, manually update `seller_status` if needed.

---

### `seller_applications`

When a user wants to become a seller, they submit an application from the mobile app. An admin reviews it in the mobile app today — the dashboard should replace/augment this.

| Column | Type | Notes |
|---|---|---|
| `id` | UUID | |
| `user_id` | UUID | References `profiles.id` |
| `seller_name` | text | Proposed shop name |
| `description` | text | What they plan to sell |
| `location` | text | Where they are |
| `id_type` | text | `nrc`, `passport`, or `driver_license` |
| `id_number` | text | |
| `mobile_money_provider` | text | `mtn` or `airtel` |
| `mobile_money_number` | text | Where payouts go |
| `id_document_url` | text | Storage path of uploaded ID document |
| `status` | text | `pending`, `approved`, `rejected` |
| `rejection_reason` | text | Filled when rejected |
| `reviewed_at` | timestamp | When the admin acted |
| `created_at` | timestamp | |

**Admin dashboard should:** list pending/approved/rejected applications, view full details, approve (sets `status = 'approved'` on the application AND `seller_status = 'approved'` and `shop_name` on the profile), reject with a reason.

**Note:** Approving a seller also triggers a database function (`sync_seller_role`) that automatically updates `profiles.role` to `seller` or `both`. You don't need to handle this — the database does it for you.

---

### `categories`

Static lookup table. Currently has 10 categories (Electronics, Clothing, Food, etc.).

| Column | Type | Notes |
|---|---|---|
| `id` | UUID | |
| `name` | text | e.g. "Electronics" |
| `slug` | text | e.g. "electronics" |
| `icon` | text | Emoji used in the mobile app |

**Admin dashboard should:** list, add, edit, and delete categories. Changes appear immediately in the mobile app.

---

### `listings`

Products listed for sale by approved sellers.

| Column | Type | Notes |
|---|---|---|
| `id` | UUID | |
| `seller_id` | UUID | References `profiles.id` |
| `category_id` | UUID | References `categories.id` |
| `title` | text | |
| `description` | text | |
| `price_zmw` | numeric | Price in Zambian Kwacha |
| `images` | text[] | Array of Supabase Storage URLs (max 5) |
| `stock_qty` | integer | 0 = sold out |
| `location` | text | Where the item is |
| `status` | text | `active`, `paused`, or `sold` |
| `created_at` | timestamp | |

**Admin dashboard should:** list all listings with filters (status, category, seller), view detail, update status (e.g. pause/remove a listing that violates policies), delete listings.

---

### `orders`

One order = one item purchase. Created when a buyer places an order.

| Column | Type | Notes |
|---|---|---|
| `id` | UUID | |
| `listing_id` | UUID | The listing that was purchased |
| `buyer_id` | UUID | References `profiles.id` |
| `seller_id` | UUID | References `profiles.id` |
| `qty` | integer | Quantity ordered |
| `listing_title` | text | Snapshot of listing title at order time |
| `listing_image` | text | Snapshot of first image URL |
| `unit_price_zmw` | numeric | Price per item at order time |
| `total_zmw` | numeric | qty × unit price |
| `delivery_address` | text | Where to deliver |
| `delivery_notes` | text | Optional instructions |
| `status` | text | See flow below |
| `payment_provider` | text | `mtn` or `airtel` |
| `payment_reference` | text | Transaction ID from the payment provider |
| `disbursement_reference` | text | Payout ID (when seller is paid) |
| `escrow_release_at` | timestamp | Auto-set to 48h after delivery |
| `created_at` | timestamp | |

**Order status flow:**

```
pending_payment → pending → received → preparing → delivered → completed
                                                              ↘ cancelled
```

- `pending_payment`: Order placed, awaiting buyer payment confirmation
- `pending`: Payment confirmed by seller
- `received`: Seller confirmed they have the order
- `preparing`: Seller is preparing it
- `delivered`: Seller marked as delivered (escrow timer starts — 48h)
- `completed`: Buyer confirmed receipt OR 48h passed (funds released to seller)
- `cancelled`: Cancelled by buyer or admin

**Admin dashboard should:** list all orders with filters (status, date range, buyer, seller), view order detail with full history, force-update status (e.g. manually cancel a disputed order), view payment references for reconciliation.

---

### `payment_events`

An immutable log of every payment action. Never updated — only appended.

| Column | Type | Notes |
|---|---|---|
| `id` | UUID | |
| `order_id` | UUID | |
| `event_type` | text | See values below |
| `provider` | text | `mtn` or `airtel` |
| `reference` | text | Provider transaction ID |
| `amount_zmw` | numeric | |
| `raw_payload` | jsonb | Full webhook payload for debugging |
| `created_at` | timestamp | |

Event types: `collection_initiated`, `collection_confirmed`, `collection_failed`, `disbursement_initiated`, `disbursement_confirmed`, `disbursement_failed`

**Admin dashboard should:** list payment events for an order (shown on order detail page), filter failed events for reconciliation, export for accounting.

---

### `conversations` and `messages`

Every order automatically gets one conversation between buyer and seller.

`conversations`: links an order to its buyer and seller.
`messages`: individual chat messages within a conversation.

| Column (messages) | Type | Notes |
|---|---|---|
| `id` | UUID | |
| `conversation_id` | UUID | |
| `sender_id` | UUID | Who sent it |
| `body` | text | Message text |
| `created_at` | timestamp | |

**Admin dashboard should:** view conversation threads for any order (for dispute resolution), read message history. Admin should not need to send messages.

---

## 4. Authentication & Admin Access

### How users log in (mobile app)

Users sign in with their **phone number + OTP**. Supabase Auth handles this. On successful login, Supabase returns a JWT (session token). The mobile app includes this JWT in every API request.

### How admin access works

There is no separate admin auth system. Admin access is a flag:

```sql
profiles.is_admin = true
```

To make someone an admin, run this in the Supabase SQL editor:

```sql
update profiles set is_admin = true where phone = '+260..........';
```

### How the dashboard should authenticate

**Option A — Recommended for most web frameworks (Next.js, etc.):**

Use the **service role key** on the server side. Your dashboard doesn't need user sessions at all — you protect the dashboard with your own auth (e.g. a simple password, OAuth, or just deploy it privately). On the server, every Supabase query uses the service role client which bypasses all RLS.

```ts
import { createClient } from '@supabase/supabase-js'

// Server-side only — never expose SERVICE_ROLE_KEY in the browser
const supabaseAdmin = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)
```

**Option B — Admin user login:**

Add RLS policies that give `is_admin = true` users read access to everything, then have admins log in through the dashboard. This is more work to set up correctly. Option A is simpler and safer for an internal dashboard.

---

## 5. Connecting to Supabase — Step by Step

### Step 1 — Install the Supabase client

```bash
npm install @supabase/supabase-js
```

### Step 2 — Set up environment variables

Create a `.env` file (or use your framework's env system):

```
SUPABASE_URL=https://your-project-ref.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJ...  # from Supabase dashboard → Settings → API
```

### Step 3 — Create a server-side Supabase client

```ts
// lib/supabaseAdmin.ts  — SERVER ONLY
import { createClient } from '@supabase/supabase-js'

export const supabaseAdmin = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)
```

### Step 4 — Query the database

```ts
// List all pending seller applications
const { data, error } = await supabaseAdmin
  .from('seller_applications')
  .select(`
    *,
    profile:profiles!seller_applications_user_id_fkey(
      display_name, phone, avatar_url
    )
  `)
  .eq('status', 'pending')
  .order('created_at', { ascending: false })
```

```ts
// Approve a seller application
await supabaseAdmin
  .from('seller_applications')
  .update({ status: 'approved', reviewed_at: new Date().toISOString() })
  .eq('id', applicationId)

await supabaseAdmin
  .from('profiles')
  .update({ seller_status: 'approved', shop_name: shopName })
  .eq('id', userId)
```

```ts
// List all orders with buyer + seller info
const { data } = await supabaseAdmin
  .from('orders')
  .select(`
    *,
    buyer:profiles!orders_buyer_id_fkey(display_name, phone),
    seller:profiles!orders_seller_id_fkey(display_name, shop_name, phone)
  `)
  .order('created_at', { ascending: false })
```

```ts
// Force-cancel an order
await supabaseAdmin
  .from('orders')
  .update({ status: 'cancelled' })
  .eq('id', orderId)
```

---

## 6. Sending Push Notifications from the Dashboard

The mobile app uses an Expo push notification service. There is already a Supabase Edge Function deployed called `push-notification`.

To send a push notification to a user from the dashboard:

```ts
const { data: { session } } = await supabaseAdmin.auth.getSession()

await supabaseAdmin.functions.invoke('push-notification', {
  body: {
    recipientId: 'the-user-uuid',
    title: 'Your application was approved!',
    body: 'Welcome to gula. Your shop is now live.',
  }
})
```

The function looks up the user's stored push token and delivers the notification via Expo's push service. It is safe to call from the dashboard when approving/rejecting seller applications.

---

## 7. Storage (Images)

Profile avatars and listing images are stored in Supabase Storage. There are two public buckets:

| Bucket | Contents | URL pattern |
|---|---|---|
| `avatars` | User profile photos | `[SUPABASE_URL]/storage/v1/object/public/avatars/{userId}/avatar.jpg` |
| `listings` | Listing images | `[SUPABASE_URL]/storage/v1/object/public/listings/{sellerId}/{filename}` |

Both buckets are **public** — you can display images directly in the dashboard using the URL stored in the database. No auth required to read images.

---

## 8. Real-time Updates (Optional)

If you want the dashboard to show live updates (e.g. new orders coming in without refreshing), Supabase has real-time subscriptions.

The following tables have real-time enabled:
- `messages` — for chat monitoring
- `orders` — for order status changes

```ts
const channel = supabaseAdmin
  .channel('orders-realtime')
  .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, (payload) => {
    console.log('Order changed:', payload)
    // refresh your UI
  })
  .subscribe()
```

---

## 9. Full Admin Capability Map

Here is everything the dashboard should be able to do, grouped by priority.

### Must-have (mirrors what the mobile admin does today)

| Feature | Tables involved | Operation |
|---|---|---|
| Review pending seller applications | `seller_applications` + `profiles` | Read list, approve (update both tables), reject with reason |
| View all users | `profiles` | Read with filters |

### Should-have (high-value additions over the mobile admin)

| Feature | Tables involved | Operation |
|---|---|---|
| View all orders + filter by status | `orders` + `profiles` | Read |
| Force-cancel a disputed order | `orders` | Update status to `cancelled` |
| View order payment events | `payment_events` | Read |
| View conversation for an order | `conversations` + `messages` | Read |
| Moderate/remove a listing | `listings` | Update status to `paused` or delete |
| Manage categories | `categories` | Create, update, delete |

### Nice-to-have

| Feature | Tables involved | Operation |
|---|---|---|
| Basic analytics (order counts, GMV, user growth) | `orders` + `profiles` | Aggregate queries |
| Grant/revoke admin access | `profiles` | Update `is_admin` |
| Export orders / payment events to CSV | `orders` + `payment_events` | Read + format |
| View failed payment events for reconciliation | `payment_events` | Read where `event_type` ends in `_failed` |

---

## 10. Key Rules to Know

1. **The database validates status transitions.** There is a database trigger (`aa_validate_order_transition`) that rejects invalid order status changes. You cannot skip steps — the transition must follow the allowed flow in Section 3. The only exception is `cancelled`, which can be applied from `pending_payment` or `pending`.

2. **Approving a seller requires two writes.** You must update both `seller_applications.status` and `profiles.seller_status`. The database trigger then automatically updates `profiles.role`. If you only update one, things will be inconsistent.

3. **Stock is reserved by the database, not the app.** When an order is created, a trigger automatically decrements `listings.stock_qty` and marks the listing as `sold` if stock hits zero. You do not need to manage this — but if you cancel an order via the dashboard, stock is NOT automatically restored (that would require a custom function or manual correction).

4. **Payment events are append-only.** Never update rows in `payment_events`. Only insert new ones if needed.

5. **The service role key bypasses all Row Level Security.** With great power comes great responsibility — validate your inputs and be careful with bulk updates. There are no RLS guardrails when using the service role.

---

## 11. Quick Reference

```
Project type:   Supabase (PostgreSQL-based BaaS)
Mobile app:     React Native / Expo (iOS + Android)
Auth method:    Phone number + OTP (Supabase Auth)
Images:         Supabase Storage (public buckets: avatars, listings)
Notifications:  Expo Push Notification Service via Edge Function
Currency:       ZMW (Zambian Kwacha) — all prices in numeric(10,2)
Payment:        MTN Mobile Money + Airtel Money (provider field on orders)
```

**Tables summary:**
```
profiles             — all users (buyers + sellers + admins)
seller_applications  — seller onboarding requests
categories           — product categories (seeded, admin-managed)
listings             — products for sale
orders               — purchases
payment_events       — immutable payment log
conversations        — one per order
messages             — chat messages within a conversation
```
