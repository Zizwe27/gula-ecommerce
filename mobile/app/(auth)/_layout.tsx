import { Stack, Redirect } from 'expo-router'
import { useAuthStore } from '@/stores/auth'

export default function AuthLayout() {
  const { session } = useAuthStore()

  // Already logged in — send to app
  if (session) return <Redirect href="/(app)" />

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="login" />
      <Stack.Screen name="verify" />
    </Stack>
  )
}
