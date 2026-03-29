// Hand-written types matching supabase/schema.sql
// Replace with generated types once you run: npx supabase gen types typescript

export type UserRole = 'buyer' | 'seller' | 'both'

export type SellerStatus = 'pending' | 'approved' | 'rejected'

export type IdType = 'nrc' | 'passport' | 'driver_license'

export type ListingStatus = 'active' | 'paused' | 'sold'

export type OrderStatus =
  | 'pending_payment'
  | 'pending'
  | 'received'
  | 'preparing'
  | 'delivered'
  | 'completed'
  | 'cancelled'

export type PaymentProvider = 'mtn' | 'airtel'

export type PaymentEventType =
  | 'collection_initiated'
  | 'collection_confirmed'
  | 'collection_failed'
  | 'disbursement_initiated'
  | 'disbursement_confirmed'
  | 'disbursement_failed'

export interface Profile {
  id: string
  phone: string
  display_name: string
  role: UserRole
  location: string | null
  avatar_url: string | null
  is_verified: boolean
  onboarded: boolean
  seller_status: SellerStatus | null
  shop_name: string | null
  created_at: string
  updated_at: string
}

export interface SellerApplication {
  id: string
  user_id: string
  seller_name: string
  description: string
  location: string
  id_type: IdType
  id_number: string
  mobile_money_provider: PaymentProvider
  mobile_money_number: string
  id_document_url: string | null
  status: SellerStatus
  rejection_reason: string | null
  reviewed_at: string | null
  created_at: string
  updated_at: string
}

export interface Category {
  id: string
  name: string
  slug: string
  icon: string | null
}

export interface Listing {
  id: string
  seller_id: string
  category_id: string
  title: string
  description: string | null
  price_zmw: number
  images: string[]
  stock_qty: number
  location: string | null
  status: ListingStatus
  created_at: string
  updated_at: string
  // joined
  seller?: Profile
  category?: Category
}

export interface Order {
  id: string
  listing_id: string
  buyer_id: string
  seller_id: string
  qty: number
  listing_title: string
  listing_image: string | null
  unit_price_zmw: number
  total_zmw: number
  delivery_address: string
  delivery_notes: string | null
  status: OrderStatus
  payment_provider: PaymentProvider | null
  payment_reference: string | null
  disbursement_reference: string | null
  escrow_release_at: string | null
  created_at: string
  updated_at: string
  // joined
  buyer?: Profile
  seller?: Profile
}

export interface Conversation {
  id: string
  order_id: string
  buyer_id: string
  seller_id: string
  created_at: string
  // joined
  order?: Order
  buyer?: Profile
  seller?: Profile
}

export interface Message {
  id: string
  conversation_id: string
  sender_id: string
  body: string
  created_at: string
  // joined
  sender?: Profile
}

export interface PaymentEvent {
  id: string
  order_id: string
  event_type: PaymentEventType
  provider: PaymentProvider | null
  reference: string | null
  amount_zmw: number | null
  raw_payload: Record<string, unknown> | null
  created_at: string
}
