import { useEffect } from 'react'
import { Platform } from 'react-native'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/auth'

// expo-notifications remote push support was removed from Expo Go in SDK 53.
// Dynamic require lets the app load normally in Expo Go without crashing.
let Notifications: typeof import('expo-notifications') | null = null
try {
  Notifications = require('expo-notifications')
  Notifications!.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  })
} catch {
  // Expo Go — push notifications not supported, app continues normally
}

export function usePushToken() {
  const { session } = useAuthStore()

  useEffect(() => {
    if (!session?.user) return
    registerToken(session.user.id)
  }, [session?.user?.id])
}

async function registerToken(userId: string) {
  if (!Notifications || Platform.OS === 'web') return

  const { status } = await Notifications.getPermissionsAsync()
  if (status !== 'granted') return

  try {
    const { data: tokenData } = await Notifications.getExpoPushTokenAsync()
    if (!tokenData) return

    const { data: profile } = await supabase
      .from('profiles')
      .select('push_token')
      .eq('id', userId)
      .single()

    if (profile?.push_token !== tokenData) {
      await supabase
        .from('profiles')
        .update({ push_token: tokenData })
        .eq('id', userId)
    }
  } catch {
    // Simulator or missing credentials — silently ignore
  }
}
