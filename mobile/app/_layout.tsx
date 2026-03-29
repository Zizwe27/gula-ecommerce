import { useEffect } from 'react'
import { View, ActivityIndicator, StyleSheet } from 'react-native'
import { Stack } from 'expo-router'
import * as SplashScreen from 'expo-splash-screen'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import {
  Ubuntu_300Light,
  Ubuntu_400Regular,
  Ubuntu_500Medium,
  Ubuntu_700Bold,
  useFonts,
} from '@expo-google-fonts/ubuntu'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/auth'
import { usePushToken } from '@/hooks/usePushToken'

SplashScreen.preventAutoHideAsync()

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 1000 * 60, retry: 1 },
  },
})

export default function RootLayout() {
  const { setSession, setProfile, fetchProfile, markInitialized } = useAuthStore()

  const [fontsLoaded] = useFonts({
    Ubuntu_300Light,
    Ubuntu_400Regular,
    Ubuntu_500Medium,
    Ubuntu_700Bold,
  })

  useEffect(() => {
    // Resolve initial session + profile before showing any screen
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      setSession(session)
      if (session?.user) {
        await fetchProfile(session.user.id)
      }
      markInitialized()
    })

    // Keep session and profile in sync on auth events
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        // Treat token refresh failure as a sign-out
        if (event === 'TOKEN_REFRESH_FAILED' || event === 'SIGNED_OUT') {
          setSession(null)
          setProfile(null)
          return
        }
        setSession(session)
        if (session?.user) {
          await fetchProfile(session.user.id)
        } else {
          setProfile(null)
        }
      }
    )

    return () => subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (fontsLoaded) SplashScreen.hideAsync()
  }, [fontsLoaded])

  const { initialized } = useAuthStore()

  // Register push notification token once logged in
  usePushToken()

  if (!fontsLoaded || !initialized) {
    return (
      <View style={styles.splash}>
        <ActivityIndicator color="#0A0A0A" size="large" />
      </View>
    )
  }

  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="index" />
          <Stack.Screen name="onboarding" />
          <Stack.Screen name="(auth)" />
          <Stack.Screen name="(app)" />
        </Stack>
      </QueryClientProvider>
    </SafeAreaProvider>
  )
}

const styles = StyleSheet.create({
  splash: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
})
