import { useEffect, useRef } from 'react'
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

export type Message = {
  id: string
  conversation_id: string
  sender_id: string
  body: string
  created_at: string
}

export type Conversation = {
  id: string
  order_id: string
  buyer_id: string
  seller_id: string
  created_at: string
}

export function useConversation(orderId: string | undefined) {
  return useQuery({
    queryKey: ['conversation', orderId],
    queryFn: async (): Promise<Conversation> => {
      const { data, error } = await supabase
        .from('conversations')
        .select('*')
        .eq('order_id', orderId!)
        .single()
      if (error) throw error
      return data as Conversation
    },
    enabled: !!orderId,
  })
}

export function useMessages(conversationId: string | undefined) {
  const queryClient = useQueryClient()

  const { data: messages, isLoading } = useQuery({
    queryKey: ['messages', conversationId],
    queryFn: async (): Promise<Message[]> => {
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .eq('conversation_id', conversationId!)
        .order('created_at', { ascending: true })
      if (error) throw error
      return (data ?? []) as Message[]
    },
    enabled: !!conversationId,
  })

  // Subscribe to realtime inserts
  useEffect(() => {
    if (!conversationId) return

    const channel = supabase
      .channel(`messages:${conversationId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          queryClient.setQueryData<Message[]>(
            ['messages', conversationId],
            (prev) => [...(prev ?? []), payload.new as Message]
          )
        }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [conversationId])

  return { messages: messages ?? [], isLoading }
}

export function useSendMessage() {
  return useMutation({
    mutationFn: async ({
      conversationId,
      senderId,
      body,
    }: {
      conversationId: string
      senderId: string
      body: string
    }) => {
      const { error } = await supabase
        .from('messages')
        .insert({ conversation_id: conversationId, sender_id: senderId, body })
      if (error) throw error
    },
  })
}
