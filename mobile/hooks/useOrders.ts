import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { sendPushNotification } from '@/lib/notifications'

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

const STATUS_NOTIFICATION: Record<
  string,
  { recipientRole: 'buyer' | 'seller'; title: string; body: string }
> = {
  pending: {
    recipientRole: 'buyer',
    title: 'Payment confirmed',
    body: 'Your payment has been confirmed. The seller will prepare your order.',
  },
  received: {
    recipientRole: 'buyer',
    title: 'Order received',
    body: 'The seller has received your order.',
  },
  preparing: {
    recipientRole: 'buyer',
    title: 'Order being prepared',
    body: 'Your order is being prepared.',
  },
  delivered: {
    recipientRole: 'buyer',
    title: 'Order delivered',
    body: 'Your order has been marked as delivered. Please confirm receipt.',
  },
  completed: {
    recipientRole: 'seller',
    title: 'Order completed',
    body: 'The buyer has confirmed delivery. Order is complete.',
  },
}

export function useCancelOrder() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({
      orderId,
    }: {
      orderId: string
      buyerId: string
      sellerId: string
      cancelledBy: 'buyer' | 'seller'
    }) => {
      const { error } = await supabase
        .from('orders')
        .update({ status: 'cancelled' })
        .eq('id', orderId)
      if (error) throw error
    },
    onSuccess: (_, { orderId, buyerId, sellerId, cancelledBy }) => {
      queryClient.invalidateQueries({ queryKey: ['order', orderId] })
      queryClient.invalidateQueries({ queryKey: ['orders'] })
      const recipientId = cancelledBy === 'buyer' ? sellerId : buyerId
      sendPushNotification({
        recipientId,
        title: 'Order cancelled',
        body: 'This order has been cancelled.',
      })
    },
  })
}

export function useAdvanceOrderStatus() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({
      orderId,
      status,
      buyerId,
      sellerId,
    }: {
      orderId: string
      status: OrderStatus
      buyerId: string
      sellerId: string
    }) => {
      const { error } = await supabase
        .from('orders')
        .update({ status })
        .eq('id', orderId)
      if (error) throw error
    },
    onSuccess: (_, { orderId, status, buyerId, sellerId }) => {
      queryClient.invalidateQueries({ queryKey: ['order', orderId] })
      queryClient.invalidateQueries({ queryKey: ['orders'] })

      const notif = STATUS_NOTIFICATION[status]
      if (notif) {
        const recipientId = notif.recipientRole === 'buyer' ? buyerId : sellerId
        sendPushNotification({ recipientId, title: notif.title, body: notif.body })
      }
    },
  })
}
