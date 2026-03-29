import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

export type NotificationThread = {
  conversationId: string
  orderId: string
  otherPartyName: string
  listingTitle: string | null
  lastMessage: string
  lastMessageAt: string
  lastSenderId: string
  orderStatus: string
}

export type OrderNotification = {
  orderId: string
  listingTitle: string | null
  status: string
  updatedAt: string
  isSeller: boolean
}

export type NotificationsData = {
  threads: NotificationThread[]
  orderUpdates: OrderNotification[]
  unreadCount: number
}

export function useNotifications(
  userId: string | undefined,
  seenAt: number
) {
  return useQuery({
    queryKey: ['notifications', userId],
    queryFn: async (): Promise<NotificationsData> => {
      // ── 1. Conversations + participants ──────────────────────
      const { data: conversations, error: convErr } = await supabase
        .from('conversations')
        .select(`
          id, order_id, buyer_id, seller_id,
          order:orders(id, status, listing:listings(title)),
          buyer:profiles!conversations_buyer_id_fkey(id, display_name, shop_name),
          seller:profiles!conversations_seller_id_fkey(id, display_name, shop_name)
        `)
        .or(`buyer_id.eq.${userId},seller_id.eq.${userId}`)

      if (convErr) throw convErr
      if (!conversations?.length) {
        return await buildOrderUpdates(userId!, [])
      }

      const convIds = conversations.map(c => c.id)

      // ── 2. Most recent messages across all conversations ─────
      const { data: messages, error: msgErr } = await supabase
        .from('messages')
        .select('id, conversation_id, sender_id, body, created_at')
        .in('conversation_id', convIds)
        .order('created_at', { ascending: false })
        .limit(200)

      if (msgErr) throw msgErr

      // ── 3. Last message per conversation ────────────────────
      const lastMsgMap = new Map<string, typeof messages[0]>()
      for (const msg of (messages ?? [])) {
        if (!lastMsgMap.has(msg.conversation_id)) {
          lastMsgMap.set(msg.conversation_id, msg)
        }
      }

      // ── 4. Build threads ─────────────────────────────────────
      const threads: NotificationThread[] = conversations
        .map(conv => {
          const lastMsg = lastMsgMap.get(conv.id)
          if (!lastMsg) return null

          const isBuyer = conv.buyer_id === userId
          const other = isBuyer
            ? (conv.seller as any)
            : (conv.buyer as any)
          const otherName = other?.shop_name ?? other?.display_name ?? 'Unknown'
          const order = conv.order as any

          return {
            conversationId: conv.id,
            orderId: conv.order_id,
            otherPartyName: otherName,
            listingTitle: order?.listing?.title ?? null,
            lastMessage: lastMsg.body,
            lastMessageAt: lastMsg.created_at,
            lastSenderId: lastMsg.sender_id,
            orderStatus: order?.status ?? 'pending',
          } as NotificationThread
        })
        .filter((t): t is NotificationThread => t !== null)
        .sort((a, b) =>
          new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime()
        )

      // ── 5. Unread count: messages after seenAt not sent by me
      const cutoffMs = seenAt > 0 ? seenAt : Date.now() - 48 * 60 * 60 * 1000
      const unreadMessages = (messages ?? []).filter(
        m => m.sender_id !== userId && new Date(m.created_at).getTime() > cutoffMs
      ).length

      const { orderUpdates, unreadOrders } = await buildOrderUpdates(userId!, cutoffMs)

      return {
        threads,
        orderUpdates,
        unreadCount: unreadMessages + unreadOrders,
      }
    },
    enabled: !!userId,
    refetchInterval: 30_000, // poll every 30s as a fallback
  })
}

async function buildOrderUpdates(userId: string, cutoffMs: number) {
  const { data: orders } = await supabase
    .from('orders')
    .select(`
      id, status, updated_at, buyer_id, seller_id,
      listing:listings(title)
    `)
    .or(`buyer_id.eq.${userId},seller_id.eq.${userId}`)
    .order('updated_at', { ascending: false })
    .limit(20)

  const orderUpdates: OrderNotification[] = (orders ?? []).map(o => ({
    orderId: o.id,
    listingTitle: (o.listing as any)?.title ?? null,
    status: o.status,
    updatedAt: o.updated_at,
    isSeller: o.seller_id === userId,
  }))

  const unreadOrders = orderUpdates.filter(
    o => new Date(o.updatedAt).getTime() > cutoffMs
  ).length

  return { orderUpdates, unreadOrders }
}
