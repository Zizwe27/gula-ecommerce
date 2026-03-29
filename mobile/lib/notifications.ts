import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/auth'

export async function sendPushNotification(params: {
  recipientId: string
  title: string
  body: string
  data?: Record<string, string>
}) {
  const session = useAuthStore.getState().session
  if (!session) return
  try {
    await supabase.functions.invoke('push-notification', {
      body: params,
      headers: { Authorization: `Bearer ${session.access_token}` },
    })
  } catch {
    // Notifications are best-effort — never throw
  }
}
