import { Redirect } from 'expo-router'
import { useAuthStore } from '@/stores/auth'

export default function Index() {
  const { session, profile } = useAuthStore()

  if (!session) return <Redirect href="/(auth)/login" />
  if (!profile?.onboarded) return <Redirect href="/onboarding" />
  return <Redirect href="/(app)" />
}
