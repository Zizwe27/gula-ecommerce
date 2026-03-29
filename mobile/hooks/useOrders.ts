import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

export type OrderStatus =
  | 'pending_payment'
  | 'pending'
  | 'received'
  | 'preparing'
  | 'delivered'
  | 'completed'
  | 'cancelled'

export type OrderWithRelations = {
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
  payment_provider: string | null
  payment_reference: string | null
  created_at: string
  updated_at: string
  listing: { id: string; title: string; images: string[] | null; price_zmw: number } | null
  seller: { id: string; display_name: string; shop_name: string | null; phone: string } | null
  buyer: { id: string; display_name: string; phone: string } | null
}

const ORDER_SELECT = `
  *,
  listing:listings(id, title, images, price_zmw),
  seller:profiles!orders_seller_id_fkey(id, display_name, shop_name, phone),
  buyer:profiles!orders_buyer_id_fkey(id, display_name, phone)
`

export function useBuyerOrders(buyerId: string | undefined) {
  return useQuery({
    queryKey: ['orders', 'buyer', buyerId],
    queryFn: async (): Promise<OrderWithRelations[]> => {
      const { data, error } = await supabase
        .from('orders')
        .select(ORDER_SELECT)
        .eq('buyer_id', buyerId!)
        .order('created_at', { ascending: false })
      if (error) throw error
      return (data ?? []) as OrderWithRelations[]
    },
    enabled: !!buyerId,
  })
}

export function useSellerOrders(sellerId: string | undefined) {
  return useQuery({
    queryKey: ['orders', 'seller', sellerId],
    queryFn: async (): Promise<OrderWithRelations[]> => {
      const { data, error } = await supabase
        .from('orders')
        .select(ORDER_SELECT)
        .eq('seller_id', sellerId!)
        .order('created_at', { ascending: false })
      if (error) throw error
      return (data ?? []) as OrderWithRelations[]
    },
    enabled: !!sellerId,
  })
}

export function useAdvanceOrderStatus() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ orderId, status }: { orderId: string; status: OrderStatus }) => {
      const { error } = await supabase
        .from('orders')
        .update({ status })
        .eq('id', orderId)
      if (error) throw error
    },
    onSuccess: (_, { orderId }) => {
      queryClient.invalidateQueries({ queryKey: ['order', orderId] })
      queryClient.invalidateQueries({ queryKey: ['orders'] })
    },
  })
}
