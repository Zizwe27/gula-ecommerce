import { create } from 'zustand'
import { Session } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import { Profile } from '@/types/database'

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

  markNotificationsSeen: () => set({ notificationSeenAt: Date.now() }),

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
    set({ session: null, profile: null, sellerMode: false })
  },
}))
