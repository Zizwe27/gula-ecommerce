import { create } from 'zustand'
import { Session } from '@supabase/supabase-js'
import * as SecureStore from 'expo-secure-store'
import { supabase } from '@/lib/supabase'
import { Profile } from '@/types/database'

const SEEN_AT_KEY = 'notification_seen_at'

interface AuthState {
  session: Session | null
  profile: Profile | null
  // true only after both auth state AND profile (if logged in) are resolved —
  // prevents flash of wrong screen on app launch
  initialized: boolean
  // true = viewing the app as a seller; false = viewing as a buyer
  // only meaningful when profile.seller_status === 'approved'
  sellerMode: boolean
  // unix ms — messages/orders after this timestamp are "unread"
  notificationSeenAt: number
  setSession: (session: Session | null) => void
  setProfile: (profile: Profile | null) => void
  fetchProfile: (userId: string) => Promise<void>
  markInitialized: () => void
  setSellerMode: (mode: boolean) => void
  markNotificationsSeen: () => void
  loadNotificationSeenAt: () => Promise<void>
  signOut: () => Promise<void>
}

export const useAuthStore = create<AuthState>((set) => ({
  session: null,
  profile: null,
  initialized: false,
  sellerMode: false,
  notificationSeenAt: 0,

  setSession: (session) => set({ session }),

  setProfile: (profile) => set({ profile }),

  markInitialized: () => set({ initialized: true }),

  setSellerMode: (mode) => set({ sellerMode: mode }),

  markNotificationsSeen: () => {
    const now = Date.now()
    set({ notificationSeenAt: now })
    SecureStore.setItemAsync(SEEN_AT_KEY, String(now)).catch(() => {})
  },

  loadNotificationSeenAt: async () => {
    try {
      const stored = await SecureStore.getItemAsync(SEEN_AT_KEY)
      if (stored) set({ notificationSeenAt: Number(stored) })
    } catch {}
  },

  fetchProfile: async (userId: string) => {
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single()
    if (data) set({ profile: data })
  },

  signOut: async () => {
    await supabase.auth.signOut()
    SecureStore.deleteItemAsync(SEEN_AT_KEY).catch(() => {})
    set({ session: null, profile: null, sellerMode: false, notificationSeenAt: 0 })
  },
}))
