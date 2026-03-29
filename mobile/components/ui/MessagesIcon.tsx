import { TouchableOpacity, View, Text, StyleSheet } from 'react-native'
import { Feather } from '@expo/vector-icons'
import { router } from 'expo-router'
import { useAuthStore } from '@/stores/auth'
import { useNotifications } from '@/hooks/useNotifications'
import { Colors } from '@/constants/colors'
import { Fonts } from '@/constants/typography'

export function MessagesIcon() {
  const { profile, notificationSeenAt } = useAuthStore()
  const { data } = useNotifications(profile?.id, notificationSeenAt)

  const count = data?.unreadMessageCount ?? 0

  return (
    <TouchableOpacity
      style={styles.btn}
      onPress={() => router.push('/(app)/messages')}
      activeOpacity={0.7}
    >
      <Feather name="mail" size={22} color={Colors.textPrimary} />
      {count > 0 && (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{count > 9 ? '9+' : count}</Text>
        </View>
      )}
    </TouchableOpacity>
  )
}

const styles = StyleSheet.create({
  btn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    position: 'absolute',
    top: 4,
    right: 4,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: Colors.error,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  badgeText: {
    fontFamily: Fonts.bold,
    fontSize: 9,
    color: Colors.white,
    lineHeight: 11,
  },
})
